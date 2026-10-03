/* ============================================================
   PAGE Jours fériés
   Après le temps d'écran. L'élève peut ne rien choisir.
   Garder le planning, retirer des activités du jour,
   ou laisser le jour entièrement libre.
   Vue : pages/onboarding-feries.html
   ============================================================ */

let holidayDays = [];
let holidayModes = {};
let holidayDropped = {};

function isHoliday(dayIndex) {
    return holidayDays.indexOf(Number(dayIndex)) !== -1;
}

function holidayMode(dayIndex) {
    if (!isHoliday(dayIndex)) return null;
    return holidayModes[dayIndex] || holidayModes[String(dayIndex)] || null;
}

function holidayDroppedIds(dayIndex) {
    const list = holidayDropped[String(dayIndex)] || holidayDropped[dayIndex] || [];
    return Array.isArray(list) ? list : [];
}

function goToHolidays() {
    const screen = document.getElementById('screenTimeModal');
    const activities = document.getElementById('activitiesModal');
    const libre = document.getElementById('freeTimeModal');
    if (screen) screen.classList.remove('active');
    if (activities) activities.classList.remove('active');
    if (libre) libre.classList.remove('active');
    document.getElementById('holidaysModal').classList.add('active');
    renderHolidays();
}

function goBackFromHolidays() {
    document.getElementById('holidaysModal').classList.remove('active');
    const libre = document.getElementById('freeTimeModal');
    if (libre) {
        libre.classList.add('active');
        if (typeof renderFreeTime === 'function') renderFreeTime();
        return;
    }
    document.getElementById('screenTimeModal').classList.add('active');
    if (typeof renderScreenTime === 'function') renderScreenTime();
}

function toggleHolidayDay(dayIndex) {
    dayIndex = Number(dayIndex);
    if (isHoliday(dayIndex)) {
        holidayDays = holidayDays.filter(function (d) { return d !== dayIndex; });
        delete holidayModes[dayIndex];
        delete holidayModes[String(dayIndex)];
        delete holidayDropped[dayIndex];
        delete holidayDropped[String(dayIndex)];
    } else {
        holidayDays.push(dayIndex);
    }
    renderHolidays();
}

function setHolidayMode(dayIndex, mode) {
    holidayModes[String(dayIndex)] = mode;
    renderHolidays();
}

function toggleHolidayDrop(dayIndex, id) {
    const key = String(dayIndex);
    const list = holidayDroppedIds(dayIndex).slice();
    const at = list.indexOf(id);
    if (at === -1) list.push(id);
    else list.splice(at, 1);
    holidayDropped[key] = list;
    renderHolidays();
}

function holidayEscape(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function holidayJs(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
}

function renderHolidays() {
    const names = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const full = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    const grid = document.getElementById('holidayDaysGrid');
    if (!grid) return;
    grid.innerHTML = names.map(function (name, i) {
        const on = isHoliday(i);
        return '<button type="button" onclick="toggleHolidayDay(' + i + ')" style="width: 2.75rem; height: 2.75rem; border-radius: 50%; border: none; cursor: pointer; font-weight: 700; font-size: 0.8rem; background: ' + (on ? '#10b981' : '#f3f4f6') + '; color: ' + (on ? 'white' : '#4b5563') + ';">' + name + '</button>';
    }).join('');

    const box = document.getElementById('holidayModes');
    const btn = document.getElementById('holidayContinueBtn');
    if (!holidayDays.length) {
        if (box) box.innerHTML = '<p style="margin:0;text-align:center;color:#6b7280;font-size:0.9rem;">Aucun jour férié cette semaine. Tu peux passer.</p>';
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Passer →'; }
        return;
    }

    const choices = [
        ['keep', '📅', 'Garder mon emploi du temps', 'Cours, révisions et activités restent comme prévus.'],
        ['light', '🌿', 'Diminuer les activités', 'Tu vois les activités prévues ce jour. Décoche celles que tu ne veux pas.'],
        ['free', '🎮', 'Temps libre toute la journée', 'Rien ne sera prévu dans votre emploi du temps.']
    ];
    const sorted = holidayDays.slice().sort(function (a, b) { return a - b; });
    const missing = sorted.some(function (day) { return !holidayMode(day); });
    if (btn) {
        btn.disabled = missing;
        btn.style.opacity = missing ? '0.55' : '1';
        btn.textContent = 'Générer mon planning →';
    }
    box.innerHTML = (missing ? '<p style="text-align:center;color:#6b7280;font-size:0.85rem;margin-bottom:0.8rem;">Choisis une option pour chaque jour férié.</p>' : '') + sorted.map(function (day) {
        const current = holidayMode(day);
        const cards = choices.map(function (choice) {
            const selected = current === choice[0];
            return '<button type="button" onclick="setHolidayMode(' + day + ', \'' + choice[0] + '\')" style="width: 100%; text-align: left; padding: 0.8rem 0.9rem; border-radius: 0.9rem; cursor: pointer; border: 2px solid ' + (selected ? '#10b981' : '#e5e7eb') + '; background: ' + (selected ? '#ecfdf5' : 'white') + ';"><div style="font-weight: 700; color: #111827; font-size: 0.9rem;">' + choice[1] + ' ' + choice[2] + '</div><div style="font-size: 0.78rem; color: #6b7280; margin-top: 0.2rem; line-height: 1.4;">' + choice[3] + '</div></button>';
        }).join('');
        return '<div style="margin-bottom: 1.25rem;"><p style="font-weight: 800; color: #064e3b; margin-bottom: 0.5rem;">Que faire le ' + full[day] + ' ?</p><div style="display: flex; flex-direction: column; gap: 0.5rem;">' + cards + '</div>' + (current === 'light' ? holidayDropList(day, full[day]) : '') + '</div>';
    }).join('');
}

function holidayDropList(day, dayName) {
    let events = [];
    try {
        events = (typeof normalDayEvents === 'function' ? normalDayEvents(day) : []).filter(function (ev) {
            return ev && ev.id !== 'wakeup' && ev.id !== 'sleep' && !ev.hidden;
        });
    } catch (e) {
        events = [];
    }
    if (!events.length) {
        return '<p style="margin-top:0.75rem;color:#6b7280;font-size:0.85rem;">Aucune activité prévue le ' + dayName + '.</p>';
    }
    const dropped = holidayDroppedIds(day);
    const rows = events.map(function (ev) {
        const off = dropped.indexOf(ev.id) !== -1;
        return '<label style="display:flex;align-items:center;gap:0.65rem;padding:0.6rem 0.75rem;border:1px solid ' + (off ? '#fecaca' : '#e5e7eb') + ';border-radius:0.75rem;background:' + (off ? '#fef2f2' : 'white') + ';cursor:pointer;">'
            + '<input type="checkbox"' + (off ? '' : ' checked') + ' onchange="toggleHolidayDrop(' + day + ', \'' + holidayJs(ev.id) + '\')" style="width:1.05rem;height:1.05rem;">'
            + '<span style="font-size:1rem;">' + holidayEscape(ev.icon || '•') + '</span>'
            + '<span style="flex:1;font-size:0.85rem;font-weight:600;color:#111827;">' + holidayEscape(ev.title) + '</span>'
            + '<span style="font-size:0.75rem;color:#6b7280;white-space:nowrap;">' + holidayEscape(ev.startTime) + ' → ' + holidayEscape(ev.endTime) + '</span>'
            + '</label>';
    }).join('');
    return '<div style="margin-top:0.75rem;"><p style="font-size:0.82rem;font-weight:700;color:#374151;margin-bottom:0.45rem;">Activités prévues le ' + dayName + '. Décoche celles que tu retires.</p><div style="display:flex;flex-direction:column;gap:0.4rem;">' + rows + '</div></div>';
}
