/* ============================================================
   PAGE Temps libre
   Après le temps d'écran, avant les jours fériés.
   L'élève choisit la durée de chaque jour. Maximum 3 h.
   Vue : pages/onboarding-libre.html
   ============================================================ */

let sameFreeTime = true;
let freeTimeMinutes = 60;
let freeTimeByDay = { 0: 60, 1: 60, 2: 60, 3: 60, 4: 60, 5: 60, 6: 60 };
const FREE_MAX_MINUTES = 180;
const FREE_STEP_MINUTES = 30;

function freeMinutesForDay(dayIndex) {
    const same = typeof sameFreeTime === 'undefined' ? true : sameFreeTime;
    const raw = same
        ? freeTimeMinutes
        : (freeTimeByDay[dayIndex] != null ? freeTimeByDay[dayIndex] : freeTimeByDay[String(dayIndex)]);
    const n = Number(raw);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.min(FREE_MAX_MINUTES, Math.round(n));
}

function showFreeTimeError(message) {
    const el = document.getElementById('freeTimeError');
    if (!el) return;
    el.style.display = message ? 'block' : 'none';
    el.textContent = message || '';
}

function setSameFreeTime(checked) {
    sameFreeTime = !!checked;
    if (sameFreeTime) {
        for (let i = 0; i < 7; i++) freeTimeByDay[i] = freeTimeMinutes;
    }
    showFreeTimeError('');
    renderFreeTime();
}

function clampFreeMinutes(next) {
    if (next > FREE_MAX_MINUTES) {
        showFreeTimeError('Le temps libre ne peut pas dépasser 3 h par jour.');
        return FREE_MAX_MINUTES;
    }
    if (next < 0) return 0;
    showFreeTimeError('');
    return next;
}

function adjustFreeTime(dayIndex, delta) {
    if (sameFreeTime || dayIndex == null) {
        freeTimeMinutes = clampFreeMinutes(freeTimeMinutes + delta);
        for (let i = 0; i < 7; i++) freeTimeByDay[i] = freeTimeMinutes;
    } else {
        const current = freeTimeByDay[dayIndex] != null ? freeTimeByDay[dayIndex] : 0;
        freeTimeByDay[dayIndex] = clampFreeMinutes(current + delta);
    }
    renderFreeTime();
}

function freeTimeLabel(mins) {
    if (typeof formatDuration === 'function') return formatDuration(mins);
    if (!mins) return '0 min';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return (h ? h + ' h' : '') + (m ? (h ? ' ' : '') + m + ' min' : '');
}

function freeTimeStepper(dayIndex, mins) {
    const arg = dayIndex == null ? 'null' : String(dayIndex);
    return '<div style="display:flex;align-items:center;justify-content:flex-end;gap:0.45rem;">'
        + '<button type="button" onclick="adjustFreeTime(' + arg + ', -' + FREE_STEP_MINUTES + ')" style="width:2rem;height:2rem;border-radius:0.5rem;border:1.5px solid #bbf7d0;background:white;cursor:pointer;font-weight:700;">−</button>'
        + '<span style="min-width:4.2rem;text-align:center;font-weight:800;color:#047857;">' + freeTimeLabel(mins) + '</span>'
        + '<button type="button" onclick="adjustFreeTime(' + arg + ', ' + FREE_STEP_MINUTES + ')" style="width:2rem;height:2rem;border-radius:0.5rem;border:1.5px solid #bbf7d0;background:white;cursor:pointer;font-weight:700;">+</button>'
        + '</div>';
}

function renderFreeTime() {
    const box = document.getElementById('freeTimeChoices');
    const sameBox = document.getElementById('sameFreeTimeInput');
    if (sameBox) sameBox.checked = !!sameFreeTime;
    if (!box) return;
    const names = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    if (sameFreeTime) {
        box.innerHTML = '<div style="background:white;border:1.5px solid #d1fae5;border-radius:1rem;padding:1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;">'
            + '<div><p style="font-weight:700;color:#064e3b;">Tous les jours</p><p style="font-size:0.78rem;color:#6b7280;margin-top:0.15rem;">De 0 à 3 h</p></div>'
            + freeTimeStepper(null, freeTimeMinutes)
            + '</div>';
        return;
    }
    box.innerHTML = names.map(function (name, i) {
        const mins = freeTimeByDay[i] != null ? freeTimeByDay[i] : 0;
        return '<div style="background:white;border:1.5px solid #e5e7eb;border-radius:0.9rem;padding:0.75rem 0.9rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;margin-bottom:0.45rem;">'
            + '<span style="font-weight:700;color:#111827;">' + name + '</span>'
            + freeTimeStepper(i, mins)
            + '</div>';
    }).join('');
}

function goToFreeTime() {
    const screen = document.getElementById('screenTimeModal');
    const holidays = document.getElementById('holidaysModal');
    if (screen) screen.classList.remove('active');
    if (holidays) holidays.classList.remove('active');
    document.getElementById('freeTimeModal').classList.add('active');
    renderFreeTime();
}

function goBackFromFreeTime() {
    document.getElementById('freeTimeModal').classList.remove('active');
    document.getElementById('screenTimeModal').classList.add('active');
    if (typeof renderScreenTime === 'function') renderScreenTime();
}
