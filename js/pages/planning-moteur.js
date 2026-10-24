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
function v3Save() {
    if (!window.__v3SaveEnCours && typeof reporterModificationsSemaine === 'function') {
        window.__v3SaveEnCours = true;
        try { reporterModificationsSemaine(); } catch (e) {}
        window.__v3SaveEnCours = false;
    }
    localStorage.setItem(V3_STORAGE_KEY, JSON.stringify(customEvents));
    if (typeof memoireSauvegarder === 'function' && !window.__v3SaveMemoire) {
        window.__v3SaveMemoire = true;
        try { memoireSauvegarder(); } catch (e) {}
        window.__v3SaveMemoire = false;
    }
}

function cleSemaineCourante(date) {
    var d = date || new Date();
    var lundi = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var decalage = lundi.getDay() === 0 ? 6 : lundi.getDay() - 1;
    lundi.setDate(lundi.getDate() - decalage);
    return lundi.getFullYear() + '-' + (lundi.getMonth() + 1) + '-' + lundi.getDate();
}

function cleModification(ev) {
    if (!ev) return '';
    if (ev.replacesId) return 'ov:' + ev.day + ':' + ev.replacesId;
    if (ev.id) return 'id:' + ev.id;
    return [ev.day, ev.title || '', ev.startTime || '', ev.endTime || ''].join('|');
}

function reporterModificationsSemaine() {
    if (typeof customEvents === 'undefined' || window.__emploiCalculBrut || (typeof emploiGelSuspendu !== 'undefined' && emploiGelSuspendu)) return 0;
    var cle = cleSemaineCourante();
    var archive = null;
    try { archive = JSON.parse(localStorage.getItem('studyPlanIB_modifsSemaine') || 'null'); } catch (e) { archive = null; }
    var ajoute = 0;
    if (archive && archive.semaine && archive.semaine !== cle && Array.isArray(archive.events)) {
        var vus = {};
        customEvents.forEach(function (ev) { vus[cleModification(ev)] = true; });
        archive.events.forEach(function (ev) {
            if (!ev || ev.id === 'boite-garde') return;
            var copie = Object.assign({}, ev);
            if (vus[cleModification(copie)]) return;
            copie.reporte = true;
            copie.depuisSemaine = archive.semaine;
            customEvents.push(copie);
            vus[cleModification(copie)] = true;
            ajoute++;
        });
    }
    var actuels = (customEvents || []).filter(function (ev) { return ev && ev.id !== 'boite-garde'; });
    if (!actuels.length && archive && archive.events && archive.events.length && archive.semaine && archive.semaine !== cle) return ajoute;
    try {
        localStorage.setItem('studyPlanIB_modifsSemaine', JSON.stringify({
            semaine: cle,
            events: actuels
        }));
    } catch (e) {}
    return ajoute;
}

function planningChoixUtilisateur(ev) {
    if (!ev || ev.deleted) return false;
    if (ev.id === 'wakeup' || ev.id === 'sleep' || ev.type === 'school' || ev.type === 'transport') return false;
    if (ev.type === 'activity' || ev.source === 'custom' || ev.source === 'exercice') return true;
    if (ev.kind === 'pinned' || ev.ovPinned) return true;
    return false;
}

function planningEcrireHeure(ev, debut, heure) {
    if (!ev) return;
    if (debut) {
        if (ev.startTime != null) ev.startTime = heure;
        if (ev.d != null) ev.d = heure;
        if (ev.startTime == null && ev.d == null) ev.startTime = heure;
        return;
    }
    if (ev.endTime != null) ev.endTime = heure;
    if (ev.f != null) ev.f = heure;
    if (ev.endTime == null && ev.f == null) ev.endTime = heure;
}

function planningCorrigerCours(events) {
    return (events || []).map(function (ev) {
        if (!ev) return ev;
        var titre = String(ev.title || ev.t || '');
        if (titre !== 'Cours' && ev.id !== 'school1' && ev.id !== 'school2') return ev;
        var debut = String(ev.startTime || ev.d || '');
        var fin = String(ev.endTime || ev.f || '');
        if (fin === '16:35') {
            var apres = Object.assign({}, ev);
            planningEcrireHeure(apres, false, '16:25');
            if (apres.subtitle) apres.subtitle = String(apres.subtitle).replace(/16\s*h\s*35/g, '16h25').replace(/16:35/g, '16:25');
            else if (debut === '13:30' || apres.id === 'school2') apres.subtitle = '13h30 → 16h25';
            return apres;
        }
        if (!debut || debut >= '12:00' || fin === '16:25') return ev;
        if (debut === '07:50' && fin === '12:30') return ev;
        if (fin && fin <= '09:30' && fin !== '12:30') return ev;
        var copie = Object.assign({}, ev);
        planningEcrireHeure(copie, true, '07:50');
        if (!copie.endTime && !copie.f) copie.endTime = '12:30';
        if (copie.subtitle && /8h15|08:15|8h00|08:00/.test(copie.subtitle)) {
            copie.subtitle = (typeof coursTexte === 'function' ? coursTexte(7 * 60 + 50) : '7h50') + ' → 12h30';
        }
        return copie;
    });
}
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
/* « Fait » masque uniquement les créneaux de cet exercice. Les conserver
   permet de les retrouver si l'élève repasse à « À faire ». */
function planningExerciceFait(id) {
    if (!id) return false;
    var liste = typeof exercices !== 'undefined' && Array.isArray(exercices) ? exercices : [];
    return liste.some(function (exercice) { return exercice && exercice.id === id && exercice.done === true; });
}
function planningSansExercicesFaits(jour) {
    return (jour || []).filter(function (ev) { return !ev || !planningExerciceFait(ev.exoId); });
}
function v3FindOverride(id, day) {
    for (let i = customEvents.length - 1; i >= 0; i--) {
        const e = customEvents[i];
        if (e && e.replacesId === id && e.day === day && !planningExerciceFait(e.exoId)) return e;
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
    var plancher = typeof COURS_FIN === 'number' ? COURS_FIN : (16 * 60 + 25);
    var start = Math.max(Number(finCours) || 0, plancher);
    if (retourHeure) {
        var asked = timeToMinutes(retourHeure);
        if (asked > plancher) start = Math.max(start, asked);
    }
    if (start < plancher) start = plancher;
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
    var finEcole = typeof COURS_DEBUT === 'number' ? COURS_DEBUT : (7 * 60 + 50);
    var finCours = typeof COURS_FIN === 'number' ? COURS_FIN : (16 * 60 + 25);
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
        var debutR = finCours;
        list.forEach(function (ev) {
            if (!planningResteEcole(ev) || typeof timeToMinutes !== 'function') return;
            var sejourDebut = timeToMinutes(ev.startTime);
            var sejourFin = timeToMinutes(ev.endTime);
            if (sejourFin <= sejourDebut) sejourFin += 1440;
            if (sejourDebut <= finCours + 20 && sejourFin > debutR) debutR = sejourFin;
        });
        if (debutR < finCours) debutR = finCours;
        retour.startTime = v3M2T(debutR % 1440);
        retour.endTime = v3M2T((debutR + durR) % 1440);
        retour.title = 'Trajet maison';
        retour.type = 'transport';
        retour.kind = 'pinned';
        retour.subtitle = durR + ' min';
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
    if (prep.habitudeFixe) {
        dur = Math.max(5, dur);
        if (end - dur < 0) dur = Math.max(5, end);
    } else {
        dur = Math.max(10, Math.min(30, dur));
        if (end - dur < 0) return;
    }
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
    /* Le cours d'économie du samedi n'existe plus : il disparaît pour
       tous les élèves, pour toujours. */
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
    var matinFin = dayIndex < 5 ? (typeof COURS_DEBUT === 'number' ? COURS_DEBUT : (7 * 60 + 50)) : Math.min(bed, wake + 4 * 60);
    var apres = dayIndex < 5 ? (typeof COURS_FIN === 'number' ? COURS_FIN : (16 * 60 + 25)) : wake + 60;
    (events || []).forEach(function (ev) {
        if (!ev || ev.id === 'wakeup' || ev.id === 'sleep' || ev.kind === 'fixed' || ev.type === 'school') return;
        if (ev.habitudeFixe) {
            var dureeFixe = planningDuree(ev);
            ev.plages = [[wake, bed]];
            ev.preferMin = planningMinutes(ev.startTime);
            ev.minimum = dureeFixe;
            return;
        }
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
    var choisis = [];
    movable = movable.filter(function (ev) {
        if (!planningChoixUtilisateur(ev)) return true;
        choisis.push(ev);
        return false;
    });
    choisis.forEach(function (ev) {
        ev.startTime = v3M2T(ev._debut % 1440);
        ev.endTime = v3M2T(ev._fin % 1440);
        placed.push(ev);
    });
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
            if (ev.id === 'commute1' && ev._fin > (typeof COURS_DEBUT === 'number' ? COURS_DEBUT : (7 * 60 + 50))) {
                ev._fin = typeof COURS_DEBUT === 'number' ? COURS_DEBUT : (7 * 60 + 50);
                ev._debut = Math.max(0, ev._fin - (ev._dur || 5));
            }
            if (ev.id === 'commute2' && ev._debut < (typeof COURS_FIN === 'number' ? COURS_FIN : (16 * 60 + 25))) {
                ev._debut = typeof COURS_FIN === 'number' ? COURS_FIN : (16 * 60 + 25);
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
        if (planningChoixUtilisateur(ev) || !planningOccupe(clean, ev._debut, ev._fin)) clean.push(ev);
    });
    return clean.map(function (ev) {
        delete ev._debut;
        delete ev._fin;
        delete ev._dur;
        delete ev._index;
        return ev;
    });
}


var PLANNING_SOMMEIL_MIN = 300; /* 5 h de sommeil, jamais moins */

var emploiFige = null;
var emploiGelSuspendu = 0;
var emploiNePasSauver = 0;

function emploiCloner(val) {
    try { return JSON.parse(JSON.stringify(val)); } catch (e) { return val; }
}

function emploiFaitsSignature() {
    function sujet(s) {
        if (!s) return null;
        return { name: s.name || '', level: s.level || '', grade: s.grade == null ? '' : s.grade };
    }
    function liste(arr, map) {
        return (arr || []).map(map);
    }
    var phone = {};
    var libre = {};
    var i;
    for (i = 0; i < 7; i++) {
        phone[i] = typeof phoneDayDurations !== 'undefined' && phoneDayDurations ? (phoneDayDurations[i] != null ? phoneDayDurations[i] : phoneDayDurations[String(i)]) : null;
        libre[i] = typeof freeTimeByDay !== 'undefined' && freeTimeByDay ? (freeTimeByDay[i] != null ? freeTimeByDay[i] : freeTimeByDay[String(i)]) : null;
    }
    var faits = {
        horaireCours: typeof COURS_DEBUT === 'number' ? COURS_DEBUT : (7 * 60 + 50),
        finCours: typeof COURS_FIN === 'number' ? COURS_FIN : (16 * 60 + 25),
        subjects: liste(typeof subjects !== 'undefined' ? subjects : [], sujet),
        optionalSubjects: liste(typeof optionalSubjects !== 'undefined' ? optionalSubjects : [], sujet),
        ibYear: typeof ibYear !== 'undefined' ? ibYear : '',
        targetScore: typeof targetScore !== 'undefined' ? targetScore : null,
        weekdayWakeup: typeof weekdayWakeup !== 'undefined' ? weekdayWakeup : '',
        saturdayWakeup: typeof saturdayWakeup !== 'undefined' ? saturdayWakeup : '',
        sundayWakeup: typeof sundayWakeup !== 'undefined' ? sundayWakeup : '',
        weekdaySleepHours: typeof weekdaySleepHours !== 'undefined' ? weekdaySleepHours : null,
        saturdaySleepHours: typeof saturdaySleepHours !== 'undefined' ? saturdaySleepHours : null,
        sundaySleepHours: typeof sundaySleepHours !== 'undefined' ? sundaySleepHours : null,
        transportMode: typeof transportMode !== 'undefined' ? transportMode : '',
        carDeparture: typeof carDeparture !== 'undefined' ? carDeparture : '',
        carToSchool: typeof carToSchool !== 'undefined' ? carToSchool : null,
        carFromSchool: typeof carFromSchool !== 'undefined' ? carFromSchool : null,
        motoDeparture: typeof motoDeparture !== 'undefined' ? motoDeparture : '',
        motoReturn: typeof motoReturn !== 'undefined' ? motoReturn : '',
        motoToSchool: typeof motoToSchool !== 'undefined' ? motoToSchool : null,
        motoFromSchool: typeof motoFromSchool !== 'undefined' ? motoFromSchool : null,
        selectedActivities: liste(typeof selectedActivities !== 'undefined' ? selectedActivities : [], function (a) {
            if (!a) return null;
            return { name: a.name, days: a.days || [], sameTime: !!a.sameTime, startTime: a.startTime || '', endTime: a.endTime || '', dayTimes: a.dayTimes || {} };
        }),
        phoneDays: liste(typeof phoneDays !== 'undefined' ? phoneDays : [], function (n) { return Number(n); }).sort(),
        samePhoneDuration: typeof samePhoneDuration !== 'undefined' ? !!samePhoneDuration : true,
        phoneDuration: typeof phoneDuration !== 'undefined' ? phoneDuration : null,
        phoneDayDurations: phone,
        sameFreeTime: typeof sameFreeTime !== 'undefined' ? !!sameFreeTime : true,
        freeTimeMinutes: typeof freeTimeMinutes !== 'undefined' ? freeTimeMinutes : null,
        freeTimeByDay: libre,
        holidayDates: typeof holidayDates !== 'undefined' ? holidayDates : {},
        holidayDroppedDates: typeof holidayDroppedDates !== 'undefined' ? holidayDroppedDates : {},
        holidaySemaine: typeof holidaySemaineCourante === 'function' ? holidaySemaineCourante() : '',
        memoirLevel: typeof memoirLevel !== 'undefined' ? memoirLevel : '',
        iaLevel: typeof iaLevel !== 'undefined' ? iaLevel : '',
        iaLevels: typeof iaLevels !== 'undefined' ? iaLevels : {},
        memoirPlan: liste(typeof memoirPlan !== 'undefined' ? memoirPlan : [], function (p) {
            return p ? { id: p.id, text: p.text, done: !!p.done } : null;
        }),
        iaPlans: typeof iaPlans !== 'undefined' ? iaPlans : {},
        reglesPlanning: '20261019a',
        customEvents: liste(typeof customEvents !== 'undefined' ? customEvents : [], function (e) {
            if (!e || e.id === 'boite-garde') return null;
            return {
                id: e.id, day: e.day, title: e.title, startTime: e.startTime, endTime: e.endTime,
                type: e.type, replacesId: e.replacesId || '', deleted: !!e.deleted, source: e.source || '', exoId: e.exoId || '',
                resteEcole: !!e.resteEcole
            };
        }).filter(Boolean)
    };
    /* La réponse au bac national fait partie des faits : dès qu'un élève
       de DP2 répond (oui ou non), la signature change et l'emploi figé
       d'avant la réponse est reconstruit — sinon le planning ne bouge
       pas. Sans réponse (null), la signature reste celle d'avant. */
    var bacNational = null;
    try {
        if (typeof devoirsLireStore === 'function') bacNational = devoirsLireStore().bac;
    } catch (e) { bacNational = null; }
    if (bacNational === true || bacNational === false) faits.bacNational = bacNational;
    /* L'emploi du temps scolaire chargé fait partie des faits : dès qu'il
       change (ou disparaît), l'emploi figé est reconstruit. */
    try {
        if (typeof emploiScolaireCompact === 'function') faits.emploiScolaire = emploiScolaireCompact();
    } catch (e) {}
    if (typeof habitudesActives === 'function' && habitudesActives()) {
        faits.habitudes = {
            prepMatin: typeof prepMatinMinutes === 'number' ? prepMatinMinutes : 30,
            prepMatinDebut: typeof prepMatinDebut === 'string' ? prepMatinDebut : '',
            prepMatinFin: typeof prepMatinFin === 'string' ? prepMatinFin : '',
            prepSoir: typeof prepSoirMinutes === 'number' ? prepSoirMinutes : 30,
            prepSoirDebut: typeof prepSoirDebut === 'string' ? prepSoirDebut : '',
            prepSoirFin: typeof prepSoirFin === 'string' ? prepSoirFin : '',
            petitDej: typeof petitDejHeure === 'string' ? petitDejHeure : '',
            petitDejDuree: typeof petitDejMinutes === 'number' ? petitDejMinutes : 30,
            diner: typeof dinerHeure === 'string' ? dinerHeure : '',
            dinerDuree: typeof dinerMinutes === 'number' ? dinerMinutes : 45
        };
    }
    try { return JSON.stringify(faits); } catch (e) { return ''; }
}

function emploiEstFige() {
    return !!(emploiFige && emploiFige.sig && emploiFige.sig === emploiFaitsSignature() && Array.isArray(emploiFige.jours) && emploiFige.jours.length === 7);
}

function emploiReconstruire(dayIndex) {
    emploiGelSuspendu++;
    var jours = [];
    var i;
    try {
        for (i = 0; i < 7; i++) jours.push(genererJourBrut(i) || []);
        if (!emploiNePasSauver) {
            emploiFige = { sig: emploiFaitsSignature(), at: new Date().toISOString(), jours: emploiCloner(jours) };
        }
        return emploiCloner(jours[dayIndex] || []);
    } finally {
        emploiGelSuspendu--;
    }
}

function planningEstReveil(ev) {
    if (!ev) return false;
    if (ev.id === 'wakeup' || ev.type === 'wakeup') return true;
    var titre = String(ev.title || ev.t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return titre === 'reveil' || titre.indexOf('reveil') === 0;
}

function planningEstCoucher(ev) {
    if (!ev) return false;
    if (ev.id === 'sleep' || ev.type === 'sleep') return true;
    var titre = String(ev.title || ev.t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return titre === 'coucher' || titre.indexOf('coucher') === 0;
}

function ordonnerExtremitesJour(events) {
    var reveils = [];
    var couchers = [];
    var milieu = [];
    (events || []).forEach(function (ev) {
        if (!ev) return;
        if (planningEstReveil(ev)) reveils.push(ev);
        else if (planningEstCoucher(ev)) couchers.push(ev);
        else milieu.push(ev);
    });
    return reveils.concat(milieu, couchers);
}

function planningTitreNu(ev) {
    return String(ev && (ev.title || ev.t) || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function planningEstPreparation(ev) {
    if (!ev) return false;
    if (ev.id === 'prepSoir' || ev.type === 'prep-soir') return false;
    if (ev.id === 'prep' || ev.type === 'prep') return true;
    var titre = planningTitreNu(ev);
    if (titre.indexOf('preparation du soir') === 0) return false;
    return titre === 'preparation' || titre.indexOf('preparation') === 0;
}

function planningEstTrajetEcole(ev) {
    if (!ev) return false;
    if (ev.id === 'commute1') return true;
    return planningTitreNu(ev).indexOf('trajet ecole') === 0;
}

function planningEstTrajetMaison(ev) {
    if (!ev) return false;
    if (ev.id === 'commute2') return true;
    return planningTitreNu(ev).indexOf('trajet maison') === 0;
}

function planningEstCours(ev) {
    if (!ev) return false;
    if (ev.id === 'school1' || ev.id === 'school2' || ev.type === 'school') return true;
    return planningTitreNu(ev) === 'cours';
}

function planningResteEcole() {
    return false;
}

function planningLireMinute(ev, fin) {
    var brut = String(fin ? ((ev && (ev.endTime || ev.f)) || '') : ((ev && (ev.startTime || ev.d)) || ''));
    var parts = brut.split(':');
    var h = Number(parts[0]);
    var m = Number(parts[1]);
    if (!isFinite(h) || !isFinite(m)) return null;
    return h * 60 + m;
}

function planningHorlogeSimple(mins) {
    var total = ((Math.round(Number(mins) || 0) % 1440) + 1440) % 1440;
    var h = Math.floor(total / 60);
    var m = total % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

function planningPoserHoraire(ev, debut, fin) {
    if (!ev) return;
    if (ev.d != null || ev.t != null) {
        ev.d = debut;
        ev.f = fin;
    }
    if (ev.startTime != null || ev.title != null || ev.type != null || ev.id != null) {
        ev.startTime = debut;
        ev.endTime = fin;
    }
    if (ev.startTime == null && ev.d == null) {
        ev.startTime = debut;
        ev.endTime = fin;
    }
}

function planningGarantirJour(events) {
    var list = (events || []).filter(Boolean).map(function (ev) { return Object.assign({}, ev); });
    if (!list.length) return [];
    var reveils = [];
    var couchers = [];
    var milieu = [];
    list.forEach(function (ev) {
        if (planningEstReveil(ev)) reveils.push(ev);
        else if (planningEstCoucher(ev)) couchers.push(ev);
        else milieu.push(ev);
    });
    function plusTot(a, b) {
        return (planningLireMinute(a, false) || 0) - (planningLireMinute(b, false) || 0);
    }
    var reveil = (reveils.filter(function (ev) { return ev.id === 'wakeup' || ev.type === 'wakeup'; })[0]) || reveils.slice().sort(plusTot)[0];
    if (!reveil) {
        var premier = milieu.slice().sort(plusTot)[0];
        var finReveil = premier ? planningLireMinute(premier, false) : 6 * 60;
        if (finReveil == null) finReveil = 6 * 60;
        var debutReveil = finReveil - 10;
        if (debutReveil < 0) debutReveil = 0;
        reveil = { id: 'wakeup', title: 'Réveil', t: 'Réveil', type: 'wakeup', icon: '🌅' };
        planningPoserHoraire(reveil, planningHorlogeSimple(debutReveil), planningHorlogeSimple(finReveil));
    }
    var minuteReveil = planningLireMinute(reveil, false);
    if (minuteReveil == null) minuteReveil = 6 * 60;
    function ordreJour(ev) {
        var minute = planningLireMinute(ev, false);
        if (minute == null) return 1440;
        if (minute < minuteReveil && !(ev && ev.habitudeFixe)) minute += 1440;
        return minute;
    }
    function minuteRelative(ev, fin) {
        var minute = planningLireMinute(ev, !!fin);
        if (minute == null) return null;
        var debut = planningLireMinute(ev, false);
        if (fin && debut != null && minute <= debut) minute += 1440;
        if (debut != null && debut < minuteReveil) minute += 1440;
        else if (minute < minuteReveil) minute += 1440;
        return minute;
    }
    function dureeGardee(ev, defaut, min, max) {
        var debut = planningLireMinute(ev, false);
        var fin = planningLireMinute(ev, true);
        var duree = debut == null || fin == null ? defaut : fin - debut;
        if (duree <= 0) duree += 1440;
        if (duree < min || duree > max) return defaut;
        return duree;
    }
    milieu.sort(function (a, b) { return ordreJour(a) - ordreJour(b); });
    var cours = milieu.filter(planningEstCours);
    var trajet = milieu.filter(planningEstTrajetEcole)[0] || null;
    var retour = milieu.filter(planningEstTrajetMaison)[0] || null;
    var prep = milieu.filter(planningEstPreparation)[0] || null;
    if (cours.length) {
        var debutCours = null;
        var finCours = null;
        cours.forEach(function (ev) {
            var debut = minuteRelative(ev, false);
            var fin = minuteRelative(ev, true);
            if (debut != null && (debutCours == null || debut < debutCours)) debutCours = debut;
            if (fin != null && (finCours == null || fin > finCours)) finCours = fin;
        });
        if (debutCours == null) debutCours = 7 * 60 + 50;
        if (finCours == null || finCours <= debutCours) finCours = typeof COURS_FIN === 'number' ? COURS_FIN : (16 * 60 + 25);
        if (!trajet) {
            trajet = { id: 'commute1', title: 'Trajet école', t: 'Trajet école', type: 'transport', icon: '🚗' };
            milieu.push(trajet);
        }
        var finAller = minuteRelative(trajet, true);
        var debutAller = minuteRelative(trajet, false);
        if (finAller == null || finAller > debutCours || debutAller == null || debutAller >= debutCours) {
            var dureeAller = dureeGardee(trajet, 30, 5, 90);
            var nouveauAller = debutCours - dureeAller;
            if (nouveauAller < minuteReveil) nouveauAller = minuteReveil;
            if (nouveauAller >= debutCours) nouveauAller = Math.max(0, debutCours - 10);
            planningPoserHoraire(trajet, planningHorlogeSimple(nouveauAller), planningHorlogeSimple(debutCours));
        }
        var sejours = milieu.filter(planningResteEcole).sort(function (a, b) { return ordreJour(a) - ordreJour(b); });
        var ancreFin = finCours;
        sejours.forEach(function (ev) {
            var dureeSejour = dureeGardee(ev, 60, 10, 180);
            planningPoserHoraire(ev, planningHorlogeSimple(ancreFin), planningHorlogeSimple(ancreFin + dureeSejour));
            ancreFin += dureeSejour;
        });
        if (!retour) {
            retour = { id: 'commute2', title: 'Trajet maison', t: 'Trajet maison', type: 'transport', icon: '🚗' };
            milieu.push(retour);
        }
        var dureeRetour = dureeGardee(retour, 40, 5, 120);
        planningPoserHoraire(retour, planningHorlogeSimple(ancreFin), planningHorlogeSimple(ancreFin + dureeRetour));
    }
    if (trajet) {
        var debutTrajet = planningLireMinute(trajet, false);
        if (debutTrajet == null) debutTrajet = minuteReveil + 30;
        if (!prep) {
            prep = { id: 'prep', title: 'Préparation', t: 'Préparation', type: 'prep', icon: '🚿' };
            milieu.push(prep);
        }
        var debutPrep = planningLireMinute(prep, false);
        var finPrep = planningLireMinute(prep, true);
        var duree = debutPrep == null || finPrep == null ? 30 : finPrep - debutPrep;
        if (duree <= 0) duree += 1440;
        var habitudePrep = !!(prep.habitudeFixe || (typeof habitudesActives === 'function' && habitudesActives()));
        var consignePrep = habitudePrep && typeof habitudesDureeMatin === 'function' ? habitudesDureeMatin() : null;
        if (consignePrep && consignePrep.heure && consignePrep.fin && !prep.ovPinned) {
            planningPoserHoraire(prep, consignePrep.heure, consignePrep.fin);
        } else {
            if (consignePrep && consignePrep.mode === 'fixe' && !prep.ovPinned) duree = consignePrep.duree;
            else if (!habitudePrep && (duree < 10 || duree > 40)) duree = 30;
            var nouveauDebut = debutTrajet - duree;
            if (!habitudePrep) {
                var finReveil = planningLireMinute(reveil, true);
                if (finReveil != null && nouveauDebut < finReveil && finReveil < debutTrajet) nouveauDebut = finReveil;
                if (nouveauDebut < minuteReveil && minuteReveil < debutTrajet) nouveauDebut = minuteReveil;
            }
            if (nouveauDebut < 0) nouveauDebut = 0;
            if (!habitudePrep && nouveauDebut >= debutTrajet) nouveauDebut = Math.max(0, debutTrajet - 10);
            planningPoserHoraire(prep, planningHorlogeSimple(nouveauDebut), planningHorlogeSimple(debutTrajet));
        }
    }
    milieu.sort(function (a, b) { return ordreJour(a) - ordreJour(b); });
    function retirer(pred) {
        var gardes = [];
        var suite = [];
        milieu.forEach(function (ev) {
            if (pred(ev) && !gardes.length) gardes.push(ev);
            else if (!pred(ev)) suite.push(ev);
            else suite.push(ev);
        });
        if (gardes.length) milieu = milieu.filter(function (ev) { return ev !== gardes[0]; });
        return gardes[0] || null;
    }
    if (trajet) prep = retirer(planningEstPreparation) || prep;
    trajet = retirer(planningEstTrajetEcole) || trajet;
    retour = retirer(planningEstTrajetMaison) || retour;
    /* Chaque créneau reprend sa place dans l'ordre de la journée. Avant, la
       Préparation et le Trajet école étaient collés juste avant le premier cours :
       quand le petit-déjeuner et les exercices occupaient la fin de matinée, ils
       s'affichaient après eux, donc dans le désordre. */
    function poserAuBonMoment(ev) {
        if (!ev) return;
        var i;
        for (i = 0; i < milieu.length; i++) {
            if (ordreJour(milieu[i]) > ordreJour(ev)) break;
        }
        milieu.splice(i, 0, ev);
    }
    if (trajet) {
        poserAuBonMoment(prep);
        poserAuBonMoment(trajet);
    }
    if (retour) {
        var ancre = -1;
        var iAncre;
        for (iAncre = 0; iAncre < milieu.length; iAncre++) {
            if (planningResteEcole(milieu[iAncre])) ancre = iAncre;
        }
        if (ancre < 0) {
            for (iAncre = 0; iAncre < milieu.length; iAncre++) {
                if (planningEstCours(milieu[iAncre])) ancre = iAncre;
            }
        }
        if (ancre < 0) milieu.push(retour);
        else milieu.splice(ancre + 1, 0, retour);
    }
    var coucher = (couchers.filter(function (ev) { return ev.id === 'sleep' || ev.type === 'sleep'; })[0]) || couchers.slice().sort(function (a, b) { return ordreJour(b) - ordreJour(a); })[0];
    if (!coucher) {
        var dernier = milieu[milieu.length - 1];
        var debutCoucher = dernier ? planningLireMinute(dernier, true) : 22 * 60;
        if (debutCoucher == null) debutCoucher = 22 * 60;
        if (debutCoucher <= minuteReveil) debutCoucher += 1440;
        coucher = { id: 'sleep', title: 'Coucher', t: 'Coucher', type: 'sleep', icon: '😴' };
        planningPoserHoraire(coucher, planningHorlogeSimple(debutCoucher), planningHorlogeSimple(minuteReveil));
    }
    planningReveilApresCoucher(reveil, coucher);
    protegerSommeil();
    milieu.sort(function (a, b) { return ordreJour(a) - ordreJour(b); });
    return [reveil].concat(milieu, [coucher]);

    /* Le sommeil ne descend jamais sous 5 h. Avant, un créneau tardif
       (une révision ajoutée à 00 h 35 par exemple) repoussait le coucher
       après lui : des journées sont restées à 4 h 25, voire 3 h de sommeil.
       Désormais le coucher recule pour garantir les 5 h, et seul un
       créneau qui chevauche ce coucher est raccourci. Les créneaux plus
       tôt dans la soirée, les cours et les habitudes du petit matin
       (prière de l'aube, préparation avant le réveil) ne bougent pas. */
    function protegerSommeil() {
        if (!reveil || !coucher) return;
        var debutCoucher = planningLireMinute(coucher, false);
        if (debutCoucher == null) return;
        var lit = debutCoucher <= minuteReveil ? debutCoucher + 1440 : debutCoucher;
        var finJour = minuteReveil + 1440;
        if (finJour - lit >= PLANNING_SOMMEIL_MIN) return;
        var cible = finJour - PLANNING_SOMMEIL_MIN;
        var finCours = 0;
        milieu.forEach(function (ev) {
            if (!planningEstCours(ev)) return;
            var fin = minuteRelative(ev, true);
            if (fin != null && fin > finCours && fin <= finJour) finCours = fin;
        });
        if (cible < finCours) cible = finCours;
        planningPoserHoraire(coucher, planningHorlogeSimple(cible), planningHorlogeSimple(minuteReveil));
        milieu.forEach(function (ev) {
            if (!ev || planningEstCours(ev) || planningEstReveil(ev) || planningEstCoucher(ev)) return;
            var debut = minuteRelative(ev, false);
            var fin = minuteRelative(ev, true);
            if (debut == null || fin == null || debut >= finJour) return;
            if (debut < cible && fin > cible) {
                planningPoserHoraire(ev, planningHorlogeSimple(debut), planningHorlogeSimple(cible));
            }
        });
    }
}

function planningReveilApresCoucher(reveil, coucher) {
    if (!reveil || !coucher) return;
    var debutReveil = planningLireMinute(reveil, false);
    var finCoucher = planningLireMinute(coucher, true);
    var debutCoucher = planningLireMinute(coucher, false);
    if (debutReveil == null || finCoucher == null) return;
    if (debutCoucher == null) debutCoucher = 22 * 60;
    var fin = finCoucher <= debutCoucher ? finCoucher + 1440 : finCoucher;
    var reveilAbs = debutReveil <= debutCoucher ? debutReveil + 1440 : debutReveil;
    if (fin > reveilAbs) {
        planningPoserHoraire(coucher, planningHorlogeSimple(debutCoucher), planningHorlogeSimple(debutReveil));
    }
}

/* Un emploi enregistré garde ses anciennes images de repas : on les remet
   en ordre à chaque lecture (croissant, puis l'assiette pour les deux repas). */
function v3Repas(jour) {
    return typeof v3IconesRepas === 'function' ? v3IconesRepas(jour) : jour;
}

function generateDayEvents(dayIndex) {
    var jour = Number(dayIndex);
    if (!isFinite(jour) || jour < 0) jour = 0;
    var evts;
    if (emploiGelSuspendu || window.__emploiCalculBrut) {
        evts = v3Repas(planningGarantirJour(genererJourBrut(jour)));
    } else {
        if (typeof verrouillerSujetsChoisis === 'function') {
            try { verrouillerSujetsChoisis(); } catch (e) {}
        }
        if (emploiEstFige() && emploiFige.jours[jour]) evts = v3Repas(planningGarantirJour(planningCorrigerCours(emploiCloner(emploiFige.jours[jour]))));
        else evts = v3Repas(planningGarantirJour(emploiReconstruire(jour)));
        /* Devoirs et examens : les blocs datés (compositions, épreuves,
           révisions ciblées) s'ajoutent au jour affiché. */
        if (typeof devoirsAdapterJour === 'function') {
            try { evts = devoirsAdapterJour(evts, jour); } catch (e) {}
        }
    }
    return planningSansExercicesFaits(evts);
}

function planningDepuisProgression() {
    if (typeof verrouillerSujetsChoisis === 'function') {
        try { verrouillerSujetsChoisis(); } catch (e) {}
    }
    if (typeof planningActualiser === 'function') planningActualiser();
}

function genererJourBrut(dayIndex) {
    const isWeekend = dayIndex >= 5;
    const isSaturday = dayIndex === 5;
    const isSunday = dayIndex === 6;
    /* Samedi du bac national : le cours commence à 8h, on se lève comme
       un jour d'école. */
    const samediBac = isSaturday && typeof devoirsFaitBac === 'function' && devoirsFaitBac();
    let wakeupTime = isWeekend ? (isSaturday ? saturdayWakeup : sundayWakeup) : weekdayWakeup;
    if (samediBac) {
        const reveilSamedi = timeToMinutes(saturdayWakeup);
        if (reveilSamedi > 7 * 60) wakeupTime = '07:00';
    }
    /* Le coucher suit le réveil : avec le bac à 8h, on se couche assez
       tôt pour garder au moins 5 heures de sommeil. */
    const heuresSamedi = (typeof saturdaySleepHours === 'number' && isFinite(saturdaySleepHours)) ? saturdaySleepHours : null;
    const bedtime = samediBac
        ? calculateBedtime(wakeupTime, heuresSamedi)
        : ((typeof bedtimeForDay === 'function') ? bedtimeForDay(dayIndex) : calculateBedtime(wakeupTime));
    const hMode = holidayBypass ? null : ((typeof holidayMode === 'function') ? holidayMode(dayIndex) : null);
    if (hMode === 'free') return [];

    const events = [];
    let cursor = wakeupTime;

    // Chargement des modifications sauvegardées (comme avant)
    const savedEvents = localStorage.getItem(V3_STORAGE_KEY);
    if (savedEvents && customEvents.length === 0 && !window.__emploiCalculBrut) {
        try { customEvents = JSON.parse(savedEvents) || []; } catch (e) { customEvents = []; }
    }

    const ovFor = (id) => v3FindOverride(id, dayIndex);
    /* L'assiette de pâtes du dîner devient une assiette avec couteau et
       fourchette, même dans les plannings enregistrés avant le changement. */
    const v3IconeRepas = (icone) => (icone === '🍝' ? '🍽️' : icone);

    // Créneau automatique : commence au curseur. Applique la modification de
    // l'élève si elle existe (nom, icône, durée, heure fixée, suppression).
    function chain(id, title, subtitle, duration, type, icon, editable) {
        const ov = ovFor(id);
        if (ov && ov.deleted) return cursor; // supprimé pour ce jour
        let pinned = false, startTime = cursor;
        if (ov) {
            if (ov.title) title = ov.title;
            if (ov.icon && ov.icon !== '📌') icon = v3IconeRepas(ov.icon);
            const ovDur = timeToMinutes(ov.endTime) - timeToMinutes(ov.startTime);
            if (ovDur > 0) duration = ovDur;
            if (ov.pinned && ov.startTime) { pinned = true; startTime = ov.startTime; }
        }
        const endTime = addMinutes(startTime, duration);
        events.push({ id, title, subtitle, startTime, endTime, type, icon, editable, kind: pinned ? 'pinned' : 'flex', ovPinned: pinned, resteEcole: !!(ov && ov.resteEcole) });
        if (!pinned) cursor = endTime; // un créneau fixé ne décale pas la chaîne nominale
        return cursor;
    }

    function repasSelonHabitude(id, title, icon, dureeDefaut, heureDefaut, finDefaut) {
        var consigne = typeof habitudesRepas === 'function' ? habitudesRepas(id) : null;
        if (consigne && consigne.mode === 'omis') return;
        if (consigne && consigne.mode === 'fixe') {
            var ov = ovFor(id);
            if (ov && ov.deleted) return;
            var heure = consigne.heure;
            var duree = consigne.duree;
            var titre = title;
            var icone = icon;
            if (ov) {
                if (ov.title) titre = ov.title;
                if (ov.icon && ov.icon !== '📌') icone = v3IconeRepas(ov.icon);
                var ovDur = timeToMinutes(ov.endTime) - timeToMinutes(ov.startTime);
                if (ovDur > 0) duree = ovDur;
                if (ov.pinned && ov.startTime) heure = ov.startTime;
            }
            events.push({
                id: id, title: titre, subtitle: duree + ' min', startTime: heure, endTime: addMinutes(heure, duree),
                type: 'meal', icon: icone, editable: true, kind: 'pinned', habitudeFixe: true, horaireEntre: true,
                ovPinned: !!(ov && ov.pinned), preferMin: timeToMinutes(heure)
            });
            return;
        }
        if (heureDefaut && finDefaut) fixed(id, title, '', heureDefaut, finDefaut, 'meal', icon);
        else chain(id, title, '', dureeDefaut, 'meal', icon, true);
    }

    function poserPreparationMatin() {
        var consigne = typeof habitudesDureeMatin === 'function' ? habitudesDureeMatin() : null;
        if (consigne && consigne.mode === 'fixe' && consigne.heure && consigne.fin) {
            var ovHeure = ovFor('prep');
            if (ovHeure && ovHeure.deleted) return;
            var heure = consigne.heure;
            var fin = consigne.fin;
            if (ovHeure && ovHeure.pinned && ovHeure.startTime && ovHeure.endTime) {
                heure = ovHeure.startTime;
                fin = ovHeure.endTime;
            }
            events.push({
                id: 'prep', title: 'Préparation', subtitle: heure + ' – ' + fin, startTime: heure, endTime: fin,
                type: 'prep', icon: '🚿', editable: true, kind: 'pinned', habitudeFixe: true, horaireEntre: true,
                ovPinned: !!(ovHeure && ovHeure.pinned)
            });
            return;
        }
        var duree = consigne && consigne.mode === 'fixe' ? consigne.duree : 30;
        chain('prep', 'Préparation', consigne && consigne.mode === 'fixe' ? (duree + ' min') : '', duree, 'prep', '🚿', true);
        if (!(consigne && consigne.mode === 'fixe')) return;
        var prepEv = events.find(function (e) { return e && e.id === 'prep'; });
        if (prepEv && !prepEv.ovPinned) {
            prepEv.habitudeFixe = true;
            prepEv.kind = 'pinned';
            prepEv.horaireEntre = true;
        }
    }

    function poserPreparationSoir() {
        var consigne = typeof habitudesDureeSoir === 'function' ? habitudesDureeSoir() : null;
        if (!consigne || consigne.mode !== 'fixe' || !(consigne.duree > 0)) return;
        var ov = ovFor('prepSoir');
        if (ov && ov.deleted) return;
        var duree = consigne.duree;
        var fin = timeToMinutes(bedtime);
        var debut = fin - duree;
        if (consigne.heure && consigne.fin) {
            debut = timeToMinutes(consigne.heure);
            fin = timeToMinutes(consigne.fin);
            duree = fin - debut;
        }
        if (debut < 0) debut = 0;
        var startTime = v3M2T(debut);
        var endTime = v3M2T(fin);
        if (ov && ov.pinned && ov.startTime) {
            startTime = ov.startTime;
            endTime = ov.endTime || addMinutes(startTime, duree);
            var ovDur = timeToMinutes(endTime) - timeToMinutes(startTime);
            if (ovDur > 0) duree = ovDur;
        }
        events.push({
            id: 'prepSoir', title: 'Préparation du soir', subtitle: duree + ' min', startTime: startTime, endTime: endTime,
            type: 'prep-soir', icon: '🌙', editable: true, kind: 'pinned', habitudeFixe: true, horaireEntre: true,
            ovPinned: !!(ov && ov.pinned), preferMin: timeToMinutes(startTime)
        });
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

    repasSelonHabitude('breakfast', 'Petit-déjeuner', '🥐', 30);

    if (isSunday) {
        poserPreparationMatin();
        /* Avec un emploi du temps chargé, les matières vues dans la
           semaine passent avant le complément. */
        const programmeWeekEnd = typeof emploiScolaireProgramme === 'function' ? emploiScolaireProgramme(dayIndex) : null;
        const fileRev = (programmeWeekEnd && programmeWeekEnd.length) ? programmeWeekEnd : (typeof filePriorite === 'function' ? filePriorite(allSubj) : allSubj);
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
        repasSelonHabitude('dinner', 'Dîner', '🍽️', 45, '19:00', '19:45');
        if (phoneTime > 0) chain('phone', 'Téléphone', formatDuration(phoneTime), phoneTime, 'phone', '📱', true);

    } else if (isSaturday) {
        poserPreparationMatin();
        if (samediBac) {
            /* Matinée du bac : trajet, puis cours du bac national de
               8h00 à 13h00, puis retour à la maison. */
            const trajetBac = trajetProfil();
            chain('commute1', 'Trajet école', trajetBac.aller + ' min · départ ' + trajetBac.depart, trajetBac.aller, 'transport', trajetBac.icon, true);
            fixed('bac-samedi', 'Bac national', '8h00 → 13h00', '08:00', '13:00', 'school', '🎓');
            chain('commute2', 'Trajet maison', trajetBac.retour + ' min', trajetBac.retour, 'transport', trajetBac.icon, true);
            fixerTrajet(events, 'commute1', debutTrajetAller(trajetBac.depart, trajetBac.aller, 8 * 60), trajetBac.aller);
        }
        /* Avec un emploi du temps chargé, les matières vues dans la
           semaine passent avant le complément. */
        const programmeWeekEnd = typeof emploiScolaireProgramme === 'function' ? emploiScolaireProgramme(dayIndex) : null;
        const fileRev = (programmeWeekEnd && programmeWeekEnd.length) ? programmeWeekEnd : (typeof filePriorite === 'function' ? filePriorite(allSubj) : allSubj);
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
        repasSelonHabitude('dinner', 'Dîner', '🍽️', 45, '19:00', '19:45');
        if (phoneTime > 0) chain('phone', 'Téléphone', formatDuration(phoneTime), phoneTime, 'phone', '📱', true);

    } else {
        // ── SEMAINE Lun-Ven ──
        const trajet = trajetProfil();
        /* L'emploi du temps scolaire chargé par l'élève : ses vrais cours
           remplacent les créneaux génériques, et les heures creuses
           reçoivent du travail. */
        const coursReels = (typeof emploiScolaireJour === 'function' && typeof emploiH2M === 'function') ? emploiScolaireJour(dayIndex) : [];
        if (coursReels.length) {
            poserPreparationMatin();
            const premierCours = emploiH2M(coursReels[0].debut);
            const dernierCours = emploiH2M(coursReels[coursReels.length - 1].fin);
            chain('commute1', 'Trajet école', trajet.aller + ' min · départ ' + trajet.depart, trajet.aller, 'transport', trajet.icon, true);
            coursReels.forEach(function (c, i) {
                fixed('cours-reel-' + i, c.nom, coursTexte(emploiH2M(c.debut)) + ' → ' + coursTexte(emploiH2M(c.fin)), c.debut, c.fin, 'school', '🏫');
            });
            if (dayIndex === 4 && typeof devoirsFaitBac === 'function' && devoirsFaitBac() &&
                !coursReels.some(function (c) { return emploiH2M(c.debut) < 16 * 60 + 25 && emploiH2M(c.fin) > 14 * 60 + 55; })) {
                /* Vendredi du bac national : le créneau 14h55-16h25 lui est
                   réservé, sauf si un cours réel l'occupe déjà. */
                fixed('bac-vendredi', 'Bac national', '14h55 → 16h25', '14:55', '16:25', 'school', '🎓');
            }
            /* le déjeuner se pose dans le creux du midi */
            const trouMidi = (typeof emploiScolaireTrouMidi === 'function') ? emploiScolaireTrouMidi(coursReels) : null;
            var dejeuner = null;
            if (trouMidi && trouMidi.fin - trouMidi.debut >= 35) {
                var debutDej = Math.min(Math.max(12 * 60 + 30, trouMidi.debut + 5), trouMidi.fin - 30);
                var dureeDej = Math.min(60, trouMidi.fin - debutDej);
                if (dureeDej >= 20) {
                    dejeuner = { debut: debutDej, fin: debutDej + dureeDej };
                    fixed('lunch', 'Déjeuner', '', coursHorloge(dejeuner.debut), coursHorloge(dejeuner.fin), 'meal', '🍽️');
                }
            }
            /* les heures creuses : révisions de la prochaine matière,
               exercices, mémoire, évaluation interne, CAS */
            if (typeof emploiScolaireTrous === 'function' && typeof emploiScolaireBlocsTravail === 'function') {
                var optionsJour = (typeof emploiScolaireOptionsJour === 'function') ? emploiScolaireOptionsJour() : { sujets: [], memoire: false, ia: false };
                emploiScolaireTrous(coursReels, 40).forEach(function (trou, ti) {
                    var segments = [{ debut: trou.debut, fin: trou.fin }];
                    if (dejeuner) {
                        var apres = [];
                        segments.forEach(function (seg) {
                            if (dejeuner.fin <= seg.debut || dejeuner.debut >= seg.fin) apres.push(seg);
                            else {
                                if (dejeuner.debut - seg.debut >= 40) apres.push({ debut: seg.debut, fin: dejeuner.debut });
                                if (seg.fin - dejeuner.fin >= 40) apres.push({ debut: dejeuner.fin, fin: seg.fin });
                            }
                        });
                        segments = apres;
                    }
                    segments.forEach(function (seg) {
                        var trouSeg = { debut: seg.debut, fin: seg.fin, avant: trou.avant };
                        var blocs = emploiScolaireBlocsTravail(trouSeg, optionsJour);
                        var pos = seg.debut + 5;
                        blocs.forEach(function (b) {
                            events.push({
                                id: b.id + '-' + ti,
                                title: b.titre,
                                subtitle: b.sous,
                                startTime: coursHorloge(pos),
                                endTime: coursHorloge(pos + b.duree),
                                type: b.type === 'study' ? b.couleur : b.type,
                                icon: b.icone,
                                editable: true,
                                kind: 'pinned',
                                preferMin: pos
                            });
                            pos += b.duree + 10;
                        });
                    });
                });
            }
            chain('commute2', 'Trajet maison', trajet.retour + ' min' + (trajet.retourHeure ? ' · ' + trajet.retourHeure : ''), trajet.retour, 'transport', trajet.icon, true);
            fixerTrajet(events, 'commute1', debutTrajetAller(trajet.depart, trajet.aller, premierCours), trajet.aller);
            calerPreparation(events, 'commute1');
            fixerTrajet(events, 'commute2', dernierCours, trajet.retour);
        } else {
        poserPreparationMatin();
        chain('commute1', 'Trajet école', trajet.aller + ' min · départ ' + trajet.depart, trajet.aller, 'transport', trajet.icon, true);
        fixed('school1', 'Cours', coursTexte(COURS_DEBUT) + ' → ' + coursTexte(COURS_FIN_MATIN), coursHorloge(COURS_DEBUT), coursHorloge(COURS_FIN_MATIN), 'school', '🏫');
        fixed('lunch', 'Déjeuner', '', '12:30', '13:30', 'meal', '🍽️');
        if (dayIndex === 4 && typeof devoirsFaitBac === 'function' && devoirsFaitBac()) {
            /* Vendredi du bac national : l'après-midi se partage entre le
               lycée et le cours du bac. */
            fixed('school2', 'Cours', '13h30 → 14h55', '13:30', '14:55', 'school', '🏫');
            fixed('bac-vendredi', 'Bac national', '14h55 → 16h25', '14:55', '16:25', 'school', '🎓');
        } else {
            fixed('school2', 'Cours', '13h30 → ' + coursTexte(COURS_FIN), '13:30', coursHorloge(COURS_FIN), 'school', '🏫');
        }
        chain('commute2', 'Trajet maison', trajet.retour + ' min' + (trajet.retourHeure ? ' · ' + trajet.retourHeure : ''), trajet.retour, 'transport', trajet.icon, true);
        fixerTrajet(events, 'commute1', debutTrajetAller(trajet.depart, trajet.aller, COURS_DEBUT), trajet.aller);
        calerPreparation(events, 'commute1');
        fixerTrajet(events, 'commute2', debutTrajetRetour(COURS_FIN, trajet.retourHeure), trajet.retour);
        }
        /* Le programme du planning suit l'emploi du temps scolaire : le
           soir, on révise d'abord les matières vues ce jour-là (ordre de
           l'emploi du temps), puis les autres matières en complément. */
        const programmeJour = typeof emploiScolaireProgramme === 'function' ? emploiScolaireProgramme(dayIndex) : null;
        const mainSubj = (programmeJour && programmeJour.length)
            ? programmeJour[0]
            : (typeof sujetDuJour === 'function' ? sujetDuJour(allSubj, dayIndex) : allSubj[dayIndex % Math.max(1, allSubj.length)]);
        if (mainSubj) chain('study1', 'Révisions ' + mainSubj.name, sousTitreMatiere(mainSubj), dureeEtude(mainSubj, 90, 60), couleurMatiere(mainSubj), mainSubj.icon, true);
        const sciNames = ['Mathématiques', 'Physique', 'Chimie', 'Biologie'];
        const mainIsSci = mainSubj && sciNames.some(n => mainSubj.name.includes(n));
        var exSubj = null;
        if (!mainIsSci) {
            if (programmeJour && programmeJour.length) {
                /* les exercices prennent d'abord une science vue dans la
                   journée, puis la science habituelle */
                exSubj = programmeJour.filter(s => sciNames.some(n => s.name.includes(n)))[0] || null;
            }
            if (!exSubj) {
                const sciSubj = allSubj.filter(s => sciNames.some(n => s.name.includes(n)));
                if (sciSubj.length > 0) exSubj = typeof sujetDuJour === 'function' ? sujetDuJour(sciSubj, dayIndex) : sciSubj[dayIndex % sciSubj.length];
            }
        }
        if (exSubj) chain('exercises', 'Exercices ' + exSubj.name, sousTitreMatiere(exSubj), dureeEtude(exSubj, 45, 30), couleurMatiere(exSubj), '✏️', true);
        var s2sem = null;
        if (programmeJour && programmeJour.length > 1) {
            s2sem = programmeJour[1];
        } else {
            var fileSemaine = typeof filePriorite === 'function' ? filePriorite(allSubj) : allSubj;
            if (fileSemaine.length > 1 && mainSubj) {
                var kSem;
                for (kSem = 1; kSem < fileSemaine.length; kSem++) {
                    var cand = fileSemaine[(dayIndex + kSem) % fileSemaine.length];
                    if (cand && cand.name !== mainSubj.name) { s2sem = cand; break; }
                }
            }
        }
        if (s2sem) chain('study2', 'Révisions ' + s2sem.name, sousTitreMatiere(s2sem), dureeEtude(s2sem, 75, 45), couleurMatiere(s2sem), s2sem.icon, true);
        repasSelonHabitude('dinner', 'Dîner', '🍽️', 45);
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
            if (ov.icon && ov.icon !== '📌') icon = v3IconeRepas(ov.icon);
            const ovDur = timeToMinutes(ov.endTime) - timeToMinutes(ov.startTime);
            if (ov.pinned && ov.startTime) { startTime = ov.startTime; endTime = ov.endTime; }
            else if (ovDur > 0) endTime = addMinutes(startTime, ovDur);
        }
        events.push({ id, title, subtitle: 'Activité', startTime, endTime, type: 'activity', icon, editable: true, kind });
    });

    // ── CRÉNEAUX AJOUTÉS PAR L'ÉLÈVE (heure choisie → fixés 📌) ──
    customEvents.filter(e => e && e.day === dayIndex && !e.replacesId && !e.deleted && !coursEconomieSamedi(e, dayIndex) && !planningExerciceFait(e.exoId)).forEach(event => {
        events.push({ id: event.id, title: event.title, subtitle: '', startTime: event.startTime, endTime: event.endTime,
            type: event.type, icon: event.icon || '📌', editable: true, kind: 'pinned', source: event.source, exoId: event.exoId, resteEcole: !!event.resteEcole });
    });

    poserPreparationSoir();

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
    return planningGarantirJour(planningCorrigerCours(planningCondenserConsecutifs(planningRetirerTravauxFinis(verrouillerTrajets(planningBalayer(jour), dayIndex)), dayIndex)));
}

function planningCleActivite(ev) {
    if (!ev || !ev.title) return '';
    return String(ev.title).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[·•|]/g, ' ')
        .replace(/^revisions?\s+/, 'revision ')
        .replace(/^exercices?\s+/, 'exercices ')
        .replace(/\s+/g, ' ')
        .trim();
}

function planningEstProtege(ev) {
    if (!ev) return true;
    if (ev.id === 'sleep' || ev.id === 'wakeup' || ev.id === 'commute1' || ev.id === 'commute2') return true;
    return ev.type === 'school' || ev.type === 'transport';
}

function planningEstActiviteEleve(ev) {
    return !!(ev && (ev.type === 'activity' || ev.source === 'custom' || ev.source === 'exercice'));
}

function planningSujetDeRemplacement(dayIndex, interdit, list) {
    var all = (typeof emploiScolaireProgramme === 'function' && emploiScolaireProgramme(dayIndex)) || planningSujetsSaisis();
    var uses = {};
    (list || []).forEach(function (ev) {
        var cle = planningCleActivite(ev);
        if (cle) uses[cle] = (uses[cle] || 0) + 1;
    });
    var i;
    for (i = 0; i < all.length; i++) {
        var sujet = all[(Number(dayIndex) + i + 1) % all.length];
        if (!sujet || !sujet.name) continue;
        var cle = planningCleActivite({ title: 'Révisions ' + sujet.name });
        if (cle && cle !== interdit && !uses[cle]) return sujet;
    }
    return null;
}

function planningRemplacerDoublon(ev, list, dayIndex) {
    var interdit = planningCleActivite(ev);
    var sujet = planningSujetDeRemplacement(dayIndex, interdit, list);
    if (sujet) {
        ev.title = 'Révisions · ' + sujet.name;
        ev.subtitle = typeof sousTitreMatiere === 'function' ? (sousTitreMatiere(sujet) || '') : (sujet.level || '');
        ev.type = typeof couleurMatiere === 'function' ? couleurMatiere(sujet) : 'study';
        ev.icon = sujet.icon || '📚';
        ev.id = 'rev-autre-' + dayIndex + '-' + sujet.name.replace(/\s+/g, '-');
        return;
    }
    if (interdit !== 'temps libre') {
        ev.title = 'Temps libre';
        ev.subtitle = '';
        ev.type = 'free';
        ev.icon = '🎮';
        ev.id = 'libre-autre-' + dayIndex;
    }
}

function planningCondenserConsecutifs(events, dayIndex) {
    var list = (events || []).filter(function (ev) { return ev; }).map(function (ev) { return Object.assign({}, ev); });
    list.sort(function (a, b) { return planningMinutes(a.startTime) - planningMinutes(b.startTime); });
    var i = 0;
    while (i < list.length - 1) {
        var a = list[i];
        var b = list[i + 1];
        var cle = planningCleActivite(a);
        if (!cle || cle !== planningCleActivite(b) || planningEstProtege(a) || planningEstProtege(b)) {
            i++;
            continue;
        }
        var finA = planningMinutes(a.endTime);
        var debutA = planningMinutes(a.startTime);
        var debutB = planningMinutes(b.startTime);
        var finB = planningMinutes(b.endTime);
        if (!(finA > debutA) || !(finB > debutB) || debutB < finA - 1 || debutB > finA + 10) {
            i++;
            continue;
        }
        var total = finB - debutA;
        var eleve = planningEstActiviteEleve(a) || planningEstActiviteEleve(b);
        var repas = a.type === 'meal' || b.type === 'meal';
        var fragment = (finA - debutA) < 25 || (finB - debutB) < 25;
        if (eleve || repas || fragment || total <= 50) {
            a.endTime = b.endTime;
            if (typeof formatDuration === 'function' && (a.type === 'free' || a.type === 'phone')) a.subtitle = formatDuration(total);
            list.splice(i + 1, 1);
            continue;
        }
        planningRemplacerDoublon(b, list, dayIndex);
        i++;
    }
    return list;
}

function planningTravailFinalise(ev) {
    if (!ev || typeof eeEstFinalise !== 'function') return false;
    var titre = String(ev.title || '');
    var sous = String(ev.subtitle || '');
    var task = ev.planTask || null;
    if (ev.type === 'memoir' || (task && task.kind === 'memoir') || titre === 'Mémoire' || sous === 'Mémoire' || String(ev.id || '').indexOf('memoir') === 0) {
        return eeEstFinalise('memoir');
    }
    var ia = ev.type === 'ia' || (task && task.kind === 'ia') || String(ev.id || '').indexOf('ia-') === 0 || titre.indexOf('Évaluation interne') === 0 || sous.indexOf('Évaluation interne') === 0;
    if (!ia) return false;
    var nom = task && task.subject ? task.subject : '';
    if (!nom) {
        var m = (titre + ' ' + sous).match(/Évaluation interne\s·\s(.+)/);
        if (m) nom = m[1].trim();
    }
    if (!nom && typeof eeSujets === 'function') {
        eeSujets().some(function (s) {
            if (nom || !s || !s.name) return false;
            if (titre.indexOf(s.name) !== -1 || sous.indexOf(s.name) !== -1) nom = s.name;
            return !!nom;
        });
    }
    return nom ? eeEstFinalise('ia', nom) : false;
}

function planningRetirerTravauxFinis(events) {
    return (events || []).filter(function (ev) { return !planningTravailFinalise(ev); });
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
    if (typeof verrouillerSujetsChoisis === 'function') {
        try { verrouillerSujetsChoisis(); } catch (e) {}
    }
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
    /* avec un emploi du temps chargé, la matière de secours est la
       première matière vue dans la journée */
    var programmeEmploi = typeof emploiScolaireProgramme === 'function' ? emploiScolaireProgramme(dayIndex) : null;
    var subj = (programmeEmploi && programmeEmploi.length)
        ? programmeEmploi[0]
        : (typeof sujetDuJour === 'function' ? sujetDuJour(all, dayIndex) : all[dayIndex % all.length]);
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

/* Le programme des matières d'un jour quand un emploi du temps scolaire
   est chargé : les matières vues en classe passent en premier (celles
   de la journée en semaine — le soir on révise ce qu'on a vu dans la
   journée —, celles de la semaine le week-end), puis les autres
   matières du profil en complément, pour n'en perdre aucune. Renvoie
   null sans emploi du temps chargé ou sans matière reconnue : le
   planning garde alors ses règles habituelles. */
/* La matière de l'élève qui correspond au nom écrit sur un devoir :
   « Maths AA » → Mathématiques AA SL, « Histoire » → Histoire. Le nom
   exact d'abord, puis le début du nom, puis la famille de matières. */
function planningSujetDuDevoir(nom) {
    var liste = planningSujetsSaisis();
    var cible = String(nom == null ? '' : nom);
    var norm = function (x) {
        return String(x == null ? '' : x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    };
    var n = norm(cible);
    var i;
    for (i = 0; i < liste.length; i++) {
        if (norm(liste[i].name) === n) return liste[i];
    }
    for (i = 0; i < liste.length; i++) {
        var nomSujet = norm(liste[i].name);
        var motsSujet = nomSujet.split(' ');
        var motsDevoir = n.split(' ');
        if (nomSujet && motsSujet[0] && motsDevoir[0] && motsSujet[0] === motsDevoir[0]) return liste[i];
    }
    if (typeof devoirsFamillesEleve === 'function' && typeof devoirsMatieresLigneToutes === 'function') {
        var familles = devoirsFamillesEleve();
        var trouvees = devoirsMatieresLigneToutes(n, familles);
        for (i = 0; i < trouvees.length; i++) {
            for (var k = 0; k < liste.length; k++) {
                if (norm(liste[k].name) === norm(trouvees[i])) return liste[k];
            }
        }
    }
    return null;
}

/* Les matières des devoirs proches, la plus urgente d'abord : ce sont
   elles que le planning révise en premier — le temps de révision
   coïncide avec ce qui sera vraiment composé. */
function planningSujetsDesDevoirs() {
    var liste = [];
    if (typeof devoirsLireStore !== 'function') return liste;
    var store;
    try { store = devoirsLireStore(); } catch (e) { return liste; }
    var maintenant = new Date();
    var debut = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()).getTime();
    var fin = debut + 7 * 86400000;
    var proches = (store.devoirs || []).filter(function (d) {
        if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(String(d.date || ''))) return false;
        var t = new Date(String(d.date) + 'T00:00:00').getTime();
        return t >= debut && t <= fin;
    }).sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; });
    var vus = {};
    proches.forEach(function (d) {
        var s = planningSujetDuDevoir(d.matiere);
        if (!s || vus[s.name]) return;
        vus[s.name] = 1;
        liste.push(s);
    });
    return liste;
}

function emploiScolaireProgramme(dayIndex) {
    var actif = typeof emploiScolaireActif === 'function' && emploiScolaireActif() && typeof emploiScolaireSujets === 'function';
    var jour = Number(dayIndex);
    var vues = actif ? emploiScolaireSujets((jour >= 0 && jour <= 4) ? jour : null) : [];
    /* les devoirs à venir passent devant les matières vues en classe :
       le soir, on révise ce qui sera composé, même si le cours de la
       matière n'était pas aujourd'hui */
    var devoirs = typeof planningSujetsDesDevoirs === 'function' ? planningSujetsDesDevoirs() : [];
    if (!vues.length && !devoirs.length) return null;
    var tout = planningSujetsSaisis();
    var vus = {};
    var out = [];
    devoirs.concat(vues).concat(tout).forEach(function (s) {
        if (!s || !s.name || vus[s.name]) return;
        vus[s.name] = 1;
        out.push(s);
    });
    return out;
}

function planningBlocManquant(id, title, subtitle, dur, type, icon) {
    return { id: id, title: title, subtitle: subtitle || '', duree: dur, type: type, icon: icon || '📌' };
}

function planningManquesDuJour(events, dayIndex) {
    var titres = (events || []).map(function (ev) { return String(ev && ev.title || ''); }).join(' | ');
    var ids = {};
    (events || []).forEach(function (ev) { if (ev && ev.id) ids[ev.id] = true; });
    var manques = [];
    var sujets = (typeof emploiScolaireProgramme === 'function' && emploiScolaireProgramme(dayIndex)) || planningSujetsSaisis();
    if (sujets.length && !/Révisions|Exercices/.test(titres)) {
        var subj = sujets[dayIndex % sujets.length];
        manques.push(planningBlocManquant('study-page', 'Révisions ' + subj.name, typeof sousTitreMatiere === 'function' ? sousTitreMatiere(subj) : (subj.level || ''), dureeEtude(subj, 45, 30), typeof couleurMatiere === 'function' ? couleurMatiere(subj) : 'study', subj.icon || '📚'));
    }
    var textes = (events || []).map(function (ev) {
        return String(ev && ev.title || '') + ' ' + String(ev && ev.subtitle || '');
    }).join(' | ');
    var memoirSaisi = typeof eeMemoirActif === 'function'
        ? eeMemoirActif()
        : ((typeof memoirLevel === 'string' && memoirLevel && memoirLevel !== 'final') || (typeof memoirPlan !== 'undefined' && Array.isArray(memoirPlan) && memoirPlan.some(function (p) { return p && !p.done; })));
    if (memoirSaisi && dayIndex === 6 && !ids['memoir-page'] && textes.indexOf('Mémoire') === -1) {
        manques.push(planningBlocManquant('memoir-page', 'Mémoire', typeof memoirLevelLabel === 'function' ? memoirLevelLabel() : '', 40, 'memoir', '📖'));
    }
    var sujetIa = typeof eeIaDuJour === 'function' ? eeIaDuJour(dayIndex) : null;
    if (sujetIa && textes.indexOf('Évaluation interne · ' + sujetIa.name) === -1) {
        manques.push(planningBlocManquant('ia-page-' + sujetIa.name, 'Évaluation interne · ' + sujetIa.name, typeof iaLevelLabel === 'function' ? iaLevelLabel(sujetIa.name) : '', 40, 'ia', sujetIa.icon || '📋'));
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
            if (!ev || ev.id === 'wakeup' || ev.id === 'sleep' || ev.kind === 'fixed' || ev.type === 'school' || ev.type === 'activity' || ev.habitudeFixe) return;
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
        if (planningChoixUtilisateur(ev)) return 0;
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
            if (!autre || rang(ev) === 0 || planningChoixUtilisateur(ev)) break;
            var finAutre = planningMinutes(autre.endTime);
            if (finAutre <= planningMinutes(autre.startTime)) finAutre += 1440;
            var dur = Math.max(10, planningDuree(ev));
            var debut = finAutre % 1440;
            ev.startTime = v3M2T(debut);
            ev.endTime = v3M2T((debut + dur) % 1440);
            ev.shifted = true;
        }
        if (planningChoixUtilisateur(ev) || !gardes.some(function (autre) { return chevauche(ev, autre); })) gardes.push(ev);
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
    /* Avec un emploi du temps chargé, les blocs de comblement suivent
       aussi le programme des matières vues (jour en semaine, semaine le
       week-end), dans cet ordre — sans rotation qui les re-mélange. */
    var programmeEmploi = typeof emploiScolaireProgramme === 'function' ? emploiScolaireProgramme(dayIndex) : null;
    if (programmeEmploi && programmeEmploi.length) {
        all.push.apply(all, programmeEmploi);
    } else {
        if (typeof subjects !== 'undefined' && subjects) all.push.apply(all, subjects);
        if (typeof optionalSubjects !== 'undefined' && optionalSubjects) all.push.apply(all, optionalSubjects);
    }
    const turn = seq || { n: 0, memoir: 0, ia: 0, rev: 0 };
    const weekend = dayIndex === 5 || dayIndex === 6;
    const blocks = [];
    let cursor = start;
    function clock(mins) {
        return addMinutes('00:00', ((mins % 1440) + 1440) % 1440);
    }
    function sujetRevision() {
        if (!all.length) return null;
        if (programmeEmploi && programmeEmploi.length) return all[turn.rev % all.length];
        if (typeof sujetDuJour === 'function') return sujetDuJour(all, dayIndex + turn.rev);
        return all[(dayIndex + turn.rev) % all.length];
    }
    while (end - cursor >= 15) {
        const cap = weekend ? 90 : 75;
        let dur = Math.min(cap, end - cursor);
        const remain = end - (cursor + dur);
        if (remain > 0 && remain < 20) dur += remain;
        var iaSujet = turn.ia < 1 && dur >= 40 && typeof eeIaDuJour === 'function' ? eeIaDuJour(dayIndex) : null;
        if (iaSujet && !planningTravailFinalise({ type: 'ia', title: 'Évaluation interne · ' + iaSujet.name })) {
            var durIa = 40;
            if (dur - durIa > 0 && dur - durIa < 15) durIa = dur;
            var tacheIa = typeof eeTacheEgale === 'function' ? eeTacheEgale('ia', iaSujet.name, turn) : null;
            turn.ia++;
            if (tacheIa) blocks.push(eeBlocTache(tacheIa, cursor, durIa, clock));
            else blocks.push({
                id: 'ia-' + cursor,
                title: 'Évaluation interne · ' + iaSujet.name,
                subtitle: typeof iaLevelLabel === 'function' ? iaLevelLabel(iaSujet.name) : '',
                startTime: clock(cursor),
                endTime: clock(cursor + durIa),
                type: 'ia',
                icon: iaSujet.icon || '📋',
                editable: true,
                kind: 'flex'
            });
            cursor += durIa;
            turn.n++;
            continue;
        }
        var memoirOk = turn.memoir < 1 && dur >= 40 && dayIndex === 6 && typeof eeMemoirActif === 'function' && eeMemoirActif();
        if (memoirOk) {
            var durM = 40;
            if (dur - durM > 0 && dur - durM < 15) durM = dur;
            var tacheM = typeof eeTacheEgale === 'function' ? eeTacheEgale('memoir', '', turn) : null;
            turn.memoir++;
            if (tacheM) blocks.push(eeBlocTache(tacheM, cursor, durM, clock));
            else blocks.push({
                id: 'memoir-' + cursor,
                title: 'Mémoire',
                subtitle: typeof memoirLevelLabel === 'function' ? memoirLevelLabel() : '',
                startTime: clock(cursor),
                endTime: clock(cursor + durM),
                type: 'memoir',
                icon: '📖',
                editable: true,
                kind: 'flex'
            });
            cursor += durM;
            turn.n++;
            continue;
        }
        var subj = sujetRevision();
        turn.rev++;
        derniereCle = planningCleActivite({ title: subj ? ('Révisions ' + subj.name) : 'Révisions' });
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
            if (cur.habitudeFixe || prev.habitudeFixe) continue;
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
