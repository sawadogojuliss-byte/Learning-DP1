/* Vérifie la séance de révision du jour, le minuteur de concentration,
   ouverts à tous, et la fin des cours à 16 h 25. */
var fs = require('fs');
var path = require('path');
var echecs = [];

function lire(rel) {
    return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}
function ok(cond, message) {
    if (!cond) echecs.push(message);
}

/* ── 1. Le menu du planning : deux entrées visibles, après l'emploi du temps ── */
var menu = lire('pages/planning.html');
var planning = menu.indexOf('Emploi du temps hebdomadaire');
var seances = menu.indexOf('id="menuSeances"');
var minuteur = menu.indexOf('id="menuMinuteur"');
var habitudes = menu.indexOf('id="menuHabitudes"');
ok(planning !== -1 && seances > planning, 'la séance de révision suit l\'emploi du temps');
ok(minuteur > seances && habitudes > minuteur, 'le minuteur se place avant les habitudes');
ok(menu.slice(seances, seances + 240).indexOf('display:none') === -1, 'la séance de révision doit être visible');
ok(menu.slice(minuteur, minuteur + 240).indexOf('display:none') === -1, 'le minuteur doit être visible');
ok(menu.indexOf('menuPomodoro') === -1, 'l\'ancienne entrée Pomodoro cachée doit disparaître');
ok(menu.indexOf('editPomodoroBtn') === -1, 'le crayon du planning doit disparaître');
ok(menu.indexOf('pomodoroModal') === -1, 'la fenêtre Pomodoro du planning doit disparaître');
ok(menu.slice(seances, seances + 700).indexOf("navigateTo('seances')") !== -1, 'le menu doit ouvrir la séance de révision');
ok(menu.slice(minuteur, minuteur + 700).indexOf("navigateTo('pomodoro')") !== -1, 'le menu doit ouvrir le minuteur');
ok(menu.indexOf('Séance de révision du jour') !== -1, 'la page des séances doit être nommée en français');
ok(menu.indexOf('>Pomodoro<') !== -1, 'l\'entrée du minuteur doit s\'appeler Pomodoro');
ok(menu.indexOf('Minuteur de concentration') === -1, 'l\'ancien nom du minuteur doit disparaître');

/* ── 2. Ouvert à tous : plus aucun contrôle admin ── */
var nav = lire('js/pages/navigation.js');
var page = lire('pages/pomodoro.html');
var script = lire('js/pages/pomodoro-page.js');
var memoire = lire('js/memoire.js');
var seancesHtml = lire('pages/seances.html');
ok(nav.indexOf("page === 'seances'") !== -1 && nav.indexOf('focusOuvrirSeances()') !== -1,
    'naviguer vers la séance de révision doit l\'ouvrir');
ok(nav.indexOf("page === 'pomodoro'") !== -1 && nav.indexOf('focusOuvrirMinuteur()') !== -1,
    'naviguer vers le minuteur doit l\'ouvrir');
[['js/pages/navigation.js', nav], ['js/pages/pomodoro-page.js', script], ['js/memoire.js', memoire]].forEach(function (paire) {
    ok(paire[1].indexOf('focusEstAdmin') === -1, 'le contrôle admin doit disparaître de ' + paire[0]);
});
ok(script.indexOf('function focusEstAdmin') === -1, 'plus aucune fonction de contrôle admin du minuteur');
ok(script.indexOf('function focusOuvrirSeances') !== -1 && script.indexOf('function focusOuvrirMinuteur') !== -1,
    'les deux ouvertures doivent exister');
ok(script.indexOf('function focusChoisirSeance') !== -1, 'la sélection d\'une séance doit exister');

/* ── 3. La page « Séance de révision du jour », à part, avant le minuteur ── */
['id="panelSeances"', 'id="focusAccueil"', 'id="focusAccueilListe"', 'id="focusAccueilStats"',
 'id="focusAccueilBonjour"', 'id="focusAccueilContinuer"', 'Séance de révision du jour',
 'focusEntrerPiece(true)', 'focusEntrerPiece()'].forEach(function (extrait) {
    ok(seancesHtml.indexOf(extrait) !== -1, 'page de séance incomplète : ' + extrait);
});
ok(seancesHtml.indexOf('Minuteur libre') !== -1, 'le minuteur libre doit rester accessible');
ok(seancesHtml.indexOf('Lancer le minuteur') !== -1, 'le bouton doit lancer le minuteur');
ok(script.indexOf('function focusSeancesJour') !== -1, 'les séances du jour ne sont pas lues dans l\'emploi du temps');
ok(script.indexOf('function focusPeindreAccueil') !== -1, 'la page des séances ne se peint pas');
ok(script.indexOf('function focusEntrerPiece') !== -1, 'le bouton ne mène pas au minuteur');
ok(script.indexOf("memoireAller('pomodoro')") !== -1, 'entrer dans le minuteur doit poser une étape d\'historique');
ok(script.indexOf('function focusReprendreApresRafraichissement') !== -1, 'la reprise après rafraîchissement manque');
ok(script.indexOf("memoireAller('seances')") !== -1, 'le bouton maison du minuteur doit ramener aux séances');
ok(page.indexOf('id="focusAccueil"') === -1, 'l\'accueil des séances ne doit plus vivre dans le minuteur');
ok(page.indexOf('Tes séances du jour') === -1, 'l\'ancien accueil doit disparaître du minuteur');
ok(seancesHtml.indexOf('focusAccueilSous') !== -1 && seancesHtml.indexOf('Choisis une séance, puis lance le minuteur Pomodoro') !== -1,
    'la page doit expliquer qu\'on choisit une séance avant le minuteur');
ok(page.indexOf('<p class="focus-nom">Pomodoro</p>') !== -1, 'le minuteur doit afficher son nom : Pomodoro');
ok(lire('css/pages/planning-panels.css').indexOf('.focus-nom {') !== -1, 'le badge Pomodoro doit être stylé');
ok(fs.existsSync(path.join(__dirname, '..', 'pages/seances.html')), 'page de séance absente');
ok(lire('js/registre.js').indexOf("'pages/seances.html'") !== -1, 'page de séance non enregistrée');
ok(lire('js/registre.js').indexOf("'pages/pomodoro.html'") !== -1, 'page minuteur non enregistrée');
ok(lire('js/registre.js').indexOf("'js/pages/pomodoro-page.js'") !== -1, 'script non enregistré');

/* ── 4. Le retour du navigateur : planning → séances → minuteur ── */
ok(memoire.indexOf("panelSeances: 'seances'") !== -1, 'le bouton retour doit connaître la séance de révision');
ok(memoire.indexOf("panelPomodoro: 'pomodoro'") !== -1, 'le bouton retour doit connaître le minuteur');
ok(memoire.indexOf("seances: 1") !== -1, 'la séance de révision doit être une étape connue de l\'historique');
ok(memoire.indexOf("etape !== 'seances' && etape !== 'pomodoro'") !== -1,
    'la classe ne doit jamais barrer la route du minuteur');
ok(memoire.indexOf("seances: 'planning'") !== -1, 'retour de la séance de révision : le planning');
ok(memoire.indexOf("pomodoro: 'seances'") !== -1, 'retour du minuteur : la séance de révision');
ok(memoire.indexOf("__memoirePomodoroEnAttente") !== -1, 'un rafraîchissement sur le minuteur doit y rester');
ok(lire('js/compte.js').indexOf("ouverte === 'pomodoro'") !== -1, 'la synchro ne doit pas renvoyer le minuteur au planning');

/* ── 5. La page du minuteur elle-même ── */
['Study Plan IB', 'CONCENTRATION', 'PAUSE COURTE', 'PAUSE LONGUE', '25:00',
 'Sur quoi veux-tu te concentrer ?', 'focusFonds', 'focusTime'].forEach(function (extrait) {
    ok(page.indexOf(extrait) !== -1, 'minuteur incomplet : ' + extrait);
});
ok(page.indexOf('Concentre-toi') === -1, 'Concentre-toi doit être retiré');
ok(page.indexOf('focus-nav') === -1, 'les boutons Retour et Aller de la page sont retirés');
ok(page.indexOf('focusEditerTache') === -1, 'le crayon doit être retiré');
ok(page.indexOf('id="focusSons"') !== -1, 'le panneau des sons manque');
ok(page.indexOf('FOCUS') === -1 && page.indexOf('SHORT BREAK') === -1, 'la page du minuteur doit être en français');
ok(script.indexOf('function focusBasculerSons') !== -1, 'le bouton musique doit ouvrir les sons');
ok(script.indexOf('Ajouter une sous-tâche') !== -1, 'l option sous-tâche manque');
ok(script.indexOf('Dupliquer') !== -1, 'l option dupliquer manque');
ok(script.indexOf('Supprimer la tâche') !== -1, 'l option supprimer manque');
ok(script.indexOf('function focusBoutonTache') !== -1, 'le bouton a trois points manque');
ok(script.indexOf('function focusAjouterSousTache') !== -1, 'la sous-tâche ne peut pas être ajoutée');
ok(page.indexOf('focusDots') === -1, 'la ligne de points doit disparaitre');
ok(page.indexOf('Ma musique') === -1, 'Ma musique doit être retirée');
ok(page.indexOf('Ma playlist') === -1, 'la playlist ne doit plus apparaître');
ok(page.indexOf('focusImageDansImage') !== -1, 'le bouton image dans l image manque');
ok(lire('js/pages/pomodoro.js').indexOf('if (!modal) return;') !== -1, 'la fenêtre du planning ne doit plus être appelée');

/* ── 6. Plus aucune tomate, ni en image, ni en mot dans les libellés ── */
['pages/planning.html', 'pages/seances.html', 'pages/pomodoro.html', 'js/pages/planning-interface.js',
 'js/pages/planning-base.js', 'js/pages/pomodoro.js', 'js/pages/pomodoro-page.js', 'style_v3.css',
 'css/pages/planning-panels.css'].forEach(function (rel) {
    ok(lire(rel).indexOf('🍅') === -1, 'il reste une tomate dans ' + rel);
});
var pomo = lire('js/pages/pomodoro.js');
ok(pomo.indexOf("' × 25 min'") !== -1, 'le décompte doit s\'écrire en minutes, sans tomate');
ok(script.indexOf('sessions de 25 min') !== -1, 'la statistique doit parler de sessions de 25 min');

/* ── 7. Les fonds WebP, posés d'un coup, jamais de fondu ── */
['lumiere', 'kiosque', 'sommets', 'hublot', 'dunes', 'chalet', 'pont', 'riviere', 'prairie', 'noel', 'cafe', 'cafe-nuit', 'foret', 'campagne', 'tente', 'savane', 'recif', 'sentier', 'pluie-nuit', 'lecture', 'cabine', 'tunnel', 'stade'].forEach(function (id) {
    var src = 'images/pomodoro/' + id + '.webp';
    var mini = 'images/pomodoro/mini/' + id + '.webp';
    ok(script.indexOf(src + '?v=') !== -1, 'fond manquant : ' + src);
    ok(script.indexOf(mini + '?v=') !== -1, 'vignette non utilisée : ' + mini);
    [src, mini].forEach(function (rel) {
        var fichier = path.join(__dirname, '..', rel);
        ok(fs.existsSync(fichier), 'fichier image absent : ' + rel);
        ok(fs.statSync(fichier).size > 1000, 'image illisible : ' + rel);
    });
    ok(fs.statSync(path.join(__dirname, '..', src)).size < 320000, 'image encore trop lourde : ' + src);
    ok(!fs.existsSync(path.join(__dirname, '..', 'images/pomodoro/' + id + '.png')), 'l ancien PNG reste à charger : ' + id);
});
/* Le décor ne doit ni devenir transparent (le planning apparaîtrait) ni se
   croiser en fondu (l ancienne image reviendrait) : l image choisie est posée
   d un coup, une fois décodée. */
ok(script.indexOf("opacity = '0.25'") === -1, 'le décor ne doit plus être effacé avant de changer d image');
ok(script.indexOf('focusBgBis') === -1 && page.indexOf('focusBgBis') === -1, 'le second calque ne doit plus exister');
ok(script.indexOf('function focusDecoderImage') !== -1, 'l image doit être décodée avant d être affichée');
ok(script.indexOf('function focusAmorcerFonds') !== -1, 'les images doivent être préparées en avance');
ok(script.indexOf('focusPeindreCalque(bg, src)') !== -1, 'la nouvelle image doit être posée directement sur le décor');
ok(script.indexOf('visible.style.opacity') === -1 && script.indexOf('prochain.style.opacity') === -1, 'aucun fondu entre deux décors');
ok(script.indexOf('visible.style.zIndex') === -1 && script.indexOf('prochain.style.zIndex') === -1, 'aucun calque superposé pour un fondu');
var cssFonds = lire('css/pages/planning-panels.css');
ok(cssFonds.indexOf('.focus-bg-bis') === -1, 'le style du second calque doit disparaître');
ok(cssFonds.indexOf('transition: none') !== -1, 'le décor ne doit plus changer en fondu');
ok(cssFonds.indexOf('background: #04140f') !== -1, 'le fond opaque de sécurité manque');
ok(cssFonds.indexOf('images/pomodoro/lumiere.webp?v=') !== -1, 'le décor de secours doit être en WebP');
ok(script.indexOf('is-chargement') !== -1, 'la vignette doit montrer qu elle charge');
ok(script.indexOf("focusPoserFond(focusIndexParId('lumiere'), true)") !== -1, 'le minuteur doit ouvrir sur la lumiere du site');
ok(script.indexOf("focusPoserFond(focusIndexParId('lumiere'), true)") !== -1, 'la séance de révision doit ouvrir sur la lumiere du site');

/* ── 8. Le style de la page ── */
var css = lire('css/pages/planning-panels.css');
ok(css.indexOf('background: #10b981') !== -1, 'le survol des boutons doit être vert');
ok(css.indexOf('rgba(255,255,255,0.22)') === -1, 'le survol blanc reste en place');
ok(css.indexOf('.focus-bottom {') !== -1 && css.indexOf('background: transparent;') !== -1, 'la bande du bas doit laisser voir l image');
ok(css.indexOf('caret-color: transparent') !== -1, 'le curseur clignotant doit disparaître');
ok(css.indexOf('.focus-tip {') !== -1, 'le style du conseil a disparu');
ok(css.indexOf('#7c5cff') === -1, 'l ampoule doit être verte');
ok(css.indexOf('repeat(5, minmax(0, 1fr))') !== -1, 'les sons doivent être en 5 colonnes');
ok(css.indexOf('background-position: center center') !== -1, 'les images doivent être centrées');
ok(script.indexOf("nom: 'Pluie'") < script.indexOf("nom: 'Océan'"), 'Pluie doit ouvrir la grille');
ok(script.indexOf('Image dans') === -1 && page.indexOf("Image dans l'image") !== -1, 'le libellé français image dans l image manque');
ok(page.indexOf('title="Image dans') === -1, 'le survol ne doit pas afficher image dans l image');
['audio/pomodoro/pluie.wav', 'audio/pomodoro/ocean.wav', 'audio/pomodoro/cafe.wav', 'audio/pomodoro/beta.wav', 'audio/pomodoro/gamma.wav'].forEach(function (src) {
    ok(fs.existsSync(path.join(__dirname, '..', src)), 'son absent : ' + src);
});

/* ── 9. Les cours finissent à 16 h 25 ── */
ok(lire('js/pages/planning-base.js').indexOf('var COURS_FIN = 16 * 60 + 25;') !== -1, 'les cours doivent finir à 16 h 25');
ok(lire('pages/onboarding-activites.html').indexOf('16h35') === -1, 'l\'ancien horaire 16h35 reste affiché');
ok(lire('js/pages/onboarding-activites.js').indexOf('16 * 60 + 25') !== -1, 'le refus d\'activité doit s\'arrêter à 16 h 25');

if (echecs.length) {
    console.error('Séance de révision et minuteur : échecs ' + echecs.length);
    echecs.forEach(function (e) { console.error('- ' + e); });
    process.exit(1);
}
console.log('Séance de révision et minuteur : 0 échec');
