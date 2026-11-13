/* Test simulé des nouvelles fonctionnalités : ne teste ni Firebase ni ses règles. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const base=process.env.STUDY_SITE||'http://127.0.0.1:8645/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
const id='abcdef0123456789abcdef0123456789abcdef0123456789';
let room, removed;
const clone=v=>structuredClone(v);
function error(code){const e=Error(code);e.code=code;return e;}
async function backend(actor,op,arg={}) {
 if(op==='create'){room={...clone(arg),revision:1,ferme:false,verrouille:false,organisateurUid:actor,membres:[{uid:actor,pseudo:'Organisateur'}],bilan:{secondes:0,sessions:0}};removed=new Set();return {id,uid:actor,role:'hote'};}
 if(!room || room.ferme)throw error('room-closed');
 if(op==='join'){if(arg.id!==id || room.verrouille || removed.has(actor))throw error('permission-denied');room.membres=room.membres.filter(x=>x.uid!==actor);room.membres.push({uid:actor,pseudo:arg.pseudo});return {id,uid:actor,role:actor===room.organisateurUid?'hote':'invite'};}
 if(!room.membres.some(x=>x.uid===actor))throw error('removed');
 if(op==='read')return clone(room);
 if(op==='personal'){Object.assign(room.membres.find(x=>x.uid===actor),clone(arg));return;}
 if(op==='help'){room.membres.find(x=>x.uid===actor).aide=true;return;}
 if(op==='encourage'){let m=room.membres.find(x=>x.uid===arg.uid);if(!m||m.uid===actor||!m.aide)throw error('permission-denied');m.aide=false;m.encouragement='Tu peux le faire !';return;}
 if(op==='leave'){room.membres=room.membres.filter(x=>x.uid!==actor);return;}
 if(actor!==room.organisateurUid)throw error('permission-denied');
 if(op==='modify'){if(room.revision!==arg.revision)throw error('revision-conflict');Object.assign(room,clone(arg.changement));room.revision++;return clone(room);}
 if(op==='lock'){room.verrouille=arg.value;return;}
 if(op==='transfer'){if(!room.membres.some(x=>x.uid===arg.uid))throw error('not-found');room.organisateurUid=arg.uid;return;}
 if(op==='remove'){if(actor===arg.uid)throw error('permission-denied');removed.add(arg.uid);room.membres=room.membres.filter(x=>x.uid!==arg.uid);return;}
 if(op==='close'){room.ferme=true;return;}
 throw Error('operation inconnue');
}
async function newUser(actor,viewport) {
 const context=await browser.newContext({viewport});await context.exposeFunction('__salonBackend',(op,arg)=>backend(actor,op,arg));
 await context.addInitScript(()=>{
  window.__STUDYPLAN_E2E=true;window.__audios=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this instanceof HTMLAudioElement)window.__audios.push(this);return play.call(this)};
  const call=(op,arg)=>window.__salonBackend(op,arg).catch(e=>{let err=Error(e.message);for(const code of ['removed','room-closed','permission-denied','revision-conflict'])if(e.message.includes(code))err.code=code;throw err;});
  const session=s=>({...s,maintenant:()=>Date.now(),observer(cb,err){let fin=false;const read=()=>call('read',{}).then(d=>{if(!fin)cb(d,{connecte:true})},e=>{if(!fin)err(e)});read();const interval=setInterval(read,200);return()=>{fin=true;clearInterval(interval)}},modifier:(revision,changement)=>call('modify',{revision,changement}),personnaliser:data=>call('personal',data),verrouiller:value=>call('lock',{value}),transferer:uid=>call('transfer',{uid}),retirer:uid=>call('remove',{uid}),demanderAide:()=>call('help',{}),encourager:uid=>call('encourage',{uid}),quitter:()=>call('leave',{}),fermer:()=>call('close',{})});
  window.SALON_FOCUS_TRANSPORT={creer:d=>call('create',d).then(session),rejoindre:(id,pseudo)=>call('join',{id,pseudo}).then(session)};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());return {context,page,errors};
}
try {
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]) {
  room=null;const host=await newUser('host',viewport),guest=await newUser('guest',viewport);const hp=host.page,gp=guest.page;
  await hp.goto(base,{waitUntil:'domcontentloaded'});await hp.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
  await hp.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerReglages();focusChoisirOnglet('salon')});
  await hp.locator('#salonNom').fill('Réviser ensemble');await hp.locator('#salonCreer').click();await hp.locator('#salonEcran').waitFor();
  await gp.goto(base+'#salon='+id,{waitUntil:'domcontentloaded'});await gp.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
  await gp.locator('#salonPseudo').fill('Camille');await gp.locator('#salonRejoindreBouton').click();await gp.waitForFunction(()=>!document.getElementById('salonInvitation').open);
  await hp.locator('#salonBtnReglages').click();await hp.locator('[data-onglet="reunion-groupe"]').click();await gp.locator('#salonBtnReglages').click();await gp.locator('[data-onglet="reunion-objectif"]').click();
  await gp.locator('#salonObjectif').fill('Terminer mon devoir');await gp.waitForTimeout(500);assert.equal(room.membres.find(x=>x.uid==='guest').objectif,undefined,'objectif privé par défaut');
  await gp.locator('#salonObjectifPartager').check();await hp.waitForFunction(()=>document.getElementById('salonListeMembres').textContent.includes('Terminer mon devoir'));
  await gp.locator('#salonObjectifFait').check();await hp.waitForFunction(()=>document.getElementById('salonListeMembres').textContent.includes('✓'));
  await gp.locator('#salonObjectifPartager').uncheck();await hp.waitForFunction(()=>!document.getElementById('salonListeMembres').textContent.includes('Terminer mon devoir'));
  await gp.locator('#salonPret').click();await hp.waitForFunction(()=>document.getElementById('salonGroupeInfo').textContent.includes('1 prêt'));
  await gp.locator('[data-onglet="reunion-groupe"]').click();await gp.locator('#salonCoupPouce').click();await hp.getByRole('button',{name:'Encourager'}).click();await gp.waitForFunction(()=>document.getElementById('salonListeMembres').textContent.includes('Tu peux le faire'));
  await gp.locator('[data-onglet="reunion-preferences"]').click();await gp.locator('#salonDiscret').check();assert.equal(await gp.locator('#salonListeMembres').innerText(),'');assert.equal(await gp.locator('#salonMembres').isVisible(),false);await gp.locator('#salonDiscret').uncheck();
  await gp.locator('#salonVolume').fill('23');assert.equal(await gp.locator('#salonVolumeValeur').innerText(),'23 %');
  await hp.locator('[data-onglet="reunion-preferences"]').click();await hp.locator('#salonAmbiance').selectOption('bibliotheque');await hp.getByRole('button',{name:'Partager l’ambiance'}).click();await gp.waitForFunction(()=>document.getElementById('salonAutoriserAudio').hidden===false);assert.deepEqual(room.partage.musique.sons,['bibliotheque','pluie']);
  await gp.locator('[data-onglet="reunion-groupe"]').click();await gp.locator('#salonAutoriserAudio').click();await gp.waitForFunction(()=>document.querySelector('#salonAutoriserAudio').textContent==='Couper les sons');
  await gp.waitForFunction(()=>window.__audios.some(a=>a.currentSrc.includes('pluie.mp3')));
  const volume=await gp.evaluate(()=>window.__audios.find(a=>a.currentSrc.includes('pluie.mp3')).volume);assert.ok(Math.abs(volume-(.55*.23))<.001, 'volume personnel appliqué');
  await gp.locator('[data-onglet="reunion-preferences"]').click();await gp.locator('#salonVolume').fill('0');assert.equal(await gp.evaluate(()=>window.__audios.find(a=>a.currentSrc.includes('pluie.mp3')).volume),0,'silence personnel');
  assert.equal(room.partage.musique.nom,'Bibliothèque sous la pluie');
  await hp.locator('[data-onglet="reunion-groupe"]').click();await hp.locator('#salonVerrou').click();await hp.waitForFunction(()=>document.getElementById('salonVerrou').textContent.includes('Déverrouiller'));await assert.rejects(backend('intrus','join',{id,pseudo:'Autre'}),/permission-denied/);
  await hp.locator('#salonVerrou').click();await hp.waitForFunction(()=>document.getElementById('salonVerrou').textContent==='Verrouiller le salon');
  room.bilan={secondes:1500,sessions:1};await gp.waitForFunction(()=>document.getElementById('salonBilan').textContent.includes('25 min'));
  room.chrono={mode:'focus',total:5,restant:5,running:true,fin:Date.now()+1500};room.revision++;await gp.waitForFunction(()=>document.getElementById('salonSignalVisuel').hidden===false,{timeout:5000});
  assert.equal(await gp.locator('#salonEcran').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'pas de débordement');
  hp.once('dialog',d=>d.accept());await hp.getByRole('button',{name:'Transférer'}).click();await gp.waitForFunction(()=>!document.getElementById('salonCommandes').hidden);await hp.waitForFunction(()=>document.getElementById('salonCommandes').hidden);
  await assert.rejects(backend('host','lock',{value:true}),/permission-denied/);
  await gp.locator('[data-onglet="reunion-groupe"]').click();gp.once('dialog',d=>d.accept());await gp.getByRole('button',{name:'Retirer'}).click();await hp.waitForFunction(()=>document.getElementById('salonEcran').hidden);assert.match(await hp.locator('#salonBilanFinal').innerText(),/25 min/);assert.equal(await hp.locator('#salonBilanDialog').evaluate(e=>e.open),true);await assert.rejects(backend('host','join',{id,pseudo:'Organisateur'}),/permission-denied/);
  assert.deepEqual(host.errors,[]);assert.deepEqual(guest.errors,[]);console.log('OK nouvelles fonctions simulées '+viewport.width+'×'+viewport.height);
  await host.context.close();await guest.context.close();
 }
}finally{await browser.close()}
