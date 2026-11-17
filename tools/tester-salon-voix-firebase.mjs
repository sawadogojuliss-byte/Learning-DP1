/* Firestore émulé réel + SDK compat + WebRTC réel dans deux navigateurs isolés.
   Ne jamais pointer ce test vers la production. */
import assert from 'node:assert/strict';
import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
if(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.STUDY_TEST_MODULES)throw Error('Émulateur Firestore et STUDY_TEST_MODULES requis');
const require=createRequire(path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'));const {chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
async function participant(uid,provider) {
 const context=await browser.newContext(),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:8508/pages/pomodoro.html');
 for(const f of ['firebase/firebase-app-compat.js','firebase/firebase-firestore-compat.js'])await page.addScriptTag({path:path.join(process.env.STUDY_TEST_MODULES,f)});
 for(const f of ['js/pages/salon-focus-coeur.js','js/pages/salon-focus-firebase.js','js/pages/salon-voix.js'])await page.addScriptTag({path:path.join(root,f)});
 await page.evaluate(({uid,provider})=>{
  window.errors=[];window.events=[];window.incoming={};window.activeStreams=[];
  const app=firebase.initializeApp({projectId:'demo-studyplan-salon-rules',apiKey:'demo-key',appId:'demo-app'},uid);
  const db=app.firestore();db.useEmulator('127.0.0.1',8080,{mockUserToken:{sub:uid,user_id:uid,firebase:{sign_in_provider:provider}}});
  const user={uid,isAnonymous:provider==='anonymous',displayName:uid};const auth={onAuthStateChanged(cb){queueMicrotask(()=>cb(user));return()=>{}},setPersistence:async()=>{},signInAnonymously:async()=>({user})};
  const f={apps:[],initializeApp(){const a={name:'salon-focus-invite',auth:()=>auth,firestore:()=>db};this.apps.push(a);return a},auth:()=>auth,firestore:()=>db};
  f.auth.Auth={Persistence:{SESSION:'session'}};f.firestore.FieldValue=firebase.firestore.FieldValue;f.firestore.Timestamp=firebase.firestore.Timestamp;
  window.adapter=creerTransportSalonFirebase({coeur:SalonFocusCoeur,firebase:f,config:{projectId:'demo-studyplan-salon-rules'},crypto});
  const ctx=window.ctx=new AudioContext();ctx.resume();
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{const dest=ctx.createMediaStreamDestination(),osc=ctx.createOscillator();osc.frequency.value=provider==='google.com'?500:900;osc.connect(dest);osc.start();activeStreams.push(dest.stream);return dest.stream}}});
  window.start=async s=>{
    window.s=s;window.stop=s.observer(()=>{},e=>errors.push('observer:'+String(e)));
    const a=crypto.getRandomValues(new Uint8Array(16)),instance=Array.from(a,n=>n.toString(16).padStart(2,'0')).join('');
    window.voice=SalonVoix.creer({uid:s.uid,instance,canal:s.creerCanalVoix(),statut:(state,e)=>{events.push(state);if(state==='erreur'||state==='remplace'||state==='connexion-impossible')errors.push(state+':'+String(e))},
      audioRecu:(id,stream)=>{const el=document.createElement('audio');el.srcObject=stream;el.autoplay=true;el.playsInline=true;document.body.appendChild(el);el.play().catch(e=>errors.push('play:'+String(e)));const source=ctx.createMediaStreamSource(stream),analyser=ctx.createAnalyser(),gain=ctx.createGain();gain.gain.value=.01;source.connect(analyser).connect(gain).connect(ctx.destination);incoming[id]={el,source,analyser,gain}},
      audioRetire:id=>{const x=incoming[id];if(x){x.el.remove();x.source.disconnect();x.gain.disconnect();delete incoming[id]}}
    });await voice.demarrer();
  };
 },{uid,provider});return {context,page,errors};
}
async function audible(p,id){await p.waitForFunction(id=>{const a=incoming[id]?.analyser;if(!a)return false;const data=new Uint8Array(a.frequencyBinCount);a.getByteTimeDomainData(data);return Math.max(...Array.from(data,x=>Math.abs(x-128)))>3},id,{timeout:40000});}
try {
 const h=await participant('host-webrtc','google.com'),h2=await participant('host-webrtc','google.com'),g=await participant('guest-webrtc','anonymous');
 const id=await h.page.evaluate(async()=>{let s=await adapter.creer({nom:'Test vocal émulé',options:{},partage:{},chrono:{mode:'focus',total:1500,restant:1500,running:false,fin:0}});await start(s);return s.id});
 await h2.page.evaluate(async id=>start(await adapter.reprendre(id)),id);
 await g.page.evaluate(async id=>start(await adapter.rejoindre(id,'Invité test')),id);
 const ih=await h.page.evaluate(()=>voice.identite()),ih2=await h2.page.evaluate(()=>voice.identite()),ig=await g.page.evaluate(()=>voice.identite());
 assert.notEqual(ih,ih2,'les deux appareils du même compte ont des emplacements distincts');
 try {
  await Promise.all([h,h2,g].map(p=>p.page.waitForFunction(()=>events.filter(x=>x==='connecte').length>=2,null,{timeout:60000})));
  await h.page.evaluate(()=>voice.micro(true));await Promise.all([audible(g.page,ih),audible(h2.page,ih)]);
  await h2.page.evaluate(()=>voice.micro(true));await Promise.all([audible(h.page,ih2),audible(g.page,ih2)]);
  await g.page.evaluate(()=>voice.micro(true));await Promise.all([audible(h.page,ig),audible(h2.page,ig)]);
  // Dépasse deux battements de présence à 30 secondes : aucune coupure.
  await new Promise(resolve=>setTimeout(resolve,65000));
  await Promise.all([audible(h.page,ih2),audible(h2.page,ih),audible(g.page,ih)]);
  for(const p of [h.page,h2.page,g.page])assert.equal(await p.evaluate(()=>activeStreams[0].getAudioTracks()[0].readyState),'live');
  for(const p of [h,h2,g]){assert.deepEqual(await p.page.evaluate(()=>errors),[]);assert.deepEqual(p.errors,[])}
  await h.page.evaluate(()=>voice.micro(false));assert.equal(await h.page.evaluate(()=>activeStreams[0].getAudioTracks()[0].readyState),'ended');
  console.log('OK Firestore émulé + WebRTC : deux appareils du même compte, échanges de groupe, maintien 65 secondes, battements et coupure.');
 } catch(e) {
  for(const [name,p] of [['host',h],['host2',h2],['guest',g]])console.error(name,await p.page.evaluate(()=>({events,errors,receive:Object.keys(incoming)})),p.errors);
  throw e;
 } finally {await Promise.all([h.page.evaluate(()=>{voice.fermer();stop()}),h2.page.evaluate(()=>{voice.fermer();stop()}),g.page.evaluate(()=>{voice.fermer();stop()})]);await h.context.close();await h2.context.close();await g.context.close()}
}finally{await browser.close()}
