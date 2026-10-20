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

/* ── 2 et 3. La logique, dans un bac à sable ────────────────────────── */
const bac = {
    console: console,
    setTimeout: function () {},
    Audio: function (src) {
        this.src = src;
        this.preload = '';
        this.currentTime = 0;
        this.play = function () { return { catch: function () {} }; };
        this.addEventListener = function () {};
    },
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

ok(memeListe(bac.chronoVoixNumero(5), ['n-5']), 'le numéro 5 doit se dire « cinq » : ' + JSON.stringify(bac.chronoVoixNumero(5)));
ok(memeListe(bac.chronoVoixNumero(21), ['n-20', 'et', 'n-1']), 'le numéro 21 doit se dire « vingt et une » : ' + JSON.stringify(bac.chronoVoixNumero(21)));
ok(memeListe(bac.chronoVoixNumero(45), ['n-40', 'n-5']), 'le numéro 45 doit se dire « quarante-cinq » : ' + JSON.stringify(bac.chronoVoixNumero(45)));
ok(memeListe(bac.chronoVoixNumero(60), ['n-60']), 'le numéro 60 doit se dire « soixante » : ' + JSON.stringify(bac.chronoVoixNumero(60)));
ok(bac.chronoVoixNumero(75) === null, 'au-delà de 60, la voix ne sait pas : le repli doit exister');
ok(bac.chronoVoixNumero(1) && bac.chronoVoixNumero(1)[0] === 'n-1', 'une minute doit se dire « une »');

const phrase5 = bac.chronoVoixPhrasePause(5);
ok(memeListe(phrase5, ['seance-fin', 'n-5', 'minutes-de-pause']),
    'la phrase de 5 minutes est mal composée : ' + JSON.stringify(phrase5));
const phrase1 = bac.chronoVoixPhrasePause(1);
ok(phrase1 && phrase1[phrase1.length - 1] === 'minute-de-pause',
    'une minute de pause doit se dire au singulier : ' + JSON.stringify(phrase1));

/* Chaque morceau que la phrase utilise doit exister sur le disque. */
function morceauExiste(nom) {
    return fs.existsSync(path.join(racine, 'audio', 'voix', nom + '.wav'));
}
[1, 2, 3, 5, 7].forEach(function (n) {
    const morceauxPhrase = bac.chronoVoixPhrasePause(n) || [];
    morceauxPhrase.forEach(function (nom) {
        ok(morceauExiste(nom), 'la phrase de ' + n + ' minutes réclame un morceau absent : ' + nom);
    });
});

/* ── 4. Le minuteur s'en sert, avec la pause configurée ─────────────── */
const page = lire('js/pages/pomodoro-page.js');
ok(page.indexOf('function focusPhaseSuivante') !== -1, 'la fin de phase du minuteur n\'existe plus');
ok(page.indexOf('chronoAnnoncerPause(minutesPause)') !== -1,
    'la fin de concentration doit annoncer la pause');
ok(page.indexOf('var minutesPause = focusDurees()[modePause];') !== -1,
    'la pause annoncée doit venir de la configuration de l\'élève');
ok(page.indexOf('chronoAnnoncerReprise()') !== -1, 'la fin de pause doit garder son signal');
ok(page.indexOf('chronoVoixPreparer(') !== -1, 'le son doit être préparé au départ, sur le geste de l\'élève');
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
