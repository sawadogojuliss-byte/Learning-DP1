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
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1});
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
async function jusqua(predicate){const fin=Date.now()+10000;while(!predicate()){if(Date.now()>fin)throw Error('Synchronisation attendue');await new Promise(r=>setTimeout(r,100));}}
try {
 const h=await telephone('host',{width:390,height:844}),g=await telephone('guest',{width:320,height:568});const hp=h.page,gp=g.page;
 await hp.goto(base,{waitUntil:'domcontentloaded'});await hp.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
 await hp.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerReglages();focusChoisirOnglet('salon');});
 for(const id of ['focusVoixActive','focusOptNotif','focusOptAuto'])assert.equal(await hp.locator('#'+id).evaluate(e=>e.closest('label').control===e),true,'le libellé commande encore son interrupteur');
 const stockage=()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>(k.startsWith('studyPlanIB_focus')&&k!=='studyPlanIB_focusEtat')||k.startsWith('studyPlanIB_minuteurParametres')||k.startsWith('studyPlanIB_voix')));
 const avant=await hp.evaluate(stockage);await hp.locator('#salonNom').fill('Isolation');await hp.locator('#salonCreer').click();await hp.locator('#salonLienCarte').waitFor();await hp.locator('.salon-lien-fermer').click();
 await gp.goto(base+'#salon='+id,{waitUntil:'domcontentloaded'});await gp.locator('#salonPseudo').waitFor({state:'visible',timeout:60000});await gp.locator('#salonPseudo').fill('Camille');await gp.locator('#salonRejoindreBouton').click();await gp.waitForFunction(()=>!document.getElementById('salonInvitation').open);
 await hp.waitForFunction(()=>document.getElementById('salonEtatConnexion').textContent.includes('Connecté'));
 await hp.evaluate(()=>focusPoserFond(focusIndexParId('pluie-palmes-anime')));
 assert.equal(await hp.locator('#salonChoixPartage').evaluate(e=>e.open),true);if(process.env.SALON_SCREENSHOTS)await hp.screenshot({path:'/home/user/salon-choix-isolation.png'});assert.notEqual(await hp.locator('#salonChoixPartage').boundingBox(),null);
 await hp.getByRole('button',{name:'Pour tout le groupe'}).click();await gp.waitForFunction(()=>!!document.querySelector('#salonDecor video'));assert.equal(room.partage.theme,'pluie-palmes-anime');
 await hp.evaluate(()=>focusChoisirReglage('taille','grande'));await gp.waitForFunction(()=>document.getElementById('salonEcran').classList.contains('focus-taille-grande'));
 assert.equal(await hp.locator('#salonChoixPartage').evaluate(e=>e.open),false,'choix demandé une seule fois');
 await hp.evaluate(()=>{focusChoisirReglage('style','jauge');focusChoisirOption('barre',true);focusChoisirOption('citation',false);});await jusqua(()=>room.partage.citation?.visible===false);assert.equal(await hp.locator('#salonVisuel .focus-jauge').count(),1);assert.equal(await hp.locator('#salonBarre').isVisible(),true);await gp.waitForFunction(()=>document.getElementById('salonCitation').textContent==='');
 await hp.evaluate(()=>{focusChoisirSon('pluie');focusReglerVolume('pluie',.2);document.getElementById('focusVoixActive').checked=false;chronoSauverReglagesVoix();});
 await hp.waitForTimeout(800);assert.deepEqual(room.partage.sons,['pluie']);assert.deepEqual(await hp.evaluate(stockage),avant,'aucun réglage personnel écrasé');
 const guestAvant=await gp.evaluate(stockage);await gp.evaluate(()=>focusChoisirReglage('taille','petite'));assert.equal(await gp.locator('#salonChoixPartage').evaluate(e=>e.open),false);await gp.waitForFunction(()=>document.getElementById('salonEcran').classList.contains('focus-taille-petite'));assert.equal(room.partage.horloge.taille,'grande');assert.deepEqual(await gp.evaluate(stockage),guestAvant);
 await hp.reload({waitUntil:'domcontentloaded'});await hp.waitForFunction(()=>document.getElementById('salonInvitation')&&!document.getElementById('salonInvitation').open&&!document.getElementById('salonCommandes').hidden,{timeout:60000});await hp.waitForFunction(()=>document.getElementById('salonEtatConnexion').textContent.includes('Connecté'));
 await hp.evaluate(()=>focusChoisirReglage('taille','petite'));await jusqua(()=>room.partage.horloge?.taille==='petite');assert.equal(room.partage.horloge.taille,'petite');assert.equal(await hp.locator('#salonChoixPartage').evaluate(e=>e.open),false,'choix conservé après reprise');assert.deepEqual(await hp.evaluate(stockage),avant);
 await gp.evaluate(()=>salonQuitter());await gp.waitForFunction(()=>document.getElementById('salonEcran').hidden);assert.deepEqual(await gp.evaluate(stockage),guestAvant);
 hp.once('dialog',d=>d.accept());await hp.evaluate(()=>salonQuitter());await hp.waitForFunction(()=>document.getElementById('salonEcran').hidden);assert.deepEqual(await hp.evaluate(stockage),avant);
 assert.deepEqual(h.errors,[]);assert.deepEqual(g.errors,[]);await h.context.close();await g.context.close();
 // Une nouvelle participation choisit « seulement moi », puis transmet le rôle.
 room=null;const h2=await telephone('host',{width:390,height:844}),g2=await telephone('guest',{width:320,height:568});const p=h2.page,q=g2.page;
 await p.goto(base,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
 await p.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerReglages();focusChoisirOnglet('salon');});
 await p.locator('#salonNom').fill('Privé');await p.locator('#salonCreer').click();await p.locator('#salonLienCarte').waitFor();await p.locator('.salon-lien-fermer').click();
 await q.goto(base+'#salon='+id,{waitUntil:'domcontentloaded'});await q.locator('#salonPseudo').waitFor({state:'visible',timeout:60000});await q.locator('#salonPseudo').fill('Camille');await q.locator('#salonRejoindreBouton').click();await q.waitForFunction(()=>!document.getElementById('salonInvitation').open);await p.waitForFunction(()=>document.getElementById('salonEtatConnexion').textContent.includes('Connecté'));
 await p.evaluate(()=>focusChoisirReglage('taille','grande'));await p.getByRole('button',{name:'Seulement pour moi'}).click();await p.waitForFunction(()=>document.getElementById('salonEcran').classList.contains('focus-taille-grande'));assert.equal(room.options.horloge,false);
 await p.evaluate(()=>focusPoserFond(focusIndexParId('pluie-palmes-anime')));await p.waitForTimeout(500);assert.equal(room.options.theme,false);assert.equal(await p.locator('#salonChoixPartage').evaluate(e=>e.open),false);
 room.membres.forEach(m=>m.vuLe=Date.now());await p.locator('#salonBtnReglages').click();await p.locator('[data-onglet="reunion-groupe"]').click();await p.waitForSelector('#salonListeMembres button');p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'Transférer'}).click();await q.waitForFunction(()=>!document.getElementById('salonCommandes').hidden);await p.waitForFunction(()=>document.getElementById('salonCommandes').hidden);
 await q.evaluate(()=>focusPoserFond(focusIndexParId('pluie-palmes-anime')));assert.equal(await q.locator('#salonChoixPartage').evaluate(e=>e.open),true,'nouvel organisateur décide de son choix');await q.getByRole('button',{name:'Pour tout le groupe'}).click();await jusqua(()=>room.partage.theme==='pluie-palmes-anime');assert.equal(room.partage.theme,'pluie-palmes-anime');
 assert.deepEqual(h2.errors,[]);assert.deepEqual(g2.errors,[]);await h2.context.close();await g2.context.close();console.log('OK isolation, partage, choix privé, transfert et reprise (transport simulé)');
}finally{await browser.close()}
