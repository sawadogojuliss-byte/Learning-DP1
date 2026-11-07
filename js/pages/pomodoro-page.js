/* ============================================================
   PAGE Séance de révision du jour, puis PAGE Pomodoro
   La liste des séances du jour est la page avant le minuteur :
   planning → séance de révision → minuteur. Ouvert à tout le monde.
   Vues : pages/seances.html et pages/pomodoro.html
   ============================================================ */

/* Chaque fond existe en WebP : une version pleine taille pour le décor et une
   petite vignette pour la bande de choix (50 Mo de PNG à l'origine). */
var FOCUS_FONDS = [
    { id: 'lumiere', cat: 'degrades', nom: 'Lumière', src: 'images/pomodoro/lumiere.webp?v=20261015p', mini: 'images/pomodoro/mini/lumiere.webp?v=20261015p' },
    { id: 'kiosque', cat: 'urbain', nom: 'Kiosque', src: 'images/pomodoro/kiosque.webp?v=20261015p', mini: 'images/pomodoro/mini/kiosque.webp?v=20261015p' },
    { id: 'sommets', cat: 'paysages', nom: 'Sommets', src: 'images/pomodoro/sommets.webp?v=20261015p', mini: 'images/pomodoro/mini/sommets.webp?v=20261015p' },
    { id: 'hublot', cat: 'interieur', nom: 'Hublot', src: 'images/pomodoro/hublot.webp?v=20261015p', mini: 'images/pomodoro/mini/hublot.webp?v=20261015p' },
    { id: 'dunes', cat: 'paysages', nom: 'Dunes', src: 'images/pomodoro/dunes.webp?v=20261015p', mini: 'images/pomodoro/mini/dunes.webp?v=20261015p' },
    { id: 'chalet', cat: 'paysages', nom: 'Chalet', src: 'images/pomodoro/chalet.webp?v=20261015p', mini: 'images/pomodoro/mini/chalet.webp?v=20261015p' },
    { id: 'pont', cat: 'urbain', nom: 'Pont', src: 'images/pomodoro/pont.webp?v=20261015p', mini: 'images/pomodoro/mini/pont.webp?v=20261015p' },
    { id: 'riviere', cat: 'nature', nom: 'Rivière', src: 'images/pomodoro/riviere.webp?v=20261015p', mini: 'images/pomodoro/mini/riviere.webp?v=20261015p' },
    { id: 'prairie', cat: 'nature', nom: 'Prairie', src: 'images/pomodoro/prairie.webp?v=20261015p', mini: 'images/pomodoro/mini/prairie.webp?v=20261015p' },
    { id: 'noel', cat: 'urbain', nom: 'Village de Noël', src: 'images/pomodoro/noel.webp?v=20261015p', mini: 'images/pomodoro/mini/noel.webp?v=20261015p' },
    { id: 'cafe', cat: 'urbain', nom: 'Café', src: 'images/pomodoro/cafe.webp?v=20261015p', mini: 'images/pomodoro/mini/cafe.webp?v=20261015p' },
    { id: 'nuit', cat: 'urbain', nom: 'Café de nuit', src: 'images/pomodoro/cafe-nuit.webp?v=20261015p', mini: 'images/pomodoro/mini/cafe-nuit.webp?v=20261015p' },
    { id: 'foret', cat: 'nature', nom: 'Forêt', src: 'images/pomodoro/foret.webp?v=20261015p', mini: 'images/pomodoro/mini/foret.webp?v=20261015p' },
    { id: 'campagne', cat: 'nature', nom: 'Campagne', src: 'images/pomodoro/campagne.webp?v=20261015p', mini: 'images/pomodoro/mini/campagne.webp?v=20261015p' },
    { id: 'tente', cat: 'nature', nom: 'Tente', src: 'images/pomodoro/tente.webp?v=20261015p', mini: 'images/pomodoro/mini/tente.webp?v=20261015p' },
    { id: 'savane', cat: 'paysages', nom: 'Savane', src: 'images/pomodoro/savane.webp?v=20261015p', mini: 'images/pomodoro/mini/savane.webp?v=20261015p' },
    { id: 'recif', cat: 'nature', nom: 'Récif', src: 'images/pomodoro/recif.webp?v=20261015p', mini: 'images/pomodoro/mini/recif.webp?v=20261015p' },
    { id: 'sentier', cat: 'nature', nom: 'Sentier', src: 'images/pomodoro/sentier.webp?v=20261015p', mini: 'images/pomodoro/mini/sentier.webp?v=20261015p' },
    { id: 'pluie-nuit', cat: 'interieur', nom: 'Pluie de nuit', src: 'images/pomodoro/pluie-nuit.webp?v=20261015p', mini: 'images/pomodoro/mini/pluie-nuit.webp?v=20261015p' },
    { id: 'lecture', cat: 'interieur', nom: 'Lecture', src: 'images/pomodoro/lecture.webp?v=20261015p', mini: 'images/pomodoro/mini/lecture.webp?v=20261015p' },
    { id: 'cabine', cat: 'interieur', nom: 'Cabine', src: 'images/pomodoro/cabine.webp?v=20261015p', mini: 'images/pomodoro/mini/cabine.webp?v=20261015p' },
    { id: 'tunnel', cat: 'degrades', nom: 'Tunnel', src: 'images/pomodoro/tunnel.webp?v=20261015p', mini: 'images/pomodoro/mini/tunnel.webp?v=20261015p' },
    { id: 'stade', cat: 'degrades', nom: 'Stade', src: 'images/pomodoro/stade.webp?v=20261015p', mini: 'images/pomodoro/mini/stade.webp?v=20261015p' },
    /* Photos ajoutées en octobre 2026 : fleurs, montagnes, mer. */
    { id: 'geraniums', cat: 'fleurs', nom: 'Géraniums', src: 'images/pomodoro/geraniums.webp?v=20261019d', mini: 'images/pomodoro/mini/geraniums.webp?v=20261019d' },
    { id: 'chrysantheme', cat: 'fleurs', nom: 'Chrysanthème', src: 'images/pomodoro/chrysantheme.webp?v=20261019d', mini: 'images/pomodoro/mini/chrysantheme.webp?v=20261019d' },
    { id: 'lac-montagne', cat: 'paysages', nom: 'Lac de montagne', src: 'images/pomodoro/lac-montagne.webp?v=20261019d', mini: 'images/pomodoro/mini/lac-montagne.webp?v=20261019d' },
    { id: 'arbre-couchant', cat: 'paysages', nom: 'Arbre au couchant', src: 'images/pomodoro/arbre-couchant.webp?v=20261019d', mini: 'images/pomodoro/mini/arbre-couchant.webp?v=20261019d' },
    { id: 'canyon', cat: 'paysages', nom: 'Canyon', src: 'images/pomodoro/canyon.webp?v=20261019d', mini: 'images/pomodoro/mini/canyon.webp?v=20261019d' },
    { id: 'lac-alpin', cat: 'paysages', nom: 'Lac alpin', src: 'images/pomodoro/lac-alpin.webp?v=20261019d', mini: 'images/pomodoro/mini/lac-alpin.webp?v=20261019d' },
    { id: 'plage', cat: 'paysages', nom: 'Plage', src: 'images/pomodoro/plage.webp?v=20261019d', mini: 'images/pomodoro/mini/plage.webp?v=20261019d' },
    { id: 'mer-soleil', cat: 'paysages', nom: 'Mer au soleil', src: 'images/pomodoro/mer-soleil.webp?v=20261019d', mini: 'images/pomodoro/mini/mer-soleil.webp?v=20261019d' },
    { id: 'marguerites', cat: 'fleurs', nom: 'Marguerites', src: 'images/pomodoro/marguerites.webp?v=20261019d', mini: 'images/pomodoro/mini/marguerites.webp?v=20261019d' },
    /* Ajouté à la fin pour conserver les choix existants enregistrés par indice. */
    { id: 'chalet-neige-anime', cat: 'anime', nom: 'Chalet sous la neige', src: 'images/pomodoro/chalet-neige-anime.webp?v=20261107b', mini: 'images/pomodoro/mini/chalet-neige-anime.webp?v=20261107b', video: 'images/pomodoro/chalet-neige-anime.mp4?v=20261107b' },
    /* Photos du dossier StudyPlan / Image. Ajoutées après les anciens indices. */
    { id: 'drive-parc-au-soleil', cat: 'retire', nom: 'Banc au parc', src: 'images/pomodoro/drive-banc-au-parc.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-banc-au-parc.webp?v=20261107c', precharger: false, masque: true, remplacePar: 'drive-banc-au-parc' },
    { id: 'drive-banc-au-parc', cat: 'nature', nom: 'Banc au parc', src: 'images/pomodoro/drive-banc-au-parc.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-banc-au-parc.webp?v=20261107c', precharger: false },
    { id: 'drive-stade-au-couchant', cat: 'sport', nom: 'Stade au couchant', src: 'images/pomodoro/drive-stade-au-couchant.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-stade-au-couchant.webp?v=20261107c', precharger: false },
    { id: 'drive-arbre-et-champs', cat: 'nature', nom: 'Arbre et champs', src: 'images/pomodoro/drive-arbre-et-champs.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-arbre-et-champs.webp?v=20261107c', precharger: false },
    { id: 'drive-profondeurs-colorees', cat: 'degrades', nom: 'Profondeurs colorées', src: 'images/pomodoro/drive-profondeurs-colorees.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-profondeurs-colorees.webp?v=20261107c', precharger: false },
    { id: 'drive-douceur-pastel', cat: 'degrades', nom: 'Douceur pastel', src: 'images/pomodoro/drive-douceur-pastel.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-douceur-pastel.webp?v=20261107c', precharger: false },
    { id: 'drive-aurore-sur-le-lac', cat: 'paysages', nom: 'Aurore sur le lac', src: 'images/pomodoro/drive-aurore-sur-le-lac.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-aurore-sur-le-lac.webp?v=20261107c', precharger: false },
    { id: 'drive-cascade-en-foret', cat: 'nature', nom: 'Cascade en forêt', src: 'images/pomodoro/drive-cascade-en-foret.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-cascade-en-foret.webp?v=20261107c', precharger: false },
    { id: 'drive-clairiere-de-montagne', cat: 'paysages', nom: 'Clairière de montagne', src: 'images/pomodoro/drive-clairiere-de-montagne.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-clairiere-de-montagne.webp?v=20261107c', precharger: false },
    { id: 'drive-voile-boreal', cat: 'paysages', nom: 'Voile boréal', src: 'images/pomodoro/drive-voile-boreal.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-voile-boreal.webp?v=20261107c', precharger: false },
    { id: 'drive-montagnes-bleues', cat: 'paysages', nom: 'Montagnes bleues', src: 'images/pomodoro/drive-montagnes-bleues.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-montagnes-bleues.webp?v=20261107c', precharger: false },
    { id: 'drive-feuilles-de-pluie', cat: 'nature', nom: 'Feuilles de pluie', src: 'images/pomodoro/drive-feuilles-de-pluie.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-feuilles-de-pluie.webp?v=20261107c', precharger: false },
    { id: 'drive-horizon-au-couchant', cat: 'paysages', nom: 'Horizon au couchant', src: 'images/pomodoro/drive-horizon-au-couchant.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-horizon-au-couchant.webp?v=20261107c', precharger: false },
    { id: 'drive-stade-a-la-tombee-du-jour', cat: 'sport', nom: 'Stade à la tombée du jour', src: 'images/pomodoro/drive-stade-a-la-tombee-du-jour.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-stade-a-la-tombee-du-jour.webp?v=20261107c', precharger: false },
    { id: 'drive-soleil-rouge', cat: 'paysages', nom: 'Soleil rouge', src: 'images/pomodoro/drive-soleil-rouge.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-soleil-rouge.webp?v=20261107c', precharger: false },
    { id: 'drive-montagnes-etoilees', cat: 'paysages', nom: 'Montagnes étoilées', src: 'images/pomodoro/drive-montagnes-etoilees.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-montagnes-etoilees.webp?v=20261107c', precharger: false },
    { id: 'drive-aurore-sur-la-rive', cat: 'paysages', nom: 'Aurore sur la rive', src: 'images/pomodoro/drive-aurore-sur-la-rive.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-aurore-sur-la-rive.webp?v=20261107c', precharger: false },
    { id: 'drive-panier-au-couchant', cat: 'sport', nom: 'Panier au couchant', src: 'images/pomodoro/drive-panier-au-couchant.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-panier-au-couchant.webp?v=20261107c', precharger: false },
    { id: 'drive-vallee-dans-les-nuages', cat: 'paysages', nom: 'Vallée dans les nuages', src: 'images/pomodoro/drive-vallee-dans-les-nuages.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-vallee-dans-les-nuages.webp?v=20261107c', precharger: false },
    { id: 'drive-torrent-alpin', cat: 'nature', nom: 'Torrent alpin', src: 'images/pomodoro/drive-torrent-alpin.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-torrent-alpin.webp?v=20261107c', precharger: false },
    { id: 'drive-champ-de-coquelicots', cat: 'fleurs', nom: 'Champ de coquelicots', src: 'images/pomodoro/drive-champ-de-coquelicots.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-champ-de-coquelicots.webp?v=20261107c', precharger: false },
    { id: 'drive-fleurs-en-noir-et-blanc', cat: 'fleurs', nom: 'Fleurs en noir et blanc', src: 'images/pomodoro/drive-fleurs-en-noir-et-blanc.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-fleurs-en-noir-et-blanc.webp?v=20261107c', precharger: false },
    { id: 'drive-lueurs-vives', cat: 'degrades', nom: 'Lueurs vives', src: 'images/pomodoro/drive-lueurs-vives.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-lueurs-vives.webp?v=20261107c', precharger: false },
    { id: 'drive-rose-pourpre', cat: 'fleurs', nom: 'Rose pourpre', src: 'images/pomodoro/drive-rose-pourpre.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-rose-pourpre.webp?v=20261107c', precharger: false },
    { id: 'drive-reflets-du-soir', cat: 'paysages', nom: 'Reflets du soir', src: 'images/pomodoro/drive-reflets-du-soir.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-reflets-du-soir.webp?v=20261107c', precharger: false },
    { id: 'drive-rose-perlee', cat: 'fleurs', nom: 'Rose perlée', src: 'images/pomodoro/drive-rose-perlee.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-rose-perlee.webp?v=20261107c', precharger: false },
    { id: 'drive-passerelle-en-foret', cat: 'nature', nom: 'Passerelle en forêt', src: 'images/pomodoro/drive-passerelle-en-foret.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-passerelle-en-foret.webp?v=20261107c', precharger: false },
    { id: 'drive-ballon-sur-le-terrain', cat: 'sport', nom: 'Ballon sur le terrain', src: 'images/pomodoro/drive-ballon-sur-le-terrain.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-ballon-sur-le-terrain.webp?v=20261107c', precharger: false },
    { id: 'drive-pelouse-du-stade', cat: 'sport', nom: 'Pelouse du stade', src: 'images/pomodoro/drive-pelouse-du-stade.webp?v=20261107c', mini: 'images/pomodoro/mini/drive-pelouse-du-stade.webp?v=20261107c', precharger: false },
    /* Ajout à la fin : les indices sauvegardés des autres thèmes ne changent pas. */
    { id: 'dunes-lagunes-anime', cat: 'anime', nom: 'Dunes et lagunes', src: 'images/pomodoro/dunes-lagunes-anime.webp?v=20261107d', mini: 'images/pomodoro/mini/dunes-lagunes-anime.webp?v=20261107d', video: 'images/pomodoro/dunes-lagunes-anime.mp4?v=20261107d', precharger: false },
    { id: 'pluie-palmes-anime', cat: 'anime', nom: 'Pluie sur les palmes', src: 'images/pomodoro/pluie-palmes-anime.webp?v=20261107e', mini: 'images/pomodoro/mini/pluie-palmes-anime.webp?v=20261107e', video: 'images/pomodoro/pluie-palmes-anime.mp4?v=20261107e', precharger: false },
];
var FOCUS_ASTUCES = {
    focus: 'Range le téléphone. Une seule tâche, jusqu’à la fin du temps.',
    short: 'Lève-toi, bois de l’eau, regarde au loin.',
    long: 'Marche un peu. La pause longue arrive après tes séances de révision.'
};
var focusEtat = {
    mode: 'focus',
    restant: 25 * 60,
    total: 25 * 60,
    running: false,
    fin: 0,
    cycles: 0,
    /* série de révision : séances terminées, et série en cours ou non */
    serie: 0,
    run: false,
    fond: 0,
    son: 'off',
    astuce: false
};
/* Le minuteur est gardé dans le navigateur : un rechargement ne le remet
   plus à zéro. focusEtatRestaure empêche d'écrire avant la lecture. */
var focusEtatRestaure = false;
var focusEtatSauve = '';
var focusTaches = [];
var focusAmbianceChoisie = [];
var focusMenuTache = null;
var focusSousCible = null;
var focusTimer = null;
var focusAudio = null;
var focusPip = null;
var focusBruit = null;
var focusTitreOrig = typeof document !== 'undefined' ? document.title : 'Studyplan';
var focusPret = false;
/* Fonds : le décor affiché ne change qu'une fois la nouvelle image décodée,
   et il change d'un coup (sinon le planning apparaissait dessous, ou bien
   l'ancienne image revenait pendant le fondu). */
var focusFondsPrets = {};
var focusFondActif = '';
var focusFondDemande = '';
var focusAccueilActif = '';
var focusFondsFile = null;
var focusFondsArret = false;

function focusAfficherEntree() {
    /* Le minuteur et la page des séances sont ouverts à tous : les deux
       entrées du menu restent visibles. */
    ['menuSeances', 'menuMinuteur'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'flex';
    });
}

function focusLireJson(cle, defaut) {
    try {
        var brut = localStorage.getItem(cle);
        if (!brut) return defaut;
        return JSON.parse(brut);
    } catch (e) {
        return defaut;
    }
}

/* Sauvegarde l'état du minuteur. Pendant que le chrono tourne, on garde
   l'heure de fin (et non le temps restant, qui change chaque seconde) :
   la chaîne ne change qu'à chaque vrai changement, donc peu d'écritures. */
function focusSauverEtat() {
    if (!focusEtatRestaure) return;
    var donnees = {
        mode: focusEtat.mode,
        total: focusEtat.total,
        restant: focusEtat.running ? null : focusEtat.restant,
        running: !!focusEtat.running,
        fin: focusEtat.running ? focusEtat.fin : 0,
        cycles: focusEtat.cycles,
        serie: focusEtat.serie,
        run: !!focusEtat.run,
        date: new Date().toDateString()
    };
    var texte = JSON.stringify(donnees);
    if (texte === focusEtatSauve) return;
    focusEtatSauve = texte;
    try { localStorage.setItem('studyPlanIB_focusEtat', texte); } catch (e) {}
}

/* Relit l'état sauvegardé. Une sauvegarde d'un autre jour est écartée :
   les cycles repartent à zéro chaque jour. Si le chrono tournait et que
   sa fin est passée pendant que la page était fermée, la phase suivante
   est proposée en pause, sans annonce vocale ni son. */
function focusRestaurerEtat() {
    var donnees = focusLireJson('studyPlanIB_focusEtat', null);
    if (!donnees || typeof donnees !== 'object') return false;
    if (donnees.date !== new Date().toDateString()) {
        try { localStorage.removeItem('studyPlanIB_focusEtat'); } catch (e) {}
        return false;
    }
    if (donnees.mode !== 'focus' && donnees.mode !== 'short' && donnees.mode !== 'long') return false;
    var total = Number(donnees.total);
    if (!(total > 0)) return false;
    focusEtat.mode = donnees.mode;
    focusEtat.total = total;
    focusEtat.cycles = Math.max(0, Math.floor(Number(donnees.cycles) || 0));
    focusEtat.serie = Math.max(0, Math.floor(Number(donnees.serie) || 0));
    focusEtat.run = !!donnees.run;
    if (donnees.running && Number(donnees.fin) > 0) {
        focusEtat.running = true;
        focusEtat.fin = Number(donnees.fin);
        focusEtat.restant = Math.max(0, Math.round((focusEtat.fin - Date.now()) / 1000));
        if (focusEtat.restant <= 0) {
            focusEtat.running = false;
            focusEtat.fin = 0;
            focusPhaseSuivante(true);
        }
    } else {
        focusEtat.running = false;
        focusEtat.fin = 0;
        var restant = Number(donnees.restant);
        focusEtat.restant = restant > 0 ? Math.min(restant, total) : total;
    }
    return true;
}

function focusDurees() {
    var sauve = focusLireJson('studyPlanIB_focusDurees', null) || {};
    return {
        focus: focusBorner(sauve.focus, 25, 1, 180),
        short: focusBorner(sauve.short, 5, 1, 60),
        long: focusBorner(sauve.long, 15, 1, 60),
        seances: focusBorner(sauve.seances, 4, 1, 12)
    };
}

function focusBorner(valeur, defaut, min, max) {
    var n = Number(valeur);
    if (!isFinite(n)) return defaut;
    n = Math.round(n);
    if (n < min) return min;
    if (n > max) return max;
    return n;
}

function focusTexte(sec) {
    var total = Math.max(0, Number(sec) || 0);
    var m = Math.floor(total / 60);
    var s = total % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

function focusCharger() {
    if (focusPret) return;
    focusPret = true;
    var durees = focusDurees();
    focusEtat.total = durees.focus * 60;
    focusEtat.restant = focusEtat.total;
    var fond = focusIndexParId('lumiere');
    try {
        var choix = localStorage.getItem('studyPlanIB_focusFond');
        if (choix !== null && /^\d+$/.test(choix) && Number(choix) < FOCUS_FONDS.length) fond = Number(choix);
    } catch (e) {}
    // Un ancien choix retiré pointe vers le décor conservé, sans décaler les indices.
    if (FOCUS_FONDS[fond].remplacePar) {
        fond = focusIndexParId(FOCUS_FONDS[fond].remplacePar);
        try { localStorage.setItem('studyPlanIB_focusFond', String(fond)); } catch (e) {}
    }
    focusEtat.fond = fond;
    var tache = '';
    try { tache = localStorage.getItem('studyPlanIB_focusTache') || ''; } catch (e) {}
    var champ = document.getElementById('focusTache');
    if (champ && tache) champ.value = tache;
    focusAmbianceChoisie = focusLireJson('studyPlanIB_focusAmbiance', []);
    if (!Array.isArray(focusAmbianceChoisie)) focusAmbianceChoisie = [];
    if (typeof chronoChargerReglagesVoix === 'function') chronoChargerReglagesVoix();
    focusTaches = focusLireJson('studyPlanIB_focusTaches', []);
    if (!Array.isArray(focusTaches)) focusTaches = [];
    focusObserverVideosFond();
    focusPreparerFonds();
    focusPoserFond(focusEtat.fond, true);
    focusRestaurerEtat();
    focusEtatRestaure = true;
    focusSauverEtat();
    focusBrancher();
    /* un chrono qui tournait avant le rechargement repart tout seul :
       son heure de fin est gardée, il ne recommence pas à zéro */
    if (focusEtat.running) focusLancerIntervalle();
    focusPeindre();
}

function focusIndexParId(id) {
    var i;
    for (i = 0; i < FOCUS_FONDS.length; i++) {
        if (FOCUS_FONDS[i].id === id) return i;
    }
    return 0;
}

/* La page « Séance de révision du jour » : la liste, avant le minuteur. */
function focusOuvrirSeances() {
    if (typeof focusFermerMusique === 'function') { try { focusFermerMusique(); } catch (e) {} }
    focusCharger();
    focusFondsArret = false;
    /* Le minuteur cache la page des séances : on la remontre à chaque retour,
       sinon l'écran restait blanc après un premier passage sur le minuteur. */
    var accueil = document.getElementById('focusAccueil');
    if (accueil) accueil.hidden = false;
    var page = document.getElementById('focusPage');
    if (page) page.hidden = true;
    /* une série en cours garde son lien : un retour à la liste ne l'interrompt pas */
    if (!focusEtat.run) {
        focusSeanceMinuteur = null;
        try { sessionStorage.removeItem('studyPlanIB_focusSeanceEnCours'); } catch (e) {}
    }
    focusPeindreFlamme();
    focusPeindre();
    focusChoisirSeance();
    focusPeindreAccueil();
    focusAmorcerFonds();
    /* Quand une séance commence ou finit pendant que la page est ouverte,
       les boutons suivent l'heure réelle sans exiger un rechargement. */
    if (focusRafraichirSeancesTimer) clearInterval(focusRafraichirSeancesTimer);
    var signature = focusSignatureSeances();
    focusRafraichirSeancesTimer = setInterval(function () {
        var panel = document.getElementById('panelSeances');
        if (!panel || !panel.classList.contains('active')) {
            clearInterval(focusRafraichirSeancesTimer);
            focusRafraichirSeancesTimer = null;
            return;
        }
        var suivante = focusSignatureSeances();
        if (suivante !== signature) { signature = suivante; focusPeindreAccueil(); }
    }, 10000);
}

/* La page Pomodoro : le minuteur seul. */
function focusOuvrirMinuteur() {
    if (focusRafraichirSeancesTimer) { clearInterval(focusRafraichirSeancesTimer); focusRafraichirSeancesTimer = null; }
    focusCharger();
    focusFondsArret = false;
    var accueil = document.getElementById('focusAccueil');
    if (accueil) accueil.hidden = true;
    var page = document.getElementById('focusPage');
    if (page) page.hidden = false;
    /* une série en cours (chrono lancé, même après un rechargement) garde son lien */
    if (!focusEntreeDepuisSeance && !focusEtat.run) {
        focusSeanceMinuteur = null;
        try { sessionStorage.removeItem('studyPlanIB_focusSeanceEnCours'); } catch (e) {}
    }
    focusEntreeDepuisSeance = false;
    focusPeindreFlamme();
    focusPeindre();
    focusAmorcerFonds();
}

/* Gardé pour les appels existants : ouvre le minuteur. */
function focusOuvrir() {
    focusOuvrirMinuteur();
}

// ── ACCUEIL : les séances de révision et d'exercices du jour ───────────
var focusRafraichirSeancesTimer = null;
var focusSeanceChoisie = null;
var focusSeanceMinuteur = null;
var focusEntreeDepuisSeance = false;

function focusMinutesMaintenant() {
    var d = new Date();
    return d.getHours() * 60 + d.getMinutes();
}

function focusMinutesHeure(texte) {
    if (typeof timeToMinutes === 'function') {
        var n = Number(timeToMinutes(texte));
        if (isFinite(n)) return n;
    }
    var parts = String(texte || '').split(':');
    if (parts.length < 2) return -1;
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function focusDureeTexte(mins) {
    var total = Math.max(0, Math.round(Number(mins) || 0));
    var h = Math.floor(total / 60);
    var m = total % 60;
    if (h > 0 && m > 0) return h + ' h ' + (m < 10 ? '0' : '') + m;
    if (h > 0) return h + ' h';
    return m + ' min';
}

function focusNombrePomodoros(mins) {
    return Math.max(1, Math.ceil(Math.max(1, Number(mins) || 1) / focusDurees().focus));
}

function focusPomodorosTexte(mins) {
    return focusNombrePomodoros(mins) + ' × ' + focusDurees().focus + ' min';
}

function focusJourIndex() {
    /* Le jour sélectionné dans le planning n'est jamais le jour de la séance. */
    if (typeof indexJourCourant === 'function') return indexJourCourant();
    return (new Date().getDay() + 6) % 7;
}

// Séances de révision et d'exercices prévues aujourd'hui dans l'emploi du temps.
function focusSeancesJour() {
    var seances = [];
    if (typeof generateDayEvents !== 'function') return seances;
    var evenements = [];
    try { evenements = generateDayEvents(focusJourIndex()) || []; } catch (e) { return seances; }
    evenements.forEach(function (ev) {
        if (!ev || !ev.startTime || !ev.endTime) return;
        var estEtude = (typeof v3IsStudyType === 'function')
            ? v3IsStudyType(ev.type)
            : (ev.type === 'study' || ev.type === 'critical' || ev.type === 'warning');
        if (!estEtude) return;
        var debut = focusMinutesHeure(ev.startTime);
        var fin = focusMinutesHeure(ev.endTime);
        if (!(fin > debut)) return;
        seances.push({
            id: String(ev.id),
            titre: String(ev.title || 'Séance'),
            sous: String(ev.subtitle || ''),
            icone: ev.icon || '📚',
            debutTexte: ev.startTime,
            finTexte: ev.endTime,
            debut: debut,
            fin: fin,
            duree: fin - debut
        });
    });
    seances.sort(function (a, b) { return a.debut - b.debut; });
    return seances;
}

function focusEtatSeance(seance) {
    var maintenant = focusMinutesMaintenant();
    if (maintenant >= seance.debut && maintenant < seance.fin) return { cle: 'encours', texte: 'En cours' };
    if (maintenant < seance.debut) return { cle: 'avenir', texte: 'À venir' };
    return { cle: 'passee', texte: 'Terminée' };
}

function focusDateTexte(index) {
    var texte = '';
    try {
        var date = new Date();
        date.setDate(date.getDate() + (index == null ? focusJourIndex() : index) - ((date.getDay() + 6) % 7));
        texte = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (e) { texte = ''; }
    if (!texte) return '';
    return texte.charAt(0).toUpperCase() + texte.slice(1);
}

function focusAjouterCarteSeance(seance) {
    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'focus-seance' + (focusSeanceChoisie === seance.id ? ' is-on' : '');
    var etat = focusEtatSeance(seance);
    bouton.disabled = etat.cle !== 'encours';
    if (bouton.disabled) bouton.title = 'Disponible uniquement pendant ce créneau';
    var icone = document.createElement('span');
    icone.className = 'focus-seance-icone';
    icone.textContent = seance.icone;
    var texte = document.createElement('span');
    texte.className = 'focus-seance-texte';
    var titre = document.createElement('strong');
    titre.className = 'focus-seance-titre';
    titre.textContent = seance.titre;
    var detail = document.createElement('span');
    detail.className = 'focus-seance-detail';
    detail.textContent = (seance.sous ? seance.sous + ' · ' : '') + seance.debutTexte + ' → ' + seance.finTexte;
    texte.appendChild(titre);
    texte.appendChild(detail);
    var droite = document.createElement('span');
    droite.className = 'focus-seance-droite';
    var duree = document.createElement('span');
    duree.className = 'focus-seance-duree';
    duree.textContent = focusDureeTexte(seance.duree) + ' · ' + focusPomodorosTexte(seance.duree);
    var marque = document.createElement('span');
    marque.className = 'focus-seance-etat is-' + etat.cle;
    marque.textContent = etat.texte;
    droite.appendChild(duree);
    droite.appendChild(marque);
    bouton.appendChild(icone);
    bouton.appendChild(texte);
    bouton.appendChild(droite);
    bouton.onclick = function () {
        focusSeanceChoisie = (focusSeanceChoisie === seance.id) ? null : seance.id;
        focusPeindreAccueil();
    };
    return bouton;
}

function focusAjouterStat(valeur, nom, vert) {
    var boite = document.createElement('div');
    boite.className = 'focus-stat';
    var nombre = document.createElement('span');
    nombre.className = 'focus-stat-valeur' + (vert ? ' is-vert' : '');
    nombre.textContent = valeur;
    var libelle = document.createElement('span');
    libelle.className = 'focus-stat-nom';
    libelle.textContent = nom;
    boite.appendChild(nombre);
    boite.appendChild(libelle);
    return boite;
}

function focusPeindreAccueil() {
    var liste = document.getElementById('focusAccueilListe');
    if (!liste) return;
    var seances = focusSeancesJour();
    focusChoisirSeance();

    var fond = document.getElementById('focusAccueilFond');
    if (fond) focusFondAccueil((FOCUS_FONDS[focusEtat.fond] || FOCUS_FONDS[0]).src);
    if (typeof accueilPeindreFonds === 'function') accueilPeindreFonds();

    var bonjour = document.getElementById('focusAccueilBonjour');
    if (bonjour) {
        var heure = new Date().getHours();
        var mot = heure < 18 ? 'Bonjour' : 'Bonsoir';
        var nom = (typeof userName !== 'undefined' && userName) ? String(userName) : '';
        bonjour.textContent = mot + (nom ? ' ' + nom : '');
    }

    var total = 0;
    var pomodoros = 0;
    seances.forEach(function (s) {
        total += s.duree;
        pomodoros += focusNombrePomodoros(s.duree);
    });

    var stats = document.getElementById('focusAccueilStats');
    if (stats) {
        stats.innerHTML = '';
        stats.appendChild(focusAjouterStat(String(seances.length), seances.length > 1 ? 'séances' : 'séance', false));
        stats.appendChild(focusAjouterStat(focusDureeTexte(total), 'de travail', false));
        stats.appendChild(focusAjouterStat(String(pomodoros), 'sessions de ' + focusDurees().focus + ' min', true));
    }

    liste.innerHTML = '';
    if (!seances.length) {
        var vide = document.createElement('p');
        vide.className = 'focus-accueil-vide';
        vide.textContent = "Aucune séance de révision ou d'exercices n'est prévue aujourd'hui. Ajoute une séance dans ton emploi du temps.";
        liste.appendChild(vide);
    } else {
        seances.forEach(function (s) { liste.appendChild(focusAjouterCarteSeance(s)); });
    }

    var note = document.getElementById('focusAccueilNote');
    if (note) {
        var choisie = null;
        seances.forEach(function (s) { if (s.id === focusSeanceChoisie) choisie = s; });
        if (choisie) note.textContent = 'Séance en cours : « ' + choisie.titre + ' » de ' + choisie.debutTexte + ' à ' + choisie.finTexte + '.';
        else if (seances.length) note.textContent = 'Aucune séance en cours. Les séances passées ou à venir ne peuvent pas être lancées.';
        else note.textContent = 'Aucune séance ne peut être lancée pour le moment.';
        var continuer = document.getElementById('focusAccueilContinuer');
        if (continuer) continuer.disabled = !choisie || focusEtatSeance(choisie).cle !== 'encours';
    }
}

function focusSignatureSeances() {
    return new Date().toDateString() + '|' + focusSeancesJour().map(function (s) {
        return s.id + ':' + focusEtatSeance(s).cle;
    }).join('|');
}

/* Seule une séance qui a commencé et n'est pas finie est sélectionnable. */
function focusChoisirSeance() {
    var seances = focusSeancesJour().filter(function (s) { return focusEtatSeance(s).cle === 'encours'; });
    if (seances.some(function (s) { return s.id === focusSeanceChoisie; })) return;
    focusSeanceChoisie = seances.length ? seances[0].id : null;
}

// De la liste au minuteur : une nouvelle étape dans l'historique, donc le
// bouton retour du navigateur ramène d'abord sur la séance de révision.
function focusEntrerPiece(libre) {
    if (libre) return; /* ancien raccourci : ne doit jamais contourner le créneau */
    focusChoisirSeance();
    var choisie = focusSeancesJour().filter(function (s) {
        return s.id === focusSeanceChoisie && focusEtatSeance(s).cle === 'encours';
    })[0];
    if (!choisie) {
        focusPeindreAccueil();
        return;
    }
    var objectif = document.getElementById('focusTache');
    var saisi = objectif ? objectif.value.trim() : '';
    if (saisi && saisi !== choisie.titre && typeof confirmerAction === 'function') {
        confirmerAction({ titre: 'Garder ton objectif ?',
            detail: 'Un objectif est déjà saisi. Garde-le ou ajoute le titre de la séance.',
            annulerTexte: 'Garder mon objectif', annuler: function () { focusValiderSeance(choisie, saisi); },
            action: 'Accoler la séance', confirmer: function () { focusValiderSeance(choisie, saisi + ' · ' + choisie.titre); }
        });
        return;
    }
    focusValiderSeance(choisie, choisie.titre);
}

function focusValiderSeance(choisie, objectif) {
    /* Le créneau peut expirer pendant que l'élève choisit son objectif. */
    if (focusEtatSeance(choisie).cle !== 'encours') { focusPeindreAccueil(); return; }
    focusSeanceMinuteur = { id: choisie.id, debut: choisie.debut, fin: choisie.fin,
        date: new Date().toDateString() };
    focusEntreeDepuisSeance = true;
    try { sessionStorage.setItem('studyPlanIB_focusSeanceEnCours', JSON.stringify(focusSeanceMinuteur)); } catch (e) {}
    var champ = document.getElementById('focusTache');
    if (champ) {
        champ.value = objectif;
        focusMemoriserObjectif();
    }
    focusPeindre();
    if (typeof memoireAller === 'function') memoireAller('pomodoro');
    else if (typeof navigateTo === 'function') navigateTo('pomodoro');
    else focusOuvrirMinuteur();
}

function focusDecoderImage(src, suite) {
    if (!src) {
        if (suite) suite(false);
        return;
    }
    if (focusFondsPrets[src]) {
        if (suite) suite(true);
        return;
    }
    var img = new Image();
    var fait = false;
    var finir = function (ok) {
        if (fait) return;
        fait = true;
        /* On garde l'image décodée en mémoire : le clic suivant la pose alors
           sans le moindre délai. */
        if (ok) focusFondsPrets[src] = img;
        if (suite) suite(!!ok);
    };
    img.onload = function () {
        if (img.decode) img.decode().then(function () { finir(true); }, function () { finir(true); });
        else finir(true);
    };
    img.onerror = function () { finir(false); };
    img.src = src;
}

function focusAmorcageUtile() {
    try {
        if (typeof navigator === 'undefined') return true;
        var reseau = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (!reseau) return true;
        if (reseau.saveData) return false;
        var type = String(reseau.effectiveType || '');
        return type !== 'slow-2g' && type !== '2g' && type !== '3g';
    } catch (e) {
        return true;
    }
}

/* Prépare les images en avance, une par une, pour que le clic soit instantané. */
function focusAmorcerFonds() {
    if (focusFondsFile || focusFondsArret || !focusAmorcageUtile()) return;
    var ordre = [];
    var i;
    for (i = 0; i < FOCUS_FONDS.length; i++) ordre.push((focusEtat.fond + i) % FOCUS_FONDS.length);
    var rang = 0;
    var suivant = function () {
        if (rang >= ordre.length) {
            focusFondsFile = null;
            return;
        }
        var fond = FOCUS_FONDS[ordre[rang]];
        rang += 1;
        if (!fond || fond.precharger === false || focusFondsPrets[fond.src]) {
            suivant();
            return;
        }
        focusFondsFile = setTimeout(function () {
            focusFondsFile = null;
            focusDecoderImage(fond.src, suivant);
        }, 200);
    };
    suivant();
}

function focusArreterFonds() {
    focusFondsArret = true;
    if (focusFondsFile) {
        clearTimeout(focusFondsFile);
        focusFondsFile = null;
    }
}

function focusPeindreCalque(el, src) {
    if (!el || !src) return;
    el.style.backgroundImage = 'url("' + src + '")';
    el.style.backgroundPosition = 'center center';
    el.style.backgroundSize = 'cover';
    el.style.backgroundRepeat = 'no-repeat';
}

/* Change le décor. L'ancienne image reste affichée telle quelle pendant que la
   nouvelle se charge, puis la nouvelle est posée d'un coup : aucun fondu, donc
   jamais l'ancienne image qui réapparaît ni le planning derrière. */
function focusFondPage(src) {
    if (!src) return;
    if (src === focusFondActif) {
        focusFondDemande = '';
        focusPeindreFonds();
        return;
    }
    var bg = document.getElementById('focusBg');
    if (!bg) {
        focusFondActif = src;
        return;
    }
    focusFondDemande = src;
    focusPeindreFonds();
    focusDecoderImage(src, function (ok) {
        /* Un décodage plus ancien ne doit pas écraser le dernier choix. */
        if ((FOCUS_FONDS[focusEtat.fond] || FOCUS_FONDS[0]).src !== src) return;
        focusFondDemande = '';
        focusPeindreFonds();
        if (!ok) return;
        /* L'image est déjà décodée : le navigateur la peint dans la même image
           (au sens écran), sans passer par l'ancienne. */
        focusPeindreCalque(bg, src);
        focusFondActif = src;
        focusPipMaj();
    });
}

function focusFondAccueil(src) {
    var el = document.getElementById('focusAccueilFond');
    if (!el || !src || focusAccueilActif === src) return;
    focusDecoderImage(src, function (ok) {
        if (!ok || (FOCUS_FONDS[focusEtat.fond] || FOCUS_FONDS[0]).src !== src) return;
        focusAccueilActif = src;
        focusPeindreCalque(el, src);
    });
}

/* Le poster reste visible tant que la vidéo ne joue pas (chargement, hors ligne,
   navigateur incompatible). Une seule vidéo tourne, uniquement sur la page
   visible ; elle est muette, sans commandes, et boucle indépendamment du chrono. */
function focusSynchroniserVideosFond() {
    var fond = FOCUS_FONDS[focusEtat.fond] || FOCUS_FONDS[0];
    [
        { panneau: 'panelPomodoro', page: 'focusPage', calque: 'focusBg' },
        { panneau: 'panelSeances', page: 'focusAccueil', calque: 'focusAccueilFond' }
    ].forEach(function (cible) {
        var panel = document.getElementById(cible.panneau);
        var page = document.getElementById(cible.page);
        var calque = document.getElementById(cible.calque);
        if (!calque) return;
        var video = calque.querySelector('.focus-fond-video');
        var visible = !!fond.video && !!panel && panel.classList.contains('active') &&
            !!page && !page.hidden && !document.hidden;
        if (!visible) {
            if (video) {
                video.pause();
                video.removeAttribute('src');
                video.load();
                video.remove();
            }
            return;
        }
        if (video && video.getAttribute('src') === fond.video) return;
        if (video) { video.pause(); video.remove(); }
        video = document.createElement('video');
        video.className = 'focus-fond-video';
        video.muted = true;
        video.defaultMuted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.setAttribute('playsinline', '');
        video.setAttribute('aria-hidden', 'true');
        video.setAttribute('tabindex', '-1');
        video.addEventListener('playing', function () { video.classList.add('is-visible'); });
        video.addEventListener('error', function () { video.classList.remove('is-visible'); });
        video.src = fond.video;
        calque.appendChild(video);
        var lecture = video.play();
        if (lecture && lecture.catch) lecture.catch(function () { video.classList.remove('is-visible'); });
    });
}

function focusObserverVideosFond() {
    if (focusObserverVideosFond.pret) return;
    focusObserverVideosFond.pret = true;
    if (typeof MutationObserver === 'function') {
        var observateur = new MutationObserver(focusSynchroniserVideosFond);
        ['panelPomodoro', 'panelSeances'].forEach(function (id) {
            var panneau = document.getElementById(id);
            if (panneau) observateur.observe(panneau, { attributes: true, attributeFilter: ['class'] });
        });
    }
    document.addEventListener('visibilitychange', focusSynchroniserVideosFond);
}

function focusPreparerFonds() {
    var bande = document.getElementById('focusFonds');
    if (bande && !bande.childNodes.length) {
        FOCUS_FONDS.forEach(function (fond, i) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'focus-vignette';
            btn.hidden = !!fond.masque; // conserve les indices des galeries historiques
            btn.setAttribute('aria-label', fond.nom);
            btn.style.backgroundImage = 'url("' + (fond.mini || fond.src) + '")';
            btn.style.backgroundPosition = 'center center';
            btn.style.backgroundSize = 'cover';
            btn.style.backgroundRepeat = 'no-repeat';
            var amorcer = function () { focusDecoderImage(fond.src); };
            btn.onclick = function () { focusPoserFond(i); };
            btn.onmouseenter = amorcer;
            btn.onfocus = amorcer;
            btn.ontouchstart = amorcer;
            bande.appendChild(btn);
        });
    }
    focusAmorcerFonds();
}

/* Le second paramètre reste accepté (ouverture du panneau) : l image n est de
   toute façon posée qu une fois décodée, donc jamais de trou dans le décor. */
function focusPoserFond(index, immediat) {
    if (index < 0 || index >= FOCUS_FONDS.length) return;
    if (FOCUS_FONDS[index].remplacePar) index = focusIndexParId(FOCUS_FONDS[index].remplacePar);
    focusEtat.fond = index;
    var fond = FOCUS_FONDS[index];
    try { localStorage.setItem('studyPlanIB_focusFond', String(index)); } catch (e) {}
    focusPeindreFonds();
    focusFondPage(fond.src);
    focusFondAccueil(fond.src);
    focusSynchroniserVideosFond();
    focusPipMaj();
}

function focusChoisirMode(mode, enchainement) {
    if (mode !== 'focus' && mode !== 'short' && mode !== 'long') return;
    if (!enchainement && focusEtat.running && focusEtat.mode !== mode) focusPause();
    focusEtat.mode = mode;
    var minutes = focusDurees()[mode];
    focusEtat.total = minutes * 60;
    focusEtat.restant = focusEtat.total;
    if (enchainement && focusEtat.running) focusEtat.fin = Date.now() + focusEtat.restant * 1000;
    focusPeindre();
    if (enchainement !== false) {
        var statut = document.getElementById('focusModeStatut');
        if (statut) statut.textContent = mode === 'focus' ? 'Concentration sélectionnée' : mode === 'short' ? 'Pause courte sélectionnée' : 'Pause longue sélectionnée';
    }
}

/* Une concentration qui part de zéro compte comme « minuteur lancé » (pour le score). */
function focusCompterLancement() {
    if (typeof statsEnregistrer !== 'function') return;
    if (focusEtat.mode === 'focus' && focusEtat.restant >= focusEtat.total) statsEnregistrer({ k: 'lance' });
}

function focusBasculer() {
    var panel = document.getElementById('panelPomodoro');
    if (!panel || !panel.classList.contains('active')) return;
    focusCharger();
    if (focusEtat.running) {
        focusPause();
        return;
    }
    if (focusEtat.mode === 'focus' && focusSeanceMinuteur &&
        (focusSeanceMinuteur.date !== new Date().toDateString() ||
         focusMinutesMaintenant() < focusSeanceMinuteur.debut ||
         focusMinutesMaintenant() >= focusSeanceMinuteur.fin)) {
        focusSeanceMinuteur = null;
        focusEtat.run = false;
        focusEtat.serie = 0;
        try { sessionStorage.removeItem('studyPlanIB_focusSeanceEnCours'); } catch (e) {}
        if (typeof memoireAller === 'function') memoireAller('seances');
        else if (typeof navigateTo === 'function') navigateTo('seances');
        return;
    }
    if (focusEtat.restant <= 0) focusEtat.restant = focusEtat.total;
    /* une série (compteurs) commence à la première concentration lancée ;
       l'enchaînement automatique, lui, n'existe que pour une séance de révision */
    if (focusEtat.mode === 'focus' && !focusEtat.run) {
        focusEtat.run = true;
        focusEtat.serie = 0;
    }
    focusCompterLancement();
    focusEtat.running = true;
    focusEtat.fin = Date.now() + focusEtat.restant * 1000;
    focusLancerIntervalle();
    focusInitAudio();
    /* la musique d'ambiance que la pause avait arrêtée revient pour ce
       temps de concentration, pas avant */
    if (focusEtat.mode === 'focus' && typeof chronoRendreMusique === 'function') {
        try { chronoRendreMusique(); } catch (e) {}
    }
    /* le geste de départ autorise le son : les morceaux de la fin de
       séance se chargent maintenant, pas au moment de parler */
    if (typeof chronoVoixPreparer === 'function') {
        try { chronoVoixPreparer([focusDurees().short, focusDurees().long]); } catch (e) {}
    }
    focusPeindre();
}

function focusPause() {
    if (focusEtat.running) {
        focusEtat.restant = Math.max(0, Math.round((focusEtat.fin - Date.now()) / 1000));
    }
    focusEtat.running = false;
    focusStopIntervalle();
    focusTitre();
    focusPeindre();
}

function focusRecommencer() {
    focusPause();
    focusEtat.restant = focusDurees()[focusEtat.mode] * 60;
    focusEtat.total = focusEtat.restant;
    focusPeindre();
}

/* Une série de révision est en cours : les séances s'enchaînent seules. */
function focusEnchainementSeance() {
    return !!(focusEtat.run && focusSeanceMinuteur);
}

/* Lance la phase en cours (sa durée) tout de suite. */
function focusLancerPhase() {
    focusEtat.running = true;
    focusEtat.fin = Date.now() + focusEtat.restant * 1000;
    focusLancerIntervalle();
}

function focusPhaseSuivante(silencieux) {
    var fini = focusEtat.mode;
    /* La phase qui se termine est notée pour les statistiques (une fois, ici seulement). */
    if (typeof statsEnregistrer === 'function') {
        statsEnregistrer({ k: fini, m: Math.round(focusEtat.total / 60),
            s: fini === 'focus' && focusSeanceMinuteur ? focusSeanceMinuteur.id : null });
    }
    focusEtat.running = false;
    focusStopIntervalle();
    /* Enchaînement automatique : séance de révision seulement, et pas au rattrapage. */
    var chaine = focusEnchainementSeance() && !silencieux;

    if (fini === 'focus') {
        focusEtat.cycles += 1;
        /* La série compte chaque concentration terminée, minuteur libre compris. */
        if (focusEtat.run) {
            focusEtat.serie = Math.min(focusDurees().seances, focusEtat.serie + 1);
            if (focusEtat.serie >= focusDurees().seances) focusEtat.run = false;
        }
        if (chaine) {
            if (!focusEtat.run) {
                /* Dernière séance de la série : fin, sans pause. */
                focusChoisirMode('focus', false);
                if (typeof chronoBipDoux === 'function') chronoBipDoux(); else focusBip(2);
                focusPeindre();
                focusTitre();
                if (typeof focusNotifierFin === 'function') focusNotifierFin(fini);
                return;
            }
            /* Pause courte, sauf après la 3e séance : pause longue. La pause démarre seule. */
            var pauseSerie = focusPauseApres(focusEtat.serie);
            focusChoisirMode(pauseSerie, false);
            if (typeof chronoAnnoncerPause === 'function') chronoAnnoncerPause(focusDurees()[pauseSerie]);
            else focusBip(2);
            focusLancerPhase();
            focusPeindre();
            focusTitre();
            if (typeof focusNotifierFin === 'function') focusNotifierFin(fini);
            return;
        }
        /* Minuteur libre : la phase suivante est proposée, jamais lancée d'elle-même. */
        var modePause = focusEtat.cycles % focusDurees().seances === 0 ? 'long' : 'short';
        /* la pause annoncée est celle de la configuration de l'élève,
           pas une valeur écrite dans le site */
        var minutesPause = focusDurees()[modePause];
        focusChoisirMode(modePause, false);
        if (silencieux) { /* rattrapage au rechargement : pas d'annonce */ }
        else if (typeof chronoAnnoncerPause === 'function') chronoAnnoncerPause(minutesPause);
        else focusBip(2);
    } else {
        focusChoisirMode('focus', false);
        if (chaine) {
            /* Même son qu'à la fin d'une séance, puis la concentration reprend seule. */
            if (typeof chronoBipDoux === 'function') chronoBipDoux(); else focusBip(1);
            focusLancerPhase();
            if (typeof chronoRendreMusique === 'function') { try { chronoRendreMusique(); } catch (e) {} }
            focusPeindre();
            focusTitre();
            if (typeof focusNotifierFin === 'function') focusNotifierFin(fini);
            return;
        }
        if (silencieux) { /* rattrapage au rechargement : pas d'annonce */ }
        else if (typeof chronoAnnoncerReprise === 'function') chronoAnnoncerReprise();
        else focusBip(1);
    }
    focusPeindre();
    focusTitre();
    /* Options du panneau Paramètres : notification de fin, enchaînement automatique.
       Un rattrapage au rechargement ne déclenche rien. */
    if (!silencieux && typeof focusNotifierFin === 'function') {
        focusNotifierFin(fini);
        if (focusLireReglages().auto) focusDemarrerEnchainement();
    }
}

function focusTick() {
    if (!focusEtat.running) {
        focusStopIntervalle();
        return;
    }
    var rem = Math.max(0, Math.round((focusEtat.fin - Date.now()) / 1000));
    focusEtat.restant = rem;
    if (rem <= 0) focusPhaseSuivante();
    focusPeindre();
}

function focusLancerIntervalle() {
    if (focusTimer) return;
    focusTimer = setInterval(focusTick, 250);
}

function focusStopIntervalle() {
    if (!focusTimer) return;
    clearInterval(focusTimer);
    focusTimer = null;
}

function focusPeindre() {
    var time = document.getElementById('focusTime');
    if (time) time.textContent = focusTexte(focusEtat.restant);
    ['focus', 'short', 'long'].forEach(function (mode) {
        var btn = document.getElementById(mode === 'focus' ? 'focusModeFocus' : mode === 'short' ? 'focusModeShort' : 'focusModeLong');
        if (btn) { btn.classList.toggle('is-on', focusEtat.mode === mode); btn.setAttribute('aria-pressed', String(focusEtat.mode === mode)); }
    });
    var iconePlay = document.getElementById('focusIconPlay');
    var iconePause = document.getElementById('focusIconPause');
    if (iconePlay) iconePlay.style.display = focusEtat.running ? 'none' : 'block';
    if (iconePause) iconePause.style.display = focusEtat.running ? 'block' : 'none';
    var bouton = document.getElementById('focusPlay');
    if (bouton) bouton.setAttribute('aria-label', focusEtat.running ? 'Pause' : 'Démarrer');
    var astuce = document.getElementById('focusAstuce');
    var ampoule = document.getElementById('focusBtnAstuce');
    if (astuce) {
        astuce.hidden = !focusEtat.astuce;
        astuce.textContent = FOCUS_ASTUCES[focusEtat.mode] || '';
    }
    if (ampoule) ampoule.classList.toggle('is-on', !!focusEtat.astuce);
    focusPeindreFonds();
    focusTitre();
    focusPipMaj();
    if (typeof focusPeindreCompteur === 'function') focusPeindreCompteur();
    if (typeof planningMinuteurEntete === 'function') planningMinuteurEntete();
    focusSauverEtat();
    /* style d'affichage, police, heure et citation : js/pages/pomodoro-parametres.js */
    if (typeof focusPeindreParametres === 'function') focusPeindreParametres();
}

function focusPeindreFonds() {
    var vignettes = document.querySelectorAll('#focusFonds .focus-vignette');
    vignettes.forEach(function (btn, i) {
        var fond = FOCUS_FONDS[i];
        var enAttente = !!fond && fond.src === focusFondDemande && fond.src !== focusFondActif;
        btn.classList.toggle('is-on', i === focusEtat.fond);
        btn.classList.toggle('is-chargement', enAttente);
        if (enAttente) btn.setAttribute('aria-busy', 'true');
        else btn.removeAttribute('aria-busy');
    });
}

function focusTitre() {
    if (typeof document === 'undefined') return;
    if (focusEtat.running) document.title = focusTexte(focusEtat.restant) + ' · focus';
    else if (document.title.indexOf(' · focus') !== -1) document.title = focusTitreOrig;
}

function focusPeindreFlamme() {
    var el = document.getElementById('focusFlamme');
    if (!el) return;
    var n = 0;
    try { n = parseInt(localStorage.getItem('studyPlanIB_flamme') || '0', 10) || 0; } catch (e) {}
    if (typeof boiteFlammes === 'function') n = boiteFlammes();
    el.textContent = String(n);
}

function focusBasculerTaches() {
    if (typeof focusFermerMusique === 'function') { try { focusFermerMusique(); } catch (e) {} }
    focusFermer('focusReglages');
    focusFermer('focusFonds');
    focusFermer('focusSons');
    var panneau = document.getElementById('focusTaches');
    if (!panneau) return;
    panneau.hidden = !panneau.hidden;
    if (panneau.hidden) {
        focusMenuTache = null;
        focusSousCible = null;
    }
    var bouton = document.getElementById('focusBtnTaches');
    if (bouton) bouton.classList.toggle('is-on', !panneau.hidden);
    if (!panneau.hidden) focusPeindreTaches();
}

function focusBasculerReglages() {
    focusFermer('focusTaches');
    focusFermer('focusFonds');
    focusFermer('focusSons');
    var panneau = document.getElementById('focusReglages');
    if (!panneau) return;
    if (panneau.hidden) focusRemplirDurees();
    panneau.hidden = !panneau.hidden;
}

function focusBasculerFonds() {
    focusFermer('focusTaches');
    focusFermer('focusReglages');
    focusFermer('focusSons');
    var bande = document.getElementById('focusFonds');
    if (!bande) return;
    focusPreparerFonds();
    bande.hidden = !bande.hidden;
    focusPeindreFonds();
}

function focusBasculerAstuce() {
    focusEtat.astuce = !focusEtat.astuce;
    focusPeindre();
}

function focusFermer(id) {
    var el = document.getElementById(id);
    if (el) el.hidden = true;
    if (id === 'focusTaches') {
        var bouton = document.getElementById('focusBtnTaches');
        if (bouton) bouton.classList.remove('is-on');
    }
}

function focusAjouterDepuisBouton() {
    var champ = document.getElementById('focusNouvelle');
    if (!champ) return;
    focusAjouterTache({ preventDefault: function () {} });
}

function focusAjouterTache(event) {
    if (event) event.preventDefault();
    var champ = document.getElementById('focusNouvelle');
    var texte = champ ? champ.value.trim() : '';
    if (!texte) return false;
    focusTaches.push({ id: Date.now(), texte: texte, fait: false });
    if (champ) champ.value = '';
    focusSauverTaches();
    var objectif = document.getElementById('focusTache');
    if (objectif && !objectif.value.trim()) objectif.value = texte;
    focusMemoriserObjectif();
    focusPeindreTaches();
    return false;
}

function focusTacheParId(id) {
    var i, j, sous;
    for (i = 0; i < focusTaches.length; i++) {
        if (focusTaches[i] && focusTaches[i].id === id) return focusTaches[i];
        sous = focusSousTaches(focusTaches[i]);
        for (j = 0; j < sous.length; j++) {
            if (sous[j] && sous[j].id === id) return sous[j];
        }
    }
    return null;
}

function focusSousTaches(tache) {
    if (!tache) return [];
    if (!Array.isArray(tache.sous)) tache.sous = [];
    return tache.sous;
}

function focusNouvelId() {
    return Date.now() + Math.floor(Math.random() * 100000);
}

function focusCocherTache(id) {
    var tache = focusTacheParId(id);
    if (tache) tache.fait = !tache.fait;
    if (tache && typeof statsEnregistrer === 'function') {
        if (tache.fait) statsEnregistrer({ k: 'tache', id: tache.id });
        else if (typeof statsRetirerTache === 'function') statsRetirerTache(tache.id);
    }
    focusSauverTaches();
    focusPeindreTaches();
}

function focusChoisirTache(id) {
    var trouve = focusTacheParId(id);
    var champ = document.getElementById('focusTache');
    if (trouve && champ) {
        champ.value = trouve.texte;
        focusMemoriserObjectif();
    }
}

function focusSauverTaches() {
    try { localStorage.setItem('studyPlanIB_focusTaches', JSON.stringify(focusTaches.slice(-40))); } catch (e) {}
}

function focusPeindreTaches() {
    var liste = document.getElementById('focusListe');
    if (!liste) return;
    liste.innerHTML = '';
    if (!focusTaches.length) return;
    focusTaches.forEach(function (tache) {
        liste.appendChild(focusLigneTache(tache, null));
    });
}

function focusBoutonTache(tache, parent) {
    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'focus-tache-menu' + (focusMenuTache === tache.id ? ' is-on' : '');
    bouton.setAttribute('aria-label', 'Options');
    bouton.setAttribute('aria-haspopup', 'menu');
    bouton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg>';
    bouton.onclick = function (event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        focusMenuTache = focusMenuTache === tache.id ? null : tache.id;
        focusSousCible = null;
        focusPeindreTaches();
    };
    return bouton;
}

function focusOptionTache(action, libelle, icone, danger, tache, parent) {
    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'focus-menu-item' + (danger ? ' is-danger' : '');
    bouton.setAttribute('role', 'menuitem');
    bouton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icone + '</svg><span>' + libelle + '</span>';
    bouton.onclick = function (event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        focusActionTache(action, tache, parent);
    };
    return bouton;
}

function focusOptionsTache(tache, parent) {
    var menu = document.createElement('div');
    menu.className = 'focus-menu';
    menu.setAttribute('role', 'menu');
    if (!parent) {
        menu.appendChild(focusOptionTache('sous', 'Ajouter une sous-tâche', '<path d="M12 5v14M5 12h14"/>', false, tache, parent));
    }
    menu.appendChild(focusOptionTache('dupliquer', 'Dupliquer', '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5h10"/>', false, tache, parent));
    menu.appendChild(focusOptionTache('supprimer', parent ? 'Supprimer la sous-tâche' : 'Supprimer la tâche', '<path d="M6 6l12 12M18 6 6 18"/>', true, tache, parent));
    return menu;
}

function focusActionTache(action, tache, parent) {
    var cible = parent ? focusSousTaches(parent) : focusTaches;
    var index = cible.indexOf(tache);
    if (action === 'sous') {
        focusMenuTache = null;
        focusSousCible = tache.id;
        focusPeindreTaches();
        var champ = document.querySelector('#focusListe .focus-sous-form input');
        if (champ) champ.focus();
        return;
    }
    if (action === 'dupliquer' && index !== -1) {
        var copie = { id: focusNouvelId(), texte: tache.texte, fait: false, sous: [] };
        focusSousTaches(tache).forEach(function (sous) {
            copie.sous.push({ id: focusNouvelId(), texte: sous.texte, fait: false });
        });
        cible.splice(index + 1, 0, copie);
    } else if (action === 'supprimer' && index !== -1) {
        cible.splice(index, 1);
    }
    focusMenuTache = null;
    focusSousCible = null;
    focusSauverTaches();
    focusPeindreTaches();
}

function focusAjouterSousTache(event, id) {
    if (event) event.preventDefault();
    var tache = focusTacheParId(id);
    var champ = document.querySelector('#focusListe .focus-sous-form input');
    var texte = champ ? champ.value.trim() : '';
    if (!tache || !texte) return false;
    focusSousTaches(tache).push({ id: focusNouvelId(), texte: texte, fait: false });
    focusSousCible = id;
    focusSauverTaches();
    focusPeindreTaches();
    var suivant = document.querySelector('#focusListe .focus-sous-form input');
    if (suivant) suivant.focus();
    return false;
}

function focusLigneTache(tache, parent) {
    var li = document.createElement('li');
    var ligne = document.createElement('div');
    ligne.className = 'focus-ligne' + (parent ? ' is-sous' : '');
    var check = document.createElement('button');
    check.type = 'button';
    check.className = 'focus-check' + (tache.fait ? ' is-on' : '');
    check.setAttribute('aria-label', 'Marquer');
    check.textContent = tache.fait ? '✓' : '';
    check.onclick = function () { focusCocherTache(tache.id); };
    var nom = document.createElement('button');
    nom.type = 'button';
    nom.className = 'focus-tache' + (tache.fait ? ' is-fait' : '');
    nom.textContent = tache.texte;
    nom.onclick = function () { focusChoisirTache(tache.id); };
    ligne.appendChild(check);
    ligne.appendChild(nom);
    ligne.appendChild(focusBoutonTache(tache, parent));
    li.appendChild(ligne);
    if (focusMenuTache === tache.id) li.appendChild(focusOptionsTache(tache, parent));
    if (!parent) {
        var sous = focusSousTaches(tache);
        if (sous.length) {
            var ul = document.createElement('ul');
            ul.className = 'focus-sous';
            sous.forEach(function (item) {
                ul.appendChild(focusLigneTache(item, tache));
            });
            li.appendChild(ul);
        }
        if (focusSousCible === tache.id) {
            var form = document.createElement('form');
            form.className = 'focus-sous-form';
            form.onsubmit = function (event) { return focusAjouterSousTache(event, tache.id); };
            var champ = document.createElement('input');
            champ.type = 'text';
            champ.maxLength = 120;
            champ.placeholder = 'Nouvelle sous-tâche';
            champ.autocomplete = 'off';
            form.appendChild(champ);
            li.appendChild(form);
            setTimeout(function () { champ.focus(); }, 0);
        }
    }
    return li;
}

function focusRemplirDurees() {
    var durees = focusDurees();
    var focus = document.getElementById('focusDureeFocus');
    var courte = document.getElementById('focusDureeShort');
    var longue = document.getElementById('focusDureeLong');
    if (focus) focus.value = String(durees.focus);
    if (courte) courte.value = String(durees.short);
    if (longue) longue.value = String(durees.long);
    focusPeindreSeances(durees.seances);
}

/* Texte de la question : rappelle le nombre choisi. */
function focusPeindreSeances(n) {
    var champ = document.getElementById('focusDureeSeances');
    var nombre = focusBorner(n === undefined ? (champ && champ.value) : n, 4, 1, 12);
    if (champ && champ.value !== String(nombre)) champ.value = String(nombre);
}

/* Boutons − et + : un pas à la fois, entre 1 et 12. */
function focusAjusterSeances(pas) {
    var champ = document.getElementById('focusDureeSeances');
    if (!champ) return;
    champ.value = String(focusBorner(Number(champ.value) + pas, 4, 1, 12));
    focusSauverDurees();
}

function focusSauverDurees() {
    var durees = {
        focus: focusBorner(document.getElementById('focusDureeFocus') && document.getElementById('focusDureeFocus').value, 25, 1, 180),
        short: focusBorner(document.getElementById('focusDureeShort') && document.getElementById('focusDureeShort').value, 5, 1, 60),
        long: focusBorner(document.getElementById('focusDureeLong') && document.getElementById('focusDureeLong').value, 15, 1, 60),
        seances: focusBorner(document.getElementById('focusDureeSeances') && document.getElementById('focusDureeSeances').value, 4, 1, 12)
    };
    try { localStorage.setItem('studyPlanIB_focusDurees', JSON.stringify(durees)); } catch (e) {}
    focusPeindreSeances(durees.seances);
    if (!focusEtat.running) {
        focusEtat.total = durees[focusEtat.mode] * 60;
        focusEtat.restant = focusEtat.total;
        focusPeindre();
    }
}

function focusMemoriserObjectif() {
    var champ = document.getElementById('focusTache');
    try { localStorage.setItem('studyPlanIB_focusTache', champ ? champ.value.trim() : ''); } catch (e) {}
}

function focusMaison() {
    focusSortirPleinEcran();
    focusArreterSon();
    focusArreterFonds();
    focusFermerPip();
    focusFermer('focusTaches');
    focusFermer('focusReglages');
    focusFermer('focusFonds');
    focusFermer('focusSons');
    /* Le bouton maison du minuteur ramène au planning. */
    if (typeof memoireAller === 'function') memoireAller('planning');
    else if (typeof navigateTo === 'function') navigateTo('planning');
}

function focusFondAbsolu() {
    var src = focusFondActif;
    if (!src) {
        var fond = FOCUS_FONDS[focusEtat.fond] || FOCUS_FONDS[0];
        src = fond && fond.src ? fond.src : '';
    }
    try { return new URL(src, location.href).href; } catch (e) { return src; }
}

function focusPipHtml() {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Studyplan</title><style>' +
        'html,body{margin:0;height:100%;background:#111;color:#fff;font-family:Inter,system-ui,sans-serif;user-select:none;caret-color:transparent;overflow:hidden;}' +
        '.scene{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#111 center/cover no-repeat;}' +
        '.time{margin:0;font-size:clamp(2.6rem,17vw,5.2rem);font-weight:800;letter-spacing:-.045em;line-height:.9;text-shadow:0 2px 18px rgba(0,0,0,.35);}' +
        'button{margin-top:.7rem;width:2.7rem;height:2.45rem;border-radius:.65rem;border:1px solid rgba(255,255,255,.18);background:rgba(8,12,20,.55);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;}' +
        'button:hover{background:#10b981;border-color:#059669;}' +
        '.coin{position:absolute;right:.85rem;bottom:.65rem;display:flex;flex-direction:column;align-items:flex-end;gap:.28rem;}' +
        '.dots{display:flex;gap:.28rem;}' +
        '.dots i{width:.32rem;height:.32rem;border-radius:50%;background:#fff;display:block;}' +
        '</style></head><body><div class="scene" id="pipScene">' +
        '<p class="time" id="pipTime">25:00</p>' +
        '<button type="button" id="pipPlay" aria-label="Démarrer">' +
        '<svg class="pip-ico-play" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5-11-6.5z"/></svg>' +
        '<svg class="pip-ico-pause" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="5" width="4.2" height="14" rx="1"/><rect x="13.8" y="5" width="4.2" height="14" rx="1"/></svg>' +
        '</button><span class="coin"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="#f59e0b" d="M13 2 3.5 13.5h7.2L9.2 22 20.5 9.8h-7.2L13 2z"/></svg>' +
        '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span></span></div></body></html>';
}

function focusPipPeindreBouton(bouton) {
    if (!bouton) return;
    var enCours = !!focusEtat.running;
    var play = bouton.querySelector('.pip-ico-play');
    var pause = bouton.querySelector('.pip-ico-pause');
    if (play) play.style.display = enCours ? 'none' : 'block';
    if (pause) pause.style.display = enCours ? 'block' : 'none';
    bouton.setAttribute('aria-label', enCours ? 'Pause' : 'Démarrer');
}

function focusPipMaj() {
    var temps = focusTexte(focusEtat.restant);
    var fond = 'url("' + focusFondAbsolu() + '")';
    var localTemps = document.getElementById('focusPipTemps');
    var localScene = document.getElementById('focusPipScene');
    if (localTemps) localTemps.textContent = temps;
    if (localScene) {
        localScene.style.backgroundImage = fond;
        localScene.style.backgroundPosition = 'center center';
        localScene.style.backgroundSize = 'cover';
    }
    focusPipPeindreBouton(document.getElementById('focusPipPlay'));
    if (!focusPip || focusPip.closed) return;
    try {
        var doc = focusPip.document;
        var el = doc.getElementById('pipTime');
        var scene = doc.getElementById('pipScene');
        if (el) el.textContent = temps;
        if (scene) {
            scene.style.backgroundImage = fond;
            scene.style.backgroundPosition = 'center center';
            scene.style.backgroundSize = 'cover';
        }
        focusPipPeindreBouton(doc.getElementById('pipPlay'));
    } catch (e) {}
}

function focusPeindrePipBouton() {
    var bouton = document.getElementById('focusBtnPip');
    var ouvert = (focusPip && !focusPip.closed) || (function () {
        var local = document.getElementById('focusPipLocal');
        return local && !local.hidden;
    })();
    if (bouton) bouton.classList.toggle('is-on', !!ouvert);
}

function focusFermerPip() {
    var local = document.getElementById('focusPipLocal');
    if (local) local.hidden = true;
    if (focusPip && !focusPip.closed) {
        try { focusPip.close(); } catch (e) {}
    }
    focusPip = null;
    focusPeindrePipBouton();
}

function focusOuvrirPipLocal() {
    var local = document.getElementById('focusPipLocal');
    if (!local) return;
    local.hidden = false;
    focusPipMaj();
    focusPeindrePipBouton();
}

function focusImageDansImage() {
    var local = document.getElementById('focusPipLocal');
    if ((focusPip && !focusPip.closed) || (local && !local.hidden)) {
        focusFermerPip();
        return;
    }
    if (window.documentPictureInPicture && documentPictureInPicture.requestWindow) {
        documentPictureInPicture.requestWindow({ width: 384, height: 216 }).then(function (win) {
            focusPip = win;
            win.document.open();
            win.document.write(focusPipHtml());
            win.document.close();
            var play = win.document.getElementById('pipPlay');
            if (play) play.onclick = function () { focusBasculer(); };
            win.addEventListener('pagehide', function () {
                focusPip = null;
                focusPeindrePipBouton();
            });
            focusPipMaj();
            focusPeindrePipBouton();
        }).catch(function () { focusOuvrirPipLocal(); });
        return;
    }
    focusOuvrirPipLocal();
}

function focusPleinEcran() {
    var el = document.getElementById('panelPomodoro');
    if (!el) return;
    var actif = document.fullscreenElement || document.webkitFullscreenElement;
    if (actif) {
        focusSortirPleinEcran();
        return;
    }
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
        try { req.call(el); } catch (e) {}
    }
}

function focusSortirPleinEcran() {
    var sortir = document.exitFullscreen || document.webkitExitFullscreen;
    if ((document.fullscreenElement || document.webkitFullscreenElement) && sortir) {
        try { sortir.call(document); } catch (e) {}
    }
}

var FOCUS_SONS = [
    { id: 'pluie', nom: 'Pluie', icone: '☂️', groupe: 'nature', fichier: 'audio/pomodoro/pluie.mp3?v=20261017h' },
    { id: 'ocean', nom: 'Océan', icone: '🌊', groupe: 'nature', fichier: 'audio/pomodoro/ocean.mp3?v=20261017h' },
    { id: 'cafe', nom: 'Café animé', icone: '☕', groupe: 'ville', fichier: 'audio/pomodoro/cafe.mp3?v=20261017h' },
    { id: 'train', nom: 'Train', icone: '🚆', groupe: 'ville', fichier: 'audio/pomodoro/train.mp3?v=20261017k' },
    { id: 'bibliotheque', nom: 'Bibliothèque', icone: '📚', groupe: 'ville', fichier: 'audio/pomodoro/bibliotheque.mp3?v=20261017j' },
    { id: 'matin', nom: 'Matin en ville', icone: '🚕', groupe: 'ville', fichier: 'audio/pomodoro/matin.mp3?v=20261017h' },
    { id: 'orage', nom: 'Orage', icone: '⛈️', groupe: 'nature', fichier: 'audio/pomodoro/orage.mp3?v=20261017j' },
    { id: 'piano', nom: 'Piano', icone: '🎹', groupe: 'ville', fichier: 'audio/pomodoro/piano.mp3?v=20261017h' },
    { id: 'vent', nom: 'Vent', icone: '🌬️', groupe: 'nature', fichier: 'audio/pomodoro/vent.mp3?v=20261017h' },
    { id: 'gamma', nom: 'Binaural gamma', icone: '😵', groupe: 'concentration', fichier: 'audio/pomodoro/gamma.mp3?v=20261017h' },
    { id: 'concentration', nom: 'Concentration', icone: '🧑‍💻', groupe: 'concentration', fichier: 'audio/pomodoro/concentration.mp3?v=20261017k' }
];
var focusLecteurs = {};
var focusVolumes = {};
var focusListeEdition = null;

function focusSonParId(id) {
    var i;
    for (i = 0; i < FOCUS_SONS.length; i++) {
        if (FOCUS_SONS[i].id === id) return FOCUS_SONS[i];
    }
    return null;
}

function focusVolume(id) {
    if (focusVolumes[id] == null) {
        var v = 0.55;
        try {
            var lu = parseFloat(localStorage.getItem('studyPlanIB_focusVol_' + id));
            if (isFinite(lu)) v = lu;
        } catch (e) {}
        focusVolumes[id] = Math.min(1, Math.max(0, v));
    }
    return focusVolumes[id];
}

function focusSauverVolume(id) {
    try { localStorage.setItem('studyPlanIB_focusVol_' + id, String(focusVolumes[id])); } catch (e) {}
}

function focusLireListes() {
    var listes = focusLireJson('studyPlanIB_focusListes', []);
    return Array.isArray(listes) ? listes : [];
}

function focusSauverListes(listes) {
    try { localStorage.setItem('studyPlanIB_focusListes', JSON.stringify(listes.slice(0, 24))); } catch (e) {}
}

function focusSonActif(id) {
    var audio = focusLecteurs[id];
    return !!(audio && !audio.paused);
}

function focusLireSon(id) {
    if (typeof chronoAnnonceEnCours !== 'undefined' && chronoAnnonceEnCours) {
        if (typeof chronoMettreSonEnAttente === 'function') chronoMettreSonEnAttente(id);
        return;
    }
    var son = focusSonParId(id);
    if (!son) return;
    if (!focusLecteurs[id]) {
        var audio = new Audio(son.fichier);
        audio.loop = true;
        audio.preload = 'auto';
        focusLecteurs[id] = audio;
    }
    focusLecteurs[id].volume = focusVolume(id);
    var promesse = focusLecteurs[id].play();
    if (promesse && promesse.catch) promesse.catch(function () {});
}

function focusCouperUnSon(id) {
    var audio = focusLecteurs[id];
    if (!audio) return;
    try { audio.pause(); } catch (e) {}
}

function focusCouperSon() {
    Object.keys(focusLecteurs).forEach(focusCouperUnSon);
    focusBruit = null;
}

function focusArreterSon() {
    focusEtat.son = 'off';
    focusEtat.enPause = false;
    focusCouperSon();
    focusPeindreSonBouton();
    focusPeindreSons();
}

function focusReglerVolume(id, valeur) {
    var v = Math.min(1, Math.max(0, Number(valeur) || 0));
    focusVolumes[id] = v;
    focusSauverVolume(id);
    if (focusLecteurs[id]) focusLecteurs[id].volume = v;
}

function focusPeindreCurseur(input) {
    if (!input) return;
    var v = Number(input.value) || 0;
    input.style.background = 'linear-gradient(90deg, #10b981 ' + v + '%, #e5e7eb ' + v + '%)';
}

function focusBasculerSons() {
    if (typeof focusFermerMusique === 'function') { try { focusFermerMusique(); } catch (e) {} }
    focusFermer('focusTaches');
    focusFermer('focusReglages');
    focusFermer('focusFonds');
    var panneau = document.getElementById('focusSons');
    if (!panneau) return;
    panneau.hidden = !panneau.hidden;
    if (!panneau.hidden) focusPeindreSons();
    focusPeindreSonBouton();
}

function focusFermerSonsSiFond(event) {
    if (event && event.target && event.target.id === 'focusSons') focusFermer('focusSons');
}

function focusFiltrerSons() {
    focusPeindreSons();
}

function focusPeindreSons() {
    var grille = document.getElementById('focusSonsGrille');
    if (!grille || grille.hidden) return;
    var filtre = document.getElementById('focusFiltreSon');
    var groupe = filtre ? filtre.value : 'tous';
    grille.innerHTML = '';
    FOCUS_SONS.forEach(function (son) {
        if (groupe !== 'tous' && son.groupe !== groupe) return;
        var actif = focusSonActif(son.id);
        var boite = document.createElement('div');
        boite.className = 'focus-son-case' + (actif ? ' is-on' : '');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'focus-son' + (actif ? ' is-on' : (focusAmbianceChoisie.includes(son.id) ? ' is-choisi' : ''));
        btn.setAttribute('aria-pressed', String(actif));
        btn.setAttribute('aria-label', son.nom);
        var icone = document.createElement('span');
        icone.className = 'focus-son-icone';
        icone.textContent = son.icone;
        var nom = document.createElement('span');
        nom.className = 'focus-son-nom';
        nom.textContent = son.nom;
        btn.appendChild(icone);
        btn.appendChild(nom);
        btn.onclick = function () { focusChoisirSon(son.id); };
        var volume = document.createElement('input');
        volume.type = 'range';
        volume.className = 'focus-volume';
        volume.min = '0';
        volume.max = '100';
        volume.value = String(Math.round(focusVolume(son.id) * 100));
        volume.setAttribute('aria-label', 'Volume de ' + son.nom);
        focusPeindreCurseur(volume);
        volume.addEventListener('click', function (event) { event.stopPropagation(); });
        volume.addEventListener('input', function (event) {
            event.stopPropagation();
            focusReglerVolume(son.id, Number(volume.value) / 100);
            focusPeindreCurseur(volume);
        });
        boite.appendChild(btn);
        boite.appendChild(volume);
        grille.appendChild(boite);
    });
}

function focusChoisirSon(id) {
    if (focusSonActif(id)) focusCouperUnSon(id);
    else {
        focusEtat.son = id;
        focusEtat.enPause = false;
        focusLireSon(id);
    }
    focusAmbianceChoisie = Object.keys(focusLecteurs).filter(focusSonActif);
    if (typeof chronoAnnonceEnCours !== 'undefined' && chronoAnnonceEnCours && focusAmbianceChoisie.indexOf(id) === -1) focusAmbianceChoisie.push(id);
    try { localStorage.setItem('studyPlanIB_focusAmbiance', JSON.stringify(focusAmbianceChoisie)); } catch (e) {}
    focusPeindreSons();
    focusPeindreSonBouton();
}

function focusPauseSon() {
    var actifs = Object.keys(focusLecteurs).filter(focusSonActif);
    if (actifs.length) {
        focusEtat.enPause = true;
        focusEtat.sonPause = actifs;
        actifs.forEach(focusCouperUnSon);
    } else if (focusEtat.enPause && focusEtat.sonPause) {
        focusEtat.enPause = false;
        focusEtat.sonPause.forEach(focusLireSon);
    }
    focusPeindreSons();
    focusPeindreSonBouton();
}

function focusReinitSon() {
    focusArreterSon();
    focusAmbianceChoisie = [];
    try { localStorage.removeItem('studyPlanIB_focusAmbiance'); } catch (e) {}
    var filtre = document.getElementById('focusFiltreSon');
    if (filtre) filtre.value = 'tous';
    focusPeindreSons();
}

function focusPeindreSonBouton() {
    var bouton = document.getElementById('focusBtnSon');
    var panneau = document.getElementById('focusSons');
    var ouvert = panneau && !panneau.hidden;
    var joue = Object.keys(focusLecteurs).some(focusSonActif);
    if (bouton) {
        bouton.classList.toggle('is-on', ouvert || joue);
        bouton.setAttribute('aria-label', joue ? 'Son en cours' : 'Sons');
    }
}

function focusJouerListe(liste) {
    focusCouperSon();
    (liste.sons || []).forEach(function (id) {
        if (focusSonParId(id)) focusLireSon(id);
    });
    focusAmbianceChoisie = (liste.sons || []).filter(focusSonParId);
    try { localStorage.setItem('studyPlanIB_focusAmbiance', JSON.stringify(focusAmbianceChoisie)); } catch (e) {}
    focusEtat.enPause = false;
    focusPeindreSonBouton();
    focusPeindreListes();
}

function focusPeindreListes() {
    var zone = document.getElementById('focusSonsListes');
    if (!zone) return;
    zone.innerHTML = '';
    var titre = document.createElement('div');
    titre.className = 'focus-listes-haut';
    var creer = document.createElement('button');
    creer.type = 'button';
    creer.className = 'focus-liste-creer';
    creer.textContent = 'Nouvelle playlist';
    creer.onclick = function () {
        focusListeEdition = { id: Date.now(), nom: '', sons: [] };
        focusPeindreListes();
    };
    titre.appendChild(creer);
    zone.appendChild(titre);
    if (focusListeEdition) zone.appendChild(focusFormulaireListe());
    var listes = focusLireListes();
    if (!listes.length && !focusListeEdition) {
        var vide = document.createElement('p');
        vide.className = 'focus-vide';
        vide.textContent = 'Aucune playlist. Crée-en une avec les sons déjà là.';
        zone.appendChild(vide);
    }
    listes.forEach(function (liste) {
        var carte = document.createElement('div');
        carte.className = 'focus-liste-carte';
        var nom = document.createElement('strong');
        nom.textContent = liste.nom || 'Playlist';
        var detail = document.createElement('small');
        detail.textContent = (liste.sons || []).map(function (id) {
            var son = focusSonParId(id);
            return son ? son.nom : id;
        }).join(' · ') || 'Aucun son';
        var actions = document.createElement('div');
        actions.className = 'focus-liste-actions';
        var lire = document.createElement('button');
        lire.type = 'button';
        lire.textContent = 'Lire';
        lire.onclick = function () { focusJouerListe(liste); };
        var retirer = document.createElement('button');
        retirer.type = 'button';
        retirer.textContent = 'Supprimer';
        retirer.onclick = function () {
            focusSauverListes(focusLireListes().filter(function (item) { return item.id !== liste.id; }));
            focusPeindreListes();
        };
        actions.appendChild(lire);
        actions.appendChild(retirer);
        carte.appendChild(nom);
        carte.appendChild(detail);
        carte.appendChild(actions);
        zone.appendChild(carte);
    });
}

function focusFormulaireListe() {
    var form = document.createElement('form');
    form.className = 'focus-liste-form';
    form.onsubmit = function (event) {
        event.preventDefault();
        var nom = (focusListeEdition.nom || '').trim();
        if (!nom || !focusListeEdition.sons.length) return false;
        var listes = focusLireListes().filter(function (item) { return item.id !== focusListeEdition.id; });
        listes.unshift({ id: focusListeEdition.id, nom: nom, sons: focusListeEdition.sons.slice() });
        focusSauverListes(listes);
        focusListeEdition = null;
        focusPeindreListes();
        return false;
    };
    var champ = document.createElement('input');
    champ.maxLength = 40;
    champ.placeholder = 'Nom de la playlist';
    champ.value = focusListeEdition.nom || '';
    champ.oninput = function () { focusListeEdition.nom = champ.value; };
    form.appendChild(champ);
    var choix = document.createElement('div');
    choix.className = 'focus-liste-choix';
    FOCUS_SONS.forEach(function (son) {
        var label = document.createElement('label');
        var box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = focusListeEdition.sons.indexOf(son.id) !== -1;
        box.onchange = function () {
            if (box.checked) {
                if (focusListeEdition.sons.indexOf(son.id) === -1) focusListeEdition.sons.push(son.id);
            } else {
                focusListeEdition.sons = focusListeEdition.sons.filter(function (id) { return id !== son.id; });
            }
        };
        label.appendChild(box);
        label.appendChild(document.createTextNode(' ' + son.icone + ' ' + son.nom));
        choix.appendChild(label);
    });
    form.appendChild(choix);
    var bas = document.createElement('div');
    bas.className = 'focus-liste-actions';
    var sauver = document.createElement('button');
    sauver.type = 'submit';
    sauver.textContent = 'Enregistrer';
    var annuler = document.createElement('button');
    annuler.type = 'button';
    annuler.textContent = 'Annuler';
    annuler.onclick = function () { focusListeEdition = null; focusPeindreListes(); };
    bas.appendChild(sauver);
    bas.appendChild(annuler);
    form.appendChild(bas);
    return form;
}

function focusInitAudio() {
    try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!focusAudio) focusAudio = new AC();
        if (focusAudio.state === 'suspended') focusAudio.resume();
    } catch (e) {}
}

function focusBip(count) {
    try {
        focusInitAudio();
        if (!focusAudio) return;
        var ctx = focusAudio;
        var now = ctx.currentTime;
        var i;
        for (i = 0; i < count; i++) {
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = i % 2 === 0 ? 880 : 660;
            gain.gain.setValueAtTime(0.0001, now + i * 0.28);
            gain.gain.exponentialRampToValueAtTime(0.2, now + i * 0.28 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.28 + 0.22);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.28);
            osc.stop(now + i * 0.28 + 0.24);
        }
    } catch (e) {}
}

function focusDemanderNotif() {
    try {
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    } catch (e) {}
}

function focusNotifier(titre, corps) {
    try {
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
            new Notification(titre, { body: corps });
        }
    } catch (e) {}
}

function focusBrancher() {
    var champ = document.getElementById('focusTache');
    if (champ && !champ.__focus) {
        champ.__focus = true;
        champ.addEventListener('change', focusMemoriserObjectif);
        champ.addEventListener('blur', focusMemoriserObjectif);
    }
    if (!window.__focusMenusTaches) {
        window.__focusMenusTaches = true;
        document.addEventListener('click', function (event) {
            if (focusMenuTache === null) return;
            if (focusSousCible !== null) return;
            var panel = document.getElementById('panelPomodoro');
            if (!panel || !panel.classList.contains('active')) return;
            var cible = event.target;
            if (cible && cible.closest && (cible.closest('.focus-menu') || cible.closest('.focus-tache-menu'))) return;
            focusMenuTache = null;
            focusPeindreTaches();
        });
        document.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape') return;
            if (focusMenuTache === null && focusSousCible === null) return;
            focusMenuTache = null;
            focusSousCible = null;
            focusPeindreTaches();
        });
    }
    if (!window.__focusTouches) {
        window.__focusTouches = true;
        document.addEventListener('keydown', function (event) {
            var panel = document.getElementById('panelPomodoro');
            if (!panel || !panel.classList.contains('active')) return;
            if (event.key !== ' ' && event.code !== 'Space') return;
            var accueil = document.getElementById('focusAccueil');
            if (accueil && !accueil.hidden) return;
            var cible = event.target;
            if (cible && (cible.closest && cible.closest('button, input, textarea, select, a, [contenteditable], [role=button]'))) return;
            event.preventDefault();
            focusBasculer();
        });
    }
}

function focusReprendreApresRafraichissement() {
    if (!window.__memoirePomodoroEnAttente) return;
    window.__memoirePomodoroEnAttente = false;
    /* Une séance planifiée garde sa contrainte après rafraîchissement.
       Le Pomodoro indépendant, lui, n'a pas de séance liée. */
    try {
        var liee = JSON.parse(sessionStorage.getItem('studyPlanIB_focusSeanceEnCours') || 'null');
        if (liee && liee.id) {
            if (liee.date !== new Date().toDateString() ||
                focusMinutesMaintenant() < liee.debut || focusMinutesMaintenant() >= liee.fin) {
                sessionStorage.removeItem('studyPlanIB_focusSeanceEnCours');
                if (typeof memoireAller === 'function') memoireAller('seances');
                else if (typeof navigateTo === 'function') navigateTo('seances');
                return;
            }
            focusSeanceMinuteur = liee;
            focusEntreeDepuisSeance = true;
        }
    } catch (e) {}
    /* Un rafraîchissement sur le minuteur y revient directement : la personne
       n'a pas à retraverser la liste des séances. */
    if (typeof memoireAller === 'function') memoireAller('pomodoro');
    else if (typeof navigateTo === 'function') navigateTo('pomodoro');
}

focusAfficherEntree();
focusReprendreApresRafraichissement();
