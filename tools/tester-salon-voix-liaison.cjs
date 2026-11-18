/* Négociation bloquée, interruption transitoire et candidats ICE désordonnés. */
const assert=require('node:assert/strict');
const {creer}=require('../js/pages/salon-voix.js');
const vraiSet=global.setTimeout,vraiClear=global.clearTimeout;
let maintenant=0, prochain=1;const timers=new Map();
global.setTimeout=(fn,ms)=>{const id=prochain++;timers.set(id,{fn,date:maintenant+ms});return id};
global.clearTimeout=id=>timers.delete(id);
async function vider(){for(let i=0;i<20;i++)await Promise.resolve();}
async function avancer(ms){
 const fin=maintenant+ms;
 while(true){let choix=null;for(const [id,t] of timers)if(t.date<=fin && (!choix||t.date<choix[1].date))choix=[id,t];
  if(!choix)break;maintenant=choix[1].date;timers.delete(choix[0]);choix[1].fn();await vider();}
 maintenant=fin;await vider();
}
class Pair {
 constructor(){this.connectionState='new';this.signalingState='stable';this.remoteDescription=null;this.ajoutes=[];this.offres=[];this.rollbacks=0;}
 addTransceiver(){return {sender:{replaceTrack:async()=>{}}};}
 async createOffer(options){this.offres.push(options||{});return {type:'offer',sdp:'offer-'+this.offres.length};}
 async setLocalDescription(d){if(d.type==='rollback'){this.rollbacks++;this.signalingState='stable';return;}this.localDescription=d;this.signalingState='have-local-offer';}
 async setRemoteDescription(d){this.remoteDescription=d;this.signalingState='stable';}
 async addIceCandidate(c){this.ajoutes.push(c.usernameFragment);}
 close(){this.connectionState='closed';}
}
(async()=>{
 let presence,recevoir,pair;const messages=[];
 const canal={joindre:async()=>{},quitter:async()=>{},presences(cb){presence=cb;return()=>{}},signaux(cb){recevoir=cb;return()=>{}},envoyer:async(id,cle,type,sdp)=>messages.push({type,sdp})};
 const node=creer({uid:'a',instance:'A',canal,creerConnexion:()=>pair=new Pair()});
 await node.demarrer();presence([{uid:'a',instance:'A',recent:true},{uid:'b',instance:'B',recent:true}]);await vider();
 assert.equal(messages.filter(x=>x.type==='offer').length,1);
 const candidat=ufrag=>recevoir({auteur:'b',deInstance:'B',versInstance:'A',type:'candidate',sdp:JSON.stringify([{candidate:'candidate:1 1 udp 1 host.local 1234 typ host',sdpMid:'0',usernameFragment:ufrag}])});
 const reponse=ufrag=>recevoir({auteur:'b',deInstance:'B',versInstance:'A',type:'answer',sdp:'v=0\r\na=ice-ufrag:'+ufrag+'\r\n'});
 candidat('ancien');await vider();assert.deepEqual(pair.ajoutes,[],'un candidat précoce attend la réponse');
 reponse('ancien');await vider();assert.deepEqual(pair.ajoutes,['ancien']);
 // Une liaison qui ne progresse jamais est relancée, sans attendre failed.
 await avancer(19999);assert.equal(pair.offres.length,1);await avancer(3001);
 assert.equal(pair.offres.length,2);assert.equal(pair.offres[1].iceRestart,true);
 // Les candidats de la nouvelle génération peuvent précéder sa réponse.
 candidat('nouveau');await vider();assert.deepEqual(pair.ajoutes,['ancien']);
 reponse('nouveau');await vider();assert.deepEqual(pair.ajoutes,['ancien','nouveau']);
 pair.connectionState='connected';pair.onconnectionstatechange();await avancer(60000);assert.equal(pair.offres.length,2,'aucune relance après connexion');
 pair.connectionState='disconnected';pair.onconnectionstatechange();await avancer(8000);pair.connectionState='connected';pair.onconnectionstatechange();await avancer(10000);assert.equal(pair.offres.length,2,'interruption brève sans renégociation');
 pair.connectionState='disconnected';pair.onconnectionstatechange();await avancer(15000);assert.equal(pair.offres.length,3,'interruption persistante relancée');
 await node.fermer();await avancer(120000);assert.equal(pair.offres.length,3,'aucune relance après fermeture');
 console.log('OK : offre sans réponse, candidats ICE anticipés et de génération suivante, interruption brève ou persistante, fermeture.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{global.setTimeout=vraiSet;global.clearTimeout=vraiClear});
