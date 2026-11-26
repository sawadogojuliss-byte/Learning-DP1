/* Simulation hors ligne de la correction temporaire : aucun Firebase réel, aucun mail. */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const compte = fs.readFileSync('js/compte.js', 'utf8');
const boite = fs.readFileSync('js/pages/boite.js', 'utf8');
const src = compte.slice(compte.indexOf('function compteCorrectionCible('), compte.indexOf('/* Changement de série de flammes'));
const cycle = boite.slice(boite.lastIndexOf('function boiteJourCle('), boite.indexOf('function boiteFicheCourante()'));
let jour = new Date(2026, 10, 5, 12).getTime();
const DateReelle = Date;
class Horloge extends DateReelle { constructor(...a) { super(...(a.length ? a : [jour])); } static now() { return jour; } }
const email = 'doriilboudo235@gmail.com';
function nuage() {
  const docs = { 'comptes/u': { nom: 'Kenzah', autre: 5 }, 'progressions/u': { progression: JSON.stringify({ userName: 'Kenzah', profilComplet: true, flammes: 27, flammeJour: '2026-11-04', subjects: ['Math'] }) } };
  let lock = Promise.resolve(), fail = false, writes = 0;
  const db = {
    collection: c => ({ doc: id => ({ path: c + '/' + id }) }),
    runTransaction(fn) { const task = lock.then(async () => {
      if (fail) throw Error('hors ligne');
      const modifications = [];
      const result = await fn({ get: async ref => ({ exists: !!docs[ref.path], data: () => structuredClone(docs[ref.path]) }),
        set: (ref, data) => modifications.push([ref.path, structuredClone(data)]) });
      for (const [path, data] of modifications) { docs[path] = Object.assign({}, docs[path] || {}, data); writes++; }
      return result;
    }); lock = task.catch(() => {}); return task; }
  };
  return { docs, db, set fail(v) { fail = v; }, get writes() { return writes; } };
}
function appareil(cloud, opts = {}) {
  const store = { studyPlanIB_flamme: '27', studyPlanIB_flammeJour: '2026-11-04',
    'studyPlanIB_archive:id': JSON.stringify({ google: { sub: 'id', email }, flammes: 27, flammeJour: '2026-11-04', keep: 9 }),
    'studyPlanIB_archive:autre': JSON.stringify({ google: { sub: 'autre', email: 'other@example.test' }, flammes: 80, flammeJour: '2026-11-04' }) };
  const localStorage = { get length() { return Object.keys(store).length; }, key: i => Object.keys(store)[i], getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); } };
  const els = Object.fromEntries(['joursCompte', 'streakCount', 'focusFlamme'].map(x => [x, {}]));
  const user = { uid: 'u', email, emailVerified: true, providerData: [{ providerId: 'google.com', uid: 'id' }], ...opts.user };
  const auth = { currentUser: user };
  const firestore = () => cloud.db; firestore.FieldValue = { serverTimestamp: () => 'server-time' };
  const ctx = { crypto: require('crypto').webcrypto, TextEncoder, Uint8Array, console, Date: Horloge, Promise, JSON, Number, String, Array, Object, isFinite, parseInt, localStorage,
    document: { getElementById: k => els[k] }, firebase: { auth: () => auth, firestore }, compteSession: { sub: 'id', email },
    compteEmailCle: x => String(x || '').trim().toLowerCase(), compteMemeCompte: (a, b) => a === b,
    compteUtile: x => !!(x && x.userName), comptePeutJoindreLocal: (x, s) => !x.utilisateurId || x.utilisateurId === s.sub, memoireSauvegarder() {}, compteFlammesPousser() {} };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src + '\n' + cycle, ctx);
  return { ctx, store, els, auth, user };
}
(async () => {
  let n = nuage(), a = appareil(n);
  const originalAutre = a.store['studyPlanIB_archive:autre'];
  assert.strictEqual(await a.ctx.compteCorrectionFlammeUnique(a.ctx.compteSession, a.user), true);
  let p = JSON.parse(n.docs['progressions/u'].progression);
  assert.deepStrictEqual([p.flammes, p.flammeJour, p.subjects[0]], [18, '2026-11-05', 'Math']);
  assert.strictEqual(n.docs['comptes/u'].autre, 5);
  assert.strictEqual(n.docs['comptes/u'].correctionFlamme18.version, 1);
  assert.strictEqual(a.store.studyPlanIB_flamme, '18');
  assert.strictEqual(JSON.parse(a.store['studyPlanIB_archive:id']).flammes, 18);
  assert.strictEqual(a.store['studyPlanIB_archive:autre'], originalAutre);
  assert.strictEqual(a.els.streakCount.textContent, '18 jours');
  assert.strictEqual(a.ctx.boiteFlammes(), 18);
  const writes = n.writes;
  jour += 86400000;
  assert.strictEqual(a.ctx.boiteFlammes(), 19);
  assert.strictEqual(await a.ctx.compteCorrectionFlammeUnique(a.ctx.compteSession, a.user), false);
  assert.strictEqual(a.store.studyPlanIB_flamme, '19'); assert.strictEqual(n.writes, writes);
  p.flammes = 19; p.flammeJour = '2026-11-06'; n.docs['progressions/u'].progression = JSON.stringify(p);
  const b = appareil(n);
  assert.strictEqual(await b.ctx.compteCorrectionFlammeUnique(b.ctx.compteSession, b.user), true);
  assert.strictEqual(b.store.studyPlanIB_flamme, '19');
  assert.strictEqual(n.writes, writes);
  jour += 4 * 86400000;
  assert.strictEqual(b.ctx.boiteFlammes(), 0, 'interruption : cycle normal');
  n = nuage(); a = appareil(n, { user: { email: 'other@example.test' } });
  assert.strictEqual(await a.ctx.compteCorrectionFlammeUnique(a.ctx.compteSession, a.user), false); assert.strictEqual(n.writes, 0);
  a = appareil(n, { user: { emailVerified: false } });
  assert.strictEqual(await a.ctx.compteCorrectionFlammeUnique(a.ctx.compteSession, a.user), false); assert.strictEqual(n.writes, 0);
  a = appareil(n, { user: { providerData: [{ providerId: 'google.com', uid: 'autre' }] } });
  assert.strictEqual(await a.ctx.compteCorrectionFlammeUnique(a.ctx.compteSession, a.user), false); assert.strictEqual(n.writes, 0);
  n.fail = true; a = appareil(n);
  assert.strictEqual(await a.ctx.compteCorrectionFlammeUnique(a.ctx.compteSession, a.user), false); assert.strictEqual(n.writes, 0);
  assert.strictEqual(a.store.studyPlanIB_flamme, '27');
  n.fail = false; delete n.docs['progressions/u'];
  assert.strictEqual(await a.ctx.compteCorrectionFlammeUnique(a.ctx.compteSession, a.user), false); assert.strictEqual(n.writes, 0);
  n = nuage(); a = appareil(n); const c = appareil(n);
  await Promise.all([a.ctx.compteCorrectionFlammeUnique(a.ctx.compteSession, a.user), c.ctx.compteCorrectionFlammeUnique(c.ctx.compteSession, c.user)]);
  assert.strictEqual(n.writes, 2, 'une seule correction atomique pour deux appareils');
  console.log('Correction unique et cycle normal : OK (simulation locale sans réseau ni mail)');
})().catch(err => { console.error(err); process.exitCode = 1; });
