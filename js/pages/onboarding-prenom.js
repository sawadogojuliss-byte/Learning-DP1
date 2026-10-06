/* ============================================================
   PAGE Prénom
   Saisie du prénom et passage à l'objectif.
   Vue : pages/onboarding-prenom.html
   ============================================================ */

let userName = '';

function prenomErreur(message) {
    var el = document.getElementById('nameError');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
}

function handleContinue() {
    const name = document.getElementById('nameInput').value.trim().replace(/\s+/g, ' ');
    
    if (!name) {
        prenomErreur('Merci d\'entrer ton prénom');
        return;
    }

    document.getElementById('nameError').classList.remove('show');
    userName = name;
    if (window.compteSession && window.compteSession.sub && typeof compteLierNom === 'function') {
        compteLierNom(window.compteSession.sub, name, window.compteSession.email || '');
    }
    classeRetour = '';
    if (window.__profilComplet && typeof memoireAller === 'function') {
        memoireAller('planning');
        return;
    }
    showClassePage();
}

function showObjectivesPage() {
    ['contextModal', 'classeModal', 'subjectsModal', 'sleepModal'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
    document.getElementById('objectivesModal').classList.add('active');
    updateScoreUI();
}

function hideObjectivesPage() {
    document.getElementById('objectivesModal').classList.remove('active');
    if (typeof showClassePage === 'function') showClassePage();
    else document.getElementById('contextModal').classList.add('active');
}

document.getElementById('nameInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        handleContinue();
    }
});
