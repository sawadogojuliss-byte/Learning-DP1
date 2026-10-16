/* Vérifie la page de chargement : la lumière qui respire, la barre qui suit le
   vrai chargement, le message d'erreur qui reste visible, et le mouvement
   réduit respecté. Aucun navigateur nécessaire. */
var fs = require('fs');
var vm = require('vm');

var echecs = 0;
function ok(cond, message) {
    if (cond) return;
    echecs += 1;
    console.error('échec:', message);
}

var html = fs.readFileSync('index.html', 'utf8');
var boot = fs.readFileSync('js/boot.js', 'utf8');

/* ── La lumière qui respire ────────────────────────────────────────── */
[
    ['class="boot-boite"', 'le bloc de la lumière manque'],
    ['class="boot-halo"', 'la lumière derrière le logo manque'],
    ['class="boot-logo"', 'le logo animé manque'],
    ['@keyframes bootHalo', 'l\'animation de la lumière manque'],
    ['@keyframes bootLogo', 'l\'animation du logo manque'],
    ['animation: bootHalo 2.4s ease-in-out infinite', 'la lumière doit respirer en boucle'],
    ['animation: bootLogo 2.4s ease-in-out infinite', 'le logo doit respirer en boucle'],
    ['radial-gradient(circle, rgba(16, 185, 129, 0.35)', 'la lumière doit rester verte'],
    ['animation: none', 'le mouvement réduit doit couper les animations'],
    ['prefers-reduced-motion', 'le mouvement réduit doit être respecté']
].forEach(function (paire) {
    ok(html.indexOf(paire[0]) !== -1, paire[1]);
});

/* ── La barre qui avance vraiment ──────────────────────────────────── */
ok(html.indexOf('id="boot-jauge"') !== -1, 'la barre de chargement manque');
ok(html.indexOf('id="boot-jauge-fill"') !== -1, 'le remplissage de la barre manque');
ok(/role="progressbar"/.test(html), 'la barre doit être annoncée comme une progression');
ok(html.indexOf('aria-valuenow="6"') !== -1, 'la barre doit démarrer à 6 %');
ok(html.indexOf('Chargement de Study Plan IB') !== -1, 'le texte de chargement doit rester');
ok(boot.indexOf('function avancer(fait, total)') !== -1, 'le calcul d\'avancement manque');
ok(boot.indexOf('avancer(etapesFaites, etapesTotales)') !== -1, 'la barre doit suivre chaque étape');
ok((boot.match(/avancer\(/g) || []).length >= 4, 'la barre doit avancer à chaque page et chaque script');
ok(boot.indexOf('Math.min(100') !== -1, 'la barre ne doit jamais dépasser 100 %');
ok(boot.indexOf("document.body.classList.add('boot-fini')") !== -1, 'l\'écran doit s\'effacer en douceur');
ok(html.indexOf('body.boot-fini .boot-status { opacity: 0; }') !== -1, 'l\'effacement doit être progressif');
ok(html.indexOf('body:not(.booting) .boot-status { display: none; }') !== -1, 'l\'écran doit disparaître une fois prêt');

/* ── Un échec doit rester visible ──────────────────────────────────── */
ok(boot.indexOf("classList.add('boot-erreur')") !== -1, 'l\'erreur doit garder l\'écran visible');
ok(html.indexOf('body.boot-erreur .boot-status { display: flex; opacity: 1; }') !== -1,
    'l\'écran d\'erreur doit rester affiché');
ok(html.indexOf('body.boot-erreur .boot-boite, body.boot-erreur .boot-jauge { display: none; }') !== -1,
    'la lumière et la barre doivent s\'effacer devant le message d\'erreur');
ok(boot.indexOf("mot.textContent = message") !== -1, 'le message d\'erreur doit remplacer le texte de chargement');

/* ── Le cache et la version suivent ────────────────────────────────── */
var version = (boot.match(/var version = '([^']+)'/) || [])[1] || '';
ok(!!version, 'la version du cache manque');
ok(new RegExp('images/logo.png\\?v=' + version).test(html), 'le logo doit porter la version du cache');
ok(html.indexOf('js/boot.js?v=' + version) !== -1, 'le démarrage doit porter la version du cache');

var apertures = (html.match(new RegExp('\\?v=' + version, 'g')) || []).length;
ok(apertures >= 10, 'tous les fichiers doivent porter la version du cache : ' + apertures);

if (echecs) {
    console.error(echecs + ' échec(s)');
    process.exit(1);
}
console.log('chargement: lumière qui respire, barre réelle, erreur visible (0 échec)');
