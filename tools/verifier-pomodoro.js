/* Vérifie la page Pomodoro admin et la fin des cours à 16 h 25. */
var fs = require('fs');
var path = require('path');
var echecs = [];

function lire(rel) {
    return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}
function ok(cond, message) {
    if (!cond) echecs.push(message);
}

var menu = lire('pages/planning.html');
var planning = menu.indexOf('Emploi du temps hebdomadaire');
var pomodoro = menu.indexOf('id="menuPomodoro"');
var habitudes = menu.indexOf('id="menuHabitudes"');
ok(planning !== -1 && pomodoro > planning && habitudes > pomodoro, 'Pomodoro suit l\'emploi du temps');
ok(menu.slice(pomodoro, pomodoro + 220).indexOf('display:none') !== -1, 'le menu Pomodoro est caché au départ');

var nav = lire('js/pages/navigation.js');
ok(nav.indexOf("page === 'pomodoro'") !== -1 && nav.indexOf('focusEstAdmin') !== -1, 'la page ne s\'ouvre pas sans admin');
ok(nav.indexOf('focusOuvrir') !== -1, 'l\'ouverture prépare le minuteur');

var page = lire('pages/pomodoro.html');
['Study Plan IB', 'Concentre-toi', 'CONCENTRATION', 'PAUSE COURTE', 'PAUSE LONGUE', '25:00', 'Sur quoi veux-tu te concentrer ?', 'focusDots', 'focusTime'].forEach(function (extrait) {
    ok(page.indexOf(extrait) !== -1, 'page incomplète : ' + extrait);
});
ok(page.indexOf('focus-nav') === -1, 'les boutons Retour et Aller de la page sont retirés');
ok(page.indexOf('focusEditerTache') === -1, 'le crayon doit être retiré');
ok(page.indexOf('id="focusSons"') !== -1, 'le panneau des sons manque');
ok(page.indexOf('FOCUS') === -1 && page.indexOf('SHORT BREAK') === -1, 'la page Pomodoro doit être en français');
var script = lire('js/pages/pomodoro-page.js');
ok(script.indexOf('function focusBasculerSons') !== -1, 'le bouton musique doit ouvrir les sons');
['images/pomodoro/lumiere.png', 'images/pomodoro/kiosque.png', 'images/pomodoro/sommets.png', 'images/pomodoro/hublot.png', 'images/pomodoro/dunes.png', 'images/pomodoro/chalet.png', 'images/pomodoro/pont.png', 'images/pomodoro/riviere.png', 'images/pomodoro/prairie.png', 'images/pomodoro/noel.png', 'images/pomodoro/cafe.png', 'images/pomodoro/cafe-nuit.png', 'images/pomodoro/foret.png', 'images/pomodoro/campagne.png'].forEach(function (src) {
    ok(script.indexOf(src) !== -1, 'fond manquant : ' + src);
    var fichier = path.join(__dirname, '..', src);
    ok(fs.existsSync(fichier), 'fichier image absent : ' + src);
    ok(fs.statSync(fichier).size > 200000, 'image trop légère : ' + src);
});
ok(script.indexOf("focusPoserFond(focusIndexParId('lumiere'), true)") !== -1, 'Pomodoro doit ouvrir sur la lumiere du site');
var css = lire('css/pages/planning-panels.css');
ok(css.indexOf('background: #10b981') !== -1, 'le survol des boutons doit être vert');
ok(css.indexOf('rgba(255,255,255,0.22)') === -1, 'le survol blanc reste en place');
ok(css.indexOf('.focus-bottom {') !== -1 && css.indexOf('background: transparent;') !== -1, 'la bande du bas doit laisser voir l image');
ok(script.indexOf('focusEstAdmin') !== -1, 'contrôle admin manquant');
ok(lire('js/registre.js').indexOf('pages/pomodoro.html') !== -1, 'page non enregistrée');
ok(lire('js/registre.js').indexOf('js/pages/pomodoro-page.js') !== -1, 'script non enregistré');

var memoire = lire('js/memoire.js');
ok(memoire.indexOf("if (etape === 'assistant' || etape === 'pomodoro') etape = 'planning';") !== -1, 'un rafraîchissement ne doit pas rouvrir Pomodoro');
ok(memoire.indexOf("panelPomodoro: 'pomodoro'") !== -1, 'le bouton retour du navigateur doit connaître Pomodoro');
ok(memoire.indexOf("etape === 'pomodoro'") !== -1, 'le retour navigateur peut rouvrir Pomodoro');

ok(lire('js/pages/planning-base.js').indexOf('var COURS_FIN = 16 * 60 + 25;') !== -1, 'les cours doivent finir à 16 h 25');
ok(lire('pages/onboarding-activites.html').indexOf('16h35') === -1, 'l\'ancien horaire 16h35 reste affiché');
ok(lire('js/pages/onboarding-activites.js').indexOf('16 * 60 + 25') !== -1, 'le refus d\'activité doit s\'arrêter à 16 h 25');

if (echecs.length) {
    console.error('échecs ' + echecs.length);
    echecs.forEach(function (e) { console.error('- ' + e); });
    process.exit(1);
}
console.log('échecs 0');
