/* ============================================================
   PAGE Pomodoro
   Minuteur 25/5 et 50/10 pour les sessions d'étude.
   Vue : pages/planning.html
   ============================================================ */

// ═══════════════════════════════════════════════════════════════════
//  1. MÉTHODE POMODORO
// ═══════════════════════════════════════════════════════════════════
const V3_POMO_PRESETS = {
    classic: { key: 'classic', label: '25 / 5', focus: 25, short: 5, long: 15, cycles: 4 },
    long:    { key: 'long',    label: '50 / 15', focus: 50, short: 15, long: 15, cycles: 4 }
};
let v3PomoPresetKey = localStorage.getItem('studyPlanIB_pomodoroPreset') || 'classic';
let v3Pomo = null;          // état du minuteur en cours
let v3PomoTimer = null;     // setInterval
let v3PomoAudio = null;     // AudioContext
const v3OrigTitle = document.title;
let v3LastRendered = [];    // événements affichés (index → événement)

// Découpe une durée en pomodoros : focus de 25 min, pauses de 5 min, pause
// longue toutes les 4 sessions. Le dernier bloc absorbe le reste (< 10 min).
function v3BuildPomodoroPlan(totalMins, preset) {
    const p = preset || V3_POMO_PRESETS[v3PomoPresetKey] || V3_POMO_PRESETS.classic;
    const plan = [];
    let remaining = Math.max(1, Math.round(totalMins)), i = 0;
    while (remaining > 0) {
        i++;
        const f = Math.min(p.focus, remaining);
        plan.push({ type: 'focus', mins: f, n: i });
        remaining -= f;
        if (remaining <= 0) break;
        const isLong = i % p.cycles === 0;
        const breakLen = isLong ? p.long : p.short;
        if (remaining < breakLen) break;
        plan.push({ type: isLong ? 'long' : 'short', mins: breakLen });
        remaining -= breakLen;
    }
    return plan;
}
function v3PomodoroCount(mins) { return v3BuildPomodoroPlan(mins).filter(s => s.type === 'focus').length; }
function v3PomodoroLabel(mins) {
    const n = v3PomodoroCount(mins);
    return '🍅 ' + n + ' pomodoro' + (n > 1 ? 's' : '');
}
function v3PomodoroDetail(mins) {
    const p = V3_POMO_PRESETS[v3PomoPresetKey] || V3_POMO_PRESETS.classic;
    const plan = v3BuildPomodoroPlan(mins, p);
    const focus = plan.filter(s => s.type === 'focus');
    const breaks = plan.length - focus.length;
    return focus.length + ' × ' + p.focus + ' min de focus' + (breaks > 0 ? ' · ' + breaks + ' pause' + (breaks > 1 ? 's' : '') + ' de ' + p.short + ' min' : '') + ' · ' + v3DurLabel(mins) + ' au total';
}

function v3NewPomo(ev, dayIndex) {
    const mins = Math.max(1, timeToMinutes(ev.endTime) - timeToMinutes(ev.startTime));
    const preset = V3_POMO_PRESETS[v3PomoPresetKey] || V3_POMO_PRESETS.classic;
    const plan = v3BuildPomodoroPlan(mins, preset);
    return { key: dayIndex + '|' + ev.id, eventId: ev.id, dayIndex, title: ev.title, icon: ev.icon, range: ev.startTime + ' → ' + ev.endTime,
        totalMins: mins, preset, plan, idx: 0, remainingSec: plan[0].mins * 60, running: false, endsAt: null, finished: false };
}

function v3OpenPomodoro(idx) {
    const ev = v3LastRendered[idx];
    if (ev) v3StartPomodoroFor(ev, selectedDay);
}
function v3OpenPomodoroFromEdit() {
    if (!editingEvent) return;
    const ev = { id: editingEvent.id, title: editingEvent.title, icon: editingEvent.icon || '📚', startTime: editingEvent.startTime, endTime: editingEvent.endTime, type: editingEvent.type };
    closeEditModal();
    v3StartPomodoroFor(ev, selectedDay);
}
function v3StartPomodoroFor(ev, dayIndex) {
    const key = dayIndex + '|' + ev.id;
    if (v3Pomo && v3Pomo.key !== key && v3Pomo.running) {
        if (!confirm('Un Pomodoro est déjà en cours pour « ' + v3Pomo.title + ' ». Le remplacer ?')) return;
    }
    if (!v3Pomo || v3Pomo.key !== key) { v3PomoStopTimer(); v3Pomo = v3NewPomo(ev, dayIndex); }
    v3RenderPomodoro();
    document.getElementById('pomodoroModal').style.display = 'flex';
}
function v3ClosePomodoro() {
    document.getElementById('pomodoroModal').style.display = 'none';
    // le minuteur continue en arrière-plan s'il est lancé
}
function v3PomoSetPreset(key) {
    if (!V3_POMO_PRESETS[key]) return;
    if (v3Pomo && v3Pomo.running && v3Pomo.preset.key !== key) {
        if (!confirm('Changer de rythme relance la session Pomodoro depuis le début. Continuer ?')) return;
    }
    v3PomoPresetKey = key;
    localStorage.setItem('studyPlanIB_pomodoroPreset', key);
    if (v3Pomo) {
        v3PomoStopTimer();
        const fresh = v3NewPomo({ id: v3Pomo.eventId, title: v3Pomo.title, icon: v3Pomo.icon, startTime: '00:00', endTime: v3M2T(v3Pomo.totalMins) }, v3Pomo.dayIndex);
        fresh.range = v3Pomo.range;
        v3Pomo = fresh;
    }
    v3RenderPomodoro();
    v3RefreshPlanningIfOpen();
}
function v3PomoToggle() {
    if (!v3Pomo) return;
    if (v3Pomo.finished) { v3PomoReset(); }
    if (v3Pomo.running) {
        v3Pomo.remainingSec = Math.max(0, Math.round((v3Pomo.endsAt - Date.now()) / 1000));
        v3Pomo.running = false;
        v3PomoStopTimer();
    } else {
        v3Pomo.running = true;
        v3Pomo.endsAt = Date.now() + v3Pomo.remainingSec * 1000;
        v3PomoStartTimer();
        v3PomoAskNotification();
        v3PomoInitAudio();
    }
    v3RenderPomodoro();
    v3RefreshPlanningIfOpen(); // badge 🍅 « en cours » sur la carte
}
function v3RefreshPlanningIfOpen() {
    const pm = document.getElementById('planningModal');
    if (pm && pm.classList.contains('active') && document.getElementById('eventsContainer')) renderPlanning();
}
function v3PomoSkip() {
    if (!v3Pomo || v3Pomo.finished) return;
    v3PomoAdvance(false);
    v3RenderPomodoro();
}
function v3PomoReset() {
    if (!v3Pomo) return;
    v3PomoStopTimer();
    v3Pomo.idx = 0; v3Pomo.remainingSec = v3Pomo.plan[0].mins * 60; v3Pomo.running = false; v3Pomo.finished = false; v3Pomo.endsAt = null;
    v3RenderPomodoro();
}
function v3PomoStartTimer() {
    v3PomoStopTimer();
    v3PomoTimer = setInterval(v3PomoTick, 500);
}
function v3PomoStopTimer() {
    if (v3PomoTimer) { clearInterval(v3PomoTimer); v3PomoTimer = null; }
    document.title = v3OrigTitle;
}
function v3PomoTick() {
    if (!v3Pomo || !v3Pomo.running) { v3PomoStopTimer(); return; }
    const rem = Math.max(0, Math.round((v3Pomo.endsAt - Date.now()) / 1000));
    v3Pomo.remainingSec = rem;
    if (rem <= 0) v3PomoAdvance(true);
    v3RenderPomodoro();
}
// Passe à la phase suivante (auto-enchaînement). `announce` = fin naturelle (son + notif)
function v3PomoAdvance(announce) {
    const done = v3Pomo.plan[v3Pomo.idx];
    v3Pomo.idx++;
    if (v3Pomo.idx >= v3Pomo.plan.length) {
        v3Pomo.finished = true; v3Pomo.running = false; v3Pomo.remainingSec = 0;
        v3PomoStopTimer();
        if (announce) { v3PomoBeep(3); v3PomoNotify('🎉 Session terminée !', 'Bravo, « ' + v3Pomo.title + ' » est bouclée. Prends une vraie pause.'); }
        v3RefreshPlanningIfOpen();
        return;
    }
    const next = v3Pomo.plan[v3Pomo.idx];
    v3Pomo.remainingSec = next.mins * 60;
    if (v3Pomo.running) v3Pomo.endsAt = Date.now() + v3Pomo.remainingSec * 1000;
    if (announce) {
        v3PomoBeep(next.type === 'focus' ? 1 : 2);
        if (next.type === 'focus') v3PomoNotify('🍅 C\'est reparti !', 'Focus ' + next.n + ' — ' + next.mins + ' min sur « ' + v3Pomo.title + ' »');
        else v3PomoNotify(done && done.type === 'focus' ? '☕ Pause bien méritée' : '☕ Pause', (next.type === 'long' ? 'Pause longue' : 'Pause courte') + ' de ' + next.mins + ' min. Lève-toi, bois de l\'eau !');
    }
}
function v3PomoAskNotification() {
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
}
function v3PomoNotify(title, body) {
    try {
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body });
    } catch (e) {}
}
function v3PomoInitAudio() {
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!v3PomoAudio) v3PomoAudio = new AC();
        if (v3PomoAudio.state === 'suspended') v3PomoAudio.resume();
    } catch (e) {}
}
function v3PomoBeep(count) {
    try {
        if (!v3PomoAudio) return;
        const ctx = v3PomoAudio, now = ctx.currentTime;
        for (let i = 0; i < count; i++) {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = 'sine'; osc.frequency.value = i % 2 === 0 ? 880 : 660;
            gain.gain.setValueAtTime(0.0001, now + i * 0.35);
            gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.35 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.35 + 0.3);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now + i * 0.35); osc.stop(now + i * 0.35 + 0.32);
        }
    } catch (e) {}
}
function v3PomoFmt(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
const V3_POMO_TIPS = {
    focus: ['📵 Range ton téléphone et concentre-toi sur une seule tâche.', '✍️ Note les distractions sur un papier, tu les traiteras à la pause.', '🎯 Fixe-toi un mini-objectif pour ce pomodoro (ex. : 5 exercices).'],
    short: ['🚶 Lève-toi, bois de l\'eau, étire-toi — 5 minutes loin de l\'écran.', '👀 Regarde au loin quelques secondes pour reposer tes yeux.'],
    long: ['🧘 Pause longue : marche un peu, respire, tu l\'as méritée.', '🍎 Un petit encas et de l\'eau : ton cerveau en a besoin.'],
    finished: ['🎉 Session terminée ! Note en deux phrases ce que tu as appris.']
};
function v3RenderPomodoro() {
    const modal = document.getElementById('pomodoroModal');
    if (!modal || !v3Pomo) return;
    const p = v3Pomo;
    const phase = p.finished ? null : p.plan[p.idx];
    const kind = p.finished ? 'finished' : phase.type;
    const focusBlocks = p.plan.filter(s => s.type === 'focus');
    const doneFocus = p.plan.slice(0, p.idx).filter(s => s.type === 'focus').length;

    document.getElementById('pomoTitle').textContent = (p.icon ? p.icon + ' ' : '') + p.title + ' · ' + p.range;
    const card = document.getElementById('pomoPhaseCard');
    card.className = 'pomo-phase ' + kind + (p.running ? ' running' : '');
    const labels = { focus: phase ? 'Focus ' + phase.n + '/' + focusBlocks.length : '', short: 'Pause courte ☕', long: 'Pause longue 🌿', finished: 'Session terminée 🎉' };
    document.getElementById('pomoPhase').textContent = labels[kind];
    document.getElementById('pomoTime').textContent = p.finished ? '00:00' : v3PomoFmt(p.remainingSec);
    const total = phase ? phase.mins * 60 : 1;
    document.getElementById('pomoBar').style.width = p.finished ? '100%' : Math.min(100, Math.max(0, 100 * (1 - p.remainingSec / total))) + '%';
    document.getElementById('pomoDots').innerHTML = focusBlocks.map((b, i) => {
        const cls = i < doneFocus || p.finished ? 'done' : (i === doneFocus && kind === 'focus' ? 'current' : '');
        return '<span class="pomo-dot ' + cls + '" title="Pomodoro ' + (i + 1) + ' · ' + b.mins + ' min"></span>';
    }).join('');
    document.getElementById('pomoSummary').textContent = v3PomodoroDetail(p.totalMins);
    document.getElementById('pomoPresetClassic').className = 'pomo-preset' + (p.preset.key === 'classic' ? ' selected' : '');
    document.getElementById('pomoPresetLong').className = 'pomo-preset' + (p.preset.key === 'long' ? ' selected' : '');
    const toggle = document.getElementById('pomoToggleBtn');
    toggle.textContent = p.finished ? '↺ Refaire la session' : (p.running ? '⏸ Pause' : (p.idx === 0 && p.remainingSec === p.plan[0].mins * 60 ? '▶ Démarrer' : '▶ Reprendre'));
    document.getElementById('pomoSkipBtn').disabled = p.finished;
    const tips = V3_POMO_TIPS[kind];
    document.getElementById('pomoTip').textContent = tips[p.idx % tips.length];
    if (p.running && !p.finished) document.title = v3PomoFmt(p.remainingSec) + (kind === 'focus' ? ' 🍅 ' : ' ☕ ') + '· Study Plan IB';
}

// Aperçu Pomodoro dans la fenêtre « Ajouter une matière »
function v3UpdateStudyPomodoroHint() {
    const hint = document.getElementById('studyPomodoroHint');
    if (!hint) return;
    const s = document.getElementById('studyStartInput').value, e = document.getElementById('studyEndInput').value;
    if (!s || !e || timeToMinutes(e) <= timeToMinutes(s)) { hint.style.display = 'none'; return; }
    hint.textContent = '🍅 Méthode Pomodoro : ' + v3PomodoroDetail(timeToMinutes(e) - timeToMinutes(s));
    hint.style.display = 'block';
}
