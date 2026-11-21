/* Sélection, rotation et conservation de la citation personnelle. */
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const script=fs.readFileSync(require('node:path').join(__dirname,'../js/pages/pomodoro-parametres.js'),'utf8');
const definitions=script.slice(script.indexOf('var FOCUS_CATEGORIES_CITATIONS'),script.indexOf('\nvar FOCUS_STYLES_TEMPS'));
const fonctions=script.slice(script.indexOf('function focusCitationsDeCategorie('),script.indexOf('/* Remplit la liste déroulante'));
const contexte={Date,reglages:{citationCategorie:'toutes',citationPersonnelle:''},focusLireReglages(){return this.reglages}};
// focusLireReglages n'a pas de receveur en mode script : fermer sur le contexte.
contexte.focusLireReglages=()=>contexte.reglages;
vm.runInNewContext(definitions+'\n'+fonctions,contexte);
const {FOCUS_CITATIONS:citations,FOCUS_CATEGORIES_CITATIONS:categories}=contexte;
const ids=['motivation','inspiration','bien-etre'];
assert.deepEqual(Array.from(categories,x=>x.id),['toutes',...ids,'personnelle']);
let vus=new Set();
for(const id of ids){
 assert.equal(citations[id].length,34,id);
 for(const c of citations[id]){
  assert.equal(typeof c.t,'string');assert.ok(c.t.length<=75 && c.t.length>15,c.t);
  assert.ok(!/[.\s]$/.test(c.t),c.t);assert.ok(!vus.has(c.t),'doublon : '+c.t);vus.add(c.t);
  assert.ok(['Studyplan','Louis Pasteur','Alexandre Dumas'].includes(c.a));
 }
 contexte.reglages.citationCategorie=id;
 const liste=contexte.focusCitationsDeCategorie(id);
 assert.equal(liste.length,34);
 for(let jour=1;jour<=34;jour++){
  const texte=contexte.focusCitationDuJour(new Date(2026,0,jour,12));
  assert.equal(texte,'“'+liste[jour%liste.length].t+'”');
 }
}
assert.equal(vus.size,102);
const toutes=contexte.focusCitationsDeCategorie('toutes');assert.equal(toutes.length,102);
for(let i=0;i<34;i++)for(let j=0;j<3;j++)assert.equal(toutes[i*3+j],citations[ids[j]][i],"alternance des catégories");
contexte.reglages.citationCategorie='toutes';
const midi=new Date(2026,3,1,12);assert.equal(contexte.focusCitationDuJour(midi),contexte.focusCitationDuJour(new Date(2026,3,1,23,59)));
const avant=process.env.TZ;process.env.TZ='Europe/Paris';
const apresHeureEte=contexte.focusCitationDuJour(new Date(2026,2,30,12));
assert.equal(apresHeureEte,'“'+toutes[89%toutes.length].t+'”','le 30 mars reste le 89e jour après le changement d’heure');
if(avant===undefined)delete process.env.TZ;else process.env.TZ=avant;
contexte.reglages={citationCategorie:'personnelle',citationPersonnelle:'Mes propres mots'};
assert.equal(contexte.focusCitationDuJour(midi),'“Mes propres mots”');
contexte.reglages.citationPersonnelle='  ';assert.equal(contexte.focusCitationDuJour(midi),'“'+toutes[91%toutes.length].t+'”','fallback personnel vide');
console.log('OK : 102 phrases, trois catégories alternées, dates civiles, choix et citation personnelle.');
