/* Même vérification que verifier-sommeil.js, pour un compte élève ordinaire (pas un compte admin) :
   la synchronisation doit marcher pour tous les utilisateurs. Le compte n'est ni dans la liste des admins
   ni reconnu comme admin par l'application. */
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
const user = { name: 'Eleve Test', email: 'eleve.test@gmail.com' };
const SUB = 'ELEVE-SUB-456', EMAIL = user.email;
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const credential = b64({ alg: 'none' }) + '.' + b64({ sub: SUB, email: EMAIL, name: 'Eleve Test' }) + '.x';
const ev = (id, day, start, end, title, type) => ({ id, day, startTime: start, endTime: end, title, type, source: 'custom', date: '' });
const FULL = {
  v: 1, savedAt: '2026-11-01T10:00:00.000Z', etape: 'planning', profilComplet: true,
  userName: 'Eleve Test', targetScore: 32, ibYear: 'DP2', memoirLevel: 'SL', iaLevel: 'HL',
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
  c.firebase = firebaseFactice(nuage, 'UID-ELEVE', user);
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


const cleJour = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function nouvelAppareilAJour(nuage, init, jours) {
  const c = creerContexte(init);
  const Vrai = Date, decalage = jours * 86400000;
  class Decalee extends Vrai {
    constructor(...a) { if (a.length === 0) super(Vrai.now() + decalage); else super(...a); }
    static now() { return Vrai.now() + decalage; }
  }
  c.Date = Decalee;
  c.firebase = firebaseFactice(nuage, 'UID-ELEVE', user);
  charger(c);
  return c;
}
const lire = (c, code) => vm.runInContext(code, c);
/* Ce que l'élève voit sur un téléphone : flammes (après l'affichage du planning), matières,
   activités et exercices. */
function fiche(nuage) { return nuage.docs['documents/UID-ELEVE'] || {}; }
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

function semer(c) { lire(c, 'memoireAppliquer(' + JSON.stringify(FULL) + ', { compte: true }); memoireSauvegarder();'); return c; }

/* ── Sommeil : les valeurs de base ne reviennent jamais à la place d'un réglage de l'élève ─ */
const sommeil = (c) => JSON.parse(lire(c, 'JSON.stringify([weekdaySleepHours, saturdaySleepHours, sundaySleepHours, weekdayWakeup, saturdayWakeup, sundayWakeup])'));
const BASE = [8, 8, 8, '06:00', '07:00', '08:00'];
const nuageSommeil = (nuage) => JSON.parse(nuage.docs['progressions/UID-ELEVE'].progression);

/* Réglage fait par l'élève dans l'écran Sommeil : boutons, heure du coucher, réveil. */
function reglerSommeil(c) {
  lire(c, "adjustSleepHours('weekday', -1); setBedtimeFromInput('saturday', '23:30'); weekdayWakeup = '06:45'; if (typeof sommeilMarquerChoix === 'function') sommeilMarquerChoix(); updateBedtimes();");
}

async function scenarioSommeil() {
  console.log('--- Sommeil : un réglage de l\'élève reste, quel que soit l\'appareil ou la réouverture');
  const nuage = creerNuage();

  /* A : profil complet, puis l'élève règle son sommeil. */
  const a = semer(nouvelAppareilAJour(nuage, {}, 0));
  await connecter(a);
  reglerSommeil(a);
  const reglage = sommeil(a);
  await envoyer(a); await attendre(300); figer(a);
  verif('sommeil : réglage de A (7,5 h, réveil 06:45)', reglage, [7.5, 8, 9, '06:45', '07:30', '10:00']);
  verif('sommeil : le nuage a le réglage de A', [nuageSommeil(nuage).weekdaySleepHours, nuageSommeil(nuage).weekdayWakeup], [7.5, '06:45']);

  /* A rouvert le lendemain : le réglage reste. */
  const a1 = nouvelAppareilAJour(nuage, Object.assign({}, a.__store), 1);
  await attendre(4000); figer(a1);
  verif('sommeil : A rouvert demain garde son réglage', sommeil(a1), reglage);

  /* B : nouveau téléphone, même compte ; il a ses valeurs de base enregistrées avant la connexion. */
  const b = nouvelAppareil(nuage, {});
  lire(b, "setSleepHours('weekday', 8); weekdayWakeup = '06:00'; memoireSauvegarder();");
  await connecter(b);
  verif('sommeil : B (valeurs de base locales) reçoit le réglage de A', sommeil(b), reglage);

  /* C : rechargement de A, puis de B, sans rien régler : rien ne revient aux valeurs de base. */
  const b1 = nouvelAppareilAJour(nuage, Object.assign({}, b.__store), 1);
  await attendre(4000); figer(b1);
  verif('sommeil : B rouvert demain garde le réglage', sommeil(b1), reglage);
  const c = nouvelAppareilAJour(nuage, { studyPlanIB_googleSession: lire(a1, "localStorage.getItem('studyPlanIB_googleSession')") }, 2);
  await attendre(4000); figer(c);
  verif('sommeil : un téléphone sans profil local garde le réglage', sommeil(c), reglage);

  /* D : un téléphone qui a un réglage plus récent (l'élève a changé de sommeil) : c'est lui qui gagne. */
  const d = semer(nouvelAppareilAJour(nuage, {}, 2));
  await connecter(d);
  lire(d, "adjustSleepHours('saturday', 1); if (typeof sommeilMarquerChoix === 'function') sommeilMarquerChoix(); updateBedtimes();");
  const nouveau = sommeil(d);
  await envoyer(d); await attendre(300); figer(d);
  const a2 = nouvelAppareilAJour(nuage, Object.assign({}, a1.__store), 2);
  await attendre(4000); figer(a2);
  verif('sommeil : le réglage plus récent de l\'élève arrive sur A', sommeil(a2)[1], nouveau[1]);
}

async function scenarioSommeilBase() {
  console.log('--- Sommeil : aucun réglage de l\'élève = valeurs de base (premier usage)');
  const nuage = creerNuage();
  const x = semer(nouvelAppareilAJour(nuage, {}, 0));
  await connecter(x);
  const xx = sommeil(x);
  verif('base : le profil enregistré porte les réglages de l\'élève (pas les valeurs de base)', xx[0], 8.5);
}

async function scenarioSommeilLocalDeBase() {
  console.log('--- Sommeil : un téléphone au profil complet, avec les valeurs de base, reçoit le réglage du nuage');
  const nuage = creerNuage();
  const a = semer(nouvelAppareilAJour(nuage, {}, 0));
  await connecter(a);
  reglerSommeil(a);
  const reglage = sommeil(a);
  await envoyer(a); await attendre(300); figer(a);
  /* F : profil complet déjà sur l'appareil, sommeil resté aux valeurs de base (jamais réglé ici). */
  const f = semer(nouvelAppareilAJour(nuage, {}, 0));
  lire(f, "setSleepHours('weekday', 8); setSleepHours('saturday', 8); setSleepHours('sunday', 8); weekdayWakeup = '06:00'; saturdayWakeup = '07:00'; sundayWakeup = '08:00'; memoireSauvegarder();");
  await connecter(f);
  verif('base locale : F reçoit le réglage du nuage (pas les valeurs de base)', sommeil(f), reglage);
  /* Réouverture le lendemain : toujours le réglage. */
  const f1 = nouvelAppareilAJour(nuage, Object.assign({}, f.__store), 1);
  await attendre(4000); figer(f1);
  verif('base locale : F rouvert demain garde le réglage', sommeil(f1), reglage);
}

async function scenarioSommeilReouverture() {
  console.log('--- Sommeil : réouverture le lendemain d\'un téléphone dont les valeurs de base sont enregistrées');
  const nuage = creerNuage();
  const a = semer(nouvelAppareilAJour(nuage, {}, 0));
  await connecter(a);
  reglerSommeil(a);
  const reglage = sommeil(a);
  await envoyer(a); await attendre(300); figer(a);
  /* G : même appareil, session ouverte ; ses valeurs de base sont enregistrées localement (non envoyées). */
  const g = nouvelAppareilAJour(nuage, Object.assign({}, a.__store), 0);
  await attendre(3000); figer(g);
  lire(g, "setSleepHours('weekday', 8); setSleepHours('saturday', 8); setSleepHours('sunday', 8); weekdayWakeup = '06:00'; saturdayWakeup = '07:00'; sundayWakeup = '08:00'; sommeilChoisiLe = ''; memoireSauvegarder();");
  const store = Object.assign({}, g.__store);
  const g1 = nouvelAppareilAJour(nuage, store, 1);
  await attendre(4000); figer(g1);
  verif('réouverture : le lendemain, le réglage du nuage revient (pas la base)', sommeil(g1), reglage);
}

async function scenarioSommeilChoixLocalPlusRecent() {
  console.log('--- Sommeil : un réglage fait sur l\'appareil après celui du nuage gagne à la réouverture');
  const nuage = creerNuage();
  const a = semer(nouvelAppareilAJour(nuage, {}, 0));
  await connecter(a);
  reglerSommeil(a);
  await envoyer(a); await attendre(300); figer(a);
  /* H : même appareil, nouveau réglage de l'élève (9 h le samedi), non encore envoyé. */
  const h = nouvelAppareilAJour(nuage, Object.assign({}, a.__store), 0);
  await attendre(3000); figer(h);
  lire(h, "adjustSleepHours('saturday', 1); if (typeof sommeilMarquerChoix === 'function') sommeilMarquerChoix(); memoireSauvegarder();");
  const voulu = sommeil(h);
  const h1 = nouvelAppareilAJour(nuage, Object.assign({}, h.__store), 1);
  await attendre(4000); figer(h1);
  verif('choix local plus récent : il reste à la réouverture', sommeil(h1)[1], voulu[1]);
}

async function scenarioCompteNonAdmin() {
  console.log('--- Compte élève ordinaire : pas admin, mais synchronisation identique');
  const nuage = creerNuage();
  const a = semer(nouvelAppareilAJour(nuage, {}, 0));
  await connecter(a);
  verif('compte élève : n\'est pas admin', String(lire(a, 'boiteEstAdmin()')), 'false');
  verif('compte élève : n\'est pas dans la liste des admins', String(lire(a, 'boiteEmailAdmin(boiteSession())')), 'false');
  reglerSommeil(a);
  const reglage = sommeil(a);
  await envoyer(a); await attendre(300); figer(a);
  verif('compte élève : le nuage reçoit le réglage', [nuageSommeil(nuage).weekdaySleepHours, nuageSommeil(nuage).weekdayWakeup], [7.5, '06:45']);
  const a1 = nouvelAppareilAJour(nuage, Object.assign({}, a.__store), 1);
  await attendre(4000); figer(a1);
  verif('compte élève : réouverture le lendemain garde le réglage', sommeil(a1), reglage);
  const b = nouvelAppareil(nuage, {});
  lire(b, "setSleepHours('weekday', 8); weekdayWakeup = '06:00'; memoireSauvegarder();");
  await connecter(b);
  verif('compte élève : un second téléphone reçoit le réglage', sommeil(b), reglage);
}

(async function main() {
  await scenarioCompteNonAdmin();
  await scenarioSommeil();
  await scenarioSommeilBase();
  await scenarioSommeilLocalDeBase();
  await scenarioSommeilReouverture();
  await scenarioSommeilChoixLocalPlusRecent();
  const ok = verifs.filter(Boolean).length;
  console.log('TEST_OK ' + ok + '/' + verifs.length);
  process.exit(ok === verifs.length ? 0 : 1);
})();
