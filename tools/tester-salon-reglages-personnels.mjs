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
 const mobile=viewport.width<720;
 const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
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
 const desktop=process.env.SALON_TEST_DESKTOP==='1';
 const h=await telephone('host',desktop?{width:1280,height:800}:{width:390,height:844}),g=await telephone('guest',desktop?{width:1280,height:800}:{width:320,height:568});const hp=h.page,gp=g.page;
 await hp.goto(base,{waitUntil:'domcontentloaded'});await hp.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
 await hp.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerReglages();focusChoisirOnglet('salon');});
 for(const id of ['focusVoixActive','focusOptNotif','focusOptAuto'])assert.equal(await hp.locator('#'+id).evaluate(e=>e.closest('label').control===e),true,'le libellé commande encore son interrupteur');
 const stockage=()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>(k.startsWith('studyPlanIB_focus')&&k!=='studyPlanIB_focusEtat')||k.startsWith('studyPlanIB_minuteurParametres')||k.startsWith('studyPlanIB_voix')));
 const avant=await hp.evaluate(stockage);await hp.locator('#salonNom').fill('Isolation');await hp.locator('#salonCreer').click();await hp.locator('#salonLienCarte').waitFor();await hp.locator('.salon-lien-fermer').click();
 await gp.goto(base+'#salon='+id,{waitUntil:'domcontentloaded'});await gp.locator('#salonPseudo').waitFor({state:'visible',timeout:60000});await gp.locator('#salonPseudo').fill('Camille');await gp.locator('#salonRejoindreBouton').click();await gp.waitForFunction(()=>!document.getElementById('salonInvitation').open);
 await hp.waitForFunction(()=>document.getElementById('salonEtatConnexion').textContent.includes('Connecté'));

 // Les réglages du salon restent inchangés, pour l'hôte comme pour l'invité.
 async function menuPersonnel(p) {
  for(const id of ['themes','horloge','minuteur','citations','voix','salon','statistiques']) {
   const item=p.locator('#focusReglages [data-onglet="'+id+'"]');
   assert.equal(await item.isVisible(),true,'rubrique personnelle '+id);
   await item.click();assert.equal(await p.locator('#focusReglages [data-page="'+id+'"]').isVisible(),true,'page '+id);
  }
  for(const id of ['objectif','groupe','preferences','bilan'])assert.equal(await p.locator('[data-reunion-onglet="'+id+'"]').isVisible(),false);
  assert.equal(await p.locator('.salon-limite-reglage').first().isVisible(),false);
 }
 async function menuSalon(p,host) {
  await p.locator('#salonBtnReglages').click();
  for(const id of ['objectif','groupe','preferences','bilan'])assert.equal(await p.locator('[data-reunion-onglet="'+id+'"]').isVisible(),true,'salon '+id);
  for(const id of ['salon','statistiques'])assert.equal(await p.locator('#focusReglages [data-onglet="'+id+'"]').isVisible(),false);
  await p.locator('#focusReglages [data-onglet="minuteur"]').click();
  assert.equal(await p.locator('#focusDureesPersonnelles').isVisible(),false);
  assert.equal(await p.locator('#salonReglagesMinuteur').isVisible(),host);
  await p.locator('.focus-tiroir-fermer').click();
 }
 const roomInitial=clone(room);
 for(const [p,host] of [[hp,true],[gp,false]]) {
  await menuSalon(p,host);
  const tailleSalon=await p.evaluate(()=>focusLireReglages().taille);
  const voixSalon=await p.evaluate(()=>chronoVoixActive());
  await p.locator('#salonEcran button[aria-label="Retour à l\'emploi du temps"]').click();
  await p.evaluate(()=>navigateTo('pomodoro'));
  await p.locator('#focusBtnReglages').click();await menuPersonnel(p);
  await p.locator('[data-onglet="minuteur"]').click();
  assert.equal(await p.locator('#focusDureeFocus').isEnabled(),true);
  await p.locator('#focusDureeFocus').fill(host?'32':'33');await p.locator('#focusDureeFocus').dispatchEvent('change');
  await p.locator('[data-onglet="horloge"]').click();
  await p.locator('#focusChoixTaille [data-taille="grande"]').click();
  await p.locator('[data-onglet="voix"]').click();
  await p.locator('#focusVoixActive').evaluate(el=>{el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}));});
  assert.equal(await p.evaluate(()=>focusLireReglages().taille),'grande');
  assert.equal(await p.evaluate(()=>chronoVoixActive()),false);
  assert.equal(await p.evaluate(()=>focusDurees().focus),host?32:33);
  await p.locator('.focus-tiroir-fermer').click();await p.locator('#salonRaccourci').click();
  await menuSalon(p,host);
  assert.equal(await p.evaluate(()=>focusLireReglages().taille),tailleSalon,'taille du salon conservée');
  assert.equal(await p.evaluate(()=>chronoVoixActive()),voixSalon,'voix du salon conservée');
  assert.deepEqual(room.partage,roomInitial.partage,'aucun partage personnel');
  assert.deepEqual(room.options,roomInitial.options,'options du salon conservées');
 }
 // Naviguer directement vers les séances depuis le salon, puis lancer la
 // séance réelle : on retrouve le même panneau personnel, statistiques comprises.
 await hp.clock.install({time:new Date('2031-06-15T10:00:00')});
 await hp.evaluate(()=>{
  selectedDay=6;planningDecalageSemaine=0;sundayWakeup='08:00';sundaySleepHours=8;
  subjects=[{name:'Mathématiques',icon:'📚',level:'HL'}];optionalSubjects=[];selectedActivities=[];
  customEvents=[{id:'reglages-seance',day:6,date:'2031-06-15',title:'Révision de physique',startTime:'09:30',endTime:'10:30',type:'study',icon:'📚',source:'custom',pinned:true,timestamp:Date.now()}];
  emploiFige=null;v3Save();navigateTo('seances');
 });
 assert.equal(await hp.locator('#salonEcran').evaluate(e=>e.hidden),true);
 await hp.locator('#focusAccueilListe .focus-seance').filter({hasText:'Révision de physique'}).click();
 await hp.locator('#focusAccueilContinuer').click();await hp.locator('#focusChoixLancer').click();
 await hp.locator('#focusBtnReglages').click();await menuPersonnel(hp);
 await hp.locator('[data-onglet="minuteur"]').click();assert.equal(await hp.locator('#focusDureeFocus').inputValue(),'32');
 await hp.locator('.focus-tiroir-fermer').click();await hp.locator('#salonRaccourci').click();await menuSalon(hp,true);
 // L'édition du partage conserve le contexte salon ; si on la quitte par
 // navigation, elle ne doit pas contaminer les réglages personnels.
 await hp.evaluate(()=>salonModifierPartage());
 assert.equal(await hp.locator('#salonMajPartage').isVisible(),true);
 assert.equal(await hp.locator('[data-onglet="statistiques"]').isVisible(),false);
 await hp.evaluate(()=>navigateTo('seances'));await hp.evaluate(()=>navigateTo('pomodoro'));
 await hp.locator('#focusBtnReglages').click();await menuPersonnel(hp);
 assert.equal(await hp.locator('#salonMajPartage').isVisible(),false);
 await hp.locator('.focus-tiroir-fermer').click();await hp.locator('#salonRaccourci').click();await menuSalon(hp,true);
 // Un changement de rôle pendant que le salon est masqué ne reverrouille pas
 // les réglages personnels ; le retour présente le rôle mis à jour.
 await gp.evaluate(()=>{salonMasquer();navigateTo('pomodoro');focusBasculerReglages();focusChoisirOnglet('minuteur')});
 room.organisateurUid='guest';room.revision++;
 await gp.waitForFunction(()=>!document.getElementById('salonCommandes').hidden);
 assert.equal(await gp.locator('#focusDureeFocus').isEnabled(),true);
 await gp.locator('.focus-tiroir-fermer').click();await gp.locator('#salonRaccourci').click();await menuSalon(gp,true);
 await hp.waitForFunction(()=>document.getElementById('salonCommandes').hidden);
 await menuSalon(hp,false);
 await hp.evaluate(()=>salonQuitter());await hp.waitForFunction(()=>document.getElementById('salonEcran').hidden);
 await hp.evaluate(()=>{navigateTo('pomodoro');if(document.getElementById('focusReglages').hidden)focusBasculerReglages()});await menuPersonnel(hp);
 gp.once('dialog',d=>d.accept());await gp.evaluate(()=>salonQuitter());await gp.waitForFunction(()=>document.getElementById('salonEcran').hidden);
 await gp.evaluate(()=>{navigateTo('pomodoro');if(document.getElementById('focusReglages').hidden)focusBasculerReglages()});await menuPersonnel(gp);
 assert.deepEqual(h.errors,[]);assert.deepEqual(g.errors,[]);await h.context.close();await g.context.close();
 console.log('OK paramètres personnels, séance, salon masqué, partage et changement de rôle (transport simulé)');
}finally{await browser.close()}
