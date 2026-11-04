/* ============================================================
   Navigation
   Menu latéral et passage Planning / Soutien / Exercices.
   Vue : pages/planning.html
   ============================================================ */

// ── NAVIGATION ──────────────────────────────────────────────
function openSideMenu() {
    document.getElementById('sideMenu').style.right = '0';
    document.getElementById('sideMenuOverlay').style.display = 'block';
    if (typeof boiteMajMenu === 'function') boiteMajMenu();
    // Refresh stats in menu
    const allSubj = typeof subjects !== 'undefined' ? [...subjects, ...(optionalSubjects||[])] : [];
    document.getElementById('menuUserGreeting').textContent = '👋 Salut ' + (typeof userName !== 'undefined' ? userName : '') + ' ! Objectif : ' + (typeof targetScore !== 'undefined' ? targetScore : '?') + ' pts IB';
    document.getElementById('menuStatsGrid').innerHTML =
        '<div style="background:white;border-radius:0.75rem;padding:0.625rem;text-align:center;"><div style="font-size:1.25rem;">🎯</div><p style="font-size:1.1rem;font-weight:800;color:#10b981;">' + (typeof targetScore!=='undefined'?targetScore:'?') + '</p><p style="font-size:0.65rem;color:#6b7280;">Objectif</p></div>' +
        '<div style="background:white;border-radius:0.75rem;padding:0.625rem;text-align:center;"><div style="font-size:1.25rem;">📚</div><p style="font-size:1.1rem;font-weight:800;color:#3b82f6;">' + allSubj.length + '</p><p style="font-size:0.65rem;color:#6b7280;">Matières</p></div>' +
        '<div style="background:white;border-radius:0.75rem;padding:0.625rem;text-align:center;"><div style="font-size:1.25rem;">🎯</div><p style="font-size:1.1rem;font-weight:800;color:#a855f7;">' + (typeof selectedActivities!=='undefined'?selectedActivities.length:0) + '</p><p style="font-size:0.65rem;color:#6b7280;">Activités</p></div>' +
        '<div style="background:white;border-radius:0.75rem;padding:0.625rem;text-align:center;"><div style="font-size:1.25rem;">✏️</div><p style="font-size:1.1rem;font-weight:800;color:#059669;">' + exercices.length + '</p><p style="font-size:0.65rem;color:#6b7280;">Exercices</p></div>';
}
function closeSideMenu() {
    document.getElementById('sideMenu').style.right = '-320px';
    document.getElementById('sideMenuOverlay').style.display = 'none';
}
function verrouillerDefilement(actif) {
    if (actif) {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
    } else {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
    }
}

function panneauxOuverts() {
    return document.querySelectorAll('.app-panel.active').length > 0;
}

function navigateTo(page) {
    /* Le minuteur et la page des séances sont ouverts à tout le monde. */
    if (typeof focusFermerMusique === 'function') { try { focusFermerMusique(); } catch (e) {} }
    document.querySelectorAll('.app-panel').forEach(function (el) { el.classList.remove('active'); });
    verrouillerDefilement(false);
    if (page === 'soutien') {
        var soutien = document.getElementById('panelSoutien');
        if (typeof initSoutien === 'function') initSoutien();
        if (soutien) soutien.classList.add('active');
    } else if (page === 'exercices') {
        var exercices = document.getElementById('panelExercices');
        if (typeof initExercices === 'function') initExercices();
        if (exercices) exercices.classList.add('active');
    } else if (page === 'legende') {
        var legende = document.getElementById('panelLegende');
        if (legende) legende.classList.add('active');
    } else if (page === 'devoirs') {
        var devoirs = document.getElementById('panelDevoirs');
        if (typeof initDevoirs === 'function') initDevoirs();
        if (devoirs) devoirs.classList.add('active');
    } else if (page === 'emploi') {
        if (typeof showEmploiPage === 'function') showEmploiPage();
    } else if (page === 'eeia') {
        var eeia = document.getElementById('panelEEia');
        if (typeof renderEEia === 'function') renderEEia();
        if (eeia) eeia.classList.add('active');
    } else if (page === 'feries') {
        var feries = document.getElementById('panelFeries');
        if (typeof renderHolidays === 'function') renderHolidays();
        if (feries) feries.classList.add('active');
    } else if (page === 'seances') {
        var seances = document.getElementById('panelSeances');
        if (typeof focusOuvrirSeances === 'function') focusOuvrirSeances();
        if (seances) seances.classList.add('active');
    } else if (page === 'pomodoro') {
        var pomodoro = document.getElementById('panelPomodoro');
        if (typeof focusOuvrirMinuteur === 'function') focusOuvrirMinuteur();
        if (pomodoro) pomodoro.classList.add('active');
    } else if (page === 'tutoriel') {
        if (typeof tutorielSectionVisible === 'function' && !tutorielSectionVisible()) return;
        var tutoriel = document.getElementById('panelTutoriel');
        if (typeof initTutoriel === 'function') initTutoriel();
        if (tutoriel) tutoriel.classList.add('active');
    } else if (page === 'aide') {
        var aide = document.getElementById('panelAide');
        if (typeof initAide === 'function') initAide();
        if (aide) aide.classList.add('active');
    } else if (page === 'feedback') {
        var feedback = document.getElementById('panelFeedback');
        if (typeof initFeedback === 'function') initFeedback();
        if (feedback) feedback.classList.add('active');
    } else if (page === 'admin') {
        /* Point d'entrée privé : les quatre pages existantes restent inchangées. */
        if (typeof boiteEstAdmin !== 'function' || !boiteEstAdmin()) return;
        var espaceAdmin = document.getElementById('panelAdmin');
        if (espaceAdmin) espaceAdmin.classList.add('active');
    } else if (page === 'annonce') {
        var annonce = document.getElementById('panelAnnonce');
        if (typeof initAnnonce === 'function') initAnnonce();
        if (annonce) annonce.classList.add('active');
    } else if (page === 'retours' || page === 'questions' || page === 'emplois') {
        if (typeof boiteOuvrirAdmin === 'function') boiteOuvrirAdmin(page);
    }
    /* Verrouiller le défilement du fond quand un panneau est ouvert, pour une seule barre. */
    verrouillerDefilement(panneauxOuverts());
}

/* ── Nettoyage au chargement / rechargement ──────────────────
   Quand la page est (re)chargée, aucun panneau .app-panel ne
   doit être actif : seul le planning doit être visible.
   On vide aussi le hash de l'URL quand il pointe vers un
   panneau, pour empêcher le mécanisme memoire.js de le
   réactiver juste après. */

function nettoyerPanneauxEtHash() {
    document.querySelectorAll('.app-panel').forEach(function (el) { el.classList.remove('active'); });
    verrouillerDefilement(false);

    var hash = (location.hash || '').replace(/^#/, '').split('?')[0];
    if (hash && hash !== 'planning' && hash !== 'accueil' && hash !== '') {
        try {
            history.replaceState(history.state || {}, '', location.pathname + location.search);
        } catch (e) {}
    }
}

/* Dès que le DOM est prêt, on nettoie. */
document.addEventListener('DOMContentLoaded', nettoyerPanneauxEtHash);

/* Et une seconde fois quand la page est complètement chargée
   (après que memoire.js ait pu réactiver un panneau via le hash). */
window.addEventListener('load', nettoyerPanneauxEtHash);

/* Et aussi sur pageshow (rechargement depuis le cache navigateur). */
window.addEventListener('pageshow', function (ev) {
    if (!ev.persisted) return;
    nettoyerPanneauxEtHash();
});
