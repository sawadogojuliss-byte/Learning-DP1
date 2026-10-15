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
['FOCUS', 'SHORT BREAK', 'LONG BREAK', '25:00', 'What do you want to focus on?', "Don't call it a dream, call it a plan", 'focusDots', 'focusTime'].forEach(function (extrait) {
    ok(page.indexOf(extrait) !== -1, 'page incomplète : ' + extrait);
});
var script = lire('js/pages/pomodoro-page.js');
['images/pomodoro/noel.png', 'images/pomodoro/cafe.png', 'images/pomodoro/cafe-nuit.png', 'images/pomodoro/foret.png', 'images/pomodoro/campagne.png'].forEach(function (src) {
    ok(script.indexOf(src) !== -1, 'fond manquant : ' + src);
    ok(fs.existsSync(path.join(__dirname, '..', src)), 'fichier image absent : ' + src);
});
ok(script.indexOf('focusEstAdmin') !== -1, 'contrôle admin manquant');
ok(lire('js/registre.js').indexOf('pages/pomodoro.html') !== -1, 'page non enregistrée');
ok(lire('js/registre.js').indexOf('js/pages/pomodoro-page.js') !== -1, 'script non enregistré');

var memoire = lire('js/memoire.js');
ok(memoire.indexOf("etape === 'pomodoro'") !== -1, 'un rafraîchissement ne doit pas rouvrir Pomodoro');
ok(memoire.indexOf('panelPomodoro') === -1, 'Pomodoro ne doit pas être restauré comme page active');

ok(lire('js/pages/planning-base.js').indexOf('var COURS_FIN = 16 * 60 + 25;') !== -1, 'les cours doivent finir à 16 h 25');
ok(lire('pages/onboarding-activites.html').indexOf('16h35') === -1, 'l\'ancien horaire 16h35 reste affiché');
ok(lire('js/pages/onboarding-activites.js').indexOf('16 * 60 + 25') !== -1, 'le refus d\'activité doit s\'arrêter à 16 h 25');

if (echecs.length) {
    console.error('échecs ' + echecs.length);
    echecs.forEach(function (e) { console.error('- ' + e); });
    process.exit(1);
}
console.log('échecs 0');
