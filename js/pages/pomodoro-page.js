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
    { id: 'campagne', nom: 'Campagne', src: 'images/pomodoro/campagne.png?v=20261015a' },
    { id: 'tente', nom: 'Tente', src: 'images/pomodoro/tente.png?v=20261015g' },
    { id: 'savane', nom: 'Savane', src: 'images/pomodoro/savane.png?v=20261015g' },
    { id: 'recif', nom: 'Récif', src: 'images/pomodoro/recif.png?v=20261015g' },
    { id: 'sentier', nom: 'Sentier', src: 'images/pomodoro/sentier.png?v=20261015g' },
    { id: 'pluie-nuit', nom: 'Pluie de nuit', src: 'images/pomodoro/pluie-nuit.png?v=20261015g' },
    { id: 'lecture', nom: 'Lecture', src: 'images/pomodoro/lecture.png?v=20261015g' },
    { id: 'cabine', nom: 'Cabine', src: 'images/pomodoro/cabine.png?v=20261015g' },
    { id: 'tunnel', nom: 'Tunnel', src: 'images/pomodoro/tunnel.png?v=20261015g' },
    { id: 'stade', nom: 'Stade', src: 'images/pomodoro/stade.png?v=20261015g' }
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
var focusPip = null;
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
            btn.style.backgroundPosition = 'center center';
            btn.style.backgroundSize = 'cover';
            btn.style.backgroundRepeat = 'no-repeat';
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
            bg.style.backgroundPosition = 'center center';
            bg.style.backgroundSize = 'cover';
            bg.style.backgroundRepeat = 'no-repeat';
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
    focusPipMaj();
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
    if (!focusTaches.length) return;
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
    focusFermerPip();
    focusFermer('focusTaches');
    focusFermer('focusReglages');
    focusFermer('focusFonds');
    focusFermer('focusSons');
    if (typeof navigateTo === 'function') navigateTo('planning');
}

function focusFondAbsolu() {
    var fond = FOCUS_FONDS[focusEtat.fond] || FOCUS_FONDS[0];
    var src = fond && fond.src ? fond.src : '';
    try { return new URL(src, location.href).href; } catch (e) { return src; }
}

function focusPipHtml() {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Study Plan IB</title><style>' +
        'html,body{margin:0;height:100%;background:#111;color:#fff;font-family:Inter,system-ui,sans-serif;user-select:none;caret-color:transparent;overflow:hidden;}' +
        '.scene{position:relative;height:100%;background:#064e3b center/cover no-repeat;}' +
        '.hud{position:absolute;right:.95rem;bottom:.55rem;display:flex;flex-direction:column;align-items:flex-end;}' +
        '.time{margin:0 0 .05rem;font-size:clamp(2.8rem,12vw,4.7rem);font-weight:800;letter-spacing:-.045em;line-height:.9;text-shadow:0 2px 16px rgba(0,0,0,.55);}' +
        '.ligne{width:100%;display:flex;align-items:flex-end;justify-content:space-between;gap:1.6rem;}' +
        'button{border:none;background:transparent;color:#fff;cursor:pointer;padding:.1rem .15rem .05rem;filter:drop-shadow(0 1px 3px rgba(0,0,0,.45));}' +
        '.coin{display:flex;flex-direction:column;align-items:flex-end;gap:.28rem;padding-bottom:.15rem;}' +
        '.dots{display:flex;gap:.28rem;}' +
        '.dots i{width:.34rem;height:.34rem;border-radius:50%;background:#fff;display:block;}' +
        '</style></head><body><div class="scene" id="pipScene"><div class="hud">' +
        '<p class="time" id="pipTime">25:00</p><div class="ligne">' +
        '<button type="button" id="pipPlay" aria-label="Démarrer">' +
        '<svg class="pip-ico-play" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5-11-6.5z"/></svg>' +
        '<svg class="pip-ico-pause" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="5" width="4.2" height="14" rx="1"/><rect x="13.8" y="5" width="4.2" height="14" rx="1"/></svg>' +
        '</button><span class="coin"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="#f59e0b" d="M13 2 3.5 13.5h7.2L9.2 22 20.5 9.8h-7.2L13 2z"/></svg>' +
        '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span></span></div></div></div></body></html>';
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
        documentPictureInPicture.requestWindow({ width: 680, height: 384 }).then(function (win) {
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
    { id: 'pluie', nom: 'Pluie', icone: '☂️', groupe: 'nature', fichier: 'audio/pomodoro/pluie.wav' },
    { id: 'ocean', nom: 'Océan', icone: '🌊', groupe: 'nature', fichier: 'audio/pomodoro/ocean.wav' },
    { id: 'cafe', nom: 'Café animé', icone: '☕', groupe: 'ville', fichier: 'audio/pomodoro/cafe.wav' },
    { id: 'avion', nom: 'Cabine d’avion', icone: '✈️', groupe: 'ville', fichier: 'audio/pomodoro/avion.wav' },
    { id: 'salle', nom: 'Salle d’examen', icone: '😰', groupe: 'ville', fichier: 'audio/pomodoro/salle.wav' },
    { id: 'train', nom: 'Train', icone: '🚆', groupe: 'ville', fichier: 'audio/pomodoro/train.wav' },
    { id: 'bibliotheque', nom: 'Bibliothèque', icone: '📚', groupe: 'ville', fichier: 'audio/pomodoro/bibliotheque.wav' },
    { id: 'matin', nom: 'Matin en ville', icone: '🚕', groupe: 'ville', fichier: 'audio/pomodoro/matin.wav' },
    { id: 'pluie-legere', nom: 'Pluie légère', icone: '☔', groupe: 'nature', fichier: 'audio/pomodoro/pluie-legere.wav' },
    { id: 'pluie-forte', nom: 'Forte pluie', icone: '🌧️', groupe: 'nature', fichier: 'audio/pomodoro/pluie-forte.wav' },
    { id: 'orage', nom: 'Orage', icone: '⛈️', groupe: 'nature', fichier: 'audio/pomodoro/orage.wav' },
    { id: 'cheminee', nom: 'Cheminée', icone: '🔥', groupe: 'nature', fichier: 'audio/pomodoro/cheminee.wav' },
    { id: 'feu', nom: 'Feu de camp', icone: '🪵', groupe: 'nature', fichier: 'audio/pomodoro/feu.wav' },
    { id: 'bureau', nom: 'Bureau', icone: '🏢', groupe: 'ville', fichier: 'audio/pomodoro/bureau.wav' },
    { id: 'vent', nom: 'Vent', icone: '🌬️', groupe: 'nature', fichier: 'audio/pomodoro/vent.wav' },
    { id: 'blanc', nom: 'Bruit blanc', icone: '🧠', groupe: 'bruits', fichier: 'audio/pomodoro/blanc.wav' },
    { id: 'rose', nom: 'Bruit rose', icone: '🩷', groupe: 'bruits', fichier: 'audio/pomodoro/rose.wav' },
    { id: 'brun', nom: 'Bruit brun', icone: '🟤', groupe: 'bruits', fichier: 'audio/pomodoro/brun.wav' },
    { id: 'gamma', nom: 'Binaural gamma', icone: '😵', groupe: 'concentration', fichier: 'audio/pomodoro/gamma.wav' },
    { id: 'beta', nom: 'Binaural bêta', icone: '🧑‍💻', groupe: 'concentration', fichier: 'audio/pomodoro/beta.wav' }
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

function focusReprendreApresRafraichissement() {
    if (!window.__memoirePomodoroEnAttente) return;
    window.__memoirePomodoroEnAttente = false;
    if (!focusEstAdmin()) {
        if (typeof memoireAller === 'function') memoireAller('planning');
        return;
    }
    if (typeof memoireAller === 'function') memoireAller('pomodoro');
    else if (typeof navigateTo === 'function') navigateTo('pomodoro');
}

focusAfficherEntree();
focusReprendreApresRafraichissement();
