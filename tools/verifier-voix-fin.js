#!/usr/bin/env node
/* ============================================================
   Vérificateur — la fin de chronomètre
   1. Le module est chargé avant le minuteur, et les morceaux de la
      voix sont présents et entiers.
   2. Un numéro se dit avec la voix enregistrée : 5, 15, 21, 45, 60.
   3. La phrase de fin de séance suit la configuration : « une minute »
      au singulier, plusieurs au pluriel.
   4. Le minuteur annonce la pause de la configuration de l'élève,
      prépare le son au départ, et garde le bip quand la voix manque.
   5. Rien de tout cela ne s'écrit sur le site : aucune page ne parle
      du bip ni de la voix.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const racine = path.join(__dirname, '..');
const echecs = [];
function ok(cond, message) { if (!cond) echecs.push(message); }
function lire(rel) { return fs.readFileSync(path.join(racine, rel), 'utf8'); }

/* ── 1. Le module et ses morceaux ───────────────────────────────────── */
const registre = lire('js/registre.js');
const moduleSrc = lire('js/pages/chrono-voix.js');
ok(registre.indexOf("'js/pages/chrono-voix.js'") !== -1, 'le module de fin de chronomètre n\'est pas chargé');
ok(registre.indexOf('js/pages/chrono-voix.js') < registre.indexOf('js/pages/pomodoro-page.js'),
    'le module doit se charger avant le minuteur');
ok(moduleSrc.indexOf('formulaire') === -1 && moduleSrc.indexOf('document.getElementById') === -1,
    'le module de son ne doit rien afficher dans la page');

const morceaux = ['seance-fin', 'minutes-de-pause', 'minute-de-pause'];
for (let i = 1; i <= 7; i++) morceaux.push('n-' + i);
morceaux.forEach(function (nom) {
    const f = path.join(racine, 'audio', 'voix', nom + '.wav');
    ok(fs.existsSync(f), 'morceau de voix manquant : ' + nom + '.wav');
    if (fs.existsSync(f)) ok(fs.statSync(f).size > 2000, 'morceau de voix tronqué : ' + nom + '.wav');
});
/* Le son doit passer par l'AudioContext (autorisé dès le geste de départ),
   pas par un lecteur créé à la fin : sinon un téléphone refuse de parler. */
ok(moduleSrc.indexOf('decodeAudioData') !== -1, 'les morceaux doivent être décodés pour l\'AudioContext');
ok(moduleSrc.indexOf('createBufferSource') !== -1, 'la voix doit se jouer dans l\'AudioContext');
ok(moduleSrc.indexOf("CHRONO_VOIX_EXT = '.wav'") !== -1, 'la voix doit être en WAV, lisible partout');
/* Trois chemins : tampons décodés, lecteurs ordinaires, voix du navigateur.
   Si le premier échoue sur un appareil, le suivant prend le relais. */
ok(moduleSrc.indexOf('function chronoVoixJouerTampons') !== -1, 'le premier chemin (AudioContext) manque');
ok(moduleSrc.indexOf('function chronoVoixJouerLecteurs') !== -1, 'le second chemin (lecteurs audio) manque');
ok(/function chronoAnnoncerPause[\s\S]{0,700}chronoVoixJouerLecteurs\(noms[\s\S]{0,200}chronoVoixSynthese/.test(moduleSrc),
    'la voix doit essayer les trois chemins, sans jamais rester muette');
ok(moduleSrc.indexOf('delete chronoVoixChargements[nom]') !== -1,
    'un chargement raté doit pouvoir être retenté (pas de panne définitive)');
ok(moduleSrc.indexOf('lecteur.pause()') !== -1,
    'la musique doit être arrêtée sur les lecteurs eux-mêmes, avant toute repeinture');
/* Le site doit pouvoir se mettre à jour sans qu'on le lui demande : sans
   cela, un élève garde le code d'hier dans son onglet. */
const boot = lire('js/boot.js');
ok(boot.indexOf('function seMettreAJour') !== -1 || boot.indexOf('(function seMettreAJour') !== -1,
    'le site doit vérifier sa version au démarrage');
ok(boot.indexOf("cache: 'no-store'") !== -1, 'la version publiée doit être lue sans cache');
ok(boot.indexOf('location.replace') !== -1, 'une version plus récente doit recharger la page');

/* ── 2 et 3. La logique, dans un bac à sable ────────────────────────── */
const bac = {
    console: console,
    setTimeout: function () {},
    Promise: Promise,
    fetch: function () { return Promise.reject(new Error('hors ligne')); },
    Audio: function () { this.play = function () { return { catch: function () {} }; }; this.addEventListener = function () {}; },
    SpeechSynthesisUtterance: function (texte) { this.text = texte; },
    speechSynthesis: { speak: function () {}, cancel: function () {}, getVoices: function () { return []; } },
    window: {}
};
bac.window = bac;
bac.window.AudioContext = null;
vm.createContext(bac);
vm.runInContext(moduleSrc, bac, { filename: 'chrono-voix.js' });

function memeListe(a, b) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every(function (x, i) { return x === b[i]; });
}

/* Les mots : la grammaire française, au féminin (minutes). */
const attendus = {
    1: 'une', 2: 'deux', 5: 'cinq', 7: 'sept', 10: 'dix', 11: 'onze',
    16: 'seize', 17: 'dix-sept', 18: 'dix-huit', 19: 'dix-neuf', 20: 'vingt',
    21: 'vingt et une', 22: 'vingt-deux', 29: 'vingt-neuf', 30: 'trente',
    31: 'trente et une', 35: 'trente-cinq', 40: 'quarante', 41: 'quarante et une',
    45: 'quarante-cinq', 50: 'cinquante', 51: 'cinquante et une',
    60: 'soixante'
};
Object.keys(attendus).forEach(function (cle) {
    const n = Number(cle);
    ok(bac.chronoNombreEnMots(n) === attendus[cle],
        'le nombre ' + n + ' doit se dire « ' + attendus[cle] + ' » : '
        + JSON.stringify(bac.chronoNombreEnMots(n)));
});
/* aucun chiffre ne doit rester dans une phrase : c'est ce qui se lisait
   « five minutes » sur une machine qui compte à l'anglaise */
for (let n = 1; n <= 60; n++) {
    const phrase = bac.chronoPhrasePause(n);
    ok(!/[0-9]/.test(phrase), 'la phrase pour ' + n + ' minutes contient encore un chiffre : ' + phrase);
    ok(bac.chronoNombreEnMots(n) !== null, 'le nombre ' + n + ' n\'a pas de mots');
}
ok(bac.chronoPhrasePause(1).indexOf('une minute de pause') !== -1,
    'une minute doit être dite au singulier : ' + bac.chronoPhrasePause(1));
ok(bac.chronoPhrasePause(21).indexOf('vingt et une minutes de pause') !== -1,
    'vingt et une minutes doit s\'accorder au féminin : ' + bac.chronoPhrasePause(21));

/* Chaque nombre de 1 à 60 se compose avec des morceaux qui existent tous :
   la voix enregistrée suffit, sans passer par la machine du navigateur. */
function morceauExiste(nom) {
    return fs.existsSync(path.join(racine, 'audio', 'voix', nom + '.wav'));
}
for (let n = 1; n <= 60; n++) {
    const morceaux = bac.chronoVoixMorceauxNombre(n);
    ok(Array.isArray(morceaux) && morceaux.length > 0, 'le nombre ' + n + ' n\'a pas de morceaux de voix');
    (morceaux || []).forEach(function (nom) {
        ok(morceauExiste(nom), 'morceau manquant pour ' + n + ' : ' + nom + '.wav');
    });
}
ok(memeListe(bac.chronoVoixMorceauxNombre(21), ['n-20', 'et', 'n-1']),
    'vingt et une se compose de « vingt », « et », « une » : ' + JSON.stringify(bac.chronoVoixMorceauxNombre(21)));
ok(memeListe(bac.chronoVoixMorceauxNombre(45), ['n-40', 'n-5']),
    'quarante-cinq se compose de « quarante » et « cinq » : ' + JSON.stringify(bac.chronoVoixMorceauxNombre(45)));

const phrase5 = bac.chronoVoixPhrasePause(5);
ok(memeListe(phrase5, ['seance-fin', 'n-5', 'minutes-de-pause']),
    'la phrase de 5 minutes est mal composée : ' + JSON.stringify(phrase5));
const phrase1 = bac.chronoVoixPhrasePause(1);
ok(phrase1 && phrase1[phrase1.length - 1] === 'minute-de-pause',
    'une minute de pause doit se dire au singulier : ' + JSON.stringify(phrase1));

/* ── 4. Le minuteur s'en sert, avec la pause configurée ─────────────── */
const page = lire('js/pages/pomodoro-page.js');
ok(page.indexOf('function focusPhaseSuivante') !== -1, 'la fin de phase du minuteur n\'existe plus');
ok(page.indexOf('chronoAnnoncerPause(minutesPause)') !== -1,
    'la fin de concentration doit annoncer la pause');
ok(page.indexOf('var minutesPause = focusDurees()[modePause];') !== -1,
    'la pause annoncée doit venir de la configuration de l\'élève');
ok(page.indexOf('chronoAnnoncerReprise()') !== -1, 'la fin de pause doit garder son signal');
ok(page.indexOf('chronoVoixPreparer(') !== -1, 'le son doit être préparé au départ, sur le geste de l\'élève');
ok(page.indexOf('chronoRendreMusique()') !== -1, 'la musique doit revenir au temps de concentration suivant');
ok(moduleSrc.indexOf('function chronoCouperMusique') !== -1, 'le module doit savoir couper la musique');
ok(/function chronoAnnoncerPause[\s\S]{0,220}chronoCouperMusique\(\)/.test(moduleSrc),
    'la musique doit être coupée AVANT que la voix parle');
ok(page.indexOf('else focusBip(2)') !== -1 && page.indexOf('else focusBip(1)') !== -1,
    'le bip doit rester quand la voix n\'est pas disponible');
/* Rien ne se relance tout seul : la phase suivante est proposée, pas lancée. */
ok(page.indexOf('focusEtat.running = false;\n    focusStopIntervalle();') !== -1,
    'la fin de phase doit arrêter le chronomètre');
ok(page.indexOf("focusChoisirMode(modePause, false)") !== -1,
    'la pause doit être proposée sans démarrer');
ok(page.indexOf("focusChoisirMode('focus', false)") !== -1,
    'la concentration suivante doit être proposée sans démarrer');
ok(page.indexOf('focusChoisirMode(modePause, true)') === -1 &&
   page.indexOf("focusChoisirMode('focus', true)") === -1,
    'plus aucune phase ne doit s\'enchaîner automatiquement');

/* Une pause réglée à 15 minutes doit être dite « quinze minutes » :
   le nombre suit la configuration, jamais une valeur écrite à part. */
const durees = lire('js/pages/pomodoro-page.js');
ok(/short: focusBorner\(sauve\.short, 5, 1, 60\)/.test(durees), 'la pause courte doit rester réglable');
ok(/long: focusBorner\(sauve\.long, 15, 1, 60\)/.test(durees), 'la pause longue doit rester réglable');

/* ── 5. Aucune description à l'écran ───────────────────────────────── */
['pages/pomodoro.html', 'pages/seances.html', 'pages/planning.html'].forEach(function (f) {
    const html = lire(f);
    ok(!/[Bb]ip/.test(html), 'la page ' + f + ' ne doit pas décrire le bip');
    ok(!/[Vv]oix/.test(html), 'la page ' + f + ' ne doit pas décrire la voix');
});

if (echecs.length) {
    console.error('Fin de chronomètre : échecs ' + echecs.length);
    echecs.forEach(function (e) { console.error(' - ' + e); });
    process.exit(1);
}
console.log('ok fin de chronomètre : bip, voix féminine et pause de la configuration');
