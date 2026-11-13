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
 if(op==='modify'){if(actor!=='host')throw Error('permission-denied');if(arg.revision!==room.revision)throw Error('revision-conflict');Object.assign(room,clone(arg.changement));room.revision++;return clone(room);}
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
  const session=s=>({...s,maintenant:()=>Date.now(),observer(cb,err){let stop=false;const lire=()=>call('read').then(d=>{if(!stop)cb(d,{connecte:true})},e=>{if(!stop)err(e)});lire();const t=setInterval(lire,250);return()=>{stop=true;clearInterval(t)}},modifier:(revision,changement)=>call('modify',{revision,changement}),quitter:()=>call('leave'),fermer:()=>call('close')});
  window.SALON_FOCUS_TRANSPORT={creer:d=>call('create',d).then(session),reprendre:id=>call('resume',{id}).then(session),rejoindre:(id,pseudo)=>call('join',{id,pseudo}).then(session),apercu:id=>call('preview',{id})};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());return {context,page,errors};
}
try{
 const h=await telephone('host',{width:390,height:844}),g=await telephone('guest',{width:320,height:568});const hp=h.page,gp=g.page;
 await hp.goto(base,{waitUntil:'domcontentloaded'});await hp.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
 await hp.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerReglages();focusChoisirOnglet('salon')});
 await hp.locator('#salonNom').fill('Notre séance');await hp.locator('#salonCreer').click();await hp.locator('#salonLienCarte').waitFor();await hp.locator('.salon-lien-fermer').click();
 await gp.goto(base+'#salon='+id,{waitUntil:'domcontentloaded'});await gp.locator('#salonPseudo').waitFor({state:'visible',timeout:60000});
 if(process.env.SALON_SCREENSHOTS)await gp.screenshot({path:'/home/user/salon-deux-invitation.png'});
 assert.match(await gp.locator('#salonInvitationDescription').innerText(),/sans compte/);assert.equal(await gp.locator('#salonPseudoLabel').isVisible(),true);
 assert.notEqual(await gp.locator('#salonPseudo').evaluate(e=>getComputedStyle(e).caretColor),'rgba(0, 0, 0, 0)');
 await gp.locator('#salonPseudo').fill('Camille');await gp.locator('#salonRejoindreBouton').click();await gp.waitForFunction(()=>!document.getElementById('salonInvitation').open);
 for(const p of [hp,gp]){await p.waitForFunction(()=>document.getElementById('salonParticipantsNoms')?.textContent.includes('Camille'));assert.match(await p.locator('#salonParticipantsNoms').innerText(),/Organisateur/);assert.equal(await p.locator('#salonParticipants').isVisible(),true);}
 if(process.env.SALON_SCREENSHOTS){await hp.screenshot({path:'/home/user/salon-deux-hote.png'});await gp.screenshot({path:'/home/user/salon-deux-invite.png'});}
 room.membres.forEach(m=>m.vuLe=Date.now());await hp.waitForFunction(()=>document.querySelectorAll('#salonParticipantsNoms .salon-participant-recent').length===2);
 room.membres.find(m=>m.uid==='guest').vuLe=Date.now()-180000;await hp.waitForFunction(()=>!document.getElementById('salonParticipantsNoms').textContent.includes('Camille'));
 room.membres.find(m=>m.uid==='guest').vuLe=Date.now();await hp.waitForFunction(()=>document.getElementById('salonParticipantsNoms').textContent.includes('Camille'));
 const bornes=await gp.locator('#salonParticipants').boundingBox();assert.ok(bornes.y>=0&&bornes.y+bornes.height<=568,'les pseudos sont visibles sans défiler sur le petit téléphone');
 for(const p of [hp,gp]){
  await p.locator('#salonBtnReglages').click();
  for(const ancien of ['salon','statistiques'])assert.equal(await p.locator(`[data-onglet="${ancien}"]`).isVisible(),false);
  for(const nom of ['objectif','groupe','preferences','bilan']) {await p.locator(`[data-onglet="reunion-${nom}"]`).click();assert.equal(await p.locator(`[data-salon-fiche="${nom}"]`).isVisible(),true);}
  await p.getByRole('button',{name:'Fermer les paramètres'}).click();
 }
 // La liste distingue les personnes inscrites d'une activité récente ou non vérifiée.
 await gp.locator('#salonBtnReglages').click();await gp.locator('[data-onglet="reunion-groupe"]').click();
 const membres=gp.locator('#salonListeMembres [role="listitem"]');assert.equal(await membres.count(),2);
 assert.match(await membres.nth(0).innerText(),/Organisateur/);assert.match(await membres.nth(1).innerText(),/Camille/);assert.match(await membres.nth(1).innerText(),/Vous/);assert.match(await membres.nth(1).innerText(),/Activité récente/);
 if(process.env.SALON_SCREENSHOTS)await gp.screenshot({path:'/home/user/salon-groupe-v4-mobile.png'});
 room.membres.find(m=>m.uid==='host').vuLe=Date.now()-180000;await gp.waitForFunction(()=>document.querySelector('#salonListeMembres [role=listitem]')?.textContent.includes('Activité ancienne'));
 delete room.membres.find(m=>m.uid==='host').vuLe;await gp.waitForFunction(()=>document.querySelector('#salonListeMembres [role=listitem]')?.textContent.includes('Présence non vérifiée'));
 await gp.locator('[data-onglet="reunion-preferences"]').click();await gp.locator('#salonDiscret').check();await gp.locator('#focusReglages .focus-tiroir-contenu').evaluate(e=>e.scrollTop=10000);await gp.locator('[data-onglet="reunion-groupe"]').click();await gp.waitForFunction(()=>document.querySelector('#focusReglages .focus-tiroir-contenu').scrollTop<2,null,{timeout:5000});assert.equal(await membres.count(),0);assert.equal(await gp.locator('#salonMembresDiscrets').isVisible(),true);
 await gp.locator('[data-onglet="reunion-preferences"]').click();await gp.locator('#salonDiscret').uncheck();await gp.getByRole('button',{name:'Fermer les paramètres'}).click();
 assert.equal(await gp.locator('#salonCommandes').isVisible(),false);assert.equal(await gp.evaluate(()=>location.hash),'#salon='+id);
 // Vérifie le curseur et la sélection sans perdre le focus au cours des mises à jour.
 await gp.locator('#salonBtnReglages').click();await gp.locator('[data-onglet="reunion-objectif"]').click();if(process.env.SALON_SCREENSHOTS)await gp.screenshot({path:'/home/user/salon-parametres-v3.png'});const input=gp.locator('#salonObjectif');await input.fill('Réviser ensemble');
 await input.evaluate(e=>{e.focus();e.setSelectionRange(3,7)});await gp.waitForTimeout(1400);
 assert.deepEqual(await input.evaluate(e=>[document.activeElement===e,e.selectionStart,e.selectionEnd,getComputedStyle(e).cursor,getComputedStyle(e).userSelect]),[true,3,7,'text','text']);
 assert.notEqual(await input.evaluate(e=>getComputedStyle(e).caretColor),'rgba(0, 0, 0, 0)');
 await gp.getByRole('button',{name:'Fermer les paramètres'}).click();
 // Un chrono en pause ne doit pas être reconstruit quatre fois par seconde.
 await hp.evaluate(()=>{window.__chronoMutations=0;window.__chronoObserver=new MutationObserver(records=>window.__chronoMutations+=records.length);window.__chronoObserver.observe(document.getElementById('salonTemps'),{childList:true,characterData:true,subtree:true});});
 await hp.waitForTimeout(1600);assert.equal(await hp.evaluate(()=>window.__chronoMutations),0);await hp.evaluate(()=>window.__chronoObserver.disconnect());
 await hp.locator('#salonDemarrer').click();await gp.waitForFunction(()=>document.getElementById('salonInfoChrono').textContent==='En cours');await hp.locator('#salonDemarrer').click();await gp.waitForFunction(()=>document.getElementById('salonInfoChrono').textContent==='En pause');
 // Identité momentanément indisponible, même après perte de sessionStorage : pas de demande de pseudo à l'hôte.
 authHote=false;await hp.evaluate(()=>sessionStorage.removeItem('studyPlanIB_salon_session'));await hp.reload({waitUntil:'domcontentloaded'});
 await hp.waitForFunction(()=>document.getElementById('salonInvitationTitre')?.textContent==='Reprendre ton salon',{timeout:60000});assert.equal(await hp.locator('#salonPseudo').isVisible(),false);
 authHote=true;await hp.locator('#salonRejoindreBouton').click();await hp.waitForFunction(()=>!document.getElementById('salonInvitation').open&&!document.getElementById('salonCommandes').hidden);assert.equal(await hp.evaluate(()=>location.hash),'#salon='+id);
 await gp.getByRole('button',{name:'Quitter le salon',exact:true}).click();await hp.waitForFunction(()=>!document.getElementById('salonParticipantsNoms').textContent.includes('Camille'));
 await gp.locator('#focusReglages').waitFor({state:'visible'});for(const id of ['salon','statistiques'])assert.equal(await gp.locator(`[data-onglet="${id}"]`).isVisible(),true,'rubriques personnelles restaurées après le départ');
 for(const nom of ['objectif','groupe','preferences','bilan'])assert.equal(await gp.locator(`[data-onglet="reunion-${nom}"]`).isVisible(),false,'outils du salon masqués hors session');
 assert.deepEqual(h.errors,[]);assert.deepEqual(g.errors,[]);await h.context.close();await g.context.close();console.log('OK deux téléphones simulés 390×844 / 320×568 : identité, saisie, participants, chrono et départ');
}finally{await browser.close()}
