/* Vérifie la page « Séance de révision du jour » et le retour du navigateur :
   planning → séance de révision → minuteur, plus aucune marque de minuteur
   dans le planning, et le minuteur ouvert à tout le monde. */
var fs = require('fs');

var echecs = 0;
function ok(cond, message) {
    if (cond) return;
    echecs += 1;
    console.error('échec:', message);
}
function lire(rel) { return fs.readFileSync(rel, 'utf8'); }
function compter(texte, motif) { return (texte.match(new RegExp(motif, 'g')) || []).length; }

var planning = lire('pages/planning.html');
var interfacePlanning = lire('js/pages/planning-interface.js');
var seances = lire('pages/seances.html');
var pomodoro = lire('pages/pomodoro.html');
var script = lire('js/pages/pomodoro-page.js');
var nav = lire('js/pages/navigation.js');
var memoire = lire('js/memoire.js');
var registre = lire('js/registre.js');

/* ── Plus aucune marque de minuteur dans le planning ───────────────── */
[['pages/planning.html', planning], ['js/pages/planning-interface.js', interfacePlanning]].forEach(function (paire) {
    ok(paire[1].indexOf('🍅') === -1, 'il reste une tomate dans ' + paire[0]);
});
ok(planning.indexOf('editPomodoroBtn') === -1, 'le bouton du modal d\'édition doit disparaître');
ok(planning.indexOf('pomodoroModal') === -1, 'la fenêtre Pomodoro du planning doit disparaître');
ok(interfacePlanning.indexOf('v3-pomo-chip') === -1, 'le badge rond du planning doit disparaître');
ok(interfacePlanning.indexOf('v3PomodoroLabel') === -1, 'le décompte de pomodoros du planning doit disparaître');
ok(lire('style_v3.css').indexOf('.v3-pomo-chip') === -1, 'le style du badge doit disparaître');

/* ── La page Séance de révision du jour ───────────────────────────── */
ok(fs.existsSync('pages/seances.html'), 'la page seances.html manque');
ok(seances.indexOf('id="panelSeances"') !== -1, 'le panneau seances manque');
ok(seances.indexOf('Séance de révision du jour') !== -1, 'le titre de la page manque');
ok(seances.indexOf('id="focusAccueil"') !== -1, 'la liste des séances manque');
ok(seances.indexOf('focusAccueilListe') !== -1 && seances.indexOf('focusAccueilStats') !== -1, 'les séances et les compteurs manquent');
ok(seances.indexOf('focusEntrerPiece()') !== -1 && seances.indexOf('focusEntrerPiece(true)') !== -1,
    'les deux boutons doivent mener au minuteur');
ok(registre.indexOf("'pages/seances.html'") !== -1, 'la page n\'est pas enregistrée');
ok(pomodoro.indexOf('focusAccueil') === -1, 'l\'accueil doit avoir quitté la page Pomodoro');
ok(pomodoro.indexOf('Tes séances du jour') === -1, 'l\'ancien titre doit disparaître de la page Pomodoro');

/* ── Le retour du navigateur : trois étapes dans l'ordre ──────────── */
ok(memoire.indexOf("panelSeances: 'seances'") !== -1, 'l\'étape seances n\'est pas connue');
ok(memoire.indexOf("seances: 'planning'") !== -1, 'la page des séances doit venir après le planning');
ok(memoire.indexOf("pomodoro: 'seances'") !== -1, 'le minuteur doit revenir sur la page des séances');
ok(memoire.indexOf("etape === 'planning' || etape === 'seances'") !== -1, 'l\'étape seances doit être ouverte comme les autres');
ok(memoire.indexOf('__memoirePomodoroEnAttente') !== -1, 'un rafraîchissement sur le minuteur doit y rester');
ok(script.indexOf('function focusReprendreApresRafraichissement') !== -1, 'la reprise du minuteur manque');
ok(script.indexOf('focusAjouterEtapeListe') === -1, 'l\'ancienne étape posée à la main doit disparaître');
ok(script.indexOf('listeSeances') === -1, 'l\'ancien état d\'historique doit disparaître');
ok(script.indexOf('function focusEntrerPiece') !== -1, 'le passage au minuteur manque');
ok(script.indexOf("memoireAller('pomodoro')") !== -1, 'le minuteur doit être une vraie étape d\'historique');

/* ── Ouvert à tout le monde ──────────────────────────────────────── */
ok(nav.indexOf("page === 'pomodoro'") !== -1 && nav.indexOf("page === 'pomodoro' && (typeof focusEstAdmin") === -1,
    'le minuteur ne doit plus dépendre d\'un compte admin');
ok(nav.indexOf("page === 'seances'") !== -1, 'la page des séances n\'est pas branchée dans la navigation');
ok(nav.indexOf('focusOuvrirSeances') !== -1 && nav.indexOf('focusOuvrirMinuteur') !== -1,
    'les deux écrans doivent s\'ouvrir par leurs fonctions');
ok(script.indexOf('function focusEstAdmin') === -1, 'plus aucun contrôle de compte dans le minuteur');
ok(script.indexOf('function focusOuvrirSeances') !== -1 && script.indexOf('function focusOuvrirMinuteur') !== -1,
    'les deux écrans doivent avoir leur ouverture');
ok(script.indexOf('focusEstAdmin()') === -1, 'le minuteur ne doit plus demander un compte admin');
var bloc = script.slice(script.indexOf('function focusBasculer()'), script.indexOf('function focusBasculer()') + 220);
ok(bloc.indexOf('active') !== -1 && bloc.indexOf('focusEstAdmin') === -1, 'le bouton de départ doit marcher pour tout le monde');

/* ── Jamais d'écran blanc ────────────────────────────────────────── */
var blocSeances = script.slice(script.indexOf('function focusOuvrirSeances'),
                                script.indexOf('function focusOuvrirMinuteur'));
ok(blocSeances.indexOf("accueil.hidden = false") !== -1,
    'revenir sur les séances doit remontrer la page (sinon écran blanc)');
ok(blocSeances.indexOf("page.hidden = true") !== -1,
    'revenir sur les séances doit cacher le minuteur');
ok(script.indexOf("if (typeof memoireAller === 'function') memoireAller('planning')") !== -1,
    'la maison du minuteur doit ramener au planning, pas aux séances');
ok(memoire.indexOf("hash === 'seances') etape = 'seances'") !== -1,
    'un lien direct #seances doit rouvrir la page des séances');

/* ── Le menu ─────────────────────────────────────────────────────── */
var itemSeances = planning.indexOf('id="menuSeances"');
var itemMinuteur = planning.indexOf('id="menuMinuteur"');
var itemPlanning = planning.indexOf('>Mon Planning</p>');
var itemExercices = planning.indexOf("navigateTo('exercices')");
var itemEeia = planning.indexOf("navigateTo('eeia')");
var itemFeries = planning.indexOf("navigateTo('feries')");
var itemHabitudes = planning.indexOf('id="menuHabitudes"');
ok(itemSeances > itemPlanning, 'la séance de révision doit venir après Mon planning');
ok(itemMinuteur > itemSeances && itemHabitudes > itemMinuteur, 'le minuteur suit la séance de révision, avant les habitudes');
ok(itemExercices > itemSeances && itemEeia > itemExercices && itemFeries > itemEeia && itemMinuteur > itemFeries,
    'l\'ordre demandé doit être : séance, exercices, EE & IA, jours fériés, pomodoro, habitudes');
ok(planning.slice(itemSeances, itemSeances + 260).indexOf('display:none') === -1, 'le menu des séances doit être visible');
ok(planning.slice(itemMinuteur, itemMinuteur + 260).indexOf('display:none') === -1, 'le menu du minuteur doit être visible');
ok(script.indexOf("['menuSeances', 'menuMinuteur']") !== -1, 'les deux entrées du menu doivent rester visibles pour tous');
ok(planning.indexOf('id="menuPomodoro"') === -1, 'l\'ancienne entrée cachée doit disparaître');

if (echecs) {
    console.error(echecs + ' échec(s)');
    process.exit(1);
}
console.log('séance de révision : page ouverte à tous, retour planning → séances → minuteur (0 échec)');
