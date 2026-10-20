/* ============================================================
   La fin d'un chronomètre : un bip doux, puis une voix qui
   annonce la pause. Rien de tout cela ne s'écrit à l'écran.

   Le son passe par l'AudioContext du navigateur (et non par un
   lecteur audio créé à la fin) : commencé sur le geste de départ,
   il a le droit de parler vingt-cinq minutes plus tard, même sur
   un téléphone. Les fichiers sont en WAV : toutes les plateformes
   les lisent, sans dépendre de leur décodeur MP3.

   À la pause, la musique d'ambiance s'arrête complètement avant
   que la voix parle : on l'entend, elle, sans la pluie par-dessus.
   ============================================================ */

var CHRONO_VOIX_DOSSIER = 'audio/voix/';
var CHRONO_VOIX_VERSION = '20261020c';
var CHRONO_VOIX_EXT = '.wav';

/* ── Comment on prononce les nombres, de 1 à 60 ────────────────────────
   La grammaire française, pas une devinette :
     · le nombre de MINUTES est féminin — « une minute », « vingt et une
       minutes », jamais « vingt et un minutes » ;
     · de 21 à 29, 31 à 39, 41 à 49, 51 à 59, le « et » ne s'emploie
       que devant « un » : vingt et une, trente et une… puis vingt-deux,
       trente-trois ;
     · 17, 18 et 19 sont des mots à part entière : « dix-sept »,
       « dix-huit » (liaison en z), « dix-neuf » — et non « dix » suivi
       d'un chiffre ;
     · 60 se dit « soixante » ; au-delà, le site ne va pas (une pause
       est bornée à 60 minutes).

   Les mots ci-dessous sont ceux qu'on écrit pour la voix de secours :
   aucun chiffre, jamais — c'est un nombre en chiffres qui se faisait
   lire « five » ou « 5 » par une machine qui compte à l'anglaise. */
var CHRONO_VOIX_MOTS = {
    1: 'une', 2: 'deux', 3: 'trois', 4: 'quatre', 5: 'cinq', 6: 'six',
    7: 'sept', 8: 'huit', 9: 'neuf', 10: 'dix', 11: 'onze', 12: 'douze',
    13: 'treize', 14: 'quatorze', 15: 'quinze', 16: 'seize',
    17: 'dix-sept', 18: 'dix-huit', 19: 'dix-neuf', 20: 'vingt',
    30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante'
};

var chronoVoixCtx = null;
var chronoVoixTampons = {};        /* nom -> son décodé, prêt à jouer */
var chronoVoixChargements = {};    /* nom -> chargement en cours */
var chronoVoixAbsents = {};        /* nom -> introuvable sur l'appareil */
var chronoVoixSources = [];        /* ce qui joue, pour pouvoir couper */
var chronoSonsCoupes = null;       /* ambiances arrêtées par la pause */

/* Le numéro en toutes lettres, au féminin (minutes) :
   1 → une, 21 → vingt et une, 45 → quarante-cinq, 60 → soixante. */
function chronoNombreEnMots(nombre) {
    var n = Math.round(Number(nombre));
    if (!isFinite(n) || n < 1 || n > 60) return null;
    if (CHRONO_VOIX_MOTS[n]) return CHRONO_VOIX_MOTS[n];
    var dizaine = Math.floor(n / 10) * 10;
    var unite = n % 10;
    var base = CHRONO_VOIX_MOTS[dizaine];
    if (!base || !unite) return null;
    if (unite === 1) return base + ' et une';
    return base + '-' + CHRONO_VOIX_MOTS[unite];
}

/* Les morceaux de voix d'un numéro, dans l'ordre. Chaque nombre a son
   morceau : « dix-huit » ne se recolle pas à partir de « dix » et
   « huit » sans perdre sa liaison. */
function chronoVoixMorceauxNombre(nombre) {
    var n = Math.round(Number(nombre));
    if (!isFinite(n) || n < 1) return null;
    if (n <= 20) return ['n-' + n];
    if (n < 60) {
        var dizaine = Math.floor(n / 10) * 10;
        var unite = n % 10;
        if (!unite) return ['n-' + dizaine];
        if (unite === 1) return ['n-' + dizaine, 'et', 'n-1'];
        return ['n-' + dizaine, 'n-' + unite];
    }
    if (n === 60) return ['n-60'];
    return null;
}

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
        var nombre = chronoVoixMorceauxNombre(m);
        if (nombre) noms = noms.concat(nombre);
    });
    noms.forEach(function (nom) { chronoVoixCharger(nom).catch(function () {}); });
}

/* ── La musique s'arrête avant que la voix parle ─────────────────────── */
/* Les ambiances sont des lecteurs partagés par la page Séance et le
   minuteur : on les coupe tous. Celles qui jouaient sont notées, pour
   revenir au prochain temps de concentration — pas pendant la pause. */
function chronoCouperMusique() {
    var actifs = [];
    try {
        if (typeof focusLecteurs !== 'undefined' && focusLecteurs) {
            Object.keys(focusLecteurs).forEach(function (id) {
                if (typeof focusSonActif === 'function' && focusSonActif(id)) actifs.push(id);
            });
        }
    } catch (e) {}
    chronoSonsCoupes = actifs.length ? actifs : null;
    try {
        if (typeof focusArreterSon === 'function') {
            focusArreterSon();
        } else if (typeof focusCouperSon === 'function') {
            focusCouperSon();
        }
    } catch (e) {}
    try {
        if (typeof accueilPeindreSons === 'function') accueilPeindreSons();
        if (typeof accueilPeindreBoutonSons === 'function') accueilPeindreBoutonSons();
    } catch (e) {}
}

/* Le prochain temps de concentration reprend les ambiances de l'élève. */
function chronoRendreMusique() {
    if (!chronoSonsCoupes || !chronoSonsCoupes.length) return;
    var ids = chronoSonsCoupes;
    chronoSonsCoupes = null;
    try {
        if (typeof focusLireSon === 'function') {
            ids.forEach(function (id) {
                try { focusLireSon(id); } catch (e) {}
            });
        }
        if (typeof focusPeindreSons === 'function') focusPeindreSons();
        if (typeof focusPeindreSonBouton === 'function') focusPeindreSonBouton();
    } catch (e) {}
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
        dit.rate = 0.92;
        dit.pitch = 1.05;
        dit.volume = 1;
        var voix = (window.speechSynthesis.getVoices() || []).filter(function (v) {
            return /^fr/i.test(v.lang || '') &&
                /amelie|amélie|audrey|aurelie|aurélie|julie|harmonie|aure|female|femme/i.test(v.name || '');
        });
        if (voix.length) dit.voice = voix[0];
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(dit);
    } catch (e) {}
}

/* La phrase de secours : les nombres en toutes lettres, accords compris. */
function chronoPhrasePause(minutes) {
    var n = Math.round(Number(minutes)) || 1;
    var mots = chronoNombreEnMots(n);
    if (!mots) return 'Votre séance de révision est terminée. Vous avez droit maintenant à une pause.';
    return 'Votre séance de révision est terminée. Vous avez droit maintenant à '
        + mots + (n > 1 ? ' minutes' : ' minute') + ' de pause.';
}

/* La phrase complète, morceau par morceau. */
function chronoVoixPhrasePause(minutes) {
    var n = Math.round(Number(minutes));
    if (!isFinite(n) || n < 1) return null;
    var nombre = chronoVoixMorceauxNombre(n);
    if (!nombre) return null;
    return ['seance-fin'].concat(nombre, [n > 1 ? 'minutes-de-pause' : 'minute-de-pause']);
}

/* Fin d'une concentration : la musique s'arrête, le bip retentit, puis la
   voix donne la pause exacte de la configuration de l'élève. */
function chronoAnnoncerPause(minutes) {
    var n = Math.round(Number(minutes));
    if (!isFinite(n) || n < 1) n = 5;
    chronoCouperMusique();
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
