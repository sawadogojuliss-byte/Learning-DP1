/* Adaptateur réel contre Firestore émulé, identités de test uniquement. */
const assert=require('node:assert/strict');
const path=require('node:path');
const {createRequire}=require('node:module');
const modules=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : __filename);
const firebaseCompat=modules('firebase/compat/app');
modules('firebase/compat/firestore');
const core=require('../js/pages/salon-focus-coeur.js');
const creerAdaptateur=require('../js/pages/salon-focus-firebase.js');
const crypto=require('node:crypto').webcrypto;
const config={projectId:'demo-studyplan-salon-rules',apiKey:'demo-key',appId:'demo-app'};
function db(nom,uid,provider){
 const app=firebaseCompat.initializeApp(config,nom);
 const firestore=app.firestore();
 firestore.useEmulator('127.0.0.1',8080,{mockUserToken:{sub:uid,user_id:uid,firebase:{sign_in_provider:provider}}});
 return {app,firestore};
}
const h=db('hote-test','host-transport','google.com'),g=db('invite-test','guest-transport','anonymous');
function auth(user){return {onAuthStateChanged(cb){queueMicrotask(()=>cb(user));return()=>{};},setPersistence:async()=>{},signInAnonymously:async()=>({user})};}
const ah=auth({uid:'host-transport',isAnonymous:false}),ag=auth({uid:'guest-transport',isAnonymous:true});
const f={apps:[],initializeApp(){const a={name:'salon-focus-invite',auth:()=>ag,firestore:()=>g.firestore};this.apps.push(a);return a;},auth:()=>ah,firestore:()=>h.firestore};
f.auth.Auth={Persistence:{SESSION:'session'}};
f.firestore.FieldValue=firebaseCompat.firestore.FieldValue;
f.firestore.Timestamp=firebaseCompat.firestore.Timestamp;
const adapter=creerAdaptateur({coeur:core,firebase:f,config,crypto});
function attendre(condition,ms=12000){return new Promise((resolve,reject)=>{const debut=Date.now();const timer=setInterval(()=>{if(condition()){clearInterval(timer);resolve();}else if(Date.now()-debut>ms){clearInterval(timer);reject(Error('Délai : état attendu non reçu'));}},50);});}
(async()=>{
 let stopH=()=>{},stopG=()=>{};
 try {
  const host=await adapter.creer({nom:'Test émulateur',options:{},partage:{},chrono:{mode:'focus',total:1500,restant:1500,running:false,fin:0}});
  assert.equal((await adapter.reprendre(host.id)).role,'hote');
  let dataH=null,dataG=null,errors=[];
  stopH=host.observer((s,e)=>{if(e.connecte)dataH=s;},e=>errors.push(e));
  const guest=await adapter.rejoindre(host.id,'Camille');
  stopG=guest.observer((s,e)=>{if(e.connecte)dataG=s;},e=>errors.push(e));
  await attendre(()=>dataH && dataG && dataH.membres.some(m=>m.pseudo==='Camille' && m.vuLe));
  assert.ok(dataG.membres.some(m=>m.pseudo==='Organisateur'));
  const demarre=core.commande(dataH.chrono,'demarrer',host.maintenant(),{});
  await host.modifier(dataH.revision,{chrono:demarre});
  await attendre(()=>dataG && dataG.chrono.running);
  await assert.rejects(guest.modifier(dataG.revision,{chrono:demarre}),e=>e.code==='permission-denied');
  await guest.quitter();stopG();
  await attendre(()=>dataH && !dataH.membres.some(m=>m.pseudo==='Camille'));
  const encore=await adapter.rejoindre(host.id,'Camille');let fin=null;let erreursFin=[];
  const stopFin=encore.observer((s)=>{if(s.ferme)fin=s;},e=>erreursFin.push(e));
  await attendre(()=>dataH && dataH.membres.some(m=>m.pseudo==='Camille'));
  await host.fermer();await attendre(()=>fin && fin.ferme);stopFin();stopH();
  assert.deepEqual(erreursFin,[],'la fermeture ne doit pas être confondue avec un refus de liste des membres');
  await assert.rejects(adapter.reprendre(host.id));
  assert.deepEqual(errors,[]);
  console.log('OK adaptateur réel sur émulateur Firestore : créer, reprendre, rejoindre, présence, chrono, autorité et départ');
 } finally {stopH();stopG();await Promise.all([h.app.delete(),g.app.delete()]);}
})().catch(e=>{console.error(e);process.exitCode=1});
