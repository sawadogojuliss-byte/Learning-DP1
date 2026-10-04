/* ============================================================
   PAGE Planning — moteur
   Placement des créneaux, fixations, conflits et chevauchements.
   Vue : pages/planning.html
   ============================================================ */

// ═══════════════════════════════════════════════════════════════════
//  index_v3.js — Study Plan IB
//
//  1. Méthode Pomodoro intégrée aux sessions d'étude (révisions / exercices)
//  2. Signalement des doublons quand l'élève planifie une activité
//     identique à une activité déjà existante
//  3. Moteur de modification du planning fiable :
//     - les modifications (durée, nom, heure de début) sont bien appliquées,
//       y compris lors d'une 2e modification du même créneau
//     - la suppression fonctionne pour tous les créneaux modifiables (avec Annuler)
//     - une heure de début choisie par l'élève est respectée (créneau « fixé » 📌),
//       les créneaux automatiques s'organisent autour
//     - détection des chevauchements avec les cours / trajets / créneaux fixés
//
//  Ce fichier surcharge uniquement les fonctions concernées de index_v1.js
//  et index_v2.js (mêmes noms de fonctions → la dernière définition gagne).
// ═══════════════════════════════════════════════════════════════════

const V3_STORAGE_KEY = 'studyPlanIB_customEvents_juliss';
const V3_STUDY_TYPES = ['study', 'critical', 'warning', 'ia', 'memoir'];
// Types de créneaux automatiques autorisés à « avancer » pour combler un trou
// devant un créneau fixé (jamais les repas, trajets, téléphone, préparation).
const V3_PULLABLE_TYPES = new Set(['study', 'critical', 'warning', 'activity', 'free']);
const V3_DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// ── PETITS UTILITAIRES ──────────────────────────────────────────────
function v3IsStudyType(type) { return V3_STUDY_TYPES.includes(type); }
function v3M2T(mins) { return addMinutes('00:00', Math.max(0, Math.round(mins))); }
function v3Save() { localStorage.setItem(V3_STORAGE_KEY, JSON.stringify(customEvents)); }
function v3Escape(str) {
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function v3Normalize(str) {
    return String(str == null ? '' : str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ').trim();
}
// Clé de comparaison d'une session d'étude : « Révisions Maths » ≡ « Révision Maths »
function v3StudyKey(title) {
    return v3Normalize(title).replace(/^revisions? /, 'revision ').replace(/^exercices? /, 'exercices ');
}
function v3DurLabel(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    return (h > 0 ? h + 'h' : '') + (m > 0 ? (h > 0 ? String(m).padStart(2, '0') : m + ' min') : (h > 0 ? '' : '0 min'));
}
// Dernière modification enregistrée pour un créneau généré (id) un jour donné
function v3FindOverride(id, day) {
    for (let i = customEvents.length - 1; i >= 0; i--) {
        const e = customEvents[i];
        if (e && e.replacesId === id && e.day === day) return e;
    }
    return null;
}
function v3IsPinnedRecord(e) { return !!e && !e.deleted && (!e.replacesId || !!e.pinned); }
// Un exercice dont le créneau a été retiré du planning n'est plus « Planifié »
function v3SyncExoLabels() {
    if (typeof exercices === 'undefined' || !Array.isArray(exercices)) return;
    let changed = false;
    exercices.forEach(exo => {
        if (exo.scheduledSlot && !customEvents.some(e => e && e.exoId === exo.id)) { exo.scheduledSlot = null; changed = true; }
    });
    if (changed) {
        localStorage.setItem('studyPlanIB_exercices', JSON.stringify(exercices));
        if (typeof renderExoList === 'function' && document.getElementById('exoListContainer')) { renderExoList(); renderPlanifier(); }
    }
}

// ── TOAST (avec bouton Annuler optionnel) ───────────────────────────
function v3Toast(msg, kind, opts) {
    opts = opts || {};
    document.querySelectorAll('.v3-toast').forEach(t => t.remove());
    const colors = {
        success: 'linear-gradient(to right,#10b981,#059669)',
        warn: 'linear-gradient(to right,#f59e0b,#d97706)',
        error: 'linear-gradient(to right,#ef4444,#dc2626)',
        info: 'linear-gradient(to right,#3b82f6,#2563eb)'
    };
    const toast = document.createElement('div');
    toast.className = 'v3-toast';
    toast.style.background = colors[kind] || colors.success;
    const span = document.createElement('span');
    span.textContent = msg;
    toast.appendChild(span);
    if (typeof opts.undo === 'function') {
        const btn = document.createElement('button');
        btn.className = 'v3-toast-btn';
        btn.textContent = '↩ Annuler';
        btn.onclick = function () { toast.remove(); opts.undo(); };
        toast.appendChild(btn);
    }
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), opts.duration || (opts.undo ? 6000 : 3200));
}

// ═══════════════════════════════════════════════════════════════════
//  3. MOTEUR DE PLANIFICATION (surcharge de generateDayEvents)
//
//  Chaque créneau a un « kind » :
//   - fixed   : cours (non modifiables) — ne bougent jamais
//   - pinned  : créneau dont l'élève a choisi l'heure (ajout manuel, exercice
//               planifié, ou heure de début modifiée) — respecté tel quel
//   - flex    : créneau automatique — s'enchaîne après le précédent
//   - elastic : temps libre du week-end — remplit jusqu'à 19h00
// ═══════════════════════════════════════════════════════════════════
let holidayBypass = false;

function generateDayEvents(dayIndex) {
    const isWeekend = dayIndex >= 5;
    const isSaturday = dayIndex === 5;
    const isSunday = dayIndex === 6;
    const wakeupTime = isWeekend ? (isSaturday ? saturdayWakeup : sundayWakeup) : weekdayWakeup;
    const bedtime = (typeof bedtimeForDay === 'function') ? bedtimeForDay(dayIndex) : calculateBedtime(wakeupTime);
    const hMode = holidayBypass ? null : ((typeof holidayMode === 'function') ? holidayMode(dayIndex) : null);
    if (hMode === 'free') return [];

    const events = [];
    let cursor = wakeupTime;

    // Chargement des modifications sauvegardées (comme avant)
    const savedEvents = localStorage.getItem(V3_STORAGE_KEY);
    if (savedEvents && customEvents.length === 0) {
        try { customEvents = JSON.parse(savedEvents) || []; } catch (e) { customEvents = []; }
    }

    const ovFor = (id) => v3FindOverride(id, dayIndex);

    // Créneau automatique : commence au curseur. Applique la modification de
    // l'élève si elle existe (nom, icône, durée, heure fixée, suppression).
    function chain(id, title, subtitle, duration, type, icon, editable) {
        const ov = ovFor(id);
        if (ov && ov.deleted) return cursor; // supprimé pour ce jour
        let pinned = false, startTime = cursor;
        if (ov) {
            if (ov.title) title = ov.title;
            if (ov.icon && ov.icon !== '📌') icon = ov.icon;
            const ovDur = timeToMinutes(ov.endTime) - timeToMinutes(ov.startTime);
            if (ovDur > 0) duration = ovDur;
            if (ov.pinned && ov.startTime) { pinned = true; startTime = ov.startTime; }
        }
        const endTime = addMinutes(startTime, duration);
        events.push({ id, title, subtitle, startTime, endTime, type, icon, editable, kind: pinned ? 'pinned' : 'flex' });
        if (!pinned) cursor = endTime; // un créneau fixé ne décale pas la chaîne nominale
        return cursor;
    }

    // Temps libre élastique (week-end) : remplit jusqu'à `endMins` (19h00)
    function elastic(id, title, type, icon, endMins) {
        const ov = ovFor(id);
        const endTime = v3M2T(endMins);
        if (ov && !ov.deleted) { chain(id, title, '', 60, type, icon, true); return; } // devenu un créneau normal
        events.push({ id, title, subtitle: '', startTime: cursor, endTime, type, icon, editable: true,
            kind: 'elastic', elasticEnd: endMins, hidden: !!(ov && ov.deleted) });
        if (timeToMinutes(cursor) < endMins) cursor = endTime;
    }

    // Créneau fixe (cours) : heure imposée
    function fixed(id, title, subtitle, start, end, type, icon) {
        events.push({ id, title, subtitle, startTime: start, endTime: end, type, icon, editable: false, kind: 'fixed' });
        cursor = end;
    }

    const allSubj = [...subjects, ...optionalSubjects];
    const phoneTime = phoneDays.includes(dayIndex) ? (samePhoneDuration ? phoneDuration : phoneDayDurations[dayIndex] || 60) : 0;

    // ── RÉVEIL ──
    const wakeupEvt = { id: 'wakeup', title: 'Réveil', subtitle: '', startTime: wakeupTime, endTime: addMinutes(wakeupTime, 10), type: 'wakeup', icon: '🌅', editable: false, kind: 'fixed' };
    cursor = wakeupEvt.endTime;

    chain('breakfast', 'Petit-déjeuner', '', 30, 'meal', '🥐', true);

    if (isSunday) {
        chain('prep', 'Préparation', '', 30, 'prep', '🚿', true);
        const s1 = allSubj[0];
        if (s1) chain('study1', 'Révisions ' + s1.name, s1.level + ' · ' + s1.grade + '/7', s1.level === 'HL' ? 90 : 60, getStudyColor(s1.grade), s1.icon, true);
        chain('lunch', 'Déjeuner', '', 60, 'meal', '🍽️', true);
        const s2 = allSubj[1];
        if (s2) chain('study2', 'Révisions ' + s2.name, s2.level + ' · ' + s2.grade + '/7', s2.level === 'HL' ? 90 : 60, getStudyColor(s2.grade), s2.icon, true);
        fixed('dinner', 'Dîner', '', '19:00', '19:45', 'meal', '🍝');
        if (phoneTime > 0) chain('phone', 'Téléphone', formatDuration(phoneTime), phoneTime, 'phone', '📱', true);

    } else if (isSaturday) {
        const saturdayClass = !(typeof studentTakesEconomics === 'function' && studentTakesEconomics());
        const commuteToSchool = (typeof transportMode !== 'undefined' && transportMode === 'moto') ? (motoToSchool || 25) : (carToSchool || 30);
        const commuteFromSchool = (typeof transportMode !== 'undefined' && transportMode === 'moto') ? (motoFromSchool || 25) : (carFromSchool || 40);
        const commuteIcon = (typeof transportMode !== 'undefined' && transportMode === 'moto') ? '🏍️' : '🚗';
        chain('prep', 'Préparation', '', 30, 'prep', '🚿', true);
        if (saturdayClass) {
            chain('commute1', 'Trajet école', commuteToSchool + ' min', commuteToSchool, 'transport', commuteIcon, true);
            fixed('eco', "Cours d'Économie", '8h30 → 10h30', '08:30', '10:30', 'school', '💹');
            chain('commute2', 'Trajet maison', commuteFromSchool + ' min', commuteFromSchool, 'transport', commuteIcon, true);
        }
        const s1 = allSubj[0];
        if (s1) chain('study1', 'Révisions ' + s1.name, s1.level + ' · ' + s1.grade + '/7', s1.level === 'HL' ? 90 : 60, getStudyColor(s1.grade), s1.icon, true);
        chain('lunch', 'Déjeuner', '', 60, 'meal', '🍽️', true);
        const s2 = allSubj[1];
        if (s2) chain('study2', 'Révisions ' + s2.name, s2.level + ' · ' + s2.grade + '/7', s2.level === 'HL' ? 90 : 60, getStudyColor(s2.grade), s2.icon, true);
        fixed('dinner', 'Dîner', '', '19:00', '19:45', 'meal', '🍝');
        if (phoneTime > 0) chain('phone', 'Téléphone', formatDuration(phoneTime), phoneTime, 'phone', '📱', true);

    } else {
        // ── SEMAINE Lun-Ven ──
        const commuteToSchool = (typeof transportMode !== 'undefined' && transportMode === 'moto') ? (motoToSchool || 25) : (carToSchool || 30);
        const commuteFromSchool = (typeof transportMode !== 'undefined' && transportMode === 'moto') ? (motoFromSchool || 25) : (carFromSchool || 40);
        const commuteIcon = (typeof transportMode !== 'undefined' && transportMode === 'moto') ? '🏍️' : '🚗';
        chain('prep', 'Préparation', '', 30, 'prep', '🚿', true);
        chain('commute1', 'Trajet école', commuteToSchool + ' min', commuteToSchool, 'transport', commuteIcon, true);
        fixed('school1', 'Cours', '8h15 → 12h30', '08:15', '12:30', 'school', '🏫');
        fixed('lunch', 'Déjeuner', '', '12:30', '13:30', 'meal', '🍽️');
        fixed('school2', 'Cours', '13h30 → 16h35', '13:30', '16:35', 'school', '🏫');
        chain('commute2', 'Trajet maison', commuteFromSchool + ' min', commuteFromSchool, 'transport', commuteIcon, true);
        const mainSubj = allSubj[dayIndex % allSubj.length];
        if (mainSubj) chain('study1', 'Révisions ' + mainSubj.name, mainSubj.level + ' · ' + mainSubj.grade + '/7', mainSubj.level === 'HL' ? 90 : 60, getStudyColor(mainSubj.grade), mainSubj.icon, true);
        const sciNames = ['Mathématiques', 'Physique', 'Chimie', 'Biologie'];
        const sciSubj = allSubj.filter(s => sciNames.some(n => s.name.includes(n)));
        const mainIsSci = mainSubj && sciNames.some(n => mainSubj.name.includes(n));
        if (sciSubj.length > 0 && !mainIsSci) {
            const exSubj = sciSubj[dayIndex % sciSubj.length];
            chain('exercises', 'Exercices ' + exSubj.name, exSubj.level + ' · ' + exSubj.grade + '/7', exSubj.level === 'HL' ? 45 : 30, getStudyColor(exSubj.grade), '✏️', true);
        }
        chain('dinner', 'Dîner', '', 45, 'meal', '🍝', true);
        if (phoneTime > 0) chain('phone', 'Téléphone', formatDuration(phoneTime), Math.min(phoneTime, 60), 'phone', '📱', true);
    }

    // ── ACTIVITÉS EXTRASCOLAIRES (configurées à l'inscription) ──
    selectedActivities.forEach(activity => {
        if (!activity.days.includes(dayIndex)) return;
        const id = 'activity-' + activity.name;
        const ov = ovFor(id);
        if (ov && ov.deleted) return;
        let title = activity.name, icon = activity.icon;
        let startTime = activity.sameTime ? activity.startTime : (activity.dayTimes[dayIndex] ? activity.dayTimes[dayIndex].start : '17:00');
        let endTime = activity.sameTime ? activity.endTime : (activity.dayTimes[dayIndex] ? activity.dayTimes[dayIndex].end : '19:00');
        let kind = 'flex';
        if (ov) {
            if (ov.title) title = ov.title;
            if (ov.icon && ov.icon !== '📌') icon = ov.icon;
            const ovDur = timeToMinutes(ov.endTime) - timeToMinutes(ov.startTime);
            if (ov.pinned && ov.startTime) { kind = 'pinned'; startTime = ov.startTime; endTime = ov.endTime; }
            else if (ovDur > 0) endTime = addMinutes(startTime, ovDur);
        }
        events.push({ id, title, subtitle: 'Activité', startTime, endTime, type: 'activity', icon, editable: true, kind });
    });

    // ── CRÉNEAUX AJOUTÉS PAR L'ÉLÈVE (heure choisie → fixés 📌) ──
    customEvents.filter(e => e && e.day === dayIndex && !e.replacesId && !e.deleted).forEach(event => {
        events.push({ id: event.id, title: event.title, subtitle: '', startTime: event.startTime, endTime: event.endTime,
            type: event.type, icon: event.icon || '📌', editable: true, kind: 'pinned', source: event.source, exoId: event.exoId });
    });

    // ── COUCHER ──
    const sleepLabel = (typeof sleepHoursForDay === 'function' && typeof formatSleepHours === 'function')
        ? formatSleepHours(sleepHoursForDay(dayIndex)) + ' de sommeil'
        : 'Sommeil';
    const sleepEvt = { id: 'sleep', title: 'Coucher', subtitle: sleepLabel, startTime: bedtime, endTime: wakeupTime, type: 'sleep', icon: '😴', editable: false, kind: 'fixed' };

    let scheduled = v3Schedule(events, wakeupEvt);
    scheduled = closeProgramGaps(scheduled, bedtime, dayIndex);
    if (hMode === 'light' && typeof holidayDroppedIds === 'function') {
        const dropped = new Set(holidayDroppedIds(dayIndex));
        scheduled = scheduled.filter(function (ev) { return !dropped.has(ev.id); });
    }
    return [wakeupEvt, ...scheduled, sleepEvt];
}

function slotWasRemoved(dayIndex, id) {
    return customEvents.some(function (e) { return e && e.day === dayIndex && e.replacesId === id && e.deleted; });
}

function closeProgramGaps(events, bedtime, dayIndex) {
    const items = events.slice().sort(function (a, b) { return timeToMinutes(a.startTime) - timeToMinutes(b.startTime); });
    if (!items.length) return items;
    const phoneIdx = items.findIndex(function (ev) { return ev.id === 'phone' || ev.type === 'phone'; });
    let budget = slotWasRemoved(dayIndex, 'freetime') ? 0 : (typeof freeMinutesForDay === 'function' ? freeMinutesForDay(dayIndex) : 60);
    let freePlaced = false;
    const academicSeq = { n: dayIndex % 2, memoir: 0, ia: 0, rev: 0 };
    const out = [];

    function clock(mins) {
        return addMinutes('00:00', ((mins % 1440) + 1440) % 1440);
    }
    function addGap(start, end, canUseFree) {
        if (end - start < 15) return;
        let cursor = start;
        if (canUseFree && !freePlaced && budget >= 15) {
            const dur = Math.min(budget, end - cursor);
            if (dur >= 15) {
                out.push({
                    id: 'freetime',
                    title: 'Temps libre',
                    subtitle: typeof formatDuration === 'function' ? formatDuration(dur) : dur + ' min',
                    startTime: clock(cursor),
                    endTime: clock(cursor + dur),
                    type: 'free',
                    icon: '🎮',
                    editable: true,
                    kind: 'flex'
                });
                cursor += dur;
                budget -= dur;
                freePlaced = true;
            }
        }
        if (end - cursor >= 15) {
            academicGapBlocks(cursor, end, dayIndex, academicSeq).forEach(function (block) {
                if (slotWasRemoved(dayIndex, block.id)) return;
                out.push(block);
            });
        }
    }

    for (let i = 0; i < items.length; i++) {
        if (i > 0) {
            const prevEnd = timeToMinutes(items[i - 1].endTime);
            const start = timeToMinutes(items[i].startTime);
            if (start > prevEnd) addGap(prevEnd, start, phoneIdx >= 0 ? i - 1 >= phoneIdx : false);
        }
        out.push(items[i]);
    }

    const lastEnd = timeToMinutes(items[items.length - 1].endTime);
    let bedEnd = timeToMinutes(bedtime);
    if (bedEnd <= lastEnd) {
        if (bedEnd + 12 * 60 <= lastEnd) bedEnd += 1440;
        else return out;
    }
    if (bedEnd > lastEnd) addGap(lastEnd, bedEnd, true);
    return out;
}

function academicGapBlocks(start, end, dayIndex, seq) {
    const all = [];
    if (typeof subjects !== 'undefined' && subjects) all.push.apply(all, subjects);
    if (typeof optionalSubjects !== 'undefined' && optionalSubjects) all.push.apply(all, optionalSubjects);
    const turn = seq || { n: 0, memoir: 0, ia: 0, rev: 0 };
    const weekend = dayIndex === 5 || dayIndex === 6;
    const blocks = [];
    let cursor = start;
    function clock(mins) {
        return addMinutes('00:00', ((mins % 1440) + 1440) % 1440);
    }
    while (end - cursor >= 15) {
        const cap = weekend ? 90 : 75;
        let dur = Math.min(cap, end - cursor);
        const remain = end - (cursor + dur);
        if (remain > 0 && remain < 20) dur += remain;
        let kind = (all.length === 0 || turn.n % 2 === 1) ? 'memoir' : 'ia';
        if (weekend) {
            if (dur >= 45 && turn.memoir < 1) kind = 'memoir';
            else if (dur >= 45 && turn.ia < 1) kind = 'ia';
            else kind = 'revision';
        }
        const subj = all.length ? all[(dayIndex + (kind === 'revision' ? turn.rev : Math.floor(turn.n / 2))) % all.length] : null;
        var tachePlan = null;
        if ((kind === 'memoir' || kind === 'ia') && typeof eeProchaineTache === 'function') tachePlan = eeProchaineTache(dayIndex, turn);
        if (tachePlan && typeof eeBlocTache === 'function') {
            if (tachePlan.kind === 'memoir') turn.memoir++;
            else turn.ia++;
            blocks.push(eeBlocTache(tachePlan, cursor, dur, clock));
        } else if (kind === 'memoir') {
            turn.memoir++;
            blocks.push({
                id: 'memoir-' + cursor,
                title: 'Mémoire',
                subtitle: typeof memoirLevelLabel === 'function' ? memoirLevelLabel() : 'Recherche et rédaction',
                startTime: clock(cursor),
                endTime: clock(cursor + dur),
                type: 'memoir',
                icon: '📖',
                editable: true,
                kind: 'flex'
            });
        } else if (kind === 'ia' && subj) {
            turn.ia++;
            blocks.push({
                id: 'ia-' + cursor,
                title: 'Évaluation interne · ' + subj.name,
                subtitle: (typeof iaLevelLabel === 'function' ? iaLevelLabel(subj.name) : 'critères et brouillon'),
                startTime: clock(cursor),
                endTime: clock(cursor + dur),
                type: 'ia',
                icon: subj.icon || '📋',
                editable: true,
                kind: 'flex'
            });
        } else {
            turn.rev++;
            blocks.push({
                id: 'revgap-' + cursor,
                title: subj ? 'Révisions · ' + subj.name : 'Révisions',
                subtitle: subj && subj.level ? subj.level + ' · cours et exercices' : 'Cours et exercices',
                startTime: clock(cursor),
                endTime: clock(cursor + dur),
                type: subj && typeof getStudyColor === 'function' ? getStudyColor(subj.grade) : 'study',
                icon: subj && subj.icon ? subj.icon : '📚',
                editable: true,
                kind: 'flex'
            });
        }
        cursor += dur;
        turn.n++;
    }
    return blocks;
}

function normalDayEvents(dayIndex) {
    holidayBypass = true;
    try { return generateDayEvents(dayIndex); }
    finally { holidayBypass = false; }
}

// Ordonnancement : les créneaux fixes/fixés gardent leur heure, les créneaux
// automatiques s'enchaînent autour, le temps libre remplit jusqu'à 19h00.
function v3Schedule(dayEvents, wakeupEvt) {
    const t = timeToMinutes;
    const rank = (e) => (e.kind === 'fixed' ? 0 : 1);
    const blocks = dayEvents.filter(e => e.kind === 'fixed' || e.kind === 'pinned').map(e => ({ ...e }));
    blocks.sort((a, b) => t(a.startTime) - t(b.startTime) || rank(a) - rank(b));

    // Sécurité : un créneau fixé qui chevauche un autre bloc est repoussé juste après
    let guard = 0, changed = true;
    while (changed && guard++ < 60) {
        changed = false;
        blocks.sort((a, b) => t(a.startTime) - t(b.startTime) || rank(a) - rank(b));
        for (let i = 1; i < blocks.length; i++) {
            const prev = blocks[i - 1], cur = blocks[i];
            if (t(cur.startTime) >= t(prev.endTime)) continue;
            const mover = cur.kind === 'pinned' ? cur : (prev.kind === 'pinned' ? prev : null);
            if (!mover) continue;
            const other = mover === cur ? prev : cur;
            const d = Math.max(1, t(mover.endTime) - t(mover.startTime));
            mover.startTime = other.endTime;
            mover.endTime = addMinutes(other.endTime, d);
            mover.shifted = true;
            changed = true;
            break;
        }
    }

    const pending = dayEvents.filter(e => e.kind !== 'fixed' && e.kind !== 'pinned')
        .sort((a, b) => t(a.startTime) - t(b.startTime));
    const out = [];
    let cursor = t(wakeupEvt.endTime), bi = 0;
    const emitBlock = () => { const b = blocks[bi++]; out.push(b); if (t(b.endTime) > cursor) cursor = t(b.endTime); };
    const dur = (e) => Math.max(1, t(e.endTime) - t(e.startTime));
    const place = (e, start, d) => { out.push({ ...e, startTime: v3M2T(start), endTime: v3M2T(start + d) }); };

    while (pending.length) {
        const f = pending.shift();
        // Blocs déjà dépassés, ou cours qui précèdent nominalement ce créneau
        while (bi < blocks.length && (t(blocks[bi].startTime) < cursor ||
               (blocks[bi].kind === 'fixed' && f.kind !== 'elastic' && t(blocks[bi].startTime) < t(f.startTime)))) emitBlock();

        if (f.kind === 'elastic') {
            const end = f.elasticEnd;
            while (cursor < end) {
                const limit = bi < blocks.length ? Math.min(end, t(blocks[bi].startTime)) : end;
                if (limit > cursor) { if (!f.hidden) place(f, cursor, limit - cursor); cursor = limit; }
                if (bi < blocks.length && t(blocks[bi].startTime) <= cursor && t(blocks[bi].startTime) < end) emitBlock();
                else break;
            }
            continue;
        }

        const d = dur(f);
        // Ne rentre pas avant le prochain créneau fixé → on comble le trou avec une
        // session/activité plus courte si possible, sinon on passe après le bloc
        while (bi < blocks.length && blocks[bi].kind === 'pinned' && cursor + d > t(blocks[bi].startTime)) {
            const gap = t(blocks[bi].startTime) - cursor;
            const fillIdx = gap > 0 ? pending.findIndex(p => p.kind === 'flex' && V3_PULLABLE_TYPES.has(p.type) && dur(p) <= gap) : -1;
            if (fillIdx !== -1) {
                const filler = pending.splice(fillIdx, 1)[0];
                const fd = dur(filler);
                place(filler, cursor, fd);
                cursor += fd;
                continue;
            }
            emitBlock();
        }
        place(f, cursor, d);
        cursor += d;
    }
    while (bi < blocks.length) emitBlock();

    out.sort((a, b) => t(a.startTime) - t(b.startTime));
    return out;
}

// Chevauchement avec un créneau « dur » (cours, trajet, créneau fixé) ?
function v3FindConflict(dayIndex, startTime, endTime, excludeIds) {
    const s = timeToMinutes(startTime), e = timeToMinutes(endTime);
    const ex = new Set(excludeIds || []);
    for (const ev of generateDayEvents(dayIndex)) {
        if (ev.id === 'wakeup' || ev.id === 'sleep' || ex.has(ev.id)) continue;
        const hard = ev.kind === 'fixed' || ev.kind === 'pinned' || ev.type === 'transport';
        if (!hard) continue;
        const es = timeToMinutes(ev.startTime), ee = timeToMinutes(ev.endTime);
        if (s < ee && es < e) return ev;
    }
    return null;
}
function v3ConflictMessage(ev) {
    return '⏰ Ce créneau chevauche « ' + ev.title + ' » (' + ev.startTime + ' → ' + ev.endTime + '). Choisis un autre horaire.';
}

// Chevauchements créneau automatique / cours (pour prévenir l'élève après une modif)
function v3OverlapWarnings(dayIndex) {
    const evs = generateDayEvents(dayIndex).filter(e => e.id !== 'wakeup' && e.id !== 'sleep');
    const found = [];
    for (let i = 0; i < evs.length; i++) for (let j = i + 1; j < evs.length; j++) {
        const a = evs[i], b = evs[j];
        if (timeToMinutes(a.startTime) < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < timeToMinutes(a.endTime)) {
            found.push(a.id + '|' + b.id);
        }
    }
    return found;
}
