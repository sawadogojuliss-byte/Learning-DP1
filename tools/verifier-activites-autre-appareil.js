/* Vérifie que les activités du compte arrivent sur un second téléphone même lorsque le registre des
   suppressions contient des dates pour ces noms. Même harnais que les autres vérificateurs de synchro. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
function creerContexte(init) {
  const store = Object.assign({}, init || {});
  const ls = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
    key: i => Object.keys(store)[i] || null,
    get length() { return Object.keys(store).length; },
  };
  const el = () => ({ value: '', textContent: '', innerHTML: '', style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; }, appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; }, focus() {}, click() {}, remove() {}, closest() { return null; } });
  const document = { readyState: 'complete', getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, removeEventListener() {}, body: el(), documentElement: el(), head: el(), hidden: false, visibilityState: 'visible', title: '' };
  const ctx = { console, setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {}, Date, Math, JSON, Promise, Object, Array, String, Number, Boolean, RegExp, Error, Set, Map, URL, Intl,
    localStorage: ls, sessionStorage: ls, document, navigator: { onLine: true, userAgent: 'test' }, location: { hash: '', href: 'https://test/', search: '', pathname: '/' }, history: { replaceState() {}, pushState() {} },
    addEventListener() {}, removeEventListener() {}, requestAnimationFrame: f => 0, fetch: () => Promise.reject(new Error('reseau coupe')), alert() {}, confirm: () => true, prompt: () => null, getComputedStyle: () => ({}), Notification: undefined, indexedDB: undefined,
    atob: b => Buffer.from(b, 'base64').toString('binary'), btoa: b => Buffer.from(b, 'binary').toString('base64'), TextEncoder, TextDecoder, Buffer };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx; ctx.__store = store;
  vm.createContext(ctx);
  return ctx;
}
const PRELUDE = `
(function () {
  var v = { customEvents: [], exercices: [], devoirsStore: {}, emploiFige: null, subjects: [], optionalSubjects: [],
    selectedActivities: [], holidayDates: [], holidayDroppedDates: [], freeTimeByDay: {}, phoneDays: {}, phoneDayDurations: {},
    iaDocs: [], iaPlans: {}, iaLevels: {}, eeDemandes: [], eeVus: [], examens: [], emploiScolaire: null, modifsSemaine: [],
    suppressions: [], joursConnectes: 0, dernierJour: '', ibYear: '', memoirLevel: '', iaLevel: '', memoirPlan: null, currentMood: '',
    transportMode: '', carToSchool: 0, carFromSchool: 0, carDeparture: '', carReturn: '', motoToSchool: 0, motoFromSchool: 0, motoDeparture: '', motoReturn: '',
    userName: '', targetScore: 40, __jourCourantPose: false, __profilComplet: false };
  Object.keys(v).forEach(function (k) { globalThis[k] = v[k]; });
})();
function verrouillerSujetsChoisis() {} function eeNettoyerSuivi() {} function syncPreparer() {} function syncDebutApplication() {} function syncFinApplication() {}
function majClasseAffichage() {} function majApparenceNotes() {} function enforceSubjectRules() {} function appliquerHabitudes() {} function focusReglages() {}
function devoirsEcrireStore() {} function devoirsLireStore() { return {}; } function emploiScolaireLire() { return null; } function emploiScolaireEcrire() {}
function eeNormaliserPlan(p) { return p; } function eeNormaliserPlans(p) { return p; } function reporterModificationsSemaine() {}
`;
function ordreReel() {
  const reg = fs.readFileSync(path.join(ROOT, 'js/registre.js'), 'utf8');
  return [...reg.matchAll(/'(js\/[^']+\.js)'/g)].map(m => m[1]);
}
function charger(ctx, fichiers) {
  vm.runInContext(PRELUDE, ctx, { filename: 'prelude' });
  const liste = fichiers === 'reel' ? ordreReel() : fichiers;
  const echecs = [];
  for (const f of liste) {
    if (!fs.existsSync(f) && !f.startsWith('/')) continue;
    const src = fs.readFileSync(f, 'utf8');
    try { vm.runInContext(src, ctx, { filename: f }); }
    catch (e) { echecs.push(f + ' : ' + e.message); }
  }
  ctx.__echecsChargement = echecs;
}


// Faux Firestore partagé entre les appareils (le « nuage »). Fusion superficielle comme merge:true.
function creerNuage() {
  const docs = {}; const journal = [];
  const cle = (c, id) => c + '/' + id;
  function doc(c, id) {
    return {
      get: () => Promise.resolve({ exists: !!docs[cle(c, id)], data: () => (docs[cle(c, id)] ? JSON.parse(JSON.stringify(docs[cle(c, id)])) : undefined) }),
      set: (obj, opts) => {
        const k = cle(c, id);
        const avant = docs[k] || {};
        const apres = (opts && opts.merge) ? Object.assign({}, avant, obj) : Object.assign({}, obj);
        // Comme Firestore : les tableaux imbriqués sont refusés (erreur, rien n'est écrit).
        const imbriques = (v) => Array.isArray(v) && v.some(x => Array.isArray(x));
        const refuse = Object.keys(obj).find(f => imbriques(obj[f]) || (obj[f] && typeof obj[f] === 'object' && !Array.isArray(obj[f]) && Object.values(obj[f]).some(imbriques)));
        if (refuse) { journal.push({ c, id, refus: refuse }); return Promise.reject(new Error('tableau imbrique : ' + refuse)); }
        docs[k] = JSON.parse(JSON.stringify(apres));
        journal.push({ c, id, champs: Object.keys(obj) });
        return Promise.resolve();
      },
    };
  }
  const db = { collection: (c) => ({ doc: (id) => doc(c, id), get: () => Promise.resolve({ docs: [], empty: true, forEach() {} }), where: () => ({ get: () => Promise.resolve({ docs: [], empty: true, forEach() {} }) }) }) };
  require('./nuage-factice.cjs')(db);
  return { docs, journal, db, cle };
}
function firebaseFactice(nuage, uid, user) {
  const utilisateur = Object.assign({ uid, email: user.email, displayName: user.name, photoURL: '' }, {});
  const auth = () => ({ currentUser: utilisateur, signInWithCredential: () => Promise.resolve({ user: utilisateur }), onAuthStateChanged(cb) { setTimeout(() => cb(utilisateur), 300); } });
  auth.GoogleAuthProvider = { credential: () => ({}) };
  const fs = () => nuage.db;
  fs.FieldValue = { serverTimestamp: () => 'TS' };
  return { apps: [{}], auth, firestore: fs };
}


process.chdir(ROOT);
const ANCIEN = { subjects: [{ name: 'Chimie', level: 'HL', grade: '' }], optionalSubjects: [], selectedActivities: [], userName: 'Sere', targetScore: 30 };
const SUB = 'FARID-SUB-123', EMAIL = 'faridsere86@gmail.com';
const user = { name: 'Sere Farid', email: EMAIL };
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const credential = b64({ alg: 'none' }) + '.' + b64({ sub: SUB, email: EMAIL, name: 'Sere Farid' }) + '.x';
const ev = (id, day, start, end, title, type) => ({ id, day, startTime: start, endTime: end, title, type, source: 'custom', date: '' });
const FULL = {
  v: 1, savedAt: '2026-11-01T10:00:00.000Z', etape: 'planning', profilComplet: true,
  userName: 'Sere Farid', targetScore: 32, ibYear: 'DP2', memoirLevel: 'SL', iaLevel: 'HL',
  subjects: [{ name: 'Chimie', level: 'HL' }, { name: 'Anglais', level: 'SL' }, { name: 'Maths', level: 'SL' }],
  optionalSubjects: [{ name: 'Musique', level: 'SL' }, { name: 'Histoire', level: 'SL' }, { name: 'Biologie', level: 'HL' }],
  weekdayWakeup: '06:30', saturdayWakeup: '07:30', sundayWakeup: '10:00',
  weekdaySleepHours: 8.5, saturdaySleepHours: 8, sundaySleepHours: 9,
  selectedActivities: [{ name: 'Natation', icon: '🏊', days: [1, 3], sameTime: true, startTime: '17:00', endTime: '18:00', dayTimes: {} }, { name: 'Piano', icon: '🎹', days: [3], sameTime: true, startTime: '19:00', endTime: '20:00', dayTimes: {} }],
  customEvents: [ev('c1', 1, '17:00', '18:00', 'Natation', 'activity'), ev('c2', 3, '19:00', '20:00', 'Piano', 'activity')],
  exercices: [{ id: 'x1', matiere: 'Chimie', titre: 'Exo 1', done: false }],
  transportMode: 'car', carToSchool: 30, carFromSchool: 40,
  phoneDays: ['lundi', 'mardi'], phoneDuration: 45,
  joursConnectes: 4, dernierJour: new Date().toDateString(),
  google: { sub: SUB, email: EMAIL },
};

/* Scénarios (suite du harnais) : un changement fait sur un autre appareil arrive au rechargement,
   une modification locale non envoyée reste, et le sommeil du planning figé est recalculé. */
function nouvelAppareil(nuage, init) {
  const c = creerContexte(init);
  c.firebase = firebaseFactice(nuage, 'UID-FARID', user);
  charger(c, ordreReel());
  return c;
}
// Arrête les envois en attente d'un appareil (sinon il publierait pendant le scénario).
function figerEnvois(c) { vm.runInContext('clearTimeout(compteProgressionTimer); compteProgressionTimer = null;', c); }
// Rechargement : nouveau contexte avec le stockage de l'appareil (session Google + copies locales).
async function recharger(stockage, nuage) {
  const c = nouvelAppareil(nuage, Object.assign({}, stockage));
  await attendre(4500);
  return c;
}

const sleepsDuJour = (c, d) => (c.emploiReconstruire(d) || []).filter(ev => ev && (ev.id === 'sleep' || ev.type === 'sleep'))
  .map(ev => ({ id: ev.id, start: ev.startTime, end: ev.endTime }));


const attendre = (ms) => new Promise(r => setTimeout(r, ms));
const verifs = [];
const verif = (nom, obtenu, attendu) => { const r = JSON.stringify(obtenu) === JSON.stringify(attendu); verifs.push(r); console.log((r ? 'OK    ' : 'ECHEC ') + nom + ' : ' + JSON.stringify(obtenu) + (r ? '' : '  (attendu ' + JSON.stringify(attendu) + ')')); };
const noms = (c) => (c.memoireLireEtat().selectedActivities || []).map(a => a && a.name);
(async () => {
  process.chdir(ROOT);
  const nuage = creerNuage();
  // A (ordinateur) : deux activités, et des suppressions datées plus anciennes pour ces deux noms.
  const suppressions = { selectedActivities: { Natation: 1000, Piano: 1000 } };
  const a = nouvelAppareil(nuage, { 'studyPlanIB_suppressions': JSON.stringify(suppressions) });
  a.compteOnCredential({ credential }); await attendre(2500);
  a.compteSession = { sub: SUB, email: EMAIL, name: 'Sere Farid' }; a.memoirePret = true;
  a.memoireAppliquer(FULL, { compte: true }); a.memoireSauvegarder();
  figerEnvois(a);
  await a.compteProgressionEnregistrer(); await attendre(800);
  verif('0 ordinateur : deux activités', noms(a), ['Natation', 'Piano']);
  // B (second téléphone) : rien en mémoire, même compte.
  const b = nouvelAppareil(nuage, {});
  b.compteOnCredential({ credential }); await attendre(3500);
  figerEnvois(b);
  verif('1 second téléphone : mêmes activités que l ordinateur', noms(b), ['Natation', 'Piano']);
  // C (second téléphone déjà utilisé, données locales plus riches, sans activités) : la fusion
  // ne doit pas faire perdre les activités du compte.
  const exoLocaux = [1, 2, 3, 4, 5].map(i => ({ id: 'l' + i, matiere: 'Anglais', titre: 'Local ' + i, done: false }));
  const c = nouvelAppareil(nuage, { 'studyPlanIB_suppressions': JSON.stringify(suppressions),
    'studyPlanIB_profil': JSON.stringify(Object.assign({}, FULL, { selectedActivities: [], customEvents: [], exercices: exoLocaux })) });
  c.compteOnCredential({ credential }); await attendre(3500);
  figerEnvois(c);
  verif('2 téléphone avec données locales : activités conservées', noms(c), ['Natation', 'Piano']);
  const tout = verifs.every(Boolean);
  console.log(tout ? 'TEST_OK' : 'TEST_ECHEC');
  process.exit(tout ? 0 : 1);
})().catch(err => { console.log('ERREUR', err.stack); process.exit(2); });
