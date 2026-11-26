/* Pairs dans des contextes de navigateur séparés ; signalisation simulée, média WebRTC réel local. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const launch=portable?{executablePath:await portable.executablePath(),args:[...portable.args.filter(x=>x!=='--single-process' && x!=='--mute-audio'),'--autoplay-policy=no-user-gesture-required']}:{args:['--autoplay-policy=no-user-gesture-required']};
const racine=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=process.env.STUDY_SITE||'http://127.0.0.1:8653/';
const browser=await chromium.launch(launch);const clients=new Map(),slots=new Map(),messages=new Map();let panneSignal=1,candidatsEnvoyes=0,offresEnvoyees=0,repriseNotifie;const repriseObservee=new Promise(r=>repriseNotifie=r);
const publish=async()=>{const v=[...slots].map(([uid,instance])=>({uid,instance,recent:true}));await Promise.all([...clients.values()].map(c=>c.page.evaluate(v=>window._presence?.(v),v).catch(()=>{})))};
async function client(uid,inst){
 const context=await browser.newContext();const page=await context.newPage();const c={uid,page,context};clients.set(uid,c);
 await page.exposeFunction('serverJoin',async instance=>{slots.set(uid,instance);await publish()});
 await page.exposeFunction('serverQuit',async instance=>{if(slots.get(uid)===instance)slots.delete(uid);await publish()});
 await page.exposeFunction('serverSend',async (dest,vers,type,sdp)=>{if(uid==='a' && panneSignal-- > 0)throw new Error('signalisation temporairement indisponible');if(type==='candidate')candidatsEnvoyes++;else {if(type==='offer' && ++offresEnvoyees===3)repriseNotifie();sdp=sdp.replace(/^a=(candidate:.*|end-of-candidates)\r?\n/gm,'');}const d={auteur:uid,deInstance:slots.get(uid),versInstance:vers,type,sdp};if(!messages.has(dest))messages.set(dest,[]);messages.get(dest).push(d);await clients.get(dest)?.page.evaluate(()=>window._drain?.()).catch(()=>{});});
 await page.exposeFunction('serverDrain',()=>{let m=messages.get(uid)||[];messages.set(uid,[]);return m});
 await page.exposeFunction('serverPresence',()=>[...slots].map(([uid,instance])=>({uid,instance,recent:true})));
 await page.goto(base+'pages/pomodoro.html');await page.addScriptTag({path:path.join(racine,'js/pages/salon-voix.js')});
 await page.evaluate(async ({uid,inst})=>{
  window.errors=[];window.etats=[];window.incoming={};window.pcs=[];window.captured=[];window.denied=false;window.hold=null;
  const ctx=window.ctx=new AudioContext();await ctx.resume();
  Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{
   if(denied)throw new DOMException('Refusé','NotAllowedError');if(hold)await hold;
   const dest=ctx.createMediaStreamDestination(),src=ctx.createOscillator(),gain=ctx.createGain();src.frequency.value=uid==='a'?440:uid==='b'?700:900;gain.gain.value=.35;src.connect(gain).connect(dest);src.start();captured.push({stream:dest.stream,src});return dest.stream;
  }},configurable:true});
  let echecsPresence=uid==='a'?1:0,echecsEcouteSignaux=uid==='b'?1:0;
  window.ouvertures={presences:0,signaux:0};
  const canal={
    joindre:serverJoin,quitter:serverQuit,
    presences(cb,err){ouvertures.presences++;if(echecsPresence-- > 0){queueMicrotask(()=>err(new Error('écoute présence interrompue')));return()=>{}}window._presence=cb;serverPresence().then(cb);return()=>{window._presence=null}},
    signaux(cb,err){ouvertures.signaux++;if(echecsEcouteSignaux-- > 0){queueMicrotask(()=>err(new Error('écoute signaux interrompue')));return()=>{}}window._drain=async()=>{for(const s of await serverDrain())cb(s)};window._drain();return()=>{window._drain=null}},
    envoyer:serverSend
  };
  window.node=SalonVoix.creer({uid,instance:inst,canal,iceServers:[],creerConnexion:config=>{const p=new RTCPeerConnection(config);let handler=null;p.addEventListener('icecandidate',e=>setTimeout(()=>handler?.call(p,e),2500));Object.defineProperty(p,'onicecandidate',{configurable:true,get(){return handler},set(f){handler=f}});pcs.push(p);return p;},
   statut:(s,e)=>{etats.push(s);if(['erreur','connexion-impossible'].includes(s))errors.push(s+':'+String(e))},
   audioRecu:(id,stream)=>{const audio=document.createElement('audio');audio.autoplay=true;audio.srcObject=stream;document.body.appendChild(audio);audio.play().catch(e=>errors.push('play:'+e));const source=ctx.createMediaStreamSource(stream),analyser=ctx.createAnalyser(),gain=ctx.createGain();gain.gain.value=.01;source.connect(analyser).connect(gain).connect(ctx.destination);incoming[id]={audio,source,analyser,gain}},
   audioRetire:id=>{if(incoming[id]){incoming[id].audio.remove();incoming[id].source.disconnect();incoming[id].gain.disconnect();delete incoming[id]}}
  });await node.demarrer();
 },{uid,inst});return c;
}
async function signal(page,uid,nonzero){await page.waitForFunction(({uid,nonzero})=>{const a=incoming[uid]?.analyser;if(!a)return false;const arr=new Uint8Array(a.frequencyBinCount);a.getByteTimeDomainData(arr);const n=Math.max(...Array.from(arr,x=>Math.abs(x-128)));return nonzero?n>3:n<=2},{uid,nonzero},{timeout:25000});}
try{
 const a=await client('a','a'.repeat(32)),b=await client('b','b'.repeat(32)),c=await client('c','c'.repeat(32));
 for(const p of [a,b,c])await p.page.waitForFunction(()=>Object.keys(incoming).length===2,null,{timeout:30000});
 for(const p of [a,b,c])assert.deepEqual(await p.page.evaluate(()=>errors),[]);
 assert.ok(await a.page.evaluate(()=>etats.includes('signalisation-interrompue')),'reprise après échec réel de signalisation');
 assert.equal(await a.page.evaluate(()=>ouvertures.presences),2,'écoute de présence rétablie après erreur terminale');
 assert.equal(await b.page.evaluate(()=>ouvertures.signaux),2,'écoute de signalisation rétablie après erreur terminale');
 await a.page.evaluate(()=>node.micro(true));await Promise.all([signal(b.page,'a',true),signal(c.page,'a',true)]);
 assert.ok(candidatsEnvoyes>0,'connexion grâce aux candidats ICE transmis après l’offre');
 await b.page.evaluate(()=>node.micro(true));await Promise.all([signal(a.page,'b',true),signal(c.page,'b',true)]);
 // Une panne ICE déclenche une renégociation sans arrêter le micro.
 await a.page.evaluate(()=>{const p=pcs[0];Object.defineProperty(p,'connectionState',{configurable:true,get:()=> 'failed'});p.onconnectionstatechange()});
 await Promise.race([repriseObservee,new Promise((_,r)=>setTimeout(()=>r(Error('reprise ICE absente')),15000))]);
 await a.page.evaluate(()=>{delete pcs[0].connectionState});
 assert.equal(await a.page.evaluate(()=>captured[0].stream.getAudioTracks()[0].readyState),'live');
 await Promise.all([signal(b.page,'a',true),signal(c.page,'a',true)]);
 // Simule une interruption du périphérique : la nouvelle piste reprend le son sans clic.
 await b.page.evaluate(()=>{const t=captured[0].stream.getAudioTracks()[0];t.stop();t.dispatchEvent(new Event('ended'));});
 await Promise.all([signal(a.page,'b',false),signal(c.page,'b',false)]);
 await b.page.waitForFunction(()=>captured.length===2 && captured[1].stream.getAudioTracks()[0].readyState==='live',null,{timeout:15000});
 await Promise.all([signal(a.page,'b',true),signal(c.page,'b',true)]);
 await a.page.evaluate(()=>node.micro(false));await Promise.all([signal(b.page,'a',false),signal(c.page,'a',false)]);await signal(c.page,'b',true);
 assert.equal(await a.page.evaluate(()=>captured[0].stream.getTracks()[0].readyState),'ended');
 await c.page.evaluate(()=>node.fermer());await c.context.close();clients.delete('c');await Promise.all([a.page.waitForFunction(()=>!incoming.c),b.page.waitForFunction(()=>!incoming.c)]);
 const c2=await client('c','d'.repeat(32));await c2.page.waitForFunction(()=>incoming.a&&incoming.b,null,{timeout:30000});await signal(c2.page,'b',true);
 await c2.page.evaluate(()=>{denied=true});await assert.rejects(c2.page.evaluate(()=>node.micro(true)),/NotAllowedError/);assert.equal(await c2.page.evaluate(()=>captured.length),0);
 await c2.page.evaluate(()=>{denied=false;hold=new Promise(r=>window.release=r)});const pending=c2.page.evaluate(()=>node.micro(true));await c2.page.waitForFunction(()=>typeof release==='function');await c2.page.evaluate(()=>{node.fermer();release()});assert.equal(await pending,false);assert.equal(await c2.page.evaluate(()=>captured[0].stream.getTracks()[0].readyState),'ended');
 for(const p of [a,b]){await p.page.evaluate(()=>node.fermer());await p.context.close()}await c2.context.close();
 console.log('OK : trois contextes distincts, signalisation réparée, son reçu par tous, reprise automatique du micro, coupure, départ et reprise, refus et fermeture pendant la demande micro.');
}finally{await browser.close()}
