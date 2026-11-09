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
var chronoAnnonceSuite = null;
var chronoAnnonceGarde = null;
var chronoPreparationSaisie = null;
var chronoSonsAttente = [];
function chronoVoixActive() {
    try { return localStorage.getItem('studyPlanIB_voixActive') !== 'false'; } catch (e) { return true; }
}
function chronoVoixVolume() {
    try { var lu = localStorage.getItem('studyPlanIB_voixVolume'); if (lu === null) return 0.7; var v = Number(lu); return isFinite(v) && v >= 0 && v <= 1 ? v : 0.7; } catch (e) { return 0.7; }
}
function chronoVoixType() {
    /* La préférence féminine conservée n'est pas effacée, mais cette voix
       est temporairement indisponible : seule la masculine est active. */
    return 'masculine';
}
function chronoChargerReglagesVoix() {
    var active = document.getElementById('focusVoixActive'), volume = document.getElementById('focusVoixVolume');
    if (active) active.checked = chronoVoixActive();
    if (volume) volume.value = String(Math.round(chronoVoixVolume() * 100));
    var choix = document.querySelectorAll('input[name="focusVoixType"]');
    for (var i = 0; i < choix.length; i++) choix[i].checked = choix[i].value === chronoVoixType();
}
function chronoChoisirVoix(type) {
    if (type !== 'masculine') { chronoChargerReglagesVoix(); return; }
    try { localStorage.setItem('studyPlanIB_voixType', type); } catch (e) {}
    chronoChargerReglagesVoix();
    /* Préparer les sons pendant l'interaction, sans jouer d'annonce. */
    if (chronoVoixActive()) chronoVoixPreparer();
}
function chronoSauverReglagesVoix() {
    var active = document.getElementById('focusVoixActive'), volume = document.getElementById('focusVoixVolume');
    try {
        if (active) localStorage.setItem('studyPlanIB_voixActive', String(active.checked));
        if (volume) localStorage.setItem('studyPlanIB_voixVolume', String(Math.min(1, Math.max(0, Number(volume.value) / 100))));
    } catch (e) {}
    if (!chronoVoixActive() && chronoAnnonceEnCours) chronoInterrompreAnnonce(true);
    else if (!chronoVoixActive()) chronoVoixArreter();
}
function chronoMettreSonEnAttente(id) {
    if (chronoSonsAttente.indexOf(id) === -1) chronoSonsAttente.push(id);
}
function chronoFinAnnonce(generation) {
    if (generation !== chronoAnnonceGeneration) return;
    chronoAnnonceEnCours = false;
    if (chronoAnnonceGarde) clearTimeout(chronoAnnonceGarde);
    chronoAnnonceGarde = null;
    var suite = chronoAnnonceSuite;
    chronoAnnonceSuite = null;
    if (typeof suite === 'function') suite();
    var sons = chronoSonsAttente.slice();
    chronoSonsAttente = [];
    if (typeof focusEtat !== 'undefined' && focusEtat.mode === 'focus' && focusEtat.running) {
        sons.forEach(function (id) { if (typeof focusLireSon === 'function') focusLireSon(id); });
    }
}
var CHRONO_VOIX_DOSSIER = 'audio/voix/';
var CHRONO_VOIX_VERSION = '20261024d';
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

/* Les morceaux de voix d'un numéro, dans l'ordre. De 1 à 30, chaque
   nombre a son propre enregistrement : « vingt et une » garde sa liaison
   et « vingt-deux » ne devient plus deux mots coupés. Au-delà de 30,
   seuls les nombres non disponibles en entier se composent. */
function chronoVoixMorceauxNombre(nombre) {
    var n = Math.round(Number(nombre));
    if (!isFinite(n) || n < 1) return null;
    if (n <= 30) return ['n-' + n];
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

/* Service facultatif : il n'est utilisé qu'après configuration explicite et
   validation à l'écoute. Sans lui, les prises existantes restent prioritaires. */
function chronoVoixServiceBase() {
    var base = window.STUDYPLAN_VOIX_BACKEND;
    if (typeof base !== 'string' || !base.trim()) return null;
    try {
        var url = new URL(base.trim(), window.location.href);
        if ((url.protocol !== 'https:' && url.origin !== window.location.origin) || url.username || url.password || url.search || url.hash) return null;
        return url.href.replace(/\/$/, '');
    } catch (e) { return null; }
}
function chronoVoixServiceNom(minutes, finale) {
    if (!chronoVoixServiceBase() || chronoVoixType() !== 'masculine') return null;
    var debit = window.STUDYPLAN_VOIX_DEBIT;
    if (['lent', 'normal', 'rapide'].indexOf(debit) === -1) return null;
    return 'service-pause-' + minutes + '-' + debit + '-' + (finale ? '1' : '0');
}

/* Phrases entières écoutées et approuvées ; les essais refusés restent exclus. */
function chronoVoixCompleteApprouvee(minutes) {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 21, 27, 28, 29, 30, 32, 33].indexOf(minutes) !== -1;
}

function chronoVoixUrl(nom) {
    var service = /^service-pause-([1-9]|[1-5][0-9]|60)-(lent|normal|rapide)-([01])$/.exec(nom);
    if (service && chronoVoixServiceBase()) return chronoVoixServiceBase() + '/v1/audio?message=pause&minutes=' + service[1] + '&debit=' + service[2] + '&finale=' + service[3];
    var male = /^masculine-n-(\d+)$/.exec(nom);
    if (male) {
        var n = Number(male[1]);
        if (n >= 1 && n <= 49) {
            var fichier = n === 21 ? '21-minutes-approuve.mp3' : String(n).padStart(2, '0') + '-minutes.wav';
            return 'livrables/stock-voix/durees/' + fichier + '?v=' + CHRONO_VOIX_VERSION;
        }
        if (n >= 50 && n <= 60) return 'livrables/publication-voix/essai-' + n + '-minutes.mp3?v=' + CHRONO_VOIX_VERSION;
    }
    if (nom === 'masculine-debut') return 'livrables/stock-voix/messages/annonce-debut.wav?v=' + CHRONO_VOIX_VERSION;
    if (nom === 'masculine-pause') return 'livrables/stock-voix/messages/annonce-de-pause.wav?v=' + CHRONO_VOIX_VERSION;
    if (nom === 'masculine-reprise') return 'livrables/stock-voix/messages/reprise-proposition.wav?v=' + CHRONO_VOIX_VERSION;
    if (nom === 'masculine-fin-serie') return 'livrables/stock-voix/messages/fin-serie.wav?v=' + CHRONO_VOIX_VERSION;
    var complet = /^masculine-complet-(\d+)$/.exec(nom);
    if (complet && chronoVoixCompleteApprouvee(Number(complet[1]))) {
        var minute = Number(complet[1]);
        if (minute === 5) return 'livrables/publication-voix/essai-prononciation-claire-5.mp3?v=' + CHRONO_VOIX_VERSION;
        var lot = [27, 28, 29, 30, 32, 33].indexOf(minute) !== -1 ? 'essai-prises-lot4' :
            ([6, 7, 8, 9, 11, 12, 13, 16].indexOf(minute) !== -1 ? 'essai-prises-lot2' : 'essai-prises-continues');
        return 'livrables/publication-voix/' + lot + '/' + complet[1].padStart(2, '0') + '.mp3?v=' + CHRONO_VOIX_VERSION;
    }
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
        return now + 0.78;
    } catch (e) { return null; }
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
    var noms = chronoVoixType() === 'masculine' ? ['masculine-debut', 'masculine-pause', 'masculine-reprise', 'masculine-fin-serie'] : ['seance-fin', 'minutes-de-pause', 'minute-de-pause', 'et', 'masculine-reprise', 'masculine-fin-serie'];
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
        var n = Math.round(Number(m));
        if (chronoVoixType() === 'masculine' && isFinite(n) && n >= 1 && n <= 60) {
            noms.push(chronoVoixCompleteApprouvee(n) ? 'masculine-complet-' + n : 'masculine-n-' + n);
        }
        else if (chronoVoixType() === 'feminine') {
            var nombre = chronoVoixMorceauxNombre(m);
            if (nombre) noms = noms.concat(nombre);
        }
    });
    noms.forEach(function (nom) {
        chronoVoixCharger(nom).catch(function () {});
        chronoVoixLecteur(nom);
    });
    /* Le résultat serveur doit être entièrement décodé avant la fin du
       minuteur. S'il tarde ou échoue, on utilise les sons actuels. */
    if (chronoVoixActive()) pauses.forEach(function (m) {
        var n = Math.round(Number(m));
        if (!isFinite(n) || n < 1 || n > 60 || chronoVoixCompleteApprouvee(n)) return;
        [false, true].forEach(function (finale) {
            var nom = chronoVoixServiceNom(n, finale);
            if (nom) chronoVoixCharger(nom).catch(function () {});
        });
    });
}

/* Pendant la saisie, préparer sans attendre la perte du focus ni mémoriser
   une valeur incomplète. Un petit délai évite de charger chaque chiffre. */
function chronoPreparerDureeSaisie(champ) {
    if (chronoPreparationSaisie) clearTimeout(chronoPreparationSaisie);
    var brut = champ && String(champ.value).trim();
    if (!/^\d+$/.test(brut) || Number(brut) < 1 || Number(brut) > 60) return;
    var n = Number(brut);
    chronoPreparationSaisie = setTimeout(function () { chronoVoixPreparer(n); }, 150);
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
    if (actifs.length) chronoSonsCoupes = actifs;

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

/* Les bords silencieux sont réduits sans toucher aux phonèmes : on conserve
   25 ms de marge, et on programme les prises dos à dos sur l'horloge audio. */
function chronoVoixBornes(tampon) {
    var seuil = 0.0015, premiere = tampon.length, derniere = -1;
    for (var canal = 0; canal < tampon.numberOfChannels; canal++) {
        var donnees = tampon.getChannelData(canal);
        var a = 0, b = donnees.length - 1;
        while (a < donnees.length && Math.abs(donnees[a]) < seuil) a++;
        while (b >= a && Math.abs(donnees[b]) < seuil) b--;
        premiere = Math.min(premiere, a); derniere = Math.max(derniere, b);
    }
    if (derniere < 0) return { debut: 0, duree: tampon.duration, avantVoix: 0 };
    var marge = Math.round(tampon.sampleRate * 0.025);
    var debut = Math.max(0, premiere - marge) / tampon.sampleRate;
    var fin = Math.min(tampon.length, derniere + marge + 1) / tampon.sampleRate;
    return { debut: debut, duree: fin - debut, avantVoix: premiere / tampon.sampleRate - debut };
}

/* Premier chemin : toutes les prises sont chargées avant programmation.
   La dernière source, et non une durée estimée, annonce la vraie fin. */
function chronoVoixJouerTampons(noms, suite, options) {
    var ctx = chronoVoixContexte();
    if (!ctx) { if (suite) suite(false); return; }
    Promise.all(noms.map(chronoVoixCharger)).then(function (tampons) {
        if (options && options.generation != null && (options.generation !== chronoAnnonceGeneration || !chronoAnnonceEnCours)) return;
        if (!tampons.length || ctx.state === 'suspended' || ctx.state === 'closed') { if (suite) suite(false); return; }
        var bornesTampons = tampons.map(chronoVoixBornes);
        var quand = Math.max(ctx.currentTime + 0.01, (options && options.debut || 0) - bornesTampons[0].avantVoix);
        var sources = [], abandonne = false;
        try {
            tampons.forEach(function (tampon, index) {
                /* Une respiration entre le message de série et l'annonce de
                   pause, mais aucune coupure ajoutée à l'intérieur de celle-ci. */
                if (index === 1 && options && options.pauseApresPremier) quand += 0.3;
                var source = ctx.createBufferSource();
                var bornes = bornesTampons[index];
                source.buffer = tampon;
                var gain = ctx.createGain();
                gain.gain.value = chronoVoixVolume();
                source.connect(gain);
                gain.connect(ctx.destination);
                sources.push(source);
                chronoVoixSources.push(source);
                source.onended = function () {
                    var i = chronoVoixSources.indexOf(source);
                    if (i !== -1) chronoVoixSources.splice(i, 1);
                    if (!abandonne && index === tampons.length - 1 && suite) suite(true);
                };
                source.start(quand, bornes.debut, bornes.duree);
                quand += bornes.duree;
            });
        } catch (e) {
            abandonne = true;
            sources.forEach(function (source) { try { source.stop(); } catch (_) {} });
            if (suite) suite(false);
        }
    }, function () {
        if (suite) suite(false);
    });
}

/* Deuxième chemin : les mêmes fichiers, lus par des lecteurs ordinaires. */
function chronoVoixJouerLecteurs(noms, suite, options) {
    var i = 0;
    function suivant() {
        if (options && options.generation != null && (options.generation !== chronoAnnonceGeneration || !chronoAnnonceEnCours)) return;
        if (i >= noms.length) { if (suite) suite(true); return; }
        var son = chronoVoixLecteur(noms[i++]);
        if (!son) { if (suite) suite(false); return; }
        var fini = false;
        function apres(ok) {
            if (fini) return;
            fini = true;
            if (ok && i === 1 && options && options.pauseApresPremier) setTimeout(suivant, 300);
            else if (ok) suivant();
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
function chronoVoixSynthese(phrase, suite) {
    function dire() {
        try {
            if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance !== 'function') { if (suite) suite(false); return; }
            var dit = new SpeechSynthesisUtterance(phrase);
            dit.onend = function () { if (suite) suite(true); };
            dit.onerror = function () { if (suite) suite(false); };
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
        } catch (e) { if (suite) suite(false); }
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
    if (!mots) return 'Ta séance de révision est terminée. Tu as droit maintenant à une pause.';
    return 'Ta séance de révision est terminée. Tu as droit maintenant à '
        + mots + (n > 1 ? ' minutes' : ' minute') + ' de pause.';
}

/* La phrase complète, morceau par morceau. */
function chronoVoixPhrasePause(minutes) {
    var n = Math.round(Number(minutes));
    if (!isFinite(n) || n < 1) return null;
    if (chronoVoixType() === 'masculine') {
        if (n > 60) return null;
        if (chronoVoixCompleteApprouvee(n)) return ['masculine-complet-' + n];
        return ['masculine-debut', 'masculine-n-' + n, 'masculine-pause'];
    }
    var nombre = chronoVoixMorceauxNombre(n);
    if (!nombre) return null;
    return ['seance-fin'].concat(nombre, [n > 1 ? 'minutes-de-pause' : 'minute-de-pause']);
}

/* Une intervention manuelle annule l'ancienne annonce ; couper la voix
   pendant celle-ci libère aussi la transition, sans bloquer le minuteur. */
function chronoInterrompreAnnonce(terminer) {
    var suite = chronoAnnonceSuite;
    ++chronoAnnonceGeneration;
    chronoAnnonceSuite = null;
    chronoAnnonceEnCours = false;
    if (chronoAnnonceGarde) clearTimeout(chronoAnnonceGarde);
    chronoAnnonceGarde = null;
    chronoVoixArreter();
    if (terminer && typeof suite === 'function') suite();
}

/* Le bip et les sources partagent l'horloge audio : le premier phonème est
   programmé dès la fin du bip, les morceaux se suivent sans délai ajouté.
   Si l'appareil refuse l'audio, un secours borné évite de bloquer la phase. */
function chronoLancerAnnonce(noms, typeVoix, phrase, suite, options) {
    chronoInterrompreAnnonce(false);
    var generation = ++chronoAnnonceGeneration;
    chronoAnnonceEnCours = true;
    chronoAnnonceSuite = typeof suite === 'function' ? suite : null;
    chronoCouperMusique();
    var finBip = chronoBipDoux();
    var ctx = chronoVoixCtx;
    var delaiBip = finBip != null && ctx ? Math.max(0, (finBip - ctx.currentTime) * 1000) : 780;
    function valide() { return generation === chronoAnnonceGeneration && chronoAnnonceEnCours; }
    function fini() { if (valide()) chronoFinAnnonce(generation); }
    chronoAnnonceGarde = setTimeout(function () {
        if (!valide()) return;
        chronoVoixArreter();
        fini();
    }, 20000);
    if (!chronoVoixActive()) { setTimeout(fini, delaiBip); return; }
    function secours() {
        if (!valide()) return;
        if (!noms || !noms.length) {
            if (typeVoix === 'feminine' && phrase) chronoVoixSynthese(phrase, fini);
            else fini();
            return;
        }
        chronoVoixJouerLecteurs(options && options.nomsSecours || noms, function (ok) {
            if (!valide()) return;
            if (!ok && typeVoix === 'feminine' && phrase) chronoVoixSynthese(phrase, fini);
            else fini();
        }, { generation: generation, pauseApresPremier: !!(options && (options.nomsSecours ? options.pauseSecours : options.pauseApresPremier)) });
    }
    if (!noms || !noms.length) { setTimeout(secours, delaiBip); return; }
    chronoVoixJouerTampons(noms, function (ok) {
        if (!valide()) return;
        if (ok) fini();
        else setTimeout(secours, Math.max(0, finBip != null && ctx ? (finBip - ctx.currentTime) * 1000 : delaiBip));
    }, { debut: finBip, generation: generation, pauseApresPremier: !!(options && options.pauseApresPremier) });
}

/* Fin de concentration : annonce la durée exacte choisie. */
function chronoAnnoncerPause(minutes, suite, derniereSeance) {
    var n = Math.round(Number(minutes));
    if (!isFinite(n) || n < 1 || n > 60) n = 5;
    var noms = chronoVoixPhrasePause(n);
    var texte = chronoPhrasePause(n);
    if (derniereSeance && noms) {
        noms.unshift('masculine-fin-serie');
        texte = 'Tes séances de révisions sont terminées. ' + texte;
    }
    if (chronoVoixCompleteApprouvee(n) && chronoVoixType() === 'masculine') {
        /* Ne jamais rejouer l'ancienne phrase assemblée pour ces durées,
           même si la prise ne peut pas être lue : la transition continue. */
        chronoLancerAnnonce(noms, 'masculine', texte, suite, { pauseApresPremier: !!derniereSeance });
        return;
    }
    var nomService = chronoVoixServiceNom(n, !!derniereSeance);
    if (nomService && chronoVoixTampons[nomService]) {
        chronoLancerAnnonce([nomService], chronoVoixType(), texte, suite, { nomsSecours: noms, pauseSecours: !!derniereSeance });
    } else {
        chronoLancerAnnonce(noms, chronoVoixType(), texte, suite, { pauseApresPremier: !!derniereSeance });
    }
}

/* Fin de pause : la phrase demandée est toujours la voix masculine choisie. */
function chronoAnnoncerReprise(suite) {
    chronoLancerAnnonce(['masculine-reprise'], 'masculine', '', suite);
}
