/* ============================================================
   PAGE Planning — édition (première couche)
   Durée, heures et cascade. La version active est dans planning-interface.js.
   Vue : pages/planning.html
   ============================================================ */

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
