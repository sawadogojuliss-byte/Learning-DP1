/* Vérifie que l'emploi du temps affiché au rechargement de la page reste celui de l'appareil :
   le nuage (copie plus ancienne) ne le remplace plus quelques secondes après l'affichage.

   Le test charge les vrais fichiers dans l'ordre de js/registre.js, simule un rechargement avec
   Firebase qui répond environ 1,5 s après le chargement, et suit l'emploi affiché dans le temps.
   Cas couverts : copie locale présente (doit rester), pas de copie locale (le nuage est repris),
   copie locale d'un autre compte (le nuage est repris), connexion explicite (le nuage est repris). */
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



const SUB = 'FARID-SUB-123';
const EMAIL = 'faridsere86@gmail.com';
const profil = (marque, savedAt, sub) => ({ v: 1, profilComplet: true, etape: 'planning', userName: 'Sere Farid', targetScore: 32, ibYear: 'DP2',
  weekdayWakeup: '06:30', saturdayWakeup: '07:30', sundayWakeup: '10:00', weekdaySleepHours: 8.5, saturdaySleepHours: 8, sundaySleepHours: 9,
  subjects: [{ name: 'Chimie', level: 'HL' }, { name: 'Anglais', level: 'SL' }], emploiFige: { jours: [{ marque }] }, savedAt, google: { sub: sub || SUB, email: EMAIL } });
const LOCAL = profil('LOCAL', '2026-11-01T10:00:00.000Z');
const NUAGE = profil('NUAGE', '2026-10-30T09:00:00.000Z');
const AUTRE = profil('AUTRE', '2026-11-01T09:00:00.000Z', 'AUTRE-SUB');

// Rechargement : retourne la suite des emplois affichés (une valeur à chaque changement).
async function rechargement(stockage, { connexion } = {}) {
  const ctx = creerContexte(stockage);
  ctx.window.STUDYPLAN_FIREBASE_CONFIG = {};
  const marque = () => { const e = ctx.memoireLireEtat(); return e.emploiFige && e.emploiFige.jours ? (e.emploiFige.jours[0] || {}).marque : 'aucun'; };
  const auth = { currentUser: { uid: 'UID-FARID', displayName: 'Sere Farid' }, onAuthStateChanged(cb) { setTimeout(() => cb({ uid: 'UID-FARID' }), 1500); } };
  ctx.firebase = { apps: [{}], auth: () => auth, firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false }), set: () => Promise.resolve() }) }) }), { FieldValue: { serverTimestamp: () => 'TS' } }) };
  charger(ctx, ordreReel());
  ctx.compteFirebaseLireProgression = () => Promise.resolve({ progression: NUAGE });
  ctx.compteFirebaseLireDocuments = () => Promise.resolve([]);
  ctx.compteLireCopiesPartagees = () => Promise.resolve([]);
  ctx.compteFirebaseEcrire = () => Promise.resolve();
  ctx.comptePublierProgression = () => Promise.resolve();
  ctx.compteChargerFirebase = () => Promise.resolve(ctx.firebase);
  ctx.compteRafraichir = () => {};
  const suite = [marque()];
  const timer = setInterval(() => { const m = marque(); if (m !== suite[suite.length - 1]) suite.push(m); }, 100);
  if (connexion) {
    await new Promise(r => setTimeout(r, 300));
    ctx.compteOnCredential({ credential: (() => { const b = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); return b({ alg: 'none' }) + '.' + b({ sub: SUB, email: EMAIL, name: 'Sere Farid' }) + '.x'; })() });
  }
  await new Promise(r => setTimeout(r, 4000));
  clearInterval(timer);
  return suite;
}
// L'appareil garde la session Google de l'élève (comme après une connexion), et le profil local éventuel.
function stockageAvec(profilLocal) {
  const avant = creerContexte(); charger(avant, ordreReel());
  avant.compteSession = { sub: SUB, email: EMAIL, name: 'Sere Farid' };
  avant.localStorage.setItem('studyPlanIB_googleSession', JSON.stringify(avant.compteSession));
  if (profilLocal) {
    // Le profil est enregistré sous le compte qui était connecté à ce moment-là.
    avant.compteSession = { sub: profilLocal.google.sub, email: EMAIL, name: '' };
    avant.memoireAppliquer(profilLocal, { compte: true }); avant.memoirePret = true; avant.memoireSauvegarder();
    avant.compteSession = { sub: SUB, email: EMAIL, name: 'Sere Farid' };
  }
  return Object.assign({}, avant.__store);
}
const ok = [];
const verif = (nom, obtenu, attendu) => { const r = JSON.stringify(obtenu) === JSON.stringify(attendu); ok.push(r); console.log((r ? 'OK    ' : 'ECHEC ') + nom + ' : ' + JSON.stringify(obtenu) + (r ? '' : '  (attendu ' + JSON.stringify(attendu) + ')')); };
(async () => {
  process.chdir(ROOT);
  // 1. Rechargement, l'appareil a la copie du compte : l'emploi affiché ne change pas du tout.
  verif('1 rechargement, copie locale presente -> inchangee', await rechargement(stockageAvec(LOCAL)), ['LOCAL']);
  // 2. Pas de copie locale : la copie du nuage est reprise (la restauration fonctionne toujours).
  const s2 = await rechargement(stockageAvec(null));
  verif('2 rechargement, pas de copie locale -> nuage repris', s2.includes('NUAGE'), true);
  // 3. La copie locale est celle d'un autre compte : celle de ce compte est reprise.
  const s3 = await rechargement(stockageAvec(AUTRE));
  verif('3 rechargement, copie d un autre compte -> nuage repris', s3.includes('NUAGE'), true);
  // 4. Connexion explicite : le nuage remplace la copie locale (voulu, à chaque connexion).
  const s4 = await rechargement(stockageAvec(LOCAL), { connexion: true });
  verif('4 connexion explicite -> nuage repris', s4.includes('NUAGE'), true);
  const tout = ok.every(Boolean);
  console.log(tout ? 'TEST_OK' : 'TEST_ECHEC');
  process.exit(tout ? 0 : 1);
})().catch(e => { console.log('ERREUR ' + e.stack); process.exit(2); });
