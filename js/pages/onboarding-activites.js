/* ============================================================
   PAGE Activités
   Activités extrascolaires et horaires.
   Vue : pages/onboarding-activites.html
   ============================================================ */

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
    showActivityWarning('⚠️ Tu ne peux pas planifier d\'activités pendant les heures de cours (8h15 - 16h35, lundi au vendredi).');
}

function showActivityWarning(message) {
    const warning = document.getElementById('schoolWarning');
    if (!warning) return;
    const lines = warning.querySelectorAll('p');
    if (lines[0]) lines[0].textContent = message;
    if (lines[1]) lines[1].textContent = 'Deux activités ne peuvent pas occuper le même créneau. Choisis un autre horaire.';
    warning.style.display = 'block';
    clearTimeout(warning._timer);
    warning._timer = setTimeout(function () { warning.style.display = 'none'; }, 4500);
}

function creneauActivite(act, dayIndex) {
    if (!act) return null;
    if (act.sameTime) return { start: act.startTime, end: act.endTime };
    const dt = act.dayTimes && (act.dayTimes[dayIndex] || act.dayTimes[String(dayIndex)]);
    return { start: (dt && dt.start) || act.startTime || '17:00', end: (dt && dt.end) || act.endTime || '19:00' };
}

function messageChevauchementActivite(start, end, dayIndex, exceptName) {
    if (typeof timeToMinutes !== 'function') return '';
    const s = timeToMinutes(start);
    const e = timeToMinutes(end);
    if (!(e > s)) return 'L\'heure de fin doit être après l\'heure de début.';
    const busy = [];
    if (dayIndex < 5) busy.push({ name: 'les cours', start: 8 * 60 + 15, end: 16 * 60 + 35 });
    if (dayIndex === 5 && typeof studentTakesEconomics === 'function' && studentTakesEconomics()) {
        busy.push({ name: 'le cours d\'Économie', start: 8 * 60 + 30, end: 10 * 60 + 30 });
    }
    if (typeof bedtimeForDay === 'function' && typeof weekdayWakeup !== 'undefined') {
        const wakeClock = dayIndex === 5 ? saturdayWakeup : dayIndex === 6 ? sundayWakeup : weekdayWakeup;
        const wake = timeToMinutes(wakeClock);
        let bed = timeToMinutes(bedtimeForDay(dayIndex));
        if (bed <= wake) bed += 1440;
        if (s < wake + 10 || e > bed) {
            return '⚠️ Ce créneau chevauche le sommeil ou le réveil (' + bedtimeForDay(dayIndex) + ' → ' + wakeClock + ').';
        }
    }
    (selectedActivities || []).forEach(function (act) {
        if (!act || act.name === exceptName || !act.days || act.days.indexOf(dayIndex) === -1) return;
        const slot = creneauActivite(act, dayIndex);
        if (!slot || !slot.start || !slot.end) return;
        const os = timeToMinutes(slot.start);
        const oe = timeToMinutes(slot.end);
        if (s < oe && os < e) busy.push({ name: act.name, start: os, end: oe, label: slot.start + ' → ' + slot.end });
    });
    const hit = busy.find(function (b) { return s < b.end && b.start < e; });
    if (!hit) return '';
    return '⚠️ Ce créneau chevauche « ' + hit.name + ' »' + (hit.label ? ' (' + hit.label + ')' : '') + '.';
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
            const slot = creneauActivite(activity, dayIndex) || { start: '17:00', end: '19:00' };
            const conflit = messageChevauchementActivite(slot.start, slot.end, dayIndex, activity.name);
            if (conflit) { showActivityWarning(conflit); return; }
            activity.days.push(dayIndex);
            if (!activity.dayTimes[dayIndex]) {
                activity.dayTimes[dayIndex] = { start: slot.start || '17:00', end: slot.end || '19:00' };
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
    const activity = selectedActivities.find(a => a.name === name);
    if (!activity) return;
    const start = field === 'startTime' ? value : activity.startTime;
    const end = field === 'endTime' ? value : activity.endTime;
    const jours = (days && days.length) ? days : activity.days;
    for (let i = 0; i < jours.length; i++) {
        const conflit = messageChevauchementActivite(start, end, jours[i], name);
        if (conflit) { showActivityWarning(conflit); renderActivities(); return; }
    }
    activity[field] = value;
}

function updateActivityDayTime(name, dayIndex, field, value) {
    const activity = selectedActivities.find(a => a.name === name);
    if (!activity) return;
    const current = activity.dayTimes[dayIndex] || { start: activity.startTime || '17:00', end: activity.endTime || '19:00' };
    const start = field === 'start' ? value : current.start;
    const end = field === 'end' ? value : current.end;
    const conflit = messageChevauchementActivite(start, end, dayIndex, name);
    if (conflit) { showActivityWarning(conflit); renderActivities(); return; }
    if (!activity.dayTimes[dayIndex]) activity.dayTimes[dayIndex] = { start: current.start, end: current.end };
    activity.dayTimes[dayIndex][field] = value;
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
    const holidays = document.getElementById('holidaysModal');
    const libre = document.getElementById('freeTimeModal');
    if (holidays) holidays.classList.remove('active');
    if (libre) libre.classList.remove('active');
    document.getElementById('screenTimeModal').classList.add('active');
    renderScreenTime();
}

function goBackFromActivities() {
    document.getElementById('activitiesModal').classList.remove('active');
    if (typeof transportMode !== 'undefined' && transportMode === 'moto') {
        document.getElementById('motoConfigModal').classList.add('active');
    } else {
        document.getElementById('carConfigModal').classList.add('active');
    }
}
