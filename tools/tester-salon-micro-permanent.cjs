/* La capture ne doit s'arrêter que sur ordre ou à la fermeture du salon. */
const assert=require('node:assert/strict');
const {creer}=require('../js/pages/salon-voix.js');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
 let timers=new Map(),seq=0,delays=[];
 globalThis.setTimeout=(f,delay)=>{const n=++seq;timers.set(n,f);delays.push(delay);return n};
 globalThis.clearTimeout=n=>timers.delete(n);
 const fire=async()=>{assert.equal(timers.size,1);const [n,f]=timers.entries().next().value;timers.delete(n);f();await tick()};
 let streams=[],next=null,calls=0,events=[];
 const make=()=>{const track={readyState:'live',stop(){this.readyState='ended'},interrupt(){this.readyState='ended';if(this.onended)this.onended()}};const stream={getTracks:()=>[track],getAudioTracks:()=>[track],track};streams.push(stream);return stream};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>{calls++;if(next){const p=next;next=null;return p}return make()}}}});
 const canal={joindre:async()=>{},quitter:async()=>{},presences:()=>()=>{},signaux:()=>()=>{}};
 try {
  const voice=creer({uid:'a',instance:'a',canal,statut:e=>events.push(e)});await voice.demarrer();assert.equal(calls,0);
  await voice.micro(true);assert.equal(calls,1);await voice.micro(true);
  streams[0].track.interrupt();assert.equal(events.at(-1),'micro-reconnexion');assert.deepEqual(delays,[2000]);
  const fail=deferred();next=fail.promise;await fire();fail.reject(new Error('appareil indisponible'));await tick();assert.deepEqual(delays,[2000,4000]);
  await fire();assert.equal(calls,3);assert.equal(events.at(-1),'micro-actif');assert.equal(streams[1].track.readyState,'live');
  streams[1].track.interrupt();const pending=deferred();next=pending.promise;await fire();await voice.micro(false);pending.resolve(make());await tick();assert.equal(streams[2].track.readyState,'ended');assert.equal(timers.size,0);assert.equal(events.at(-1),'micro-coupe');
  await voice.micro(true);streams[3].track.interrupt();assert.equal(timers.size,1);await voice.micro(false);assert.equal(timers.size,0);
  await voice.micro(true);streams[4].track.interrupt();assert.equal(timers.size,1);await voice.fermer();assert.equal(timers.size,0);
  console.log('OK micro permanent : reprise après interruption et erreur, attente progressive, annulation et fermeture sans réactivation.');
 } finally {globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear}
})().catch(e=>{console.error(e);process.exitCode=1});
