/* ============================================================
   PAGE Planning — interface
   Affichage, modification fiable, suppression avec annulation, signalement des doublons.
   Vue : pages/planning.html
   ============================================================ */

// ═══════════════════════════════════════════════════════════════════
//  AFFICHAGE DU PLANNING (surcharge de renderPlanning)
//  — identique visuellement, + badge 🍅 sur les sessions d'étude,
//    📌 sur les créneaux fixés, ouverture de l'édition par index
// ═══════════════════════════════════════════════════════════════════
function renderPlanning() {
    const weekDates = getWeekDates();

    let dayNavHtml = '';
    weekDates.forEach(function (day, index) {
        const isSelected = selectedDay === index;
        const bgClass = isSelected ? 'background: #10b981; color: white; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); transform: scale(1.05);' : (day.isToday ? 'background: #d1fae5; color: #047857;' : 'background: #f3f4f6; color: #4b5563;');
        dayNavHtml += '<button onclick="selectDay(' + index + ')" style="display: flex; flex-direction: column; align-items: center; padding: 0.5rem 0.75rem; border-radius: 0.75rem; min-width: 3.5rem; border: none; cursor: pointer; transition: all 0.3s; ' + bgClass + '"><span style="font-size: 0.75rem; font-weight: 500;">' + day.dayName + '</span><span style="font-size: 1.125rem; font-weight: 700;">' + day.dayNumber + '</span></button>';
    });
    document.getElementById('dayNavigation').innerHTML = dayNavHtml;

    const nextActivity = getNextActivity();
    if (nextActivity) {
        document.getElementById('nextActivityBanner').style.display = 'block';
        document.getElementById('nextActivityBanner').innerHTML = buildNextActivityHTML(nextActivity);
    } else {
        document.getElementById('nextActivityBanner').style.display = 'none';
    }

    const events = generateDayEvents(selectedDay);
    v3LastRendered = events;
    const addBtn = document.getElementById('addPlanningBtn');
    if (typeof holidayMode === 'function' && holidayMode(selectedDay) === 'free') {
        if (addBtn) addBtn.style.display = 'none';
        document.getElementById('eventsContainer').innerHTML = v3LibreVertical();
        document.getElementById('statScore').textContent = targetScore;
        document.getElementById('statSubjects').textContent = subjects.length + optionalSubjects.length;
        document.getElementById('statActivities').textContent = selectedActivities.length;
        if (typeof majClasseAffichage === 'function') majClasseAffichage();
        if (typeof eeSuiviPlanning === 'function') eeSuiviPlanning();
        return;
    }
    if (addBtn) addBtn.style.display = 'flex';
    let eventsHtml = '';
    if (typeof holidayMode === 'function' && holidayMode(selectedDay) === 'keep') {
        eventsHtml += '<div style="margin-bottom: 0.75rem; padding: 0.75rem 1rem; border-radius: 0.85rem; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 0.85rem; font-weight: 600;">🎉 Jour férié — emploi du temps conservé</div>';
    } else if (typeof holidayMode === 'function' && holidayMode(selectedDay) === 'light') {
        eventsHtml += '<div style="margin-bottom: 0.75rem; padding: 0.75rem 1rem; border-radius: 0.85rem; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; font-size: 0.85rem; font-weight: 600;">🎉 Jour férié — activités désélectionnées retirées</div>';
    }
    const borderColorMap = { indigo: '#818cf8', blue: '#60a5fa', orange: '#fb923c', red: '#ef4444', amber: '#f59e0b', purple: '#a78bfa', cyan: '#22d3ee', gray: '#9ca3af', pink: '#f472b6', green: '#4ade80', yellow: '#facc15', teal: '#2dd4bf', rose: '#fb7185', violet: '#a78bfa' };
    const bgColorMap = { indigo: '#eef2ff', blue: '#eff6ff', orange: '#fff7ed', red: '#fef2f2', amber: '#fffbeb', purple: '#faf5ff', cyan: '#ecfeff', gray: '#f9fafb', pink: '#fdf2f8', green: '#f0fdf4', yellow: '#fefce8', teal: '#f0fdfa', rose: '#fff1f2', violet: '#f5f3ff' };

    events.forEach(function (event, idx) {
        const colorClass = getEventColor(event.type);
        const [borderColor, bgColor] = colorClass.split(' ');
        const borderStyle = borderColor.replace('border-', '').replace('-400', '').replace('-500', '');
        const bgStyle = bgColor.replace('bg-', '').replace('-50', '');
        const bColor = borderColorMap[borderStyle] || '#9ca3af';
        const bBg = bgColorMap[bgStyle] || '#f9fafb';

        const durMins = timeToMinutes(event.endTime) - timeToMinutes(event.startTime);
        const durH = Math.floor(durMins / 60), durM = durMins % 60;
        const durLabel = durMins > 0 ? (durH > 0 ? durH + 'h' : '') + (durM > 0 ? durM + 'min' : '') : '';

        const isLast = idx === events.length - 1;
        const chainLine = (!isLast && event.id !== 'sleep') ?
            '<div style="display:flex;align-items:center;gap:0.5rem;padding:0 1rem;margin:-0.25rem 0;"><div style="width:3rem;flex-shrink:0;"></div><div style="width:2px;height:0.625rem;background:linear-gradient(to bottom,' + bColor + ',#e5e7eb);margin-left:1.375rem;opacity:0.5;border-radius:1px;"></div></div>'
            : '';

        // Méthode Pomodoro : sous-titre + badge sur les sessions d'étude
        const isStudy = v3IsStudyType(event.type) && durMins > 0;
        let subtitle = event.subtitle || '';
        if (isStudy) subtitle = (subtitle ? subtitle + ' · ' : '') + v3PomodoroLabel(durMins);
        const pomoRunning = !!(v3Pomo && v3Pomo.running && v3Pomo.key === selectedDay + '|' + event.id);
        const pomoBtn = isStudy ? '<button class="v3-pomo-chip' + (pomoRunning ? ' running' : '') + '" onclick="event.stopPropagation();v3OpenPomodoro(' + idx + ')" title="Lancer un Pomodoro pour cette session">🍅</button>' : '';
        const pinBadge = event.kind === 'pinned' ? '<span title="Heure fixée par toi" style="font-size:0.7rem;margin-right:0.2rem;">📌</span>' : '';

        eventsHtml += '<div onclick="' + (event.editable ? 'v3OpenEditByIndex(' + idx + ')' : '') + '" style="display:flex;align-items:center;gap:0.875rem;padding:0.875rem 1rem;background:' + bBg + ';border-radius:0.875rem;border-left:4px solid ' + bColor + ';box-shadow:0 1px 4px rgba(0,0,0,0.08);cursor:' + (event.editable ? 'pointer' : 'default') + ';transition:all 0.2s;margin-bottom:0.5rem;" ' + (event.editable ? 'onmouseover="this.style.transform=\'translateX(2px)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,0.12)\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'0 1px 4px rgba(0,0,0,0.08)\'"' : '') + '>' +
            '<div style="width:2.75rem;height:2.75rem;background:white;border-radius:0.75rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.08);border:1.5px solid #f3f4f6;"><span style="font-size:1.375rem;">' + event.icon + '</span></div>' +
            '<div style="flex:1;min-width:0;">' +
                '<h3 style="font-weight:700;color:#111827;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + v3Escape(event.title) + '</h3>' +
                (subtitle ? '<p style="font-size:0.75rem;color:#6b7280;margin-top:0.1rem;">' + v3Escape(subtitle) + '</p>' : '') +
            '</div>' +
            pomoBtn +
            '<div style="text-align:right;flex-shrink:0;">' +
                '<p style="font-size:0.85rem;font-weight:700;color:#374151;">' + pinBadge + event.startTime + '</p>' +
                '<p style="font-size:0.7rem;color:#9ca3af;">→ ' + event.endTime + '</p>' +
                (durLabel ? '<p style="font-size:0.68rem;color:' + bColor + ';font-weight:600;margin-top:0.1rem;">' + durLabel + '</p>' : '') +
            '</div>' +
            '<div style="width:1.15rem;flex-shrink:0;margin-left:0.25rem;text-align:center;color:#d1d5db;' + (event.editable ? '' : 'visibility:hidden;') + '"><span style="font-size:0.8rem;">✏️</span></div>' +
        '</div>' + chainLine;
    });

    // Lien discret pour revenir au planning automatique du jour (si modifié)
    const dayHasChanges = customEvents.some(e => e && e.day === selectedDay);
    if (dayHasChanges) {
        eventsHtml += '<div style="text-align:right;margin-top:0.25rem;"><button onclick="v3ResetDay()" style="background:none;border:none;color:#9ca3af;font-size:0.75rem;cursor:pointer;text-decoration:underline;">↺ Réinitialiser ' + V3_DAY_NAMES[selectedDay] + ' (planning automatique)</button></div>';
    }
    document.getElementById('eventsContainer').innerHTML = eventsHtml;

    document.getElementById('statScore').textContent = targetScore;
    document.getElementById('statSubjects').textContent = subjects.length + optionalSubjects.length;
    document.getElementById('statActivities').textContent = selectedActivities.length;
    if (typeof majClasseAffichage === 'function') majClasseAffichage();
    if (typeof eeSuiviPlanning === 'function') eeSuiviPlanning();
}

function v3LibreVertical() {
    return '<div style="min-height:72vh;display:flex;align-items:center;justify-content:center;padding:1.25rem 0.5rem;">'
        + '<div style="position:relative;width:min(100%,18.5rem);min-height:32rem;border-radius:2rem;background:radial-gradient(circle at 50% 18%,rgba(254,205,211,0.55),transparent 58%),linear-gradient(180deg,#fff 0%,#fff1f2 100%);border:1px solid rgba(190,18,60,0.12);box-shadow:0 28px 70px rgba(136,19,55,0.10);display:flex;align-items:center;justify-content:center;overflow:hidden;">'
        + '<div style="position:absolute;inset:0.9rem;border-radius:1.45rem;border:1px solid rgba(190,18,60,0.16);pointer-events:none;"></div>'
        + '<div style="position:absolute;top:1.7rem;left:50%;transform:translateX(-50%);font-size:0.68rem;letter-spacing:0.28em;text-transform:uppercase;color:#9f1239;font-weight:700;">Jour férié</div>'
        + '<div style="writing-mode:vertical-rl;transform:rotate(180deg);font-family:Georgia,\'Iowan Old Style\',\'Palatino Linotype\',Palatino,serif;font-weight:500;font-size:clamp(4.4rem,18vw,6.4rem);letter-spacing:0.22em;line-height:1;color:#be123c;">libre</div>'
        + '<div style="position:absolute;bottom:1.6rem;width:2.4rem;height:1px;background:linear-gradient(90deg,transparent,#e11d48,transparent);"></div>'
        + '</div></div>';
}

function v3OpenEditByIndex(idx) {
    const ev = v3LastRendered[idx];
    if (!ev || !ev.editable) return;
    openEditModal(ev.id, ev.title, ev.startTime, ev.endTime, ev.type, ev.icon, ev);
}

function v3ResetDay() {
    const day = selectedDay;
    const snapshot = customEvents.slice();
    if (!confirm('Remettre le planning automatique de ' + V3_DAY_NAMES[day] + ' ? Tes modifications de ce jour seront retirées.')) return;
    customEvents = customEvents.filter(e => !(e && e.day === day));
    v3Save();
    v3SyncExoLabels();
    renderPlanning();
    v3Toast('↺ Planning de ' + V3_DAY_NAMES[day] + ' réinitialisé', 'info', { undo: function () { customEvents = snapshot; v3Save(); v3SyncExoLabels(); renderPlanning(); } });
}

// ═══════════════════════════════════════════════════════════════════
//  3. MODIFICATION D'UN CRÉNEAU (surcharge openEditModal / save / delete)
// ═══════════════════════════════════════════════════════════════════
function openEditModal(id, title, startTime, endTime, type, icon, evt) {
    const record = customEvents.find(e => e && e.id === id && !e.replacesId) || null;
    editingEvent = {
        id, title, startTime, endTime, type,
        icon: icon || (evt && evt.icon) || (record && record.icon) || '📌',
        kind: evt ? evt.kind : (record ? 'pinned' : 'flex'),
        isCustom: !!record
    };
    document.getElementById('editEventTitle').value = title;
    document.getElementById('editEventStart').value = startTime;
    document.getElementById('editEventEnd').value = endTime;
    editCurrentDuration = timeToMinutes(endTime) - timeToMinutes(startTime);
    if (editCurrentDuration <= 0) editCurrentDuration = 30;
    updateEditDurationDisplay();
    document.getElementById('editTimeError').style.display = 'none';
    const pomoBtn = document.getElementById('editPomodoroBtn');
    if (pomoBtn) pomoBtn.style.display = v3IsStudyType(type) ? 'block' : 'none';
    v3UpdateEditPinHint();
    document.getElementById('editEventModal').style.display = 'flex';
}

function v3UpdateEditPinHint() {
    const hint = document.getElementById('editPinHint');
    if (!hint || !editingEvent) return;
    const start = document.getElementById('editEventStart').value;
    const changed = start && start !== editingEvent.startTime;
    if (editingEvent.kind === 'pinned') {
        hint.textContent = '📌 Ce créneau garde l\'heure de début que tu as choisie' + (changed ? ' (' + start + ')' : '') + '.';
        hint.style.display = 'block';
    } else if (changed) {
        hint.textContent = '📌 Nouvelle heure de début : ce créneau sera fixé à ' + start + '. Les créneaux automatiques s\'organiseront autour.';
        hint.style.display = 'block';
    } else {
        hint.style.display = 'none';
    }
}

function saveEditedEventCascade() {
    if (!editingEvent) return;
    const newTitle = document.getElementById('editEventTitle').value.trim() || editingEvent.title;
    const newStart = document.getElementById('editEventStart').value;
    const newEnd = document.getElementById('editEventEnd').value;
    const errEl = document.getElementById('editTimeError');
    const showErr = (m) => { errEl.textContent = m; errEl.style.display = 'block'; };

    if (!newStart || !newEnd) { showErr('Remplis les horaires.'); return; }
    const newDur = timeToMinutes(newEnd) - timeToMinutes(newStart);
    if (newDur <= 0) { showErr("L'heure de fin doit être après le début."); return; }
    errEl.style.display = 'none';

    const day = selectedDay;
    const startChanged = newStart !== editingEvent.startTime;
    const customIdx = customEvents.findIndex(e => e && e.id === editingEvent.id && !e.replacesId);
    const isCustom = customIdx !== -1;
    const existingOv = isCustom ? null : v3FindOverride(editingEvent.id, day);
    const willBePinned = isCustom || !!(existingOv && existingOv.pinned && !existingOv.deleted) || startChanged;

    // Un créneau à heure fixée ne doit pas chevaucher les cours / trajets / autres créneaux fixés
    if (willBePinned) {
        const conflict = v3FindConflict(day, newStart, newEnd, [editingEvent.id]);
        if (conflict) { showErr(v3ConflictMessage(conflict)); return; }
    }

    const overlapsBefore = v3OverlapWarnings(day);
    const oldDur = timeToMinutes(editingEvent.endTime) - timeToMinutes(editingEvent.startTime);
    const delta = newDur - oldDur;
    let recordId;

    if (isCustom) {
        customEvents[customIdx] = { ...customEvents[customIdx], title: newTitle, startTime: newStart, endTime: newEnd, timestamp: Date.now() };
        recordId = customEvents[customIdx].id;
    } else {
        // Une seule modification par créneau généré et par jour (la 2e modification remplace la 1re)
        customEvents = customEvents.filter(e => !(e && e.replacesId === editingEvent.id && e.day === day));
        const rec = {
            id: generateEventId(editingEvent.type, newTitle, day),
            day, title: newTitle, startTime: newStart, endTime: newEnd,
            type: editingEvent.type, icon: editingEvent.icon || '📌',
            source: 'custom', replacesId: editingEvent.id, pinned: willBePinned, timestamp: Date.now()
        };
        customEvents.push(rec);
        recordId = rec.id;
    }

    // Réajustement : les créneaux fixés qui suivent sont décalés de la variation de durée
    if (delta !== 0) {
        const editStartMins = timeToMinutes(newStart);
        customEvents = customEvents.map(ev => {
            if (!ev || ev.day !== day || ev.id === recordId || !v3IsPinnedRecord(ev)) return ev;
            const evStart = timeToMinutes(ev.startTime);
            if (evStart <= editStartMins) return ev;
            const evDur = timeToMinutes(ev.endTime) - evStart;
            return { ...ev, startTime: v3M2T(evStart + delta), endTime: v3M2T(evStart + delta + evDur) };
        });
    }

    v3Save();
    closeEditModal();
    renderPlanning();

    const newOverlaps = v3OverlapWarnings(day).filter(k => !overlapsBefore.includes(k));
    if (newOverlaps.length) {
        const [a, b] = newOverlaps[0].split('|');
        const evs = generateDayEvents(day);
        const ea = evs.find(e => e.id === a), eb = evs.find(e => e.id === b);
        v3Toast('⚠️ Attention : « ' + (ea ? ea.title : a) + ' » chevauche « ' + (eb ? eb.title : b) + '». Ajuste les durées si besoin.', 'warn', { duration: 5000 });
    } else if (delta !== 0) {
        v3Toast('🔗 Planning synchronisé — ' + (delta > 0 ? '+' : '') + delta + ' min sur les activités suivantes', 'success');
    } else {
        v3Toast('✅ Modification enregistrée', 'success');
    }
}

function saveEditedEvent() { saveEditedEventCascade(); }

function deleteEditedEvent() {
    if (!editingEvent) return;
    const day = selectedDay;
    const snapshot = customEvents.slice();
    const title = editingEvent.title;
    const isCustom = customEvents.some(e => e && e.id === editingEvent.id && !e.replacesId);
    if (isCustom) {
        customEvents = customEvents.filter(e => !(e && e.id === editingEvent.id));
    } else {
        // Créneau généré : on mémorise sa suppression pour ce jour
        customEvents = customEvents.filter(e => !(e && e.replacesId === editingEvent.id && e.day === day));
        customEvents.push({
            id: generateEventId(editingEvent.type, title, day), day, title,
            startTime: editingEvent.startTime, endTime: editingEvent.endTime, type: editingEvent.type,
            icon: editingEvent.icon || '📌', source: 'custom', replacesId: editingEvent.id, deleted: true, timestamp: Date.now()
        });
    }
    v3Save();
    v3SyncExoLabels();
    closeEditModal();
    renderPlanning();
    v3Toast('🗑️ « ' + title + ' » retiré du planning de ' + V3_DAY_NAMES[day], 'info', {
        undo: function () { customEvents = snapshot; v3Save(); v3SyncExoLabels(); renderPlanning(); v3Toast('↩ « ' + title + ' » rétabli', 'success'); }
    });
}

// ═══════════════════════════════════════════════════════════════════
//  2. AJOUT AU PLANNING + DÉTECTION DES DOUBLONS
// ═══════════════════════════════════════════════════════════════════
let v3DupAck = null; // clé du doublon déjà signalé (2e clic = ajout confirmé)

function v3FindDuplicate(dayIndex, title, mode) {
    const wanted = mode === 'study' ? v3StudyKey(title) : v3Normalize(title);
    if (!wanted) return null;
    return generateDayEvents(dayIndex).find(ev => {
        if (ev.id === 'wakeup' || ev.id === 'sleep') return false;
        if (mode === 'study') return v3IsStudyType(ev.type) && v3StudyKey(ev.title) === wanted;
        return v3Normalize(ev.title) === wanted;
    }) || null;
}
function v3ShowDupWarning(el, label, dup, dayIndex) {
    el.innerHTML = '⚠️ <strong>' + v3Escape(label) + '</strong> est déjà dans ton planning de ' + V3_DAY_NAMES[dayIndex] +
        ' (' + dup.startTime + ' → ' + dup.endTime + ').<br>Clique à nouveau sur « Ajouter au planning » pour l\'ajouter quand même.';
    el.style.display = 'block';
}

function confirmAddStudy() {
    if (!newEventSelectedSubject) return;
    const startTime = document.getElementById('studyStartInput').value;
    const endTime = document.getElementById('studyEndInput').value;
    const errEl = document.getElementById('studyTimeError');
    const warnEl = document.getElementById('studyDupWarning');
    const showErr = (m) => { errEl.textContent = m; errEl.style.display = 'block'; if (warnEl) warnEl.style.display = 'none'; };

    if (!startTime || !endTime) { showErr('Remplis les horaires.'); return; }
    const validation = validateNewEventTime(startTime, endTime, selectedDay);
    if (!validation.valid) { showErr(validation.error); return; }
    const conflict = v3FindConflict(selectedDay, startTime, endTime);
    if (conflict) { showErr(v3ConflictMessage(conflict)); return; }
    errEl.style.display = 'none';

    const icon = newEventStudyType === 'revision' ? newEventSelectedSubject.icon : '✏️';
    const title = (newEventStudyType === 'revision' ? 'Révision ' : 'Exercices ') + newEventSelectedSubject.name;

    // Doublon : même type de session pour la même matière ce jour-là
    const dupKey = ['study', v3StudyKey(title), selectedDay, startTime, endTime].join('|');
    const dup = v3FindDuplicate(selectedDay, title, 'study');
    if (dup && v3DupAck !== dupKey && warnEl) { v3DupAck = dupKey; v3ShowDupWarning(warnEl, dup.title, dup, selectedDay); return; }
    v3DupAck = null;
    if (warnEl) warnEl.style.display = 'none';

    customEvents.push({
        id: generateEventId('study', title, selectedDay),
        day: selectedDay, title, startTime, endTime, type: 'study', icon,
        subjectGrade: newEventSelectedSubject.grade, source: 'custom', timestamp: Date.now()
    });
    v3Save();
    closeAddModal();
    renderPlanning();
    v3Toast('✅ « ' + title + ' » ajouté ' + V3_DAY_NAMES[selectedDay] + ' à ' + startTime + ' · ' + v3PomodoroLabel(timeToMinutes(endTime) - timeToMinutes(startTime)), 'success');
}

var activityEmojiManuel = false;
var EMOJI_ACTIVITE = ['⚽','🏀','🏊','💃','🏋️','⛪','🕌','🎨','🤝','🎵','📚','🍳','🏃','🚴','🧘','🎬','🎮','💻','🙏','🎉','🎾','🏐','🥊','🚶','💼','⭐','🎯','🌟','💡','🧩','🎭','🏆','🌈','🔥','🎹','🎤','📖','✏️','😴','🍵','📷','🌸','🍀','💫','🥁','♟️'];

function activiteEmojiReinit() {
    activityEmojiManuel = false;
    var picker = document.getElementById('activityEmojiPicker');
    if (picker) picker.style.display = 'none';
}

function emojiPourActivite(nom) {
    var n = String(nom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!n) return '✨';
    var regles = [
        [/foot|soccer/, '⚽'], [/basket/, '🏀'], [/natation|nage|piscine|swim/, '🏊'],
        [/danse|dance/, '💃'], [/gym|muscu|fitness/, '🏋️'], [/eglise|messe|culte/, '⛪'],
        [/mosque/, '🕌'], [/art|dessin|peint/, '🎨'], [/benevol/, '🤝'],
        [/music|piano|guitare|violon|chant|chanson|batterie/, '🎵'], [/lecture|lire|livre/, '📚'],
        [/cuisine|cuisin|repas/, '🍳'], [/course|jogging|run/, '🏃'], [/velo|cycl/, '🚴'],
        [/yoga|medit/, '🧘'], [/film|cine|serie/, '🎬'], [/jeu|game|gaming|console/, '🎮'],
        [/code|programm|info/, '💻'], [/priere|prier/, '🙏'], [/famille|parent/, '👨‍👩‍👧'],
        [/ami|sortie|fete|anniv/, '🎉'], [/tennis/, '🎾'], [/volley/, '🏐'], [/boxe|combat/, '🥊'],
        [/marche|promen/, '🚶'], [/travail|job|stage|boulot/, '💼'], [/echec|chess/, '♟️'],
        [/photo/, '📷'], [/theatre/, '🎭'], [/sieste|repos|dorm/, '😴']
    ];
    for (var i = 0; i < regles.length; i++) if (regles[i][0].test(n)) return regles[i][1];
    var h = 0;
    for (var j = 0; j < n.length; j++) h = (h + n.charCodeAt(j) * (j + 1)) % EMOJI_ACTIVITE.length;
    return EMOJI_ACTIVITE[h];
}

function majEmojiActivite() {
    if (activityEmojiManuel) return;
    var input = document.getElementById('activityNameInput');
    var nom = input ? input.value.trim() : '';
    var icon = emojiPourActivite(nom);
    newActivityIcon = icon;
    var preview = document.getElementById('activityIconPreview');
    if (preview) preview.textContent = icon;
    document.querySelectorAll('.preset-act-btn').forEach(function (btn) {
        var on = nom && (btn.getAttribute('data-name') || '').toLowerCase() === nom.toLowerCase();
        btn.style.background = on ? '#f0fdf4' : 'white';
        btn.style.borderColor = on ? '#6ee7b7' : '#e5e7eb';
    });
}

function basculerEmojisActivite() {
    var picker = document.getElementById('activityEmojiPicker');
    if (!picker) return;
    if (!picker.childElementCount) {
        var vus = {};
        EMOJI_ACTIVITE.forEach(function (emoji) {
            if (vus[emoji]) return;
            vus[emoji] = true;
            var bouton = document.createElement('button');
            bouton.type = 'button';
            bouton.textContent = emoji;
            bouton.style.cssText = 'width:2.25rem;height:2.25rem;border:1px solid #e5e7eb;background:white;border-radius:0.6rem;font-size:1.15rem;cursor:pointer;padding:0;';
            bouton.onclick = function (ev) {
                ev.stopPropagation();
                activityEmojiManuel = true;
                newActivityIcon = emoji;
                var preview = document.getElementById('activityIconPreview');
                if (preview) preview.textContent = emoji;
                picker.style.display = 'none';
            };
            picker.appendChild(bouton);
        });
    }
    picker.style.display = picker.style.display === 'flex' ? 'none' : 'flex';
}

function confirmAddActivity() {
    const name = document.getElementById('activityNameInput').value.trim();
    const preview = document.getElementById('activityIconPreview');
    const icon = (preview && preview.textContent.trim()) || newActivityIcon || '✨';
    const startTime = document.getElementById('activityStartInput').value;
    const endTime = document.getElementById('activityEndInput').value;
    const errEl = document.getElementById('activityTimeError');
    const warnEl = document.getElementById('activityDupWarning');
    const showErr = (m) => { errEl.textContent = m; errEl.style.display = 'block'; if (warnEl) warnEl.style.display = 'none'; };

    if (!name) { showErr('Merci d\'entrer un nom d\'activité.'); return; }
    if (!startTime || !endTime) { showErr('Remplis les horaires.'); return; }
    const validation = validateNewEventTime(startTime, endTime, selectedDay);
    if (!validation.valid) { showErr(validation.error); return; }
    const conflict = v3FindConflict(selectedDay, startTime, endTime);
    if (conflict) { showErr(v3ConflictMessage(conflict)); return; }
    errEl.style.display = 'none';

    // Doublon : une activité du même nom existe déjà ce jour-là
    const dupKey = ['activity', v3Normalize(name), selectedDay, startTime, endTime].join('|');
    const dup = v3FindDuplicate(selectedDay, name, 'activity');
    if (dup && v3DupAck !== dupKey && warnEl) { v3DupAck = dupKey; v3ShowDupWarning(warnEl, dup.title, dup, selectedDay); return; }
    v3DupAck = null;
    if (warnEl) warnEl.style.display = 'none';

    customEvents.push({
        id: generateEventId('activity', name, selectedDay),
        day: selectedDay, title: name, startTime, endTime, type: 'activity', icon, source: 'custom', timestamp: Date.now()
    });
    v3Save();
    closeAddModal();
    renderPlanning();
    v3Toast('✅ « ' + name + ' » ajouté ' + V3_DAY_NAMES[selectedDay] + ' à ' + startTime, 'success');
}

// Page « Tes activités » (inscription) : pas deux fois la même activité
function addCustomActivity() {
    const input = document.getElementById('customActivityInput');
    const name = input.value.trim();
    if (!name) return;
    const norm = v3Normalize(name);
    const existing = selectedActivities.find(a => v3Normalize(a.name) === norm);
    if (existing) {
        v3Toast('⚠️ « ' + existing.name + ' » est déjà dans tes activités.', 'warn');
        input.value = '';
        return;
    }
    const preset = availableActivitiesList.find(a => v3Normalize(a.name) === norm);
    if (preset) {
        toggleActivity(preset.name, preset.icon); // même activité que la liste → on la sélectionne
        input.value = '';
        return;
    }
    selectedActivities.push({ name, icon: '✨', days: [], sameTime: true, startTime: '17:00', endTime: '19:00', dayTimes: {} });
    input.value = '';
    renderActivities();
}

// ── Surcharges légères (on garde le comportement d'origine + ajout) ──
(function () {
    const origReset = window.resetAddWorkflow;
    window.resetAddWorkflow = function () {
        origReset();
        v3DupAck = null;
        ['studyDupWarning', 'activityDupWarning', 'studyPomodoroHint'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    };
    const origPickSubject = window.pickSubject;
    window.pickSubject = function (idx) { origPickSubject(idx); v3UpdateStudyPomodoroHint(); };
    const origSetStudyType = window.setStudyType;
    window.setStudyType = function (type) { origSetStudyType(type); v3UpdateStudyPomodoroHint(); };

    const origSyncStart = window.syncEditEndFromStart;
    window.syncEditEndFromStart = function () { origSyncStart(); v3UpdateEditPinHint(); };

    // Exercices : replanifier un exercice déjà planifié remplace l'ancien créneau (pas de doublon)
    const origScheduleExo = window.scheduleExo;
    window.scheduleExo = function (exoId, slotIdx) {
        const exo = exercices.find(e => e.id === exoId);
        let oldIds = [];
        if (exo && exo.scheduledSlot) {
            if (!confirm('⚠️ Cet exercice est déjà planifié (' + exo.scheduledSlot + ').\nVeux-tu remplacer ce créneau par le nouveau ?')) return;
            oldIds = customEvents.filter(e => e && e.exoId === exoId).map(e => e.id);
        }
        origScheduleExo(exoId, slotIdx);
        if (oldIds.length) {
            customEvents = customEvents.filter(e => !oldIds.includes(e.id));
            v3Save();
            if (document.getElementById('planningModal').classList.contains('active')) renderPlanning();
        }
    };

    ['studyStartInput', 'studyEndInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.addEventListener('input', v3UpdateStudyPomodoroHint); el.addEventListener('change', v3UpdateStudyPomodoroHint); }
    });
    // Fermer le Pomodoro en cliquant sur le fond
    const pm = document.getElementById('pomodoroModal');
    if (pm) pm.addEventListener('click', function (e) { if (e.target === pm) v3ClosePomodoro(); });
})();
