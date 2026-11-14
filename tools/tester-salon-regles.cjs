/* À exécuter uniquement contre l'émulateur Firestore, jamais en production.
   Installer firebase et @firebase/rules-unit-testing hors du dépôt et définir
   STUDY_TEST_MODULES ; démarrer l'émulateur local sur 127.0.0.1:8080. */
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const modules=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : __filename);
const {initializeTestEnvironment,assertFails,assertSucceeds}=modules('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,writeBatch,Timestamp,serverTimestamp,query,orderBy,limit}=modules('firebase/firestore');
const id='abcdef0123456789abcdef0123456789abcdef0123456789', autre='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const chemin=x=>'salons_focus/'+x;
const options={theme:true,minuteur:false,horloge:false,sons:false,musique:false,citations:false};
const data=()=>({nom:'Révisions',organisateurUid:'host',revision:1,ferme:false,verrouille:false,chrono:{mode:'focus',total:1500,restant:1500,running:false,fin:0},options,partage:{theme:'foret'},expireLe:Timestamp.fromMillis(Date.now()+3600000)});
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-studyplan-salon-rules',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync(path.join(__dirname,'../firestore.rules'),'utf8')}});
 try {
  await env.clearFirestore();
  const host=env.authenticatedContext('host',{firebase:{sign_in_provider:'google.com'}}).firestore();
  const guest=env.authenticatedContext('guest',{firebase:{sign_in_provider:'anonymous'}}).firestore();
  const intrus=env.authenticatedContext('intrus',{firebase:{sign_in_provider:'anonymous'}}).firestore();
  const anon=env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon,chemin(id))));
  await assertSucceeds(getDoc(doc(host,chemin(id)))); // création transactionnelle d'un identifiant non utilisé
  await assertFails(setDoc(doc(guest,chemin(id)),{...data(),organisateurUid:'guest'}));
  await assertFails(setDoc(doc(host,chemin('court')),data()));
  await assertFails(setDoc(doc(host,chemin(autre)),{...data(),partage:{theme:'foret',citation:{visible:true,texte:'secret'}}}));
  await assertSucceeds(setDoc(doc(host,'salons_focus_horloges/host'),{at:serverTimestamp()}));
  await assertFails(getDoc(doc(guest,'salons_focus_horloges/host')));
  const batch=writeBatch(host);batch.set(doc(host,chemin(id)),data());batch.set(doc(host,chemin(id)+'/membres/host'),{pseudo:'Organisateur'});await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(guest,chemin(id))));
  await assertFails(getDocs(collection(guest,'salons_focus')));
  await assertSucceeds(setDoc(doc(guest,chemin(id)+'/membres/guest'),{pseudo:'Camille'}));
  await assertFails(setDoc(doc(guest,chemin(id)+'/membres/intrus'),{pseudo:'Camille'}));
  const msgId='ABCDEFGHIJKLMNOPQRST', autreMsg='QRSTUVWXYZabcdefghij', prefix=chemin(id)+'/messages/';
  const message=(texte,pseudo='Camille')=>({auteurUid:'guest',pseudo,texte,envoyeLe:serverTimestamp()});
  const envoi=writeBatch(guest);envoi.update(doc(guest,chemin(id)+'/membres/guest'),{messageLe:serverTimestamp(),dernierMessageId:msgId});envoi.set(doc(guest,prefix+msgId),message('Bonjour !'));await assertSucceeds(envoi.commit());
  const tropVite=writeBatch(guest);tropVite.update(doc(guest,chemin(id)+'/membres/guest'),{messageLe:serverTimestamp(),dernierMessageId:autreMsg});tropVite.set(doc(guest,prefix+autreMsg),message('Encore'));await assertFails(tropVite.commit());
  await assertSucceeds(getDoc(doc(host,prefix+msgId)));await assertFails(getDoc(doc(intrus,prefix+msgId)));
  await assertFails(getDocs(collection(guest,prefix)));await assertSucceeds(getDocs(query(collection(guest,prefix),orderBy('envoyeLe','desc'),limit(50))));
  await assertFails(updateDoc(doc(guest,prefix+msgId),{texte:'Modifié'}));await assertFails(deleteDoc(doc(guest,prefix+msgId)));
  await assertFails(setDoc(doc(guest,chemin(id)+'/membres/guest'),{pseudo:'Camille'})); // le délai ne peut pas être effacé
  await assertFails(setDoc(doc(guest,prefix+autreMsg),message('Usurpation','Autre')));

  await assertSucceeds(updateDoc(doc(guest,chemin(id)+'/membres/guest'),{vuLe:serverTimestamp()}));
  await assertFails(updateDoc(doc(guest,chemin(id)+'/membres/guest'),{vuLe:Timestamp.fromMillis(Date.now()+3600000)}));
  await assertFails(updateDoc(doc(intrus,chemin(id)+'/membres/guest'),{vuLe:serverTimestamp()}));
  await assertFails(setDoc(doc(guest,chemin(id)+'/membres/guest'),{pseudo:'Camille',role:'hote'}));
  await assertFails(updateDoc(doc(guest,chemin(id)),{revision:2,chrono:{mode:'focus',total:1,restant:1,running:false,fin:0}}));
  await assertFails(updateDoc(doc(host,chemin(id)),{revision:2,organisateurUid:'intrus'}));
  await assertFails(updateDoc(doc(guest,chemin(id)),{revision:2,organisateurUid:'guest'}));
  await assertFails(updateDoc(doc(host,chemin(id)),{revision:3}));
  await assertSucceeds(updateDoc(doc(host,chemin(id)),{revision:2,chrono:{mode:'focus',total:1500,restant:1500,running:true,fin:Date.now()+1500000}}));
  await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,chemin(autre)),{...data(),verrouille:true});await setDoc(doc(db,chemin(autre)+'/membres/host'),{pseudo:'Organisateur'});});
  await assertFails(getDoc(doc(intrus,chemin(autre))));
  await assertFails(setDoc(doc(intrus,chemin(autre)+'/membres/intrus'),{pseudo:'Intrus'}));
  await assertSucceeds(getDoc(doc(host,chemin(autre))));
  await assertFails(deleteDoc(doc(host,chemin(id)+'/membres/host')));
  await assertSucceeds(updateDoc(doc(host,chemin(id)+'/membres/host'),{vuLe:serverTimestamp()}));
  await assertSucceeds(updateDoc(doc(host,chemin(id)),{revision:3,organisateurUid:'guest'}));
  await assertFails(updateDoc(doc(host,chemin(id)),{revision:4,ferme:true}));
  await assertFails(updateDoc(doc(guest,chemin(id)),{revision:4,organisateurUid:'intrus'}));
  await assertSucceeds(updateDoc(doc(guest,chemin(id)),{revision:4,chrono:{mode:'short',total:300,restant:300,running:false,fin:0}}));
  await assertSucceeds(updateDoc(doc(guest,chemin(id)),{revision:5,organisateurUid:'host'}));
  await assertSucceeds(updateDoc(doc(host,chemin(id)),{revision:6,ferme:true}));
  await assertFails(getDoc(doc(guest,prefix+msgId)));
  await assertFails(setDoc(doc(intrus,chemin(id)+'/membres/intrus'),{pseudo:'Intrus'}));
  await assertSucceeds(deleteDoc(doc(guest,chemin(id)+'/membres/guest')));
  console.log('OK règles Firestore : propriétaires, invités, fermeture, isolation et partage.');
 } finally {await env.cleanup()}
})().catch(e=>{console.error(e);process.exit(1)});
