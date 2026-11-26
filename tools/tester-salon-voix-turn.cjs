/* Configuration TURN temporaire, repli STUN et fermeture pendant le chargement. */
const assert=require('node:assert/strict');
const {creer}=require('../js/pages/salon-voix.js');
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve()};
const offre={type:'offer',sdp:'v=0'};
function creerCanal(){let presence,compte=0;return {joindre:async()=>{compte++},quitter:async()=>{},envoyer:async()=>{},presences(cb){presence=cb;return()=>{}},signaux(){return()=>{}},maj:()=>presence([{uid:'a',instance:'A',recent:true},{uid:'b',instance:'B',recent:true}]),get compte(){return compte}}}
function pair(){return {connectionState:'new',signalingState:'stable',addTransceiver:()=>({sender:{replaceTrack:async()=>{}}}),createOffer:async()=>offre,setLocalDescription:async function(d){this.localDescription=d},close(){}}}
(async()=>{
 const turn={urls:['turn:turn.example:3478?transport=udp','turns:turn.example:443?transport=tcp'],username:'temporaire',credential:'mot-de-passe-temporaire'};
 const valide={iceServers:[turn],expireLe:Date.now()+14*60*60*1000};
 for(const [nom,config,attendu] of [['valide',valide,true],['expirant',{...valide,expireLe:Date.now()+10000},false],['sans authentification',{...valide,iceServers:[{urls:turn.urls}]},false],['sans TURN',{...valide,iceServers:[{urls:'stun:example.org'}]},false],['réponse absente',null,false]]){
  const canal=creerCanal(),etats=[];let configuration;
  const voix=creer({uid:'a',instance:'A',canal,obtenirServeurs:async()=>config,statut:s=>etats.push(s),creerConnexion:c=>{configuration=c;return pair()}});
  await voix.demarrer();canal.maj();await tick();
  assert.equal(configuration.iceServers.length,attendu?2:1,nom);
  if(attendu)assert.deepEqual(configuration.iceServers[1],turn);
  else if(config)assert.ok(etats.includes('relais-indisponible'),nom);
  await voix.fermer();
 }
 const canal=creerCanal();let signal;
 const voix=creer({uid:'a',instance:'A',canal,obtenirServeurs:s=>{signal=s;return new Promise((resolve,reject)=>s.addEventListener('abort',()=>reject(Error('annulé'))))}});
 const attente=voix.demarrer();await tick();await voix.fermer();await attente;
 assert.equal(signal.aborted,true);assert.equal(canal.compte,0,'fermeture pendant la demande ne rejoint pas le salon');
 console.log('OK : TURN temporaire valide, configuration invalide, repli STUN et annulation.');
})().catch(e=>{console.error(e);process.exitCode=1});
