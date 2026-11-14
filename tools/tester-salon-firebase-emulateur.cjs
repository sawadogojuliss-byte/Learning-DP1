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
const ah=auth({uid:'host-transport',isAnonymous:false,displayName:'Julien Test'}),ag=auth({uid:'guest-transport',isAnonymous:true});
const f={apps:[],initializeApp(){const a={name:'salon-focus-invite',auth:()=>ag,firestore:()=>g.firestore};this.apps.push(a);return a;},auth:()=>ah,firestore:()=>h.firestore};
f.auth.Auth={Persistence:{SESSION:'session'}};
f.firestore.FieldValue=firebaseCompat.firestore.FieldValue;
f.firestore.Timestamp=firebaseCompat.firestore.Timestamp;
const adapter=creerAdaptateur({coeur:core,firebase:f,config,crypto});
function attendre(condition,etape,ms=12000){return new Promise((resolve,reject)=>{const debut=Date.now();const timer=setInterval(()=>{if(condition()){clearInterval(timer);resolve();}else if(Date.now()-debut>ms){clearInterval(timer);reject(Error('Délai : état attendu non reçu — '+etape));}},50);});}
(async()=>{
 let stopH=()=>{},stopG=()=>{};
 try {
  const host=await adapter.creer({nom:'Test émulateur',options:{},partage:{},chrono:{mode:'focus',total:1500,restant:1500,running:false,fin:0}});
  const reprise=await adapter.reprendre(host.id);assert.equal(reprise.role,'hote');
  await assert.rejects(adapter.rejoindre(host.id,'   '),e=>e.code==='invalid-argument');
  let dataH=null,dataG=null,errors=[];
  stopH=host.observer((s,e)=>{if(e.connecte)dataH=s;},e=>errors.push(e));
  const guest=await adapter.rejoindre(host.id,'Camille');
  stopG=guest.observer((s,e)=>{if(e.connecte)dataG=s;},e=>errors.push(e));
  await attendre(()=>dataH && dataG && dataH.membres.some(m=>m.pseudo==='Camille' && m.vuLe),'entrée et présence');
  assert.ok(dataG.membres.some(m=>m.pseudo==='Julien Test'));
  let messagesH=null,messagesG=null,erreursMessages=[];
  const stopMessagesH=host.observerMessages(m=>{messagesH=m},e=>erreursMessages.push(e));
  const stopMessagesG=guest.observerMessages(m=>{messagesG=m},e=>erreursMessages.push(e));
  await attendre(()=>messagesH && messagesG,'ouverture messagerie');
  await host.envoyerMessage('Bonjour du groupe');
  await attendre(()=>messagesG.some(m=>m.texte==='Bonjour du groupe' && m.pseudo==='Julien Test'),'message de l’hôte');
  await assert.rejects(guest.envoyerMessage('   '),e=>e.code==='invalid-argument');
  await guest.envoyerMessage('Bonjour depuis Camille');
  await attendre(()=>messagesH.some(m=>m.texte==='Bonjour depuis Camille') && messagesG.some(m=>m.texte==='Bonjour depuis Camille'),'réception message');
  assert.equal(messagesH.find(m=>m.texte==='Bonjour depuis Camille').pseudo,'Camille');assert.equal(messagesH.find(m=>m.texte==='Bonjour depuis Camille').auteurUid,guest.uid);
  await assert.rejects(guest.envoyerMessage('Trop rapide'));
  // Simuler une perte de l'accusé après le commit réel, puis réessayer avec
  // le même identifiant : un seul document doit exister dans l'émulateur.
  await new Promise(r=>setTimeout(r,2200));
  const original=g.firestore.runTransaction.bind(g.firestore);
  let perdre=true;
  g.firestore.runTransaction=async fn=>{
    let aEcritMessage=false;
    const resultat=await original(tx=>fn({get:tx.get.bind(tx),update:tx.update.bind(tx),delete:tx.delete.bind(tx),set(ref,data){if(ref.path.includes('/messages/'))aEcritMessage=true;return tx.set(ref,data);}}));
    if(perdre && aEcritMessage){perdre=false;throw Error('accusé perdu');}
    return resultat;
  };
  try {
    await assert.rejects(guest.envoyerMessage('Test sans doublon'),/accusé perdu/);
    await guest.envoyerMessage('Test sans doublon');
    await attendre(()=>messagesH.filter(m=>m.texte==='Test sans doublon').length===1,'message sans doublon');
  } finally {g.firestore.runTransaction=original;}
  stopMessagesH();stopMessagesG();assert.deepEqual(erreursMessages,[]);

  const demarre=core.commande(dataH.chrono,'demarrer',host.maintenant(),{});
  const revision=dataH.revision;await host.modifier(revision,{chrono:demarre});
  await assert.rejects(reprise.modifier(revision,{chrono:demarre}),e=>e.code==='revision-conflict');
  await attendre(()=>dataG && dataG.chrono.running,'chrono invité');
  await assert.rejects(guest.modifier(dataG.revision,{chrono:demarre}),e=>e.code==='permission-denied');
  await guest.quitter();stopG();
  await attendre(()=>dataH && !dataH.membres.some(m=>m.pseudo==='Camille'),'départ invité');
  const encore=await adapter.rejoindre(host.id,'Camille');let fin=null;let erreursFin=[];
  const stopFin=encore.observer((s)=>{if(s.ferme)fin=s;},e=>erreursFin.push(e));
  await attendre(()=>dataH && dataH.membres.some(m=>m.pseudo==='Camille'),'retour invité');
  await host.fermer();await attendre(()=>fin && fin.ferme,'fermeture par organisateur');stopFin();stopH();
  assert.deepEqual(erreursFin,[],'la fermeture ne doit pas être confondue avec un refus de liste des membres');
  await assert.rejects(adapter.reprendre(host.id));
  await assert.rejects(adapter.rejoindre(host.id,'Nouvel invité'));
  assert.deepEqual(errors,[]);
  console.log('OK adaptateur réel sur émulateur Firestore : créer, reprendre, rejoindre, pseudo, conflit, présence, chrono, autorité, départ et fermeture');
 } finally {stopH();stopG();await Promise.all([h.app.delete(),g.app.delete()]);}
})().catch(e=>{console.error(e);process.exitCode=1});
