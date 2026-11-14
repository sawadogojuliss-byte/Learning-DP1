/* Deux contextes indépendants ; messagerie simulée, aucun Firebase réel. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const base=process.env.STUDY_SITE||'http://127.0.0.1:8648/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
const id='abcdef0123456789abcdef0123456789abcdef0123456789';let room=null,messages=[],echec=false,listenerEchec=false;
const clone=v=>structuredClone(v);
async function backend(actor,op,arg={}){
 if(op==='create'){room={...clone(arg),revision:1,ferme:false,organisateurUid:'host',membres:[{uid:'host',pseudo:'Organisateur'}]};messages=[];return {id,uid:'host',role:'hote'};}
 if(op==='join'){room.membres.push({uid:actor,pseudo:arg.pseudo});return {id,uid:actor,role:'invite'};}
 if(op==='read')return clone(room);
 if(op==='messages'){if(listenerEchec)throw Error('écoute arrêtée');return clone(messages.slice(-50));}
 if(op==='send'){if(echec)throw Error('refus');messages.push({id:'message-'+messages.length,auteurUid:actor,pseudo:room.membres.find(m=>m.uid===actor).pseudo,texte:arg.texte,envoyeLe:Date.now()});return;}
 if(op==='leave'){room.membres=room.membres.filter(m=>m.uid!==actor);return;}
 if(op==='close'){room.ferme=true;room.revision++;return;}
 if(op==='modify'){Object.assign(room,arg.changement);room.revision++;return clone(room)}
 throw Error('operation inconnue');
}
async function personne(actor,viewport){
 const context=await browser.newContext({viewport,isMobile:viewport.width<600,hasTouch:viewport.width<600});await context.exposeFunction('__chatBackend',(op,arg)=>backend(actor,op,arg));
 await context.addInitScript(()=>{
  window.__STUDYPLAN_E2E=true;
  const call=(op,arg)=>window.__chatBackend(op,arg);
  const observer=(op,cb,err)=>{let fin=false;const lire=()=>call(op).then(d=>{if(!fin)cb(d)},e=>{if(!fin){fin=true;clearInterval(timer);err(e)}});lire();const timer=setInterval(lire,200);return()=>{fin=true;clearInterval(timer)}};
  const session=s=>({...s,maintenant:()=>Date.now(),observer:(cb,err)=>observer('read',d=>cb(d,{connecte:true}),err),observerMessages:(cb,err)=>observer('messages',cb,err),envoyerMessage:texte=>call('send',{texte}),modifier:(revision,changement)=>call('modify',{revision,changement}),quitter:()=>call('leave'),fermer:()=>call('close')});
  window.SALON_FOCUS_TRANSPORT={creer:d=>call('create',d).then(session),rejoindre:(id,pseudo)=>call('join',{id,pseudo}).then(session)};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());return {page,context,errors};
}
try{
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]){
  const h=await personne('host',viewport),g=await personne('guest',viewport),hp=h.page,gp=g.page;
  await hp.goto(base,{waitUntil:'domcontentloaded'});await hp.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
  await hp.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerReglages();focusChoisirOnglet('salon')});
  await hp.locator('#salonNom').fill('Notre salon');await hp.locator('#salonCreer').click();await hp.locator('.salon-lien-fermer').click();
  assert.equal(await hp.locator('#salonFlamme').count(),0,'la messagerie remplace les jours dans le salon');assert.equal(await hp.locator('#focusFlamme').count(),1,'les jours personnels restent intacts');assert.equal(await hp.locator('#salonBtnMessages').count(),1);
  await hp.locator('#salonBtnMessages').click();await hp.locator('#salonChatEnvoyer').waitFor({state:'visible'});await hp.waitForFunction(()=>!document.getElementById('salonChatEnvoyer').disabled);
  await hp.locator('#salonChatTexte').fill('Bienvenue');await hp.locator('#salonChatEnvoyer').click();await hp.waitForFunction(()=>document.getElementById('salonChatListe').textContent.includes('Bienvenue'));await hp.locator('.salon-chat-fermer').click();
  await gp.goto(base+'#salon='+id,{waitUntil:'domcontentloaded'});await gp.locator('#salonPseudo').waitFor({state:'visible',timeout:60000});await gp.locator('#salonPseudo').fill('Camille');await gp.locator('#salonRejoindreBouton').click();await gp.waitForFunction(()=>!document.getElementById('salonInvitation').open);await gp.waitForTimeout(500);assert.equal(await gp.locator('#salonChatBadge').isVisible(),false,'historique existant pas compté comme nouveau');
  await gp.locator('#salonBtnMessages').click();await gp.waitForFunction(()=>!document.getElementById('salonChatEnvoyer').disabled);assert.match(await gp.locator('#salonChatListe').innerText(),/Bienvenue/);
  assert.equal(await gp.locator('#salonChatTexte').evaluate(e=>getComputedStyle(e).cursor),'text');assert.notEqual(await gp.locator('#salonChatTexte').evaluate(e=>getComputedStyle(e).caretColor),'rgba(0, 0, 0, 0)');
  await gp.locator('#salonChatTexte').fill('Salut !\n<img src=x onerror=alert(1)>');await gp.locator('#salonChatEnvoyer').click();await hp.waitForFunction(()=>document.getElementById('salonChatBadge').textContent==='1');
  await gp.locator('#salonChatTexte').fill('On commence ?');await gp.locator('#salonChatEnvoyer').click();await hp.waitForFunction(()=>document.getElementById('salonChatBadge').textContent==='2');assert.equal(await gp.locator('#salonChatBadge').isVisible(),false,'ses propres messages ne sont pas des non lus');
  if(process.env.SALON_SCREENSHOTS)await hp.screenshot({path:'/home/user/salon-chat-badge-'+viewport.width+'.png'});
  await hp.locator('#salonBtnMessages').click();assert.equal(await hp.locator('#salonChatBadge').isVisible(),false);assert.match(await hp.locator('#salonChatListe').innerText(),/On commence/);assert.equal(await hp.locator('#salonChatListe img').count(),0,'le texte ne devient jamais du HTML');
  const rect=await hp.locator('#salonMessagerie').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=viewport.width&&rect.y>=0&&rect.y+rect.height<=viewport.height,'panneau accessible sur cet écran');
  if(process.env.SALON_SCREENSHOTS)await hp.screenshot({path:'/home/user/salon-chat-'+viewport.width+'.png'});
  listenerEchec=true;await gp.locator('#salonChatReessayer').waitFor({state:'visible'});assert.equal(await gp.locator('#salonChatEnvoyer').isDisabled(),true);listenerEchec=false;await gp.locator('#salonChatReessayer').click();await gp.waitForFunction(()=>!document.getElementById('salonChatEnvoyer').disabled);
  await gp.locator('#salonChatTexte').fill('Message à conserver');echec=true;await gp.locator('#salonChatEnvoyer').click();await gp.waitForFunction(()=>document.getElementById('salonChatEtat').textContent.includes('non confirmé'));assert.equal(await gp.locator('#salonChatTexte').inputValue(),'Message à conserver');echec=false;
  await hp.locator('#salonChatTexte').focus();await hp.keyboard.press('Escape');assert.equal(await hp.locator('#salonMessagerie').isVisible(),false);
  await gp.locator('.salon-chat-fermer').click();hp.once('dialog',d=>d.accept());await hp.getByRole('button',{name:'Fermer le salon',exact:true}).click();await gp.locator('#salonFinDialog').waitFor({state:'visible'});assert.equal(await gp.locator('#salonMessagerie').isVisible(),false);
  assert.deepEqual(h.errors,[]);assert.deepEqual(g.errors,[]);await h.context.close();await g.context.close();console.log('OK messagerie simulée '+viewport.width+'×'+viewport.height);
 }
}finally{await browser.close()}
