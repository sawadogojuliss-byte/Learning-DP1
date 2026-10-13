/* ============================================================
   PAGE Activités
   Activités extrascolaires et horaires.
   Vue : pages/onboarding-activites.html
   ============================================================ */

// ========== PAGE 7: ACTIVITÉS ==========
let selectedActivities = [];
const availableActivitiesList = [
    { name: 'Église', icon: '⛪' },
    { name: 'Mosquée', icon: '🕌' },
    { name: 'Basketball', icon: '🏀' },
    { name: 'Football', icon: '⚽' },
    { name: 'Natation', icon: '🏊' },
    { name: 'Danse', icon: '💃' },
    { name: 'Arts', icon: '🎨' },
    { name: 'Yoga', icon: '🧘' },
    { name: 'Gym', icon: '🏋️' },
    { name: 'Bénévolat', icon: '🤝' },
    { name: 'Cours particuliers', icon: '📚' }
];

var ACTIVITE_COURS_DEBUT = 8 * 60;
var ACTIVITE_COURS_FIN = 16 * 60 + 35;

function creneauPendantCours(start, end, dayIndex) {
    if (dayIndex == null || Number(dayIndex) >= 5) return false;
    if (typeof timeToMinutes !== 'function') return false;
    var s = timeToMinutes(start);
    var e = timeToMinutes(end);
    if (!(e > s)) return false;
    return s < ACTIVITE_COURS_FIN && ACTIVITE_COURS_DEBUT < e;
}

function isSchoolHours(time, dayIndex) {
    if (dayIndex >= 5) return false;
    const [hours, minutes] = time.split(':').map(Number);
    const timeInMinutes = hours * 60 + minutes;
    return timeInMinutes >= ACTIVITE_COURS_DEBUT && timeInMinutes < ACTIVITE_COURS_FIN;
}

function showSchoolWarning() {
    const warning = document.getElementById('schoolWarning');
    if (!warning) return;
    warning.style.display = 'block';
    clearTimeout(warning._timer);
    warning._timer = setTimeout(function () { warning.style.display = 'none'; }, 4000);
}

function creneauActivite(act, dayIndex) {
    if (!act) return null;
    if (act.sameTime) return { start: act.startTime, end: act.endTime };
    const dt = act.dayTimes && (act.dayTimes[dayIndex] || act.dayTimes[String(dayIndex)]);
    return { start: (dt && dt.start) || act.startTime || '17:00', end: (dt && dt.end) || act.endTime || '19:00' };
}

function activitesQuiChevauchent(start, end, dayIndex, exceptName) {
    if (typeof timeToMinutes !== 'function') return [];
    var s = timeToMinutes(start);
    var e = timeToMinutes(end);
    if (!(e > s)) return [];
    var out = [];
    (selectedActivities || []).forEach(function (act) {
        if (!act || act.name === exceptName || !act.days || act.days.indexOf(dayIndex) === -1) return;
        var slot = creneauActivite(act, dayIndex);
        if (!slot || !slot.start || !slot.end) return;
        var os = timeToMinutes(slot.start);
        var oe = timeToMinutes(slot.end);
        if (s < oe && os < e) out.push({ name: act.name, icon: act.icon || '🎯', start: slot.start, end: slot.end, day: dayIndex });
    });
    return out;
}

function poserCreneauActivite(activity, dayIndex, start, end) {
    if (!activity || !start || !end) return;
    if (!activity.dayTimes) activity.dayTimes = {};
    if (activity.days.indexOf(dayIndex) === -1) activity.days.push(dayIndex);
    activity.sameTime = false;
    activity.days.forEach(function (jour) {
        if (!activity.dayTimes[jour]) activity.dayTimes[jour] = { start: activity.startTime || '17:00', end: activity.endTime || '19:00' };
    });
    activity.dayTimes[dayIndex] = { start: start, end: end };
    activity.startTime = start;
    activity.endTime = end;
    renderActivities();
}

function propositionsCreneauActivite(dayIndex, duree, exceptName) {
    if (!(duree > 0) || typeof timeToMinutes !== 'function') return [];
    var debut = 5 * 60;
    var fin = 23 * 60;
    if (typeof bedtimeForDay === 'function' && typeof weekdayWakeup !== 'undefined') {
        var reveil = dayIndex === 5 ? saturdayWakeup : dayIndex === 6 ? sundayWakeup : weekdayWakeup;
        debut = timeToMinutes(reveil || '06:00');
        fin = timeToMinutes(bedtimeForDay(dayIndex) || '22:00');
        if (fin <= debut) fin += 1440;
    }
    var occupe = [];
    if (dayIndex < 5) occupe.push([8 * 60, 16 * 60 + 35]);
    (selectedActivities || []).forEach(function (act) {
        if (!act || act.name === exceptName || !act.days || act.days.indexOf(dayIndex) === -1) return;
        var slot = creneauActivite(act, dayIndex);
        if (!slot) return;
        var os = timeToMinutes(slot.start);
        var oe = timeToMinutes(slot.end);
        if (oe > os) occupe.push([os, oe]);
    });
    occupe.sort(function (a, b) { return a[0] - b[0]; });
    var propositions = [];
    var curseur = debut;
    function horloge(mins) {
        var total = ((Math.round(mins) % 1440) + 1440) % 1440;
        return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
    }
    occupe.forEach(function (plage) {
        if (propositions.length >= 4) return;
        if (plage[0] - curseur >= duree) propositions.push({ start: horloge(curseur), end: horloge(curseur + duree) });
        if (plage[1] > curseur) curseur = plage[1];
    });
    if (propositions.length < 4 && fin - curseur >= duree) propositions.push({ start: horloge(curseur), end: horloge(curseur + duree) });
    return propositions;
}

function fermerChoixChevauchementActivite() {
    var el = document.getElementById('activiteChevauchement');
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

function echapperActivite(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ouvrirChoixChevauchementActivite(ctx) {
    if (!ctx || !ctx.conflits || !ctx.conflits.length || typeof document === 'undefined') return;
    fermerChoixChevauchementActivite();
    window.__activiteChevauchement = ctx;
    var premier = ctx.conflits[0];
    var noms = ctx.conflits.map(function (item) {
        return '« ' + item.name + ' » (' + item.start + ' → ' + item.end + ')';
    }).join(', ');
    var liste = ctx.conflits.map(function (item) {
        return '<p style="margin:0.35rem 0;font-weight:700;color:#111827;">' + echapperActivite(item.icon || '🎯') + ' ' + echapperActivite(item.name) + ' <span style="font-weight:600;color:#6b7280;">' + echapperActivite(item.start) + ' → ' + echapperActivite(item.end) + '</span></p>';
    }).join('');
    var el = document.createElement('div');
    el.id = 'activiteChevauchement';
    el.style.cssText = 'position:fixed;inset:0;z-index:400;background:rgba(17,24,39,0.55);display:flex;align-items:flex-end;justify-content:center;padding:0.75rem;';
    el.innerHTML = '<div style="background:white;border-radius:1.25rem;max-width:32rem;width:100%;padding:1.1rem;max-height:calc(100dvh - 1.5rem);overflow-y:auto;box-shadow:0 25px 50px rgba(0,0,0,0.25);">'
        + '<h3 style="font-size:1.05rem;font-weight:800;color:#111827;margin:0 0 0.45rem;">Ces activités se chevauchent</h3>'
        + '<p style="font-size:0.86rem;color:#374151;line-height:1.45;margin:0 0 0.7rem;">« ' + echapperActivite(ctx.name) + ' » (' + echapperActivite(ctx.start) + ' → ' + echapperActivite(ctx.end) + ') tombe en même temps que ' + echapperActivite(noms) + '. Choisis un autre créneau, ou remplace l\'activité qui se chevauche.</p>'
        + liste
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:0.85rem;">'
        + '<button type="button" data-autre style="padding:0.75rem 0.55rem;border:none;border-radius:0.85rem;background:linear-gradient(to right,#10b981,#14b8a6);color:white;font-weight:800;cursor:pointer;">Choisir un autre créneau</button>'
        + '<button type="button" data-remplacer style="padding:0.75rem 0.55rem;border:none;border-radius:0.85rem;background:#d97706;color:white;font-weight:800;cursor:pointer;">Remplacer l\'activité</button>'
        + '</div>'
        + '<div data-choix hidden style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:0.85rem;padding:0.75rem;margin-top:0.65rem;">'
        + '<p style="font-size:0.78rem;color:#047857;font-weight:700;margin:0 0 0.45rem;">Propositions sans chevauchement</p>'
        + '<div data-propositions style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.7rem;"></div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'
        + '<label style="font-size:0.75rem;color:#6b7280;">Début<input data-debut type="time" value="' + echapperActivite(ctx.start) + '" style="width:100%;margin-top:0.2rem;padding:0.5rem;border:2px solid #e5e7eb;border-radius:0.7rem;font-weight:700;"></label>'
        + '<label style="font-size:0.75rem;color:#6b7280;">Fin<input data-fin type="time" value="' + echapperActivite(ctx.end) + '" style="width:100%;margin-top:0.2rem;padding:0.5rem;border:2px solid #e5e7eb;border-radius:0.7rem;font-weight:700;"></label>'
        + '</div>'
        + '<button type="button" data-placer style="width:100%;margin-top:0.55rem;padding:0.65rem;border:none;border-radius:0.75rem;background:#047857;color:white;font-weight:700;cursor:pointer;">Placer à cet horaire</button>'
        + '</div>'
        + '<p data-erreur style="color:#b91c1c;font-size:0.78rem;min-height:1.1rem;margin:0.55rem 0 0;"></p>'
        + '<button type="button" data-annuler style="width:100%;margin-top:0.35rem;padding:0.65rem;border:none;border-radius:0.85rem;background:#f3f4f6;color:#6b7280;font-weight:600;cursor:pointer;">Annuler</button>'
        + '</div>';
    var duree = timeToMinutes(ctx.end) - timeToMinutes(ctx.start);
    var propositions = propositionsCreneauActivite(ctx.day, duree > 0 ? duree : 60, ctx.name);
    var zone = el.querySelector('[data-propositions]');
    if (!propositions.length) zone.innerHTML = '<span style="font-size:0.78rem;color:#6b7280;">Aucun créneau libre de cette durée. Choisis les heures toi-même.</span>';
    propositions.forEach(function (p) {
        var bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.textContent = p.start + ' → ' + p.end;
        bouton.style.cssText = 'padding:0.55rem 0.7rem;border-radius:0.75rem;border:1.5px solid #a7f3d0;background:#f0fdf4;color:#047857;font-weight:700;cursor:pointer;';
        bouton.onclick = function () { appliquerCreneauActivite(p.start, p.end); };
        zone.appendChild(bouton);
    });
    el.querySelector('[data-autre]').onclick = function () { el.querySelector('[data-choix]').hidden = false; };
    el.querySelector('[data-remplacer]').onclick = function () { remplacerActiviteChevauchee(premier); };
    el.querySelector('[data-placer]').onclick = function () {
        appliquerCreneauActivite(el.querySelector('[data-debut]').value, el.querySelector('[data-fin]').value);
    };
    el.querySelector('[data-annuler]').onclick = fermerChoixChevauchementActivite;
    el.addEventListener('click', function (event) { if (event.target === el) fermerChoixChevauchementActivite(); });
    document.body.appendChild(el);
}

function direChevauchementActivite(message) {
    var el = document.getElementById('activiteChevauchement');
    var erreur = el && el.querySelector('[data-erreur]');
    var zone = el && el.querySelector('[data-choix]');
    if (zone) zone.hidden = false;
    if (erreur) erreur.textContent = message;
}

function appliquerCreneauActivite(start, end) {
    var ctx = window.__activiteChevauchement;
    if (!ctx || !start || !end) return;
    if (timeToMinutes(end) <= timeToMinutes(start)) {
        direChevauchementActivite('L\'heure de fin doit être après le début.');
        return;
    }
    if (creneauPendantCours(start, end, ctx.day)) {
        direChevauchementActivite('Ce créneau tombe pendant les cours, de 8 h 00 à 16 h 35.');
        return;
    }
    if (activitesQuiChevauchent(start, end, ctx.day, ctx.name).length) {
        direChevauchementActivite('Ce créneau tombe encore sur une autre activité. Choisis-en un autre.');
        return;
    }
    var activity = (selectedActivities || []).find(function (act) { return act && act.name === ctx.name; });
    fermerChoixChevauchementActivite();
    if (ctx.appliquer) ctx.appliquer(start, end);
    else if (activity) poserCreneauActivite(activity, ctx.day, start, end);
}

function remplacerActiviteChevauchee(conflit) {
    var ctx = window.__activiteChevauchement;
    if (!ctx || !conflit) return;
    var voulue = (selectedActivities || []).find(function (act) { return act && act.name === ctx.name; });
    var autre = (selectedActivities || []).find(function (act) { return act && act.name === conflit.name; });
    if (!voulue || !autre) return;
    var destAutre = { start: ctx.start, end: ctx.end };
    if (creneauPendantCours(conflit.start, conflit.end, ctx.day) || creneauPendantCours(destAutre.start, destAutre.end, ctx.day)) {
        direChevauchementActivite('Cet échange tomberait pendant les cours. Choisis un autre créneau.');
        return;
    }
    var reste = activitesQuiChevauchent(destAutre.start, destAutre.end, ctx.day, autre.name).filter(function (item) {
        return item.name !== voulue.name;
    });
    if (reste.length) {
        direChevauchementActivite('Cet échange tomberait encore sur « ' + reste[0].name + ' ». Choisis un autre créneau.');
        return;
    }
    poserCreneauActivite(autre, ctx.day, destAutre.start, destAutre.end);
    poserCreneauActivite(voulue, ctx.day, conflit.start, conflit.end);
    fermerChoixChevauchementActivite();
}

function messageChevauchementActivite(start, end, dayIndex, exceptName) {
    if (typeof timeToMinutes !== 'function') return '';
    const s = timeToMinutes(start);
    const e = timeToMinutes(end);
    if (!(e > s)) return 'L\'heure de fin doit être après l\'heure de début.';
    const busy = [];
    if (creneauPendantCours(start, end, dayIndex)) {
        return 'cours';
    }
    (selectedActivities || []).forEach(function (act) {
        if (!act || act.name === exceptName || !act.days || act.days.indexOf(dayIndex) === -1) return;
        const slot = creneauActivite(act, dayIndex);
        if (!slot || !slot.start || !slot.end) return;
        const os = timeToMinutes(slot.start);
        const oe = timeToMinutes(slot.end);
        if (s < oe && os < e) busy.push({ name: act.name, start: os, end: oe, label: slot.start + ' → ' + slot.end });
    });
    const hit = busy.find(function (b) { return s < b.end && b.start < e; });
    if (!hit) return '';
    return '⚠️ Ce créneau chevauche « ' + hit.name + ' »' + (hit.label ? ' (' + hit.label + ')' : '') + '.';
}

function toggleActivity(name, icon) {
    const exists = selectedActivities.find(a => a.name === name);
    if (exists) {
        selectedActivities = selectedActivities.filter(a => a.name !== name);
    } else {
        selectedActivities.push({
            name, icon, days: [], sameTime: true,
            startTime: '17:00', endTime: '19:00', dayTimes: {}
        });
    }
    renderActivities();
}

function toggleActivityDay(name, dayIndex) {
    const activity = selectedActivities.find(a => a.name === name);
    if (activity) {
        if (activity.days.includes(dayIndex)) {
            activity.days = activity.days.filter(d => d !== dayIndex);
        } else {
            const slot = creneauActivite(activity, dayIndex) || { start: '17:00', end: '19:00' };
            if (creneauPendantCours(slot.start, slot.end, dayIndex)) { showSchoolWarning(); return; }
            const conflits = activitesQuiChevauchent(slot.start, slot.end, dayIndex, activity.name);
            if (conflits.length) {
                ouvrirChoixChevauchementActivite({
                    name: activity.name,
                    day: dayIndex,
                    start: slot.start,
                    end: slot.end,
                    conflits: conflits,
                    appliquer: function (start, end) { poserCreneauActivite(activity, dayIndex, start, end); }
                });
                return;
            }
            activity.days.push(dayIndex);
            if (!activity.dayTimes[dayIndex]) {
                activity.dayTimes[dayIndex] = { start: slot.start || '17:00', end: slot.end || '19:00' };
            }
        }
        renderActivities();
    }
}

function toggleSameTime(name) {
    const activity = selectedActivities.find(a => a.name === name);
    if (activity) {
        activity.sameTime = !activity.sameTime;
        renderActivities();
    }
}

function updateActivityTime(name, field, value, days) {
    const activity = selectedActivities.find(a => a.name === name);
    if (!activity) return;
    const start = field === 'startTime' ? value : activity.startTime;
    const end = field === 'endTime' ? value : activity.endTime;
    const jours = (days && days.length) ? days : activity.days;
    for (let i = 0; i < jours.length; i++) {
        if (creneauPendantCours(start, end, jours[i])) { showSchoolWarning(); renderActivities(); return; }
        const conflits = activitesQuiChevauchent(start, end, jours[i], activity.name);
        if (conflits.length) {
            ouvrirChoixChevauchementActivite({
                name: activity.name,
                day: jours[i],
                start: start,
                end: end,
                conflits: conflits,
                appliquer: function (debut, fin) { poserCreneauActivite(activity, jours[i], debut, fin); }
            });
            renderActivities();
            return;
        }
    }
    activity[field] = value;
    renderActivities();
}

function updateActivityDayTime(name, dayIndex, field, value) {
    const activity = selectedActivities.find(a => a.name === name);
    if (!activity) return;
    const current = activity.dayTimes[dayIndex] || { start: activity.startTime || '17:00', end: activity.endTime || '19:00' };
    const start = field === 'start' ? value : current.start;
    const end = field === 'end' ? value : current.end;
    if (creneauPendantCours(start, end, dayIndex)) { showSchoolWarning(); renderActivities(); return; }
    const conflits = activitesQuiChevauchent(start, end, dayIndex, activity.name);
    if (conflits.length) {
        ouvrirChoixChevauchementActivite({
            name: activity.name,
            day: dayIndex,
            start: start,
            end: end,
            conflits: conflits,
            appliquer: function (debut, fin) { poserCreneauActivite(activity, dayIndex, debut, fin); }
        });
        renderActivities();
        return;
    }
    if (!activity.dayTimes[dayIndex]) activity.dayTimes[dayIndex] = { start: current.start, end: current.end };
    activity.dayTimes[dayIndex][field] = value;
    renderActivities();
}

function removeActivity(name) {
    selectedActivities = selectedActivities.filter(a => a.name !== name);
    renderActivities();
}

function addCustomActivity() {
    const input = document.getElementById('customActivityInput');
    const name = input.value.trim();
    if (name) {
        selectedActivities.push({
            name, icon: '✨', days: [], sameTime: true,
            startTime: '17:00', endTime: '19:00', dayTimes: {}
        });
        input.value = '';
        renderActivities();
    }
}

function renderActivities() {
    // Render activities grid
    const grid = document.getElementById('activitiesGrid');
    grid.innerHTML = availableActivitiesList.map(act => {
        const isSelected = selectedActivities.find(a => a.name === act.name);
        return '<button onclick="toggleActivity(\'' + act.name + '\', \'' + act.icon + '\')" style="padding: 1rem; border-radius: 1rem; border: 2px solid ' + (isSelected ? '#10b981' : '#e5e7eb') + '; background: ' + (isSelected ? 'linear-gradient(to bottom right, #ecfdf5, #f0fdfa)' : 'white') + '; cursor: pointer; transition: all 0.3s;"><span style="font-size: 1.5rem; display: block; margin-bottom: 0.25rem;">' + act.icon + '</span><span style="font-size: 0.75rem; font-weight: 500; color: #374151;">' + act.name + '</span></button>';
    }).join('');

    // Render selected activities config
    const config = document.getElementById('activitiesConfig');
    if (selectedActivities.length === 0) {
        config.innerHTML = '';
        return;
    }

    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    var chevauchements = [];
    selectedActivities.forEach(function (act) {
        (act.days || []).forEach(function (jour) {
            var slot = creneauActivite(act, jour);
            if (!slot) return;
            activitesQuiChevauchent(slot.start, slot.end, jour, act.name).forEach(function (autre) {
                var cle = [act.name, autre.name, jour].sort().join('|');
                if (chevauchements.some(function (item) { return item.cle === cle; })) return;
                chevauchements.push({ cle: cle, act: act, autre: autre, jour: jour, slot: slot });
            });
        });
    });
    var bandeau = '';
    if (chevauchements.length) {
        var premierChevauchement = chevauchements[0];
        bandeau = '<button type="button" id="resoudreChevauchementActivite" style="width:100%;margin-bottom:1rem;padding:0.85rem 1rem;border:1.5px solid #fdba74;border-radius:0.9rem;background:#fff7ed;color:#9a3412;font-weight:800;cursor:pointer;text-align:left;">Ces activités se chevauchent. Choisis un autre créneau ou remplace l\'activité.</button>';
        setTimeout(function () {
            var bouton = document.getElementById('resoudreChevauchementActivite');
            if (!bouton) return;
            bouton.onclick = function () {
                ouvrirChoixChevauchementActivite({
                    name: premierChevauchement.act.name,
                    day: premierChevauchement.jour,
                    start: premierChevauchement.slot.start,
                    end: premierChevauchement.slot.end,
                    conflits: [premierChevauchement.autre],
                    appliquer: function (debut, fin) { poserCreneauActivite(premierChevauchement.act, premierChevauchement.jour, debut, fin); }
                });
            };
        }, 0);
    }
    config.innerHTML = bandeau + '<h3 style="font-size: 1.125rem; font-weight: 700; color: #1f2937; margin-bottom: 1rem;">Configuration des activités</h3>' +
        selectedActivities.map(act => {
            let timesHtml = '';
            if (act.sameTime) {
                timesHtml = '<div style="display: flex; gap: 1rem; flex-wrap: wrap;"><div><label style="font-size: 0.875rem; color: #6b7280;">Début</label><input type="time" value="' + act.startTime + '" onchange="updateActivityTime(\'' + act.name + '\', \'startTime\', this.value, [' + act.days.join(',') + '])" style="padding: 0.5rem; border: 2px solid #e5e7eb; border-radius: 0.5rem;"></div><div><label style="font-size: 0.875rem; color: #6b7280;">Fin</label><input type="time" value="' + act.endTime + '" onchange="updateActivityTime(\'' + act.name + '\', \'endTime\', this.value, [' + act.days.join(',') + '])" style="padding: 0.5rem; border: 2px solid #e5e7eb; border-radius: 0.5rem;"></div></div>';
            } else {
                const sortedDays = [...act.days].sort((a,b) => a-b);
                if (sortedDays.length === 0) {
                    timesHtml = '<p style="color: #9ca3af; font-style: italic; font-size: 0.875rem;">Sélectionne d\'abord les jours de pratique</p>';
                } else {
                    timesHtml = '<div style="display: flex; flex-direction: column; gap: 0.75rem;">' + sortedDays.map(d => {
                        const dt = act.dayTimes[d] || { start: '17:00', end: '19:00' };
                        return '<div style="display: flex; align-items: center; gap: 0.75rem; background: #f9fafb; padding: 0.75rem; border-radius: 0.75rem;"><span style="width: 3rem; font-weight: 600; color: #047857; font-size: 0.875rem;">' + dayNames[d] + '</span><input type="time" value="' + dt.start + '" onchange="updateActivityDayTime(\'' + act.name + '\', ' + d + ', \'start\', this.value)" style="padding: 0.375rem; border: 2px solid #e5e7eb; border-radius: 0.5rem; font-size: 0.875rem;"><span style="color: #9ca3af;">→</span><input type="time" value="' + dt.end + '" onchange="updateActivityDayTime(\'' + act.name + '\', ' + d + ', \'end\', this.value)" style="padding: 0.375rem; border: 2px solid #e5e7eb; border-radius: 0.5rem; font-size: 0.875rem;"></div>';
                    }).join('') + '</div>';
                }
            }

            return '<div style="background: white; border: 2px solid #d1fae5; border-radius: 1rem; padding: 1.25rem; margin-bottom: 1rem;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;"><div style="display: flex; align-items: center; gap: 0.75rem;"><span style="font-size: 1.5rem;">' + act.icon + '</span><span style="font-weight: 600; color: #1f2937;">' + act.name + '</span></div><button onclick="removeActivity(\'' + act.name + '\')" style="padding: 0.25rem 0.75rem; background: #fee2e2; color: #dc2626; border: none; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem;">✕ Supprimer</button></div><div style="margin-bottom: 1rem;"><label style="font-size: 0.875rem; font-weight: 500; color: #4b5563; display: block; margin-bottom: 0.5rem;">Jours de pratique</label><div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">' + ['L','M','M','J','V','S','D'].map((d, i) => '<button onclick="toggleActivityDay(\'' + act.name + '\', ' + i + ')" style="width: 2.5rem; height: 2.5rem; border-radius: 50%; font-weight: 600; font-size: 0.875rem; border: none; cursor: pointer; background: ' + (act.days.includes(i) ? '#10b981' : '#f3f4f6') + '; color: ' + (act.days.includes(i) ? 'white' : '#4b5563') + ';">' + d + '</button>').join('') + '</div></div><div style="margin-bottom: 1rem;"><label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;"><input type="checkbox" ' + (act.sameTime ? 'checked' : '') + ' onchange="toggleSameTime(\'' + act.name + '\')" style="width: 1.25rem; height: 1.25rem;"><span style="font-size: 0.875rem; color: #4b5563;">Même horaire tous les jours</span></label></div>' + timesHtml + '</div>';
        }).join('');
}

function goToScreenTime() {
    document.getElementById('activitiesModal').classList.remove('active');
    const holidays = document.getElementById('holidaysModal');
    const libre = document.getElementById('freeTimeModal');
    if (holidays) holidays.classList.remove('active');
    if (libre) libre.classList.remove('active');
    document.getElementById('screenTimeModal').classList.add('active');
    renderScreenTime();
}

function goBackFromActivities() {
    document.getElementById('activitiesModal').classList.remove('active');
    if (typeof transportMode !== 'undefined' && transportMode === 'moto') {
        document.getElementById('motoConfigModal').classList.add('active');
    } else {
        document.getElementById('carConfigModal').classList.add('active');
    }
}
