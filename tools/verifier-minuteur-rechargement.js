/* Vérifie que le minuteur de concentration survit à un rechargement de la page.

   Le test charge le vrai fichier js/pages/pomodoro-page.js dans un contexte vm,
   avec une horloge simulée et un stockage local qui reste d'un « chargement »
   à l'autre (comme le navigateur après un rechargement).

   Cas couverts :
   1. Chrono en cours : après rechargement, il continue et ne repart pas à zéro.
   2. Chrono en pause : le temps restant est retrouvé.
   3. Fin de phase pendant que la page était fermée : la pause est proposée,
      sans annonce vocale, et le cycle est compté.
   4. Sauvegarde d'un autre jour : écartée, les cycles repartent à zéro.
   5. Les cycles sont gardés d'un rechargement à l'autre (la pause longue arrive bien).
   6. Un chargement sans ouvrir la page n'écrase pas la sauvegarde.
   7. Une fin de phase pendant que la page est ouverte annonce toujours la pause. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'js/pages/pomodoro-page.js'), 'utf8');
const echecs = [];
let verifications = 0;
function ok(cond, message) {
  verifications++;
  if (!cond) echecs.push(message);
}

/* Horloge et stockage partagés entre les « chargements » de la page. */
function nouveauMonde(init) {
  const monde = { now: new Date(2026, 10, 3, 10, 0, 0).getTime(), store: Object.assign({}, init || {}), annonces: [], intervalles: 0 };
  return monde;
}

function chargerPage(monde) {
  const store = monde.store;
  const ls = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const elementFactice = () => ({
    value: '', textContent: '', innerHTML: '', style: {}, dataset: {}, hidden: false, disabled: false, childNodes: [], children: [], offsetWidth: 0, naturalWidth: 0,
    classList: { add() {}, remove() {}, toggle() {}, contains(c) { return c === 'active'; } },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; }, focus() {}, blur() {},
    getContext() { return null; }, play() { return Promise.resolve(); }, pause() {}, load() {},
  });
  const document = {
    readyState: 'complete', title: 'Studyplan', body: elementFactice(),
    getElementById: () => elementFactice(), querySelector: () => null, querySelectorAll: () => [],
    createElement: elementFactice, addEventListener() {}, removeEventListener() {},
    documentElement: elementFactice(),
  };
  class Horloge extends Date {
    constructor(...args) { if (args.length) super(...args); else super(monde.now); }
    static now() { return monde.now; }
  }
  const ctx = {
    console, setTimeout: () => 0, clearTimeout() {}, Date: Horloge, Math, JSON, Promise, Object, Array, String, Number, Boolean, RegExp, Error,
    localStorage: ls, sessionStorage: ls, document, navigator: { onLine: true, userAgent: 'test' },
    location: { hash: '', href: 'https://test/', search: '', pathname: '/' },
    history: { replaceState() {}, pushState() {} },
    addEventListener() {}, removeEventListener() {}, requestAnimationFrame: () => 0,
    Image: function () { return elementFactice(); },
    alert() {}, confirm: () => true, prompt: () => null,
    setInterval: () => { monde.intervalles++; return monde.intervalles; }, clearInterval() {},
    /* les annonces vocales sont notées, pour vérifier qu'elles sont (ou non) faites */
    chronoAnnoncerPause: m => monde.annonces.push('pause ' + m),
    chronoAnnoncerReprise: () => monde.annonces.push('reprise'),
    chronoRendreMusique() {}, chronoVoixPreparer() {}, chronoChargerReglagesVoix() {},
    navigateTo() {}, memoireAller() {},
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx, { filename: 'js/pages/pomodoro-page.js' });
  return ctx;
}

/* Un rechargement : on relit la page, puis on ouvre le minuteur comme le fait le menu. */
function rouvrir(monde) {
  const ctx = chargerPage(monde);
  ctx.focusCharger();
  return ctx;
}

function minutes(sec) { return Math.round(sec / 60); }

/* ── 1. Chrono en cours : continue après rechargement ── */
{
  const monde = nouveauMonde();
  const ctx = rouvrir(monde);
  ctx.focusBasculer();                       // démarrage des 25 minutes
  ok(ctx.focusEtat.running === true, '1 : le chrono doit démarrer');
  monde.now += 5 * 60 * 1000;                // 5 minutes passent
  ctx.focusTick();
  const avant = ctx.focusEtat.restant;
  const ctx2 = rouvrir(monde);               // rechargement
  ok(ctx2.focusEtat.running === true, '1 : après rechargement, le chrono doit continuer');
  ok(ctx2.focusEtat.mode === 'focus', '1 : le mode concentration doit être gardé');
  ok(Math.abs(ctx2.focusEtat.restant - (avant)) <= 1, '1 : le temps restant doit être celui d\'avant (20 min environ), pas 25 : ' + ctx2.focusEtat.restant);
  ok(minutes(ctx2.focusEtat.restant) === 20, '1 : environ 20 minutes doivent rester : ' + minutes(ctx2.focusEtat.restant));
  ok(monde.intervalles >= 2, '1 : le compte à rebours doit repartir après rechargement');
  monde.now += 60 * 1000;
  ctx2.focusTick();
  ok(ctx2.focusEtat.restant === 19 * 60, '1 : après une minute de plus, il doit rester 19 minutes : ' + ctx2.focusEtat.restant);
}

/* ── 2. Chrono en pause : le temps restant est retrouvé ── */
{
  const monde = nouveauMonde();
  const ctx = rouvrir(monde);
  ctx.focusBasculer();
  monde.now += 15 * 60 * 1000;
  ctx.focusTick();
  ctx.focusBasculer();                       // pause
  ok(ctx.focusEtat.running === false, '2 : la pause doit arrêter le chrono');
  const restant = ctx.focusEtat.restant;
  monde.now += 60 * 60 * 1000;               // une heure de pause hors de la page
  const ctx2 = rouvrir(monde);
  ok(ctx2.focusEtat.running === false, '2 : après rechargement, le chrono reste en pause');
  ok(ctx2.focusEtat.restant === restant, '2 : le temps restant doit être retrouvé (' + restant + ' s), reçu ' + ctx2.focusEtat.restant);
  ok(monde.annonces.length === 0, '2 : aucune annonce ne doit être faite au rechargement');
}

/* ── 3. Fin de phase pendant que la page était fermée ── */
{
  const monde = nouveauMonde();
  const ctx = rouvrir(monde);
  ctx.focusBasculer();
  monde.now += 30 * 60 * 1000;               // les 25 minutes sont passées, page fermée
  const ctx2 = rouvrir(monde);
  ok(ctx2.focusEtat.running === false, '3 : la phase terminée ne doit pas tourner toute seule');
  ok(ctx2.focusEtat.mode === 'short', '3 : la pause courte doit être proposée : ' + ctx2.focusEtat.mode);
  ok(ctx2.focusEtat.restant === 5 * 60, '3 : la pause proposée doit avoir sa durée (5 min) : ' + ctx2.focusEtat.restant);
  ok(ctx2.focusEtat.cycles === 1, '3 : le cycle terminé doit être compté : ' + ctx2.focusEtat.cycles);
  ok(monde.annonces.length === 0, '3 : pas d\'annonce vocale au rattrapage : ' + monde.annonces.join(','));
}

/* ── 4. Sauvegarde d'un autre jour : écartée ── */
{
  const monde = nouveauMonde();
  const ctx = rouvrir(monde);
  ctx.focusBasculer();
  ctx.focusPhaseSuivante();                  // une concentration finie : cycle 1
  ok(ctx.focusEtat.cycles === 1, '4 : préparation, cycle 1 attendu');
  monde.now += 24 * 60 * 60 * 1000;          // le lendemain
  const ctx2 = rouvrir(monde);
  ok(ctx2.focusEtat.cycles === 0, '4 : le lendemain les cycles doivent repartir à zéro : ' + ctx2.focusEtat.cycles);
  ok(ctx2.focusEtat.mode === 'focus' && ctx2.focusEtat.running === false, '4 : le lendemain, le minuteur revient en concentration à l\'arrêt');
  ok(ctx2.focusEtat.restant === 25 * 60, '4 : le lendemain, la durée est celle des réglages : ' + ctx2.focusEtat.restant);
}

/* ── 5. Les cycles survivent au rechargement : la pause longue arrive ── */
{
  const monde = nouveauMonde();
  let ctx = rouvrir(monde);
  for (let i = 0; i < 3; i++) {
    ctx.focusPhaseSuivante();                // concentration finie
    ctx.focusPhaseSuivante();                // pause finie, concentration proposée
  }
  ok(ctx.focusEtat.cycles === 3, '5 : trois cycles attendus avant rechargement : ' + ctx.focusEtat.cycles);
  monde.now += 10 * 60 * 1000;
  ctx = rouvrir(monde);
  ok(ctx.focusEtat.cycles === 3, '5 : les 3 cycles doivent survivre au rechargement : ' + ctx.focusEtat.cycles);
  ctx.focusPhaseSuivante();                  // quatrième concentration finie
  ok(ctx.focusEtat.mode === 'long', '5 : la quatrième concentration doit proposer la pause longue : ' + ctx.focusEtat.mode);
}

/* ── 6. Un chargement sans ouvrir la page n'écrase pas la sauvegarde ── */
{
  const monde = nouveauMonde();
  const ctx = rouvrir(monde);
  ctx.focusBasculer();
  monde.now += 2 * 60 * 1000;
  ctx.focusTick();
  const sauvegarde = monde.store.studyPlanIB_focusEtat;
  ok(typeof sauvegarde === 'string', '6 : la sauvegarde doit exister');
  chargerPage(monde);                        // la page est relue mais pas ouverte
  ok(monde.store.studyPlanIB_focusEtat === sauvegarde, '6 : la sauvegarde ne doit pas être écrasée à la lecture de la page');
}

/* ── 7. Fin de phase pendant que la page est ouverte : la pause est annoncée ── */
{
  const monde = nouveauMonde();
  const ctx = rouvrir(monde);
  ctx.focusBasculer();
  monde.now += 25 * 60 * 1000;
  ctx.focusTick();
  ok(ctx.focusEtat.mode === 'short' && ctx.focusEtat.running === false, '7 : la fin de la concentration doit proposer la pause');
  ok(monde.annonces.length === 1 && monde.annonces[0] === 'pause 5', '7 : la pause doit être annoncée une fois : ' + monde.annonces.join(','));
}

if (echecs.length) {
  console.log('Minuteur après rechargement : ' + echecs.length + ' échec(s) sur ' + verifications);
  echecs.forEach(e => console.log(' - ' + e));
  process.exit(1);
}
console.log('Minuteur après rechargement : ' + verifications + '/' + verifications + ' vérifications OK');
