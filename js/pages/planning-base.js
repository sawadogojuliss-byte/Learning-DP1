/* ============================================================
   PAGE Planning — base
   Création du planning, navigation des jours, ajout d'événements. Surchargé par planning-moteur.js et planning-interface.js.
   Vue : pages/planning.html
   ============================================================ */

function generatePlanning() {
    const screen = document.getElementById('screenTimeModal');
    const holidays = document.getElementById('holidaysModal');
    const libre = document.getElementById('freeTimeModal');
    if (screen) screen.classList.remove('active');
    if (holidays) holidays.classList.remove('active');
    if (libre) libre.classList.remove('active');
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
    const bedtime = (typeof bedtimeForDay === 'function') ? bedtimeForDay(dayIndex) : calculateBedtime(wakeupTime);

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
    const allSubj = [...subjects, ...optionalSubjects];

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
        if (!(typeof studentTakesEconomics === 'function' && studentTakesEconomics())) {
            chain('commute1', 'Trajet école', commuteToSchool + ' min', getDuration('commute1', commuteToSchool), 'transport', '🚗', true);
            fixed('eco', "Cours d'Économie", '8h30 → 10h30', '08:30', '10:30', 'school', '💹');
            chain('commute2', 'Trajet maison', commuteFromSchool + ' min', getDuration('commute2', commuteFromSchool), 'transport', '🚗', true);
        }
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
    const sleepLabel = (typeof sleepHoursForDay === 'function' && typeof formatSleepHours === 'function')
        ? formatSleepHours(sleepHoursForDay(dayIndex)) + ' de sommeil'
        : 'Sommeil';
    events.push({ id: 'sleep', title: 'Coucher', subtitle: sleepLabel, startTime: bedtime, endTime: wakeupTime, type: 'sleep', icon: '😴', editable: false });

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
        ia:       'border-rose-400 bg-rose-50',
        memoir:   'border-violet-400 bg-violet-50',
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
    if (typeof boitePublierEmploi === 'function') boitePublierEmploi();
    if (!window.__planningTicker) window.__planningTicker = setInterval(function() {
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
    const sorted = [...allSubj];
    const suggested = getSuggestedStartTime();

    let html = '';
    sorted.forEach((s, i) => {
        const gradeColor = s.grade <= 2 ? '#dc2626' : s.grade <= 4 ? '#d97706' : '#059669';
        const gradeBg = s.grade <= 2 ? '#fef2f2' : s.grade <= 4 ? '#fff7ed' : '#ecfdf5';
        const gradeBorder = s.grade <= 2 ? '#fecaca' : s.grade <= 4 ? '#fed7aa' : '#a7f3d0';
        const priorityBadge = ''
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
    const sorted = [...allSubj];
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
    document.querySelectorAll('.app-panel').forEach(function (el) { el.classList.remove('active'); });
    const libre = document.getElementById('freeTimeModal');
    if (libre) {
        libre.classList.add('active');
        if (typeof renderFreeTime === 'function') renderFreeTime();
        return;
    }
    const screen = document.getElementById('screenTimeModal');
    if (screen) screen.classList.add('active');
}

function goBackToActivities() {
    document.getElementById('screenTimeModal').classList.remove('active');
    document.getElementById('activitiesModal').classList.add('active');
}
 
