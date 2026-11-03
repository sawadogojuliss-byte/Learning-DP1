/* Vérifie les paramètres du minuteur et de la séance de révision :
   citations, styles d'affichage, polices, taille, options,
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

/* ── 1. Citation en haut, sans heure ── */
ok(minuteur.indexOf('id="focusCitation"') !== -1, 'le minuteur doit avoir la citation en haut à droite');
ok(minuteur.indexOf('id="focusHeure"') === -1, 'l\'heure ne doit plus être affichée sur le minuteur');
ok(seances.indexOf('id="focusAccueilCitation"') === -1, 'la page Séance ne doit plus afficher de citation');
ok(seances.indexOf('id="focusAccueilHeure"') === -1, 'l\'heure ne doit plus être affichée sur la séance');
ok(minuteur.indexOf('Format de l\'heure') === -1 && minuteur.indexOf('id="focusChoixFormat"') === -1, 'la carte « Format de l\'heure » doit disparaître');

/* Citations par catégorie : évaluées dans un contexte isolé. */
var vm = require('vm');
var blocCitations = (script.match(/var FOCUS_CATEGORIES_CITATIONS[\s\S]*?\n\};/) || [])[0] || '';
var contexteCitations = {};
try { vm.runInNewContext(blocCitations + '\nthis.C = FOCUS_CITATIONS; this.K = FOCUS_CATEGORIES_CITATIONS;', contexteCitations); } catch (e) { contexteCitations = {}; }
var categoriesAttendues = ['toutes', 'motivation', 'inspiration', 'bien-etre'];
var nomsAttendus = ['Toutes les citations', 'Motivation', 'Inspiration', 'Bien-être'];
var listeCategories = contexteCitations.K || [];
ok(listeCategories.length === 4 && categoriesAttendues.every(function (id, i) { return listeCategories[i] && listeCategories[i].id === id && listeCategories[i].nom === nomsAttendus[i]; }),
    'les 4 catégories doivent exister avec leurs libellés français (sans Gratitude)');
var lesCitations = contexteCitations.C || {};
['motivation', 'inspiration', 'bien-etre'].forEach(function (id) {
    var liste = lesCitations[id] || [];
    ok(liste.length >= 5, 'la catégorie ' + id + ' doit avoir au moins 5 citations');
    liste.forEach(function (c) {
        ok(typeof c.t === 'string' && !/\.\s*$/.test(c.t), 'citation sans point final : ' + (c.t || '').slice(0, 40));
        ok(typeof c.t === 'string' && c.t.length <= 75, 'citation trop longue : ' + (c.t || '').slice(0, 40));
        ok(!/\b(the|and|you|your)\b/i.test(c.t), 'citation en anglais détectée : ' + (c.t || '').slice(0, 40));
    });
});
ok(script.indexOf("focusCategorieCitation") !== -1 && /id="focusCategorieCitation"/.test(lire('pages/pomodoro.html')), 'la liste déroulante des catégories doit exister dans Citations');
ok(/Afficher la citation</.test(lire('pages/pomodoro.html')), 'la case doit s\'appeler « Afficher la citation »');

/* ── 2. Bouton Paramètres (icône seule, en bas), sur les deux pages ── */
ok(minuteur.indexOf('id="focusBtnReglages"') !== -1, 'le minuteur doit avoir le bouton Paramètres');
ok(/id="focusBtnReglages"[^>]*aria-label="Paramètres"/.test(minuteur), 'le bouton du minuteur doit avoir aria-label="Paramètres"');
ok(minuteur.indexOf('title="Paramètres"') === -1 && seances.indexOf('title="Paramètres"') === -1, 'aucune info-bulle « Paramètres » au survol des boutons (pas de title)');
ok(!/id="focusBtnReglages"[\s\S]*?<\/button>/.test(minuteur) || !/id="focusBtnReglages"[\s\S]*?>Paramètres<\/button>/.test(minuteur),
    'le bouton du minuteur ne doit pas afficher le mot Paramètres (icône seule)');
ok(seances.indexOf('id="accueilBtnParametres"') === -1 && seances.indexOf('accueilOuvrirParametres()') === -1,
    'la page Séance ne doit plus avoir le bouton Paramètres : il est seulement sur le minuteur');
ok(seances.indexOf('id="accueilBtnSons"') === -1 && seances.indexOf('focusBasculerSonsAccueil()') === -1,
    'la page Séance ne doit plus avoir le bouton Sons : il est seulement sur le minuteur');
ok(minuteur.indexOf('aria-label="Durées"') === -1, 'l\'ancien bouton « Durées » doit disparaître');
ok(minuteur.indexOf('focus-bouton-parametres') === -1 && !/id="focusReglages"[^>]*focus-panneau/.test(minuteur),
    'les anciennes classes focus-bouton-parametres et focus-panneau ne doivent plus servir aux paramètres');

/* ── 3. Menu latéral et pages : toutes les rubriques des captures ── */
ok(/id="focusReglages"[^>]*class="focus-tiroir"|class="focus-tiroir"[^>]*id="focusReglages"/.test(minuteur), 'le menu Paramètres doit être un tiroir (focus-tiroir)');
ok(minuteur.indexOf('aria-label="Fermer les paramètres"') !== -1, 'le menu doit avoir une croix de fermeture');
['themes', 'horloge', 'minuteur', 'citations', 'voix'].forEach(function (onglet) {
    ok(minuteur.indexOf('data-onglet="' + onglet + '"') !== -1, 'entrée de menu manquante : ' + onglet);
    ok(minuteur.indexOf('data-page="' + onglet + '"') !== -1, 'page manquante : ' + onglet);
});
['Thèmes', 'Horloge', 'Minuteur', 'Citations', 'Voix'].forEach(function (nom) {
    ok(minuteur.indexOf('<span>' + nom + '</span>') !== -1, 'libellé de menu manquant : ' + nom);
});
['focusChoixStyle', 'focusOptBarre', 'focusOptNotif', 'focusOptAuto', 'focusChoixPolice',
 'focusChoixTaille', 'focusVoixActive', 'focusDureeFocus', 'focusThemesCorps', 'focusOptCitation'].forEach(function (id) {
    ok(minuteur.indexOf('id="' + id + '"') !== -1, 'le menu Paramètres doit contenir #' + id);
});
ok(minuteur.indexOf('Taille de l\'horloge et du minuteur') !== -1, 'la page Horloge doit garder la carte « Taille de l\'horloge et du minuteur »');
ok(minuteur.indexOf('Afficher la citation') !== -1, 'la page Citations doit avoir l\'interrupteur d\'affichage');
ok(script.indexOf('var FOCUS_ONGLETS = [\'themes\', \'horloge\', \'minuteur\', \'citations\', \'voix\']') !== -1, 'ordre des rubriques incorrect');
['Par défaut', 'Horloge à palettes', 'Barre de progression', 'Jauge', 'Matrice de points', 'Camembert'].forEach(function (nom) {
    ok(script.indexOf("nom: '" + nom + "'") !== -1, 'style du minuteur manquant : ' + nom);
});
['Gras par défaut', 'Léger par défaut', 'Doux', 'Bulle', 'Minimal léger', 'Minimal', 'Serif',
 'Serif condensé', 'Sportif', 'Très large', 'Digital', 'Manuscrite'].forEach(function (nom) {
    ok(script.indexOf("nom: '" + nom + "'") !== -1, 'police manquante : ' + nom);
});
['Petite', 'Normale', 'Grande'].forEach(function (nom) {
    ok(script.indexOf("nom: '" + nom + "'") !== -1, 'taille manquante : ' + nom);
});
ok(script.indexOf('FOCUS_FORMATS') === -1 && script.indexOf('focusPeindreHeure') === -1, 'le code d\'affichage de l\'heure doit être retiré');
ok(minuteur.indexOf('id="focusDureeFocus"') !== -1 && minuteur.indexOf('id="focusDureeLong"') !== -1 && minuteur.indexOf('id="focusDureeSeances"') !== -1, 'les durées doivent rester dans Minuteur');

ok(/\.focus-tiroir-contenu\s*,\s*\.focus-tiroir-menu[^{]*\{[^}]*scrollbar-width:\s*none/.test(css) || css.indexOf('scrollbar-width: none') !== -1, 'la barre de défilement du menu Paramètres doit être masquée');

ok(css.indexOf('html:has(#panelPomodoro.active) #app-pages > :is(nav, section, footer)') !== -1 && css.indexOf('html:has(#panelSeances.active) #app-pages') !== -1, 'la vitrine du site doit être retirée sur les pages Minuteur et Séance (pas de barre de défilement)');

/* ── 3b. Couleurs du site : pas de violet (capture 3 écartée) ── */
var violet = /#(7c3aed|8b5cf6|a855f7|9333ea|6d28d9|7e22ce|c084fc|a78bfa|ddd6fe|6366f1|4f46e5)\b|\bpurple\b|\bviolet\b|rgba?\(\s*(139|168|124|147|109)\s*,\s*(92|85|58|51|40|34)/i;
ok(!violet.test(css), 'focus-parametres.css ne doit pas contenir de violet');
ok(!violet.test(script), 'pomodoro-parametres.js ne doit pas contenir de violet');
ok(!violet.test(minuteur), 'pages/pomodoro.html ne doit pas contenir de violet');

/* ── 3c. Photo des tuiles : image verte, copie dans le dépôt ── */
ok(css.indexOf('images/pomodoro/lumiere.webp') !== -1, 'les tuiles doivent utiliser la photo lumière (images/pomodoro/lumiere.webp)');
ok(fs.existsSync(path.join(__dirname, '..', 'images/pomodoro/lumiere.webp')), 'images/pomodoro/lumiere.webp doit exister');

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
console.log('Paramètres minuteur : 0 échec (styles, polices, citations, options, Degular, câblage ; sans heure)');
