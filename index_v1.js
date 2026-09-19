
        let stressLevel = 30;
        let productivityLevel = 20;
        let currentSlide = 0;
        let hasAnimated = false;
        const totalSlides = 4;

        function increaseStress() {
            if (stressLevel < 90) {
                stressLevel = Math.min(stressLevel + 15, 90);
                document.getElementById('stressValue').textContent = stressLevel + '%';
                document.getElementById('stressFill').style.width = stressLevel + '%';
            }
        }

        function checkScroll() {
            if (hasAnimated) return;
            
            const section = document.getElementById('beforeAfter');
            const rect = section.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight * 0.75;

            if (isVisible) {
                hasAnimated = true;
                animateMeters();
            }
        }

        function animateMeters() {
            let stressProgress = 30;
            const stressInterval = setInterval(() => {
                stressProgress += 2;
                if (stressProgress >= 75) {
                    clearInterval(stressInterval);
                    stressLevel = 75;
                    document.getElementById('stressValue').textContent = '75%';
                    document.getElementById('stressFill').style.width = '75%';
                } else {
                    stressLevel = stressProgress;
                    document.getElementById('stressValue').textContent = stressProgress + '%';
                    document.getElementById('stressFill').style.width = stressProgress + '%';
                }
            }, 50);

            let prodProgress = 20;
            const prodInterval = setInterval(() => {
                prodProgress += 2;
                if (prodProgress >= 75) {
                    clearInterval(prodInterval);
                    productivityLevel = 75;
                    document.getElementById('prodValue').textContent = '75%';
                    document.getElementById('prodFill').style.width = '75%';
                } else {
                    productivityLevel = prodProgress;
                    document.getElementById('prodValue').textContent = prodProgress + '%';
                    document.getElementById('prodFill').style.width = prodProgress + '%';
                }
            }, 50);
        }

        window.addEventListener('scroll', checkScroll);

        function updateSlides() {
            const slides = document.querySelectorAll('.carousel-slide');
            const dots = document.querySelectorAll('.carousel-dot');

            slides.forEach((slide, index) => {
                slide.classList.remove('active', 'prev');
                if (index === currentSlide) {
                    slide.classList.add('active');
                } else if (index < currentSlide) {
                    slide.classList.add('prev');
                }
            });

            dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === currentSlide);
            });
        }

        function nextSlide() {
            currentSlide = (currentSlide + 1) % totalSlides;
            updateSlides();
        }

        function prevSlide() {
            currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
            updateSlides();
        }

        function goToSlide(index) {
            currentSlide = index;
            updateSlides();
        }

        setInterval(nextSlide, 5000);

        function openContextModal() {
            document.getElementById('contextModal').classList.add('active');
            setTimeout(() => {
                document.getElementById('nameInput').focus();
            }, 300);
        }

        function closeContextModal() {
            document.getElementById('contextModal').classList.remove('active');
            document.getElementById('nameInput').value = '';
            document.getElementById('nameError').classList.remove('show');
        }

        let userName = '';
        let targetScore = 40;

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
            if (targetScore >= 36) return { badge: 'bg-emerald', text: 'Excellent objectif ! ⭐', note: 'Top 15% mondial' };
            if (targetScore >= 30) return { badge: 'bg-blue', text: 'Bon objectif 👍', note: 'Solide performance' };
            if (targetScore >= 24) return { badge: 'bg-gray', text: 'Objectif réaliste 📚', note: 'Diplôme assuré' };
            return { badge: 'bg-red', text: 'Score minimum : 24 points ⚠️', note: '' };
        }

        function getMotivationMessage() {
            if (targetScore >= 43) return "🚀 Viser 43+ points, c'est viser l'excellence absolue ! Tu te places parmi les 3% des meilleurs élèves IB au monde.";
            if (targetScore >= 40) return "🌟 40+ points te place dans le top 10% mondial ! C'est le score qui fait briller les yeux des recruteurs universitaires.";
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
                showSleepPage();
            }
        }

        // Page 3 - Sleep
        function showSleepPage() {
            document.getElementById('objectivesModal').classList.remove('active');
            document.getElementById('sleepModal').classList.add('active');
        }

        function hideSleepPage() {
            document.getElementById('sleepModal').classList.remove('active');
            document.getElementById('objectivesModal').classList.add('active');
        }

        let weekdayWakeup = '06:00';
        let saturdayWakeup = '07:00';
        let sundayWakeup = '08:00';

        function calculateBedtime(wakeup) {
            const [hours, minutes] = wakeup.split(':').map(Number);
            let bedHour = hours - 8;
            if (bedHour < 0) bedHour += 24;
            return bedHour.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');
        }

        function updateBedtimes() {
            document.getElementById('weekdayBedtime').textContent = calculateBedtime(weekdayWakeup);
            document.getElementById('saturdayBedtime').textContent = calculateBedtime(saturdayWakeup);
            document.getElementById('sundayBedtime').textContent = calculateBedtime(sundayWakeup);
        }

        function validateSleep() {
            showSubjectsPage();
        }

        // Page 4 - Subjects
        function showSubjectsPage() {
            document.getElementById('sleepModal').classList.remove('active');
            document.getElementById('subjectsModal').classList.add('active');
            updateSubjectsUI();
        }

        function hideSubjectsPage() {
            document.getElementById('subjectsModal').classList.remove('active');
            document.getElementById('sleepModal').classList.add('active');
        }

        let subjects = [
            { name: 'Mathématiques AA', level: 'SL', grade: 5, icon: '🔢', required: true, forcedLevel: 'SL' },
            { name: 'Anglais B', level: 'HL', grade: 5, icon: '🇬🇧', required: true },
            { name: 'Français A', level: 'HL', grade: 5, icon: '🇫🇷', required: true }
        ];

        let optionalSubjects = [];

        const availableSubjectsList = [
            { name: 'Biologie', icon: '🧬', conflicts: ['Physique'] },
            { name: 'Physique', icon: '⚛️', conflicts: ['Biologie'] },
            { name: 'Chimie', icon: '🧪', conflicts: [] },
            { name: 'Histoire', icon: '📜', conflicts: ['Géographie'] },
            { name: 'Géographie', icon: '🌍', conflicts: ['Histoire'] },
            { name: 'Économie', icon: '💹', conflicts: [] },
            { name: 'ESS', icon: '🌱', forcedLevel: 'SL', conflicts: [] }
        ];

        function getAvailableSubjects() {
            const selectedNames = [...subjects.map(s => s.name), ...optionalSubjects.map(s => s.name)];
            const conflicts = [];
            
            optionalSubjects.forEach(s => {
                const subjectDef = availableSubjectsList.find(a => a.name === s.name);
                if (subjectDef && subjectDef.conflicts) {
                    conflicts.push(...subjectDef.conflicts);
                }
            });
            
            return availableSubjectsList.filter(s => 
                !selectedNames.includes(s.name) && !conflicts.includes(s.name)
            );
        }

        function countLevels() {
            const allSubjects = [...subjects, ...optionalSubjects];
            const hlCount = allSubjects.filter(s => s.level === 'HL').length;
            const slCount = allSubjects.filter(s => s.level === 'SL').length;
            return { hlCount, slCount };
        }

        function addOptionalSubject(name) {
            const subjectDef = availableSubjectsList.find(s => s.name === name);
            if (subjectDef && optionalSubjects.length < 3) {
                optionalSubjects.push({
                    name: subjectDef.name,
                    level: subjectDef.forcedLevel || 'SL',
                    grade: 5,
                    icon: subjectDef.icon,
                    forcedLevel: subjectDef.forcedLevel
                });
                updateSubjectsUI();
            }
        }

        function removeOptionalSubject(name) {
            optionalSubjects = optionalSubjects.filter(s => s.name !== name);
            updateSubjectsUI();
        }

        function updateSubjectLevel(name, level, isRequired) {
            if (isRequired) {
                subjects = subjects.map(s => 
                    s.name === name && !s.forcedLevel ? { ...s, level } : s
                );
            } else {
                optionalSubjects = optionalSubjects.map(s => 
                    s.name === name && !s.forcedLevel ? { ...s, level } : s
                );
            }
            updateSubjectsUI();
        }

        function updateSubjectGrade(name, grade, isRequired) {
            const clampedGrade = Math.max(1, Math.min(7, parseInt(grade) || 1));
            if (isRequired) {
                subjects = subjects.map(s => 
                    s.name === name ? { ...s, grade: clampedGrade } : s
                );
            } else {
                optionalSubjects = optionalSubjects.map(s => 
                    s.name === name ? { ...s, grade: clampedGrade } : s
                );
            }
        }

        function isSubjectsValid() {
            const totalSubjects = subjects.length + optionalSubjects.length;
            const { hlCount, slCount } = countLevels();
            return totalSubjects === 6 && hlCount === 3 && slCount === 3;
        }

        function updateSubjectsUI() {
            const { hlCount, slCount } = countLevels();
            
            // Update counters
            document.getElementById('hlCounter').textContent = 'HL: ' + hlCount + '/3';
            document.getElementById('hlCounter').className = 'counter-badge ' + (hlCount === 3 ? 'valid' : 'invalid-hl');
            document.getElementById('slCounter').textContent = 'SL: ' + slCount + '/3';
            document.getElementById('slCounter').className = 'counter-badge ' + (slCount === 3 ? 'valid' : 'invalid-sl');
            
            // Update required subjects
            const requiredContainer = document.getElementById('requiredSubjects');
            requiredContainer.innerHTML = subjects.map(subject => {
                const levelSelector = subject.forcedLevel 
                    ? '<span class="forced-level">' + subject.forcedLevel + ' uniquement</span>'
                    : '<select onchange="updateSubjectLevel(\'' + subject.name + '\', this.value, true)" class="level-select ' + (subject.level === 'HL' ? 'hl' : 'sl') + '"><option value="HL"' + (subject.level === 'HL' ? ' selected' : '') + '>HL</option><option value="SL"' + (subject.level === 'SL' ? ' selected' : '') + '>SL</option></select>';
                
                return '<div class="subject-card required"><div class="subject-info"><div class="subject-icon">' + subject.icon + '</div><span class="subject-name">' + subject.name + '</span></div><div class="subject-controls">' + levelSelector + '<div class="grade-input-wrapper"><input type="number" min="1" max="7" value="' + subject.grade + '" onchange="updateSubjectGrade(\'' + subject.name + '\', this.value, true)" class="grade-input"><span class="grade-suffix">/7</span></div></div></div>';
            }).join('');
            
            // Update optional subjects
            const optionalContainer = document.getElementById('optionalSubjects');
            optionalContainer.innerHTML = optionalSubjects.map(subject => {
                const levelSelector = subject.forcedLevel 
                    ? '<span class="forced-level">' + subject.forcedLevel + ' uniquement</span>'
                    : '<select onchange="updateSubjectLevel(\'' + subject.name + '\', this.value, false)" class="level-select ' + (subject.level === 'HL' ? 'hl' : 'sl') + '"><option value="HL"' + (subject.level === 'HL' ? ' selected' : '') + '>HL</option><option value="SL"' + (subject.level === 'SL' ? ' selected' : '') + '>SL</option></select>';
                
                return '<div class="subject-card optional"><div class="subject-info"><div class="subject-icon teal">' + subject.icon + '</div><span class="subject-name">' + subject.name + '</span></div><div class="subject-controls">' + levelSelector + '<div class="grade-input-wrapper"><input type="number" min="1" max="7" value="' + subject.grade + '" onchange="updateSubjectGrade(\'' + subject.name + '\', this.value, false)" class="grade-input"><span class="grade-suffix">/7</span></div><button onclick="removeOptionalSubject(\'' + subject.name + '\')" class="remove-btn">✕</button></div></div>';
            }).join('');
            
            // Update add subject dropdown
            const addSubjectSelect = document.getElementById('addSubjectSelect');
            const available = getAvailableSubjects();
            addSubjectSelect.innerHTML = '<option value="">+ Ajouter une matière...</option>' + available.map(s => 
                '<option value="' + s.name + '">' + s.icon + ' ' + s.name + (s.forcedLevel ? ' (' + s.forcedLevel + ' uniquement)' : '') + '</option>'
            ).join('');
            addSubjectSelect.parentElement.style.display = optionalSubjects.length < 3 ? 'block' : 'none';
            
            // Update validation message
            const validationMsg = document.getElementById('validationMsg');
            if (isSubjectsValid()) {
                validationMsg.className = 'validation-box valid';
                validationMsg.innerHTML = '✅ Configuration valide ! Tu as 6 matières avec 3 HL et 3 SL';
            } else {
                validationMsg.className = 'validation-box invalid';
                validationMsg.innerHTML = '⚠️ Configuration incomplète. Il te faut exactement 6 matières (3 HL et 3 SL)';
            }
            
            // Update continue button
            document.getElementById('subjectsContinueBtn').disabled = !isSubjectsValid();
        }

        function handleAddSubject(select) {
            if (select.value) {
                addOptionalSubject(select.value);
                select.value = '';
            }
        }

        function validateSubjects() {
            if (isSubjectsValid()) {
                showTransportPage();
            }
        }

        // Page 5 - Transport
        function showTransportPage() {
            document.getElementById('subjectsModal').classList.remove('active');
            document.getElementById('transportModal').classList.add('active');
        }

        function hideTransportPage() {
            document.getElementById('transportModal').classList.remove('active');
            document.getElementById('subjectsModal').classList.add('active');
        }

        function selectTransport(mode) {
            document.getElementById('transportModal').classList.remove('active');
            if (mode === 'voiture') {
                document.getElementById('carConfigModal').classList.add('active');
                updateCarPrepTime();
            } else {
                document.getElementById('motoConfigModal').classList.add('active');
                updateMotoPrepTime();
            }
        }

        // Page 6a - Car Configuration
        let carDeparture = '07:30';
        let carToSchool = 30;
        let carFromSchool = 40;

        function calculatePrepTime(departure) {
            const [hours, minutes] = departure.split(':').map(Number);
            let prepHour = hours;
            let prepMin = minutes - 30;
            if (prepMin < 0) {
                prepMin += 60;
                prepHour -= 1;
                if (prepHour < 0) prepHour += 24;
            }
            return prepHour.toString().padStart(2, '0') + ':' + prepMin.toString().padStart(2, '0');
        }

        function updateCarPrepTime() {
            document.getElementById('carPrepTime').textContent = calculatePrepTime(carDeparture);
        }

        function hideCarConfig() {
            document.getElementById('carConfigModal').classList.remove('active');
            document.getElementById('transportModal').classList.add('active');
        }

        function saveCarConfig() {
            document.getElementById('carConfigModal').classList.remove('active');
            document.getElementById('activitiesModal').classList.add('active');
            renderActivities();
        }

        function saveCarConfigOld2() {
            alert('Configuration voiture enregistrée !\n\n• Départ : ' + carDeparture + '\n• Préparation : ' + calculatePrepTime(carDeparture) + '\n• Trajet aller : ' + carToSchool + ' min\n• Trajet retour : ' + carFromSchool + ' min\n\n' + userName + ', ton planning personnalisé est prêt ! Score visé: ' + targetScore + ' points.');
        }

        // Page 6b - Moto Configuration
        let motoDeparture = '07:30';
        let motoReturn = '17:00';
        let motoToSchool = 25;
        let motoFromSchool = 25;

        function updateMotoPrepTime() {
            document.getElementById('motoPrepTime').textContent = calculatePrepTime(motoDeparture);
        }

        function hideMotoConfig() {
            document.getElementById('motoConfigModal').classList.remove('active');
            document.getElementById('transportModal').classList.add('active');
        }

        function saveMotoConfig() {
            document.getElementById('motoConfigModal').classList.remove('active');
            document.getElementById('activitiesModal').classList.add('active');
            renderActivities();
        }

        function saveCarConfigOld() {
            alert('Configuration moto enregistrée !\n\n• Départ : ' + motoDeparture + '\n• Préparation : ' + calculatePrepTime(motoDeparture) + '\n• Trajet aller : ' + motoToSchool + ' min\n• Retour école : ' + motoReturn + '\n• Trajet retour : ' + motoFromSchool + ' min\n\n' + userName + ', ton planning personnalisé est prêt ! Score visé: ' + targetScore + ' points.');
        }

        document.getElementById('nameInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleContinue();
            }
        });

        // ========== PAGE 7: ACTIVITÉS ==========
        let selectedActivities = [];
        const availableActivitiesList = [
            { name: 'Église', icon: '⛪' },
            { name: 'Mosquée', icon: '🕌' },
            { name: 'Basketball', icon: '🏀' },
            { name: 'Football', icon: '⚽' },
            { name: 'Natation', icon: '🏊' },
            { name: 'Danse', icon: '💃' },
            { name: 'Arts', icon: '🎨' },
            { name: 'Yoga', icon: '🧘' },
            { name: 'Gym', icon: '🏋️' },
            { name: 'Bénévolat', icon: '🤝' },
            { name: 'Cours particuliers', icon: '📚' }
        ];

        function isSchoolHours(time, dayIndex) {
            if (dayIndex >= 5) return false;
            const [hours, minutes] = time.split(':').map(Number);
            const timeInMinutes = hours * 60 + minutes;
            return timeInMinutes >= 480 && timeInMinutes <= 995; // 8:00 - 16:35
        }

        function showSchoolWarning() {
            const warning = document.getElementById('schoolWarning');
            warning.style.display = 'block';
            setTimeout(() => { warning.style.display = 'none'; }, 4000);
        }

        function toggleActivity(name, icon) {
            const exists = selectedActivities.find(a => a.name === name);
            if (exists) {
                selectedActivities = selectedActivities.filter(a => a.name !== name);
            } else {
                selectedActivities.push({
                    name, icon, days: [], sameTime: true,
                    startTime: '17:00', endTime: '19:00', dayTimes: {}
                });
            }
            renderActivities();
        }

        function toggleActivityDay(name, dayIndex) {
            const activity = selectedActivities.find(a => a.name === name);
            if (activity) {
                if (activity.days.includes(dayIndex)) {
                    activity.days = activity.days.filter(d => d !== dayIndex);
                } else {
                    activity.days.push(dayIndex);
                    if (!activity.dayTimes[dayIndex]) {
                        activity.dayTimes[dayIndex] = { start: '17:00', end: '19:00' };
                    }
                }
                renderActivities();
            }
        }

        function toggleSameTime(name) {
            const activity = selectedActivities.find(a => a.name === name);
            if (activity) {
                activity.sameTime = !activity.sameTime;
                renderActivities();
            }
        }

        function updateActivityTime(name, field, value, days) {
            const hasWeekday = days && days.some(d => d < 5);
            if (hasWeekday && isSchoolHours(value, 0)) {
                showSchoolWarning();
                return;
            }
            const activity = selectedActivities.find(a => a.name === name);
            if (activity) {
                activity[field] = value;
            }
        }

        function updateActivityDayTime(name, dayIndex, field, value) {
            if (dayIndex < 5 && isSchoolHours(value, dayIndex)) {
                showSchoolWarning();
                return;
            }
            const activity = selectedActivities.find(a => a.name === name);
            if (activity) {
                if (!activity.dayTimes[dayIndex]) {
                    activity.dayTimes[dayIndex] = { start: '17:00', end: '19:00' };
                }
                activity.dayTimes[dayIndex][field] = value;
            }
        }

        function removeActivity(name) {
            selectedActivities = selectedActivities.filter(a => a.name !== name);
            renderActivities();
        }

        function addCustomActivity() {
            const input = document.getElementById('customActivityInput');
            const name = input.value.trim();
            if (name) {
                selectedActivities.push({
                    name, icon: '✨', days: [], sameTime: true,
                    startTime: '17:00', endTime: '19:00', dayTimes: {}
                });
                input.value = '';
                renderActivities();
            }
        }

        function renderActivities() {
            // Render activities grid
            const grid = document.getElementById('activitiesGrid');
            grid.innerHTML = availableActivitiesList.map(act => {
                const isSelected = selectedActivities.find(a => a.name === act.name);
                return '<button onclick="toggleActivity(\'' + act.name + '\', \'' + act.icon + '\')" style="padding: 1rem; border-radius: 1rem; border: 2px solid ' + (isSelected ? '#10b981' : '#e5e7eb') + '; background: ' + (isSelected ? 'linear-gradient(to bottom right, #ecfdf5, #f0fdfa)' : 'white') + '; cursor: pointer; transition: all 0.3s;"><span style="font-size: 1.5rem; display: block; margin-bottom: 0.25rem;">' + act.icon + '</span><span style="font-size: 0.75rem; font-weight: 500; color: #374151;">' + act.name + '</span></button>';
            }).join('');

            // Render selected activities config
            const config = document.getElementById('activitiesConfig');
            if (selectedActivities.length === 0) {
                config.innerHTML = '';
                return;
            }

            const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
            config.innerHTML = '<h3 style="font-size: 1.125rem; font-weight: 700; color: #1f2937; margin-bottom: 1rem;">Configuration des activités</h3>' +
                selectedActivities.map(act => {
                    let timesHtml = '';
                    if (act.sameTime) {
                        timesHtml = '<div style="display: flex; gap: 1rem; flex-wrap: wrap;"><div><label style="font-size: 0.875rem; color: #6b7280;">Début</label><input type="time" value="' + act.startTime + '" onchange="updateActivityTime(\'' + act.name + '\', \'startTime\', this.value, [' + act.days.join(',') + '])" style="padding: 0.5rem; border: 2px solid #e5e7eb; border-radius: 0.5rem;"></div><div><label style="font-size: 0.875rem; color: #6b7280;">Fin</label><input type="time" value="' + act.endTime + '" onchange="updateActivityTime(\'' + act.name + '\', \'endTime\', this.value, [' + act.days.join(',') + '])" style="padding: 0.5rem; border: 2px solid #e5e7eb; border-radius: 0.5rem;"></div></div>';
                    } else {
                        const sortedDays = [...act.days].sort((a,b) => a-b);
                        if (sortedDays.length === 0) {
                            timesHtml = '<p style="color: #9ca3af; font-style: italic; font-size: 0.875rem;">Sélectionne d\'abord les jours de pratique</p>';
                        } else {
                            timesHtml = '<div style="display: flex; flex-direction: column; gap: 0.75rem;">' + sortedDays.map(d => {
                                const dt = act.dayTimes[d] || { start: '17:00', end: '19:00' };
                                return '<div style="display: flex; align-items: center; gap: 0.75rem; background: #f9fafb; padding: 0.75rem; border-radius: 0.75rem;"><span style="width: 3rem; font-weight: 600; color: #047857; font-size: 0.875rem;">' + dayNames[d] + '</span><input type="time" value="' + dt.start + '" onchange="updateActivityDayTime(\'' + act.name + '\', ' + d + ', \'start\', this.value)" style="padding: 0.375rem; border: 2px solid #e5e7eb; border-radius: 0.5rem; font-size: 0.875rem;"><span style="color: #9ca3af;">→</span><input type="time" value="' + dt.end + '" onchange="updateActivityDayTime(\'' + act.name + '\', ' + d + ', \'end\', this.value)" style="padding: 0.375rem; border: 2px solid #e5e7eb; border-radius: 0.5rem; font-size: 0.875rem;"></div>';
                            }).join('') + '</div>';
                        }
                    }

                    return '<div style="background: white; border: 2px solid #d1fae5; border-radius: 1rem; padding: 1.25rem; margin-bottom: 1rem;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;"><div style="display: flex; align-items: center; gap: 0.75rem;"><span style="font-size: 1.5rem;">' + act.icon + '</span><span style="font-weight: 600; color: #1f2937;">' + act.name + '</span></div><button onclick="removeActivity(\'' + act.name + '\')" style="padding: 0.25rem 0.75rem; background: #fee2e2; color: #dc2626; border: none; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem;">✕ Supprimer</button></div><div style="margin-bottom: 1rem;"><label style="font-size: 0.875rem; font-weight: 500; color: #4b5563; display: block; margin-bottom: 0.5rem;">Jours de pratique</label><div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">' + ['L','M','M','J','V','S','D'].map((d, i) => '<button onclick="toggleActivityDay(\'' + act.name + '\', ' + i + ')" style="width: 2.5rem; height: 2.5rem; border-radius: 50%; font-weight: 600; font-size: 0.875rem; border: none; cursor: pointer; background: ' + (act.days.includes(i) ? '#10b981' : '#f3f4f6') + '; color: ' + (act.days.includes(i) ? 'white' : '#4b5563') + ';">' + d + '</button>').join('') + '</div></div><div style="margin-bottom: 1rem;"><label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;"><input type="checkbox" ' + (act.sameTime ? 'checked' : '') + ' onchange="toggleSameTime(\'' + act.name + '\')" style="width: 1.25rem; height: 1.25rem;"><span style="font-size: 0.875rem; color: #4b5563;">Même horaire tous les jours</span></label></div>' + timesHtml + '</div>';
                }).join('');
        }

        function goToScreenTime() {
            document.getElementById('activitiesModal').classList.remove('active');
            document.getElementById('screenTimeModal').classList.add('active');
            renderScreenTime();
        }

        function goBackFromActivities() {
            document.getElementById('activitiesModal').classList.remove('active');
            document.getElementById('carConfigModal').classList.add('active');
        }

        // ========== PAGE 7b: TEMPS D'ÉCRAN ==========
        let phoneDays = [0,1,2,3,4,5,6];
        let samePhoneDuration = true;
        let phoneDuration = 60;
        let phoneDayDurations = {0:60,1:60,2:60,3:60,4:60,5:60,6:60};

        function togglePhoneDay(dayIndex) {
            if (phoneDays.includes(dayIndex)) {
                phoneDays = phoneDays.filter(d => d !== dayIndex);
            } else {
                phoneDays.push(dayIndex);
            }
            renderScreenTime();
        }

        function setPhoneDurationValue(dur) {
            phoneDuration = dur;
            renderScreenTime();
        }

        function formatDuration(minutes) {
            if (minutes === 0) return '0min';
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            if (hours === 0) return mins + 'min';
            if (mins === 0) return hours + 'h';
            return hours + 'h' + mins;
        }

        function calculateWeeklyTotal() {
            if (samePhoneDuration) {
                return phoneDays.length * phoneDuration;
            }
            return phoneDays.reduce((total, day) => total + (phoneDayDurations[day] || 0), 0);
        }

        function renderScreenTime() {
            // Days selection
            const daysHtml = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((d, i) =>
                '<button onclick="togglePhoneDay(' + i + ')" style="width: 2.75rem; height: 2.75rem; border-radius: 50%; font-weight: 600; font-size: 0.875rem; border: none; cursor: pointer; background: ' + (phoneDays.includes(i) ? '#10b981' : '#f3f4f6') + '; color: ' + (phoneDays.includes(i) ? 'white' : '#4b5563') + ';">' + d + '</button>'
            ).join('');
            document.getElementById('phoneDaysGrid').innerHTML = daysHtml;

            // Duration selection
            let durationHtml = '';
            if (samePhoneDuration) {
                durationHtml = '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">' +
                    [15,30,45,60,90,120,150,180].map(dur =>
                        '<button onclick="setPhoneDurationValue(' + dur + ')" style="padding: 0.75rem; border-radius: 0.75rem; font-weight: 600; font-size: 0.875rem; border: none; cursor: pointer; background: ' + (phoneDuration === dur ? '#10b981' : '#f3f4f6') + '; color: ' + (phoneDuration === dur ? 'white' : '#4b5563') + ';">' + formatDuration(dur) + '</button>'
                    ).join('') + '</div>';
            } else {
                durationHtml = '<div style="display: flex; flex-direction: column; gap: 0.75rem;">' +
                    ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((d, i) =>
                        '<div style="display: flex; align-items: center; gap: 0.75rem; opacity: ' + (phoneDays.includes(i) ? '1' : '0.4') + ';"><span style="width: 2.5rem; font-weight: 600; font-size: 0.875rem; color: #374151;">' + d + '</span><input type="range" min="0" max="180" step="15" value="' + (phoneDayDurations[i] || 0) + '" onchange="phoneDayDurations[' + i + ']=parseInt(this.value); renderScreenTime();" style="flex: 1;" ' + (!phoneDays.includes(i) ? 'disabled' : '') + '><span style="width: 3.5rem; text-align: right; font-weight: 600; font-size: 0.875rem; color: #10b981;">' + (phoneDays.includes(i) ? formatDuration(phoneDayDurations[i] || 0) : '-') + '</span></div>'
                    ).join('') + '</div>';
            }
            document.getElementById('durationSelection').innerHTML = durationHtml;

            // Weekly summary
            const summaryHtml = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;"><span style="font-weight: 700; color: #064e3b;">Total hebdomadaire</span><span style="font-size: 1.5rem; font-weight: 700; color: #10b981;">' + formatDuration(calculateWeeklyTotal()) + '</span></div>' +
                '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.25rem;">' +
                ['L','M','M','J','V','S','D'].map((d, i) =>
                    '<div style="text-align: center; padding: 0.5rem; border-radius: 0.5rem; font-size: 0.75rem; background: ' + (phoneDays.includes(i) ? '#d1fae5' : '#f3f4f6') + '; color: ' + (phoneDays.includes(i) ? '#047857' : '#9ca3af') + ';"><div style="font-weight: 700;">' + d + '</div><div style="margin-top: 0.25rem;">' + (phoneDays.includes(i) ? (samePhoneDuration ? formatDuration(phoneDuration) : formatDuration(phoneDayDurations[i] || 0)) : '-') + '</div></div>'
                ).join('') + '</div>';
            document.getElementById('weeklySummary').innerHTML = summaryHtml;
        }

        function generatePlanning() {
            document.getElementById('screenTimeModal').classList.remove('active');
            document.getElementById('planningModal').classList.add('active');
            initPlanning();
        }
        
        // Page 8: Planning Principal
        let selectedDay = 0;
        let customEvents = [];
        let showAddModal = false;
        let showEditModal = false;
        let editingEvent = null;
        
        function getGreeting() {
            const hour = new Date().getHours();
            if (hour < 12) return 'Bonjour';
            if (hour < 18) return 'Bon après-midi';
            return 'Bonsoir';
        }
        
        function getWeekDates() {
            const today = new Date();
            const monday = new Date(today);
            monday.setDate(today.getDate() - today.getDay() + 1);
            
            return Array.from({ length: 7 }, (_, i) => {
                const date = new Date(monday);
                date.setDate(monday.getDate() + i);
                return {
                    dayName: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i],
                    dayNumber: date.getDate(),
                    isToday: date.toDateString() === today.toDateString()
                };
            });
        }
        
        function addMinutes(time, mins) {
            const [h, m] = time.split(':').map(Number);
            const totalMins = h * 60 + m + mins;
            const newH = Math.floor(totalMins / 60) % 24;
            const newM = totalMins % 60;
            return newH.toString().padStart(2, '0') + ':' + newM.toString().padStart(2, '0');
        }
        
        // ── MOTEUR DE PLANIFICATION INTELLIGENT ─────────────────────
        // Chaque activité commence exactement à la fin de la précédente.
        // Après modification d'un créneau, toutes les suivantes se décalent automatiquement.

        function cascadeEvents(events) {
            // Re-chain all editable events that are not fixed (school, sleep, wakeup)
            const FIXED_IDS = ['school1','school2','eco','sleep','wakeup'];
            const fixed = events.filter(e => FIXED_IDS.includes(e.id));
            const chainable = events.filter(e => !FIXED_IDS.includes(e.id));

            // Sort chainable by their current startTime
            chainable.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

            // Re-chain: each starts exactly when the previous ends
            for (let i = 1; i < chainable.length; i++) {
                const prev = chainable[i - 1];
                const dur = timeToMinutes(chainable[i].endTime) - timeToMinutes(chainable[i].startTime);
                chainable[i].startTime = prev.endTime;
                chainable[i].endTime = addMinutes(prev.endTime, Math.max(dur, 1));
            }

            // Merge back and sort all
            const all = [...fixed, ...chainable].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            return all;
        }

        function getStudyColor(grade) {
            if (grade <= 2) return 'critical';
            if (grade <= 4) return 'warning';
            return 'study';
        }

        function generateDayEvents(dayIndex) {
            const isWeekend = dayIndex >= 5;
            const isSaturday = dayIndex === 5;
            const isSunday = dayIndex === 6;
            const wakeupTime = isWeekend ? (isSaturday ? saturdayWakeup : sundayWakeup) : weekdayWakeup;
            const bedtime = calculateBedtime(wakeupTime);

            const events = [];
            let cursor = wakeupTime; // pointer that advances with each event

            // Load saved events
            const savedEvents = localStorage.getItem('studyPlanIB_customEvents_juliss');
            if (savedEvents && customEvents.length === 0) {
                try { customEvents = JSON.parse(savedEvents); } catch(e) {}
            }

            // Helper: chain an event starting exactly at cursor
            function chain(id, title, subtitle, duration, type, icon, editable) {
                const startTime = cursor;
                const endTime = addMinutes(startTime, duration);
                events.push({ id, title, subtitle, startTime, endTime, type, icon, editable });
                cursor = endTime;
                return endTime;
            }

            // Helper: insert a fixed-time event (school, etc.) and reset cursor
            function fixed(id, title, subtitle, start, end, type, icon) {
                events.push({ id, title, subtitle, startTime: start, endTime: end, type, icon, editable: false });
                cursor = end; // cursor advances to end of fixed block
            }

            // Subjects sorted weakest → strongest
            const allSubj = [...subjects, ...optionalSubjects].sort((a, b) => a.grade - b.grade);

            // Check if a custom override exists for an event id on this day
            function getCustomOverride(id) {
                return customEvents.find(e => e.replacesId === id && e.day === dayIndex);
            }
            function getDuration(id, defaultDur) {
                const ov = getCustomOverride(id);
                if (ov) return timeToMinutes(ov.endTime) - timeToMinutes(ov.startTime);
                return defaultDur;
            }

            // ── RÉVEIL (toujours premier, non chainé) ──
            events.push({ id: 'wakeup', title: 'Réveil', subtitle: '', startTime: wakeupTime, endTime: addMinutes(wakeupTime, 10), type: 'wakeup', icon: '🌅', editable: false });
            cursor = addMinutes(wakeupTime, 10);

            // ── PETIT-DÉJEUNER ──
            chain('breakfast', 'Petit-déjeuner', '', getDuration('breakfast', 30), 'meal', '🥐', true);

            if (isSunday) {
                chain('prep', 'Préparation', '', getDuration('prep', 30), 'prep', '🚿', true);
                const s1 = allSubj[0];
                if (s1) chain('study1', 'Révisions ' + s1.name, s1.level + ' · ' + s1.grade + '/7', getDuration('study1', s1.level === 'HL' ? 90 : 60), getStudyColor(s1.grade), s1.icon, true);
                chain('lunch', 'Déjeuner', '', getDuration('lunch', 60), 'meal', '🍽️', true);
                const s2 = allSubj[1];
                if (s2) chain('study2', 'Révisions ' + s2.name, s2.level + ' · ' + s2.grade + '/7', getDuration('study2', s2.level === 'HL' ? 90 : 60), getStudyColor(s2.grade), s2.icon, true);
                // Free time until 19:00
                const freeMins = Math.max(0, 19 * 60 - timeToMinutes(cursor));
                if (freeMins > 0) chain('freetime', 'Temps libre', '', freeMins, 'free', '🎮', true);
                chain('dinner', 'Dîner', '', getDuration('dinner', 45), 'meal', '🍝', true);
                const phoneTime = phoneDays.includes(dayIndex) ? (samePhoneDuration ? phoneDuration : phoneDayDurations[dayIndex] || 60) : 0;
                if (phoneTime > 0) chain('phone', 'Téléphone', formatDuration(phoneTime), phoneTime, 'phone', '📱', true);

            } else if (isSaturday) {
                const commuteToSchool = (carToSchool || motoToSchool || 30);
                const commuteFromSchool = (carFromSchool || motoFromSchool || 40);
                chain('prep', 'Préparation', '', getDuration('prep', 30), 'prep', '🚿', true);
                chain('commute1', 'Trajet école', commuteToSchool + ' min', getDuration('commute1', commuteToSchool), 'transport', '🚗', true);
                // Cours ECO fixe
                fixed('eco', "Cours d'Économie", '8h30 → 10h30', '08:30', '10:30', 'school', '💹');
                chain('commute2', 'Trajet maison', commuteFromSchool + ' min', getDuration('commute2', commuteFromSchool), 'transport', '🚗', true);
                const s1 = allSubj[0];
                if (s1) chain('study1', 'Révisions ' + s1.name, s1.level + ' · ' + s1.grade + '/7', getDuration('study1', s1.level === 'HL' ? 90 : 60), getStudyColor(s1.grade), s1.icon, true);
                chain('lunch', 'Déjeuner', '', getDuration('lunch', 60), 'meal', '🍽️', true);
                const s2 = allSubj[1];
                if (s2) chain('study2', 'Révisions ' + s2.name, s2.level + ' · ' + s2.grade + '/7', getDuration('study2', s2.level === 'HL' ? 90 : 60), getStudyColor(s2.grade), s2.icon, true);
                const freeMins = Math.max(0, 19 * 60 - timeToMinutes(cursor));
                if (freeMins > 0) chain('freetime', 'Temps libre', '', freeMins, 'free', '🎮', true);
                chain('dinner', 'Dîner', '', getDuration('dinner', 45), 'meal', '🍝', true);
                const phoneTime = phoneDays.includes(dayIndex) ? (samePhoneDuration ? phoneDuration : phoneDayDurations[dayIndex] || 60) : 0;
                if (phoneTime > 0) chain('phone', 'Téléphone', formatDuration(phoneTime), phoneTime, 'phone', '📱', true);

            } else {
                // ── SEMAINE Lun-Ven ──
                const commuteToSchool = (carToSchool || motoToSchool || 30);
                const commuteFromSchool = (carFromSchool || motoFromSchool || 40);
                chain('prep', 'Préparation', '', getDuration('prep', 30), 'prep', '🚿', true);
                chain('commute1', 'Trajet école', commuteToSchool + ' min', getDuration('commute1', commuteToSchool), 'transport', '🚗', true);
                // Cours fixes
                fixed('school1', 'Cours', '8h15 → 12h30', '08:15', '12:30', 'school', '🏫');
                fixed('lunch', 'Déjeuner', '', '12:30', '13:30', 'meal', '🍽️');
                fixed('school2', 'Cours', '13h30 → 16h35', '13:30', '16:35', 'school', '🏫');
                // Retour maison (chaîné depuis 16:35)
                chain('commute2', 'Trajet maison', commuteFromSchool + ' min', getDuration('commute2', commuteFromSchool), 'transport', '🚗', true);
                // Révision principale (matière la + faible, tourne chaque jour)
                const mainSubj = allSubj[dayIndex % allSubj.length];
                if (mainSubj) chain('study1', 'Révisions ' + mainSubj.name, mainSubj.level + ' · ' + mainSubj.grade + '/7', getDuration('study1', mainSubj.level === 'HL' ? 90 : 60), getStudyColor(mainSubj.grade), mainSubj.icon, true);
                // Session science si principale n'est pas une science
                const sciNames = ['Mathématiques', 'Physique', 'Chimie', 'Biologie'];
                const sciSubj = allSubj.filter(s => sciNames.some(n => s.name.includes(n)));
                const mainIsSci = mainSubj && sciNames.some(n => mainSubj.name.includes(n));
                if (sciSubj.length > 0 && !mainIsSci) {
                    const exSubj = sciSubj[dayIndex % sciSubj.length];
                    chain('exercises', 'Exercices ' + exSubj.name, exSubj.level + ' · ' + exSubj.grade + '/7', getDuration('exercises', exSubj.level === 'HL' ? 45 : 30), getStudyColor(exSubj.grade), '✏️', true);
                }
                chain('dinner', 'Dîner', '', getDuration('dinner', 45), 'meal', '🍝', true);
                const phoneTime = phoneDays.includes(dayIndex) ? (samePhoneDuration ? phoneDuration : phoneDayDurations[dayIndex] || 60) : 0;
                if (phoneTime > 0) chain('phone', 'Téléphone', formatDuration(phoneTime), Math.min(phoneTime, 60), 'phone', '📱', true);
            }

            // ── ACTIVITÉS EXTRASCOLAIRES (insérées à leur heure configurée) ──
            selectedActivities.forEach(activity => {
                if (activity.days.includes(dayIndex)) {
                    const startTime = activity.sameTime ? activity.startTime : (activity.dayTimes[dayIndex] ? activity.dayTimes[dayIndex].start : '17:00');
                    const endTime = activity.sameTime ? activity.endTime : (activity.dayTimes[dayIndex] ? activity.dayTimes[dayIndex].end : '19:00');
                    events.push({ id: 'activity-' + activity.name, title: activity.name, subtitle: 'Activité', startTime, endTime, type: 'activity', icon: activity.icon, editable: true });
                }
            });

            // ── ÉVÉNEMENTS PERSONNALISÉS (custom events sans replacesId) ──
            customEvents.filter(e => e.day === dayIndex && !e.replacesId).forEach(event => {
                events.push({ id: event.id, title: event.title, subtitle: '', startTime: event.startTime, endTime: event.endTime, type: event.type, icon: event.icon || '📌', editable: true });
            });

            // ── COUCHER (toujours dernier) ──
            events.push({ id: 'sleep', title: 'Coucher', subtitle: '8h de sommeil garanties', startTime: bedtime, endTime: wakeupTime, type: 'sleep', icon: '😴', editable: false });

            // Tri final : wakeup d'abord, sleep en dernier, reste par heure de début
            const wakeupEvt = events.find(e => e.id === 'wakeup');
            const sleepEvt = events.find(e => e.id === 'sleep');
            const middle = events.filter(e => e.id !== 'wakeup' && e.id !== 'sleep').sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

            // RE-CHAIN : chaque activité commence exactement quand la précédente se termine
            // (sauf les fixes : school, eco)
            const FIXED_IDS = new Set(['school1','school2','eco','sleep','wakeup']);
            let runCursor = wakeupEvt ? wakeupEvt.endTime : wakeupTime;
            const reChained = [];
            for (const ev of middle) {
                if (FIXED_IDS.has(ev.id)) {
                    // Fixed block — cursor jumps to its end
                    reChained.push(ev);
                    runCursor = ev.endTime;
                } else {
                    const dur = Math.max(1, timeToMinutes(ev.endTime) - timeToMinutes(ev.startTime));
                    const newStart = runCursor;
                    const newEnd = addMinutes(newStart, dur);
                    reChained.push({ ...ev, startTime: newStart, endTime: newEnd });
                    runCursor = newEnd;
                }
            }

            return wakeupEvt ? [wakeupEvt, ...reChained, sleepEvt] : [...reChained, sleepEvt];
        }
        
        function getEventColor(type) {
            const colors = {
                sleep:    'border-indigo-400 bg-indigo-50',
                school:   'border-blue-400 bg-blue-50',
                study:    'border-orange-400 bg-orange-50',
                critical: 'border-red-500 bg-red-50',
                warning:  'border-amber-400 bg-amber-50',
                activity: 'border-purple-400 bg-purple-50',
                transport:'border-cyan-400 bg-cyan-50',
                meal:     'border-gray-400 bg-gray-50',
                phone:    'border-pink-400 bg-pink-50',
                free:     'border-green-400 bg-green-50',
                prep:     'border-yellow-400 bg-yellow-50',
                wakeup:   'border-amber-400 bg-amber-50'
            };
            return colors[type] || 'border-gray-400 bg-gray-50';
        }
        
        function getNextActivity() {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const today = now.getDay();
            const dayIndex = today === 0 ? 6 : today - 1;
            
            const events = generateDayEvents(dayIndex);
            
            for (let i = 0; i < events.length; i++) {
                const event = events[i];
                const [h, m] = event.startTime.split(':').map(Number);
                const eventMinutes = h * 60 + m;
                if (eventMinutes > currentMinutes) {
                    const diff = eventMinutes - currentMinutes;
                    const hours = Math.floor(diff / 60);
                    const mins = diff % 60;
                    return {
                        ...event,
                        countdown: hours > 0 ? 'Dans ' + hours + 'h ' + mins + 'min' : 'Dans ' + mins + 'min'
                    };
                }
            }
            return null;
        }
        
        function selectDay(index) {
            selectedDay = index;
            renderPlanning();
        }
        
        function initPlanning() {
            // Set greeting with user name
            const greeting = getGreeting();
            document.getElementById('greetingText').textContent = greeting + ', ' + (userName || 'là') + ' ! 👋';
            renderPlanning();
            // Refresh next activity banner every minute
            setInterval(function() {
                const nextActivity = getNextActivity();
                if (nextActivity) {
                    document.getElementById('nextActivityBanner').style.display = 'block';
                    document.getElementById('nextActivityBanner').innerHTML = buildNextActivityHTML(nextActivity);
                } else {
                    document.getElementById('nextActivityBanner').style.display = 'none';
                }
            }, 60000);
        }

        function buildNextActivityHTML(nextActivity) {
            return '<div style="max-width: 56rem; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 0 1rem;">'
                + '<div style="display: flex; align-items: center; gap: 0.75rem;">'
                + '<div style="width: 2.5rem; height: 2.5rem; background: rgba(255,255,255,0.2); border-radius: 0.75rem; display: flex; align-items: center; justify-content: center;"><span style="font-size: 1.25rem;">' + nextActivity.icon + '</span></div>'
                + '<div><p style="font-weight: 600; font-size: 0.95rem;">⏰ Prochaine : ' + nextActivity.title + '</p>'
                + '<p style="font-size: 0.8rem; color: rgba(255,255,255,0.85);">' + nextActivity.startTime + ' → ' + nextActivity.endTime + '</p></div></div>'
                + '<div style="background: rgba(255,255,255,0.2); border-radius: 0.5rem; padding: 0.375rem 0.75rem;"><p style="font-weight: 700; font-size: 0.9rem;">' + nextActivity.countdown + '</p></div>'
                + '</div>';
        }
        
        function renderPlanning() {
            const weekDates = getWeekDates();
            
            // Render day navigation
            let dayNavHtml = '';
            weekDates.forEach(function(day, index) {
                const isSelected = selectedDay === index;
                const bgClass = isSelected ? 'background: #10b981; color: white; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); transform: scale(1.05);' : (day.isToday ? 'background: #d1fae5; color: #047857;' : 'background: #f3f4f6; color: #4b5563;');
                dayNavHtml += '<button onclick="selectDay(' + index + ')" style="display: flex; flex-direction: column; align-items: center; padding: 0.5rem 0.75rem; border-radius: 0.75rem; min-width: 3.5rem; border: none; cursor: pointer; transition: all 0.3s; ' + bgClass + '"><span style="font-size: 0.75rem; font-weight: 500;">' + day.dayName + '</span><span style="font-size: 1.125rem; font-weight: 700;">' + day.dayNumber + '</span></button>';
            });
            document.getElementById('dayNavigation').innerHTML = dayNavHtml;
            
            // Render next activity banner
            const nextActivity = getNextActivity();
            if (nextActivity) {
                document.getElementById('nextActivityBanner').style.display = 'block';
                document.getElementById('nextActivityBanner').innerHTML = buildNextActivityHTML(nextActivity);
            } else {
                document.getElementById('nextActivityBanner').style.display = 'none';
            }
            
            // Render events with chain connectors
            const events = generateDayEvents(selectedDay);
            let eventsHtml = '';
            const borderColorMap = { indigo:'#818cf8', blue:'#60a5fa', orange:'#fb923c', red:'#ef4444', amber:'#f59e0b', purple:'#a78bfa', cyan:'#22d3ee', gray:'#9ca3af', pink:'#f472b6', green:'#4ade80', yellow:'#facc15' };
            const bgColorMap = { indigo:'#eef2ff', blue:'#eff6ff', orange:'#fff7ed', red:'#fef2f2', amber:'#fffbeb', purple:'#faf5ff', cyan:'#ecfeff', gray:'#f9fafb', pink:'#fdf2f8', green:'#f0fdf4', yellow:'#fefce8' };

            events.forEach(function(event, idx) {
                const colorClass = getEventColor(event.type);
                const [borderColor, bgColor] = colorClass.split(' ');
                const borderStyle = borderColor.replace('border-','').replace('-400','').replace('-500','');
                const bgStyle = bgColor.replace('bg-','').replace('-50','');
                const bColor = borderColorMap[borderStyle] || '#9ca3af';
                const bBg = bgColorMap[bgStyle] || '#f9fafb';

                // Duration label
                const durMins = timeToMinutes(event.endTime) - timeToMinutes(event.startTime);
                const durH = Math.floor(durMins / 60), durM = durMins % 60;
                const durLabel = durMins > 0 ? (durH > 0 ? durH + 'h' : '') + (durM > 0 ? durM + 'min' : '') : '';

                // Chain connector between events (tiny line)
                const isLast = idx === events.length - 1;
                const chainLine = (!isLast && event.id !== 'sleep') ?
                    '<div style="display:flex;align-items:center;gap:0.5rem;padding:0 1rem;margin:-0.25rem 0;"><div style="width:3rem;flex-shrink:0;"></div><div style="width:2px;height:0.625rem;background:linear-gradient(to bottom,'+bColor+',#e5e7eb);margin-left:1.375rem;opacity:0.5;border-radius:1px;"></div></div>'
                    : '';

                eventsHtml += '<div onclick="' + (event.editable ? 'openEditModal(\'' + event.id + '\',\'' + event.title.replace(/'/g,'\\\'') + '\',\'' + event.startTime + '\',\'' + event.endTime + '\',\'' + event.type + '\')' : '') + '" style="display:flex;align-items:center;gap:0.875rem;padding:0.875rem 1rem;background:'+bBg+';border-radius:0.875rem;border-left:4px solid '+bColor+';box-shadow:0 1px 4px rgba(0,0,0,0.08);cursor:'+(event.editable?'pointer':'default')+';transition:all 0.2s;margin-bottom:0.5rem;" '+(event.editable?'onmouseover="this.style.transform=\'translateX(2px)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,0.12)\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'0 1px 4px rgba(0,0,0,0.08)\'"':'')+'>'+
                    '<div style="width:2.75rem;height:2.75rem;background:white;border-radius:0.75rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.08);border:1.5px solid #f3f4f6;"><span style="font-size:1.375rem;">'+event.icon+'</span></div>'+
                    '<div style="flex:1;min-width:0;">'+
                        '<h3 style="font-weight:700;color:#111827;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+event.title+'</h3>'+
                        (event.subtitle ? '<p style="font-size:0.75rem;color:#6b7280;margin-top:0.1rem;">'+event.subtitle+'</p>' : '')+
                    '</div>'+
                    '<div style="text-align:right;flex-shrink:0;">'+
                        '<p style="font-size:0.85rem;font-weight:700;color:#374151;">'+event.startTime+'</p>'+
                        '<p style="font-size:0.7rem;color:#9ca3af;">→ '+event.endTime+'</p>'+
                        (durLabel ? '<p style="font-size:0.68rem;color:'+bColor+';font-weight:600;margin-top:0.1rem;">'+durLabel+'</p>' : '')+
                    '</div>'+
                    (event.editable ? '<div style="color:#d1d5db;flex-shrink:0;margin-left:0.25rem;"><span style="font-size:0.8rem;">✏️</span></div>' : '')+
                '</div>' + chainLine;
            });
            document.getElementById('eventsContainer').innerHTML = eventsHtml;
            
            // Update stats
            document.getElementById('statScore').textContent = targetScore;
            document.getElementById('statSubjects').textContent = subjects.length + optionalSubjects.length;
            document.getElementById('statActivities').textContent = selectedActivities.length;
        }
        
        function openAddModal() {
            const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
            document.getElementById('addModalDayLabel').textContent = dayNames[selectedDay];
            resetAddWorkflow();
            document.getElementById('addEventModal').style.display = 'flex';
        }
        
        function closeAddModal() {
            document.getElementById('addEventModal').style.display = 'none';
            resetAddWorkflow();
        }

        // ── ADD MODAL WORKFLOW ──────────────────────────────────────────
        let newEventStudyType = 'revision';
        let newEventSelectedSubject = null;
        let newActivityIcon = '✨';

        function resetAddWorkflow() {
            newEventStudyType = 'revision';
            newEventSelectedSubject = null;
            newActivityIcon = '✨';
            document.getElementById('addStep1').style.display = 'block';
            document.getElementById('addStep2Matiere').style.display = 'none';
            document.getElementById('addStep2Activite').style.display = 'none';
        }

        function backToStep1() {
            document.getElementById('addStep1').style.display = 'block';
            document.getElementById('addStep2Matiere').style.display = 'none';
            document.getElementById('addStep2Activite').style.display = 'none';
        }

        function selectAddType(type) {
            document.getElementById('addStep1').style.display = 'none';
            if (type === 'matiere') {
                document.getElementById('addStep2Matiere').style.display = 'block';
                buildSubjectPicker();
            } else {
                document.getElementById('addStep2Activite').style.display = 'block';
                document.getElementById('activityNameInput').value = '';
                document.getElementById('activityIconPreview').textContent = '✨';
                newActivityIcon = '✨';
                // Pre-fill suggested start time
                const suggested = getSuggestedStartTime();
                document.getElementById('activityStartInput').value = suggested;
                document.getElementById('activityEndInput').value = addMinutes(suggested, 60);
            }
        }

        function getSuggestedStartTime() {
            const dayEvents = generateDayEvents(selectedDay);
            const lastNonSleep = dayEvents.filter(e => e.id !== 'sleep').pop();
            return lastNonSleep ? lastNonSleep.endTime : (selectedDay < 5 ? '17:00' : '10:00');
        }

        function buildSubjectPicker() {
            const allSubj = [...subjects, ...optionalSubjects];
            // Sort by grade ascending (weakest first = highest priority)
            const sorted = [...allSubj].sort((a, b) => a.grade - b.grade);
            const suggested = getSuggestedStartTime();

            let html = '';
            sorted.forEach((s, i) => {
                const gradeColor = s.grade <= 2 ? '#dc2626' : s.grade <= 4 ? '#d97706' : '#059669';
                const gradeBg = s.grade <= 2 ? '#fef2f2' : s.grade <= 4 ? '#fff7ed' : '#ecfdf5';
                const gradeBorder = s.grade <= 2 ? '#fecaca' : s.grade <= 4 ? '#fed7aa' : '#a7f3d0';
                const priorityBadge = i === 0 ? '<span style="font-size: 0.7rem; background: #fef2f2; color: #dc2626; border-radius: 9999px; padding: 0.2rem 0.5rem; margin-left: 0.5rem;">🔥 Prioritaire</span>' : '';
                html += '<button onclick="pickSubject(' + i + ')" data-subj-idx="' + i + '" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: ' + gradeBg + '; border: 2px solid ' + gradeBorder + '; border-radius: 0.75rem; cursor: pointer; text-align: left; width: 100%; transition: all 0.2s;">'
                    + '<div style="display: flex; align-items: center; gap: 0.75rem;">'
                    + '<span style="font-size: 1.5rem;">' + s.icon + '</span>'
                    + '<div>'
                    + '<span style="font-weight: 600; color: #111827; font-size: 0.9rem;">' + s.name + '</span>' + priorityBadge
                    + '<div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.1rem;">' + s.level + '</div>'
                    + '</div></div>'
                    + '<div style="text-align: right;"><span style="font-size: 1.125rem; font-weight: 700; color: ' + gradeColor + ';">' + s.grade + '/7</span></div>'
                    + '</button>';
            });
            document.getElementById('subjectPickerGrid').innerHTML = html;
            // Store sorted list reference
            document.getElementById('subjectPickerGrid').dataset.sorted = JSON.stringify(sorted.map(s => s.name));
        }

        function pickSubject(idx) {
            const allSubj = [...subjects, ...optionalSubjects];
            const sorted = [...allSubj].sort((a, b) => a.grade - b.grade);
            newEventSelectedSubject = sorted[idx];

            // Highlight selected
            document.querySelectorAll('#subjectPickerGrid button').forEach((btn, i) => {
                btn.style.outline = i === idx ? '3px solid #10b981' : 'none';
            });

            // Show study type + time rows
            document.getElementById('studyTypeRow').style.display = 'block';
            document.getElementById('studyTimeRow').style.display = 'block';
            document.getElementById('btnConfirmStudy').style.display = 'block';

            // Pre-fill times
            const suggested = getSuggestedStartTime();
            const dur = newEventSelectedSubject.level === 'HL' ? 90 : 60;
            document.getElementById('studyStartInput').value = suggested;
            document.getElementById('studyEndInput').value = addMinutes(suggested, dur);
            setStudyType('revision');
        }

        function setStudyType(type) {
            newEventStudyType = type;
            const btnRev = document.getElementById('btnRevision');
            const btnEx = document.getElementById('btnExercices');
            if (type === 'revision') {
                btnRev.style.border = '2px solid #fb923c'; btnRev.style.background = '#fff7ed'; btnRev.style.color = '#c2410c';
                btnEx.style.border = '2px solid #e5e7eb'; btnEx.style.background = 'white'; btnEx.style.color = '#374151';
            } else {
                btnEx.style.border = '2px solid #3b82f6'; btnEx.style.background = '#eff6ff'; btnEx.style.color = '#1d4ed8';
                btnRev.style.border = '2px solid #e5e7eb'; btnRev.style.background = 'white'; btnRev.style.color = '#374151';
            }
        }

        function pickActivityPreset(name, icon) {
            document.getElementById('activityNameInput').value = name;
            document.getElementById('activityIconPreview').textContent = icon;
            newActivityIcon = icon;
            // Highlight selected preset
            document.querySelectorAll('.preset-act-btn').forEach(btn => {
                btn.style.background = btn.textContent.includes(name) ? '#f0fdf4' : 'white';
                btn.style.borderColor = btn.textContent.includes(name) ? '#6ee7b7' : '#e5e7eb';
            });
        }

        function confirmAddStudy() {
            if (!newEventSelectedSubject) return;
            const startTime = document.getElementById('studyStartInput').value;
            const endTime = document.getElementById('studyEndInput').value;
            const errEl = document.getElementById('studyTimeError');

            const validation = validateNewEventTime(startTime, endTime, selectedDay);
            if (!validation.valid) {
                errEl.textContent = validation.error;
                errEl.style.display = 'block';
                return;
            }
            errEl.style.display = 'none';

            const icon = newEventStudyType === 'revision' ? newEventSelectedSubject.icon : '✏️';
            const title = (newEventStudyType === 'revision' ? 'Révision ' : 'Exercices ') + newEventSelectedSubject.name;
            
            customEvents.push({
                id: generateEventId('study', title, selectedDay),
                day: selectedDay,
                title: title,
                startTime: startTime,
                endTime: endTime,
                type: 'study',
                icon: icon,
                subjectGrade: newEventSelectedSubject.grade,
                source: 'custom',
                timestamp: Date.now()
            });
            localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(customEvents));
            closeAddModal();
            renderPlanning();
        }

        function confirmAddActivity() {
            const name = document.getElementById('activityNameInput').value.trim();
            const icon = newActivityIcon;
            const startTime = document.getElementById('activityStartInput').value;
            const endTime = document.getElementById('activityEndInput').value;
            const errEl = document.getElementById('activityTimeError');

            if (!name) {
                errEl.textContent = 'Merci d\'entrer un nom d\'activité.';
                errEl.style.display = 'block';
                return;
            }
            const validation = validateNewEventTime(startTime, endTime, selectedDay);
            if (!validation.valid) {
                errEl.textContent = validation.error;
                errEl.style.display = 'block';
                return;
            }
            errEl.style.display = 'none';

            customEvents.push({
                id: generateEventId('activity', name, selectedDay),
                day: selectedDay,
                title: name,
                startTime: startTime,
                endTime: endTime,
                type: 'activity',
                icon: icon,
                source: 'custom',
                timestamp: Date.now()
            });
            localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(customEvents));
            closeAddModal();
            renderPlanning();
        }

        // ── HELPERS ─────────────────────────────────────────────────────
        function generateEventId(type, title, dayIndex) {
            return type + '-' + title.toLowerCase().replace(/\s+/g, '-') + '-' + dayIndex + '-' + Date.now();
        }

        function validateNewEventTime(startTime, endTime, dayIndex) {
            const startMins = timeToMinutes(startTime);
            const endMins = timeToMinutes(endTime);
            if (endMins <= startMins) return { valid: false, error: "L'heure de fin doit être après l'heure de début" };
            if (dayIndex < 5) {
                if ((startMins >= 480 && startMins < 750) || (endMins > 480 && endMins <= 750))
                    return { valid: false, error: "⏰ Impossible pendant les cours du matin (8h00-12h30)" };
                if ((startMins >= 810 && startMins < 995) || (endMins > 810 && endMins <= 995))
                    return { valid: false, error: "⏰ Impossible pendant les cours de l'après-midi (13h30-16h35)" };
                // Saturday ECO 8:30-10:30
                if (dayIndex === 5 && ((startMins >= 510 && startMins < 630) || (endMins > 510 && endMins <= 630)))
                    return { valid: false, error: "⏰ Impossible pendant le cours d'ECO du samedi (8h30-10h30)" };
            }
            return { valid: true, error: '' };
        }

        function timeToMinutes(time) {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m;
        }

        // Legacy stubs kept for backward compat
        function addStudyEvent() { selectAddType('matiere'); }
        function addActivityEvent() { selectAddType('activite'); }
        
        function saveEditedEventWithCheck() {
            if (!editingEvent) return;
            
            const newTitle = document.getElementById('editEventTitle').value;
            const newStart = document.getElementById('editEventStart').value;
            const newEnd = document.getElementById('editEventEnd').value;
            
            // Validate time
            const validation = validateNewEventTime(newStart, newEnd, selectedDay);
            if (!validation.valid) {
                alert(validation.error);
                return;
            }
            
            // Check if this is an existing custom event (update in place)
            const existingIndex = customEvents.findIndex(e => e.id === editingEvent.id);
            
            if (existingIndex !== -1) {
                // UPDATE IN PLACE - no duplicate
                customEvents[existingIndex] = {
                    ...customEvents[existingIndex],
                    title: newTitle,
                    startTime: newStart,
                    endTime: newEnd,
                    timestamp: Date.now()
                };
            } else {
                // This is a generated event being modified - create new custom event
                customEvents.push({
                    id: generateEventId(editingEvent.type, newTitle, selectedDay),
                    day: selectedDay,
                    title: newTitle,
                    startTime: newStart,
                    endTime: newEnd,
                    type: editingEvent.type,
                    icon: '📝',
                    source: 'custom',
                    replacesId: editingEvent.id,
                    timestamp: Date.now()
                });
            }
            
            // Save silently - no notification
            localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(customEvents));
            closeEditModal();
            renderPlanning();
        }
        
        function openEditModal(id, title, startTime, endTime, type) {
            editingEvent = { id: id, title: title, startTime: startTime, endTime: endTime, type: type };
            document.getElementById('editEventTitle').value = title;
            document.getElementById('editEventStart').value = startTime;
            document.getElementById('editEventEnd').value = endTime;
            document.getElementById('editEventModal').style.display = 'flex';
        }
        
        function closeEditModal() {
            document.getElementById('editEventModal').style.display = 'none';
            editingEvent = null;
        }
        
        function saveEditedEvent() {
            if (editingEvent) {
                const newTitle = document.getElementById('editEventTitle').value;
                const newStart = document.getElementById('editEventStart').value;
                const newEnd = document.getElementById('editEventEnd').value;
                
                customEvents = customEvents.map(function(e) {
                    if (e.id === editingEvent.id) {
                        return { ...e, title: newTitle, startTime: newStart, endTime: newEnd };
                    }
                    return e;
                });
                // Save silently to localStorage - no notification
                localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(customEvents));
                closeEditModal();
                renderPlanning(); // Planning updates silently
            }
        }
        
        function deleteEditedEvent() {
            if (editingEvent) {
                customEvents = customEvents.filter(function(e) { return e.id !== editingEvent.id; });
                // Save silently to localStorage - no notification
                localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(customEvents));
                closeEditModal();
                renderPlanning(); // Planning updates silently
            }
        }
        
        function goBackFromPlanning() {
            document.getElementById('planningModal').classList.remove('active');
            document.getElementById('screenTimeModal').classList.add('active');
        }

        function goBackToActivities() {
            document.getElementById('screenTimeModal').classList.remove('active');
            document.getElementById('activitiesModal').classList.add('active');
        }
 
