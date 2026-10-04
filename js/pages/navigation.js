/* ============================================================
   Navigation
   Menu latéral et passage Planning / Soutien / Exercices.
   Vue : pages/planning.html
   ============================================================ */

// ── NAVIGATION ──────────────────────────────────────────────
function openSideMenu() {
    document.getElementById('sideMenu').style.right = '0';
    document.getElementById('sideMenuOverlay').style.display = 'block';
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
function navigateTo(page) {
    document.querySelectorAll('.app-panel').forEach(function (el) { el.classList.remove('active'); });
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
    }
}
