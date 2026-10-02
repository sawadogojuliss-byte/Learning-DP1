/* ============================================================
   PAGE Temps d'écran
   Durée de téléphone par jour.
   Vue : pages/onboarding-ecran.html
   ============================================================ */

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
