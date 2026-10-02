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
    showObjectivesPage();
}

function showObjectivesPage() {
    document.getElementById('contextModal').classList.remove('active');
    document.getElementById('objectivesModal').classList.add('active');
    updateScoreUI();
}

function hideObjectivesPage() {
    document.getElementById('objectivesModal').classList.remove('active');
    document.getElementById('contextModal').classList.add('active');
}

document.getElementById('nameInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        handleContinue();
    }
});
