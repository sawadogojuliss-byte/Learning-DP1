/* ============================================================
   PAGE Prénom
   Saisie du prénom et passage à l'objectif.
   Vue : pages/onboarding-prenom.html
   ============================================================ */

let userName = '';

function handleContinue() {
    const name = document.getElementById('nameInput').value.trim();
    
    if (!name) {
        document.getElementById('nameError').classList.add('show');
        return;
    }

    document.getElementById('nameError').classList.remove('show');
    userName = name;
    classeRetour = '';
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
