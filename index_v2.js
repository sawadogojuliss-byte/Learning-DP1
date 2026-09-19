
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
        document.getElementById('panelSoutien').classList.remove('active');
        document.getElementById('panelExercices').classList.remove('active');
        if (page === 'soutien') {
            initSoutien();
            document.getElementById('panelSoutien').classList.add('active');
        } else if (page === 'exercices') {
            initExercices();
            document.getElementById('panelExercices').classList.add('active');
        }
        // 'planning' = just close panels
    }

    // ── EDIT MODAL WITH CASCADE ─────────────────────────────────
    let editCurrentDuration = 60;

    function openEditModal(id, title, startTime, endTime, type) {
        editingEvent = { id, title, startTime, endTime, type };
        document.getElementById('editEventTitle').value = title;
        document.getElementById('editEventStart').value = startTime;
        document.getElementById('editEventEnd').value = endTime;
        editCurrentDuration = timeToMinutes(endTime) - timeToMinutes(startTime);
        if (editCurrentDuration <= 0) editCurrentDuration = 30;
        updateEditDurationDisplay();
        document.getElementById('editTimeError').style.display = 'none';
        document.getElementById('editEventModal').style.display = 'flex';
    }
    function closeEditModal() {
        document.getElementById('editEventModal').style.display = 'none';
        editingEvent = null;
    }
    function adjustEditDuration(delta) {
        editCurrentDuration = Math.max(15, Math.min(300, editCurrentDuration + delta));
        updateEditDurationDisplay();
        // Sync end time from start
        const start = document.getElementById('editEventStart').value;
        if (start) {
            document.getElementById('editEventEnd').value = addMinutes(start, editCurrentDuration);
        }
    }
    function syncEditEndFromStart() {
        const start = document.getElementById('editEventStart').value;
        if (start) document.getElementById('editEventEnd').value = addMinutes(start, editCurrentDuration);
    }
    function syncEditDurationFromTimes() {
        const s = document.getElementById('editEventStart').value;
        const e = document.getElementById('editEventEnd').value;
        if (s && e) {
            const d = timeToMinutes(e) - timeToMinutes(s);
            if (d > 0) { editCurrentDuration = d; updateEditDurationDisplay(); }
        }
    }
    function updateEditDurationDisplay() {
        const h = Math.floor(editCurrentDuration / 60);
        const m = editCurrentDuration % 60;
        let label = '';
        if (h > 0) label += h + 'h';
        if (m > 0) label += (h > 0 ? '' : '') + m + 'min';
        document.getElementById('editDurationDisplay').textContent = label || '0min';
    }

    function saveEditedEventCascade() {
        if (!editingEvent) return;
        const newTitle = document.getElementById('editEventTitle').value.trim() || editingEvent.title;
        const newStart = document.getElementById('editEventStart').value;
        const newEnd = document.getElementById('editEventEnd').value;
        const errEl = document.getElementById('editTimeError');

        if (!newStart || !newEnd) { errEl.textContent = 'Remplis les horaires.'; errEl.style.display = 'block'; return; }
        const newDur = timeToMinutes(newEnd) - timeToMinutes(newStart);
        if (newDur <= 0) { errEl.textContent = "L'heure de fin doit être après le début."; errEl.style.display = 'block'; return; }
        errEl.style.display = 'none';

        // Compute delta (shift in minutes caused by duration change)
        const oldDur = timeToMinutes(editingEvent.endTime) - timeToMinutes(editingEvent.startTime);
        const delta = newDur - oldDur; // positive = event got longer → push everything after

        // 1. Update or create the custom event record
        const idx = customEvents.findIndex(e => e.id === editingEvent.id);
        if (idx !== -1) {
            customEvents[idx] = { ...customEvents[idx], title: newTitle, startTime: newStart, endTime: newEnd };
        } else {
            customEvents.push({
                id: generateEventId(editingEvent.type, newTitle, selectedDay),
                day: selectedDay,
                title: newTitle,
                startTime: newStart,
                endTime: newEnd,
                type: editingEvent.type,
                icon: editingEvent.icon || '📌',
                source: 'custom',
                replacesId: editingEvent.id,
                timestamp: Date.now()
            });
        }

        // 2. CASCADE: shift all other custom events on this day that start AFTER this event's OLD start
        if (delta !== 0) {
            const editStartMins = timeToMinutes(newStart);
            const FIXED = new Set(['school1','school2','eco','sleep','wakeup','lunch']);
            customEvents = customEvents.map(ev => {
                if (ev.day !== selectedDay) return ev;
                if (FIXED.has(ev.id)) return ev;
                if (ev.id === editingEvent.id) return ev; // already updated
                const evStart = timeToMinutes(ev.startTime);
                // Only cascade events that come AFTER the modified event
                if (evStart > editStartMins) {
                    const evDur = timeToMinutes(ev.endTime) - evStart;
                    const newEvStart = evStart + delta;
                    return { ...ev, startTime: addMinutes('00:00', newEvStart), endTime: addMinutes('00:00', newEvStart + evDur) };
                }
                return ev;
            });
        }

        localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(customEvents));
        closeEditModal();
        renderPlanning();

        // Show cascade toast if events were shifted
        if (delta !== 0) {
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:linear-gradient(to right,#059669,#10b981);color:white;padding:0.75rem 1.25rem;border-radius:0.875rem;font-weight:700;font-size:0.82rem;z-index:200;box-shadow:0 8px 20px rgba(16,185,129,0.35);animation:fadeInUp 0.3s;max-width:90%;text-align:center;';
            toast.textContent = '🔗 Planning synchronisé — ' + (delta > 0 ? '+' : '') + delta + ' min sur les activités suivantes';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    }

    function saveEditedEvent() { saveEditedEventCascade(); }

    function deleteEditedEvent() {
        if (!editingEvent) return;
        customEvents = customEvents.filter(e => e.id !== editingEvent.id);
        localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(customEvents));
        closeEditModal();
        renderPlanning();
    }

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
                'Va dormir tôt ce soir — les 8h de sommeil, c\'est non négociable',
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

    // ── PAGE EXERCICES ───────────────────────────────────────────
    let exercices = [];
    let selectedExoSubject = null;
    let exoDuration = 60;
    let planifyTarget = null;

    function initExercices() {
        buildExoSubjectGrid();
        renderExoList();
        renderPlanifier();
        // Set min date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('exoDeadline').min = today;
        document.getElementById('exoDeadline').value = '';
        switchExoTab('ajouter');
        document.getElementById('exoCountBadge').textContent = exercices.length + ' exercice' + (exercices.length > 1 ? 's' : '');
    }

    function buildExoSubjectGrid() {
        const allSubj = typeof subjects !== 'undefined' ? [...subjects, ...(optionalSubjects||[])] : [];
        const grid = document.getElementById('exoSubjectGrid');
        if (!grid) return;
        grid.innerHTML = allSubj.map((s, i) =>
            '<button onclick="selectExoSubject(' + i + ')" data-exo-idx="' + i + '" style="display:flex;align-items:center;gap:0.375rem;padding:0.5rem 0.875rem;border-radius:9999px;border:2px solid #e5e7eb;background:white;cursor:pointer;font-size:0.8rem;font-weight:600;color:#374151;transition:all 0.2s;">' +
            '<span>' + s.icon + '</span><span>' + s.name + '</span>' +
            '</button>'
        ).join('');
    }

    function selectExoSubject(idx) {
        const allSubj = typeof subjects !== 'undefined' ? [...subjects, ...(optionalSubjects||[])] : [];
        selectedExoSubject = allSubj[idx];
        document.querySelectorAll('[data-exo-idx]').forEach((btn, i) => {
            if (i === idx) { btn.style.background = '#ecfdf5'; btn.style.borderColor = '#10b981'; btn.style.color = '#059669'; }
            else { btn.style.background = 'white'; btn.style.borderColor = '#e5e7eb'; btn.style.color = '#374151'; }
        });
    }

    function setExoDuration(dur) {
        exoDuration = dur;
        document.getElementById('exoDurationSlider').value = dur;
        document.getElementById('exoDurationLabel').textContent = dur >= 60 ? Math.floor(dur/60)+'h'+(dur%60?dur%60+'min':'') : dur+'min';
        document.querySelectorAll('.dur-btn').forEach(btn => {
            const isSel = btn.textContent.trim() === (dur===30?'30 min':dur===45?'45 min':dur===60?'1h':'1h30');
            btn.style.borderColor = isSel ? '#10b981' : '#e5e7eb';
            btn.style.background = isSel ? '#ecfdf5' : 'white';
            btn.style.color = isSel ? '#059669' : '#374151';
        });
    }

    function updateExoDurationFromSlider(val) {
        exoDuration = parseInt(val);
        const dur = exoDuration;
        document.getElementById('exoDurationLabel').textContent = dur >= 60 ? Math.floor(dur/60)+'h'+(dur%60?dur%60+'min':'') : dur+'min';
        document.querySelectorAll('.dur-btn').forEach(btn => {
            const isSel = (dur===30&&btn.textContent.trim()==='30 min')||(dur===45&&btn.textContent.trim()==='45 min')||(dur===60&&btn.textContent.trim()==='1h')||(dur===90&&btn.textContent.trim()==='1h30');
            btn.style.borderColor = isSel ? '#10b981' : '#e5e7eb';
            btn.style.background = isSel ? '#ecfdf5' : 'white';
            btn.style.color = isSel ? '#059669' : '#374151';
        });
    }

    // Drag & Drop
    function handleDragOver(e) { e.preventDefault(); document.getElementById('dragArea').classList.add('dragging'); }
    function handleDragLeave(e) { document.getElementById('dragArea').classList.remove('dragging'); }
    function handleFileDrop(e) {
        e.preventDefault();
        document.getElementById('dragArea').classList.remove('dragging');
        const file = e.dataTransfer.files[0];
        if (file) showUploadedFile(file);
    }
    function handleFileSelect(e) { if (e.target.files[0]) showUploadedFile(e.target.files[0]); }
    function showUploadedFile(file) {
        const el = document.getElementById('uploadedFileName');
        el.style.display = 'flex';
        el.innerHTML = '📎 <strong>' + file.name + '</strong> (' + (file.size/1024).toFixed(0) + ' Ko) <button onclick="clearUpload()" style="margin-left:auto;background:none;border:none;cursor:pointer;color:#dc2626;">✕</button>';
        el.setAttribute('data-filename', file.name);
    }
    function clearUpload() {
        document.getElementById('uploadedFileName').style.display = 'none';
        document.getElementById('fileUploadInput').value = '';
    }

    function addExercice() {
        const text = document.getElementById('exoTextInput').value.trim();
        const fileEl = document.getElementById('uploadedFileName');
        const filename = fileEl.getAttribute('data-filename') || null;
        const deadline = document.getElementById('exoDeadline').value;

        if (!selectedExoSubject) { alert('⚠️ Choisis une matière d\'abord !'); return; }
        if (!text && !filename) { alert('⚠️ Décris ton exercice ou upload un fichier.'); return; }
        if (!deadline) { alert('⚠️ Choisis une date limite.'); return; }

        const exo = {
            id: 'exo-' + Date.now(),
            subject: selectedExoSubject.name,
            subjectIcon: selectedExoSubject.icon,
            subjectGrade: selectedExoSubject.grade,
            text: text || filename,
            filename: filename,
            duration: exoDuration,
            deadline: deadline,
            done: false,
            addedAt: new Date().toISOString(),
            scheduledSlot: null
        };
        exercices.push(exo);
        localStorage.setItem('studyPlanIB_exercices', JSON.stringify(exercices));

        // Reset form
        document.getElementById('exoTextInput').value = '';
        clearUpload();
        document.getElementById('exoDeadline').value = '';
        selectedExoSubject = null;
        document.querySelectorAll('[data-exo-idx]').forEach(b => { b.style.background='white';b.style.borderColor='#e5e7eb';b.style.color='#374151'; });
        exoDuration = 60; setExoDuration(60);

        document.getElementById('exoCountBadge').textContent = exercices.length + ' exercice' + (exercices.length > 1 ? 's' : '');

        // Show success
        showExoSuccess();
        switchExoTab('liste');
    }

    function showExoSuccess() {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:linear-gradient(to right,#10b981,#059669);color:white;padding:0.875rem 1.5rem;border-radius:0.875rem;font-weight:700;font-size:0.9rem;z-index:200;box-shadow:0 8px 20px rgba(16,185,129,0.4);animation:fadeInUp 0.3s ease-out;';
        toast.textContent = '✅ Exercice ajouté avec succès !';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    function renderExoList() {
        const container = document.getElementById('exoListContainer');
        if (!container) return;
        const saved = localStorage.getItem('studyPlanIB_exercices');
        if (saved) try { exercices = JSON.parse(saved); } catch(e) {}

        if (exercices.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:3rem 1rem;color:#9ca3af;"><div style="font-size:3rem;margin-bottom:1rem;">📝</div><p style="font-weight:600;">Aucun exercice pour l\'instant</p><p style="font-size:0.85rem;margin-top:0.5rem;">Ajoute ton premier exercice dans l\'onglet ➕</p></div>';
            return;
        }

        // Trier par deadline
        const sorted = [...exercices].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
        const today = new Date(); today.setHours(0,0,0,0);

        container.innerHTML = sorted.map(exo => {
            const dl = new Date(exo.deadline);
            const diffDays = Math.ceil((dl - today) / 86400000);
            const urgency = diffDays <= 1 ? '#dc2626' : diffDays <= 3 ? '#d97706' : '#059669';
            const urgencyBg = diffDays <= 1 ? '#fef2f2' : diffDays <= 3 ? '#fffbeb' : '#ecfdf5';
            const urgencyLabel = diffDays <= 0 ? '⚠️ Aujourd\'hui !' : diffDays === 1 ? '⏰ Demain' : 'Dans ' + diffDays + 'j';
            const dur = exo.duration >= 60 ? Math.floor(exo.duration/60)+'h'+(exo.duration%60?exo.duration%60+'min':'') : exo.duration+'min';

            return '<div class="exo-card" style="margin-bottom:0.875rem;">' +
                '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:0.75rem;">' +
                '<div style="display:flex;align-items:center;gap:0.625rem;">' +
                '<span style="font-size:1.5rem;">' + exo.subjectIcon + '</span>' +
                '<div><p style="font-weight:700;color:#111827;font-size:0.9rem;">' + exo.subject + '</p>' +
                '<p style="font-size:0.75rem;color:#6b7280;">' + (exo.filename ? '📎 ' + exo.filename : exo.text.substring(0,50) + (exo.text.length>50?'...':'')) + '</p></div></div>' +
                '<button onclick="deleteExo(\'' + exo.id + '\')" style="background:#fef2f2;border:none;border-radius:0.5rem;width:1.75rem;height:1.75rem;cursor:pointer;color:#dc2626;font-size:0.75rem;">✕</button>' +
                '</div>' +
                '<div style="display:flex;align-items:center;justify-content:space-between;">' +
                '<div style="display:flex;align-items:center;gap:0.5rem;">' +
                '<span style="background:#f3f4f6;border-radius:9999px;padding:0.25rem 0.625rem;font-size:0.75rem;font-weight:600;color:#374151;">⏱️ ' + dur + '</span>' +
                '<span style="background:' + urgencyBg + ';color:' + urgency + ';border-radius:9999px;padding:0.25rem 0.625rem;font-size:0.75rem;font-weight:700;">' + urgencyLabel + '</span>' +
                (exo.scheduledSlot ? '<span style="background:#ecfdf5;color:#059669;border-radius:9999px;padding:0.25rem 0.625rem;font-size:0.75rem;font-weight:600;">✓ Planifié</span>' : '') +
                '</div>' +
                '<button onclick="openPlanifier(\'' + exo.id + '\')" style="background:linear-gradient(to right,#10b981,#059669);color:white;border:none;border-radius:0.625rem;padding:0.375rem 0.75rem;font-size:0.75rem;font-weight:700;cursor:pointer;">' +
                (exo.scheduledSlot ? '📅 Replanifier' : '+ Planifier') +
                '</button></div></div>';
        }).join('');
    }

    function deleteExo(id) {
        exercices = exercices.filter(e => e.id !== id);
        localStorage.setItem('studyPlanIB_exercices', JSON.stringify(exercices));
        document.getElementById('exoCountBadge').textContent = exercices.length + ' exercice' + (exercices.length > 1 ? 's' : '');
        renderExoList();
        renderPlanifier();
    }

    function renderPlanifier() {
        const container = document.getElementById('planifierContent');
        if (!container) return;
        const unplanned = exercices.filter(e => !e.scheduledSlot);
        if (exercices.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:3rem 1rem;color:#9ca3af;"><div style="font-size:3rem;margin-bottom:1rem;">📅</div><p style="font-weight:600;">Ajoute d\'abord des exercices</p><p style="font-size:0.85rem;margin-top:0.5rem;">Va dans l\'onglet ➕ pour commencer</p></div>';
            return;
        }

        // Global time estimate
        const totalMins = exercices.filter(e => !e.done).reduce((s, e) => s + e.duration, 0);
        const totalH = Math.floor(totalMins / 60), totalM = totalMins % 60;
        const totalLabel = totalH > 0 ? totalH + 'h' + (totalM > 0 ? totalM + 'min' : '') : totalM + 'min';

        let html = '<div style="background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border:1.5px solid #a7f3d0;border-radius:1rem;padding:1.25rem;margin-bottom:1.25rem;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">' +
            '<h4 style="font-weight:700;color:#064e3b;font-size:0.9rem;">📊 Résumé global</h4>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' +
            '<div style="background:white;border-radius:0.75rem;padding:0.75rem;text-align:center;"><p style="font-size:1.25rem;font-weight:800;color:#059669;">' + totalLabel + '</p><p style="font-size:0.7rem;color:#6b7280;">temps minimum total</p></div>' +
            '<div style="background:white;border-radius:0.75rem;padding:0.75rem;text-align:center;"><p style="font-size:1.25rem;font-weight:800;color:#3b82f6;">' + exercices.filter(e=>!e.done).length + '</p><p style="font-size:0.7rem;color:#6b7280;">exercice(s) restant(s)</p></div>' +
            '</div></div>';

        // Individual planifier
        const today = new Date(); today.setHours(0,0,0,0);
        exercices.filter(e => !e.done).sort((a,b) => new Date(a.deadline)-new Date(b.deadline)).forEach(exo => {
            const dl = new Date(exo.deadline);
            const diffDays = Math.ceil((dl - today) / 86400000);
            const urgency = diffDays <= 1 ? '#dc2626' : diffDays <= 3 ? '#d97706' : '#059669';
            const dur = exo.duration >= 60 ? Math.floor(exo.duration/60)+'h'+(exo.duration%60?exo.duration%60+'min':'') : exo.duration+'min';
            const slots = findAvailableSlots(exo);

            html += '<div style="background:white;border:1.5px solid #e5e7eb;border-radius:1rem;padding:1.25rem;margin-bottom:1rem;">' +
                '<div style="display:flex;align-items:center;gap:0.625rem;margin-bottom:1rem;">' +
                '<span style="font-size:1.25rem;">' + exo.subjectIcon + '</span>' +
                '<div><p style="font-weight:700;color:#111827;font-size:0.875rem;">' + exo.subject + ' · ' + (exo.filename || exo.text.substring(0,30)) + '</p>' +
                '<p style="font-size:0.75rem;color:' + urgency + ';font-weight:600;">⏱️ ' + dur + ' · Deadline : ' + dl.toLocaleDateString('fr-FR', {day:'numeric',month:'long'}) + '</p></div></div>' +
                '<p style="font-size:0.8rem;font-weight:600;color:#374151;margin-bottom:0.625rem;">Créneaux disponibles :</p>';

            if (slots.length === 0) {
                html += '<div style="background:#fef2f2;border-radius:0.75rem;padding:0.875rem;font-size:0.8rem;color:#dc2626;text-align:center;">⚠️ Aucune plage libre trouvée dans les 2 prochaines semaines. Essaie de modifier ton planning existant.</div>';
            } else {
                // Show split info if needed
                const needsSplit = slots.some(s => s.isSplit);
                if (needsSplit) {
                    html += '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:0.75rem;padding:0.625rem 0.875rem;margin-bottom:0.625rem;font-size:0.78rem;color:#92400e;">✂️ <strong>Découpage automatique :</strong> l\'exercice sera réparti sur plusieurs créneaux libres.</div>';
                }
                html += '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">' +
                    slots.map((slot, si) =>
                        '<button onclick="scheduleExo(\'' + exo.id + '\',' + si + ')" class="slot-chip' + (slot.isSplit ? ' split' : '') + '" style="' + (slot.isSplit ? 'border-color:#fcd34d;background:#fffbeb;color:#92400e;' : '') + '">' +
                        (slot.isSplit ? '✂️ ' : '✅ ') + slot.label +
                        '</button>'
                    ).join('') + '</div>';
            }
            if (exo.scheduledSlot) {
                html += '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:0.75rem;padding:0.625rem 0.875rem;margin-top:0.75rem;font-size:0.8rem;color:#059669;font-weight:600;">✓ Planifié : ' + exo.scheduledSlot + '</div>';
            }
            html += '</div>';
        });

        container.innerHTML = html;
    }

    // ── MOTEUR DE PLANIFICATION EXERCICES ───────────────────────
    // Analyse le vrai planning du jour pour trouver les plages libres
    // Si l'exercice est trop long, il est découpé automatiquement en parties

    function getRealFreeSlots(planDay, minDuration) {
        // Generate the real events for that day and find gaps
        const events = generateDayEvents(planDay);
        const BLOCKED = new Set(['sleep','wakeup']);
        const freeSlots = [];

        // Build occupied intervals (all non-sleep/non-wakeup events)
        const occupied = events
            .filter(e => !BLOCKED.has(e.id))
            .map(e => ({ s: timeToMinutes(e.startTime), e: timeToMinutes(e.endTime) }))
            .sort((a, b) => a.s - b.s);

        // Find gaps between events
        let scanFrom = timeToMinutes('06:00');
        const scanUntil = timeToMinutes('22:30');

        for (const occ of occupied) {
            if (occ.s > scanFrom) {
                const gapStart = scanFrom;
                const gapEnd = Math.min(occ.s, scanUntil);
                const gapDur = gapEnd - gapStart;
                if (gapDur >= minDuration) {
                    freeSlots.push({
                        startMins: gapStart,
                        endMins: gapEnd,
                        duration: gapDur,
                        startTime: addMinutes('00:00', gapStart),
                        endTime: addMinutes('00:00', gapEnd)
                    });
                }
            }
            scanFrom = Math.max(scanFrom, occ.e);
        }
        // Final gap
        if (scanFrom < scanUntil && (scanUntil - scanFrom) >= minDuration) {
            freeSlots.push({
                startMins: scanFrom, endMins: scanUntil, duration: scanUntil - scanFrom,
                startTime: addMinutes('00:00', scanFrom), endTime: addMinutes('00:00', scanUntil)
            });
        }
        return freeSlots;
    }

    function findAvailableSlots(exo) {
        const slots = [];
        const today = new Date();
        const deadline = new Date(exo.deadline);
        deadline.setHours(23, 59, 0, 0);
        const MIN_SLOT = 15; // minimum usable chunk in minutes

        for (let d = 0; d < 14 && slots.length < 8; d++) {
            const date = new Date(today);
            date.setDate(today.getDate() + d);
            if (date > deadline) break;

            const jsDay = date.getDay();
            const planDay = jsDay === 0 ? 6 : jsDay - 1;
            const freeSlots = getRealFreeSlots(planDay, MIN_SLOT);
            const d_label = d === 0 ? "Aujourd'hui" : d === 1 ? 'Demain'
                : ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][jsDay] + ' ' + date.getDate() + '/' + (date.getMonth() + 1);

            for (const gap of freeSlots) {
                if (slots.length >= 8) break;
                const fitDur = Math.min(exo.duration, gap.duration);
                const endTime = addMinutes(gap.startTime, fitDur);
                const isFull = fitDur >= exo.duration;
                const isSplit = !isFull;
                slots.push({
                    label: d_label + ' · ' + gap.startTime + ' – ' + endTime + (isSplit ? ' (partie 1/' + Math.ceil(exo.duration / gap.duration) + ')' : ''),
                    planDay, startTime: gap.startTime, endTime,
                    availDur: fitDur, neededDur: exo.duration,
                    isSplit, gapDuration: gap.duration,
                    dateStr: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
                    conflict: false
                });
            }
        }

        // If still no slots found and deadline forces it — emergency: split across multiple days
        if (slots.length === 0) {
            // Just pick next 3 days with any free time >= MIN_SLOT
            for (let d = 0; d < 21 && slots.length < 4; d++) {
                const date = new Date(today);
                date.setDate(today.getDate() + d);
                const jsDay = date.getDay();
                const planDay = jsDay === 0 ? 6 : jsDay - 1;
                const freeSlots = getRealFreeSlots(planDay, MIN_SLOT);
                if (freeSlots.length > 0) {
                    const gap = freeSlots[0];
                    const fitDur = Math.min(exo.duration, gap.duration);
                    const endTime = addMinutes(gap.startTime, fitDur);
                    const d_label = d === 0 ? "Aujourd'hui" : d === 1 ? 'Demain'
                        : ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][jsDay] + ' ' + date.getDate() + '/' + (date.getMonth() + 1);
                    slots.push({
                        label: d_label + ' · ' + gap.startTime + ' – ' + endTime + ' (partie)',
                        planDay, startTime: gap.startTime, endTime,
                        availDur: fitDur, neededDur: exo.duration,
                        isSplit: fitDur < exo.duration, gapDuration: gap.duration,
                        dateStr: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
                        conflict: false
                    });
                }
            }
        }
        return slots;
    }

    function openPlanifier(exoId) {
        planifyTarget = exoId;
        switchExoTab('planifier');
        renderPlanifier();
    }

    function scheduleExo(exoId, slotIdx) {
        const exo = exercices.find(e => e.id === exoId);
        if (!exo) return;
        const slots = findAvailableSlots(exo);
        const slot = slots[slotIdx];
        if (!slot) return;

        // If split needed, schedule part 1 now and notify
        const part1Dur = slot.availDur;
        const remaining = exo.duration - part1Dur;

        // Add part 1 to planning
        customEvents.push({
            id: generateEventId('study', exo.subject, slot.planDay),
            day: slot.planDay,
            title: 'Exercices ' + exo.subject + (slot.isSplit ? ' (Partie 1)' : ''),
            startTime: slot.startTime,
            endTime: slot.endTime,
            type: 'study',
            icon: exo.subjectIcon,
            source: 'exercice',
            exoId,
            timestamp: Date.now()
        });

        // If split: auto-schedule part 2 on the next free slot
        if (slot.isSplit && remaining > 0) {
            // Find next available slot for remaining duration
            const exoPart2 = { ...exo, duration: remaining };
            const nextSlots = findAvailableSlots(exoPart2).filter(s => s.planDay !== slot.planDay || timeToMinutes(s.startTime) > timeToMinutes(slot.endTime));
            if (nextSlots.length > 0) {
                const s2 = nextSlots[0];
                customEvents.push({
                    id: generateEventId('study', exo.subject + '-p2', s2.planDay),
                    day: s2.planDay,
                    title: 'Exercices ' + exo.subject + ' (Partie 2)',
                    startTime: s2.startTime,
                    endTime: s2.endTime,
                    type: 'study',
                    icon: exo.subjectIcon,
                    source: 'exercice',
                    exoId,
                    timestamp: Date.now()
                });
                exo.scheduledSlot = slot.dateStr + ' (P1) + ' + s2.dateStr + ' (P2)';
            } else {
                exo.scheduledSlot = slot.dateStr + ' (P1 — P2 à planifier)';
            }
        } else {
            exo.scheduledSlot = slot.dateStr + ' · ' + slot.startTime + '–' + slot.endTime;
        }

        localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(customEvents));
        exo.scheduledSlot = exo.scheduledSlot || slot.dateStr;
        localStorage.setItem('studyPlanIB_exercices', JSON.stringify(exercices));
        document.getElementById('exoCountBadge').textContent = exercices.length + ' exercice' + (exercices.length > 1 ? 's' : '');

        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:linear-gradient(to right,#10b981,#059669);color:white;padding:0.875rem 1.5rem;border-radius:0.875rem;font-weight:700;font-size:0.85rem;z-index:200;box-shadow:0 8px 20px rgba(16,185,129,0.4);animation:fadeInUp 0.3s;max-width:92%;text-align:center;';
        toast.textContent = slot.isSplit
            ? '✅ Exercice découpé et planifié sur ' + exo.scheduledSlot
            : '✅ Planifié le ' + slot.dateStr + ' de ' + slot.startTime + ' à ' + slot.endTime;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
        renderPlanifier();
        renderExoList();
    }

    function switchExoTab(tab) {
        ['ajouter','liste','planifier'].forEach(t => {
            document.getElementById('tabContent' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = t === tab ? 'block' : 'none';
            const btn = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
            if (btn) {
                btn.style.background = t === tab ? 'white' : 'transparent';
                btn.style.color = t === tab ? '#059669' : '#6b7280';
                btn.style.boxShadow = t === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
            }
        });
        if (tab === 'liste') renderExoList();
        if (tab === 'planifier') renderPlanifier();
    }

    // Load exercices from localStorage on init
    (function() {
        const saved = localStorage.getItem('studyPlanIB_exercices');
        if (saved) try { exercices = JSON.parse(saved); } catch(e) {}
    })();

    // ── BRIDGE: make planning functions accessible from this script block ──
    // addMinutes and timeToMinutes are defined in the first <script> block (inline in body)
    // and are globally accessible since they are declared with function keyword.
    // generateDayEvents is also global. No bridge needed — all window-scope functions.</script>
