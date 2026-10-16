/* ============================================================
   PAGE Séance de révision du jour, puis PAGE Pomodoro
   La liste des séances du jour est la page avant le minuteur :
   planning → séance de révision → minuteur. Ouvert à tout le monde.
   Vues : pages/seances.html et pages/pomodoro.html
   ============================================================ */

/* Chaque fond existe en WebP : une version pleine taille pour le décor et une
   petite vignette pour la bande de choix (50 Mo de PNG à l'origine). */
var FOCUS_FONDS = [
    { id: 'lumiere', nom: 'Lumière', src: 'images/pomodoro/lumiere.webp?v=20261015p', mini: 'images/pomodoro/mini/lumiere.webp?v=20261015p' },
    { id: 'kiosque', nom: 'Kiosque', src: 'images/pomodoro/kiosque.webp?v=20261015p', mini: 'images/pomodoro/mini/kiosque.webp?v=20261015p' },
    { id: 'sommets', nom: 'Sommets', src: 'images/pomodoro/sommets.webp?v=20261015p', mini: 'images/pomodoro/mini/sommets.webp?v=20261015p' },
    { id: 'hublot', nom: 'Hublot', src: 'images/pomodoro/hublot.webp?v=20261015p', mini: 'images/pomodoro/mini/hublot.webp?v=20261015p' },
    { id: 'dunes', nom: 'Dunes', src: 'images/pomodoro/dunes.webp?v=20261015p', mini: 'images/pomodoro/mini/dunes.webp?v=20261015p' },
    { id: 'chalet', nom: 'Chalet', src: 'images/pomodoro/chalet.webp?v=20261015p', mini: 'images/pomodoro/mini/chalet.webp?v=20261015p' },
    { id: 'pont', nom: 'Pont', src: 'images/pomodoro/pont.webp?v=20261015p', mini: 'images/pomodoro/mini/pont.webp?v=20261015p' },
    { id: 'riviere', nom: 'Rivière', src: 'images/pomodoro/riviere.webp?v=20261015p', mini: 'images/pomodoro/mini/riviere.webp?v=20261015p' },
    { id: 'prairie', nom: 'Prairie', src: 'images/pomodoro/prairie.webp?v=20261015p', mini: 'images/pomodoro/mini/prairie.webp?v=20261015p' },
    { id: 'noel', nom: 'Village de Noël', src: 'images/pomodoro/noel.webp?v=20261015p', mini: 'images/pomodoro/mini/noel.webp?v=20261015p' },
    { id: 'cafe', nom: 'Café', src: 'images/pomodoro/cafe.webp?v=20261015p', mini: 'images/pomodoro/mini/cafe.webp?v=20261015p' },
    { id: 'nuit', nom: 'Café de nuit', src: 'images/pomodoro/cafe-nuit.webp?v=20261015p', mini: 'images/pomodoro/mini/cafe-nuit.webp?v=20261015p' },
    { id: 'foret', nom: 'Forêt', src: 'images/pomodoro/foret.webp?v=20261015p', mini: 'images/pomodoro/mini/foret.webp?v=20261015p' },
    { id: 'campagne', nom: 'Campagne', src: 'images/pomodoro/campagne.webp?v=20261015p', mini: 'images/pomodoro/mini/campagne.webp?v=20261015p' },
    { id: 'tente', nom: 'Tente', src: 'images/pomodoro/tente.webp?v=20261015p', mini: 'images/pomodoro/mini/tente.webp?v=20261015p' },
    { id: 'savane', nom: 'Savane', src: 'images/pomodoro/savane.webp?v=20261015p', mini: 'images/pomodoro/mini/savane.webp?v=20261015p' },
    { id: 'recif', nom: 'Récif', src: 'images/pomodoro/recif.webp?v=20261015p', mini: 'images/pomodoro/mini/recif.webp?v=20261015p' },
    { id: 'sentier', nom: 'Sentier', src: 'images/pomodoro/sentier.webp?v=20261015p', mini: 'images/pomodoro/mini/sentier.webp?v=20261015p' },
    { id: 'pluie-nuit', nom: 'Pluie de nuit', src: 'images/pomodoro/pluie-nuit.webp?v=20261015p', mini: 'images/pomodoro/mini/pluie-nuit.webp?v=20261015p' },
    { id: 'lecture', nom: 'Lecture', src: 'images/pomodoro/lecture.webp?v=20261015p', mini: 'images/pomodoro/mini/lecture.webp?v=20261015p' },
    { id: 'cabine', nom: 'Cabine', src: 'images/pomodoro/cabine.webp?v=20261015p', mini: 'images/pomodoro/mini/cabine.webp?v=20261015p' },
    { id: 'tunnel', nom: 'Tunnel', src: 'images/pomodoro/tunnel.webp?v=20261015p', mini: 'images/pomodoro/mini/tunnel.webp?v=20261015p' },
    { id: 'stade', nom: 'Stade', src: 'images/pomodoro/stade.webp?v=20261015p', mini: 'images/pomodoro/mini/stade.webp?v=20261015p' }
];
var FOCUS_ASTUCES = {
    focus: 'Range le téléphone. Une seule tâche, jusqu’à la fin du temps.',
    short: 'Lève-toi, bois de l’eau, regarde au loin.',
    long: 'Marche un peu. La pause longue arrive toutes les 4 concentrations.'
};
var focusEtat = {
    mode: 'focus',
    restant: 25 * 60,
    total: 25 * 60,
    running: false,
    fin: 0,
    cycles: 0,
    fond: 0,
    son: 'off',
    astuce: false
};
var focusTaches = [];
var focusMenuTache = null;
var focusSousCible = null;
var focusTimer = null;
var focusAudio = null;
var focusPip = null;
var focusBruit = null;
var focusTitreOrig = typeof document !== 'undefined' ? document.title : 'Study Plan IB';
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

function focusDurees() {
    var sauve = focusLireJson('studyPlanIB_focusDurees', null) || {};
    return {
        focus: focusBorner(sauve.focus, 25, 1, 180),
        short: focusBorner(sauve.short, 5, 1, 60),
        long: focusBorner(sauve.long, 15, 1, 60)
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
    focusEtat.fond = fond;
    var tache = '';
    try { tache = localStorage.getItem('studyPlanIB_focusTache') || ''; } catch (e) {}
    var champ = document.getElementById('focusTache');
    if (champ && tache) champ.value = tache;
    focusTaches = focusLireJson('studyPlanIB_focusTaches', []);
    if (!Array.isArray(focusTaches)) focusTaches = [];
    focusPreparerFonds();
    focusPoserFond(focusEtat.fond, true);
    focusBrancher();
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
    focusCharger();
    focusFondsArret = false;
    focusPoserFond(focusIndexParId('lumiere'), true);
    focusPeindreFlamme();
    focusPeindre();
    focusChoisirSeance();
    focusPeindreAccueil();
    focusAmorcerFonds();
}

/* La page Pomodoro : le minuteur seul. */
function focusOuvrirMinuteur() {
    focusCharger();
    focusFondsArret = false;
    var accueil = document.getElementById('focusAccueil');
    if (accueil) accueil.hidden = true;
    var page = document.getElementById('focusPage');
    if (page) page.hidden = false;
    focusPoserFond(focusIndexParId('lumiere'), true);
    focusPeindreFlamme();
    focusPeindre();
    focusAmorcerFonds();
}

/* Gardé pour les appels existants : ouvre le minuteur. */
function focusOuvrir() {
    focusOuvrirMinuteur();
}

// ── ACCUEIL : les séances de révision et d'exercices du jour ───────────
var focusSeanceChoisie = null;

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

function focusPomodorosTexte(mins) {
    if (typeof v3PomodoroLabel === 'function') {
        try { return v3PomodoroLabel(mins); } catch (e) {}
    }
    var n = Math.max(1, Math.round(Number(mins) / 25));
    return n + ' × 25 min';
}

function focusNombrePomodoros(mins) {
    if (typeof v3PomodoroCount === 'function') {
        try { return v3PomodoroCount(mins); } catch (e) {}
    }
    return Math.max(1, Math.round(Number(mins) / 25));
}

function focusJourIndex() {
    if (typeof selectedDay === 'number' && selectedDay >= 0 && selectedDay <= 6) return selectedDay;
    if (typeof indexJourCourant === 'function') return indexJourCourant();
    return (new Date().getDay() + 6) % 7;
}

// Séances de révision et d'exercices prévues aujourd'hui dans l'emploi du temps.
function focusSeancesJour() {
    var seances = [];
    if (typeof generateDayEvents !== 'function') return seances;
    if (typeof poserJourCourant === 'function') { try { poserJourCourant(); } catch (e) {} }
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

function focusDateTexte() {
    var texte = '';
    try {
        texte = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (e) { texte = ''; }
    if (!texte) return '';
    return texte.charAt(0).toUpperCase() + texte.slice(1);
}

function focusAjouterCarteSeance(seance) {
    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'focus-seance' + (focusSeanceChoisie === seance.id ? ' is-on' : '');
    var etat = focusEtatSeance(seance);
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

    var fond = document.getElementById('focusAccueilFond');
    if (fond) focusFondAccueil((FOCUS_FONDS[focusEtat.fond] || FOCUS_FONDS[0]).src);

    var bonjour = document.getElementById('focusAccueilBonjour');
    if (bonjour) {
        var heure = new Date().getHours();
        var mot = heure < 18 ? 'Bonjour' : 'Bonsoir';
        var nom = (typeof userName !== 'undefined' && userName) ? String(userName) : '';
        var date = focusDateTexte();
        bonjour.textContent = mot + (nom ? ' ' + nom : '') + (date ? ' · ' + date : '');
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
        stats.appendChild(focusAjouterStat(String(pomodoros), 'sessions de 25 min', true));
    }

    liste.innerHTML = '';
    if (!seances.length) {
        var vide = document.createElement('p');
        vide.className = 'focus-accueil-vide';
        vide.textContent = "Aucune séance de révision ou d'exercices n'est prévue aujourd'hui. Tu peux lancer un minuteur libre, ou ajouter une séance dans ton emploi du temps.";
        liste.appendChild(vide);
    } else {
        seances.forEach(function (s) { liste.appendChild(focusAjouterCarteSeance(s)); });
    }

    var note = document.getElementById('focusAccueilNote');
    if (note) {
        var choisie = null;
        seances.forEach(function (s) { if (s.id === focusSeanceChoisie) choisie = s; });
        if (choisie) note.textContent = 'Séance choisie : « ' + choisie.titre + ' » de ' + choisie.debutTexte + ' à ' + choisie.finTexte + '. Elle deviendra ton objectif sur le minuteur.';
        else if (seances.length) note.textContent = 'Choisis une séance, puis appuie sur Continuer. Ta session se prépare sur le minuteur.';
        else note.textContent = 'Le minuteur reste disponible à tout moment.';
    }
}

/* La séance du moment est choisie d'avance : celle qui est en cours, sinon la
   première de la journée. Le choix reste si la personne revient en arrière. */
function focusChoisirSeance() {
    if (focusSeanceChoisie && focusSeancesJour().some(function (s) { return s.id === focusSeanceChoisie; })) return;
    var seances = focusSeancesJour();
    var maintenant = focusMinutesMaintenant();
    var choix = null;
    seances.forEach(function (s) {
        if (choix === null && maintenant >= s.debut && maintenant < s.fin) choix = s.id;
    });
    if (choix === null && seances.length) choix = seances[0].id;
    focusSeanceChoisie = choix;
}

// De la liste au minuteur : une nouvelle étape dans l'historique, donc le
// bouton retour du navigateur ramène d'abord sur la séance de révision.
function focusEntrerPiece(libre) {
    if (!libre && !focusSeanceChoisie) focusChoisirSeance();
    if (!libre && focusSeanceChoisie) {
        var choisie = null;
        focusSeancesJour().forEach(function (s) { if (s.id === focusSeanceChoisie) choisie = s; });
        var champ = document.getElementById('focusTache');
        if (choisie && champ) {
            champ.value = choisie.titre;
            focusMemoriserObjectif();
        }
    }
    focusPeindre();
    /* Le minuteur est une vraie étape : le bouton retour du navigateur
       ramène sur la séance de révision, puis sur le planning. */
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
        if (!fond || focusFondsPrets[fond.src]) {
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
    if (!src || src === focusFondActif) return;
    var bg = document.getElementById('focusBg');
    if (!bg) {
        focusFondActif = src;
        return;
    }
    focusFondDemande = src;
    focusPeindreFonds();
    focusDecoderImage(src, function (ok) {
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
        if (!ok) return;
        focusAccueilActif = src;
        focusPeindreCalque(el, src);
    });
}

function focusPreparerFonds() {
    var bande = document.getElementById('focusFonds');
    if (bande && !bande.childNodes.length) {
        FOCUS_FONDS.forEach(function (fond, i) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'focus-vignette';
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
    focusEtat.fond = index;
    var fond = FOCUS_FONDS[index];
    try { localStorage.setItem('studyPlanIB_focusFond', String(index)); } catch (e) {}
    focusPeindreFonds();
    focusFondPage(fond.src);
    focusFondAccueil(fond.src);
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
}

function focusBasculer() {
    var panel = document.getElementById('panelPomodoro');
    if (!panel || !panel.classList.contains('active')) return;
    focusCharger();
    if (focusEtat.running) {
        focusPause();
        return;
    }
    if (focusEtat.restant <= 0) focusEtat.restant = focusEtat.total;
    focusEtat.running = true;
    focusEtat.fin = Date.now() + focusEtat.restant * 1000;
    focusLancerIntervalle();
    focusDemanderNotif();
    focusInitAudio();
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

function focusPhaseSuivante() {
    var fini = focusEtat.mode;
    if (fini === 'focus') {
        focusEtat.cycles += 1;
        focusChoisirMode(focusEtat.cycles % 4 === 0 ? 'long' : 'short', true);
    } else {
        focusChoisirMode('focus', true);
    }
    focusBip(fini === 'focus' ? 2 : 1);
    focusNotifier(fini === 'focus' ? 'Pause' : 'Focus', fini === 'focus' ? 'Le temps de concentration est fini.' : 'La pause est finie.');
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
        if (btn) btn.classList.toggle('is-on', focusEtat.mode === mode);
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
    var compte = document.getElementById('joursCompte');
    if (compte && compte.textContent) n = parseInt(compte.textContent, 10) || n;
    el.textContent = String(n);
}

function focusBasculerTaches() {
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
}

function focusSauverDurees() {
    var durees = {
        focus: focusBorner(document.getElementById('focusDureeFocus') && document.getElementById('focusDureeFocus').value, 25, 1, 180),
        short: focusBorner(document.getElementById('focusDureeShort') && document.getElementById('focusDureeShort').value, 5, 1, 60),
        long: focusBorner(document.getElementById('focusDureeLong') && document.getElementById('focusDureeLong').value, 15, 1, 60)
    };
    try { localStorage.setItem('studyPlanIB_focusDurees', JSON.stringify(durees)); } catch (e) {}
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
    /* Le bouton maison du minuteur ramène à la séance de révision du jour. */
    if (typeof memoireAller === 'function') memoireAller('seances');
    else if (typeof navigateTo === 'function') navigateTo('seances');
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
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Study Plan IB</title><style>' +
        'html,body{margin:0;height:100%;background:#111;color:#fff;font-family:Inter,system-ui,sans-serif;user-select:none;caret-color:transparent;overflow:hidden;}' +
        '.scene{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#111 center/cover no-repeat;}' +
        '.time{margin:0;font-size:clamp(3.6rem,18vw,6.6rem);font-weight:800;letter-spacing:-.045em;line-height:.9;text-shadow:0 2px 18px rgba(0,0,0,.35);}' +
        'button{margin-top:1.05rem;width:3.35rem;height:3.05rem;border-radius:.8rem;border:1px solid rgba(255,255,255,.18);background:rgba(8,12,20,.55);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;}' +
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
        documentPictureInPicture.requestWindow({ width: 760, height: 430 }).then(function (win) {
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
            win.document.addEventListener('copy', function (event) { event.preventDefault(); });
            win.document.addEventListener('cut', function (event) { event.preventDefault(); });
            win.document.addEventListener('selectstart', function (event) { event.preventDefault(); });
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
    { id: 'pluie', nom: 'Pluie', icone: '☂️', groupe: 'nature', fichier: 'audio/pomodoro/pluie.wav?v=20261015k' },
    { id: 'ocean', nom: 'Océan', icone: '🌊', groupe: 'nature', fichier: 'audio/pomodoro/ocean.wav?v=20261015k' },
    { id: 'cafe', nom: 'Café animé', icone: '☕', groupe: 'ville', fichier: 'audio/pomodoro/cafe.wav?v=20261015k' },
    { id: 'avion', nom: 'Cabine d’avion', icone: '✈️', groupe: 'ville', fichier: 'audio/pomodoro/avion.wav?v=20261015k' },
    { id: 'salle', nom: 'Salle d’examen', icone: '😰', groupe: 'ville', fichier: 'audio/pomodoro/salle.wav?v=20261015k' },
    { id: 'train', nom: 'Train', icone: '🚆', groupe: 'ville', fichier: 'audio/pomodoro/train.wav?v=20261015k' },
    { id: 'bibliotheque', nom: 'Bibliothèque', icone: '📚', groupe: 'ville', fichier: 'audio/pomodoro/bibliotheque.wav?v=20261015k' },
    { id: 'matin', nom: 'Matin en ville', icone: '🚕', groupe: 'ville', fichier: 'audio/pomodoro/matin.wav?v=20261015k' },
    { id: 'pluie-legere', nom: 'Pluie légère', icone: '☔', groupe: 'nature', fichier: 'audio/pomodoro/pluie-legere.wav?v=20261015k' },
    { id: 'pluie-forte', nom: 'Forte pluie', icone: '🌧️', groupe: 'nature', fichier: 'audio/pomodoro/pluie-forte.wav?v=20261015k' },
    { id: 'orage', nom: 'Orage', icone: '⛈️', groupe: 'nature', fichier: 'audio/pomodoro/orage.wav?v=20261015k' },
    { id: 'cheminee', nom: 'Cheminée', icone: '🔥', groupe: 'nature', fichier: 'audio/pomodoro/cheminee.wav?v=20261015k' },
    { id: 'feu', nom: 'Feu de camp', icone: '🪵', groupe: 'nature', fichier: 'audio/pomodoro/feu.wav?v=20261015k' },
    { id: 'bureau', nom: 'Bureau', icone: '🏢', groupe: 'ville', fichier: 'audio/pomodoro/bureau.wav?v=20261015k' },
    { id: 'vent', nom: 'Vent', icone: '🌬️', groupe: 'nature', fichier: 'audio/pomodoro/vent.wav?v=20261015k' },
    { id: 'blanc', nom: 'Bruit blanc', icone: '🧠', groupe: 'bruits', fichier: 'audio/pomodoro/blanc.wav?v=20261015k' },
    { id: 'rose', nom: 'Bruit rose', icone: '🩷', groupe: 'bruits', fichier: 'audio/pomodoro/rose.wav?v=20261015k' },
    { id: 'brun', nom: 'Bruit brun', icone: '🟤', groupe: 'bruits', fichier: 'audio/pomodoro/brun.wav?v=20261015k' },
    { id: 'gamma', nom: 'Binaural gamma', icone: '😵', groupe: 'concentration', fichier: 'audio/pomodoro/gamma.wav?v=20261015k' },
    { id: 'beta', nom: 'Binaural bêta', icone: '🧑‍💻', groupe: 'concentration', fichier: 'audio/pomodoro/beta.wav?v=20261015k' }
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
        btn.className = 'focus-son' + (actif ? ' is-on' : '');
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
    if (!window.__focusCopie) {
        window.__focusCopie = true;
        document.addEventListener('copy', function (event) {
            var panel = document.getElementById('panelPomodoro');
            if (panel && panel.classList.contains('active')) event.preventDefault();
        });
        document.addEventListener('cut', function (event) {
            var panel = document.getElementById('panelPomodoro');
            if (panel && panel.classList.contains('active')) event.preventDefault();
        });
        document.addEventListener('selectstart', function (event) {
            var panel = document.getElementById('panelPomodoro');
            if (panel && panel.classList.contains('active')) event.preventDefault();
        });
        document.addEventListener('contextmenu', function (event) {
            var panel = document.getElementById('panelPomodoro');
            if (panel && panel.classList.contains('active')) event.preventDefault();
        });
        document.addEventListener('keydown', function (event) {
            var panel = document.getElementById('panelPomodoro');
            if (!panel || !panel.classList.contains('active')) return;
            var touche = (event.key || '').toLowerCase();
            if ((event.ctrlKey || event.metaKey) && (touche === 'c' || touche === 'x' || touche === 'a')) event.preventDefault();
        });
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
            if (cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA')) return;
            event.preventDefault();
            focusBasculer();
        });
    }
}

function focusReprendreApresRafraichissement() {
    if (!window.__memoirePomodoroEnAttente) return;
    window.__memoirePomodoroEnAttente = false;
    /* Un rafraîchissement sur le minuteur y revient directement : la personne
       n'a pas à retraverser la liste des séances. */
    if (typeof memoireAller === 'function') memoireAller('pomodoro');
    else if (typeof navigateTo === 'function') navigateTo('pomodoro');
}

focusAfficherEntree();
focusReprendreApresRafraichissement();
