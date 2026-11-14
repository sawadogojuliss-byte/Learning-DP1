/* Deux navigateurs mobiles indépendants avec serveur simulé : aucun Firebase réel. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const base=process.env.STUDY_SITE||'http://127.0.0.1:8647/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
const id='abcdef0123456789abcdef0123456789abcdef0123456789';
let room=null, authHote=true;
const clone=v=>structuredClone(v);
async function backend(actor,op,arg={}) {
 if(op==='create'){room={...clone(arg),revision:1,ferme:false,organisateurUid:'host',membres:[{uid:'host',pseudo:'Organisateur'}]};return {id,uid:'host',role:'hote'};}
 if(op==='resume'){if(actor!=='host')throw Error('permission-denied');if(!authHote)throw Error('auth-required');return {id,uid:'host',role:'hote'};}
 if(op==='preview'||op==='read')return {...clone(room),maintenant:Date.now()};
 if(op==='join'){room.membres=room.membres.filter(m=>m.uid!==actor);room.membres.push({uid:actor,pseudo:arg.pseudo});return {id,uid:actor,role:'invite'};}
 if(op==='modify'){if(actor!==room.organisateurUid)throw Error('permission-denied');if(arg.revision!==room.revision)throw Error('revision-conflict');Object.assign(room,clone(arg.changement));room.revision++;return clone(room);}
 if(op==='transfer'){if(actor!==room.organisateurUid)throw Error('permission-denied');room.organisateurUid=arg.uid;room.revision++;return clone(room);}
 if(op==='leave'){room.membres=room.membres.filter(m=>m.uid!==actor);return;}
 if(op==='close'){room.ferme=true;room.revision++;return;}
 throw Error('operation inconnue');
}
async function telephone(actor,viewport){
 const context=await browser.newContext({viewport,isMobile:viewport.width<600,hasTouch:viewport.width<600,deviceScaleFactor:1});
 await context.exposeFunction('__mobileBackend',(op,arg)=>backend(actor,op,arg));
 await context.addInitScript(()=>{
  window.__STUDYPLAN_E2E=true;
  const call=(op,arg)=>window.__mobileBackend(op,arg).catch(e=>{let err=Error(e.message);for(const c of ['permission-denied','auth-required','revision-conflict'])if(e.message.includes(c))err.code=c;throw err;});
  const session=s=>({...s,maintenant:()=>Date.now(),observer(cb,err){let stop=false;const lire=()=>call('read').then(d=>{if(!stop)cb(d,{connecte:true})},e=>{if(!stop)err(e)});lire();const t=setInterval(lire,250);return()=>{stop=true;clearInterval(t)}},modifier:(revision,changement)=>call('modify',{revision,changement}),transferer:uid=>call('transfer',{uid}),quitter:()=>call('leave'),fermer:()=>call('close')});
  window.SALON_FOCUS_TRANSPORT={creer:d=>call('create',d).then(session),reprendre:id=>call('resume',{id}).then(session),rejoindre:(id,pseudo)=>call('join',{id,pseudo}).then(session),apercu:id=>call('preview',{id})};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());return {context,page,errors};
}
async function analyser(page, selector, position='centre') {
 const e=page.locator(selector).first();assert.equal(await e.isVisible(),true,selector+' doit être visible');assert.equal(await e.isDisabled().catch(()=>false),false,selector+' doit être activé');
 await e.scrollIntoViewIfNeeded();await page.waitForTimeout(450);const b=await e.boundingBox();assert.ok(b && b.width>=4 && b.height>=4,selector+' doit avoir une surface mesurable');
 const x=position==='bord'?b.x+1.5:b.x+b.width/2, y=b.y+b.height/2;
 await page.mouse.move(x,y);const mesures=await page.evaluate(async ({x,y})=>{const r=[];for(let i=0;i<55;i++){const el=document.elementFromPoint(x,y);r.push({cursor:el?getComputedStyle(el).cursor:'',tag:el?.tagName,id:el?.id,classe:el?.getAttribute('class')});await new Promise(f=>requestAnimationFrame(f));}return r;},{x,y});
 const ensemble=[...new Set(mesures.map(m=>m.cursor))];assert.deepEqual(ensemble,['pointer'],selector+' : curseur de bouton instable');
}
try {
 const h=await telephone('host',{width:1280,height:800});const p=h.page;await p.goto(base,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
 await p.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerReglages();focusChoisirOnglet('salon');});
 await analyser(p,'#salonCreer');await analyser(p,'#salonCreer','bord');await analyser(p,'.salon-options label');
 await p.locator('#salonNom').fill('Curseur');await p.locator('#salonCreer').click();await p.locator('#salonLienCarte').waitFor();
 await analyser(p,'.salon-lien-fermer');await analyser(p,'#salonLienCarte .salon-copier');await p.locator('.salon-lien-fermer').click();await p.waitForFunction(()=>document.getElementById('salonEtatConnexion').textContent.includes('Connecté'));
 // Aucune réécriture inutile du badge ou des boutons pendant les ticks et
 // les notifications répétées d'un état inchangé.
 await p.evaluate(()=>{window.__mutationsSalon=[];window.__observateurSalon=new MutationObserver(ms=>ms.forEach(m=>window.__mutationsSalon.push([m.type,m.target.id||''])));window.__observateurSalon.observe(document.querySelector('#panelPomodoro'),{attributes:true,childList:true,subtree:true,attributeFilter:['class','style','hidden','disabled']});});
 await p.waitForTimeout(1500);const mutations=await p.evaluate(()=>{__observateurSalon.disconnect();return __mutationsSalon});
 assert.deepEqual(mutations,[],'un salon immobile ne réécrit pas ses contrôles');
 for(const s of ['#salonDemarrer','#salonEcran [data-mode=short]','#salonBtnMessages','#salonBtnReglages','#salonQuitterBouton']){await analyser(p,s);await analyser(p,s,'bord');}
 await p.locator('#salonBtnMessages').click();await analyser(p,'#salonMessagerie button');assert.equal(await p.locator('#salonChatTexte').evaluate(e=>getComputedStyle(e).cursor),'text');await p.evaluate(()=>salonFermerMessages());
 await p.locator('#salonBtnReglages').click();await analyser(p,'[data-onglet="reunion-groupe"]');await p.locator('[data-onglet="reunion-groupe"]').click();await analyser(p,'#salonReglages');
 await p.locator('[data-onglet="reunion-objectif"]').click();assert.equal(await p.locator('#salonObjectif').evaluate(e=>getComputedStyle(e).cursor),'text');await p.locator('[data-onglet="themes"]').click();await analyser(p,'#focusThemesCorps button');await analyser(p,'#focusThemesCorps button','bord');
 const g=await telephone('guest',{width:390,height:844});await g.page.goto(base+'#salon='+id,{waitUntil:'domcontentloaded'});await g.page.locator('#salonPseudo').waitFor({state:'visible',timeout:60000});assert.equal(await g.page.locator('#salonPseudo').evaluate(e=>getComputedStyle(e).cursor),'text');await g.page.locator('#salonPseudo').fill('Invité');await g.page.locator('#salonRejoindreBouton').click();await g.page.waitForFunction(()=>!document.getElementById('salonInvitation').open);await g.page.waitForFunction(()=>document.getElementById('salonEtatConnexion').textContent.includes('Connecté'));assert.equal(await g.page.locator('#salonEcran [data-mode=short]').isDisabled(),true);await analyser(g.page,'#salonBtnReglages');
 assert.deepEqual(h.errors,[]);assert.deepEqual(g.errors,[]);await h.context.close();await g.context.close();console.log('OK curseur salon : commandes, stabilité des ticks, texte et invité (serveur simulé)');
}finally{await browser.close()}
