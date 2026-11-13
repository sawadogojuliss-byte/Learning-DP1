/* Test navigateur avec un transport simulé en mémoire. Aucun Firebase réel. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const base=process.env.STUDY_SITE || 'http://127.0.0.1:8645/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
let room=null, calls=[], offline=false;const id='abcdef0123456789abcdef0123456789abcdef0123456789';
function clone(v){return structuredClone(v)}
async function backend(actor,op,arg) {
 calls.push([actor,op]);
 if(offline && op !== 'create') throw Error('hors ligne');
 if(op==='create') { if(actor!=='host')throw Error('not owner');room={...clone(arg),revision:1,ferme:false,membres:[{pseudo:'Organisateur',uid:'host'}]};return {id,role:'hote'}; }
 if(op==='resume') { if(actor!=='host' || !room || room.ferme || arg.id!==id)throw Error('permission-denied');return {id,role:'hote'}; }
 if(op==='join') { if(arg.id!==id || !room || room.ferme)throw Error('absent');room.membres=room.membres.filter(m=>m.uid!==actor);room.membres.push({uid:actor,pseudo:arg.pseudo});return {id,role:'invite'}; }
 if(op==='read' || op==='preview') { if(!room || (op==='preview' && arg.id!==id))throw Error('absent');return {...clone(room),maintenant:Date.now()}; }
 if(op==='modify') { if(actor!=='host' || !room || room.ferme || arg.revision!==room.revision) throw Error('refus'); Object.assign(room,clone(arg.changement));room.revision++;return clone(room); }
 if(op==='leave') { room.membres=room.membres.filter(m=>m.uid!==actor);return true; }
 if(op==='close') {if(actor!=='host')throw Error('refus');room.ferme=true;room.revision++;return true;}
 throw Error('operation inconnue');
}
async function newUser(actor, viewport) {
 const context=await browser.newContext({viewport});await context.exposeFunction('__salonBackend',(op,arg)=>backend(actor,op,arg));
 await context.addInitScript(()=>{
  window.__STUDYPLAN_E2E=true;Object.defineProperty(window,'documentPictureInPicture',{value:undefined,configurable:true});
  window.__sonsJoues=[];const originalPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this instanceof HTMLAudioElement)window.__sonsJoues.push(this);return originalPlay.call(this)};
  const session=(s)=>({id:s.id,role:s.role,maintenant:()=>Date.now(),observer(cb,err){let fin=false;const read=()=>window.__salonBackend('read',{}).then(d=>{if(!fin)cb(d,{connecte:true})},e=>{if(!fin)err(e)});read();const interval=setInterval(read,200);return()=>{fin=true;clearInterval(interval)}},modifier:(revision,changement)=>window.__salonBackend('modify',{revision,changement}),quitter:()=>window.__salonBackend('leave',{}),fermer:()=>window.__salonBackend('close',{})});
  window.SALON_FOCUS_TRANSPORT={apercu:id=>window.__salonBackend('preview',{id}),creer:d=>window.__salonBackend('create',d).then(session),reprendre:id=>window.__salonBackend('resume',{id}).then(session).catch(e=>{const err=Error(e.message);if(e.message.includes('permission-denied'))err.code='permission-denied';throw err}),rejoindre:(id,pseudo)=>window.__salonBackend('join',{id,pseudo}).then(session)};
 });
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 return {context,page,errors};
}
try {
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]) {
  room=null;calls=[];offline=false;
  const host=await newUser('host',viewport), guest=await newUser('guest',viewport);const hp=host.page,gp=guest.page;
  await hp.goto(base,{waitUntil:'domcontentloaded'});await hp.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
  await hp.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusPoserFond(focusIndexParId('pluie-palmes-anime'));focusChoisirReglage('taille','grande');focusBasculerReglages();focusChoisirOnglet('salon')});
  await hp.locator('#salonNom').fill('Révisions <test>');
  await hp.evaluate(()=>{focusJouerListe({nom:'Ambiance commune',sons:['piano']});focusChoisirSon('pluie')});
  await hp.waitForFunction(()=>focusSonActif('piano')&&focusSonActif('pluie'),{timeout:30000});
  for (const v of ['theme','minuteur','horloge','sons','musique','citations']) await hp.locator(`[name=salonPartage][value=${v}]`).check();
  await hp.locator('#salonCreer').click();await hp.locator('#salonEcran').waitFor();
  await hp.waitForFunction(()=>document.getElementById('salonTitre').textContent==='Révisions <test>');assert.equal(await hp.locator('#salonTitre').innerText(),'Révisions <test>');assert.equal(await hp.locator('#salonTitre test').count(),0);
  assert.equal(room.partage.theme,'pluie-palmes-anime');assert.equal(room.partage.horloge.taille,'grande');assert.ok(room.partage.sons.includes('pluie'));assert.equal(room.partage.musique.nom,'Ambiance commune');assert.deepEqual(room.partage.musique.sons,['piano']);
  await gp.goto(base+'#salon='+id,{waitUntil:'domcontentloaded'});await gp.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
  await gp.waitForFunction(()=>document.getElementById('salonInvitation').open);
  assert.equal(await gp.evaluate(()=>location.hash),'#salon='+id,'le lien reste dans la barre d’adresse');
  assert.equal(await hp.evaluate(()=>location.hash),'#salon='+id,'le créateur voit son lien');
  assert.equal(await hp.locator('#salonLienAffiche').inputValue(),new URL('#salon='+id,base).href);await hp.locator('#salonLienCarte .salon-lien-fermer').click();
  assert.equal(await gp.locator('#salonEcran').isVisible(),true,'le salon est visible derrière l’invitation');
  assert.equal(await gp.locator('#salonInvitation').evaluate(e=>e.open),true);
  await gp.waitForFunction(()=>document.getElementById('salonTitre').textContent==='Révisions <test>');assert.equal(room.membres.length,1,'l’aperçu ne fait pas rejoindre');
  await gp.locator('#salonPseudo').fill('Camille');await gp.locator('#salonRejoindreBouton').click();await gp.waitForFunction(()=>!document.getElementById('salonInvitation').open);
  await gp.waitForFunction(()=>document.getElementById('salonTitre').textContent==='Révisions <test>');
  assert.equal(await gp.locator('#salonCommandes').isVisible(),false);
  for(const bouton of await gp.locator('#salonEcran [data-mode]').all())assert.equal(await bouton.isDisabled(),true,'les phases sont affichées mais interdites à l’invité');
  assert.equal(await hp.locator('#salonDemarrer svg').count(),2,'commandes graphiques du Pomodoro');
  assert.equal(await hp.locator('#salonEcran .focus-bottom .focus-rond').count(),6,'barre Pomodoro complète');
  await gp.locator('#salonEcran').getByRole('button',{name:'Paramètres'}).click();
  assert.equal(await gp.locator('#focusReglages [data-onglet="salon"]').isVisible(),false);
  assert.equal(await gp.locator('#focusReglages [data-onglet="statistiques"]').isVisible(),false);
  await gp.locator('#focusReglages [data-onglet="minuteur"]').click();
  for(const champ of ['focusDureeSeances','focusDureeFocus','focusDureeShort','focusDureeLong'])assert.equal(await gp.locator('#'+champ).isDisabled(),true);
  for(const bouton of await gp.locator('#focusReglages .focus-stepper button').all())assert.equal(await bouton.isDisabled(),true);
  await gp.evaluate(()=>focusChoisirOnglet('salon'));assert.equal(await gp.locator('#focusReglages [data-page="salon"]').isVisible(),false);
  await gp.getByRole('button',{name:'Fermer les paramètres'}).click();
  await gp.getByRole('button',{name:'✦ Objectif'}).click();assert.equal(await gp.locator('[data-salon-fiche="objectif"]').isVisible(),true);assert.equal(await gp.locator('[data-salon-fiche="groupe"]').isVisible(),false);
  await gp.locator('#salonEspace summary').click();
  await gp.getByRole('button',{name:'Image dans l’image'}).click();assert.equal(await gp.locator('#salonPipLocal').isVisible(),true);assert.equal(await gp.locator('#salonPipPlay').isVisible(),false);await gp.locator('#salonPipLocal .focus-pip-fermer').click();
  assert.equal(await gp.locator('#salonEcran').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'pas de débordement horizontal');
  await assert.rejects(backend('guest','modify',{revision:room.revision,changement:{chrono:{}}}),/refus/);
  assert.equal(await gp.locator('#salonDecor video').count(),1);
  assert.equal(await gp.locator('#salonEcran').evaluate(e=>e.classList.contains('focus-taille-grande')),true);
  await hp.waitForFunction(()=>document.getElementById('salonMembres').textContent.includes('Camille'));
  offline=true;await hp.waitForFunction(()=>document.getElementById('salonEtatConnexion').textContent.includes('interrompue'));
  assert.equal(await hp.locator('#salonDemarrer').isDisabled(),true);
  offline=false;await hp.waitForFunction(()=>document.getElementById('salonEtatConnexion').textContent.includes('Connecté'));
  await hp.locator('#salonDemarrer').click();await gp.waitForFunction(()=>document.getElementById('salonInfoChrono').textContent==='En cours');
  await hp.waitForTimeout(1300);const ht=await hp.locator('#salonTemps').innerText(),gt=await gp.locator('#salonTemps').innerText();
  const seconds=s=>s.split(':').reduce((n,x)=>n*60+Number(x),0);assert.ok(Math.abs(seconds(ht)-seconds(gt))<=1,`${ht} ≠ ${gt}`);
  await hp.locator('#salonDemarrer').click();await gp.waitForFunction(()=>document.getElementById('salonInfoChrono').textContent==='En pause');
  await hp.locator('[data-mode=short]').click();await gp.waitForFunction(()=>document.getElementById('salonPhase').textContent==='Pause courte');assert.equal(await gp.locator('#salonTemps').innerText(),'05:00');
  await hp.getByRole('button',{name:'♧ Groupe'}).click();await hp.locator('#salonReglages').click();await hp.locator('[name=salonPartage][value=theme]').uncheck();await hp.locator('[name=salonPartage][value=citations]').uncheck();await hp.locator('#salonMajPartage').click();
  await gp.waitForFunction(()=>!document.querySelector('#salonDecor video'));assert.equal('theme' in room.partage,false);assert.equal('citation' in room.partage,false);
  const prefsAvant=await gp.evaluate(()=>localStorage.getItem('studyPlanIB_minuteurParametres'));
  await gp.getByRole('button',{name:'♧ Groupe'}).click();await gp.locator('#salonAutoriserAudio').click();assert.equal(await gp.locator('#salonAutoriserAudio').innerText(),'Couper les sons');
  await gp.waitForFunction(()=>window.__sonsJoues.some(a=>a.currentSrc.includes('pluie.mp3')&&!a.paused&&a.currentTime>.1),{timeout:30000});
  await gp.waitForFunction(()=>window.__sonsJoues.some(a=>a.currentSrc.includes('piano.mp3')&&!a.paused),{timeout:30000});
  await gp.locator('#salonAutoriserAudio').click();assert.equal(await gp.evaluate(()=>window.__sonsJoues.every(a=>a.paused)),true,'le bouton coupe les sons');
  await gp.locator('#salonEspace summary').click();await gp.reload({waitUntil:'domcontentloaded'});await gp.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
  assert.equal(await gp.locator('#salonPseudo').inputValue(),'Camille');await gp.locator('#salonRejoindreBouton').click();await gp.waitForFunction(()=>!document.getElementById('salonInvitation').open);
  await gp.waitForFunction(()=>document.getElementById('salonPhase').textContent==='Pause courte');
  // Un navigateur peut refuser la lecture ; l'invité peut ensuite réessayer.
  await gp.getByRole('button',{name:'♧ Groupe'}).click();
  await gp.evaluate(()=>{window.__ancienPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this instanceof HTMLAudioElement)return Promise.reject(new DOMException('Bloqué','NotAllowedError'));return window.__ancienPlay.call(this)}});
  await gp.locator('#salonAutoriserAudio').click();await gp.waitForFunction(()=>document.getElementById('salonMessage').textContent.includes('bloquée'));
  await gp.evaluate(()=>{HTMLMediaElement.prototype.play=window.__ancienPlay});
  await gp.waitForFunction(()=>document.getElementById('salonAutoriserAudio').textContent==='Activer les sons');
  await gp.locator('#salonAutoriserAudio').click();await gp.waitForFunction(()=>window.__sonsJoues.some(a=>a.currentSrc.includes('piano.mp3')&&!a.paused),{timeout:30000});
  assert.equal(room.membres.filter(m=>m.uid==='guest').length,1,'la reprise ne duplique pas le participant');
  await hp.reload({waitUntil:'domcontentloaded'});await hp.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
  await hp.waitForFunction(()=>document.getElementById('salonPhase')?.textContent==='Pause courte' && document.getElementById('salonCommandes') && !document.getElementById('salonCommandes').hidden && !document.getElementById('salonInvitation')?.open);
  assert.equal(await hp.locator('#salonCommandes').isVisible(),true,'l’organisateur reprend sans pseudo');
  await hp.evaluate(()=>sessionStorage.removeItem('studyPlanIB_salon_session'));await hp.reload({waitUntil:'domcontentloaded'});
  await hp.waitForFunction(()=>document.getElementById('salonPhase')?.textContent==='Pause courte' && document.getElementById('salonCommandes') && !document.getElementById('salonCommandes').hidden && !document.getElementById('salonInvitation')?.open,{timeout:60000});
  assert.equal(await hp.locator('#salonCommandes').isVisible(),true,'l’identité serveur reconnaît l’organisateur sans mémo local');
  assert.equal(await hp.evaluate(()=>location.hash),'#salon='+id);

  await hp.locator('#salonEspace').evaluate(e=>e.open=false);hp.once('dialog',d=>d.dismiss());await hp.getByRole('button',{name:'Fermer le salon',exact:true}).click();assert.equal(room.ferme,false,'annuler ne ferme pas le salon');
  hp.once('dialog',d=>d.accept());await hp.getByRole('button',{name:'Fermer le salon',exact:true}).click();await gp.waitForFunction(()=>document.getElementById('salonEcran').hidden);
  assert.match(await gp.locator('#salonStatutCreation').innerText(),/fermé/);
  assert.equal(await gp.evaluate(()=>localStorage.getItem('studyPlanIB_minuteurParametres')),prefsAvant,'les réglages personnels ne sont pas écrasés');

  assert.deepEqual(host.errors,[]);assert.deepEqual(guest.errors,[]);console.log('OK simulation deux personnes, chronomètre, partage et fermeture '+viewport.width+'×'+viewport.height);
  await host.context.close();await guest.context.close();
 }
} finally {await browser.close()}
