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
    var soutien = document.getElementById('panelSoutien');
    var exercices = document.getElementById('panelExercices');
    if (soutien) soutien.classList.remove('active');
    if (exercices) exercices.classList.remove('active');
    if (page === 'soutien' && soutien) {
        initSoutien();
        soutien.classList.add('active');
    } else if (page === 'exercices' && exercices) {
        initExercices();
        exercices.classList.add('active');
    }
    // 'planning' = fermer les autres panneaux
}
