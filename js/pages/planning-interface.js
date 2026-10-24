/* ============================================================
   PAGE Planning — interface
   Affichage, modification fiable, suppression avec annulation, signalement des doublons.
   Vue : pages/planning.html
   ============================================================ */

// ═══════════════════════════════════════════════════════════════════
//  AFFICHAGE DU PLANNING (surcharge de renderPlanning)
//  — identique visuellement, sans aucune marque de minuteur,
//    📌 sur les créneaux fixés, ouverture de l'édition par index
// ═══════════════════════════════════════════════════════════════════
/* L'icône des activités change à chaque semaine : le coureur, la fléchette,
   puis le trophée, et on recommence. La semaine commence le lundi, pour tout
   le monde en même temps. */
var v3LastRendered = [];
var V3_ICONES_ACTIVITES = ['🏃', '🎯', '🏆'];

function v3IconeActivitesSemaine() {
    var maintenant = new Date();
    var lundi = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
    lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
    /* Semaine de référence : celle du 12 octobre 2026, pour que cette semaine
       affiche le coureur, puis la fléchette, puis le trophée. */
    var reference = new Date(2026, 9, 12);
    var semaines = Math.round((lundi.getTime() - reference.getTime()) / 604800000);
    var rang = ((semaines % V3_ICONES_ACTIVITES.length) + V3_ICONES_ACTIVITES.length) % V3_ICONES_ACTIVITES.length;
    return V3_ICONES_ACTIVITES[rang];
}

function v3PeindreIconeActivites() {
    var el = document.getElementById('statActivitiesIcone');
    if (el) el.textContent = v3IconeActivitesSemaine();
}

function renderPlanning() {
    var ancienChevauchement = document.getElementById('chevauchementJour');
    if (ancienChevauchement && ancienChevauchement.parentNode) ancienChevauchement.parentNode.removeChild(ancienChevauchement);
    if (typeof poserJourCourant === 'function') poserJourCourant();
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
        v3PeindreIconeActivites();
        if (typeof majClasseAffichage === 'function') majClasseAffichage();
        if (typeof eeSuiviPlanning === 'function') eeSuiviPlanning();
        return;
    }
    if (addBtn) addBtn.style.display = 'flex';
    v3SignalerChevauchementJour(events, selectedDay);
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

        /* Plus aucune marque de minuteur sur les cartes du planning : la
           séance de révision et le minuteur ont leur propre page. */
        const subtitle = event.subtitle || '';
        const pinBadge = event.kind === 'pinned' ? '<span title="Heure fixée par toi" style="font-size:0.7rem;margin-right:0.2rem;">📌</span>' : '';

        /* Deux épreuves simultanées choisies par l'élève restent visibles
           côte à côte ; elles ne se recouvrent jamais dans la liste. */
        const memeEpreuve = function (a, b) {
            return a && b && a.devoirsBloc && b.devoirsBloc &&
                ['devoir-', 'exam-'].some(function (prefixe) { return String(a.id).startsWith(prefixe); }) &&
                ['devoir-', 'exam-'].some(function (prefixe) { return String(b.id).startsWith(prefixe); }) &&
                timeToMinutes(a.startTime) < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < timeToMinutes(a.endTime);
        };
        const avecAvant = memeEpreuve(events[idx - 1], event);
        const avecApres = memeEpreuve(event, events[idx + 1]);
        if (!avecAvant && avecApres) eventsHtml += '<div class="devoirs-paralleles">';
        eventsHtml += '<div data-v3-idx="' + idx + '" onclick="' + (event.editable ? 'v3OpenEditByIndex(' + idx + ')' : '') + '" style="display:flex;align-items:center;gap:0.875rem;padding:0.875rem 1rem;background:' + bBg + ';border-radius:0.875rem;border-left:4px solid ' + bColor + ';box-shadow:0 1px 4px rgba(0,0,0,0.08);cursor:' + (event.editable ? 'pointer' : 'default') + ';transition:all 0.2s;margin-bottom:0.5rem;" ' + (event.editable ? 'onmouseover="this.style.transform=\'translateX(2px)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,0.12)\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'0 1px 4px rgba(0,0,0,0.08)\'"' : '') + '>' +
            '<div style="width:2.75rem;height:2.75rem;background:white;border-radius:0.75rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.08);border:1.5px solid #f3f4f6;"><span style="font-size:1.375rem;">' + iconeHtml(event.icon, '1.45rem') + '</span></div>' +
            '<div style="flex:1;min-width:0;">' +
                '<h3 style="font-weight:700;color:#111827;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + v3Escape(event.title) + '</h3>' +
                (subtitle ? '<p style="font-size:0.75rem;color:#6b7280;margin-top:0.1rem;">' + v3Escape(subtitle) + '</p>' : '') +
            '</div>' +
            '<div style="text-align:right;flex-shrink:0;">' +
                '<p style="font-size:0.85rem;font-weight:700;color:#374151;">' + pinBadge + event.startTime + '</p>' +
                '<p style="font-size:0.7rem;color:#9ca3af;">→ ' + event.endTime + '</p>' +
                (durLabel ? '<p style="font-size:0.68rem;color:' + bColor + ';font-weight:600;margin-top:0.1rem;">' + durLabel + '</p>' : '') +
            '</div>' +
            '<div style="width:1.15rem;flex-shrink:0;margin-left:0.25rem;text-align:center;color:#d1d5db;' + (event.editable ? '' : 'visibility:hidden;') + '"><span style="font-size:0.8rem;">✏️</span></div>' +
        '</div>' + (avecAvant || avecApres ? '' : chainLine);
        if (avecAvant && !avecApres) eventsHtml += '</div>' + chainLine;
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
    v3PeindreIconeActivites();
    if (typeof majClasseAffichage === 'function') majClasseAffichage();
    if (typeof eeSuiviPlanning === 'function') eeSuiviPlanning();
}

function v3LibreVertical() {
    /* Jour férié libéré : la carte « Jour libre » aux couleurs vertes du site. */
    return '<div style="min-height:68vh;display:flex;align-items:center;justify-content:center;padding:1.25rem 0.5rem;">'
        + '<div style="width:min(100%,21rem);border-radius:1.6rem;overflow:hidden;line-height:0;box-shadow:0 26px 60px rgba(22,101,52,0.14),0 2px 10px rgba(22,101,52,0.06);">'
        + '<img src="images/jour-libre.webp?v=20261016e" alt="Jour libre : rien de programmé aujourd\'hui" width="409" height="619" draggable="false" style="display:block;width:100%;height:auto;">'
        + '</div></div>';
}

function v3OpenEditByIndex(idx) {
    const ev = v3LastRendered[idx];
    if (!ev || !ev.editable) return;
    openEditModal(ev.id, ev.title, ev.startTime, ev.endTime, ev.type, ev.icon, ev);
}

function v3ResetDay() {
    const day = selectedDay;
    confirmerAction({
        titre: 'Réinitialiser le planning de ' + V3_DAY_NAMES[day] + ' ?',
        detail: 'Tes modifications de ce jour seront retirées. Tu pourras ensuite annuler pendant quelques secondes.',
        action: 'Réinitialiser ce jour',
        confirmer: function () {
            const snapshot = customEvents.slice();
            customEvents = customEvents.filter(e => !(e && e.day === day));
            v3Save();
            v3SyncExoLabels();
            renderPlanning();
            v3Toast('↺ Planning de ' + V3_DAY_NAMES[day] + ' réinitialisé', 'info', { undo: function () { customEvents = snapshot; v3Save(); v3SyncExoLabels(); renderPlanning(); } });
        }
    });
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
    if (!window.__ignorerChevauchementActivite) {
        var voisines = v3ConflitsCreneau(day, newStart, newEnd, [editingEvent.id]);
        if (voisines.length) {
            v3OuvrirChoixChevauchement({
                mode: 'edition',
                day: day,
                title: newTitle,
                icon: editingEvent.icon,
                type: editingEvent.type,
                start: newStart,
                end: newEnd,
                origineStart: editingEvent.startTime,
                origineEnd: editingEvent.endTime,
                excludeIds: [editingEvent.id],
                conflits: voisines
            });
            return;
        }
    }
    const startChanged = newStart !== editingEvent.startTime;
    const customIdx = customEvents.findIndex(e => e && e.id === editingEvent.id && !e.replacesId);
    const isCustom = customIdx !== -1;
    const existingOv = isCustom ? null : v3FindOverride(editingEvent.id, day);
    const willBePinned = isCustom || !!(existingOv && existingOv.pinned && !existingOv.deleted) || startChanged;

    // Un créneau à heure fixée ne doit pas chevaucher les cours / trajets / autres créneaux fixés
    if (willBePinned && !window.__ignorerChevauchementActivite) {
        const conflict = v3FindConflict(day, newStart, newEnd, [editingEvent.id]);
        if (conflict) { showErr(v3ConflictMessage(conflict)); return; }
    }

    const overlapsBefore = v3OverlapWarnings(day);
    const oldDur = timeToMinutes(editingEvent.endTime) - timeToMinutes(editingEvent.startTime);
    const delta = newDur - oldDur;
    let recordId;

    if (isCustom) {
        customEvents[customIdx] = { ...customEvents[customIdx], title: newTitle, startTime: newStart, endTime: newEnd, timestamp: Date.now(), resteEcole: false };
        recordId = customEvents[customIdx].id;
    } else {
        // Une seule modification par créneau généré et par jour (la 2e modification remplace la 1re)
        customEvents = customEvents.filter(e => !(e && e.replacesId === editingEvent.id && e.day === day));
        const rec = {
            id: generateEventId(editingEvent.type, newTitle, day),
            day, title: newTitle, startTime: newStart, endTime: newEnd,
            type: editingEvent.type, icon: editingEvent.icon || '📌',
            source: 'custom', replacesId: editingEvent.id, pinned: willBePinned, timestamp: Date.now(),
            resteEcole: false
        };
        customEvents.push(rec);
        recordId = rec.id;
    }

    // Réajustement : les créneaux fixés qui suivent sont décalés de la variation de durée
    if (delta !== 0 && !window.__ignorerDecalagePlanning) {
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

    if (delta !== 0) {
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
    v3Toast('✅ « ' + title + ' » ajouté ' + V3_DAY_NAMES[selectedDay] + ' à ' + startTime + ' · ' + v3DurLabel(timeToMinutes(endTime) - timeToMinutes(startTime)), 'success');
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
    if (!window.__ignorerChevauchementActivite) {
        var voisinesAjout = v3ConflitsCreneau(selectedDay, startTime, endTime, []);
        if (voisinesAjout.length) {
            v3OuvrirChoixChevauchement({
                mode: 'ajout',
                day: selectedDay,
                title: name,
                icon: '✨',
                type: 'activity',
                start: startTime,
                end: endTime,
                origineStart: startTime,
                origineEnd: endTime,
                excludeIds: [],
                conflits: voisinesAjout
            });
            return;
        }
    }
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
function v3EstActivite(ev) {
    if (!ev) return false;
    if (ev.type === 'activity') return true;
    return String(ev.id || '').indexOf('activity-') === 0;
}

function v3IntervallesSeCroisent(debut, fin, autreDebut, autreFin) {
    if (typeof timeToMinutes !== 'function') return false;
    var s = timeToMinutes(debut);
    var e = timeToMinutes(fin);
    var os = timeToMinutes(autreDebut);
    var oe = timeToMinutes(autreFin);
    if (!(e > s) || !(oe > os)) return false;
    return s < oe && os < e;
}

function v3ActivitesChevauchees(day, start, end, excludeIds) {
    var exclus = {};
    (excludeIds || []).forEach(function (id) { if (id) exclus[id] = true; });
    var vus = {};
    var out = [];
    function ajouter(ev) {
        if (!ev || !ev.id || exclus[ev.id] || vus[ev.id] || !v3EstActivite(ev)) return;
        if (!v3IntervallesSeCroisent(start, end, ev.startTime, ev.endTime)) return;
        vus[ev.id] = true;
        out.push(ev);
    }
    try { (generateDayEvents(day) || []).forEach(ajouter); } catch (e) {}
    (typeof customEvents !== 'undefined' ? customEvents : []).forEach(function (ev) {
        if (!ev || ev.day !== day || ev.deleted) return;
        if (ev.replacesId) {
            ajouter({
                id: ev.replacesId,
                title: ev.title,
                startTime: ev.startTime,
                endTime: ev.endTime,
                type: ev.type || 'activity',
                icon: ev.icon || '✨'
            });
            return;
        }
        ajouter(ev);
    });
    var remplacees = {};
    (typeof customEvents !== 'undefined' ? customEvents : []).forEach(function (ev) {
        if (ev && ev.day === day && ev.replacesId) remplacees[ev.replacesId] = true;
    });
    (typeof selectedActivities !== 'undefined' ? selectedActivities : []).forEach(function (act) {
        if (!act || !act.name || !act.days || act.days.indexOf(day) === -1) return;
        var id = 'activity-' + act.name;
        if (remplacees[id]) return;
        var slot = act.sameTime ? { start: act.startTime, end: act.endTime } : ((act.dayTimes && (act.dayTimes[day] || act.dayTimes[String(day)])) || null);
        if (!slot || !slot.start || !slot.end) return;
        ajouter({ id: id, title: act.name, startTime: slot.start, endTime: slot.end, type: 'activity', icon: act.icon || '✨' });
    });
    return out;
}

// Une solution n'est proposée que si les deux destinations sont vérifiées.
function v3Horloge(mins) {
    return typeof v3M2T === 'function' ? v3M2T(mins) : '00:00';
}

function v3DureeCourte(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    return (h ? h + ' h' : '') + (m ? (h ? ' ' : '') + m + ' min' : '');
}

function v3ConflitsCreneau(day, start, end, excludeIds) {
    var exclus = new Set(excludeIds || []);
    var out = [], vus = new Set();
    function ajouter(ev) {
        if (!ev || !ev.id || exclus.has(ev.id) || vus.has(ev.id) || ev.id === 'wakeup' || ev.id === 'sleep') return;
        if (!ev.startTime || !ev.endTime || !v3IntervallesSeCroisent(start, end, ev.startTime, ev.endTime)) return;
        vus.add(ev.id);
        out.push(ev);
    }
    (generateDayEvents(day) || []).forEach(ajouter);
    v3ActivitesChevauchees(day, start, end, excludeIds).forEach(ajouter);
    return out.sort(function (a, b) { return timeToMinutes(a.startTime) - timeToMinutes(b.startTime); });
}

function v3PeutDeplacerChevauchement(ev) {
    return !!(ev && v3EstActivite(ev) && ev.editable !== false && !ev.habitudeFixe &&
        ev.type !== 'school' && ev.type !== 'transport');
}

function v3VerifierChoixChevauchement(ctx, choix) {
    if (!ctx || !choix || !choix.utilisateur || selectedDay !== ctx.day) {
        return { valid: false, error: 'Le jour du planning a changé. Recommence ton choix.' };
    }
    if (ctx.mode === 'edition' && (!editingEvent || ctx.excludeIds[0] !== editingEvent.id)) {
        return { valid: false, error: 'Cette modification a changé. Ouvre à nouveau le créneau.' };
    }
    var utilisateur = choix.utilisateur;
    var duree = timeToMinutes(ctx.end) - timeToMinutes(ctx.start);
    var start = timeToMinutes(utilisateur.start), end = timeToMinutes(utilisateur.end);
    if (!(start >= 0 && end < 1440 && end > start && end - start === duree)) {
        return { valid: false, error: 'Garde la durée choisie, sans dépasser la fin de la journée.' };
    }
    var valid = validateNewEventTime(utilisateur.start, utilisateur.end, ctx.day);
    if (!valid.valid) return valid;
    var exclus = (ctx.excludeIds || []).slice();
    if (choix.conflitId) exclus.push(choix.conflitId);
    var conflit = v3ConflitsCreneau(ctx.day, utilisateur.start, utilisateur.end, exclus)[0];
    if (conflit) return { valid: false, error: 'Ce créneau recouvre encore « ' + conflit.title + ' ». Choisis un autre horaire.' };
    if (choix.conflitId) {
        if (ctx.conflits.length !== 1) return { valid: false, error: 'Plusieurs créneaux se chevauchent. Choisis un autre horaire.' };
        var autre = ctx.conflits[0];
        var present = v3ActivitesChevauchees(ctx.day, autre.startTime, autre.endTime, ctx.excludeIds).find(function (ev) { return ev.id === autre.id; }) ||
            (generateDayEvents(ctx.day) || []).find(function (ev) { return ev.id === autre.id; });
        if (!v3PeutDeplacerChevauchement(autre) || !present || present.startTime !== autre.startTime || present.endTime !== autre.endTime) {
            return { valid: false, error: 'Cette activité a changé. Ferme la fenêtre et réessaie.' };
        }
        var as = timeToMinutes(choix.autre.start), ae = timeToMinutes(choix.autre.end);
        var ancien = timeToMinutes(autre.endTime) - timeToMinutes(autre.startTime);
        if (!(as >= 0 && ae < 1440 && ae > as && ae - as === ancien)) {
            return { valid: false, error: 'La durée de « ' + autre.title + ' » doit rester la même.' };
        }
        if (v3IntervallesSeCroisent(utilisateur.start, utilisateur.end, choix.autre.start, choix.autre.end)) {
            return { valid: false, error: 'Les deux nouveaux horaires se chevauchent encore.' };
        }
        valid = validateNewEventTime(choix.autre.start, choix.autre.end, ctx.day);
        if (!valid.valid) return valid;
        conflit = v3ConflitsCreneau(ctx.day, choix.autre.start, choix.autre.end, exclus)[0];
        if (conflit) return { valid: false, error: '« ' + autre.title + ' » recouvrirait encore « ' + conflit.title + ' ».' };
    }
    return { valid: true };
}

function v3PropositionsCreneau(ctx) {
    var duree = timeToMinutes(ctx.end) - timeToMinutes(ctx.start);
    var reveil = ctx.day === 5 ? saturdayWakeup : ctx.day === 6 ? sundayWakeup : weekdayWakeup;
    var bas = Math.max(0, timeToMinutes(reveil || '06:00'));
    var haut = Math.min(1439, timeToMinutes(bedtimeForDay(ctx.day)));
    var candidats = [], curseur;
    // Le plus proche du créneau demandé d'abord ; aucune suggestion à 06 h
    // par défaut si un créneau libre existe juste après l'activité.
    for (curseur = Math.ceil(timeToMinutes(ctx.end) / 15) * 15; curseur + duree <= haut; curseur += 15) candidats.push(curseur);
    for (curseur = Math.floor((timeToMinutes(ctx.start) - duree) / 15) * 15; curseur >= bas; curseur -= 15) candidats.push(curseur);
    var out = [];
    candidats.some(function (debut) {
        var choix = { utilisateur: { start: v3Horloge(debut), end: v3Horloge(debut + duree) } };
        if (v3VerifierChoixChevauchement(ctx, choix).valid) out.push(choix.utilisateur);
        return out.length >= 4;
    });
    return out;
}

function v3DestinationDeplacement(ctx, conflit) {
    if (ctx.conflits.length !== 1 || !v3PeutDeplacerChevauchement(conflit)) return null;
    var duree = timeToMinutes(conflit.endTime) - timeToMinutes(conflit.startTime);
    if (!(duree > 0)) return null;
    var finJour = Math.min(1439, timeToMinutes(bedtimeForDay(ctx.day)));
    for (var debut = Math.ceil(Math.max(timeToMinutes(ctx.end), timeToMinutes(conflit.endTime)) / 15) * 15;
        debut + duree <= finJour; debut += 15) {
        var choix = {
            utilisateur: { start: ctx.start, end: ctx.end },
            conflitId: conflit.id,
            autre: { start: v3Horloge(debut), end: v3Horloge(debut + duree) }
        };
        if (v3VerifierChoixChevauchement(ctx, choix).valid) return choix;
    }
    return null;
}

function v3DeplacerEvenement(ev, day, start, end) {
    if (!ev) return;
    var direct = customEvents.findIndex(function (item) { return item && item.id === ev.id && !item.replacesId; });
    if (direct !== -1) {
        customEvents[direct] = Object.assign({}, customEvents[direct], {
            startTime: start, endTime: end, pinned: true, timestamp: Date.now()
        });
        return;
    }
    customEvents = customEvents.filter(function (item) {
        return !(item && item.replacesId === ev.id && item.day === day);
    });
    customEvents.push({
        id: generateEventId(ev.type || 'activity', ev.title || 'activite', day),
        day: day, title: ev.title, startTime: start, endTime: end,
        type: ev.type || 'activity', icon: ev.icon || '📌', source: 'custom',
        replacesId: ev.id, pinned: true, timestamp: Date.now()
    });
}

function v3FermerChoixChevauchement() {
    var el = document.getElementById('chevauchementPopup');
    if (el) el.remove();
    window.__chevauchementCtx = null;
    var retour = window.__chevauchementRetourFocus;
    window.__chevauchementRetourFocus = null;
    if (retour && retour.isConnected && typeof retour.focus === 'function') retour.focus();
}

function v3DireChevauchement(message) {
    var erreur = document.getElementById('chevauchementErreur');
    if (erreur) erreur.textContent = message || '';
}

function v3AppliquerChoixChevauchement(ctx, choix) {
    var valid = v3VerifierChoixChevauchement(ctx, choix);
    if (!valid.valid) { v3DireChevauchement(valid.error); return false; }
    var depart = customEvents.slice();
    var idAffiche = '';
    try {
        if (choix.conflitId) v3DeplacerEvenement(ctx.conflits[0], ctx.day, choix.autre.start, choix.autre.end);
        if (ctx.mode === 'edition') {
            var id = editingEvent.id;
            var direct = customEvents.findIndex(function (ev) { return ev && ev.id === id && !ev.replacesId; });
            if (direct !== -1) {
                customEvents[direct] = Object.assign({}, customEvents[direct], {
                    title: ctx.title, startTime: choix.utilisateur.start, endTime: choix.utilisateur.end,
                    pinned: true, resteEcole: false, timestamp: Date.now()
                });
            } else {
                customEvents = customEvents.filter(function (ev) { return !(ev && ev.replacesId === id && ev.day === ctx.day); });
                customEvents.push({
                    id: generateEventId(ctx.type, ctx.title, ctx.day), day: ctx.day, title: ctx.title,
                    startTime: choix.utilisateur.start, endTime: choix.utilisateur.end,
                    type: ctx.type, icon: ctx.icon || '📌', source: 'custom',
                    replacesId: id, pinned: true, resteEcole: false, timestamp: Date.now()
                });
            }
            idAffiche = id;
        } else {
            idAffiche = generateEventId('activity', ctx.title, ctx.day);
            customEvents.push({ id: idAffiche, day: ctx.day, title: ctx.title,
                startTime: choix.utilisateur.start, endTime: choix.utilisateur.end,
                type: 'activity', icon: ctx.icon || '✨', source: 'custom', pinned: true, timestamp: Date.now() });
        }
        // Tester le résultat réel du moteur avant de sauvegarder. L'emploi gelé
        // n'est pas modifié si une proposition échoue.
        if (typeof emploiNePasSauver !== 'undefined') emploiNePasSauver++;
        var apres;
        try { apres = generateDayEvents(ctx.day); }
        finally { if (typeof emploiNePasSauver !== 'undefined') emploiNePasSauver--; }
        function horaireAttendu(id, plage) {
            var ev = (apres || []).find(function (item) { return item.id === id; });
            return !!(ev && ev.startTime === plage.start && ev.endTime === plage.end);
        }
        if (!horaireAttendu(idAffiche, choix.utilisateur) ||
            (choix.conflitId && !horaireAttendu(choix.conflitId, choix.autre))) {
            customEvents = depart;
            v3DireChevauchement('Le planning ne peut pas garder ces deux horaires. Choisis un autre créneau. Rien n’a été changé.');
            return false;
        }
        v3Save();
    } catch (e) {
        customEvents = depart;
        v3DireChevauchement('Impossible de sauvegarder ces horaires. Rien n’a été changé. Réessaie.');
        return false;
    }
    v3FermerChoixChevauchement();
    if (ctx.mode === 'edition') closeEditModal();
    else closeAddModal();
    if (typeof v3SyncExoLabels === 'function') v3SyncExoLabels();
    renderPlanning();
    v3Toast('✅ « ' + ctx.title + ' » placé à ' + choix.utilisateur.start +
        (choix.conflitId ? '. « ' + ctx.conflits[0].title + ' » déplacé à ' + choix.autre.start + '.' : '.') , 'success');
    return true;
}

function v3SignalerChevauchementJour(events, day) {
    var anciens = document.getElementById('chevauchementJour');
    if (anciens && anciens.parentNode) anciens.parentNode.removeChild(anciens);
    var activites = (events || []).filter(v3EstActivite);
    var conflit = null;
    var i, j;
    for (i = 0; i < activites.length && !conflit; i++) {
        for (j = i + 1; j < activites.length; j++) {
            if (v3IntervallesSeCroisent(activites[i].startTime, activites[i].endTime, activites[j].startTime, activites[j].endTime)) {
                conflit = { voulu: activites[i], autre: activites[j] };
                break;
            }
        }
    }
    if (!conflit) return;
    var barre = document.createElement('button');
    barre.type = 'button';
    barre.id = 'chevauchementJour';
    barre.style.cssText = 'width:100%;margin:0 0 0.75rem;padding:0.8rem 0.9rem;border:1.5px solid #fdba74;border-radius:0.9rem;background:#fff7ed;color:#9a3412;font-weight:800;cursor:pointer;text-align:left;';
    barre.textContent = '« ' + conflit.voulu.title + ' » et « ' + conflit.autre.title + ' » se chevauchent. Choisis un horaire sûr.';
    barre.onclick = function () {
        if (typeof openEditModal === 'function') {
            openEditModal(conflit.voulu.id, conflit.voulu.title, conflit.voulu.startTime, conflit.voulu.endTime, conflit.voulu.type || 'activity', conflit.voulu.icon, conflit.voulu);
        }
        v3OuvrirChoixChevauchement({
            mode: 'edition',
            day: day,
            title: conflit.voulu.title,
            icon: conflit.voulu.icon,
            type: conflit.voulu.type || 'activity',
            start: conflit.voulu.startTime,
            end: conflit.voulu.endTime,
            origineStart: conflit.voulu.startTime,
            origineEnd: conflit.voulu.endTime,
            excludeIds: [conflit.voulu.id],
            conflits: [conflit.autre]
        });
    };
    var conteneur = document.getElementById('eventsContainer');
    if (conteneur && conteneur.parentNode) conteneur.parentNode.insertBefore(barre, conteneur);
}

function v3OuvrirChoixChevauchement(ctx) {
    v3FermerChoixChevauchement();
    ctx.conflits = ctx.conflits || [];
    ctx.excludeIds = ctx.excludeIds || [];
    window.__chevauchementCtx = ctx;
    window.__chevauchementRetourFocus = document.activeElement;
    var jour = V3_DAY_NAMES[ctx.day] || 'ce jour';
    var duree = timeToMinutes(ctx.end) - timeToMinutes(ctx.start);
    var propositions = v3PropositionsCreneau(ctx);
    var peutDeplacer = ctx.conflits.length === 1 ? v3DestinationDeplacement(ctx, ctx.conflits[0]) : null;
    var premier = ctx.conflits[0];
    var titre = ctx.conflits.length > 1 ? 'Plusieurs créneaux se chevauchent' : 'Deux créneaux sont prévus en même temps';
    var lignes = ctx.conflits.map(function (ev) {
        var type = ev.type === 'school' ? 'Cours' : ev.type === 'transport' ? 'Trajet' :
            v3EstActivite(ev) ? 'Activité' : 'Créneau du planning';
        return '<div class="chev-carte chev-carte-deja">' +
            '<span class="chev-icone" aria-hidden="true">' + iconeHtml(ev.icon || '📌', '1.4rem') + '</span>' +
            '<div class="chev-carte-corps"><span class="chev-etiquette">' + type + ' déjà prévu</span>' +
            '<strong>' + v3Escape(ev.title) + '</strong><span>' + v3Escape(ev.startTime) + ' → ' +
            v3Escape(ev.endTime) + ' · ' + v3DureeCourte(timeToMinutes(ev.endTime) - timeToMinutes(ev.startTime)) + '</span></div></div>';
    }).join('');
    var explication = ctx.conflits.length > 1
        ? 'Ton créneau recouvre ' + ctx.conflits.length + ' autres créneaux le ' + jour + '. Choisis un horaire libre pour le placer.'
        : 'Tu veux placer « ' + v3Escape(ctx.title) + ' » le ' + jour + ', mais « ' + v3Escape(premier.title) + ' » est déjà prévu à ce moment-là.';
    var el = document.createElement('div');
    el.id = 'chevauchementPopup';
    el.className = 'chev-voile';
    el.innerHTML = '<section class="chev-dialogue" role="dialog" aria-modal="true" aria-labelledby="chevTitre" aria-describedby="chevIntro">' +
        '<div class="chev-entete"><span class="chev-symbole" aria-hidden="true">↔</span><div>' +
        '<span class="chev-etape" id="chevEtape">ÉTAPE 1 SUR 2 · CHOISIR</span>' +
        '<h2 id="chevTitre">' + titre + '</h2></div></div>' +
        '<p id="chevIntro" class="chev-intro">' + explication + ' <strong>Rien n’a été modifié pour l’instant.</strong></p>' +
        '<div id="chevauchementChoix">' +
        '<span class="chev-section">Ton choix</span><div class="chev-carte chev-carte-moi">' +
        '<span class="chev-icone" aria-hidden="true">' + iconeHtml(ctx.icon || '✨', '1.4rem') + '</span>' +
        '<div class="chev-carte-corps"><span class="chev-etiquette">' + v3Escape(jour) + ' · à placer</span>' +
        '<strong>' + v3Escape(ctx.title) + '</strong><span>' + v3Escape(ctx.start) + ' → ' + v3Escape(ctx.end) +
        ' · ' + v3DureeCourte(duree) + '</span></div></div>' +
        '<span class="chev-section">Ce qui est déjà prévu</span>' + lignes +
        '<div class="chev-actions"><button type="button" class="chev-bouton chev-bouton-vert" data-autre-creneau>Choisir un autre horaire</button>' +
        (peutDeplacer ? '<button type="button" class="chev-bouton chev-bouton-clair" data-deplacer>Garder mon horaire et déplacer ' + v3Escape(premier.title) + '</button>' : '') +
        '<button type="button" class="chev-bouton chev-bouton-lien" data-annuler>Annuler · ne rien changer</button></div>' +
        (!peutDeplacer ? '<p class="chev-note">' + (ctx.conflits.length > 1
            ? 'Plusieurs créneaux sont concernés : ils ne seront pas déplacés automatiquement.'
            : v3PeutDeplacerChevauchement(premier)
                ? 'Aucun horaire sûr n’a été trouvé après ton créneau pour déplacer cette activité.'
                : 'Ce créneau ne peut pas être déplacé automatiquement.') + '</p>' : '') +
        '<div id="chevauchementAutres" hidden><span class="chev-section">Même durée · ' + v3DureeCourte(duree) + '</span>' +
        '<div class="chev-propositions" data-propositions></div>' +
        '<label class="chev-libelle" for="chevauchementDebut">Ou choisis l’heure de début</label>' +
        '<div class="chev-manuel"><input id="chevauchementDebut" type="time" value="' + v3Escape(ctx.start) + '">' +
        '<span>Fin : <strong id="chevauchementFin"></strong></span></div>' +
        '<button type="button" class="chev-bouton chev-bouton-clair" data-placer>Vérifier cet horaire</button></div>' +
        '</div>' +
        '<div id="chevauchementApercu" hidden></div>' +
        '<p id="chevauchementErreur" class="chev-erreur" role="alert" aria-live="assertive"></p>' +
        '</section>';
    document.body.appendChild(el);
    var zoneProps = el.querySelector('[data-propositions]');
    if (!propositions.length) zoneProps.textContent = 'Aucun horaire libre de cette durée n’a été trouvé. Tu peux saisir un autre début ou annuler.';
    propositions.forEach(function (plage) {
        var bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'chev-proposition';
        bouton.textContent = plage.start + ' → ' + plage.end;
        bouton.onclick = function () { apercu({ utilisateur: plage }); };
        zoneProps.appendChild(bouton);
    });
    function majFin() {
        var debut = el.querySelector('#chevauchementDebut').value;
        var mins = debut ? timeToMinutes(debut) + duree : 1440;
        el.querySelector('#chevauchementFin').textContent = mins < 1440 ? v3Horloge(mins) : 'jour suivant (impossible)';
    }
    function apercu(choix) {
        var valid = v3VerifierChoixChevauchement(ctx, choix);
        if (!valid.valid) { v3DireChevauchement(valid.error); return; }
        v3DireChevauchement('');
        ctx.choix = choix;
        var partie = el.querySelector('#chevauchementApercu');
        var autre = ctx.conflits[0];
        var ancienDebut = ctx.mode === 'edition' ? ctx.origineStart : ctx.start;
        var ancienneFin = ctx.mode === 'edition' ? ctx.origineEnd : ctx.end;
        var doublon = ctx.mode === 'ajout' && typeof v3FindDuplicate === 'function' ? v3FindDuplicate(ctx.day, ctx.title, 'activity') : null;
        partie.innerHTML = '<span class="chev-section">Vérifie avant de confirmer</span>' +
            '<div class="chev-ligne"><strong>' + v3Escape(ctx.title) + '</strong><span>' + v3Escape(ancienDebut) + ' → ' +
            v3Escape(ancienneFin) + '</span><b>→ ' + v3Escape(choix.utilisateur.start) + ' → ' + v3Escape(choix.utilisateur.end) + '</b></div>' +
            (choix.conflitId ? '<div class="chev-ligne"><strong>' + v3Escape(autre.title) + '</strong><span>' +
                v3Escape(autre.startTime) + ' → ' + v3Escape(autre.endTime) + '</span><b>→ ' +
                v3Escape(choix.autre.start) + ' → ' + v3Escape(choix.autre.end) + '</b></div>' : '') +
            '<p class="chev-note">La durée demandée est conservée. Aucun autre créneau choisi ne sera décalé.</p>' +
            (doublon ? '<p class="chev-note">Attention : une activité nommée « ' + v3Escape(ctx.title) + ' » existe déjà ce jour. Confirmer l’ajoutera quand même.</p>' : '') +
            '<div class="chev-actions"><button type="button" class="chev-bouton chev-bouton-vert" data-confirmer>Confirmer ces horaires</button>' +
            '<button type="button" class="chev-bouton chev-bouton-clair" data-retour>Retour aux choix</button>' +
            '<button type="button" class="chev-bouton chev-bouton-lien" data-annuler>Annuler · ne rien changer</button></div>';
        el.querySelector('#chevauchementChoix').hidden = true;
        partie.hidden = false;
        el.querySelector('#chevEtape').textContent = 'ÉTAPE 2 SUR 2 · VÉRIFIER';
        partie.querySelector('[data-confirmer]').onclick = function () {
            if (!v3AppliquerChoixChevauchement(ctx, choix)) retour();
        };
        partie.querySelector('[data-retour]').onclick = retour;
        partie.querySelector('[data-annuler]').onclick = v3FermerChoixChevauchement;
        partie.querySelector('[data-confirmer]').focus();
    }
    function retour() {
        el.querySelector('#chevauchementApercu').hidden = true;
        el.querySelector('#chevauchementChoix').hidden = false;
        el.querySelector('#chevEtape').textContent = 'ÉTAPE 1 SUR 2 · CHOISIR';
        el.querySelector('[data-autre-creneau]').focus();
    }
    el.querySelector('[data-autre-creneau]').onclick = function () {
        el.querySelector('#chevauchementAutres').hidden = false;
        el.querySelector('#chevauchementDebut').focus();
    };
    if (peutDeplacer) el.querySelector('[data-deplacer]').onclick = function () { apercu(peutDeplacer); };
    el.querySelector('#chevauchementDebut').addEventListener('input', majFin);
    el.querySelector('[data-placer]').onclick = function () {
        var debut = el.querySelector('#chevauchementDebut').value;
        var fin = debut && timeToMinutes(debut) + duree < 1440 ? v3Horloge(timeToMinutes(debut) + duree) : '';
        apercu({ utilisateur: { start: debut, end: fin } });
    };
    el.querySelector('[data-annuler]').onclick = v3FermerChoixChevauchement;
    el.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { event.preventDefault(); v3FermerChoixChevauchement(); }
        if (event.key !== 'Tab') return;
        var actifs = Array.from(el.querySelectorAll('button:not([hidden]), input:not([hidden])')).filter(function (item) {
            return item.getClientRects().length > 0;
        });
        if (!actifs.length) return;
        var first = actifs[0], last = actifs[actifs.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    el.addEventListener('click', function (event) { if (event.target === el) v3FermerChoixChevauchement(); });
    majFin();
    el.querySelector('[data-autre-creneau]').focus();
}

// ═══════════════════════════════════════════════════════════════════
//  4. DÉPLACEMENT D'UNE ACTIVITÉ DANS LA JOURNÉE
//  Un clic droit sur une activité fait apparaître une poignée : on la
//  fait glisser sur une autre activité pour lui donner son heure de
//  début. La durée ne change jamais : seules les heures de début et de
//  fin suivent. Rien n'est annoncé : si l'endroit est impossible
//  (pendant les cours, au-delà de minuit), l'activité ne bouge pas.
// ═══════════════════════════════════════════════════════════════════
var v3DeplaceIdx = -1;
var v3DeplaceEnCours = false;
var v3DeplaceCibleIdx = -1;

function v3CarteEvenement(idx) {
    var conteneur = document.getElementById('eventsContainer');
    if (!conteneur || !(idx >= 0)) return null;
    return conteneur.querySelector('[data-v3-idx="' + idx + '"]');
}

function v3EvenementAffiche(idx) {
    if (typeof v3LastRendered === 'undefined' || !v3LastRendered) return null;
    return v3LastRendered[idx] || null;
}

function v3CarteDeplacable(carte) {
    if (!carte) return false;
    var idx = parseInt(carte.getAttribute('data-v3-idx'), 10);
    var ev = v3EvenementAffiche(idx);
    return !!(ev && ev.editable);
}

function v3RetirerPoignee() {
    document.querySelectorAll('#eventsContainer .v3-pouce').forEach(function (el) {
        if (el.parentNode) el.parentNode.removeChild(el);
    });
    ['v3-carte-deplace', 'v3-carte-cible', 'v3-carte-glisse'].forEach(function (classe) {
        document.querySelectorAll('#eventsContainer .' + classe).forEach(function (el) {
            el.classList.remove(classe);
        });
    });
    document.body.classList.remove('v3-deplacement');
    v3DeplaceEnCours = false;
    v3DeplaceCibleIdx = -1;
}

function v3PoserPoignee(idx) {
    v3RetirerPoignee();
    var carte = v3CarteEvenement(idx);
    if (!v3CarteDeplacable(carte)) return;
    v3DeplaceIdx = idx;
    carte.classList.add('v3-carte-deplace');
    var pouce = document.createElement('button');
    pouce.type = 'button';
    pouce.className = 'v3-pouce';
    pouce.setAttribute('data-v3-pouce', String(idx));
    pouce.setAttribute('aria-label', 'Déplacer');
    pouce.textContent = '👍';
    pouce.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
    });
    pouce.addEventListener('pointerdown', v3DemarrerDeplacement);
    carte.appendChild(pouce);
}

function v3DemarrerDeplacement(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    var pouce = event.currentTarget;
    var idx = parseInt(pouce.getAttribute('data-v3-pouce'), 10);
    if (!(idx >= 0)) return;
    event.preventDefault();
    event.stopPropagation();
    v3DeplaceIdx = idx;
    v3DeplaceEnCours = true;
    v3DeplaceCibleIdx = -1;
    document.body.classList.add('v3-deplacement');
    var carte = v3CarteEvenement(idx);
    if (carte) carte.classList.add('v3-carte-glisse');
    document.addEventListener('pointermove', v3PendantDeplacement, true);
    document.addEventListener('pointerup', v3TerminerDeplacement, true);
    document.addEventListener('pointercancel', v3FermerDeplacement, true);
}

function v3CarteSousPointeur(clientX, clientY) {
    var conteneur = document.getElementById('eventsContainer');
    if (!conteneur) return null;
    var meilleure = null;
    var meilleureDistance = Infinity;
    var meilleureHauteur = 0;
    conteneur.querySelectorAll('[data-v3-idx]').forEach(function (carte) {
        var idx = parseInt(carte.getAttribute('data-v3-idx'), 10);
        if (idx === v3DeplaceIdx) return;
        if (!v3CarteDeplacable(carte)) return;
        var rect = carte.getBoundingClientRect();
        if (!rect.height) return;
        var dx = 0;
        if (clientX < rect.left) dx = rect.left - clientX;
        else if (clientX > rect.right) dx = clientX - rect.right;
        var dy = Math.abs(clientY - (rect.top + rect.height / 2));
        var distance = dy + dx * 0.7;
        if (distance < meilleureDistance) {
            meilleureDistance = distance;
            meilleure = carte;
            meilleureHauteur = rect.height;
        }
    });
    if (!meilleure) return null;
    if (meilleureDistance > meilleureHauteur * 1.35 + 40) return null;
    return meilleure;
}

function v3PendantDeplacement(event) {
    if (!v3DeplaceEnCours) return;
    event.preventDefault();
    var carte = v3CarteSousPointeur(event.clientX, event.clientY);
    var idx = carte ? parseInt(carte.getAttribute('data-v3-idx'), 10) : -1;
    if (idx === v3DeplaceCibleIdx) return;
    document.querySelectorAll('#eventsContainer .v3-carte-cible').forEach(function (el) {
        el.classList.remove('v3-carte-cible');
    });
    v3DeplaceCibleIdx = idx;
    if (carte) carte.classList.add('v3-carte-cible');
}

function v3FermerDeplacement() {
    document.removeEventListener('pointermove', v3PendantDeplacement, true);
    document.removeEventListener('pointerup', v3TerminerDeplacement, true);
    document.removeEventListener('pointercancel', v3FermerDeplacement, true);
    v3RetirerPoignee();
}

function v3TerminerDeplacement() {
    if (!v3DeplaceEnCours) {
        v3FermerDeplacement();
        return;
    }
    var source = v3DeplaceIdx;
    var cible = v3DeplaceCibleIdx;
    v3FermerDeplacement();
    if (source >= 0 && cible >= 0) v3DonnerHoraireCible(source, cible);
}

// L'activité garde exactement la même durée : elle prend l'heure de début
// de l'activité visée, et l'heure de fin suit.
function v3DonnerHoraireCible(sourceIdx, cibleIdx) {
    var voulu = v3EvenementAffiche(sourceIdx);
    var cible = v3EvenementAffiche(cibleIdx);
    if (!voulu || !cible || !voulu.editable) return false;
    if (voulu.startTime === cible.startTime) return false;
    var duree = timeToMinutes(voulu.endTime) - timeToMinutes(voulu.startTime);
    if (!(duree > 0)) return false;
    var debut = cible.startTime;
    var finMins = timeToMinutes(debut) + duree;
    if (finMins >= 1440) return false;
    var fin = addMinutes('00:00', finMins);
    var validation = validateNewEventTime(debut, fin, selectedDay);
    if (!validation || !validation.valid) return false;
    if (typeof v3DeplacerEvenement !== 'function') return false;
    v3DeplacerEvenement(voulu, selectedDay, debut, fin);
    if (voulu.exoId && typeof customEvents !== 'undefined') {
        customEvents.forEach(function (item) {
            if (item && item.replacesId === voulu.id && item.day === selectedDay && !item.exoId) item.exoId = voulu.exoId;
        });
    }
    try { localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(customEvents)); } catch (e) {}
    if (typeof v3Save === 'function') v3Save();
    if (typeof v3SyncExoLabels === 'function') { try { v3SyncExoLabels(); } catch (e) {} }
    if (typeof renderPlanning === 'function') renderPlanning();
    return true;
}

(function v3BrancherDeplacement() {
    if (typeof document === 'undefined' || window.__v3DeplacementBranche) return;
    window.__v3DeplacementBranche = true;
    document.addEventListener('contextmenu', function (event) {
        var carte = event.target && event.target.closest ? event.target.closest('#eventsContainer [data-v3-idx]') : null;
        if (!carte || !v3CarteDeplacable(carte)) return;
        event.preventDefault();
        v3PoserPoignee(parseInt(carte.getAttribute('data-v3-idx'), 10));
    });
    document.addEventListener('pointerdown', function (event) {
        if (v3DeplaceEnCours || v3DeplaceIdx < 0) return;
        var dansPoignee = event.target && event.target.closest ? event.target.closest('#eventsContainer .v3-pouce') : null;
        if (dansPoignee) return;
        var carte = event.target && event.target.closest ? event.target.closest('#eventsContainer [data-v3-idx]') : null;
        if (carte && parseInt(carte.getAttribute('data-v3-idx'), 10) === v3DeplaceIdx) return;
        v3DeplaceIdx = -1;
        v3RetirerPoignee();
    }, true);
    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape' || v3DeplaceIdx < 0) return;
        v3DeplaceIdx = -1;
        v3FermerDeplacement();
    });
})();

/* L'icône de la semaine est posée dès le chargement, sans attendre le planning. */
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', v3PeindreIconeActivites);
    else v3PeindreIconeActivites();
}
