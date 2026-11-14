/* Vérifie la page « Mes Exercices » : ses styles existent vraiment, la page
   n'est jamais vide, et la feuille dédiée ne peut plus être avalée par une
   déclaration cassée comme « / * … » dans planning-panels.css.

   Aucun navigateur nécessaire : on lit les fichiers et on rejoue le rendu
   de la liste avec les vrais scripts de la page. */
var fs = require('fs');
var path = require('path');

var echecs = [];
function ok(cond, message) {
    if (!cond) echecs.push(message);
}
function lire(rel) {
    return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

var page = lire('pages/exercices.html');
var js = lire('js/pages/exercices.js');
var css = lire('css/pages/exercices.css');
var ancien = lire('css/pages/planning-panels.css');
var index = lire('index.html');
var sw = lire('service-worker.js');
var bundle = lire('tools/bundle-site.py');

/* ── 1. Le CSS ne contient plus de commentaire cassé ──────────────────
   « / * » n'ouvre pas un commentaire : le navigateur lit alors
   « / étoile … étoile / » comme un sélecteur, avale la règle suivante, puis reprend
   l'analyse et perd plusieurs blocs. C'était la cause de la page vide. */
ok(css.indexOf('/ *') === -1, 'exercices.css ne doit contenir aucun commentaire cassé (barre oblique puis étoile séparées)');
ok(ancien.indexOf('/ *') === -1, 'planning-panels.css ne doit plus contenir de commentaire cassé');
/* Chaque commentaire ouvert se referme : on compte ouverts et fermés. */
ok((css.match(/\/\*/g) || []).length === (css.match(/\*\//g) || []).length,
    'chaque commentaire de exercices.css doit être refermé');

/* Les accolades restent équilibrées : une règle non refermée masque la suite. */
ok((css.match(/{/g) || []).length === (css.match(/}/g) || []).length, 'accolades équilibrées dans exercices.css');

/* ── 2. La feuille dédiée est réellement branchée ─────────────────────
   Chargée après planning-panels.css, sinon les anciennes règles gagnent. */
ok(index.indexOf('css/pages/exercices.css') !== -1, 'index.html doit charger css/pages/exercices.css');
ok(index.indexOf('css/pages/exercices.css') > index.indexOf('css/pages/planning-panels.css'),
    'exercices.css doit être chargé après planning-panels.css');
ok(sw.indexOf('"css/pages/exercices.css"') !== -1, 'la feuille doit entrer dans la coquille hors-ligne');
ok(bundle.indexOf('"css/pages/exercices.css"') !== -1, 'la feuille doit entrer dans le bundle');

/* ── 3. Le panneau garde son plein écran et son défilement ────────────
   Sur un téléphone, un panneau qui ne défile pas coupe la liste. */
ok(/\.exo-page\s*{[^}]*position:\s*fixed/.test(css), 'le panneau doit rester plein écran');
ok(/#panelExercices\.exo-page[^{]*{[^}]*overflow-y:\s*auto/.test(css), 'la page doit défiler (une seule barre)');

/* ── 4. Les éléments de la page ont tous un style ────────────────────
   C'est ce qui manquait : la page s'affichait sans mise en forme. */
[
    '.exo-header', '.exo-header-inner', '.exo-back-btn', '.exo-title', '.exo-subtitle',
    '.exo-badge', '.exo-tabs', '.exo-tab', '.exo-tab.active', '.exo-tabpanel',
    '.exo-card', '.exo-label', '.exo-subject-grid', '.exo-sujet', '.exo-sujet.selectionne',
    '.exo-dropzone', '.exo-divider', '.exo-textarea', '.exo-input', '.exo-preset',
    '.exo-preset.active', '.exo-slider', '.exo-btn-add', '.exo-btn-clear',
    '.exo-filters', '.exo-filter', '.exo-filter.active', '.exo-list-container',
    '.exo-liste-carte', '.exo-liste-tete', '.exo-liste-matiere', '.exo-liste-note',
    '.exo-liste-bouton', '.exo-chip', '.exo-empty', '.exo-empty-icon',
    '.exo-empty-title', '.exo-empty-text', '.exo-empty-action', '.exo-resume',
    '.exo-resume-barre', '.exo-resume-plan'
].forEach(function (selecteur) {
    ok(css.indexOf(selecteur + ' ') !== -1 || css.indexOf(selecteur + ',') !== -1 || css.indexOf(selecteur + ':') !== -1 ||
        css.indexOf(selecteur + '{') !== -1 || new RegExp(selecteur.replace('.', '\\.') + '\\s*[,{]').test(css),
        'style manquant pour ' + selecteur);
});

/* Aucune couleur violette : la charte reste verte. */
ok(!/#(8b5cf6|a855f7|7c3aed|6d28d9|9333ea)/i.test(css), 'la page ne doit pas reprendre du violet');

/* ── 5. La page ne peut plus être vide ───────────────────────────────
   Le squelette de la page doit contenir les trois onglets, un état vide
   utile et la barre de progression. */
['tabContentAjouter', 'tabContentListe', 'tabContentPlanifier', 'exoSubjectGrid',
 'exoTextInput', 'exoDurationSlider', 'exoDeadline', 'exoListContainer',
 'planifierContent', 'exoCountBadge', 'exoResume', 'exoResumeBarre'].forEach(function (id) {
    ok(page.indexOf('id="' + id + '"') !== -1, 'la page doit garder ' + id);
});
ok(page.indexOf('class="exo-empty-action"') !== -1, 'l’onglet vide doit proposer une action, pas seulement du texte');

/* ── 6. Le rendu de la liste, rejoué pour de vrai ────────────────────
   Un exercice en retard, un planifié, un fait : la carte doit afficher la
   matière, la note, les étiquettes et les deux actions. */
function fauxElement(id) {
    return {
        id: id, value: '', textContent: '', innerHTML: '', style: {}, attrs: {}, hidden: false, children: [],
        classList: { valeurs: [], add(c) { if (!this.valeurs.includes(c)) this.valeurs.push(c); },
            remove(c) { this.valeurs = this.valeurs.filter(v => v !== c); },
            contains(c) { return this.valeurs.includes(c); },
            toggle(c, f) { var on = f === undefined ? !this.contains(c) : !!f; if (on) this.add(c); else this.remove(c); return on; } },
        setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
        removeAttribute(k) { delete this.attrs[k]; }, focus() {}, append() {}, replaceChildren() {},
        querySelector() { return null; }, addEventListener() {}
    };
}
var elements = {};
var valeurs = {};
var exercicesPage = [{ id: 'e1', subject: 'Chimie', subjectIcon: '⚗️', text: 'Ex p.47', duration: 45,
        deadline: '2000-01-01', done: false },
    { id: 'e2', subject: 'Physique', subjectIcon: '⚛️', text: 'TP', duration: 60,
        deadline: '2099-01-01', done: false, scheduledSlot: 'lun. 9 nov. · 17:00 – 18:00 (60 min)' },
    { id: 'e3', subject: 'Français B', subjectIcon: '🇫🇷', text: 'Commentaire', duration: 60,
        deadline: '2099-01-01', done: true }];
var vm = require('vm');
var contexte = vm.createContext({
    console: console, Date: Date, Math: Math, JSON: JSON, String: String, Number: Number,
    document: {
        getElementById: function (id) { return elements[id] || (elements[id] = fauxElement(id)); },
        querySelector: function () { return null; }, querySelectorAll: function () { return []; },
        createElement: function () { return fauxElement('cree'); }, body: { appendChild() {} }
    },
    localStorage: { getItem: function (k) { return valeurs[k] || null; }, setItem: function (k, v) { valeurs[k] = v; }, removeItem: function (k) { delete valeurs[k]; } },
    subjects: [{ name: 'Chimie', icon: '⚗️' }], optionalSubjects: [], ibYear: 'DP1',
    iconeHtml: function (i) { return i || '📚'; }, window: {}, setTimeout: function () {},
    exoSujets: null
});
vm.runInContext(js, contexte);
/* Le stockage du test remplace la liste lue au chargement. */
contexte.exercices = exercicesPage;
vm.runInContext('exercices = ' + JSON.stringify(exercicesPage) + '; customEvents = []; renderExoList();', contexte);
var liste = elements['exoListContainer'].innerHTML;
ok(liste.indexOf('Chimie') !== -1 && liste.indexOf('Physique') !== -1, 'la liste doit afficher les exercices');
ok(liste.indexOf('exo-liste-carte') !== -1, 'chaque exercice doit être une carte stylée');
ok(liste.indexOf('exo-chip') !== -1, 'chaque exercice doit porter ses étiquettes (durée, échéance)');
ok(liste.indexOf('En retard') !== -1, 'une échéance dépassée doit être dite clairement');
ok(liste.indexOf('Planifié') !== -1, 'un exercice planifié doit le montrer');
ok(liste.indexOf('exo-faite') !== -1, 'un exercice fait doit se distinguer');
ok(liste.indexOf('Replanifier') !== -1, 'un exercice planifié doit pouvoir être replanifié');
ok(liste.indexOf('<button') !== -1, 'la carte doit garder ses boutons d’action');

/* La progression et le badge suivent l'état des exercices. */
var badge = elements['exoCountBadge'].textContent;
ok(badge.indexOf('2 exercices') !== -1, 'le badge compte les exercices restants, reçu : ' + badge);
ok(elements['exoResume'].hidden === false, 'la progression s’affiche quand il y a des exercices');
ok(elements['exoResumeRemplissage'].style.width === '33%', 'la barre montre la part faite, reçu : ' + elements['exoResumeRemplissage'].style.width);

/* Liste vide : un vrai état d'accueil, avec une action. */
vm.runInContext('exercices = []; renderExoList(); renderPlanifier();', contexte);
ok(elements['exoListContainer'].innerHTML.indexOf('exo-empty-action') !== -1,
    'la liste vide doit proposer d’ajouter un premier exercice');
ok(elements['planifierContent'].innerHTML.indexOf('exo-empty-action') !== -1,
    'l’onglet Planifier vide doit proposer d’ajouter un exercice');
ok(elements['exoResume'].hidden === true, 'sans exercice, aucune fausse progression');
ok(elements['exoCountBadge'].classList.contains('exo-badge-vide'), 'sans exercice, le badge passe en discret');

/* Profil sans matière : la page le dit et propose la suite. */
vm.runInContext('subjects = []; optionalSubjects = []; buildExoSubjectGrid();', contexte);
ok(elements['exoSubjectGrid'].innerHTML.indexOf('Aucune matière') !== -1,
    'sans matière, la zone de choix doit expliquer quoi faire');
ok(elements['exoSubjectGrid'].innerHTML.indexOf('exo-empty-action') !== -1,
    'sans matière, la page doit proposer d’ajouter ses matières');

if (echecs.length) {
    echecs.forEach(function (m) { console.error('échec :', m); });
    console.error(echecs.length + ' problème(s) sur la page Mes Exercices');
    process.exit(1);
}
console.log('ok exercices-page : feuille dédiée branchée, styles complets, page jamais vide');
