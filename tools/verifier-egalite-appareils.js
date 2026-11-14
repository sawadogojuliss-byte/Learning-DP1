/* Vérifie que les flammes, les activités et les exercices sont les mêmes sur tous les téléphones
   d'un même compte :
   - un exercice ajouté ou supprimé sur un téléphone arrive sur l'autre (en direct et au rechargement) ;
   - la série de flammes est la même partout : 10 un jour, 11 le lendemain sur un autre téléphone ;
   - un changement de flammes arrive dans le nuage sans action de l'élève.

   Même harnais que verifier-synchro-deux-telephones.js : vrais fichiers, faux Firestore partagé,
   horloge décalée pour simuler le lendemain. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');

/* ── Harnais : un contexte par appareil ─────────────────────────────── */
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
  const el = () => ({ value: '', textContent: '', innerHTML: '', style: {}, dataset: {}, hidden: false, disabled: false, childNodes: [], children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; }, appendChild() {}, removeChild() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, focus() {}, blur() {}, click() {}, remove() {}, getContext() { return null; } });
  const document = { readyState: 'complete', title: '', body: el(), documentElement: el(), head: el(), getElementById: () => null, querySelector: () => null,
    querySelectorAll: () => [], createElement: el, addEventListener() {}, removeEventListener() {}, createTextNode: () => el() };
  const ctx = {
    console, setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {}, Date, Math, JSON, Promise, Object, Array, String, Number, Boolean,
    RegExp, Error, Set, Map, URL, Intl, Symbol, Uint8Array, ArrayBuffer, Buffer,
    localStorage: ls, sessionStorage: ls, document, navigator: { onLine: true, userAgent: 'test' },
    location: { hash: '', href: 'https://test/', search: '', pathname: '/' }, history: { replaceState() {}, pushState() {} },
    addEventListener() {}, removeEventListener() {}, requestAnimationFrame: () => 0, fetch: () => Promise.reject(new Error('reseau coupe')),
    alert() {}, confirm: () => true, prompt: () => null, getComputedStyle: () => ({}), atob: b => Buffer.from(b, 'base64').toString('binary'),
    btoa: b => Buffer.from(b, 'binary').toString('base64'), TextEncoder, TextDecoder,
  };
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
function majClasseAffichage() {} function majApparenceNotes() {} function enforceSubjectRules() {} function appliquerHabitudes() {} function focusReglages() {}
function devoirsEcrireStore() {} function devoirsLireStore() { return {}; } function emploiScolaireLire() { return null; } function emploiScolaireEcrire() {}
function eeNormaliserPlan(p) { return p; } function eeNormaliserPlans(p) { return p; } function reporterModificationsSemaine() {}
function verrouillerSujetsChoisis() {} function eeNettoyerSuivi() {}
`;
function ordreReel() {
  const reg = fs.readFileSync(path.join(ROOT, 'js/registre.js'), 'utf8');
  return [...reg.matchAll(/'(js\/[^']+\.js)'/g)].map(m => m[1]);
}
function charger(ctx) {
  vm.runInContext(PRELUDE, ctx, { filename: 'prelude' });
  const echecs = [];
  for (const f of ordreReel()) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    try { vm.runInContext(src, ctx, { filename: f }); } catch (e) { echecs.push(f + ' : ' + e.message); }
  }
  ctx.__echecsChargement = echecs;
  /* L'affichage n'existe pas dans le test : on remplace seulement les fonctions qui dessinent la page. */
  vm.runInContext('if (typeof renderActivities === "function") renderActivities = function () {};', ctx);
  vm.runInContext('if (typeof renderPlanning === "function") renderPlanning = function () {};', ctx);
  return ctx;
}

/* Faux Firestore partagé : fusion superficielle comme merge:true, tableaux imbriqués refusés, et
   écoutes en direct (onSnapshot) prévenues à chaque écriture, comme le fait Firestore. */
function creerNuage() {
  const docs = {}, journal = [], ecoutes = [];
  const cle = (c, id) => c + '/' + id;
  const instantane = (k) => ({ exists: !!docs[k], data: () => (docs[k] ? JSON.parse(JSON.stringify(docs[k])) : undefined),
    metadata: { hasPendingWrites: false, fromCache: false } });
  function prevenir(k) {
    ecoutes.filter(e => e.k === k).forEach(e => setTimeout(() => { if (ecoutes.indexOf(e) !== -1) e.cb(instantane(k)); }, 20));
  }
  function doc(c, id) {
    const k = cle(c, id);
    return {
      get: () => Promise.resolve(instantane(k)),
      set: (obj, opts) => {
        const avant = docs[k] || {};
        const apres = (opts && opts.merge) ? Object.assign({}, avant, obj) : Object.assign({}, obj);
        const imbriques = (v) => Array.isArray(v) && v.some(x => Array.isArray(x));
        const refuse = Object.keys(obj).find(f => imbriques(obj[f]) || (obj[f] && typeof obj[f] === 'object' && !Array.isArray(obj[f]) && Object.values(obj[f]).some(imbriques)));
        if (refuse) { journal.push({ c, id, refus: refuse }); return Promise.reject(new Error('tableau imbrique : ' + refuse)); }
        docs[k] = JSON.parse(JSON.stringify(apres));
        journal.push({ c, id, champs: Object.keys(obj) });
        prevenir(k);
        return Promise.resolve();
      },
      onSnapshot: (cb, erreur) => {
        const e = { k, cb };
        ecoutes.push(e);
        setTimeout(() => { if (ecoutes.indexOf(e) !== -1) cb(instantane(k)); }, 5);
        return () => { const i = ecoutes.indexOf(e); if (i !== -1) ecoutes.splice(i, 1); };
      },
    };
  }
  const db = { collection: (c) => ({ doc: (id) => doc(c, id), get: () => Promise.resolve({ docs: [], empty: true, forEach() {} }),
    where: () => ({ orderBy: () => ({ limit: () => ({ get: () => Promise.resolve({ docs: [], empty: true, forEach() {} }) }) }), get: () => Promise.resolve({ docs: [], empty: true, forEach() {} }) }) }) };
  require('./nuage-factice.cjs')(db);
  return { docs, journal, ecoutes, db };
}
function firebaseFactice(nuage, uid, user) {
  const utilisateur = { uid, email: user.email, displayName: user.name, photoURL: '' };
  const auth = () => ({ currentUser: utilisateur, signInWithCredential: () => Promise.resolve({ user: utilisateur }),
    onAuthStateChanged(cb) { setTimeout(() => cb(utilisateur), 300); } });
  auth.GoogleAuthProvider = { credential: () => ({}) };
  const fs2 = () => nuage.db;
  fs2.FieldValue = { serverTimestamp: () => 'TS' };
  fs2.FieldPath = { documentId: () => '__name__' };
  return { apps: [{}], auth, firestore: fs2 };
}

/* ── Données de départ : même élève, deux activités et deux cours ───── */
const user = { name: 'Sere Farid', email: 'faridsere86@gmail.com' };
const SUB = 'FARID-SUB-123', EMAIL = user.email;
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
  selectedActivities: [
    { name: 'Natation', icon: '🏊', days: [1, 3], sameTime: true, startTime: '17:00', endTime: '18:00', dayTimes: {} },
    { name: 'Piano', icon: '🎹', days: [3], sameTime: true, startTime: '19:00', endTime: '20:00', dayTimes: {} },
  ],
  customEvents: [ev('c1', 1, '17:00', '18:00', 'Natation', 'activity'), ev('c2', 3, '19:00', '20:00', 'Piano', 'activity'), ev('c3', 2, '08:00', '09:00', 'Chimie', 'course')],
  exercices: [{ id: 'x1', matiere: 'Chimie', titre: 'Exo 1', done: false }],
  transportMode: 'car', carToSchool: 30, carFromSchool: 40, phoneDays: ['lundi', 'mardi'], phoneDuration: 45,
  joursConnectes: 4, dernierJour: new Date().toDateString(), google: { sub: SUB, email: EMAIL },
};

/* ── Outils de scénario ─────────────────────────────────────────────── */
const attendre = (ms) => new Promise(r => setTimeout(r, ms));
const verifs = [];
const verif = (nom, obtenu, attendu) => {
  const r = JSON.stringify(obtenu) === JSON.stringify(attendu);
  verifs.push(r);
  console.log((r ? 'OK    ' : 'ECHEC ') + nom + (r ? '' : ' : ' + JSON.stringify(obtenu) + '  (attendu ' + JSON.stringify(attendu) + ')'));
};
function nouvelAppareil(nuage, init) {
  const c = creerContexte(init);
  c.firebase = firebaseFactice(nuage, 'UID-FARID', user);
  charger(c);
  return c;
}
function figer(c) { vm.runInContext('clearTimeout(compteProgressionTimer); compteProgressionTimer = null;', c); }
/* Rechargement : l'ancien appareil est fermé (ses écoutes s'arrêtent), le nouveau reprend son stockage. */
async function recharger(ancien, nuage) {
  if (ancien) { figer(ancien); vm.runInContext('compteEcouterArreter();', ancien); }
  const c = nouvelAppareil(nuage, Object.assign({}, ancien ? ancien.__store : {}));
  await attendre(4500);
  figer(c);
  return c;
}
/* Gestes de l'interface : on modifie la liste puis on sauvegarde, comme le fait l'écran. */
const geste = (c, code) => vm.runInContext(code, c);
const ajouterCours = (c, e) => geste(c, 'customEvents.push(' + JSON.stringify(e) + '); memoireSauvegarder();');
const retirerCours = (c, id) => geste(c, 'customEvents = customEvents.filter(function (e) { return e.id !== ' + JSON.stringify(id) + '; }); memoireSauvegarder();');
const retirerActivite = (c, nom) => geste(c, 'removeActivity(' + JSON.stringify(nom) + '); customEvents = customEvents.filter(function (e) { return !(e.type === "activity" && e.title === ' + JSON.stringify(nom) + '); }); memoireSauvegarder();');
const deplacerActivite = (c, nom, debut, fin) => geste(c, 'selectedActivities.forEach(function (a) { if (a.name === ' + JSON.stringify(nom) + ') { a.startTime = ' + JSON.stringify(debut) + '; a.endTime = ' + JSON.stringify(fin) + '; } });'
  + 'customEvents.forEach(function (e) { if (e.title === ' + JSON.stringify(nom) + ') { e.startTime = ' + JSON.stringify(debut) + '; e.endTime = ' + JSON.stringify(fin) + '; } }); memoireSauvegarder();');
/* Envoi immédiat (au lieu d'attendre les 3 secondes de l'application). */
async function envoyer(c) { figer(c); await c.compteProgressionEnregistrer(); }
/* Emploi du temps tel que l'élève le voit : cours et activités, avec leurs horaires. */
function emploi(c) {
  const e = c.memoireLireEtat();
  return {
    cours: (e.customEvents || []).map(x => [x.id, x.day, x.startTime, x.endTime, x.title]).sort((p, q) => (p[0] < q[0] ? -1 : 1)),
    activites: (e.selectedActivities || []).map(x => [x.name, x.startTime, x.endTime]).sort(),
  };
}
const memes = (x, y) => JSON.stringify(emploi(x)) === JSON.stringify(emploi(y));
function sansEcart(a, b) { return JSON.stringify(emploi(a)) === JSON.stringify(emploi(b)); }

/* Le téléphone reçoit la copie en direct : on attend l'arrivée de l'écoute. */
async function ouvrirEnDirect(c, nuage) {
  /* Une écoute par appareil, comme l'application (compteEcouterNuage). */
  vm.runInContext('compteEcouterNuage();', c);
  await attendre(400);
}


/* ── Outils de ce test ─────────────────────────────────────────────── */
const cleJour = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function nouvelAppareilAJour(nuage, init, jours) {
  const c = creerContexte(init);
  const Vrai = Date, decalage = jours * 86400000;
  class Decalee extends Vrai {
    constructor(...a) { if (a.length === 0) super(Vrai.now() + decalage); else super(...a); }
    static now() { return Vrai.now() + decalage; }
  }
  c.Date = Decalee;
  c.firebase = firebaseFactice(nuage, 'UID-FARID', user);
  charger(c);
  return c;
}
const lire = (c, code) => vm.runInContext(code, c);
/* Ce que l'élève voit sur un téléphone : flammes (après l'affichage du planning), matières,
   activités et exercices. */
function fiche(nuage) { return nuage.docs['documents/UID-FARID'] || {}; }
function apercu(c) {
  lire(c, 'boiteFlammes()');
  return {
    flammes: Number(lire(c, "localStorage.getItem('studyPlanIB_flamme')")),
    matieres: lire(c, 'subjects.length + optionalSubjects.length'),
    activites: lire(c, 'selectedActivities.map(function (a) { return a.name; }).sort()'),
    exercices: lire(c, 'exercices.map(function (x) { return x.id; }).sort()'),
  };
}
const egaux = (x, y) => JSON.stringify(x) === JSON.stringify(y);
async function connecter(c) {
  c.compteOnCredential({ credential });
  await attendre(3500);
  figer(c);
}
/* Chaque étape : tous les téléphones ouverts ont le même chiffre de flammes, d'activités et d'exercices. */
function comparer(etape, appareils) {
  const vues = appareils.map(([nom, c]) => [nom, apercu(c)]);
  const ref = vues[0][1];
  vues.forEach(([nom, v]) => {
    verif(etape + ' ' + nom + ' : flammes = ' + ref.flammes, v.flammes, ref.flammes);
    verif(etape + ' ' + nom + ' : mêmes activités que ' + vues[0][0], egaux(v.activites, ref.activites), true);
    verif(etape + ' ' + nom + ' : mêmes exercices que ' + vues[0][0], egaux(v.exercices, ref.exercices), true);
  });
}

(async () => {
  process.chdir(ROOT);
  const aujourdhui = cleJour(new Date());

  /* ── Compte : profil complet, 2 activités, 1 exercice, série de 10 flammes aujourd'hui ─ */
  const nuage = creerNuage();
  const a = nouvelAppareil(nuage, {});
  a.compteOnCredential({ credential });
  await attendre(2500);
  a.compteSession = { sub: SUB, email: EMAIL, name: 'Sere Farid' }; a.memoirePret = true;
  a.memoireAppliquer(FULL, { compte: true }); a.memoireSauvegarder();
  lire(a, "localStorage.setItem('studyPlanIB_flamme', '10'); localStorage.setItem('studyPlanIB_flammeJour', '" + aujourdhui + "'); memoireSauvegarder();");
  await envoyer(a); await attendre(800);

  /* Jour J : second téléphone, nouveau, même compte. */
  const b = nouvelAppareil(nuage, { studyPlanIB_exercices: '[]' });
  await connecter(b);
  comparer('J', [['téléphone A', a], ['téléphone B', b]]);

  /* Jour J+1 : un troisième téléphone se connecte ; A et B sont rouverts le lendemain. */
  const storeB = Object.assign({}, b.__store);
  const storeA = Object.assign({}, a.__store);
  const c = nouvelAppareilAJour(nuage, { studyPlanIB_exercices: '[]' }, 1);
  await connecter(c);
  const a1 = nouvelAppareilAJour(nuage, storeA, 1);
  await attendre(4000); figer(a1);
  const b1 = nouvelAppareilAJour(nuage, storeB, 1);
  await attendre(4000); figer(b1);
  comparer('J+1', [['téléphone A', a1], ['téléphone B', b1], ['téléphone C', c]]);
  verif('J+1 : la série vaut 11 (10 la veille)', apercu(c).flammes, 11);

  /* Jour J+1 : A retire une activité ; B (ouvert) la reçoit. */
  lire(a1, "removeActivity('Piano'); customEvents = customEvents.filter(function (e) { return !(e.type === 'activity' && e.title === 'Piano'); }); memoireSauvegarder();");
  await envoyer(a1); await attendre(800);
  comparer('J+1 après retrait', [['téléphone A', a1], ['téléphone B', b1]]);

  /* Jour J+2 : tout le monde rouvert, la série passe à 12 une seule fois. */
  const storeC = Object.assign({}, c.__store);
  const a2 = nouvelAppareilAJour(nuage, Object.assign({}, a1.__store), 2);
  await attendre(4000); figer(a2);
  const b2 = nouvelAppareilAJour(nuage, Object.assign({}, b1.__store), 2);
  await attendre(4000); figer(b2);
  const c2 = nouvelAppareilAJour(nuage, storeC, 2);
  await attendre(4000); figer(c2);
  comparer('J+2', [['téléphone A', a2], ['téléphone B', b2], ['téléphone C', c2]]);
  verif('J+2 : la série vaut 12', apercu(c2).flammes, 12);
  verif('J+2 : Piano absent partout', apercu(b2).activites.indexOf('Piano'), -1);

  /* Jour J+2 : B ajoute un exercice ; A (ouvert) le voit, et C le voit à la réouverture. */
  await ouvrirEnDirect(a2, nuage);
  lire(b2, "exercices.push({ id: 'x9', matiere: 'Histoire', titre: 'Exo 9', done: false }); memoireSauvegarder();");
  await envoyer(b2); await attendre(800);
  comparer('J+2 après exercice', [['téléphone A', a2], ['téléphone B', b2]]);
  const c3 = nouvelAppareilAJour(nuage, Object.assign({}, c2.__store), 2);
  await attendre(4000); figer(c3);
  comparer('J+2 réouverture C', [['téléphone A', a2], ['téléphone B', b2], ['téléphone C', c3]]);

  /* ── Compte déjà faussé (8 flammes enregistrées le lendemain par une ancienne version) ── */
  const nuage3 = creerNuage();
  const ancien = nouvelAppareilAJour(nuage3, {}, 1);
  ancien.compteOnCredential({ credential });
  await attendre(2500);
  ancien.compteSession = { sub: SUB, email: EMAIL, name: "Sere Farid" }; ancien.memoirePret = true;
  ancien.memoireAppliquer(FULL, { compte: true }); ancien.memoireSauvegarder();
  lire(ancien, "localStorage.setItem('studyPlanIB_flamme', '8'); localStorage.setItem('studyPlanIB_flammeJour', '" + cleJour(new Date(Date.now() + 86400000)) + "'); memoireSauvegarder();");
  await envoyer(ancien); await attendre(800);
  verif("H0 compte faussé : le nuage contient 8", fiche(nuage3).flammes, 8);
  const sain = nouvelAppareil(nuage3, { studyPlanIB_exercices: "[]", studyPlanIB_flamme: "10", studyPlanIB_flammeJour: aujourdhui });
  await connecter(sain);
  const sain1 = nouvelAppareilAJour(nuage3, Object.assign({}, sain.__store), 1);
  await attendre(4000); figer(sain1);
  comparer("H1 téléphone déjà à 10 hier, réouvert demain", [["téléphone sain", sain1]]);
  verif("H1 téléphone déjà à 10 hier, réouvert demain : 11", apercu(sain1).flammes, 11);
  await attendre(3500);
  verif("H2 le nuage est corrigé à 11 automatiquement", fiche(nuage3).flammes, 11);

  /* ── Bilan ─────────────────────────────────────────────────────────── */
  const reussis = verifs.filter(Boolean).length;
  console.log(reussis === verifs.length ? 'TEST_OK ' + reussis + '/' + verifs.length : 'TEST_ECHEC ' + (verifs.length - reussis) + ' échec(s) sur ' + verifs.length);
  process.exit(reussis === verifs.length ? 0 : 1);
})();
