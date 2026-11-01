/* Vérifie que le sommeil, les réveils, l'objectif et le nom d'un élève ne sont plus remis
   à leurs valeurs par défaut à la connexion (cas « dimanche 0 h–8 h »).

   Le test charge les vrais fichiers de l'application dans l'ordre de js/registre.js, simule
   un rechargement de page puis une connexion Google. Seuls les appels Firebase et Drive
   sont remplacés. Il couvre : nuage absent, nuage ancien sans réglages, nuage plus fourni
   sans réglages, autre compte sur le même appareil, nouvel appareil, aucun profil. */
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


// Scénario réel : connexion de l'élève (Farid) avec les vraies fonctions de l'application.
// Seuls les appels réseau Firebase / Drive sont remplacés.
const fichiers = ordreReel();
const ATTENDU = { userName: 'Sere Farid', targetScore: 32, sundayWakeup: '10:00', sundaySleepHours: 9, sundayBedtime: '01:00' };
const SUB = 'FARID-SUB-123';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jeton = { sub: SUB, email: 'faridsere86@gmail.com', name: 'Sere Farid' };
const credential = b64({ alg: 'none' }) + '.' + b64(jeton) + '.x';
const DEFAUT = { userName: '', targetScore: 40, sundayWakeup: '08:00', sundaySleepHours: 8, sundayBedtime: '00:00' };

// Profil complet tel que l'application l'enregistre (réglages de Farid).
const profilFarid = () => ({ v: 1, userName: 'Sere Farid', targetScore: 32, ibYear: 'DP2', weekdayWakeup: '06:30', saturdayWakeup: '07:30', sundayWakeup: '10:00', weekdaySleepHours: 8.5, saturdaySleepHours: 8, sundaySleepHours: 9, subjects: [{ name: 'Chimie', level: 'HL' }, { name: 'Anglais', level: 'SL' }], google: { sub: SUB, email: 'faridsere86@gmail.com' } });

function preparer(ctx, local, sub) {
  ctx.localStorage.clear();
  if (local) {
    ctx.compteSession = { sub: sub || SUB, email: 'x', name: '' };
    ctx.memoireAppliquer(local, { compte: true });
    ctx.memoirePret = true;
    ctx.memoireSauvegarder();
  }
}
function remplacerReseau(ctx, cloud) {
  ctx.compteFirebaseOuvrir = () => Promise.resolve({ user: { uid: 'UID-FARID' } });
  ctx.compteFirebaseLireProgression = () => Promise.resolve(cloud);   // null = absent ou lecture en échec (comportement réel)
  ctx.compteFirebaseLireDocuments = () => Promise.resolve([]);
  ctx.compteLireCopiesPartagees = () => Promise.resolve([]);
  ctx.compteFirebaseEcrire = () => Promise.resolve();
  ctx.comptePublierProgression = () => Promise.resolve();
  ctx.compteRafraichir = () => {};
  ctx.boitePublierEmploi = () => {};
}
async function connexion(ctx) {
  ctx.compteOnCredential({ credential });
  await new Promise(r => setTimeout(r, 400));
}
function etat(ctx) {
  const e = ctx.memoireLireEtat();
  const bedtime = typeof ctx.bedtimeForDay === 'function' ? ctx.bedtimeForDay(6) : null;
  const stocke = ctx.memoireJson('studyPlanIB_profil') || {};
  return { userName: e.userName, targetScore: e.targetScore, sundayWakeup: e.sundayWakeup, sundaySleepHours: e.sundaySleepHours, sundayBedtime: bedtime, stockeSunday: stocke.sundayWakeup };
}
const resultats = [];
async function scenario(nom, { local, cloud, sub, attendu }) {
  // 1) Session précédente : le profil est enregistré sur l'appareil.
  const avant = creerContexte();
  charger(avant, fichiers);
  preparer(avant, local, sub);
  const stockage = Object.assign({}, avant.__store);
  // 2) Rechargement de la page : la mémoire repart de zéro, seul le stockage local reste.
  const ctx = creerContexte(stockage);
  charger(ctx, fichiers);
  remplacerReseau(ctx, cloud ? { progression: cloud } : null);
  await connexion(ctx);
  const obtenu = etat(ctx);
  const ok = Object.keys(attendu).every(k => String(obtenu[k]) === String(attendu[k]));
  resultats.push(ok);
  console.log((ok ? 'OK    ' : 'ECHEC ') + nom + '\n        obtenu : ' + JSON.stringify(obtenu) + (ok ? '' : '\n        attendu: ' + JSON.stringify(attendu)));
}
(async () => {
process.chdir(ROOT);
  const complet = profilFarid();
  // 1. Nuage absent (ou lecture en échec) : le profil de l'appareil est gardé.
  await scenario('1 nuage absent/echec, profil local complet', { local: complet, cloud: null, attendu: ATTENDU });
  // 2. Nuage ancien et incomplet (sans réveils ni sommeil ni objectif) : les réglages locaux sont gardés.
  await scenario('2 nuage incomplet, profil local complet', { local: complet, cloud: { v: 1, userName: 'Sere Farid', ibYear: 'DP2', subjects: [{ name: 'Chimie', level: 'HL' }], google: { sub: SUB } }, attendu: ATTENDU });
  // 3. Nuage complet et plus récent (autre appareil) : ses valeurs sont appliquées (la synchro marche toujours).
  await scenario('3 nuage complet d autre appareil -> applique', { local: complet, cloud: Object.assign(profilFarid(), { sundayWakeup: '07:00', sundaySleepHours: 7, targetScore: 35 }), attendu: { sundayWakeup: '07:00', sundaySleepHours: 7, targetScore: 35, sundayBedtime: '00:00' } });
  // 4. Nouvel appareil sans profil local : le nuage complet est restauré.
  await scenario('4 nouvel appareil, nuage complet -> restaure', { local: null, cloud: profilFarid(), attendu: ATTENDU });
  // 5. Profil local d'un AUTRE compte sur le même appareil : rien n'est repris pour Farid.
  await scenario('5 autre compte sur l appareil, nuage absent -> pas de reprise', { local: Object.assign(profilFarid(), { sub: 'AUTRE', google: { sub: 'AUTRE' } }), sub: 'AUTRE', cloud: null, attendu: { sundayWakeup: '08:00', sundaySleepHours: 8, targetScore: 40 } });
  // 7. Nuage ancien mais plus fourni (plus de matières, profil complet) SANS réglages de sommeil : il ne doit pas effacer ceux de l'appareil.
  const fourni = { v: 1, profilComplet: true, userName: 'Sere Farid', ibYear: 'DP2', google: { sub: SUB }, subjects: [{ name: 'Chimie', level: 'HL' }, { name: 'Anglais', level: 'SL' }, { name: 'Maths', level: 'SL' }, { name: 'Histoire', level: 'SL' }, { name: 'Biologie', level: 'SL' }, { name: 'Physique', level: 'SL' }] };
  await scenario('7 nuage plus fourni sans reglages de sommeil -> reglages gardes', { local: complet, cloud: fourni, attendu: ATTENDU });
  // 8. Profil complet d'un AUTRE compte sur l'appareil + nuage plus fourni de Farid sans réglages : aucun réglage de l'autre n'est repris.
  await scenario('8 autre compte sur l appareil + nuage Farid sans reglages -> pas de reprise', { local: Object.assign(profilFarid(), { sub: 'AUTRE', google: { sub: 'AUTRE' } }), sub: 'AUTRE', cloud: fourni, attendu: { sundayWakeup: '08:00', sundaySleepHours: 8, targetScore: 40 } });
  // 6. Rien du tout (nouvel élève) : aucune erreur, valeurs par défaut.
  await scenario('6 aucun profil ni nuage -> defauts, pas d erreur', { local: null, cloud: null, attendu: DEFAUT });
  const tout = resultats.every(Boolean);
  console.log(tout ? 'TEST_OK' : 'TEST_ECHEC');
  process.exit(tout ? 0 : 1);
})().catch(e => { console.log('ERREUR ' + e.stack); process.exit(2); });
