/* Vérifie les paramètres du minuteur et de la séance de révision :
   citations, heure, styles d'affichage, polices, format, taille, options,
   police Degular, clé de stockage propre, et câblage dans le registre et
   le service worker. Lancer : node tools/verifier-parametres-minuteur.js */
var fs = require('fs');
var path = require('path');
var echecs = [];

function lire(rel) {
    return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}
function ok(cond, message) {
    if (!cond) echecs.push(message);
}

var minuteur = lire('pages/pomodoro.html');
var seances = lire('pages/seances.html');
var script = lire('js/pages/pomodoro-parametres.js');
var scriptMinuteur = lire('js/pages/pomodoro-page.js');
var css = lire('css/pages/focus-parametres.css');
var registre = lire('js/registre.js');
var sw = lire('service-worker.js');
var index = lire('index.html');
var boot = lire('js/boot.js');

/* ── 1. Citation et heure en haut ── */
ok(minuteur.indexOf('id="focusCitation"') !== -1, 'le minuteur doit avoir la citation en haut à droite');
ok(minuteur.indexOf('id="focusHeure"') !== -1, 'le minuteur doit afficher l\'heure');
ok(seances.indexOf('id="focusAccueilCitation"') !== -1, 'la séance doit avoir la citation en haut à droite');
ok(seances.indexOf('id="focusAccueilHeure"') !== -1, 'la séance doit afficher l\'heure');

var citations = (script.match(/FOCUS_CITATIONS = \[([\s\S]*?)\];/) || [])[1] || '';
ok((citations.match(/"[^"]+"|'[^']+'/g) || []).length >= 10, 'il faut au moins 10 citations en français');

/* ── 2. Bouton Paramètres en bas, sur les deux pages ── */
ok(minuteur.indexOf('id="focusBtnReglages"') !== -1 && minuteur.indexOf('<span>Paramètres</span>') !== -1,
    'le minuteur doit avoir un bouton Paramètres en bas');
ok(seances.indexOf('id="accueilBtnParametres"') !== -1 && seances.indexOf('accueilOuvrirParametres()') !== -1,
    'la séance doit avoir un bouton Paramètres en bas');
ok(minuteur.indexOf('aria-label="Durées"') === -1, 'l\'ancien bouton « Durées » doit disparaître');

/* ── 3. Panneau Paramètres : toutes les sections des captures ── */
['focusChoixStyle', 'focusOptBarre', 'focusOptNotif', 'focusOptAuto', 'focusChoixPolice',
 'focusChoixFormat', 'focusChoixTaille', 'focusVoixActive', 'focusDureeFocus'].forEach(function (id) {
    ok(minuteur.indexOf('id="' + id + '"') !== -1, 'le panneau Paramètres doit contenir #' + id);
});
['Par défaut', 'Horloge à palettes', 'Barre de progression', 'Jauge', 'Matrice de points', 'Camembert'].forEach(function (nom) {
    ok(script.indexOf("nom: '" + nom + "'") !== -1, 'style du minuteur manquant : ' + nom);
});
['Gras par défaut', 'Léger par défaut', 'Doux', 'Bulle', 'Minimal léger', 'Minimal', 'Serif',
 'Serif condensé', 'Sportif', 'Très large', 'Digital', 'Manuscrite'].forEach(function (nom) {
    ok(script.indexOf("nom: '" + nom + "'") !== -1, 'police manquante : ' + nom);
});
ok(script.indexOf("nom: '12 heures'") !== -1 && script.indexOf("nom: '24 heures'") !== -1, 'formats 12 h et 24 h manquants');
['Petite', 'Normale', 'Grande'].forEach(function (nom) {
    ok(script.indexOf("nom: '" + nom + "'") !== -1, 'taille manquante : ' + nom);
});
ok(minuteur.indexOf('Concentration <input') !== -1 && minuteur.indexOf('Pause longue <input') !== -1, 'les durées doivent rester dans Paramètres');

/* ── 4. Stockage : clé propre, pas celle de la synchronisation ── */
ok(script.indexOf("'studyPlanIB_focusReglages'") === -1,
    'la clé « studyPlanIB_focusReglages » appartient à la synchronisation : ne pas l\'utiliser');
ok(script.indexOf("'studyPlanIB_minuteurParametres'") !== -1, 'clé de stockage propre manquante');

/* ── 5. Police Degular ── */
ok(css.indexOf("font-family: 'Degular'") !== -1, 'la police Degular doit être déclarée (@font-face)');
ok(css.indexOf("fonts/degular/Degular-Bold.woff2") !== -1, 'le fichier Degular Bold doit être référencé');
ok(css.indexOf("var(--focus-degular)") !== -1, 'Degular doit être utilisée par le minuteur et la séance');
ok(fs.existsSync(path.join(__dirname, '..', 'fonts/degular/LISEZMOI.txt')), 'la notice fonts/degular/LISEZMOI.txt doit exister');

/* ── 6. Comportements branchés sur le minuteur ── */
ok(scriptMinuteur.indexOf('focusPeindreParametres()') !== -1, 'le minuteur doit appeler focusPeindreParametres');
ok(scriptMinuteur.indexOf('focusNotifierFin(fini)') !== -1, 'la fin de phase doit notifier');
ok(scriptMinuteur.indexOf('focusDemarrerEnchainement()') !== -1, 'la fin de phase doit enchaîner si l\'option est activée');
ok(script.indexOf('if (!r.notif') !== -1 && script.indexOf("Notification.permission !== 'granted'") !== -1,
    'la notification ne doit partir que si l\'élève l\'a demandée et autorisée');

/* ── 7. Câblage : registre, service worker, feuille de style, version ── */
ok(registre.indexOf("'js/pages/pomodoro-parametres.js'") !== -1, 'script absent du registre');
ok(sw.indexOf('"js/pages/pomodoro-parametres.js"') !== -1, 'script absent du service worker');
ok(sw.indexOf('"css/pages/focus-parametres.css"') !== -1, 'feuille absente du service worker');
ok(index.indexOf('css/pages/focus-parametres.css') > index.indexOf('css/pages/planning-panels.css'),
    'focus-parametres.css doit être chargée après planning-panels.css');
var version = (boot.match(/var version = '([^']+)'/) || [])[1];
ok(version && index.indexOf('?v=' + version) !== -1, 'la version de index.html doit correspondre à js/boot.js');
ok(sw.indexOf("const VERSION = '" + version + "'") !== -1, 'la version du service worker doit correspondre à js/boot.js');

if (echecs.length) {
    console.error('Paramètres minuteur : ' + echecs.length + ' échec(s)');
    echecs.forEach(function (e) { console.error(' - ' + e); });
    process.exit(1);
}
console.log('Paramètres minuteur : 0 échec (styles, polices, citations, heure, options, Degular, câblage)');
