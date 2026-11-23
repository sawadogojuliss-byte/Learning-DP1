#!/usr/bin/env node
/* Simulation Firestore en mémoire, aucun réseau ni mail. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const docs = new Map();
const copies = x => x == null ? x : JSON.parse(JSON.stringify(x));
let offline = false, ecritureRefusee = false, lectures = [], hold = null;
const db = {
  collection(c) { return { doc(id) { return {
    path: c + '/' + id,
    async get(opts) {
      if (c === 'documents') {
        assert.equal(opts.source, 'server');
        lectures.push(id);
        if (hold) await hold;
        if (offline) throw new Error('hors ligne');
      }
      const data = docs.get(this.path);
      return { exists: !!data, data: () => copies(data) };
    }
  }; } }; },
  async runTransaction(fn) {
    const writes = [];
    const tx = { async get(ref) {
      const data = docs.get(ref.path);
      return { exists: !!data, data: () => copies(data) };
    }, set(ref,data,options) { writes.push([ref.path,copies(data),options]); } };
    const result = await fn(tx);
    if (ecritureRefusee && writes.some(([path]) => path.startsWith('documents/'))) throw new Error('permission-denied');
    for (const [path, data, opts] of writes) docs.set(path, opts && opts.merge ? { ...docs.get(path), ...data } : data);
    return result;
  }
};
const firebase = { apps: [{}], auth: () => ({ currentUser: { uid: 'alice' } }), firestore: () => db };
firebase.firestore.FieldValue = { serverTimestamp: () => 'SERVER_TIME' };
const store = { studyPlanIB_flamme: '10', studyPlanIB_flammeJour: '2026-11-01' };
const el = () => ({ innerHTML:'', textContent:'', value:'', style:{}, classList:{contains:()=>true}, setAttribute(){}, addEventListener(){}, querySelectorAll(){return []}, querySelector(){return null} });
const elements = {};
const c = { console, Date, Math, JSON, Promise, setTimeout, clearTimeout, setInterval(){}, firebase,
  document: { getElementById(id) { return elements[id] || (elements[id] = el()); }, addEventListener(){} },
  localStorage: { getItem(k){return store[k] || null}, setItem(k,v){store[k]=String(v)}, removeItem(k){delete store[k]} },
};
c.window = c; c.compteSession = { sub:'sub-alice' };
vm.createContext(c);
vm.runInContext(fs.readFileSync('js/pages/boite.js','utf8'), c);
c.boiteEstAdmin = () => true;
const emploi = (uid, name) => ({type:'emploi', id:'e_'+uid, at:'2026-11-01T10:00:00Z', docColl:'emplois_du_temps',docId:uid, firebaseUid:uid, nom:name,jours:[{j:'Lundi',s:[]}],complet:1});
const alice = emploi('alice','Alice'), bob = emploi('bob','Bob');
c.boiteBruts = [alice,bob,{...emploi('triche','Usurpation'), docColl:'boite'}];
const fusion = () => ({ emplois:[alice,bob, { ...emploi('triche','Usurpation'),docColl:'boite' }, {type:'emploi',id:'message',nom:'Alice',jours:[]}], emploisVersions:[], personnesMessages:[] });
docs.set('documents/alice',{uid:'alice',flammes:10,flammeJour:'2026-11-01'});
docs.set('documents/bob',{uid:'bob',flammes:0,flammeJour:'2026-11-01'});
const script = fs.readFileSync('js/compte.js','utf8');
function extract(start,end) { return script.slice(script.indexOf(start),script.indexOf(end,script.indexOf(start))); }
vm.runInContext(extract('function compteFlammesPousser()', '/* Avant chaque envoi'), c);
vm.runInContext(extract('function compteFicheEnregistrer(user, data)', '/* Documents IA'), c);
c.compteFlammeChoisie = items => items.sort((a,b) => b.flammeJour.localeCompare(a.flammeJour) || b.flammes-a.flammes)[0];
c.compteFicheDonnees = (data,uid) => ({uid,nom:data.nom,flammes:data.flammes,flammeJour:data.flammeJour});
c.compteFicheDerniere = ''; c.compteDocumentsDerniers = '';
c.memoireRestaurerFlamme = () => {};
async function lire() { return c.boiteFlammesLire(fusion(),c.boiteSessionGeneration); }
(async () => {
  let f = await lire();
  assert.deepEqual(lectures.sort(), ['alice','bob']);
  assert.match(c.boiteBadgeFlammes(alice,f), /10 jours de flammes/);
  assert.match(c.boiteBadgeFlammes(bob,f), /0 jour de flammes/);
  assert.match(c.boiteBadgeFlammes({firebaseUid:'triche'},f), /indisponible/);
  assert.match(c.boiteBadgeFlammes({nom:'Alice'},f), /indisponible/);
  c.boiteRendreEmplois(f);
  assert.doesNotMatch(elements.emploisListe.innerHTML, />Reçu<|>Absent</);
  assert.equal(elements.emploisRecus.textContent,'3');
  assert.match(elements.emploisListe.innerHTML, /emploi-atelier-flamme/);
  assert.doesNotMatch(elements.emploisListe.innerHTML, /dernière activité|01\/11\/2026|emploi-atelier-flamme-date/);
  assert.match(c.boiteBadgeFlammes({firebaseUid:'un'}, {flammesComptes:{un:{nombre:1,jour:'2026-11-01'}}}), /1 jour de flammes/);
  const sig = c.boiteSignatureEmplois(f);
  docs.set('progressions/alice',{progression:JSON.stringify({flammes:10,flammeJour:'2026-11-01',autre:'intact'})});
  store.studyPlanIB_flamme='11'; store.studyPlanIB_flammeJour='2026-11-02';
  await c.compteFlammesPousser();
  assert.equal(docs.get('documents/alice').flammes,11,'progression projetée le lendemain');
  assert.equal(JSON.parse(docs.get('progressions/alice').progression).autre,'intact');
  await c.compteFicheEnregistrer({uid:'alice'},{nom:'Alice',flammes:8,flammeJour:'2026-11-01'});
  assert.equal(docs.get('documents/alice').flammes,11,'une vieille fiche ne remplace pas la progression');
  c.boiteFlammesCache = Object.create(null); f = await lire();
  assert.match(c.boiteBadgeFlammes(alice,f), /11 jours de flammes/);
  assert.notEqual(c.boiteSignatureEmplois(f),sig,'changement détecté sans nouveau planning');
  store.studyPlanIB_flamme='0'; store.studyPlanIB_flammeJour='2026-11-07';
  await c.compteFlammesPousser();
  assert.equal(docs.get('documents/alice').flammes,0,'réinitialisation propagée');
  assert.equal(docs.get('documents/bob').flammes,0,'autre identité intacte');
  ecritureRefusee = true; store.studyPlanIB_flamme='1'; store.studyPlanIB_flammeJour='2026-11-08';
  const warn = c.console.warn; c.console.warn = () => {};
  await c.compteFlammesPousser(); c.console.warn = warn; ecritureRefusee = false;
  assert.equal(JSON.parse(docs.get('progressions/alice').progression).flammes,1,'refus fiche admin ne bloque pas la progression');
  assert.equal(docs.get('documents/alice').flammes,0);
  store.studyPlanIB_flamme='0'; store.studyPlanIB_flammeJour='2026-11-07';
  c.boiteFlammesCache = Object.create(null); f = await lire();
  assert.match(c.boiteBadgeFlammes(alice,f), /0 jour de flammes/);
  offline = true; c.boiteFlammesCache = Object.create(null); f = await lire();
  assert.match(c.boiteBadgeFlammes(alice,f), /indisponible/, 'pas de valeur périmée hors ligne');
  offline = false; docs.delete('documents/alice'); c.boiteFlammesCache = Object.create(null); f = await lire();
  assert.match(c.boiteBadgeFlammes(alice,f), /indisponible/, 'fiche manquante distincte de zéro');
  docs.set('documents/alice',{uid:'bob',flammes:99,flammeJour:'2026-11-07'});
  c.boiteFlammesCache = Object.create(null); f = await lire();
  assert.match(c.boiteBadgeFlammes(alice,f), /indisponible/, 'uid divergent refusé');
  docs.set('documents/alice',{uid:'alice',flammes:12,flammeJour:'2026-11-07'});
  c.boiteFlammesCache = Object.create(null);
  let release; hold = new Promise(r => {release=r});
  const pending = lire(); c.boiteNettoyerSession(); release(); await pending; hold = null;
  assert.equal(Object.keys(c.boiteFlammesCache).length,0,'déconnexion ignore les réponses tardives');
  console.log('ok flammes admin : identité, zéro, lendemain, remise à zéro, fiche ancienne, erreur, déconnexion, aucun réseau');
})().catch(e => { console.error(e); process.exitCode=1; });
