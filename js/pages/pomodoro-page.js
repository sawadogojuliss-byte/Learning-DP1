/* ============================================================
   PAGE Pomodoro
   Minuteur plein écran, réservé aux comptes admin.
   Vue : pages/pomodoro.html
   ============================================================ */

var FOCUS_FONDS = [
    { id: 'lumiere', nom: 'Lumière', src: 'images/pomodoro/lumiere.png?v=20261015a' },
    { id: 'kiosque', nom: 'Kiosque', src: 'images/pomodoro/kiosque.png?v=20261015a' },
    { id: 'sommets', nom: 'Sommets', src: 'images/pomodoro/sommets.png?v=20261015a' },
    { id: 'hublot', nom: 'Hublot', src: 'images/pomodoro/hublot.png?v=20261015a' },
    { id: 'dunes', nom: 'Dunes', src: 'images/pomodoro/dunes.png?v=20261015a' },
    { id: 'chalet', nom: 'Chalet', src: 'images/pomodoro/chalet.png?v=20261015a' },
    { id: 'pont', nom: 'Pont', src: 'images/pomodoro/pont.png?v=20261015a' },
    { id: 'riviere', nom: 'Rivière', src: 'images/pomodoro/riviere.png?v=20261015a' },
    { id: 'prairie', nom: 'Prairie', src: 'images/pomodoro/prairie.png?v=20261015a' },
    { id: 'noel', nom: 'Village de Noël', src: 'images/pomodoro/noel.png?v=20261015a' },
    { id: 'cafe', nom: 'Café', src: 'images/pomodoro/cafe.png?v=20261015a' },
    { id: 'nuit', nom: 'Café de nuit', src: 'images/pomodoro/cafe-nuit.png?v=20261015a' },
    { id: 'foret', nom: 'Forêt', src: 'images/pomodoro/foret.png?v=20261015a' },
    { id: 'campagne', nom: 'Campagne', src: 'images/pomodoro/campagne.png?v=20261015a' }
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
var focusTimer = null;
var focusAudio = null;
var focusBruit = null;
var focusTitreOrig = typeof document !== 'undefined' ? document.title : 'Study Plan IB';
var focusPret = false;

function focusEstAdmin() {
    return typeof iaEstAdmin === 'function' && iaEstAdmin();
}

function focusAfficherEntree() {
    var el = document.getElementById('menuPomodoro');
    if (!el) return;
    el.style.display = focusEstAdmin() ? 'flex' : 'none';
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

function focusOuvrir() {
    if (!focusEstAdmin()) {
        var panel = document.getElementById('panelPomodoro');
        if (panel) panel.classList.remove('active');
        return;
    }
    focusCharger();
    focusPoserFond(focusIndexParId('lumiere'), true);
    focusPeindreFlamme();
    focusPeindre();
}

function focusPreparerFonds() {
    var dots = document.getElementById('focusDots');
    var bande = document.getElementById('focusFonds');
    if (dots && !dots.childNodes.length) {
        FOCUS_FONDS.forEach(function (fond, i) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'focus-dot';
            btn.setAttribute('aria-label', fond.nom);
            btn.onclick = function () { focusPoserFond(i); };
            dots.appendChild(btn);
        });
    }
    if (bande && !bande.childNodes.length) {
        FOCUS_FONDS.forEach(function (fond, i) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'focus-vignette';
            btn.setAttribute('aria-label', fond.nom);
            btn.style.backgroundImage = 'url("' + fond.src + '")';
            btn.onclick = function () { focusPoserFond(i); };
            bande.appendChild(btn);
        });
    }
}

function focusPoserFond(index, immediat) {
    if (index < 0 || index >= FOCUS_FONDS.length) return;
    focusEtat.fond = index;
    var bg = document.getElementById('focusBg');
    if (bg) {
        var appliquer = function () {
            bg.style.backgroundImage = 'url("' + FOCUS_FONDS[index].src + '")';
            bg.style.opacity = '1';
        };
        if (immediat) appliquer();
        else {
            bg.style.opacity = '0.25';
            setTimeout(appliquer, 160);
        }
    }
    try { localStorage.setItem('studyPlanIB_focusFond', String(index)); } catch (e) {}
    focusPeindreFonds();
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
    if (!panel || !panel.classList.contains('active') || !focusEstAdmin()) return;
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
}

function focusPeindreFonds() {
    var dots = document.querySelectorAll('#focusDots .focus-dot');
    var vignettes = document.querySelectorAll('#focusFonds .focus-vignette');
    dots.forEach(function (dot, i) { dot.classList.toggle('is-on', i === focusEtat.fond); });
    vignettes.forEach(function (btn, i) { btn.classList.toggle('is-on', i === focusEtat.fond); });
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

function focusCocherTache(id) {
    focusTaches.forEach(function (tache) {
        if (tache && tache.id === id) tache.fait = !tache.fait;
    });
    focusSauverTaches();
    focusPeindreTaches();
}

function focusChoisirTache(id) {
    var trouve = null;
    focusTaches.forEach(function (tache) {
        if (tache && tache.id === id) trouve = tache;
    });
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
    if (!focusTaches.length) {
        var vide = document.createElement('li');
        vide.className = 'focus-vide';
        vide.textContent = 'Aucune tâche pour l’instant.';
        liste.appendChild(vide);
        return;
    }
    focusTaches.forEach(function (tache) {
        var li = document.createElement('li');
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
        li.appendChild(check);
        li.appendChild(nom);
        liste.appendChild(li);
    });
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
    focusFermer('focusTaches');
    focusFermer('focusReglages');
    focusFermer('focusFonds');
    focusFermer('focusSons');
    if (typeof navigateTo === 'function') navigateTo('planning');
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
    { id: 'pluie', nom: 'Pluie', icone: '🌧️', groupe: 'nature', mode: 'bruit', couleur: 'blanc', coupe: 900, gain: 0.04 },
    { id: 'pluie-legere', nom: 'Pluie légère', icone: '☔', groupe: 'nature', mode: 'bruit', couleur: 'blanc', coupe: 1400, gain: 0.022 },
    { id: 'pluie-forte', nom: 'Forte pluie', icone: '🌧️', groupe: 'nature', mode: 'bruit', couleur: 'blanc', coupe: 1600, gain: 0.055 },
    { id: 'ocean', nom: 'Océan', icone: '🌊', groupe: 'nature', mode: 'vague', couleur: 'brun', coupe: 420, gain: 0.05 },
    { id: 'vent', nom: 'Vent', icone: '💨', groupe: 'nature', mode: 'vent', couleur: 'blanc', coupe: 700, gain: 0.035 },
    { id: 'orage', nom: 'Orage', icone: '⛈️', groupe: 'nature', mode: 'orage', couleur: 'blanc', coupe: 1100, gain: 0.045 },
    { id: 'cheminee', nom: 'Cheminée', icone: '🔥', groupe: 'nature', mode: 'crepite', gain: 0.04 },
    { id: 'feu', nom: 'Feu de camp', icone: '🪵', groupe: 'nature', mode: 'crepite', gain: 0.032 },
    { id: 'cafe', nom: 'Café animé', icone: '☕', groupe: 'ville', mode: 'bruit', couleur: 'rose', coupe: 1800, gain: 0.028 },
    { id: 'train', nom: 'Train', icone: '🚆', groupe: 'ville', mode: 'rythme', couleur: 'brun', coupe: 320, gain: 0.04 },
    { id: 'avion', nom: 'Cabine d’avion', icone: '✈️', groupe: 'ville', mode: 'ronron', couleur: 'brun', coupe: 280, gain: 0.04, freq: 90 },
    { id: 'bureau', nom: 'Bureau', icone: '🏢', groupe: 'ville', mode: 'ronron', couleur: 'rose', coupe: 500, gain: 0.02, freq: 120 },
    { id: 'salle', nom: 'Salle calme', icone: '🤫', groupe: 'ville', mode: 'bruit', couleur: 'rose', coupe: 600, gain: 0.012 },
    { id: 'bibliotheque', nom: 'Bibliothèque', icone: '📚', groupe: 'ville', mode: 'bruit', couleur: 'brun', coupe: 350, gain: 0.012 },
    { id: 'matin', nom: 'Matin en ville', icone: '🚕', groupe: 'ville', mode: 'bruit', couleur: 'rose', coupe: 900, gain: 0.02 },
    { id: 'blanc', nom: 'Bruit blanc', icone: '⚪', groupe: 'bruits', mode: 'bruit', couleur: 'blanc', coupe: 8000, gain: 0.02 },
    { id: 'rose', nom: 'Bruit rose', icone: '🩷', groupe: 'bruits', mode: 'bruit', couleur: 'rose', coupe: 4000, gain: 0.025 },
    { id: 'brun', nom: 'Bruit brun', icone: '🟤', groupe: 'bruits', mode: 'bruit', couleur: 'brun', coupe: 800, gain: 0.04 },
    { id: 'beta', nom: 'Binaural bêta', icone: '🧠', groupe: 'concentration', mode: 'binaural', battement: 18, gain: 0.015 },
    { id: 'gamma', nom: 'Binaural gamma', icone: '✨', groupe: 'concentration', mode: 'binaural', battement: 40, gain: 0.012 }
];
var FOCUS_LISTES = [
    { id: 'concentration', nom: 'Concentration', son: 'beta', detail: 'Battement bêta, très bas.' },
    { id: 'nature', nom: 'Nature', son: 'ocean', detail: 'Océan lent.' },
    { id: 'pluie', nom: 'Pluie douce', son: 'pluie-legere', detail: 'Pluie légère.' },
    { id: 'soir', nom: 'Soirée', son: 'cheminee', detail: 'Feu de cheminée.' }
];
var focusFichierAudio = null;
var focusFichierUrl = '';

function focusSonParId(id) {
    var i;
    for (i = 0; i < FOCUS_SONS.length; i++) {
        if (FOCUS_SONS[i].id === id) return FOCUS_SONS[i];
    }
    return null;
}

function focusBasculerSons() {
    focusFermer('focusTaches');
    focusFermer('focusReglages');
    focusFermer('focusFonds');
    var panneau = document.getElementById('focusSons');
    if (!panneau) return;
    panneau.hidden = !panneau.hidden;
    if (!panneau.hidden) {
        focusOngletSon('sons');
        focusPeindreSons();
    }
    focusPeindreSonBouton();
}

function focusFermerSonsSiFond(event) {
    if (event && event.target && event.target.id === 'focusSons') focusFermer('focusSons');
}

function focusOngletSon(nom) {
    var sons = document.getElementById('focusSonsGrille');
    var musique = document.getElementById('focusSonsMusique');
    var listes = document.getElementById('focusSonsListes');
    if (sons) sons.hidden = nom !== 'sons';
    if (musique) musique.hidden = nom !== 'musique';
    if (listes) listes.hidden = nom !== 'listes';
    var onglets = { sons: 'focusOngletSons', musique: 'focusOngletMusique', listes: 'focusOngletListes' };
    Object.keys(onglets).forEach(function (cle) {
        var btn = document.getElementById(onglets[cle]);
        if (btn) btn.classList.toggle('is-on', cle === nom);
    });
    if (nom === 'listes') focusPeindreListes();
    if (nom === 'sons') focusPeindreSons();
}

function focusFiltrerSons() {
    focusOngletSon('sons');
    focusPeindreSons();
}

function focusPeindreSons() {
    var grille = document.getElementById('focusSonsGrille');
    if (!grille) return;
    var filtre = document.getElementById('focusFiltreSon');
    var groupe = filtre ? filtre.value : 'tous';
    grille.innerHTML = '';
    FOCUS_SONS.forEach(function (son) {
        if (groupe !== 'tous' && son.groupe !== groupe) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'focus-son' + (focusEtat.son === son.id ? ' is-on' : '');
        btn.setAttribute('aria-label', son.nom);
        var icone = document.createElement('span');
        icone.className = 'focus-son-icone';
        icone.textContent = son.icone;
        var nom = document.createElement('span');
        nom.textContent = son.nom;
        btn.appendChild(icone);
        btn.appendChild(nom);
        btn.onclick = function () { focusChoisirSon(son.id); };
        grille.appendChild(btn);
    });
}

function focusPeindreListes() {
    var zone = document.getElementById('focusSonsListes');
    if (!zone || zone.childNodes.length) {
        if (zone) {
            zone.querySelectorAll('.focus-liste-btn').forEach(function (btn) {
                btn.classList.toggle('is-on', btn.getAttribute('data-son') === focusEtat.son);
            });
        }
        return;
    }
    FOCUS_LISTES.forEach(function (liste) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'focus-liste-btn';
        btn.setAttribute('data-son', liste.son);
        btn.innerHTML = '<strong>' + liste.nom + '</strong><small>' + liste.detail + '</small>';
        btn.onclick = function () { focusChoisirSon(liste.son); focusPeindreListes(); };
        zone.appendChild(btn);
    });
    focusPeindreListes();
}

function focusChoisirSon(id) {
    if (focusEtat.son === id && focusBruit) {
        focusEtat.enPause = true;
        focusCouperSon();
        focusPeindreSonBouton();
        focusPeindreSons();
        return;
    }
    focusEtat.son = id;
    focusEtat.enPause = false;
    focusDemarrerSon(id);
    focusPeindreSons();
    focusPeindreSonBouton();
}

function focusPauseSon() {
    if (focusEtat.son === 'fichier' && focusFichierAudio) {
        if (focusFichierAudio.paused) focusFichierAudio.play();
        else focusFichierAudio.pause();
        focusPeindreSonBouton();
        return;
    }
    if (focusBruit) {
        focusEtat.enPause = true;
        focusCouperSon();
    } else if (focusEtat.enPause && focusEtat.son && focusEtat.son !== 'off') {
        focusEtat.enPause = false;
        focusDemarrerSon(focusEtat.son);
    }
    focusPeindreSonBouton();
}

function focusReinitSon() {
    focusArreterSon();
    var filtre = document.getElementById('focusFiltreSon');
    if (filtre) filtre.value = 'tous';
    var champ = document.getElementById('focusFichier');
    if (champ) champ.value = '';
    var nom = document.getElementById('focusFichierNom');
    if (nom) nom.textContent = 'Aucun fichier choisi.';
    focusPeindreSons();
}

function focusChoisirFichier(input) {
    var fichier = input && input.files && input.files[0];
    if (!fichier) return;
    focusCouperSon();
    focusEtat.son = 'fichier';
    focusEtat.enPause = false;
    try {
        if (focusFichierUrl) URL.revokeObjectURL(focusFichierUrl);
        focusFichierUrl = URL.createObjectURL(fichier);
        if (!focusFichierAudio) focusFichierAudio = new Audio();
        focusFichierAudio.src = focusFichierUrl;
        focusFichierAudio.loop = true;
        focusFichierAudio.volume = 0.45;
        focusFichierAudio.play();
        focusBruit = { stop: function () { try { focusFichierAudio.pause(); } catch (e) {} } };
    } catch (e) {}
    var nom = document.getElementById('focusFichierNom');
    if (nom) nom.textContent = fichier.name;
    focusPeindreSonBouton();
}

function focusPeindreSonBouton() {
    var bouton = document.getElementById('focusBtnSon');
    var panneau = document.getElementById('focusSons');
    var ouvert = panneau && !panneau.hidden;
    var joue = !!focusBruit || (focusFichierAudio && !focusFichierAudio.paused && focusEtat.son === 'fichier');
    if (bouton) {
        bouton.classList.toggle('is-on', ouvert || joue || (focusEtat.son && focusEtat.son !== 'off'));
        bouton.setAttribute('aria-label', joue ? 'Son en cours' : 'Sons');
    }
}

function focusInitAudio() {
    try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!focusAudio) focusAudio = new AC();
        if (focusAudio.state === 'suspended') focusAudio.resume();
    } catch (e) {}
}

function focusBufferBruit(ctx, couleur) {
    var taille = ctx.sampleRate * 2;
    var buffer = ctx.createBuffer(1, taille, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    var i, blanc, rose = 0, brun = 0;
    for (i = 0; i < taille; i++) {
        blanc = Math.random() * 2 - 1;
        rose = 0.97 * rose + 0.03 * blanc;
        brun = (brun + 0.02 * blanc) / 1.02;
        if (couleur === 'rose') data[i] = rose * 3.2;
        else if (couleur === 'brun') data[i] = brun * 8;
        else data[i] = blanc;
    }
    return buffer;
}

function focusBufferCrepitement(ctx) {
    var taille = ctx.sampleRate * 2;
    var buffer = ctx.createBuffer(1, taille, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    var i, n;
    for (i = 0; i < taille; i++) data[i] = (Math.random() * 2 - 1) * 0.04;
    for (n = 0; n < 90; n++) {
        i = Math.floor(Math.random() * (taille - 40));
        data[i] = (Math.random() * 2 - 1) * 0.8;
        data[i + 1] = data[i] * 0.4;
    }
    return buffer;
}

function focusDemarrerSon(id) {
    var son = focusSonParId(id);
    focusCouperSon();
    if (!son) return;
    focusInitAudio();
    if (!focusAudio) return;
    try {
        var ctx = focusAudio;
        var noeuds = [];
        var master = ctx.createGain();
        master.gain.value = son.gain || 0.03;
        master.connect(ctx.destination);
        if (son.mode !== 'binaural') {
            var source = ctx.createBufferSource();
            source.buffer = son.mode === 'crepite' ? focusBufferCrepitement(ctx) : focusBufferBruit(ctx, son.couleur || 'blanc');
            source.loop = true;
            var filtre = ctx.createBiquadFilter();
            filtre.type = son.mode === 'vent' ? 'bandpass' : 'lowpass';
            filtre.frequency.value = son.coupe || 800;
            if (son.mode === 'vent') filtre.Q.value = 0.7;
            source.connect(filtre);
            filtre.connect(master);
            source.start();
            noeuds.push(source);
        }
        if (son.mode === 'vague' || son.mode === 'vent' || son.mode === 'rythme') {
            var lfo = ctx.createOscillator();
            var profondeur = ctx.createGain();
            lfo.frequency.value = son.mode === 'rythme' ? 1.7 : son.mode === 'vent' ? 0.18 : 0.12;
            profondeur.gain.value = son.mode === 'rythme' ? 0.025 : 0.018;
            lfo.connect(profondeur);
            profondeur.connect(master.gain);
            lfo.start();
            noeuds.push(lfo);
        }
        if (son.mode === 'ronron' || son.mode === 'orage') {
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = son.freq || (son.mode === 'orage' ? 48 : 90);
            gain.gain.value = son.mode === 'orage' ? 0.03 : 0.02;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            noeuds.push(osc);
        }
        if (son.mode === 'binaural') {
            var fusion = ctx.createChannelMerger(2);
            var gauche = ctx.createOscillator();
            var droite = ctx.createOscillator();
            var gG = ctx.createGain();
            var gD = ctx.createGain();
            gauche.frequency.value = 200;
            droite.frequency.value = 200 + (son.battement || 18);
            gG.gain.value = 0.5;
            gD.gain.value = 0.5;
            gauche.connect(gG);
            droite.connect(gD);
            gG.connect(fusion, 0, 0);
            gD.connect(fusion, 0, 1);
            fusion.connect(master);
            gauche.start();
            droite.start();
            noeuds.push(gauche, droite);
        }
        focusBruit = {
            stop: function () {
                noeuds.forEach(function (noeud) {
                    try { noeud.stop(); } catch (e) {}
                });
            }
        };
    } catch (e) {}
}

function focusCouperSon() {
    if (focusBruit) {
        focusBruit.stop();
        focusBruit = null;
    }
    if (focusFichierAudio && focusEtat.son !== 'fichier') {
        try { focusFichierAudio.pause(); } catch (e) {}
    }
}

function focusArreterSon() {
    focusEtat.son = 'off';
    focusEtat.enPause = false;
    if (focusFichierAudio) {
        try { focusFichierAudio.pause(); } catch (e) {}
    }
    focusCouperSon();
    focusPeindreSonBouton();
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
    if (!window.__focusTouches) {
        window.__focusTouches = true;
        document.addEventListener('keydown', function (event) {
            var panel = document.getElementById('panelPomodoro');
            if (!panel || !panel.classList.contains('active')) return;
            if (event.key !== ' ' && event.code !== 'Space') return;
            var cible = event.target;
            if (cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA')) return;
            event.preventDefault();
            focusBasculer();
        });
    }
}

focusAfficherEntree();
