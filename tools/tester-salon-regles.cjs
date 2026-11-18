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

  // Plusieurs appareils du même compte ont des emplacements bornés et
  // ne peuvent ni remplacer ni usurper les emplacements d'autrui.
  const vh=chemin(id)+'/salon_voix_presence/host_0', vh1=chemin(id)+'/salon_voix_presence/host_1', vg=chemin(id)+'/salon_voix_presence/guest_0';
  const presence=(owner,slot,instance)=>({proprietaire:owner,slot,instance,actif:true,vuLe:serverTimestamp(),expireLe:Timestamp.fromMillis(Date.now()+300000)});
  const hi='a'.repeat(32),hi1='c'.repeat(32),gi='b'.repeat(32),sid='VoiceSignal123456789';
  await assertFails(setDoc(doc(intrus,chemin(id)+'/salon_voix_presence/intrus_0'),presence('intrus','0',hi)));
  await assertFails(setDoc(doc(guest,vh),presence('guest','0',gi)));
  await assertFails(setDoc(doc(guest,vg),presence('guest','0','non-valide')));
  await assertFails(setDoc(doc(host,chemin(id)+'/salon_voix_presence/host_4'),presence('host','4',hi)));
  await assertSucceeds(setDoc(doc(host,vh),presence('host','0',hi)));await assertSucceeds(setDoc(doc(host,vh1),presence('host','1',hi1)));await assertSucceeds(setDoc(doc(guest,vg),presence('guest','0',gi)));
  await assertFails(updateDoc(doc(host,vh),{instance:'d'.repeat(32),vuLe:serverTimestamp(),expireLe:Timestamp.fromMillis(Date.now()+300000)}));
  await assertFails(updateDoc(doc(guest,vh),{actif:false,vuLe:serverTimestamp()}));
  await assertFails(getDocs(collection(intrus,chemin(id)+'/salon_voix_presence')));
  await assertFails(getDocs(collection(host,chemin(id)+'/salon_voix_presence')));
  await assertSucceeds(getDocs(query(collection(host,chemin(id)+'/salon_voix_presence'),orderBy('vuLe','desc'),limit(50))));
  const vs=vg+'/salon_voix_signaux/'+sid;
  const signal={auteur:'host_0',deInstance:hi,versInstance:gi,type:'offer',sdp:'v=0\r\n',creeLe:serverTimestamp(),expireLe:Timestamp.fromMillis(Date.now()+300000)};
  await assertFails(setDoc(doc(host,vs),signal));
  const faux=writeBatch(host);faux.update(doc(host,vh),{signalLe:serverTimestamp(),signalId:sid,signalCible:'guest_0'});faux.set(doc(host,vs),{...signal,auteur:'guest_0'});await assertFails(faux.commit());
  const emission=writeBatch(host);emission.update(doc(host,vh),{signalLe:serverTimestamp(),signalId:sid,signalCible:'guest_0'});emission.set(doc(host,vs),signal);await assertSucceeds(emission.commit());
  const rapide=writeBatch(host);const sid2='VoiceSignal987654321';rapide.update(doc(host,vh),{signalLe:serverTimestamp(),signalId:sid2,signalCible:'guest_0'});rapide.set(doc(host,vg+'/salon_voix_signaux/'+sid2),signal);await assertFails(rapide.commit());
  await assertFails(getDoc(doc(host,vs)));await assertFails(getDoc(doc(intrus,vs)));await assertSucceeds(getDoc(doc(guest,vs)));
  await assertFails(getDocs(collection(guest,vg+'/salon_voix_signaux')));await assertSucceeds(getDocs(query(collection(guest,vg+'/salon_voix_signaux'),orderBy('creeLe','desc'),limit(50))));
  await assertFails(updateDoc(doc(guest,vs),{sdp:'modifié'}));await assertFails(deleteDoc(doc(host,vs)));
  await assertFails(setDoc(doc(host,vh),presence('host','0',hi)));
  await assertSucceeds(deleteDoc(doc(guest,vs)));await assertFails(deleteDoc(doc(host,vh)));await assertSucceeds(updateDoc(doc(guest,vg),presence('guest','0',gi)));
  const memeCompte=writeBatch(host), autreId='SameAccount123456789', cheminMeme=vh+'/salon_voix_signaux/'+autreId;
  memeCompte.update(doc(host,vh1),{signalLe:serverTimestamp(),signalId:autreId,signalCible:'host_0'});
  memeCompte.set(doc(host,cheminMeme),{...signal,auteur:'host_1',deInstance:hi1,versInstance:hi});await assertSucceeds(memeCompte.commit());
  await assertSucceeds(getDoc(doc(host,cheminMeme)));await assertFails(getDoc(doc(guest,cheminMeme)));await assertSucceeds(deleteDoc(doc(host,cheminMeme)));
  const candId='GuestCandidate123456',candPath=vh+'/salon_voix_signaux/'+candId,cand=writeBatch(guest);
  cand.update(doc(guest,vg),{signalLe:serverTimestamp(),signalId:candId,signalCible:'host_0'});
  cand.set(doc(guest,candPath),{...signal,auteur:'guest_0',deInstance:gi,versInstance:hi,type:'candidate',sdp:'[]'});
  await assertSucceeds(cand.commit());await assertSucceeds(getDoc(doc(host,candPath)));await assertFails(getDoc(doc(intrus,candPath)));await assertSucceeds(deleteDoc(doc(host,candPath)));

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
  await assertFails(getDocs(query(collection(guest,chemin(id)+'/salon_voix_presence'),limit(50))));
  await assertFails(setDoc(doc(guest,vg),presence('guest','0',gi)));
  await assertFails(setDoc(doc(intrus,chemin(id)+'/membres/intrus'),{pseudo:'Intrus'}));
  await assertSucceeds(deleteDoc(doc(guest,chemin(id)+'/membres/guest')));
  console.log('OK règles Firestore : propriétaires, invités, fermeture, isolation et partage.');
 } finally {await env.cleanup()}
})().catch(e=>{console.error(e);process.exit(1)});
