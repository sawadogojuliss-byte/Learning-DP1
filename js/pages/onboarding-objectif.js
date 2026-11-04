/* ============================================================
   PAGE Objectif IB
   Score visé, badge mondial et message de motivation.
   Vue : pages/onboarding-objectif.html
   ============================================================ */

let targetScore = 40;

function adjustScore(delta) {
    targetScore = Math.max(24, Math.min(45, targetScore + delta));
    updateScoreUI();
}

function handleScoreInput(e) {
    const val = parseInt(e.target.value) || 24;
    targetScore = Math.max(24, Math.min(45, val));
    updateScoreUI();
}

function getScoreFeedback() {
    if (targetScore >= 43) return { badge: 'bg-amber', text: 'Objectif ambitieux ! 🔥', note: 'Top 3% mondial' };
    // 40 à 42 : Top 10% — le badge du haut et le message du bas disent la même chose.
    if (targetScore >= 40) return { badge: 'bg-emerald', text: 'Excellent objectif ! ⭐', note: 'Top 10% mondial' };
    if (targetScore >= 36) return { badge: 'bg-emerald', text: 'Excellent objectif ! ⭐', note: 'Top 15% mondial' };
    if (targetScore >= 30) return { badge: 'bg-blue', text: 'Bon objectif 👍', note: 'Solide performance' };
    if (targetScore >= 24) return { badge: 'bg-gray', text: 'Objectif réaliste 📚', note: 'Diplôme assuré' };
    return { badge: 'bg-red', text: 'Score minimum : 24 points ⚠️', note: '' };
}

function getMotivationMessage() {
    if (targetScore >= 43) return "🚀 Viser 43+ points, c'est viser l'excellence absolue ! Tu te places parmi les 3% des meilleurs élèves IB au monde.";
    if (targetScore >= 40) return "🌟 40+ points te place dans le Top 10% mondial ! C'est le score qui fait briller les yeux des recruteurs universitaires.";
    if (targetScore >= 36) return "✨ 36+ points est un objectif vraiment excellent ! Tu vises un niveau qui te distinguera dans tes candidatures.";
    if (targetScore >= 30) return "💪 30+ points est un objectif solide qui témoigne d'une vraie maîtrise du programme IB !";
    return "📖 L'obtention du diplôme IB est déjà un accomplissement dont tu peux être fier !";
}

function getUniversities() {
    return [];
}

function updateScoreUI() {
    document.getElementById('scoreValue').value = targetScore;
    document.getElementById('welcomeName').textContent = 'Super, ' + userName + ' ! 🎉';
    
    const feedback = getScoreFeedback();
    const feedbackBadge = document.getElementById('feedbackBadge');
    feedbackBadge.textContent = feedback.text;
    feedbackBadge.className = 'feedback-badge ' + feedback.badge;
    document.getElementById('feedbackNote').textContent = feedback.note;
    document.getElementById('motivationText').textContent = getMotivationMessage();

    // Universités désactivées - pas de simulateur
    const uniContainer = document.getElementById('universitiesContainer');
    if (uniContainer) {
        uniContainer.style.display = 'none';
    }
}

function validateObjective() {
    if (targetScore >= 24 && targetScore <= 45) {
        showSubjectsPage();
    }
}
