/* Vérifie qu'un nouvel appareil (téléphone vide) retrouve, à la connexion avec le même compte,
   exactement ce que l'élève avait sur son premier appareil : objectif, matières (principales et
   optionnelles), activités, emploi du temps figé, réveils et temps de sommeil, etc.

   Le test charge les vrais fichiers de l'application (ordre de js/registre.js). Un faux Firestore
   partagé joue le nuage : il refuse les tableaux imbriqués comme le vrai. Le premier appareil
   enregistre le profil, le second se connecte avec le même compte, puis les champs sont comparés. */
// Harnais : charge les vrais fichiers de l'application dans un même contexte vm.
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
const CLES = ['userName', 'targetScore', 'ibYear', 'subjects', 'optionalSubjects', 'weekdayWakeup', 'saturdayWakeup', 'sundayWakeup', 'weekdaySleepHours', 'saturdaySleepHours', 'sundaySleepHours', 'selectedActivities', 'customEvents', 'exercices', 'transportMode', 'carToSchool', 'carFromSchool', 'phoneDays', 'joursConnectes', 'emploiFige'];
const ok = (x) => JSON.stringify(x);
// L'horodatage de fabrication (at) de l'emploi figé n'est pas un contenu : on le retire de la comparaison.
const contenu = (k, v) => (k === 'emploiFige' && v) ? ok({ ...v, at: undefined }) : ok(v);
const attendre = (ms) => new Promise(r => setTimeout(r, ms));
async function connecter(ctx) { ctx.compteOnCredential({ credential }); await attendre(2500); }
// Appareil 2 : se connecte avec le même compte ; `init` = contenu déjà présent sur le téléphone.
async function verifierAppareil2(nom, nuage, E1, init, journal) {
  const b = creerContexte(init); b.firebase = firebaseFactice(nuage, 'UID-FARID', user); charger(b, ordreReel());
  await connecter(b);
  await attendre(2000);
  const e = b.memoireLireEtat();
  const diff = CLES.filter(k => contenu(k, e[k]) !== contenu(k, E1[k]));
  console.log('APPAREIL 2 (' + nom + ') : ' + (diff.length ? 'différences : ' + diff.map(k => k + ' (obtenu ' + ok(e[k]).slice(0, 120) + ' / attendu ' + ok(E1[k]).slice(0, 120) + ')').join(' ; ') : 'identique à l appareil 1 sur tous les champs (' + CLES.length + ')'));
  return diff.length === 0;
}
(async () => {
  const nuage = creerNuage();
  // --- Appareil 1 : l'élève travaille et son profil est enregistré ---
  const a = creerContexte(); a.firebase = firebaseFactice(nuage, 'UID-FARID', user); charger(a, ordreReel());
  await connecter(a);
  a.compteSession = { sub: SUB, email: EMAIL, name: 'Sere Farid' };
  a.memoirePret = true;
  a.memoireAppliquer(FULL, { compte: true });
  a.memoireSauvegarder();
  await a.compteProgressionEnregistrer();
  await attendre(3500);
  const E1 = a.memoireLireEtat();
  const journal = nuage.journal.filter(j => j.c !== 'comptes' || true);
  console.log('ECRITURES appareil 1 : ' + journal.filter(j => j.refus).length + ' refus');
  const pr = nuage.docs['progressions/UID-FARID'];
  console.log('progressions/UID-FARID existe :', !!pr, pr ? 'champs=' + Object.keys(pr).join(',') : '');
  if (pr && typeof pr.progression === 'string') { const p = JSON.parse(pr.progression); const manque = CLES.filter(k => p[k] === undefined); console.log('  taille progression : ' + pr.progression.length + ' car. ; champs manquants : ' + (manque.join(', ') || 'aucun')); }
  // Cas 1 : téléphone neuf
  const ok1 = await verifierAppareil2('téléphone neuf', nuage, E1, undefined, journal);
  // Cas 2 : téléphone qui a déjà une copie ancienne et pauvre du même compte
  const s0 = creerContexte(); s0.firebase = firebaseFactice(nuage, 'UID-FARID', user); charger(s0, ordreReel());
  await connecter(s0);
  s0.compteSession = { sub: SUB, email: EMAIL, name: 'Sere Farid' };
  s0.memoirePret = true;
  s0.memoireAppliquer(ANCIEN, { compte: true });
  s0.memoireSauvegarder();
  await attendre(500);
  const ok2 = await verifierAppareil2('copie ancienne locale', nuage, E1, s0.__store, journal);
  const refus = journal.filter(j => j.refus).length;
  const nbMatieres = E1.subjects.length + E1.optionalSubjects.length;
  console.log('matières sur l appareil 1 : ' + E1.subjects.length + ' principales + ' + E1.optionalSubjects.length + ' optionnelles');
  const tout = ok1 && ok2 && refus === 0 && nbMatieres === 6 && E1.subjects.length === 3 && E1.optionalSubjects.length === 3;
  console.log(tout ? 'TEST_OK' : 'TEST_ECHEC');
  process.exit(tout ? 0 : 1);
})().catch(err => { console.log('ERREUR', err.stack); process.exit(2); });
