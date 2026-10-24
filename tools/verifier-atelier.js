#!/usr/bin/env node
/* Atelier admin : données fictives en mémoire, aucun accès Firebase ni mail. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('pages/boite.html', 'utf8');
const css = fs.readFileSync('css/pages/emplois-atelier.css', 'utf8');
const script = fs.readFileSync('js/pages/boite.js', 'utf8');
for (const id of ['panelEmplois','emploisListe','emploisDetail','emploisFiltre','emploisFiltres','emploisTotal','emploisRecus','emploisSans']) {
    assert.ok(html.includes('id="' + id + '"'), 'élément Atelier manquant : ' + id);
}
assert.ok(css.includes('#panelEmplois .emploi-atelier-calendrier') && css.includes('@media(max-width:750px)'), 'calendrier / mobile absents');
assert.ok(fs.readFileSync('index.html', 'utf8').includes('css/pages/emplois-atelier.css'), 'styles non chargés');
assert.ok(fs.readFileSync('service-worker.js', 'utf8').includes('css/pages/emplois-atelier.css'), 'style indisponible hors ligne');
const elements = {};
function el(id) { return elements[id] || (elements[id] = {
    innerHTML: '', textContent: '', value: '', attrs: {}, style: {},
    setAttribute(k,v) { this.attrs[k] = v; }, addEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }
}); }
const store = {};
const context = { console, Date, Math, JSON, Promise, setTimeout, clearTimeout, setInterval() { return 0; },
    document: { getElementById: el, addEventListener() {} },
    localStorage: { getItem(k) { return store[k] || null; }, setItem(k,v) { store[k] = String(v); }, removeItem(k) { delete store[k]; } }
};
context.window = context;
vm.createContext(context);
vm.runInContext(script, context);
const days = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const week = (titre) => days.map((j,i) => ({ j,s: i===0 ? [{d:'08:00', f:'09:30',t:titre}] : [] }));
const fiche = (appareil,at,jours) => ({ type:'emploi',id:'e_'+appareil,at,nom:'Camille',classe:'DP2',appareil,jours,complet:1 });
const a1 = fiche('a','2026-10-23T09:00:00.000Z',[{j:'Lundi',s:[{d:'08:00',f:'09:00',t:'Ancien cours'}]}]);
const a2 = fiche('a','2026-10-24T09:00:00.000Z',week('Math <script>intrus</script>'));
const b = fiche('b','2026-10-24T08:00:00.000Z',week('Histoire distincte'));
const e2 = { ...fiche('e2','2026-10-24T08:00:00.000Z',week('Test')),nom:'E2E Preparation' };
const fusion = context.boiteFusionner([a1,a2,b,e2,{
    type:'question',id:'q-contact',at:'2026-10-24T07:00:00.000Z',nom:'Nora',texte:'Question'
}]);
assert.equal(fusion.emplois.length,2,'deux homonymes distincts / E2E masqué');
assert.equal(fusion.emploisVersions.length,3,'versions confirmées conservées');
context.boiteRendreEmplois(fusion);
assert.equal(el('emploisTotal').textContent,'3','comptage des contacts');
assert.equal(el('emploisRecus').textContent,'2','comptage des plannings reçus');
assert.equal(el('emploisSans').textContent,'1','contacts sans emploi');
assert.match(el('emploisListe').innerHTML,/Camille/);
assert.match(el('emploisListe').innerHTML,/Nora/);
assert.doesNotMatch(el('emploisListe').innerHTML,/E2E Preparation/);
assert.match(el('emploisDetail').innerHTML,/Math &lt;script&gt;intrus&lt;\/script&gt;/,'texte hostile échappé');
assert.doesNotMatch(el('emploisDetail').innerHTML,/<script>intrus/);
assert.match(el('emploisDetail').innerHTML,/Versions reçues \(2\)/,'les versions du voisin ne sont pas mêlées');
assert.match(el('emploisDetail').innerHTML,/Dimanche/);
assert.doesNotMatch(el('emploisDetail').innerHTML,/cours fixe|Déjeuner/,'cours supposé dans la vue');
const personneA = context.boitePersonnes(fusion).find(item=>item.appareil==='a');
context.boiteEmploiSelection = context.boiteCleAfficheEmploi(personneA);
context.boiteEmploiVersion = context.boiteCleVersionEmploi(a1);
context.boiteRendreEmplois(fusion);
assert.match(el('emploisDetail').innerHTML,/Version archivée/);
assert.match(el('emploisDetail').innerHTML,/Jour non transmis dans cette version/,'ancienne semaine partielle non masquée');
assert.doesNotMatch(el('emploisDetail').innerHTML,/Math &lt;script&gt;/,'ancienne version remplacée par la nouvelle');
context.boiteEmploiVersion='';
context.boiteEmploiFiltre='sans';
context.boiteRendreEmplois(fusion);
assert.match(el('emploisListe').innerHTML,/Nora/);
assert.doesNotMatch(el('emploisListe').innerHTML,/Camille/);
assert.match(el('emploisDetail').innerHTML,/Aucun planning reçu/);
assert.doesNotMatch(el('emploisDetail').innerHTML,/Ancien cours/);
fusion.partiel = true;
context.boiteRendreEmplois(fusion);
assert.match(el('emploisStatut').textContent,/Lecture incomplète/);
assert.equal(el('emploisStatut').attrs['data-partiel'],'true');
context.boiteNettoyerSession();
assert.equal(el('emploisDetail').innerHTML,'','la déconnexion laisse la fiche admin visible');
console.log('ok Atelier admin : calendrier réel, recherche/filtres, historique, homonymes, mobile, données privées et déconnexion');
