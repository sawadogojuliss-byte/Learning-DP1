/* ============================================================
   La fin d'un chronomètre : un bip doux, puis une voix qui
   annonce la pause. Rien de tout cela ne s'écrit à l'écran.

   Le son passe par l'AudioContext du navigateur (et non par un
   lecteur audio créé à la fin) : commencé sur le geste de départ,
   il a le droit de parler vingt-cinq minutes plus tard, même sur
   un téléphone. Les fichiers sont en WAV : toutes les plateformes
   les lisent, sans dépendre de leur décodeur MP3.
   ============================================================ */

var CHRONO_VOIX_DOSSIER = 'audio/voix/';
var CHRONO_VOIX_VERSION = '20261020b';
var CHRONO_VOIX_EXT = '.wav';

/* Une phrase se compose de morceaux enregistrés séparément : le début,
   le nombre de minutes, puis « minutes de pause ». Le nombre est lu dans
   les fichiers, jamais inventé : une voix identique du début à la fin. */
var CHRONO_VOIX_NUMEROS = (function () {
    var noms = {};
    var i;
    for (i = 1; i <= 20; i++) noms[i] = ['n-' + i];
    for (i = 2; i <= 6; i++) noms[i * 10] = ['n-' + (i * 10)];
    return noms;
})();

var chronoVoixCtx = null;
var chronoVoixTampons = {};        /* nom -> son décodé, prêt à jouer */
var chronoVoixChargements = {};    /* nom -> chargement en cours */
var chronoVoixAbsents = {};        /* nom -> introuvable sur l'appareil */
var chronoVoixSources = [];        /* ce qui joue, pour pouvoir couper */

function chronoVoixUrl(nom) {
    return CHRONO_VOIX_DOSSIER + nom + CHRONO_VOIX_EXT + '?v=' + CHRONO_VOIX_VERSION;
}

/* Le contexte audio, ouvert (ou réveillé) à chaque besoin : c'est lui qui
   garde le droit de parler, pas le lecteur d'un fichier. */
function chronoVoixContexte() {
    try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        if (!chronoVoixCtx) chronoVoixCtx = new AC();
        if (chronoVoixCtx.state === 'suspended' && chronoVoixCtx.resume) chronoVoixCtx.resume();
        return chronoVoixCtx;
    } catch (e) { return null; }
}

/* Le bip : deux notes douces, la seconde plus grave, jamais stridentes. */
function chronoBipDoux() {
    try {
        var ctx = chronoVoixContexte();
        if (!ctx) return;
        var now = ctx.currentTime;
        [880, 660].forEach(function (frequence, i) {
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            var debut = now + i * 0.42;
            osc.type = 'sine';
            osc.frequency.value = frequence;
            gain.gain.setValueAtTime(0.0001, debut);
            gain.gain.exponentialRampToValueAtTime(0.22, debut + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, debut + 0.34);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(debut);
            osc.stop(debut + 0.36);
        });
    } catch (e) {}
}

/* Un numéro — « cinq », « quinze », « vingt-deux », « quarante-cinq » —
   à partir des morceaux déjà là. Renvoie null si le nombre sort de ce
   que la voix enregistrée sait dire. */
function chronoVoixNumero(nombre) {
    var n = Math.round(Number(nombre));
    if (!isFinite(n) || n < 1) return null;
    if (CHRONO_VOIX_NUMEROS[n]) return CHRONO_VOIX_NUMEROS[n].slice();
    if (n > 20 && n < 60) {
        var dizaine = Math.floor(n / 10) * 10;
        var unite = n % 10;
        var base = CHRONO_VOIX_NUMEROS[dizaine];
        if (!base) return null;
        if (!unite) return base.slice();
        var suite = base.slice();
        if (unite === 1) suite.push('et');
        suite.push('n-' + unite);
        return suite;
    }
    return null;
}

/* La phrase entière de fin de concentration : le début, le nombre de
   minutes de pause demandé par la configuration, puis la fin. */
function chronoVoixPhrasePause(minutes) {
    var n = Math.round(Number(minutes));
    if (!isFinite(n) || n < 1) return null;
    var nombre = chronoVoixNumero(n);
    if (!nombre) return null;
    return ['seance-fin'].concat(nombre, [n > 1 ? 'minutes-de-pause' : 'minute-de-pause']);
}

/* Charge un morceau une seule fois, puis le garde décodé en mémoire :
   la deuxième fois, il démarre sans le moindre téléchargement. */
function chronoVoixCharger(nom) {
    if (chronoVoixTampons[nom]) return Promise.resolve(chronoVoixTampons[nom]);
    if (chronoVoixChargements[nom]) return chronoVoixChargements[nom];
    var ctx = chronoVoixContexte();
    if (!ctx) return Promise.reject(new Error('audio indisponible'));
    chronoVoixChargements[nom] = fetch(chronoVoixUrl(nom), { cache: 'force-cache' }).then(function (reponse) {
        if (!reponse.ok) throw new Error('absent : ' + nom);
        return reponse.arrayBuffer();
    }).then(function (octets) {
        return new Promise(function (ok, ko) {
            var suite = ctx.decodeAudioData(octets, ok, ko);
            if (suite && suite.then) suite.then(ok, ko);
        });
    }).then(function (tampon) {
        chronoVoixTampons[nom] = tampon;
        return tampon;
    }).catch(function (erreur) {
        chronoVoixAbsents[nom] = true;
        throw erreur;
    });
    return chronoVoixChargements[nom];
}

/* Prépare les morceaux utiles (au démarrage du chronomètre, sur le geste
   de l'élève : le navigateur autorise alors le son pour la suite). La
   pause courte ET la pause longue sont chargées : la quatrième séance
   annonce la longue sans avoir le temps de la télécharger. */
function chronoVoixPreparer(minutes) {
    chronoVoixContexte();
    var noms = ['seance-fin', 'minutes-de-pause', 'minute-de-pause', 'et'];
    var pauses = [];
    if (Array.isArray(minutes)) pauses = minutes.slice();
    else if (minutes != null) pauses = [minutes];
    try {
        if (typeof focusDurees === 'function') {
            var reglages = focusDurees();
            pauses.push(reglages.short, reglages.long);
        }
    } catch (e) {}
    pauses.forEach(function (m) {
        var nombre = chronoVoixNumero(m);
        if (nombre) noms = noms.concat(nombre);
    });
    noms.forEach(function (nom) { chronoVoixCharger(nom).catch(function () {}); });
}

/* Coupe net ce qui joue : un morceau manquant ne laisse pas la phrase
   à moitié dite sous la voix de secours. */
function chronoVoixArreter() {
    chronoVoixSources.forEach(function (source) {
        try { source.stop(); } catch (e) {}
    });
    chronoVoixSources = [];
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {}
}

/* Joue les morceaux à la suite, sans trou : chacun démarre quand le
   précédent se termine. */
function chronoVoixJouerListe(noms, suite) {
    var ctx = chronoVoixContexte();
    if (!ctx) { if (suite) suite(false); return; }
    Promise.all(noms.map(chronoVoixCharger)).then(function (tampons) {
        var quand = ctx.currentTime + 0.08;
        tampons.forEach(function (tampon) {
            var source = ctx.createBufferSource();
            source.buffer = tampon;
            source.connect(ctx.destination);
            source.start(quand);
            quand += tampon.duration + 0.07;
            chronoVoixSources.push(source);
        });
        var attente = Math.max(0, (quand - ctx.currentTime) * 1000 + 150);
        setTimeout(function () { if (suite) suite(true); }, attente);
    }, function () {
        if (suite) suite(false);
    });
}

/* Si un morceau manque sur l'appareil, une voix française du navigateur
   prend le relais : la phrase reste dite, jamais un silence inexpliqué. */
function chronoVoixSynthese(phrase) {
    try {
        if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance !== 'function') return;
        var dit = new SpeechSynthesisUtterance(phrase);
        dit.lang = 'fr-FR';
        dit.rate = 0.95;
        dit.pitch = 1.05;
        dit.volume = 1;
        var voix = (window.speechSynthesis.getVoices() || []).filter(function (v) {
            return /^fr/i.test(v.lang || '') && /amelie|amélie|audrey|aurelie|aurélie|julie|harmonie|aure|female|femme/i.test(v.name || '');
        });
        if (voix.length) dit.voice = voix[0];
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(dit);
    } catch (e) {}
}

function chronoPhrasePause(minutes) {
    var n = Math.round(Number(minutes)) || 1;
    return 'Votre séance de révision est terminée. Vous avez droit maintenant à '
        + n + (n > 1 ? ' minutes' : ' minute') + ' de pause.';
}

/* Fin d'une concentration : bip, puis la voix qui donne la pause exacte
   de la configuration de l'élève (5, 15, 20 minutes…). */
function chronoAnnoncerPause(minutes) {
    var n = Math.round(Number(minutes));
    if (!isFinite(n) || n < 1) n = 5;
    chronoBipDoux();
    var noms = chronoVoixPhrasePause(n);
    setTimeout(function () {
        var manque = !noms || noms.some(function (nom) { return chronoVoixAbsents[nom]; });
        if (manque) {
            chronoVoixArreter();
            chronoVoixSynthese(chronoPhrasePause(n));
            return;
        }
        chronoVoixJouerListe(noms, function (ok) {
            if (ok) return;
            chronoVoixArreter();
            chronoVoixSynthese(chronoPhrasePause(n));
        });
    }, 760);
}

/* Fin d'une pause : le bip seul si aucune voix n'est enregistrée pour
   cette phrase ; sinon elle est dite, avec la même voix. */
function chronoAnnoncerReprise() {
    chronoBipDoux();
    if (chronoVoixAbsents['pause-fin']) return;
    setTimeout(function () {
        chronoVoixJouerListe(['pause-fin'], null);
    }, 760);
}
