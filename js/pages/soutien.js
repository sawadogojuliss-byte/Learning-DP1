/* ============================================================
   PAGE Soutien & Humeur
   Humeur du jour, encouragements et série de visites.
   Vue : pages/soutien.html
   ============================================================ */

// ── PAGE SOUTIEN ─────────────────────────────────────────────
const moodData = {
    motive: {
        emoji: '🔥', label: 'Super motivé(e) !', color: '#059669',
        bg: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', border: '#6ee7b7',
        msg: 'Cette énergie est précieuse — utilise-la intelligemment aujourd\'hui !',
        tips: [
            'Lance-toi immédiatement sur ta matière la plus difficile',
            'Profite de cette énergie pour avancer ton EE ou ton TOK',
            'Fixe-toi un objectif précis et mesurable pour aujourd\'hui',
            'Note tout ce que tu accomplis — tu mérites de le voir !'
        ],
        quotes: [
            { text: 'Le succès n\'est pas final, l\'échec n\'est pas fatal. C\'est le courage de continuer qui compte.', author: '— Winston Churchill' },
            { text: 'L\'énergie et la persévérance conquièrent toutes choses.', author: '— Benjamin Franklin' }
        ]
    },
    bien: {
        emoji: '😊', label: 'Tu vas bien !', color: '#0891b2',
        bg: 'linear-gradient(135deg,#ecfeff,#cffafe)', border: '#67e8f9',
        msg: 'Belle énergie stable ! C\'est la journée parfaite pour avancer régulièrement.',
        tips: [
            'Commence par une tâche de taille moyenne pour te lancer',
            'Alterne : 50 min de travail → 10 min de pause (méthode Pomodoro)',
            'Hydrate-toi bien pendant tes révisions — le cerveau a besoin d\'eau',
            'Note 3 choses que tu as apprises ce soir avant de dormir'
        ],
        quotes: [
            { text: 'Les grandes choses ne se font pas par impulsion, mais par une série de petites choses rassemblées.', author: '— Vincent Van Gogh' },
            { text: 'Vis comme si tu devais mourir demain. Apprends comme si tu devais vivre toujours.', author: '— Gandhi' }
        ]
    },
    fatigue: {
        emoji: '😴', label: 'Tu es fatigué(e)...', color: '#d97706',
        bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '#fcd34d',
        msg: 'La fatigue est un signal — ton corps te parle. Écoute-le d\'abord.',
        tips: [
            'Fais une sieste de 20 minutes si possible — ça réinitialise le cerveau !',
            'Évite les nouvelles notions complexes aujourd\'hui',
            'Fais plutôt de la révision légère : flashcards, relecture de notes',
            'Va dormir tôt ce soir — garde au moins 5 h de sommeil',
            'Mange quelque chose de léger et bois de l\'eau fraîche'
        ],
        quotes: [
            { text: 'Se reposer est aussi important que travailler. C\'est un investissement, pas une perte de temps.', author: '— Anonyme' },
            { text: 'Prendre soin de soi n\'est pas de l\'égoïsme, c\'est de la sagesse.', author: '— Audre Lorde' }
        ]
    },
    stresse: {
        emoji: '😰', label: 'Tu es stressé(e)...', color: '#dc2626',
        bg: 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: '#fca5a5',
        msg: 'Respire. Le stress prouve que tu tiens à ton avenir. Tu es plus fort(e) que tu ne le crois. 💪',
        tips: [
            '🫁 Fais maintenant : 4s inspiration → 2s pause → 6s expiration (x5)',
            'Écris tes inquiétudes sur papier pour les extérioriser — ça libère le mental',
            'Découpe ton planning en micro-tâches de 25 minutes maximum',
            'Tu n\'es pas seul(e) — parle à un ami, un prof ou un parent ce soir',
            'Rappelle-toi : tu as déjà surmonté des moments difficiles avant'
        ],
        quotes: [
            { text: 'Tu n\'as pas à tout contrôler. Fais ce que tu peux, et fais confiance au processus.', author: '— Anonyme' },
            { text: 'Le succès vient de ceux qui ne lâchent pas, même sous pression.', author: '— Serena Williams' }
        ]
    },
    mauvaisnote: {
        emoji: '📉', label: 'Tu as eu une mauvaise note...', color: '#dc2626',
        bg: 'linear-gradient(135deg,#fef2f2,#fff7ed)', border: '#fca5a5',
        msg: 'Une mauvaise note, c\'est une information — pas une sentence. Elle te montre exactement où travailler.',
        tips: [
            '📋 Analyse ton erreur : comprends POURQUOI, pas juste QUOI',
            'Identifie la notion exacte que tu n\'as pas maîtrisée et refais-la ce soir',
            'Parle à ton professeur — demande un retour détaillé sur ta copie',
            'Rappelle-toi que les examens IB finaux valent plus qu\'une note de contrôle',
            'Une mauvaise note sur une matière = une révision ciblée dans ton planning',
            '💪 Les meilleurs élèves rebondissent. Ce n\'est pas la chute qui compte, c\'est le relèvement'
        ],
        quotes: [
            { text: 'Chaque expert a d\'abord été un débutant. Chaque champion a d\'abord été un perdant.', author: '— Anonyme' },
            { text: 'L\'échec est le fondement de la réussite.', author: '— Lao-Tseu' }
        ]
    },
    perdu: {
        emoji: '😕', label: 'Tu te sens perdu(e)...', color: '#7c3aed',
        bg: 'linear-gradient(135deg,#faf5ff,#ede9fe)', border: '#c4b5fd',
        msg: 'Se sentir perdu est normal — ça veut dire que tu avances dans quelque chose de difficile.',
        tips: [
            'Reprends tes notes de cours depuis le tout début de la notion',
            'Utilise la règle 1-1-1 : 1 matière, 1 notion, 1 heure',
            'Parle à ton professeur — c\'est fait pour ça et ils apprécient les élèves qui demandent',
            'Utilise l\'onglet Exercices pour structurer ce que tu dois faire',
            'Concentre-toi sur UNE seule chose à la fois — pas tout à la fois'
        ],
        quotes: [
            { text: 'On ne se perd que pour mieux se trouver.', author: '— Anonyme' },
            { text: 'Chaque étape vers l\'avant, même la plus petite, est un vrai progrès.', author: '— Anonyme' }
        ]
    },
    anxieux: {
        emoji: '😟', label: 'Tu es anxieux(se)...', color: '#6d28d9',
        bg: 'linear-gradient(135deg,#faf5ff,#f3e8ff)', border: '#d8b4fe',
        msg: 'L\'anxiété vient de l\'incertitude. Structurons ton planning pour reprendre le contrôle.',
        tips: [
            '📅 Ouvre ton planning maintenant et identifie ta prochaine action CONCRÈTE',
            'L\'anxiété diminue quand on agit — une petite tâche accomplie suffit',
            'Fixe-toi un objectif pour les 30 prochaines minutes seulement',
            'Évite de comparer ton rythme à celui des autres — tu as ton propre chemin',
            'Si l\'anxiété dure, parle-en à quelqu\'un de confiance autour de toi'
        ],
        quotes: [
            { text: 'L\'action est le remède à l\'anxiété. Commencez n\'importe où.', author: '— Anonyme' },
            { text: 'Tu ne peux pas contrôler les vagues, mais tu peux apprendre à surfer.', author: '— Jon Kabat-Zinn' }
        ]
    },
    decourage: {
        emoji: '😞', label: 'Tu es découragé(e)...', color: '#6b7280',
        bg: 'linear-gradient(135deg,#f9fafb,#f3f4f6)', border: '#d1d5db',
        msg: 'Le découragement fait partie du parcours IB — chaque étudiant le ressent. Tu n\'es pas seul(e).',
        tips: [
            'Rappelle-toi POURQUOI tu as choisi le programme IB — écris-le',
            'Regarde ce que tu as DÉJÀ accompli — pas ce qui reste',
            'Fais une activité qui te ressource : sport, musique, marche 15 min',
            'Parle de ton ressenti à un ami, un parent ou un professeur de confiance',
            'Fais juste UNE petite chose aujourd\'hui — une seule, ça comptera'
        ],
        quotes: [
            { text: 'Les difficultés préparent les gens ordinaires à un destin extraordinaire.', author: '— C.S. Lewis' },
            { text: 'La persévérance est la clé de toutes les portes.', author: '— Anonyme' }
        ]
    },
    depasse: {
        emoji: '🤯', label: 'Tu te sens dépassé(e)...', color: '#dc2626',
        bg: 'linear-gradient(135deg,#fff7ed,#fef2f2)', border: '#fed7aa',
        msg: 'Tout à la fois, c\'est trop. Souffle — et trions ensemble ce qui est vraiment urgent.',
        tips: [
            '📋 Fais une liste de TOUT ce que tu dois faire — sort everything out of your head',
            'Classe par urgence : rouge (deadline < 2j), orange (< 1 sem), vert (reste)',
            'Commence uniquement par le rouge — ignore le reste pour l\'instant',
            'Délègue ou reporte ce qui n\'est pas urgent — tu as le droit',
            'Utilise l\'onglet Exercices pour planifier intelligemment chaque devoir'
        ],
        quotes: [
            { text: 'La façon de manger un éléphant ? Une bouchée à la fois.', author: '— Desmond Tutu' },
            { text: 'Vous n\'avez pas à tout voir depuis le bas de l\'escalier. Faites juste le premier pas.', author: '— Martin Luther King' }
        ]
    },
    fier: {
        emoji: '🏆', label: 'Tu es fier/fière !', color: '#059669',
        bg: 'linear-gradient(135deg,#fefce8,#fef9c3)', border: '#fde68a',
        msg: 'Excellente nouvelle ! La fierté est le carburant de la persévérance — continue sur cette lancée !',
        tips: [
            'Célèbre ce moment — tu le mérites vraiment !',
            'Profite de cette confiance pour attaquer ta prochaine difficulté',
            'Note ce qui t\'a permis de réussir pour reproduire cette méthode',
            'Partage ta réussite avec quelqu\'un — la joie partagée est décuplée !',
            'Maintenant, vise encore plus haut 🎯'
        ],
        quotes: [
            { text: 'Le succès, c\'est tomber sept fois et se relever huit.', author: '— Proverbe japonais' },
            { text: 'Sois fier de ce que tu as accompli et confiant en ce que tu peux encore réaliser.', author: '— Anonyme' }
        ]
    },
    ennuye: {
        emoji: '😑', label: 'Tu t\'ennuies...', color: '#6b7280',
        bg: 'linear-gradient(135deg,#f9fafb,#ecfdf5)', border: '#d1d5db',
        msg: 'L\'ennui peut être une opportunité déguisée — transforme-le en productivité !',
        tips: [
            'Change de matière ou de méthode de révision — essaie les flashcards',
            'Fais tes révisions debout ou dans un autre endroit pour stimuler le cerveau',
            'Regarde une vidéo éducative sur la notion que tu révises (YouTube IB)',
            'Crée un quiz ou des questions sur ce que tu as appris — teach to learn !',
            'Lance un minuteur de 25 min : juste 25 minutes et tu peux t\'arrêter'
        ],
        quotes: [
            { text: 'L\'ennui est souvent la porte d\'entrée de quelque chose de grand.', author: '— Anonyme' },
            { text: 'La créativité naît souvent de la contrainte et de l\'ennui.', author: '— Anonyme' }
        ]
    },
    neutre: {
        emoji: '😐', label: 'Tu es neutre...', color: '#374151',
        bg: 'linear-gradient(135deg,#f9fafb,#f3f4f6)', border: '#e5e7eb',
        msg: 'Les jours neutres font partie du marathon IB. La régularité compte plus que l\'enthousiasme.',
        tips: [
            'Commence par quelque chose de simple pour créer de l\'élan',
            'Écoute une playlist qui te donne de l\'énergie pendant que tu révises',
            'Rappelle-toi : même 30 min de révision calme = un vrai progrès',
            'Un petit objectif atteint aujourd\'hui = grande satisfaction ce soir'
        ],
        quotes: [
            { text: 'La constance est plus puissante que la perfection.', author: '— Anonyme' },
            { text: 'Ce n\'est pas la force mais la persévérance qui fait les grandes choses.', author: '— Samuel Johnson' }
        ]
    }
};

let currentMood = null;

function initSoutien() {
    const now = new Date();
    const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    document.getElementById('soutienDate').textContent = days[now.getDay()] + ' ' + now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
    const h = now.getHours();
    const greet = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
    document.getElementById('soutienGreet').textContent = greet + ', ' + (typeof userName !== 'undefined' ? userName : 'champion') + ' ! 👋';
    // Reset mood selection
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('encouragementSection').style.display = 'none';
    // Streak
    updateStreak();
}

function updateStreak() {
    let streak = parseInt(localStorage.getItem('studyPlanIB_streak') || '0');
    const lastVisit = localStorage.getItem('studyPlanIB_lastVisit');
    const today = new Date().toDateString();
    if (lastVisit !== today) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        streak = lastVisit === yesterday ? streak + 1 : 1;
        localStorage.setItem('studyPlanIB_streak', streak);
        localStorage.setItem('studyPlanIB_lastVisit', today);
    }
    document.getElementById('streakCount').textContent = streak + ' jour' + (streak > 1 ? 's' : '');
}

function selectMood(mood) {
    if (!mood) { document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected')); document.getElementById('encouragementSection').style.display = 'none'; return; }
    currentMood = mood;
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.toggle('selected', b.dataset.mood === mood));
    const data = moodData[mood];
    // Encouragement card
    document.getElementById('encouragementCard').style.cssText = 'background:' + data.bg + ';border:2px solid ' + data.border + ';border-radius:1.25rem;padding:1.5rem;margin-bottom:1rem;animation:fadeInUp 0.4s ease-out;text-align:center;';
    document.getElementById('encouragementCard').innerHTML =
        '<div style="font-size:2.5rem;margin-bottom:0.75rem;">' + data.emoji + '</div>' +
        '<h3 style="font-size:1.125rem;font-weight:800;color:' + data.color + ';margin-bottom:0.5rem;">' + data.label + '</h3>' +
        '<p style="color:#374151;line-height:1.6;font-size:0.9rem;">' + data.msg + '</p>';
    // Tips
    document.getElementById('moodTipsList').innerHTML = data.tips.map(t =>
        '<div style="display:flex;align-items:flex-start;gap:0.625rem;"><div style="width:1.5rem;height:1.5rem;background:#ecfdf5;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:0.1rem;">✓</div><p style="font-size:0.875rem;color:#374151;line-height:1.5;">' + t + '</p></div>'
    ).join('');
    // Quote
    const q = data.quotes[Math.floor(Math.random() * data.quotes.length)];
    document.getElementById('quoteText').textContent = '" ' + q.text + ' "';
    document.getElementById('quoteAuthor').textContent = q.author;
    document.getElementById('encouragementSection').style.display = 'block';
    document.getElementById('encouragementSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
