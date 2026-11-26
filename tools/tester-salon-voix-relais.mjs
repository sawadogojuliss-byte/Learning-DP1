/* Relais TURN local réservé au test : WebRTC réel, audio synthétique, jamais de réseau public. */
import assert from 'node:assert/strict';import path from 'node:path';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import os from 'node:os';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const requireTurn=createRequire(process.env.STUDY_TURN_MODULES?path.resolve(process.env.STUDY_TURN_MODULES,'../package.json'):(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url));
const Turn=requireTurn('node-turn'),{chromium}=require('playwright');const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const launch=portable?{executablePath:await portable.executablePath(),args:[...portable.args.filter(x=>x!=='--single-process'&&x!=='--mute-audio'),'--autoplay-policy=no-user-gesture-required']}:{args:['--autoplay-policy=no-user-gesture-required']};
const adresse=Object.values(os.networkInterfaces()).flat().find(x=>x.family==='IPv4'&&!x.internal)?.address;
if(!adresse)throw Error('interface locale IPv4 absente');
// Identifiants fictifs, valables pour ce serveur de test seulement.
const port=34978,username='utilisateur-test',credential='mot-de-passe-test';
const serveur=new Turn({listeningIps:[adresse],relayIps:[adresse],listeningPort:port,minPort:50001,maxPort:50100,authMech:'long-term',credentials:{[username]:credential},realm:'test-local',debugLevel:'OFF'});serveur.start();
const racine=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base=process.env.STUDY_SITE||'http://127.0.0.1:8653/';
const clients=new Map(),presences=new Map(),courrier=new Map();
const publier=()=>Promise.all([...clients.values()].map(c=>c.page.evaluate(v=>window.presence?.(v),[...presences].map(([uid,instance])=>({uid,instance,recent:true}))).catch(()=>{})));
async function client(uid){
 const browser=await chromium.launch(launch),context=await browser.newContext(),page=await context.newPage(),erreurs=[];page.on('pageerror',e=>erreurs.push(String(e)));clients.set(uid,{browser,context,page,erreurs});
 await page.exposeFunction('rejoindre',async instance=>{presences.set(uid,instance);await publier()});await page.exposeFunction('quitter',async()=>{presences.delete(uid);await publier()});await page.exposeFunction('liste',()=>[...presences].map(([uid,instance])=>({uid,instance,recent:true})));
 await page.exposeFunction('envoyer',async(dest,vers,type,sdp)=>{if(type!=='candidate')sdp=sdp.replace(/^a=(candidate:.*|end-of-candidates)\r?\n/gm,'');const signal={auteur:uid,deInstance:presences.get(uid),versInstance:vers,type,sdp};if(!courrier.has(dest))courrier.set(dest,[]);courrier.get(dest).push(signal);await clients.get(dest)?.page.evaluate(()=>window.vider?.()).catch(()=>{});});
 await page.exposeFunction('lire',()=>{const v=courrier.get(uid)||[];courrier.set(uid,[]);return v});
 await page.goto(base+'pages/pomodoro.html');await page.addScriptTag({path:path.join(racine,'js/pages/salon-voix.js')});
 await page.evaluate(async({uid,adresse,port,username,credential})=>{
  window.etats=[];window.recu=null;window.ctx=new AudioContext();await ctx.resume();
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{const d=ctx.createMediaStreamDestination(),osc=ctx.createOscillator();osc.frequency.value=uid==='a'?450:700;osc.connect(d);osc.start();return d.stream;}}});
  const canal={joindre:rejoindre,quitter,envoyer,presences(cb){window.presence=cb;liste().then(cb);return()=>window.presence=null},signaux(cb){window.vider=async()=>{for(const d of await lire())cb(d)};window.vider();return()=>window.vider=null}};
  window.pc=null;window.voix=SalonVoix.creer({uid,instance:uid,canal,iceServers:[],obtenirServeurs:async()=>({iceServers:[{urls:`turn:${adresse}:${port}?transport=udp`,username,credential}],expireLe:Date.now()+14*3600*1000}),creerConnexion:c=>(window.pc=new RTCPeerConnection({...c,iceTransportPolicy:'relay'})),statut:s=>etats.push(s),audioRecu:(id,stream)=>{const el=document.createElement('audio');el.srcObject=stream;el.autoplay=true;document.body.appendChild(el);el.play().catch(()=>{});const source=ctx.createMediaStreamSource(stream),analyse=ctx.createAnalyser(),gain=ctx.createGain();gain.gain.value=.01;source.connect(analyse).connect(gain).connect(ctx.destination);window.recu={el,source,analyse,gain}}});
  await voix.demarrer();await voix.micro(true);
 },{uid,adresse,port,username,credential});return clients.get(uid);
}
let echec=null;
try {
 const a=await client('a'),b=await client('b');
 for(const c of [a,b])await c.page.waitForFunction(()=>{if(!recu)return false;const data=new Uint8Array(recu.analyse.frequencyBinCount);recu.analyse.getByteTimeDomainData(data);return Math.max(...Array.from(data,x=>Math.abs(x-128)))>3},null,{timeout:60000});
 for(const c of [a,b]){
  assert.deepEqual(c.erreurs,[]);const chemin=await c.page.evaluate(async()=>{const s=await pc.getStats();let selection;s.forEach(v=>{if(v.type==='transport'&&v.selectedCandidatePairId)selection=s.get(v.selectedCandidatePairId)});return selection?[s.get(selection.localCandidateId)?.candidateType,s.get(selection.remoteCandidateId)?.candidateType]:null});
  assert.deepEqual(chemin,['relay','relay'],'le chemin audio passe par le relais de chaque côté');const d=await c.page.evaluate(()=>voix.diagnostic());assert.equal(d.relais,'configure');assert.equal(d.reception,1);assert.equal(d.emission,1);
 }
 console.log('OK : son bidirectionnel WebRTC réel à travers un serveur TURN local, ICE forcé sur relay et chemin vérifié.');
}catch(e){for(const [uid,c] of clients)console.error(uid,await c.page.evaluate(async()=>{const s=await pc.getStats(),r=[];s.forEach(x=>{if(['inbound-rtp','outbound-rtp','candidate-pair'].includes(x.type))r.push({type:x.type,state:x.state,packetsSent:x.packetsSent,packetsReceived:x.packetsReceived,bytesSent:x.bytesSent,bytesReceived:x.bytesReceived,audioLevel:x.audioLevel,totalAudioEnergy:x.totalAudioEnergy})});return {etats,pc:pc&&{connexion:pc.connectionState,ice:pc.iceConnectionState,signalisation:pc.signalingState},audio:!!recu,ctx:ctx.state,source:pc.getSenders().map(x=>({track:x.track&&x.track.readyState,enabled:x.track&&x.track.enabled})),stats:r}}).catch(()=>null),c.erreurs);echec=e;
}finally{for(const c of clients.values()){await c.page.evaluate(()=>voix?.fermer()).catch(()=>{});await c.context.close();await c.browser.close();}serveur.stop()}
// node-turn garde pendant une heure des timers de nonce internes, même après stop.
// Le processus de test isolé doit finir après nettoyage des navigateurs.
if(echec){console.error(echec);process.exit(1)}process.exit(0);
