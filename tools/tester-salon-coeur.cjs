const assert = require('node:assert/strict');
const s = require('../js/pages/salon-focus-coeur.js');
const initial = {mode:'focus',total:1500,restant:1500,running:false,fin:0};
let timer=s.commande(initial,'demarrer',100000,{});
assert.equal(timer.fin,1600000);
assert.equal(s.temps(timer,600000).restant,1000);
assert.equal(s.temps(timer,1600001).restant,0);
assert.equal(s.temps(timer,1600001).running,false);
timer=s.commande(timer,'pause',600000,{}); assert.equal(timer.restant,1000);assert.equal(timer.running,false);
timer=s.commande(timer,'demarrer',700000,{});assert.equal(timer.fin,1700000);
timer=s.commande(timer,'short',800000,{short:7});assert.deepEqual(timer,{mode:'short',total:420,restant:420,running:false,fin:0});
timer=s.commande(timer,'demarrer',900000,{});timer=s.commande(timer,'reinitialiser',950000,{});assert.equal(timer.restant,420);assert.equal(timer.running,false);
assert.throws(()=>s.commande(timer,'attaque',0,{}));
assert.throws(()=>s.temps({mode:'autre'},0));
assert.deepEqual(s.contenus({theme:true},{theme:'  forêt  ',citation:{texte:'secret'},sons:['pluie']}),{theme:'forêt'});
const all=Object.fromEntries(s.options.map(x=>[x,true]));
const data=s.contenus(all,{theme:'x',durees:{focus:999,short:-2,long:5},horloge:{taille:'grande',police:'gras'},sons:['pluie','pluie','vent'],musique:{nom:'Équipe',sons:['piano']},citation:{texte:'privé',visible:true},motDePasse:'jamais transmis'});
assert.equal(data.durees.focus,180);assert.equal(data.durees.short,1);assert.deepEqual(data.sons,['pluie','vent']);assert.equal(data.citation.texte,'privé');assert.ok(!('motDePasse' in data));
assert.equal(s.texte('<script>\ntexte',60),'<script> texte'); // rendu exclusivement par textContent
assert.equal(s.autorisations({theme:'true'}).theme,false);
// Les 64 combinaisons sont possibles ; rien d'autre ne sort du profil.
const champs = {theme:'theme',minuteur:'durees',horloge:'horloge',sons:'sons',musique:'musique',citations:'citation'};
const source = {theme:'foret',durees:{focus:25,short:5,long:15},horloge:{police:'gras',taille:'grande'},sons:['pluie'],musique:{nom:'Calme',sons:['piano']},citation:{visible:true,texte:'privé'}};
for(let masque=0;masque<64;masque++) {
  const choix=Object.fromEntries(s.options.map((x,i)=>[x,!!(masque & (1<<i))]));
  const obtenu=s.contenus(choix,source);
  assert.deepEqual(Object.keys(obtenu).sort(),s.options.filter(x=>choix[x]).map(x=>champs[x]).sort(), 'partage '+masque);
}
const crypto=require('node:crypto').webcrypto;
const ids=new Set(Array.from({length:1000},()=>s.nouvelIdentifiant(crypto)));
assert.equal(ids.size,1000);assert.ok([...ids].every(id=>/^[0-9a-f]{48}$/.test(id)));
assert.throws(()=>s.nouvelIdentifiant(null),/cryptographique/);
const id=[...ids][0];
assert.equal(s.lienInvitation('https://sawadogojuliss-byte.github.io/Learning-DP1/?test=1#ancien',id),'https://sawadogojuliss-byte.github.io/Learning-DP1/#salon='+id);
assert.throws(()=>s.lienInvitation('https://studyplan.test/','abc'),/invalide/);
assert.throws(()=>s.lienInvitation('javascript:alert(1)',id),/invalide/);
console.log('OK logique Salon focus : chrono, 64 choix indépendants et identifiants aléatoires');
