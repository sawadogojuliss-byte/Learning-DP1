/* ============================================================
   PAGE Sommeil
   Réveil et durée choisie par l'élève (minimum 5 h).
   Vue : pages/onboarding-sommeil.html
   ============================================================ */

function showSleepPage() {
    ['objectivesModal', 'subjectsModal', 'classeModal'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
    document.getElementById('sleepModal').classList.add('active');
    updateBedtimes();
}

function hideSleepPage() {
    document.getElementById('sleepModal').classList.remove('active');
    document.getElementById('subjectsModal').classList.add('active');
    if (typeof updateSubjectsUI === 'function') updateSubjectsUI();
}

let weekdayWakeup = '06:00';
let saturdayWakeup = '07:00';
let sundayWakeup = '08:00';
let weekdaySleepHours = 8;
let saturdaySleepHours = 8;
let sundaySleepHours = 8;
const SLEEP_MIN_HOURS = 5;
const SLEEP_MAX_HOURS = 16;

function sleepMins(value) {
    const parts = String(value || '00:00').split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function minsToClock(mins) {
    mins = ((Math.round(mins) % 1440) + 1440) % 1440;
    return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
}

function sleepHoursOf(which) {
    if (which === 'saturday') return saturdaySleepHours;
    if (which === 'sunday') return sundaySleepHours;
    return weekdaySleepHours;
}

function wakeupOf(which) {
    if (which === 'saturday') return saturdayWakeup;
    if (which === 'sunday') return sundayWakeup;
    return weekdayWakeup;
}

function setSleepHours(which, hours) {
    let h = Number(hours);
    if (!isFinite(h)) h = 8;
    h = Math.max(SLEEP_MIN_HOURS, Math.min(SLEEP_MAX_HOURS, h));
    h = Math.round(h * 60) / 60;
    if (which === 'saturday') saturdaySleepHours = h;
    else if (which === 'sunday') sundaySleepHours = h;
    else weekdaySleepHours = h;
    return h;
}

function sleepHoursForDay(dayIndex) {
    if (dayIndex === 5) return saturdaySleepHours;
    if (dayIndex === 6) return sundaySleepHours;
    return weekdaySleepHours;
}

function calculateBedtime(wakeup, hours) {
    const h = hours == null ? (wakeup === sundayWakeup ? sundaySleepHours : wakeup === saturdayWakeup ? saturdaySleepHours : weekdaySleepHours) : Number(hours);
    const safe = Math.max(SLEEP_MIN_HOURS, isFinite(h) ? h : 8);
    return minsToClock(sleepMins(wakeup) - safe * 60);
}

function bedtimeForDay(dayIndex) {
    if (dayIndex === 5) return calculateBedtime(saturdayWakeup, saturdaySleepHours);
    if (dayIndex === 6) return calculateBedtime(sundayWakeup, sundaySleepHours);
    return calculateBedtime(weekdayWakeup, weekdaySleepHours);
}

function formatSleepHours(hours) {
    const total = Math.round(hours * 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m ? h + ' h ' + String(m).padStart(2, '0') : h + ' h';
}

function showSleepError(which, message) {
    const el = document.getElementById(which + 'SleepError');
    if (!el) return;
    el.style.display = message ? 'block' : 'none';
    el.textContent = message || '';
}

function adjustSleepHours(which, delta) {
    const current = sleepHoursOf(which);
    const next = current + delta;
    if (next < SLEEP_MIN_HOURS) {
        setSleepHours(which, SLEEP_MIN_HOURS);
        showSleepError(which, current <= SLEEP_MIN_HOURS ? 'Le sommeil ne peut pas être inférieur à 5 h.' : '');
    } else {
        setSleepHours(which, next);
        showSleepError(which, '');
    }
    updateBedtimes();
}

function setBedtimeFromInput(which, value) {
    let diff = sleepMins(wakeupOf(which)) - sleepMins(value);
    if (diff <= 0) diff += 1440;
    const hours = diff / 60;
    if (hours + 0.01 < SLEEP_MIN_HOURS) {
        setSleepHours(which, SLEEP_MIN_HOURS);
        showSleepError(which, 'Le sommeil ne peut pas être inférieur à 5 h. Le coucher a été ajusté.');
    } else if (hours > SLEEP_MAX_HOURS) {
        setSleepHours(which, SLEEP_MAX_HOURS);
        showSleepError(which, '16 h maximum. Le coucher a été ajusté.');
    } else {
        setSleepHours(which, hours);
        showSleepError(which, '');
    }
    updateBedtimes();
}

function updateBedtimes() {
    const slots = [
        ['weekday', weekdayWakeup, weekdaySleepHours],
        ['saturday', saturdayWakeup, saturdaySleepHours],
        ['sunday', sundayWakeup, sundaySleepHours]
    ];
    slots.forEach(function (slot) {
        const which = slot[0];
        const label = document.getElementById(which + 'SleepLabel');
        const input = document.getElementById(which + 'BedtimeInput');
        if (label) label.textContent = formatSleepHours(slot[2]);
        if (input) input.value = calculateBedtime(slot[1], slot[2]);
    });
}

function validateSleep() {
    ['weekday', 'saturday', 'sunday'].forEach(function (which) {
        if (sleepHoursOf(which) < SLEEP_MIN_HOURS) setSleepHours(which, SLEEP_MIN_HOURS);
    });
    updateBedtimes();
    if (typeof showTransportPage === 'function') showTransportPage();
}
