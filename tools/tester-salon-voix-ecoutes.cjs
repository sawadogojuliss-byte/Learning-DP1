/* Les écoutes Firestore en erreur terminale doivent être rouvertes. */
const assert=require('node:assert/strict');
const {creer}=require('../js/pages/salon-voix.js');
const vraiSet=global.setTimeout,vraiClear=global.clearTimeout;
let seq=0;const timers=new Map();
global.setTimeout=(fn,ms)=>{const id=++seq;timers.set(id,{fn,ms});return id};
global.clearTimeout=id=>timers.delete(id);
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve()};
async function avancer(){const selection=[...timers.entries()].filter(([,t])=>t.ms===2000);assert.ok(selection.length,'une nouvelle écoute est programmée');for(const [id,t] of selection){timers.delete(id);t.fn()}await tick()}
(async()=>{
 const listes={presences:[],signaux:[]},etats=[];
 const canal={joindre:async()=>{},quitter:async()=>{},envoyer:async()=>{}};
 for(const type of Object.keys(listes))canal[type]=(cb,erreur)=>{const e={cb,erreur,actif:true};listes[type].push(e);return()=>{e.actif=false}};
 const node=creer({uid:'a',instance:'A',canal,statut:e=>etats.push(e)});await node.demarrer();
 listes.presences[0].cb([{uid:'a',instance:'A',recent:true}]);
 listes.signaux[0].erreur(Object.assign(Error('refus temporaire'),{code:'permission-denied'}));
 assert.equal(listes.signaux[0].actif,false,'une écoute en erreur terminale est arrêtée');
 assert.ok(etats.includes('signalisation-interrompue'));
 const avant=node.diagnostic();await tick();await avancer();const diag=await avant;
 assert.equal(diag.signalisationErreur,'refus','le diagnostic ne confond pas refus Firebase et absence de participant');
 assert.equal(listes.signaux.length,2,'écoute des signaux relancée');
 listes.signaux[1].cb({auteur:'autre',deInstance:'B',versInstance:'pas-A',type:'offer',sdp:'x'});
 const apres=node.diagnostic();await tick();await avancer();assert.equal((await apres).signalisationErreur,'','réception rétablie');
 listes.presences[0].erreur(Error('réseau'));assert.equal(listes.presences[0].actif,false);
 await avancer();assert.equal(listes.presences.length,2,'écoute de présence relancée');
 listes.presences[1].erreur(Error('réseau'));await node.fermer();
 assert.equal(timers.size,0,'fermeture annule les tentatives en attente');
 // Un refus sur l'envoi de l'offre est tout aussi important qu'un refus de lecture.
 let publier;const canal2={joindre:async()=>{},quitter:async()=>{},presences(cb){publier=cb;return()=>{}},signaux(){return()=>{}},envoyer:async()=>{throw Object.assign(Error('refus envoi'),{code:'permission-denied'})}};
 const pair={connectionState:'new',signalingState:'stable',addTransceiver:()=>({sender:{replaceTrack:async()=>{}}}),createOffer:async()=>({type:'offer',sdp:'offer'}),setLocalDescription:async function(d){this.localDescription=d},close(){}};
 const autre=creer({uid:'a',instance:'A',canal:canal2,creerConnexion:()=>pair});await autre.demarrer();publier([{uid:'a',instance:'A',recent:true},{uid:'b',instance:'B',recent:true}]);await tick();
 const mesure=autre.diagnostic();await tick();await avancer();assert.equal((await mesure).signalisationErreur,'refus','un refus d’envoi est signalé lui aussi');
 await autre.fermer();assert.equal(timers.size,0);
 console.log('OK : reprises après arrêt des écoutes Firebase, diagnostic des refus de lecture et d’envoi, fermeture propre.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{global.setTimeout=vraiSet;global.clearTimeout=vraiClear});
