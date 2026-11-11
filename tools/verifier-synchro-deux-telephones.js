/* Vérifie que l'emploi du temps reste identique sur deux téléphones du même compte, et que tout
   changement fait sur l'un arrive sur l'autre automatiquement :
   - sans rechargement, quand les deux téléphones sont ouverts (écoute en direct du nuage) ;
   - au rechargement, quand l'autre téléphone a changé pendant que celui-ci était fermé ;
   - une suppression (activité ou cours) ne revient pas ;
   - un téléphone qui reçoit une copie ne la renvoie pas (pas de va-et-vient) ;
   - un téléphone qui a une modification non envoyée la garde.

   Le test charge les vrais fichiers de l'application (même ordre que js/registre.js), avec un faux
   Firestore partagé qui prévient les écoutes comme le fait Firestore. Les gestes sont ceux de
   l'interface : on modifie la liste des cours ou des activités, puis on sauvegarde. */
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
  const listeners = {};
  const ctx = {
    console, setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {}, Date, Math, JSON, Promise, Object, Array, String, Number, Boolean,
    RegExp, Error, Set, Map, URL, Intl, Symbol, Uint8Array, ArrayBuffer, Buffer,
    localStorage: ls, sessionStorage: ls, document, navigator: { onLine: true, userAgent: 'test' },
    location: { hash: '', href: 'https://test/', search: '', pathname: '/' }, history: { replaceState() {}, pushState() {} },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); }, removeEventListener() {}, requestAnimationFrame: () => 0, fetch: () => Promise.reject(new Error('reseau coupe')),
    alert() {}, confirm: () => true, prompt: () => null, getComputedStyle: () => ({}), atob: b => Buffer.from(b, 'base64').toString('binary'),
    btoa: b => Buffer.from(b, 'binary').toString('base64'), TextEncoder, TextDecoder,
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx; ctx.__store = store;
  ctx.__evenement = type => (listeners[type] || []).forEach(fn => fn({ type }));
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
/* Envoi immédiat pour les scénarios qui ne testent pas le délai automatique. */
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

(async () => {
  process.chdir(ROOT);
  const nuage = creerNuage();

  /* Appareil A : premier téléphone, profil envoyé. */
  let a = nouvelAppareil(nuage, {});
  a.compteOnCredential({ credential });
  await attendre(2500);
  a.compteSession = { sub: SUB, email: EMAIL, name: 'Sere Farid' }; a.memoirePret = true;
  a.memoireAppliquer(FULL, { compte: true }); a.memoireSauvegarder();
  await envoyer(a); await attendre(800);

  /* Appareil B : second téléphone, même compte, connexion. */
  let b = nouvelAppareil(nuage, {});
  b.compteOnCredential({ credential });
  await attendre(3500);
  figer(b);
  verif('0 les deux téléphones ont le même emploi après connexion', memes(a, b), true);

  /* ── 1. En direct : A ajoute un cours, B (ouvert, sans rechargement) le reçoit ── */
  await ouvrirEnDirect(a, nuage); await ouvrirEnDirect(b, nuage);
  ajouterCours(a, ev('c9', 3, '14:00', '15:00', 'Physique', 'course'));
  await envoyer(a); await attendre(800);
  verif('1 en direct : le cours ajouté sur A apparaît sur B sans rechargement', emploi(b).cours.some(x => x[4] === 'Physique'), true);
  verif('1b en direct : B identique à A', memes(a, b), true);

  /* ── 2. En direct : B retire une activité, A le reçoit sans rechargement ── */
  retirerActivite(b, 'Piano');
  await envoyer(b); await attendre(800);
  verif('2 en direct : Piano retiré sur B disparaît sur A', emploi(a).activites.map(x => x[0]), ['Natation']);
  verif('2b en direct : A identique à B', memes(a, b), true);

  /* ── 3. Pas de va-et-vient : après réception, plus aucune écriture ── */
  const avantSilence = nuage.journal.length;
  await attendre(3000);
  verif('3 pas de renvoi après réception (aucune écriture en 3 s)', nuage.journal.length - avantSilence, 0);

  /* ── 4. En direct : B déplace Natation, A le reçoit ── */
  deplacerActivite(b, 'Natation', '16:00', '17:00');
  await envoyer(b); await attendre(800);
  verif('4 en direct : déplacement d\'une activité reçu sur A', emploi(a).activites, [['Natation', '16:00', '17:00']]);
  verif('4b en direct : A identique à B', memes(a, b), true);

  /* ── 5. Rechargement : A fermé, B change, A rouvert reprend le changement ── */
  retirerCours(b, 'c9');
  await envoyer(b); await attendre(500);
  a = await recharger(a, nuage);
  verif('5 rechargement de A : le cours retiré sur B n\'est plus sur A', emploi(a).cours.some(x => x[4] === 'Physique'), false);
  verif('5b rechargement de A : A identique à B', memes(a, b), true);

  /* ── 6. Rechargement de B après un ajout sur A pendant que B était fermé ── */
  ajouterCours(a, ev('c10', 4, '10:00', '11:00', 'Histoire-A', 'course'));
  await envoyer(a); await attendre(500);
  b = await recharger(b, nuage);
  verif('6 rechargement de B : le cours ajouté sur A est là', emploi(b).cours.some(x => x[4] === 'Histoire-A'), true);
  verif('6b rechargement de B : B identique à A', memes(a, b), true);

  /* ── 7. Une suppression ne revient pas : Piano retiré reste retiré après rechargements ── */
  a = await recharger(a, nuage);
  b = await recharger(b, nuage);
  verif('7 après deux rechargements, Piano n\'est pas revenu', emploi(b).activites.map(x => x[0]), ['Natation']);
  verif('7b après deux rechargements, les deux téléphones sont identiques', memes(a, b), true);

  /* ── 8. En direct dans les deux sens, à la suite ── */
  await ouvrirEnDirect(a, nuage); await ouvrirEnDirect(b, nuage);
  ajouterCours(b, ev('c11', 5, '18:00', '19:00', 'Sport-B', 'course'));
  await envoyer(b); await attendre(800);
  ajouterCours(a, ev('c12', 6, '09:00', '10:00', 'Lecture-A', 'course'));
  await envoyer(a); await attendre(800);
  verif('8 en direct dans les deux sens : B a reçu Lecture-A', emploi(b).cours.some(x => x[4] === 'Lecture-A'), true);
  verif('8b en direct dans les deux sens : A a reçu Sport-B', emploi(a).cours.some(x => x[4] === 'Sport-B'), true);
  verif('8c en direct dans les deux sens : emplois identiques', memes(a, b), true);

  /* ── 9. Modification non envoyée : elle reste si une copie arrive pendant l'attente ── */
  ajouterCours(b, ev('c13', 0, '07:00', '07:30', 'Brouillon-B', 'course'));   /* non envoyée (timer de regroupement) */
  ajouterCours(a, ev('c14', 2, '13:00', '14:00', 'Atelier-A', 'course'));
  await envoyer(a); await attendre(300);
  verif('9 modification non envoyée de B conservée pendant l\'arrivée d\'une copie', emploi(b).cours.some(x => x[4] === 'Brouillon-B'), true);

  /* Fin : le nuage et les deux téléphones doivent concorder après un dernier envoi de B. */
  await envoyer(b); await attendre(800);
  verif('10 après envoi, A et B identiques', memes(a, b), true);
  verif('10b modification de A conservée malgré la modification non envoyée de B', emploi(b).cours.some(x => x[4] === 'Atelier-A'), true);
  verif('10c modification locale de B conservée', emploi(b).cours.some(x => x[4] === 'Brouillon-B'), true);

  /* ── 11. Le nuage contient exactement l'emploi envoyé ── */
  const enNuage = JSON.parse(nuage.docs['progressions/UID-FARID'].progression);
  verif('11 le nuage porte les cours de l\'emploi', enNuage.customEvents.map(x => x.title).sort().join(','),
    emploi(b).cours.map(x => x[4]).sort().join(','));

  /* Suppression concurrente avec un ajout sur l'autre appareil. */
  ajouterCours(b, ev('c15', 4, '11:00', '12:00', 'Ajout-hors-ligne', 'course'));
  retirerActivite(a, 'Natation');
  await envoyer(a); await attendre(300); await envoyer(b); await attendre(800);
  verif('12 suppression concurrente : l’activité ne revient pas', emploi(b).activites.some(x => x[0] === 'Natation'), false);
  verif('12b ajout concurrent préservé', emploi(a).cours.some(x => x[4] === 'Ajout-hors-ligne'), true);

  /* Ré-ajouter explicitement une activité reste possible après suppression. */
  geste(b, `selectedActivities.push({ name: 'Natation', days: [1], startTime: '15:00', endTime: '16:00' }); memoireSauvegarder();`);
  await envoyer(b); await attendre(800);
  verif('13 activité réajoutée explicitement', emploi(a).activites.some(x => x[0] === 'Natation'), true);

  /* Deux écritures simultanées sont fusionnées atomiquement. */
  ajouterCours(a, ev('c16', 0, '10:00', '11:00', 'Simultané-A', 'course'));
  ajouterCours(b, ev('c17', 0, '11:00', '12:00', 'Simultané-B', 'course'));
  const avantReprises = nuage.db.transactionRetries;
  await Promise.all([envoyer(a), envoyer(b)]); await attendre(1000);
  verif('14 une transaction concurrente est relue après conflit', nuage.db.transactionRetries > avantReprises, true);
  verif('14 les deux écritures simultanées sont conservées', ['Simultané-A', 'Simultané-B'].every(t => emploi(a).cours.some(x => x[4] === t)), true);
  verif('14b appareils convergents', memes(a, b), true);

  /* L'élève écrit encore pendant que sa transaction attend le réseau. */
  const transaction = nuage.db.runTransaction;
  let debloquer;
  nuage.db.runTransaction = fn => new Promise(resolve => { debloquer = resolve; }).then(() => transaction(fn));
  ajouterCours(b, ev('c18', 0, '12:00', '13:00', 'Avant-réseau', 'course'));
  const envoiAttente = envoyer(b);
  await attendre(30);
  ajouterCours(b, ev('c19', 0, '13:00', '14:00', 'Pendant-réseau', 'course'));
  nuage.db.runTransaction = transaction; debloquer();
  await envoiAttente; await envoyer(b); await attendre(800);
  verif('15 modification pendant transaction conservée sur les deux appareils', ['Avant-réseau', 'Pendant-réseau'].every(t => emploi(a).cours.some(x => x[4] === t) && emploi(b).cours.some(x => x[4] === t)), true);

  /* Échec réseau : rien n'est marqué envoyé ; une nouvelle tentative reprend. */
  nuage.db.runTransaction = () => Promise.reject(new Error('réseau indisponible (test)'));
  ajouterCours(b, ev('c20', 0, '14:00', '15:00', 'Hors-ligne', 'course'));
  await envoyer(b);
  verif('16 échec réseau : modification gardée localement', emploi(b).cours.some(x => x[4] === 'Hors-ligne'), true);
  nuage.db.runTransaction = transaction; b.__evenement('online'); await attendre(4000);
  verif('16b nouvelle tentative au retour du réseau : modification reçue sur A', emploi(a).cours.some(x => x[4] === 'Hors-ligne'), true);

  /* Reconnexion du même compte avec un travail non envoyé. */
  ajouterCours(b, ev('c21', 0, '15:00', '16:00', 'Avant-reconnexion', 'course'));
  figer(b); b.compteOnCredential({ credential }); await attendre(3500); figer(b);
  verif('17 reconnexion : travail local non envoyé conservé', emploi(b).cours.some(x => x[4] === 'Avant-reconnexion'), true);
  await envoyer(b); await attendre(800);
  verif('17b reconnexion : travail publié et reçu', emploi(a).cours.some(x => x[4] === 'Avant-reconnexion'), true);

  /* Une sauvegarde illisible sur le serveur ne doit jamais être écrasée. */
  const sauvegardeNuage = nuage.docs['progressions/UID-FARID'].progression;
  nuage.docs['progressions/UID-FARID'].progression = '{invalide';
  ajouterCours(b, ev('c22', 0, '16:00', '17:00', 'Après-erreur', 'course'));
  await envoyer(b);
  verif('18 sauvegarde distante illisible : pas d’écrasement', nuage.docs['progressions/UID-FARID'].progression, '{invalide');
  verif('18b modification conservée localement', emploi(b).cours.some(x => x[4] === 'Après-erreur'), true);
  nuage.docs['progressions/UID-FARID'].progression = sauvegardeNuage;
  await envoyer(b); await attendre(800);
  verif('18c après correction, modification transmise', emploi(a).cours.some(x => x[4] === 'Après-erreur'), true);

  /* Les paramètres du minuteur seuls déclenchent une sauvegarde : citation
     personnelle incluse, sans attendre une autre modification du planning. */
  geste(b, `focusEcrireReglages({ citation: true, citationCategorie: 'personnelle', citationPersonnelle: 'Avance à ton rythme' });`);
  await attendre(4500);
  verif('19 citation personnelle seule synchronisée dans le nuage', JSON.parse(nuage.docs['progressions/UID-FARID'].progression).focusReglages.parametres.citationPersonnelle, 'Avance à ton rythme');
  verif('19b citation personnelle reçue par l’autre appareil', a.focusLireReglages().citationPersonnelle, 'Avance à ton rythme');

  /* Le vrai déclenchement automatique : pas d'appel direct à envoyer().
     Le nuage simulé livre les écoutes en 20 ms ; ce test mesure donc surtout
     l'attente ajoutée par l'application, pas la latence d'un réseau réel. */
  figer(a); figer(b);
  const setTimeoutOriginal = a.setTimeout;
  const delaisAutomatiques = [];
  a.setTimeout = (fn, ms, ...args) => { delaisAutomatiques.push(ms); return setTimeoutOriginal(fn, ms, ...args); };
  const debutAuto = Date.now();
  const progressionAvant = nuage.journal.filter(x => x.c === 'progressions').length;
  ajouterCours(a, ev('latence-1', 1, '12:00', '12:30', 'Auto-A1', 'course'));
  await attendre(150);
  ajouterCours(a, ev('latence-2', 1, '12:30', '13:00', 'Auto-A2', 'course'));
  verif('20 le regroupement évite une écriture immédiate', nuage.journal.filter(x => x.c === 'progressions').length - progressionAvant, 0);
  while (Date.now() - debutAuto < 3700 && !['Auto-A1', 'Auto-A2'].every(t => emploi(b).cours.some(x => x[4] === t))) await attendre(50);
  const delaiAuto = Date.now() - debutAuto;
  verif('20b les deux changements arrivent automatiquement sur B en moins de 3,7 s (nuage simulé)',
    ['Auto-A1', 'Auto-A2'].every(t => emploi(b).cours.some(x => x[4] === t)) && delaiAuto < 3700, true);
  verif('20d délai de regroupement fixé à 2,5 s', delaisAutomatiques.includes(2500), true);
  a.setTimeout = setTimeoutOriginal;
  console.log('Délai automatique A → B (nuage simulé) : ' + delaiAuto + ' ms');
  verif('20c les gestes rapprochés sont regroupés en une écriture de progression', nuage.journal.filter(x => x.c === 'progressions').length - progressionAvant, 1);

  // Deux appareils modifient à la fois sans forcer l'envoi : les deux
  // changements doivent converger malgré le délai plus court.
  figer(a); figer(b);
  ajouterCours(a, ev('auto-concurrent-a', 2, '18:00', '18:30', 'Auto-concurrent-A', 'course'));
  ajouterCours(b, ev('auto-concurrent-b', 2, '18:30', '19:00', 'Auto-concurrent-B', 'course'));
  const debutConcurrence = Date.now();
  while (Date.now() - debutConcurrence < 6000 && ![a, b].every(c => ['Auto-concurrent-A', 'Auto-concurrent-B'].every(t => emploi(c).cours.some(x => x[4] === t)))) await attendre(50);
  verif('21 les envois automatiques simultanés préservent les deux ajouts',
    [a, b].every(c => ['Auto-concurrent-A', 'Auto-concurrent-B'].every(t => emploi(c).cours.some(x => x[4] === t))), true);
  verif('21b convergence des deux appareils après envois automatiques', memes(a, b), true);
  /* Laisser se terminer les éventuelles reprises dues à la concurrence. */
  await attendre(4000);
  const ecrituresAvantSilence = nuage.journal.filter(x => x.c === 'progressions').length;
  await attendre(4000);
  verif('21c aucune boucle de renvoi après les envois automatiques',
    nuage.journal.filter(x => x.c === 'progressions').length - ecrituresAvantSilence, 0);

  /* Statistiques réelles du minuteur : événements simultanés et retrait
     réversible d'une tâche, sans additionner deux fois un même événement. */
  geste(b, 'selectDay(0)');
  geste(a, "statsEnregistrer({k:'focus',m:25}); statsEnregistrer({k:'tache',id:'tache-partagee'});");
  geste(b, "statsEnregistrer({k:'focus',m:40});");
  let limite = Date.now() + 6000;
  while (Date.now() < limite && ![a,b].every(c => c.statsLire().filter(e => e.k === 'focus').length === 2 && c.statsLire().some(e => e.k === 'tache'))) await attendre(50);
  for (const [nom, c] of [['A',a],['B',b]]) {
    verif('22 ' + nom + ' reçoit les deux concentrations sans doublon', c.statsLire().filter(e => e.k === 'focus').map(e => e.m).sort((x,y)=>x-y), [25,40]);
    verif('22 ' + nom + ' reçoit la tâche cochée', c.statsLire().filter(e => e.k === 'tache').length, 1);
  }
  verif('22b jour choisi sur B conservé pendant la réception', geste(b, 'selectedDay'), 0);
  const copieAvantRetrait = JSON.parse(JSON.stringify(b.syncStatsLire()));
  geste(b, "statsRetirerTache('tache-partagee');");
  limite = Date.now() + 6000;
  while (Date.now() < limite && a.statsLire().some(e => e.k === 'tache')) await attendre(50);
  verif('23 tâche décochée disparaît sur A', a.statsLire().filter(e => e.k === 'tache').length, 0);
  a = await recharger(a, nuage);
  verif('23b la tâche ne revient pas au rechargement', a.statsLire().filter(e => e.k === 'tache').length, 0);
  verif('23c les deux concentrations persistent au rechargement', a.statsLire().filter(e => e.k === 'focus').map(e => e.m).sort((x,y)=>x-y), [25,40]);
  const ancienneFusionnee = a.syncStatsFusionner([copieAvantRetrait, a.syncStatsLire()]);
  verif('23d une ancienne copie hors ligne ne ressuscite pas la coche', ancienneFusionnee.filter(e => e.k === 'tache' && !e.supprime).length, 0);
  const historiqueCharge = Array.from({length: 6000}, (_, i) => ({u: 'test-' + String(i).padStart(5, '0'), k: 'focus', d: '2026-11-04', s: 'x'.repeat(60), m: 25}));
  const exportLimite = a.syncStatsPourCompte(historiqueCharge);
  verif('24 export des statistiques borné à 200 ko', Buffer.byteLength(JSON.stringify(exportLimite), 'utf8') <= 200000, true);
  verif('24b export conserve les événements récents', exportLimite[exportLimite.length - 1].u, 'test-05999');

  /* Le journal précédent est archivé avant de changer de compte, mais ne
     doit pas être offert à un élève différent sur cet appareil. */
  figer(b);
  const nouvelEleve = {sub: 'AUTRE-ELEVE-456', email: 'autre@example.org', name: 'Autre'};
  await b.compteRestaurerTout(nouvelEleve, '', [], {});
  verif('25 le changement de compte isole les statistiques de l’ancien élève', b.statsLire().length, 0);
  verif('25b les statistiques restent archivées pour le premier compte',
    !!(b.compteLireArchive(SUB) && b.compteLireArchive(SUB).statsFocus && b.compteLireArchive(SUB).statsFocus.length), true);


  /* ── Aucune écriture de test vers Firestore réel : tout est dans le faux nuage ── */
  const tout = verifs.every(Boolean);
  console.log(tout ? 'TEST_OK ' + verifs.length + '/' + verifs.length : 'TEST_ECHEC ' + verifs.filter(x => !x).length + ' échec(s) sur ' + verifs.length);
  process.exit(tout ? 0 : 1);
})().catch(err => { console.log('ERREUR', err.stack); process.exit(2); });
