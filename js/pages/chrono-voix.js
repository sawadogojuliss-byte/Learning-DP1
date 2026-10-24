/* ============================================================
   La fin d'un chronomètre : un bip doux, puis une voix qui
   annonce la pause. Rien de tout cela ne s'écrit à l'écran.

   Trois chemins pour parler, du meilleur au plus simple — le
   premier qui marche gagne, sans que personne ait à s'en occuper :
     1. les morceaux décodés joués par l'AudioContext ouvert au
        moment du clic « Démarrer » (aucune permission à redemander
        vingt-cinq minutes plus tard) ;
     2. les mêmes fichiers lus par des lecteurs audio ordinaires,
        si le décodage échoue sur l'appareil ;
     3. la voix française du navigateur, avec la phrase en toutes
        lettres — jamais un chiffre, qui se lirait à l'anglaise.
   Si même la voix du navigateur manque, le bip reste : le signal
   de fin ne disparaît jamais.

   Et avant que la voix parle, la musique d'ambiance s'arrête : on
   entend la voix seule, sans la pluie par-dessus.
   ============================================================ */

var chronoAnnonceEnCours = false;
var chronoAnnonceGeneration = 0;
var chronoSonsAttente = [];
function chronoVoixActive() {
    try { return localStorage.getItem('studyPlanIB_voixActive') !== 'false'; } catch (e) { return true; }
}
function chronoVoixVolume() {
    try { var lu = localStorage.getItem('studyPlanIB_voixVolume'); if (lu === null) return 0.7; var v = Number(lu); return isFinite(v) && v >= 0 && v <= 1 ? v : 0.7; } catch (e) { return 0.7; }
}
function chronoChargerReglagesVoix() {
    var active = document.getElementById('focusVoixActive'), volume = document.getElementById('focusVoixVolume');
    if (active) active.checked = chronoVoixActive();
    if (volume) volume.value = String(Math.round(chronoVoixVolume() * 100));
}
function chronoSauverReglagesVoix() {
    var active = document.getElementById('focusVoixActive'), volume = document.getElementById('focusVoixVolume');
    try {
        if (active) localStorage.setItem('studyPlanIB_voixActive', String(active.checked));
        if (volume) localStorage.setItem('studyPlanIB_voixVolume', String(Math.min(1, Math.max(0, Number(volume.value) / 100))));
    } catch (e) {}
    if (!chronoVoixActive()) chronoVoixArreter();
}
function chronoMettreSonEnAttente(id) {
    if (chronoSonsAttente.indexOf(id) === -1) chronoSonsAttente.push(id);
}
function chronoFinAnnonce(generation) {
    if (generation !== chronoAnnonceGeneration) return;
    chronoAnnonceEnCours = false;
    var sons = chronoSonsAttente.slice();
    chronoSonsAttente = [];
    if (typeof focusEtat !== 'undefined' && focusEtat.mode === 'focus' && focusEtat.running) {
        sons.forEach(function (id) { if (typeof focusLireSon === 'function') focusLireSon(id); });
    }
}
var CHRONO_VOIX_DOSSIER = 'audio/voix/';
var CHRONO_VOIX_VERSION = '20261023a';
var CHRONO_VOIX_EXT = '.wav';

/* ── Comment on prononce les nombres, de 1 à 60 ────────────────────────
   La grammaire française, pas une devinette :
     · le nombre de MINUTES est féminin — « une minute », « vingt et une
       minutes », jamais « vingt et un minutes » ;
     · de 21 à 29, 31 à 39, 41 à 49, 51 à 59, le « et » ne s'emploie
       que devant « un » : vingt et une, trente et une… puis vingt-deux,
       trente-trois ;
     · 17, 18 et 19 sont des mots à part entière : « dix-sept »,
       « dix-huit » (liaison en z), « dix-neuf » ;
     · 60 se dit « soixante » ; au-delà, le site ne va pas (une pause
       est bornée à 60 minutes).

   Les mots ci-dessous sont ceux qu'on écrit pour la voix de secours :
   aucun chiffre, jamais — un nombre en chiffres se ferait lire « five »
   ou « 5 » par une machine qui compte à l'anglaise. */
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
var chronoVoixAbsents = {};        /* nom -> vraiment absent du site */
var chronoVoixSources = [];        /* ce qui joue, pour pouvoir couper */
var chronoVoixLecteurs = {};       /* nom -> lecteur audio ordinaire */
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
   la deuxième fois, il démarre sans le moindre téléchargement. Un échec
   n'est jamais définitif : seule une absence réelle (404) est retenue. */
function chronoVoixCharger(nom) {
    if (chronoVoixTampons[nom]) return Promise.resolve(chronoVoixTampons[nom]);
    if (chronoVoixChargements[nom]) return chronoVoixChargements[nom];
    var ctx = chronoVoixContexte();
    if (!ctx || !ctx.decodeAudioData || typeof fetch !== 'function') {
        return Promise.reject(new Error('décodage indisponible'));
    }
    chronoVoixChargements[nom] = fetch(chronoVoixUrl(nom), { cache: 'force-cache' }).then(function (reponse) {
        if (reponse && reponse.status === 404) chronoVoixAbsents[nom] = true;
        if (!reponse || !reponse.ok) throw new Error('non chargé : ' + nom);
        return reponse.arrayBuffer();
    }).then(function (octets) {
        return new Promise(function (ok, ko) {
            try {
                var suite = ctx.decodeAudioData(octets, ok, ko);
                if (suite && suite.then) suite.then(ok, ko);
            } catch (e) { ko(e); }
        });
    }).then(function (tampon) {
        chronoVoixTampons[nom] = tampon;
        delete chronoVoixAbsents[nom];
        return tampon;
    }).catch(function (erreur) {
        /* on oublie la tentative : la prochaine fois, on réessaie */
        delete chronoVoixChargements[nom];
        throw erreur;
    });
    return chronoVoixChargements[nom];
}

/* Un lecteur audio ordinaire pour le même morceau : le second chemin,
   quand l'appareil refuse de décoder pour l'AudioContext. */
function chronoVoixLecteur(nom) {
    if (chronoVoixLecteurs[nom]) return chronoVoixLecteurs[nom];
    if (typeof Audio !== 'function') return null;
    var son = new Audio(chronoVoixUrl(nom));
    son.preload = 'auto';
    son.volume = chronoVoixVolume();
    chronoVoixLecteurs[nom] = son;
    return son;
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
    noms.forEach(function (nom) {
        chronoVoixCharger(nom).catch(function () {});
        chronoVoixLecteur(nom);
    });
}

/* ── La musique s'arrête avant que la voix parle ─────────────────────── */
/* L'arrêt se fait d'abord sur les lecteurs eux-mêmes, avant toute
   repeinture : même si l'écran échoue à se redessiner, le son se tait.
   Les ambiances arrêtées sont notées pour revenir au temps de
   concentration suivant — jamais pendant la pause. */
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
        if (typeof focusLecteurs !== 'undefined' && focusLecteurs) {
            Object.keys(focusLecteurs).forEach(function (id) {
                var lecteur = focusLecteurs[id];
                if (!lecteur) return;
                try { lecteur.pause(); } catch (e) {}
                try { lecteur.currentTime = 0; } catch (e) {}
            });
        }
    } catch (e) {}

    try {
        if (typeof focusEtat !== 'undefined' && focusEtat) {
            focusEtat.son = 'off';
            focusEtat.enPause = false;
            focusEtat.sonPause = null;
        }
    } catch (e) {}

    try { if (typeof focusCouperSon === 'function') focusCouperSon(); } catch (e) {}
    try { if (typeof focusArreterSon === 'function') focusArreterSon(); } catch (e) {}
    try { if (typeof accueilPeindreSons === 'function') accueilPeindreSons(); } catch (e) {}
    try { if (typeof accueilPeindreBoutonSons === 'function') accueilPeindreBoutonSons(); } catch (e) {}
}

/* Le prochain temps de concentration reprend les ambiances de l'élève. */
function chronoRendreMusique() {
    if (chronoAnnonceEnCours) {
        (chronoSonsCoupes || []).forEach(chronoMettreSonEnAttente);
        chronoSonsCoupes = null;
        return;
    }
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
    Object.keys(chronoVoixLecteurs).forEach(function (nom) {
        var son = chronoVoixLecteurs[nom];
        try { son.pause(); } catch (e) {}
    });
    try {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch (e) {}
}

/* Premier chemin : les morceaux décodés, joués à la suite sans trou. */
function chronoVoixJouerTampons(noms, suite) {
    var ctx = chronoVoixContexte();
    if (!ctx) { if (suite) suite(false); return; }
    Promise.all(noms.map(chronoVoixCharger)).then(function (tampons) {
        if (!tampons.length) { if (suite) suite(false); return; }
        var quand = ctx.currentTime + 0.08;
        tampons.forEach(function (tampon) {
            var source = ctx.createBufferSource();
            source.buffer = tampon;
            var gain = ctx.createGain();
            gain.gain.value = chronoVoixVolume();
            source.connect(gain);
            gain.connect(ctx.destination);
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

/* Deuxième chemin : les mêmes fichiers, lus par des lecteurs ordinaires. */
function chronoVoixJouerLecteurs(noms, suite) {
    var i = 0;
    function suivant() {
        if (i >= noms.length) { if (suite) suite(true); return; }
        var son = chronoVoixLecteur(noms[i++]);
        if (!son) { if (suite) suite(false); return; }
        var fini = false;
        function apres(ok) {
            if (fini) return;
            fini = true;
            if (ok) suivant();
            else if (suite) suite(false);
        }
        try {
            son.addEventListener('ended', function () { apres(true); }, { once: true });
            son.addEventListener('error', function () { apres(false); }, { once: true });
            son.volume = chronoVoixVolume();
            son.currentTime = 0;
            var lecture = son.play();
            if (lecture && lecture.catch) lecture.catch(function () { apres(false); });
        } catch (e) { apres(false); }
    }
    suivant();
}

/* Troisième chemin : la voix du navigateur, phrase en toutes lettres. */
function chronoVoixSynthese(phrase) {
    function dire() {
        try {
            if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance !== 'function') return;
            var dit = new SpeechSynthesisUtterance(phrase);
            dit.lang = 'fr-FR';
            dit.rate = 0.92;
            dit.pitch = 1.05;
            dit.volume = chronoVoixVolume();
            var voix = (window.speechSynthesis.getVoices() || []).filter(function (v) {
                return /^fr/i.test(v.lang || '');
            });
            var douce = voix.filter(function (v) {
                return /amelie|amélie|audrey|aurelie|aurélie|julie|harmonie|aure|female|femme/i.test(v.name || '');
            });
            if (douce.length) dit.voice = douce[0];
            else if (voix.length) dit.voice = voix[0];
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(dit);
            if (window.speechSynthesis.resume) window.speechSynthesis.resume();
        } catch (e) {}
    }
    try {
        var voixDispo = (window.speechSynthesis.getVoices() || []).length;
        if (!voixDispo && window.speechSynthesis.addEventListener) {
            var déjà = false;
            window.speechSynthesis.addEventListener('voiceschanged', function () {
                if (déjà) return;
                déjà = true;
                dire();
            });
            setTimeout(function () { if (!déjà) { déjà = true; dire(); } }, 600);
            return;
        }
    } catch (e) {}
    dire();
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
    var generation = ++chronoAnnonceGeneration;
    chronoAnnonceEnCours = true;
    chronoCouperMusique();
    chronoBipDoux();
    var noms = chronoVoixPhrasePause(n);
    setTimeout(function () {
        if (generation !== chronoAnnonceGeneration) return;
        chronoVoixArreter();
        if (!chronoVoixActive()) { chronoFinAnnonce(generation); return; }
        if (!noms) {
            chronoVoixSynthese(chronoPhrasePause(n));
            setTimeout(function () { chronoFinAnnonce(generation); }, 12000);
            return;
        }
        chronoVoixJouerTampons(noms, function (ok) {
            if (generation !== chronoAnnonceGeneration) return;
            if (ok) { chronoFinAnnonce(generation); return; }
            chronoVoixJouerLecteurs(noms, function (ok2) {
                if (generation !== chronoAnnonceGeneration) return;
                if (!ok2) chronoVoixSynthese(chronoPhrasePause(n));
                if (ok2) chronoFinAnnonce(generation);
                else setTimeout(function () { chronoFinAnnonce(generation); }, 12000);
            });
        });
    }, 760);
}

/* Fin d'une pause : le bip seul si aucune voix n'est enregistrée pour
   cette phrase ; sinon elle est dite, avec la même voix. */
function chronoAnnoncerReprise() {
    chronoBipDoux();
    if (!chronoVoixActive() || chronoVoixAbsents['pause-fin']) return;
    setTimeout(function () {
        chronoVoixJouerTampons(['pause-fin'], null);
    }, 760);
}
