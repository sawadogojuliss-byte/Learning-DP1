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

function planningFacteurObjectif() {
    var score = (typeof targetScore === 'number' && isFinite(targetScore)) ? targetScore : 36;
    return 0.85 + (Math.max(24, Math.min(45, score)) - 24) / 21 * 0.4;
}

function planningFacteurHumeur() {
    var mood = typeof currentMood === 'string' ? currentMood : '';
    if (mood === 'motive') return 1.15;
    if (mood === 'mauvaisnote') return 1.1;
    if (mood === 'fatigue' || mood === 'stresse') return 0.8;
    return 1;
}

function dureeEtude(subj, longue, courte) {
    var base = (typeof dureePrioritaire === 'function') ? dureePrioritaire(subj, longue, courte) : (subj && subj.level === 'HL' ? longue : courte);
    return Math.max(15, Math.round((Number(base) || 30) * planningFacteurObjectif() * planningFacteurHumeur() / 5) * 5);
}

function trajetProfil() {
    var moto = typeof transportMode !== 'undefined' && transportMode === 'moto';
    return {
        moto: moto,
        icon: moto ? '🏍️' : '🚗',
        aller: Math.max(5, Number(moto ? motoToSchool : carToSchool) || (moto ? 25 : 30)),
        retour: Math.max(5, Number(moto ? motoFromSchool : carFromSchool) || (moto ? 25 : 40)),
        depart: (moto ? motoDeparture : carDeparture) || '07:30',
        retourHeure: moto ? (motoReturn || '') : ''
    };
}

function debutTrajetAller(depart, duree, limite) {
    var start = timeToMinutes(depart || '07:30');
    if (start + duree <= limite) return start;
    return Math.max(0, limite - duree);
}

function debutTrajetRetour(finCours, retourHeure) {
    var plancher = 16 * 60 + 25;
    var start = Math.max(Number(finCours) || 0, plancher + 1);
    if (retourHeure) {
        var asked = timeToMinutes(retourHeure);
        if (asked > plancher) start = Math.max(start, asked);
    }
    if (start <= plancher) start = plancher + 1;
    return start;
}

function fixerTrajet(events, id, startMin, dur) {
    var ev = events.find(function (e) { return e && e.id === id; });
    if (!ev || ev.ovPinned) return;
    var d = Math.max(5, dur);
    ev.startTime = v3M2T(startMin);
    ev.endTime = v3M2T(startMin + d);
    ev.kind = 'pinned';
    ev.horaireEntre = true;
    ev.preferMin = startMin;
}

function trajetRetire(dayIndex, id) {
    if (typeof slotWasRemoved === 'function' && slotWasRemoved(dayIndex, id)) return true;
    if (typeof v3FindOverride === 'function') {
        var ov = v3FindOverride(id, dayIndex);
        if (ov && ov.deleted) return true;
    }
    if (typeof holidayDroppedIds === 'function') {
        var dropped = holidayDroppedIds(dayIndex) || [];
        if (dropped.indexOf(id) !== -1) return true;
    }
    return false;
}

function verrouillerTrajets(events, dayIndex) {
    if (dayIndex == null || Number(dayIndex) >= 5 || !events) return events;
    var trajet = typeof trajetProfil === 'function' ? trajetProfil() : { aller: 30, retour: 40, depart: '07:30', retourHeure: '', icon: '🚗' };
    var plancher = 16 * 60 + 25;
    var finEcole = 8 * 60 + 15;
    var finCours = 16 * 60 + 35;
    var list = events;
    function trouver(id) {
        var i;
        for (i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
        return null;
    }
    var aller = trouver('commute1');
    var retour = trouver('commute2');
    if (!aller && !trajetRetire(dayIndex, 'commute1')) {
        aller = { id: 'commute1', title: 'Trajet école', subtitle: '', type: 'transport', icon: trajet.icon || '🚗', editable: true, kind: 'pinned' };
        list.push(aller);
    }
    if (!retour && !trajetRetire(dayIndex, 'commute2')) {
        retour = { id: 'commute2', title: 'Trajet maison', subtitle: '', type: 'transport', icon: trajet.icon || '🚗', editable: true, kind: 'pinned' };
        list.push(retour);
    }
    var durA = Math.max(5, Number(trajet.aller) || 5);
    var durR = Math.max(5, Number(trajet.retour) || 5);
    if (aller) {
        var debutA = typeof debutTrajetAller === 'function' ? debutTrajetAller(trajet.depart, durA, finEcole) : Math.max(0, finEcole - durA);
        if (debutA + durA > finEcole) debutA = Math.max(0, finEcole - durA);
        aller.startTime = v3M2T(debutA);
        aller.endTime = v3M2T(debutA + durA);
        aller.title = 'Trajet école';
        aller.type = 'transport';
        aller.kind = 'pinned';
        aller.subtitle = durA + ' min';
    }
    if (retour) {
        var debutR = Math.max(finCours, plancher + 1);
        if (trajet.retourHeure && typeof timeToMinutes === 'function') {
            var asked = timeToMinutes(trajet.retourHeure);
            if (asked > plancher) debutR = Math.max(debutR, asked);
        }
        var actuel = typeof timeToMinutes === 'function' ? timeToMinutes(retour.startTime) : 0;
        if (actuel > debutR && actuel > plancher) debutR = actuel;
        if (debutR <= plancher) debutR = plancher + 1;
        retour.startTime = v3M2T(debutR % 1440);
        retour.endTime = v3M2T((debutR + durR) % 1440);
        retour.title = 'Trajet maison';
        retour.type = 'transport';
        retour.kind = 'pinned';
        retour.subtitle = durR + ' min';
    }
    if (aller && retour && typeof timeToMinutes === 'function') {
        var finAller = timeToMinutes(aller.endTime);
        var debutRetour = timeToMinutes(retour.startTime);
        if (debutRetour <= plancher || debutRetour <= finAller) {
            var corrige = Math.max(finCours, plancher + 1, finAller);
            retour.startTime = v3M2T(corrige % 1440);
            retour.endTime = v3M2T((corrige + durR) % 1440);
        }
    }
    function bornesTrajet(ev) {
        var s = timeToMinutes(ev.startTime);
        var e = timeToMinutes(ev.endTime);
        if (e <= s) e += 1440;
        return { s: s, e: e };
    }
    if (retour && typeof timeToMinutes === 'function') {
        var tours = 0;
        while (tours++ < 8) {
            var bloque = null;
            list.forEach(function (ev) {
                if (bloque || !ev || ev === retour || ev.id === 'sleep' || ev.id === 'commute1') return;
                var a = bornesTrajet(retour);
                var b = bornesTrajet(ev);
                if (a.s < b.e && b.s < a.e) bloque = ev;
            });
            if (!bloque) break;
            var apresBloque = bornesTrajet(bloque).e;
            if (apresBloque <= plancher) apresBloque = plancher + 1;
            retour.startTime = v3M2T(apresBloque % 1440);
            retour.endTime = v3M2T((apresBloque + durR) % 1440);
        }
    }
    list.sort(function (a, b) {
        if (!a || a.id === 'wakeup') return -1;
        if (!b || b.id === 'wakeup') return 1;
        if (a.id === 'sleep') return 1;
        if (b.id === 'sleep') return -1;
        return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
    return list;
}

function calerPreparation(events, commuteId) {
    var commute = events.find(function (e) { return e && e.id === commuteId; });
    var prep = events.find(function (e) { return e && e.id === 'prep'; });
    if (!commute || !prep || prep.ovPinned) return;
    var end = timeToMinutes(commute.startTime);
    var dur = timeToMinutes(prep.endTime) - timeToMinutes(prep.startTime);
    if (!(dur > 0)) dur = 30;
    dur = Math.max(10, Math.min(30, dur));
    if (end - dur < 0) return;
    prep.startTime = v3M2T(end - dur);
    prep.endTime = v3M2T(end);
    prep.kind = 'pinned';
    prep.horaireEntre = true;
    prep.preferMin = end - dur;
}

function planningMinutes(time) {
    var n = timeToMinutes(time || '00:00');
    return isFinite(n) ? n : 0;
}

function planningDuree(ev) {
    var d = planningMinutes(ev.endTime) - planningMinutes(ev.startTime);
    if (d <= 0) d += 1440;
    return Math.max(1, d);
}

function planningLibres(placed, from, to) {
    var cuts = placed.map(function (p) {
        return { s: Math.max(from, p._debut), e: Math.min(to, p._fin) };
    }).filter(function (p) { return p.e > p.s; }).sort(function (a, b) { return a.s - b.s || a.e - b.e; });
    var gaps = [];
    var cursor = from;
    cuts.forEach(function (c) {
        if (c.s > cursor) gaps.push({ start: cursor, end: c.s });
        if (c.e > cursor) cursor = c.e;
    });
    if (to > cursor) gaps.push({ start: cursor, end: to });
    return gaps;
}

function planningOccupe(placed, start, end) {
    return placed.some(function (p) { return start < p._fin && p._debut < end; });
}

function coursEconomieSamedi(ev, dayIndex) {
    if (!ev) return true;
    var jour = dayIndex != null ? dayIndex : ev.day;
    if (Number(jour) !== 5) return false;
    if (ev.id === 'eco' || ev.replacesId === 'eco') return true;
    var titre = String(ev.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, ' ');
    return titre.indexOf('cours d economie') !== -1;
}

function annoterPlages(events, dayIndex, wakeupTime, bedtime) {
    var wake = planningMinutes(wakeupTime);
    var bed = planningMinutes(bedtime);
    if (bed <= wake) bed += 1440;
    var matinFin = dayIndex < 5 ? 8 * 60 + 15 : Math.min(bed, wake + 4 * 60);
    var apres = dayIndex < 5 ? 16 * 60 + 35 : wake + 60;
    (events || []).forEach(function (ev) {
        if (!ev || ev.id === 'wakeup' || ev.id === 'sleep' || ev.kind === 'fixed' || ev.type === 'school') return;
        var dur = planningDuree(ev);
        ev.minimum = 15;
        if (ev.id === 'breakfast') {
            ev.plages = [[wake, matinFin], [apres, Math.min(bed, apres + 3 * 60)]];
            ev.preferMin = wake + 10;
        } else if (ev.id === 'prep' || ev.id === 'commute1') {
            ev.plages = [[wake, matinFin]];
            ev.minimum = 10;
            if (ev.preferMin == null) ev.preferMin = Math.max(wake, matinFin - dur);
        } else if (ev.id === 'commute2') {
            ev.plages = [[apres, bed]];
            ev.minimum = 10;
            if (ev.preferMin == null) ev.preferMin = apres;
        } else if (ev.id === 'lunch') {
            ev.plages = [[11 * 60, 15 * 60]];
            ev.preferMin = 12 * 60 + 30;
        } else if (ev.id === 'dinner') {
            ev.plages = [[17 * 60, bed]];
            ev.preferMin = 19 * 60;
            ev.minimum = 20;
        } else if (ev.type === 'activity') {
            ev.plages = [[wake, bed]];
            ev.preferMin = planningMinutes(ev.startTime);
            ev.minimum = Math.min(30, dur);
        } else if (ev.id === 'phone') {
            ev.plages = [[Math.max(apres, 18 * 60), bed], [wake, matinFin]];
            ev.preferMin = 20 * 60;
            ev.minimum = 15;
        } else if (ev.id === 'freetime' || ev.type === 'free') {
            ev.plages = [[wake, bed]];
            ev.preferMin = 18 * 60;
            ev.minimum = 15;
        } else if (ev.kind === 'pinned') {
            ev.plages = [[wake, bed]];
            ev.preferMin = planningMinutes(ev.startTime);
            ev.minimum = 15;
        } else {
            ev.plages = [[apres, bed], [wake, matinFin]];
            ev.preferMin = apres;
            ev.minimum = 20;
        }
    });
}

function planningSansChevauchement(events, wakeupTime, bedtime) {
    var wake = planningMinutes(wakeupTime);
    var bed = planningMinutes(bedtime);
    if (bed <= wake) bed += 1440;
    var fixed = [];
    var movable = [];
    (events || []).forEach(function (ev, index) {
        if (!ev || ev.hidden) return;
        var copy = Object.assign({}, ev);
        copy._index = index;
        if (copy.id === 'sleep') {
            copy._debut = bed;
            copy._fin = wake + 1440;
            copy.startTime = bedtime;
            copy.endTime = wakeupTime;
            copy.kind = 'fixed';
            fixed.push(copy);
            return;
        }
        var start = planningMinutes(copy.startTime);
        var dur = planningDuree(copy);
        copy._debut = start;
        copy._fin = start + dur;
        copy._dur = dur;
        if (copy.id === 'wakeup' || copy.kind === 'fixed' || copy.type === 'school') {
            copy.kind = 'fixed';
            fixed.push(copy);
        } else movable.push(copy);
    });
    var placed = [];
    fixed.sort(function (a, b) { return a._debut - b._debut || a._index - b._index; });
    fixed.forEach(function (ev) {
        if (!planningOccupe(placed, ev._debut, ev._fin)) { placed.push(ev); return; }
        var room = planningLibres(placed, ev._debut, ev._fin);
        if (!room.length) return;
        ev._debut = room[0].start;
        ev._fin = room[0].end;
        placed.push(ev);
    });
    function poserMobile(ev) {
        var ideal = ev._dur;
        var prefer = ev.preferMin != null ? ev.preferMin : ev._debut;
        if (prefer < wake) prefer = wake;
        var windows = (ev.plages && ev.plages.length) ? ev.plages : [[wake, bed]];
        var minimum = ev.minimum || 10;
        var i;
        for (i = 0; i < windows.length; i++) {
            var from = Math.max(wake, windows[i][0]);
            var to = Math.min(bed, windows[i][1]);
            if (to - from < minimum) continue;
            var dur = Math.min(ideal, to - from);
            var start = prefer;
            if (start < from) start = from;
            if (start + dur > to) start = to - dur;
            if (start >= from && !planningOccupe(placed, start, start + dur)) {
                ev._debut = start;
                ev._fin = start + dur;
                return true;
            }
            var gaps = planningLibres(placed, from, to).filter(function (gap) { return gap.end - gap.start >= dur; });
            gaps.sort(function (a, b) { return Math.abs(a.start - prefer) - Math.abs(b.start - prefer); });
            if (gaps.length) {
                var fit = gaps[0];
                ev._debut = Math.abs(fit.start - prefer) <= Math.abs((fit.end - dur) - prefer) ? fit.start : fit.end - dur;
                if (ev._debut < fit.start) ev._debut = fit.start;
                if (ev._debut + dur > fit.end) ev._debut = fit.end - dur;
                ev._fin = ev._debut + dur;
                ev.shifted = true;
                return true;
            }
        }
        var best = null;
        windows.forEach(function (win) {
            planningLibres(placed, Math.max(wake, win[0]), Math.min(bed, win[1])).forEach(function (gap) {
                if (gap.end - gap.start >= minimum && (!best || gap.end - gap.start > best.end - best.start)) best = gap;
            });
        });
        if (!best) return false;
        ev._debut = best.start;
        ev._fin = best.end;
        ev.shifted = true;
        return true;
    }
    var rest = movable.slice();
    function pass(pred) {
        var next = [];
        rest.forEach(function (ev) {
            if (!pred(ev)) { next.push(ev); return; }
            if (!poserMobile(ev)) { next.push(ev); return; }
            if (ev.id === 'commute1' && ev._fin > 8 * 60 + 15) {
                ev._fin = 8 * 60 + 15;
                ev._debut = Math.max(0, ev._fin - (ev._dur || 5));
            }
            if (ev.id === 'commute2' && ev._debut <= 16 * 60 + 25) {
                ev._debut = Math.max(16 * 60 + 35, 16 * 60 + 26);
                ev._fin = ev._debut + (ev._dur || 5);
            }
            ev.startTime = v3M2T(ev._debut % 1440);
            ev.endTime = v3M2T(ev._fin % 1440);
            placed.push(ev);
        });
        rest = next;
    }
    function debutVoulu(ev) { return ev.preferMin != null ? ev.preferMin : ev._debut; }
    pass(function (ev) {
        var debut = debutVoulu(ev);
        return (ev.type === 'activity' || (ev.kind === 'pinned' && !ev.horaireEntre)) && !planningOccupe(placed, debut, debut + ev._dur);
    });
    pass(function (ev) { return ev.id === 'commute1'; });
    pass(function (ev) { return ev.id === 'commute2'; });
    pass(function (ev) { return ev.id === 'prep' || ev.id === 'breakfast'; });
    pass(function (ev) { return ev.type === 'meal'; });
    pass(function (ev) { return ev.id === 'phone' || ev.id === 'freetime' || ev.type === 'phone' || ev.type === 'free'; });
    pass(function (ev) { return ev.type === 'activity' || ev.kind === 'pinned'; });
    pass(function () { return true; });
    var clean = [];
    placed.sort(function (a, b) { return a._debut - b._debut || a._index - b._index; });
    placed.forEach(function (ev) {
        if (!planningOccupe(clean, ev._debut, ev._fin)) clean.push(ev);
    });
    return clean.map(function (ev) {
        delete ev._debut;
        delete ev._fin;
        delete ev._dur;
        delete ev._index;
        return ev;
    });
}


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
        events.push({ id, title, subtitle, startTime, endTime, type, icon, editable, kind: pinned ? 'pinned' : 'flex', ovPinned: pinned });
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
        const fileRev = typeof filePriorite === 'function' ? filePriorite(allSubj) : allSubj;
        const i1 = fileRev.length ? dayIndex % fileRev.length : 0;
        const s1 = fileRev[i1];
        if (s1) chain('study1', 'Révisions ' + s1.name, sousTitreMatiere(s1), dureeEtude(s1, 90, 60), couleurMatiere(s1), s1.icon, true);
        chain('lunch', 'Déjeuner', '', 60, 'meal', '🍽️', true);
        var s2 = null;
        if (fileRev.length > 1) {
            var kRev;
            for (kRev = 1; kRev < fileRev.length; kRev++) {
                if (fileRev[(i1 + kRev) % fileRev.length] !== s1) {
                    s2 = fileRev[(i1 + kRev) % fileRev.length];
                    break;
                }
            }
        }
        if (s2) chain('study2', 'Révisions ' + s2.name, sousTitreMatiere(s2), dureeEtude(s2, 90, 60), couleurMatiere(s2), s2.icon, true);
        fixed('dinner', 'Dîner', '', '19:00', '19:45', 'meal', '🍝');
        if (phoneTime > 0) chain('phone', 'Téléphone', formatDuration(phoneTime), phoneTime, 'phone', '📱', true);

    } else if (isSaturday) {
        chain('prep', 'Préparation', '', 30, 'prep', '🚿', true);
        const fileRev = typeof filePriorite === 'function' ? filePriorite(allSubj) : allSubj;
        const i1 = fileRev.length ? dayIndex % fileRev.length : 0;
        const s1 = fileRev[i1];
        if (s1) chain('study1', 'Révisions ' + s1.name, sousTitreMatiere(s1), dureeEtude(s1, 90, 60), couleurMatiere(s1), s1.icon, true);
        chain('lunch', 'Déjeuner', '', 60, 'meal', '🍽️', true);
        var s2 = null;
        if (fileRev.length > 1) {
            var kRev;
            for (kRev = 1; kRev < fileRev.length; kRev++) {
                if (fileRev[(i1 + kRev) % fileRev.length] !== s1) {
                    s2 = fileRev[(i1 + kRev) % fileRev.length];
                    break;
                }
            }
        }
        if (s2) chain('study2', 'Révisions ' + s2.name, sousTitreMatiere(s2), dureeEtude(s2, 90, 60), couleurMatiere(s2), s2.icon, true);
        fixed('dinner', 'Dîner', '', '19:00', '19:45', 'meal', '🍝');
        if (phoneTime > 0) chain('phone', 'Téléphone', formatDuration(phoneTime), phoneTime, 'phone', '📱', true);

    } else {
        // ── SEMAINE Lun-Ven ──
        const trajet = trajetProfil();
        chain('prep', 'Préparation', '', 30, 'prep', '🚿', true);
        chain('commute1', 'Trajet école', trajet.aller + ' min · départ ' + trajet.depart, trajet.aller, 'transport', trajet.icon, true);
        fixed('school1', 'Cours', '8h15 → 12h30', '08:15', '12:30', 'school', '🏫');
        fixed('lunch', 'Déjeuner', '', '12:30', '13:30', 'meal', '🍽️');
        fixed('school2', 'Cours', '13h30 → 16h35', '13:30', '16:35', 'school', '🏫');
        chain('commute2', 'Trajet maison', trajet.retour + ' min' + (trajet.retourHeure ? ' · ' + trajet.retourHeure : ''), trajet.retour, 'transport', trajet.icon, true);
        fixerTrajet(events, 'commute1', debutTrajetAller(trajet.depart, trajet.aller, 8 * 60 + 15), trajet.aller);
        calerPreparation(events, 'commute1');
        fixerTrajet(events, 'commute2', debutTrajetRetour(16 * 60 + 35, trajet.retourHeure), trajet.retour);
        const mainSubj = typeof sujetDuJour === 'function' ? sujetDuJour(allSubj, dayIndex) : allSubj[dayIndex % Math.max(1, allSubj.length)];
        if (mainSubj) chain('study1', 'Révisions ' + mainSubj.name, sousTitreMatiere(mainSubj), dureeEtude(mainSubj, 90, 60), couleurMatiere(mainSubj), mainSubj.icon, true);
        const sciNames = ['Mathématiques', 'Physique', 'Chimie', 'Biologie'];
        const sciSubj = allSubj.filter(s => sciNames.some(n => s.name.includes(n)));
        const mainIsSci = mainSubj && sciNames.some(n => mainSubj.name.includes(n));
        if (sciSubj.length > 0 && !mainIsSci) {
            const exSubj = typeof sujetDuJour === 'function' ? sujetDuJour(sciSubj, dayIndex) : sciSubj[dayIndex % sciSubj.length];
            if (exSubj) chain('exercises', 'Exercices ' + exSubj.name, sousTitreMatiere(exSubj), dureeEtude(exSubj, 45, 30), couleurMatiere(exSubj), '✏️', true);
        }
        var fileSemaine = typeof filePriorite === 'function' ? filePriorite(allSubj) : allSubj;
        var s2sem = null;
        if (fileSemaine.length > 1 && mainSubj) {
            var kSem;
            for (kSem = 1; kSem < fileSemaine.length; kSem++) {
                var cand = fileSemaine[(dayIndex + kSem) % fileSemaine.length];
                if (cand && cand.name !== mainSubj.name) { s2sem = cand; break; }
            }
        }
        if (s2sem) chain('study2', 'Révisions ' + s2sem.name, sousTitreMatiere(s2sem), dureeEtude(s2sem, 75, 45), couleurMatiere(s2sem), s2sem.icon, true);
        chain('dinner', 'Dîner', '', 45, 'meal', '🍝', true);
        if (phoneTime > 0) chain('phone', 'Téléphone', formatDuration(phoneTime), phoneTime, 'phone', '📱', true);
    }

    var libre = slotWasRemoved(dayIndex, 'freetime') ? 0 : (typeof freeMinutesForDay === 'function' ? freeMinutesForDay(dayIndex) : 60);
    if (libre >= 15 && !(ovFor('freetime') && ovFor('freetime').deleted)) {
        chain('freetime', 'Temps libre', formatDuration(libre), libre, 'free', '🎮', true);
    }

    // ── ACTIVITÉS EXTRASCOLAIRES (configurées à l'inscription) ──
    selectedActivities.forEach(activity => {
        if (!activity || !activity.days || activity.days.indexOf(dayIndex) === -1) return;
        const id = 'activity-' + activity.name;
        const ov = ovFor(id);
        if (ov && ov.deleted) return;
        let title = activity.name, icon = activity.icon;
        let startTime = activity.sameTime ? activity.startTime : (activity.dayTimes[dayIndex] ? activity.dayTimes[dayIndex].start : '17:00');
        let endTime = activity.sameTime ? activity.endTime : (activity.dayTimes[dayIndex] ? activity.dayTimes[dayIndex].end : '19:00');
        let kind = 'pinned';
        if (ov) {
            if (ov.title) title = ov.title;
            if (ov.icon && ov.icon !== '📌') icon = ov.icon;
            const ovDur = timeToMinutes(ov.endTime) - timeToMinutes(ov.startTime);
            if (ov.pinned && ov.startTime) { startTime = ov.startTime; endTime = ov.endTime; }
            else if (ovDur > 0) endTime = addMinutes(startTime, ovDur);
        }
        events.push({ id, title, subtitle: 'Activité', startTime, endTime, type: 'activity', icon, editable: true, kind });
    });

    // ── CRÉNEAUX AJOUTÉS PAR L'ÉLÈVE (heure choisie → fixés 📌) ──
    customEvents.filter(e => e && e.day === dayIndex && !e.replacesId && !e.deleted && !coursEconomieSamedi(e, dayIndex)).forEach(event => {
        events.push({ id: event.id, title: event.title, subtitle: '', startTime: event.startTime, endTime: event.endTime,
            type: event.type, icon: event.icon || '📌', editable: true, kind: 'pinned', source: event.source, exoId: event.exoId });
    });

    // ── COUCHER ──
    const sleepEvt = { id: 'sleep', title: 'Coucher', subtitle: '', startTime: bedtime, endTime: wakeupTime, type: 'sleep', icon: '😴', editable: false, kind: 'fixed' };

    annoterPlages(events.concat([wakeupEvt, sleepEvt]), dayIndex, wakeupTime, bedtime);
    let scheduled = v3Schedule(events, wakeupEvt);
    scheduled = planningSansChevauchement(scheduled, wakeupTime, bedtime).filter(function (ev) { return ev.id !== 'wakeup' && ev.id !== 'sleep'; });
    scheduled = closeProgramGaps(scheduled, bedtime, dayIndex);
    scheduled.forEach(function (ev) {
        if (!ev || ev.plages) return;
        var s = planningMinutes(ev.startTime);
        var e = planningMinutes(ev.endTime);
        if (e <= s) e += 1440;
        ev.plages = [[s, e]];
        ev.preferMin = s;
        ev.minimum = Math.max(10, e - s);
    });
    if (hMode === 'light' && typeof holidayDroppedIds === 'function') {
        const dropped = new Set(holidayDroppedIds(dayIndex));
        scheduled = scheduled.filter(function (ev) { return !dropped.has(ev.id); });
    }
    var jour = assurerRevision(planningSansChevauchement([wakeupEvt, ...scheduled, sleepEvt], wakeupTime, bedtime), dayIndex);
    jour = planningCompleterPages(jour, dayIndex, wakeupTime, bedtime);
    if (dayIndex === 5) jour = jour.filter(function (ev) { return !coursEconomieSamedi(ev, dayIndex); });
    return verrouillerTrajets(planningBalayer(jour), dayIndex);
}

function emploiDuTemps(jour) {
    return generateDayEvents(jour);
}

function emploiDuTempsSemaine() {
    var jours = [];
    var i;
    for (i = 0; i < 7; i++) jours.push(emploiDuTemps(i));
    return jours;
}

function planningActualiser() {
    var planning = document.getElementById('planningModal');
    if (planning && planning.classList.contains('active') && typeof renderPlanning === 'function') {
        try { renderPlanning(); } catch (e) {}
    }
    var feries = document.getElementById('panelFeries');
    if (feries && feries.classList.contains('active') && typeof renderHolidays === 'function') {
        try { renderHolidays(); } catch (e) {}
    }
    var travaux = document.getElementById('panelEEia');
    if (travaux && travaux.classList.contains('active') && typeof renderEEia === 'function') {
        try { renderEEia(); } catch (e) {}
    }
    var exo = document.getElementById('panelExercices');
    if (exo && exo.classList.contains('active') && typeof renderPlanifier === 'function') {
        try { renderPlanifier(); } catch (e) {}
    }
}

function assurerRevision(events, dayIndex) {
    var list = events || [];
    var deja = list.some(function (ev) {
        return ev && (ev.id === 'study1' || ev.id === 'study2' || ev.id === 'exercises' || ev.type === 'study' || ev.type === 'critical' || ev.type === 'warning' || ev.type === 'ia' || ev.type === 'memoir');
    });
    var all = [];
    if (typeof subjects !== 'undefined' && subjects) all = all.concat(subjects);
    if (typeof optionalSubjects !== 'undefined' && optionalSubjects) all = all.concat(optionalSubjects);
    if (deja || !all.length) return list;
    var subj = typeof sujetDuJour === 'function' ? sujetDuJour(all, dayIndex) : all[dayIndex % all.length];
    if (!subj) return list;
    var donor = null;
    ['freetime', 'phone'].forEach(function (id) {
        if (donor) return;
        var ev = list.find(function (item) { return item && item.id === id; });
        if (!ev || typeof timeToMinutes !== 'function') return;
        if (timeToMinutes(ev.endTime) - timeToMinutes(ev.startTime) >= 45) donor = ev;
    });
    if (!donor) return list;
    var fin = timeToMinutes(donor.endTime);
    var debut = fin - 30;
    donor.endTime = v3M2T(debut);
    if (typeof formatDuration === 'function') donor.subtitle = formatDuration(debut - timeToMinutes(donor.startTime));
    var bloc = {
        id: 'study-reserve',
        title: 'Révisions ' + subj.name,
        subtitle: typeof sousTitreMatiere === 'function' ? sousTitreMatiere(subj) : (subj.level || ''),
        startTime: v3M2T(debut),
        endTime: v3M2T(fin),
        type: typeof couleurMatiere === 'function' ? couleurMatiere(subj) : 'study',
        icon: subj.icon || '📚',
        editable: true,
        kind: 'flex'
    };
    var out = list.filter(function (ev) { return ev && ev.id !== 'sleep'; });
    out.push(bloc);
    out.sort(function (a, b) { return timeToMinutes(a.startTime) - timeToMinutes(b.startTime); });
    var sleep = list.find(function (ev) { return ev && ev.id === 'sleep'; });
    if (sleep) out.push(sleep);
    return out;
}

function planningSujetsSaisis() {
    var all = [];
    if (typeof subjects !== 'undefined' && subjects) all = all.concat(subjects);
    if (typeof optionalSubjects !== 'undefined' && optionalSubjects) all = all.concat(optionalSubjects);
    var vus = {};
    return all.filter(function (s) {
        if (!s || !s.name || vus[s.name]) return false;
        vus[s.name] = true;
        return true;
    });
}

function planningBlocManquant(id, title, subtitle, dur, type, icon) {
    return { id: id, title: title, subtitle: subtitle || '', duree: dur, type: type, icon: icon || '📌' };
}

function planningManquesDuJour(events, dayIndex) {
    var titres = (events || []).map(function (ev) { return String(ev && ev.title || ''); }).join(' | ');
    var ids = {};
    (events || []).forEach(function (ev) { if (ev && ev.id) ids[ev.id] = true; });
    var manques = [];
    var sujets = planningSujetsSaisis();
    if (sujets.length && !/Révisions|Exercices/.test(titres)) {
        var subj = sujets[dayIndex % sujets.length];
        manques.push(planningBlocManquant('study-page', 'Révisions ' + subj.name, typeof sousTitreMatiere === 'function' ? sousTitreMatiere(subj) : (subj.level || ''), dureeEtude(subj, 45, 30), typeof couleurMatiere === 'function' ? couleurMatiere(subj) : 'study', subj.icon || '📚'));
    }
    var memoirSaisi = (typeof memoirLevel === 'string' && memoirLevel) || (typeof memoirPlan !== 'undefined' && Array.isArray(memoirPlan) && memoirPlan.some(function (p) { return p && !p.done; }));
    if (memoirSaisi && dayIndex === 6 && !ids['memoir-page'] && titres.indexOf('Mémoire') === -1) {
        manques.push(planningBlocManquant('memoir-page', 'Mémoire', typeof memoirLevelLabel === 'function' ? memoirLevelLabel() : '', 40, 'memoir', '📖'));
    }
    var iaSujets = typeof eeSujets === 'function' ? eeSujets() : sujets;
    if (iaSujets.length) {
        var idx = dayIndex % iaSujets.length;
        var sujetIa = iaSujets[idx];
        var niveau = sujetIa && typeof iaStageId === 'function' ? iaStageId(sujetIa.name) : '';
        var plan = sujetIa && typeof iaPlans !== 'undefined' && iaPlans ? iaPlans[sujetIa.name] : null;
        var iaSaisi = !!niveau || (Array.isArray(plan) && plan.some(function (p) { return p && !p.done; }));
        if (iaSaisi && titres.indexOf(sujetIa.name) === -1) {
            manques.push(planningBlocManquant('ia-page-' + sujetIa.name, 'Évaluation interne · ' + sujetIa.name, typeof iaLevelLabel === 'function' ? iaLevelLabel(sujetIa.name) : '', 35, 'ia', sujetIa.icon || '📋'));
        }
    }
    var phoneDu = typeof phoneDays !== 'undefined' && phoneDays && phoneDays.indexOf(dayIndex) !== -1;
    var phoneMin = phoneDu ? (typeof samePhoneDuration !== 'undefined' && samePhoneDuration ? phoneDuration : (phoneDayDurations && (phoneDayDurations[dayIndex] || phoneDayDurations[String(dayIndex)]) || 0)) : 0;
    if (phoneMin >= 15 && !ids.phone) manques.push(planningBlocManquant('phone', 'Téléphone', typeof formatDuration === 'function' ? formatDuration(phoneMin) : '', Math.min(phoneMin, 60), 'phone', '📱'));
    var libre = typeof freeMinutesForDay === 'function' ? freeMinutesForDay(dayIndex) : 0;
    if (libre >= 15 && !ids.freetime && !(events || []).some(function (ev) { return ev && ev.type === 'free'; })) {
        manques.push(planningBlocManquant('freetime', 'Temps libre', typeof formatDuration === 'function' ? formatDuration(libre) : '', Math.min(libre, 60), 'free', '🎮'));
    }
    (typeof selectedActivities !== 'undefined' ? selectedActivities : []).forEach(function (act) {
        if (!act || !act.days || act.days.indexOf(dayIndex) === -1) return;
        var id = 'activity-' + act.name;
        if (ids[id] || titres.indexOf(act.name) !== -1) return;
        var slot = act.sameTime ? { start: act.startTime, end: act.endTime } : ((act.dayTimes && act.dayTimes[dayIndex]) || { start: '17:00', end: '19:00' });
        var dur = 30;
        if (typeof timeToMinutes === 'function' && slot.start && slot.end) dur = Math.max(20, timeToMinutes(slot.end) - timeToMinutes(slot.start));
        manques.push(planningBlocManquant(id, act.name, 'Activité', dur, 'activity', act.icon || '✨'));
    });
    return manques;
}

function planningCompleterPages(events, dayIndex, wakeupTime, bedtime) {
    var list = (events || []).map(function (ev) { return Object.assign({}, ev); });
    var wake = planningMinutes(wakeupTime);
    var bed = planningMinutes(bedtime);
    if (bed <= wake) bed += 1440;
    planningManquesDuJour(list, dayIndex).forEach(function (bloc) {
        var donor = null;
        list.forEach(function (ev) {
            if (!ev || ev.id === 'wakeup' || ev.id === 'sleep' || ev.kind === 'fixed' || ev.type === 'school' || ev.type === 'activity') return;
            var dur = planningMinutes(ev.endTime) - planningMinutes(ev.startTime);
            if (dur < bloc.duree + 15) return;
            if (!donor || dur > (planningMinutes(donor.endTime) - planningMinutes(donor.startTime))) donor = ev;
        });
        if (!donor) return;
        var fin = planningMinutes(donor.endTime);
        var debut = fin - bloc.duree;
        if (debut < wake || fin > bed) return;
        donor.endTime = v3M2T(debut);
        list.push({
            id: bloc.id,
            title: bloc.title,
            subtitle: bloc.subtitle,
            startTime: v3M2T(debut),
            endTime: v3M2T(fin),
            type: bloc.type,
            icon: bloc.icon,
            editable: true,
            kind: 'flex'
        });
    });
    return list;
}

function planningBalayer(events) {
    var list = (events || []).filter(function (ev) { return ev && !ev.hidden; }).map(function (ev) { return Object.assign({}, ev); });
    function bornes(ev) {
        var s = planningMinutes(ev.startTime);
        var e = planningMinutes(ev.endTime);
        if (e <= s) return [[s, 1440], [0, e]].filter(function (p) { return p[1] > p[0]; });
        return [[s, e]];
    }
    function chevauche(a, b) {
        var pa = bornes(a);
        var pb = bornes(b);
        var i, j;
        for (i = 0; i < pa.length; i++) for (j = 0; j < pb.length; j++) {
            if (pa[i][0] < pb[j][1] && pb[j][0] < pa[i][1]) return true;
        }
        return false;
    }
    function rang(ev) {
        if (!ev || ev.id === 'wakeup' || ev.id === 'sleep' || ev.kind === 'fixed' || ev.type === 'school') return 0;
        if (ev.type === 'activity') return 1;
        if (ev.type === 'transport' || ev.type === 'prep') return 2;
        if (ev.type === 'meal') return 3;
        return 4;
    }
    list.sort(function (a, b) { return rang(a) - rang(b) || planningMinutes(a.startTime) - planningMinutes(b.startTime); });
    var gardes = [];
    list.forEach(function (ev) {
        var tours = 0;
        while (tours++ < 12 && gardes.some(function (autre) { return chevauche(ev, autre); })) {
            var autre = null;
            gardes.forEach(function (candidat) { if (!autre && chevauche(ev, candidat)) autre = candidat; });
            if (!autre || rang(ev) === 0) break;
            var finAutre = planningMinutes(autre.endTime);
            if (finAutre <= planningMinutes(autre.startTime)) finAutre += 1440;
            var dur = Math.max(10, planningDuree(ev));
            var debut = finAutre % 1440;
            ev.startTime = v3M2T(debut);
            ev.endTime = v3M2T((debut + dur) % 1440);
            ev.shifted = true;
        }
        if (!gardes.some(function (autre) { return chevauche(ev, autre); })) gardes.push(ev);
    });
    gardes.sort(function (a, b) {
        if (a.id === 'wakeup') return -1;
        if (b.id === 'wakeup') return 1;
        if (a.id === 'sleep') return 1;
        if (b.id === 'sleep') return -1;
        return planningMinutes(a.startTime) - planningMinutes(b.startTime);
    });
    return gardes;
}

function slotWasRemoved(dayIndex, id) {
    return customEvents.some(function (e) { return e && e.day === dayIndex && e.replacesId === id && e.deleted; });
}

function closeProgramGaps(events, bedtime, dayIndex) {
    const items = events.slice().sort(function (a, b) { return timeToMinutes(a.startTime) - timeToMinutes(b.startTime); });
    if (!items.length) return items;
    const phoneIdx = items.findIndex(function (ev) { return ev.id === 'phone' || ev.type === 'phone'; });
    let budget = slotWasRemoved(dayIndex, 'freetime') ? 0 : (typeof freeMinutesForDay === 'function' ? freeMinutesForDay(dayIndex) : 60);
    let freePlaced = items.some(function (ev) { return ev && (ev.id === 'freetime' || ev.type === 'free'); });
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
        const subj = all.length ? (typeof sujetDuJour === 'function' ? sujetDuJour(all, dayIndex + (kind === 'revision' ? turn.rev : Math.floor(turn.n / 2))) : all[(dayIndex + (kind === 'revision' ? turn.rev : Math.floor(turn.n / 2))) % all.length]) : null;
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
                subtitle: subj ? (sousTitreMatiere(subj) || 'Cours et exercices') : 'Cours et exercices',
                startTime: clock(cursor),
                endTime: clock(cursor + dur),
                type: subj && typeof couleurMatiere === 'function' ? couleurMatiere(subj) : 'study',
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
        while (bi < blocks.length && cursor + d > t(blocks[bi].startTime) && t(blocks[bi].endTime) > cursor) {
            const gap = t(blocks[bi].startTime) - cursor;
            const fillIdx = gap >= 15 ? pending.findIndex(p => p.kind === 'flex' && V3_PULLABLE_TYPES.has(p.type) && dur(p) <= gap) : -1;
            if (fillIdx !== -1) {
                const filler = pending.splice(fillIdx, 1)[0];
                const fd = dur(filler);
                place(filler, cursor, fd);
                cursor += fd;
                continue;
            }
            if (gap >= d) break;
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
    if (!(e > s)) return null;
    const ex = new Set(excludeIds || []);
    for (const ev of generateDayEvents(dayIndex)) {
        if (ev.id === 'wakeup' || ev.id === 'sleep' || ex.has(ev.id)) continue;
        const es = timeToMinutes(ev.startTime), ee = timeToMinutes(ev.endTime);
        const end = ee > es ? ee : ee + 1440;
        if (s < end && es < e) return ev;
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
