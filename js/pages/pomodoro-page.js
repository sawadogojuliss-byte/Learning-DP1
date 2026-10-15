/* ============================================================
   PAGE Pomodoro
   Minuteur plein écran, réservé aux comptes admin.
   Vue : pages/pomodoro.html
   ============================================================ */

var FOCUS_FONDS = [
    { id: 'noel', nom: 'Village de Noël', src: 'images/pomodoro/noel.png?v=20261013i' },
    { id: 'cafe', nom: 'Café', src: 'images/pomodoro/cafe.png?v=20261013i' },
    { id: 'nuit', nom: 'Café de nuit', src: 'images/pomodoro/cafe-nuit.png?v=20261013i' },
    { id: 'foret', nom: 'Forêt', src: 'images/pomodoro/foret.png?v=20261013i' },
    { id: 'campagne', nom: 'Campagne', src: 'images/pomodoro/campagne.png?v=20261013i' }
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
    fond: 3,
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
    var fond = parseInt(localStorage.getItem('studyPlanIB_focusFond') || '3', 10);
    if (!isFinite(fond) || fond < 0 || fond >= FOCUS_FONDS.length) fond = 3;
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

function focusOuvrir() {
    if (!focusEstAdmin()) {
        var panel = document.getElementById('panelPomodoro');
        if (panel) panel.classList.remove('active');
        return;
    }
    focusCharger();
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
    var panneau = document.getElementById('focusTaches');
    if (!panneau) return;
    panneau.hidden = !panneau.hidden;
    if (!panneau.hidden) focusPeindreTaches();
}

function focusBasculerReglages() {
    focusFermer('focusTaches');
    focusFermer('focusFonds');
    var panneau = document.getElementById('focusReglages');
    if (!panneau) return;
    if (panneau.hidden) focusRemplirDurees();
    panneau.hidden = !panneau.hidden;
}

function focusBasculerFonds() {
    focusFermer('focusTaches');
    focusFermer('focusReglages');
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

function focusEditerTache() {
    var champ = document.getElementById('focusTache');
    if (!champ) return;
    champ.focus();
    champ.select();
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

function focusBasculerSon() {
    var ordre = ['off', 'pluie', 'doux'];
    var i = ordre.indexOf(focusEtat.son);
    focusEtat.son = ordre[(i + 1) % ordre.length];
    focusAppliquerSon();
}

function focusInitAudio() {
    try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!focusAudio) focusAudio = new AC();
        if (focusAudio.state === 'suspended') focusAudio.resume();
    } catch (e) {}
}

function focusAppliquerSon() {
    focusCouperSon();
    var bouton = document.getElementById('focusBtnSon');
    if (bouton) {
        bouton.classList.toggle('is-on', focusEtat.son !== 'off');
        bouton.setAttribute('aria-label', focusEtat.son === 'pluie' ? 'Pluie' : focusEtat.son === 'doux' ? 'Nappe douce' : 'Ambiance');
    }
    if (focusEtat.son === 'off') return;
    focusInitAudio();
    if (!focusAudio) return;
    if (focusEtat.son === 'pluie') focusLancerPluie();
    else focusLancerDoux();
}

function focusLancerPluie() {
    var ctx = focusAudio;
    var taille = ctx.sampleRate * 2;
    var buffer = ctx.createBuffer(1, taille, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    var i;
    for (i = 0; i < taille; i++) data[i] = Math.random() * 2 - 1;
    var source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    var filtre = ctx.createBiquadFilter();
    filtre.type = 'lowpass';
    filtre.frequency.value = 800;
    var gain = ctx.createGain();
    gain.gain.value = 0.045;
    source.connect(filtre);
    filtre.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    focusBruit = { stop: function () { try { source.stop(); } catch (e) {} } };
}

function focusLancerDoux() {
    var ctx = focusAudio;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 174;
    gain.gain.value = 0.018;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    focusBruit = { stop: function () { try { osc.stop(); } catch (e) {} } };
}

function focusCouperSon() {
    if (focusBruit) {
        focusBruit.stop();
        focusBruit = null;
    }
}

function focusArreterSon() {
    focusEtat.son = 'off';
    focusCouperSon();
    var bouton = document.getElementById('focusBtnSon');
    if (bouton) {
        bouton.classList.remove('is-on');
        bouton.setAttribute('aria-label', 'Ambiance');
    }
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
