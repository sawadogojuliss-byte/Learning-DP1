/* Essai UI multi-contextes : signalisation simulée et média WebRTC réel local. */
import assert from 'node:assert/strict';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const lectureBloquee=process.env.STUDY_TEST_BLOQUE_LECTURE==='1';
const politique=lectureBloquee?'--autoplay-policy=user-gesture-required':'--autoplay-policy=no-user-gesture-required';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:[...portable.args.filter(x=>x!=='--single-process' && x!=='--autoplay-policy=no-user-gesture-required'),politique]}:{args:[politique]});
const base=process.env.STUDY_SITE||'http://127.0.0.1:8653/',id='abcdef0123456789abcdef0123456789abcdef0123456789',clients=new Map(),slots=new Map(),messages=new Map();let room,retarderDepart=false,reprendreDepart=()=>{},notifierDepart=()=>{};const departAppele=new Promise(r=>notifierDepart=r);
const clone=x=>structuredClone(x);const presence=()=>[...slots].map(([uid,instance])=>({uid,instance,recent:true}));
async function publier(){await Promise.all([...clients.values()].map(p=>p.evaluate(v=>window.__voicePresence?.(v),presence()).catch(()=>{})))}
async function backend(uid,op,arg){
 if(op==='create'){room={...clone(arg),revision:1,ferme:false,organisateurUid:'host',membres:[{uid:'host',pseudo:'Organisateur'}]};return {id,uid,role:'hote'}}
 if(op==='preview'||op==='read')return {...clone(room),maintenant:Date.now()};
 if(op==='join'){room.membres.push({uid,pseudo:arg.pseudo});return {id,uid,role:'invite'}}
 if(op==='leave'){if(retarderDepart)await new Promise(r=>{reprendreDepart=r;notifierDepart()});room.membres=room.membres.filter(m=>m.uid!==uid);return}if(op==='close'){room.ferme=true;room.revision++;return}
 if(op==='modify'){Object.assign(room,clone(arg.changement));room.revision++;return clone(room)}
 if(op==='voiceJoin'){slots.set(uid,arg);await publier();return}
 if(op==='voiceQuit'){if(slots.get(uid)===arg)slots.delete(uid);await publier();return}
 if(op==='voicePresence')return presence();
 if(op==='voiceSend'){const d={auteur:uid,deInstance:slots.get(uid),...arg};if(!messages.has(arg.dest))messages.set(arg.dest,[]);messages.get(arg.dest).push(d);await clients.get(arg.dest)?.evaluate(()=>window.__voiceDrain?.()).catch(()=>{});return}
 if(op==='voiceDrain'){const m=messages.get(uid)||[];messages.set(uid,[]);return m}
 throw Error('operation '+op);
}
async function creer(uid,viewport){const context=await browser.newContext({viewport,isMobile:viewport.width<500,hasTouch:viewport.width<500});await context.exposeFunction('__testBackend',(op,arg)=>backend(uid,op,arg));await context.addInitScript((lectureBloquee)=>{
 if(lectureBloquee){const play=HTMLMediaElement.prototype.play;window.__testDeblocage=false;document.addEventListener('click',e=>{if(e.target && e.target.id==='salonVoixEcoute')window.__testDeblocage=true},true);HTMLMediaElement.prototype.play=function(){if(this.srcObject && !window.__testDeblocage)return Promise.reject(new DOMException('Lecture bloquée','NotAllowedError'));return play.call(this)};}
 window.__pcs=[];const NativeRTC=window.RTCPeerConnection;window.RTCPeerConnection=class extends NativeRTC{constructor(c){super(c);window.__pcs.push(this)}};
 window.__STUDYPLAN_E2E=true;const call=(op,arg)=>window.__testBackend(op,arg);
 window.__captures=[];window.__ctx=null;Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{const ctx=window.__ctx||(window.__ctx=new AudioContext());await ctx.resume();const d=ctx.createMediaStreamDestination(),osc=ctx.createOscillator();osc.frequency.value=470;osc.connect(d);osc.start();window.__captures.push(d.stream);return d.stream}}});
 const canal=()=>({joindre:i=>call('voiceJoin',i),quitter:i=>call('voiceQuit',i),envoyer:(dest,versInstance,type,sdp)=>call('voiceSend',{dest,versInstance,type,sdp}),presences(cb){window.__voicePresence=cb;call('voicePresence').then(cb);return()=>window.__voicePresence=null},signaux(cb){window.__voiceDrain=async()=>{for(const d of await call('voiceDrain'))cb(d)};window.__voiceDrain();return()=>window.__voiceDrain=null}});
 const session=s=>({...s,maintenant:()=>Date.now(),observer(cb,err){let stop=false;function lire(){call('read').then(d=>{if(!stop)cb(d,{connecte:true})},e=>{if(!stop)err(e)})}lire();const t=setInterval(lire,250);return()=>{stop=true;clearInterval(t)}},modifier:(revision,changement)=>call('modify',{revision,changement}),quitter:()=>call('leave'),fermer:()=>call('close'),creerCanalVoix:canal});
 window.SALON_FOCUS_TRANSPORT={creer:d=>call('create',d).then(session),rejoindre:(id,pseudo)=>call('join',{id,pseudo}).then(session),apercu:()=>call('preview'),reprendre:()=>Promise.reject(Object.assign(Error('auth-required'),{code:'auth-required'}))};
 },lectureBloquee);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));clients.set(uid,page);return {page,context,errors}}
try{
 const h=await creer('host',lectureBloquee?{width:1280,height:720}:{width:390,height:844}),g=await creer('guest',{width:320,height:568}),hp=h.page,gp=g.page;
 await hp.goto(base,{waitUntil:'domcontentloaded'});await hp.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
 await hp.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerReglages();focusChoisirOnglet('salon')});
 await hp.locator('#salonNom').fill('Salon vocal');await hp.locator('#salonCreer').click();await hp.locator('#salonLienCarte').waitFor();await hp.locator('.salon-lien-fermer').click();
 await hp.waitForFunction(()=>!document.getElementById('salonBtnMicro').disabled,null,{timeout:30000});await hp.locator('#salonVoixDiagnostic').click();await hp.waitForFunction(()=>document.getElementById('salonVoixDiagnosticResultat').textContent.includes('Aucune liaison vocale'),null,{timeout:15000});
 await gp.goto(base+'#salon='+id,{waitUntil:'domcontentloaded'});await gp.locator('#salonPseudo').waitFor({state:'visible',timeout:30000}).catch(async e=>{console.error('INVITE:',await gp.locator('#salonInvitation').textContent(),g.errors);throw e});await gp.locator('#salonPseudo').fill('Camille');await gp.locator('#salonRejoindreBouton').click();
 for(const p of [hp,gp]){await p.waitForFunction(()=>document.getElementById('salonBtnMicro') && !document.getElementById('salonBtnMicro').disabled,null,{timeout:30000});assert.equal(await p.locator('#salonBtnMicro').getAttribute('aria-pressed'),'false');assert.equal(await p.evaluate(()=>__captures.length),0);const r=await p.locator('#salonBtnMicro').boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=p.viewportSize().width&&r.y+r.height<=p.viewportSize().height,'micro visible à l’écran');}
 await gp.waitForFunction(()=>document.querySelector('audio[srcObject]')||[...document.querySelectorAll('audio')].some(a=>a.srcObject),null,{timeout:30000});
 if(lectureBloquee){
  for(const p of [hp,gp]){await p.locator('#salonVoixEcoute').waitFor({state:'visible',timeout:30000});await p.locator('#salonVoixEcoute').click();}
  // Une promesse play() peut rester en attente tant que le flux est silencieux.
  await gp.evaluate(()=>{const a=[...document.querySelectorAll('audio')].find(x=>x.srcObject);window.__playVocal=a.play;a.play=()=>new Promise(()=>{});salonReprendreEcoute()});
  await gp.waitForFunction(()=>document.getElementById('salonVoixStatut').textContent.includes('Lecture en attente'),null,{timeout:8000});
  assert.equal(await gp.locator('#salonVoixEcoute').isVisible(),true);
  await gp.evaluate(()=>{const a=[...document.querySelectorAll('audio')].find(x=>x.srcObject);a.play=window.__playVocal});await gp.locator('#salonVoixEcoute').click();
 }
 // Une annonce répétée de la même piste ne recrée pas le lecteur débloqué.
 await gp.evaluate(()=>{const audio=[...document.querySelectorAll('audio')].find(a=>a.srcObject);window.__ancienAudio=audio;__pcs[0].ontrack({streams:[audio.srcObject],track:audio.srcObject.getAudioTracks()[0]})});
 assert.equal(await gp.evaluate(()=>[...document.querySelectorAll('audio')].find(a=>a.srcObject)===__ancienAudio),true);
 await hp.locator('#salonBtnMicro').click();await hp.waitForFunction(()=>document.querySelector('#salonBtnMicro').getAttribute('aria-pressed')==='true');
 await gp.evaluate(async()=>{const a=[...document.querySelectorAll('audio')].find(x=>x.srcObject);const ctx=window.__testCtx=new AudioContext();await ctx.resume();const src=ctx.createMediaStreamSource(a.srcObject);window.__analyser=ctx.createAnalyser();const gain=ctx.createGain();gain.gain.value=.01;src.connect(__analyser).connect(gain).connect(ctx.destination)});
 await gp.waitForFunction(()=>{let a=new Uint8Array(__analyser.frequencyBinCount);__analyser.getByteTimeDomainData(a);return Math.max(...Array.from(a,x=>Math.abs(x-128)))>3},null,{timeout:30000});
 await gp.locator('#salonVoixDiagnostic').click();await gp.waitForFunction(()=>document.getElementById('salonVoixDiagnosticResultat').textContent.includes('Des données vocales arrivent'),null,{timeout:15000});
 await hp.evaluate(()=>{const t=__captures[0].getAudioTracks()[0];t.stop();t.dispatchEvent(new Event('ended'))});
 assert.equal(await hp.locator('#salonBtnMicro').getAttribute('aria-pressed'),'true');
 assert.match(await hp.locator('#salonVoixStatut').textContent(),/Reconnexion automatique/);
 await hp.waitForFunction(()=>__captures.length===2 && __captures[1].getAudioTracks()[0].readyState==='live',null,{timeout:15000});
 await gp.waitForFunction(()=>{let a=new Uint8Array(__analyser.frequencyBinCount);__analyser.getByteTimeDomainData(a);return Math.max(...Array.from(a,x=>Math.abs(x-128)))>3},null,{timeout:30000});
 await hp.locator('#salonBtnMicro').click();await hp.waitForFunction(()=>document.querySelector('#salonBtnMicro').getAttribute('aria-pressed')==='false');assert.equal(await hp.evaluate(()=>__captures[1].getTracks()[0].readyState),'ended');
 await gp.locator('#salonVoixDiagnostic').click();await gp.waitForFunction(()=>document.getElementById('salonVoixDiagnosticResultat').textContent.includes('aucune donnée vocale reçue'),null,{timeout:15000});
 await hp.locator('#salonBtnMicro').click();await hp.waitForFunction(()=>document.querySelector('#salonBtnMicro').getAttribute('aria-pressed')==='true');await hp.evaluate(()=>salonMasquer());assert.equal(await hp.evaluate(()=>__captures[2].getTracks()[0].readyState),'ended');await gp.waitForFunction(()=>![...document.querySelectorAll('audio')].some(a=>a.srcObject),null,{timeout:30000});
 await hp.evaluate(()=>salonRevenir());await hp.waitForFunction(()=>document.getElementById('salonVoixStatut').textContent.includes('écoute activée'));assert.equal(await hp.locator('#salonBtnMicro').getAttribute('aria-pressed'),'false');
 await gp.locator('#salonBtnMicro').click();await gp.waitForFunction(()=>document.querySelector('#salonBtnMicro').getAttribute('aria-pressed')==='true');retarderDepart=true;
 await gp.evaluate(()=>salonQuitter());assert.equal(await gp.evaluate(()=>__captures[0].getTracks()[0].readyState),'ended','micro arrêté immédiatement même si le départ réseau attend');await departAppele;reprendreDepart();await gp.waitForFunction(()=>document.getElementById('salonEcran').hidden);
 assert.deepEqual(h.errors,[]);assert.deepEqual(g.errors,[]);console.log('OK interface : micro coupé par défaut, son reçu, diagnostic, coupure, sortie et reprise à deux tailles mobiles.',lectureBloquee?'Lecture automatique bloquée puis autorisée.':'');
 await h.context.close();await g.context.close();
}finally{await browser.close()}
