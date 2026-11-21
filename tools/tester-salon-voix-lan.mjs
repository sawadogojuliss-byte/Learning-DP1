/* Deux processus Chromium, candidats locaux seulement, réponse initiale perdue.
   Simule la signalisation, pas deux appareils ni un véritable point d'accès Wi-Fi. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const launch=portable?{executablePath:await portable.executablePath(),args:[...portable.args.filter(x=>x!=='--single-process' && x!=='--mute-audio'),'--autoplay-policy=no-user-gesture-required']}:{args:['--autoplay-policy=no-user-gesture-required']};
const racine=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base=process.env.STUDY_SITE||'http://127.0.0.1:8653/';
const clients=new Map(),presences=new Map(),courrier=new Map();let perdu=false,offres=0,candidats=0;
const publier=()=>Promise.all([...clients.values()].map(c=>c.page.evaluate(v=>window.presence?.(v),[...presences].map(([uid,instance])=>({uid,instance,recent:true}))).catch(()=>{})));
async function client(uid){
 const browser=await chromium.launch(launch),context=await browser.newContext(),page=await context.newPage(),erreurs=[];page.on('pageerror',e=>erreurs.push(String(e)));clients.set(uid,{browser,context,page,erreurs});
 await page.exposeFunction('rejoindre',async instance=>{presences.set(uid,instance);await publier()});
 await page.exposeFunction('quitter',async()=>{presences.delete(uid);await publier()});
 await page.exposeFunction('liste',()=>[...presences].map(([uid,instance])=>({uid,instance,recent:true})));
 await page.exposeFunction('envoyer',async(dest,vers,type,sdp)=>{
  if(type==='offer')offres++;
  if(type==='candidate')candidats++;
  if(type==='answer' && !perdu){perdu=true;return;}
  // Les candidats doivent vraiment emprunter le canal séparé.
  if(type!=='candidate')sdp=sdp.replace(/^a=(candidate:.*|end-of-candidates)\r?\n/gm,'');
  const signal={auteur:uid,deInstance:presences.get(uid),versInstance:vers,type,sdp};
  if(!courrier.has(dest))courrier.set(dest,[]);courrier.get(dest).push(signal);
  await clients.get(dest)?.page.evaluate(()=>window.vider?.()).catch(()=>{});
 });
 await page.exposeFunction('lire',()=>{const v=courrier.get(uid)||[];courrier.set(uid,[]);return v});
 await page.goto(base+'pages/pomodoro.html');await page.addScriptTag({path:path.join(racine,'js/pages/salon-voix.js')});
 await page.evaluate(async uid=>{
  window.etats=[];window.recu=null;window.ctx=new AudioContext();await ctx.resume();
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{const d=ctx.createMediaStreamDestination(),osc=ctx.createOscillator();osc.frequency.value=uid==='a'?450:700;osc.connect(d);osc.start();return d.stream;}}});
  const canal={joindre:rejoindre,quitter,envoyer,presences(cb){window.presence=cb;liste().then(cb);return()=>window.presence=null},signaux(cb){window.vider=async()=>{for(const d of await lire())cb(d)};window.vider();return()=>window.vider=null}};
  window.pc=null;window.voix=SalonVoix.creer({uid,instance:uid,canal,iceServers:[],creerConnexion:c=>(window.pc=new RTCPeerConnection(c)),statut:(s,e)=>etats.push(s+((e && e.message)?':'+e.message:'')),audioRecu:(id,stream)=>{const el=document.createElement('audio');el.srcObject=stream;el.autoplay=true;document.body.appendChild(el);el.play().catch(()=>{});const source=ctx.createMediaStreamSource(stream),analyse=ctx.createAnalyser(),gain=ctx.createGain();gain.gain.value=.01;source.connect(analyse).connect(gain).connect(ctx.destination);window.recu={el,source,analyse,gain}}});
  await voix.demarrer();await voix.micro(true);
 },uid);
 return clients.get(uid);
}
try{
 const a=await client('a'),b=await client('b');
 for(const c of [a,b])await c.page.waitForFunction(()=>{if(!recu)return false;const data=new Uint8Array(recu.analyse.frequencyBinCount);recu.analyse.getByteTimeDomainData(data);return Math.max(...Array.from(data,x=>Math.abs(x-128)))>3},null,{timeout:65000});
 assert.equal(perdu,true,'la première réponse a été perdue');assert.ok(offres>=2,'une nouvelle offre a été nécessaire');assert.ok(candidats>0,'les candidats ont été transmis séparément');
 for(const c of [a,b]){
  assert.deepEqual(c.erreurs,[]);const d=await c.page.evaluate(()=>voix.diagnostic());assert.equal(d.connectes,1);assert.equal(d.emission,1);assert.equal(d.reception,1);
  const chemin=await c.page.evaluate(async()=>{const s=await pc.getStats();let selection; s.forEach(v=>{if(v.type==='transport' && v.selectedCandidatePairId)selection=s.get(v.selectedCandidatePairId)});return selection?[s.get(selection.localCandidateId)?.candidateType,s.get(selection.remoteCandidateId)?.candidateType]:null});
  assert.deepEqual(chemin,['host','host'],'le son emprunte uniquement des candidats locaux');
 }
 console.log('OK : deux processus navigateur, candidats locaux uniquement, première réponse perdue, relance et son bidirectionnel.');
}catch(e){
 console.error('Signalisation:',{perdu,offres,candidats});
 for(const [uid,c] of clients)console.error(uid,await c.page.evaluate(()=>({etats,pc:pc&&{connexion:pc.connectionState,ice:pc.iceConnectionState,signalisation:pc.signalingState},audio:!!recu})).catch(()=>null),c.erreurs);
 throw e;
}finally{for(const c of clients.values()){await c.page.evaluate(()=>voix?.fermer()).catch(()=>{});await c.context.close();await c.browser.close();}}
