/* ============================================================
   PAGE Jours fériés
   Un jour férié est une DATE — « mardi 20 octobre » — et non un
   jour de semaine. Posé pour cette semaine ou pour la suivante,
   il ne vaut que ce jour-là : la semaine d'après, le même jour
   redevient normal tout seul, avec les cours et les activités de
   l'élève. Les dates passées quittent la liste d'elles-mêmes.
   Garder le planning, retirer des activités du jour,
   ou laisser le jour entièrement libre.
   Vue : pages/feries.html
   ============================================================ */

let holidayDates = {};        /* 'YYYY-MM-DD' -> 'keep' | 'light' | 'free' */
let holidayDroppedDates = {}; /* 'YYYY-MM-DD' -> [ids des activités retirées] */

const HOLIDAY_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const HOLIDAY_JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const HOLIDAY_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function holidayCleDate(date) {
    return date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
}

/* La date réelle d'un jour affiché : la semaine qui contient
   aujourd'hui (décalage 0) ou la suivante (décalage 1). Le planning
   affiche toujours la semaine courante. */
function holidayDateDuJour(dayIndex, decalageSemaine) {
    const today = new Date();
    const idx = typeof indexJourCourant === 'function' ? indexJourCourant(today) : ((today.getDay() + 6) % 7);
    const lundi = new Date(today.getFullYear(), today.getMonth(), today.getDate() - idx + 7 * (Number(decalageSemaine) || 0));
    return new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + Number(dayIndex));
}

/* Le lundi de la semaine affichée : il entre dans la signature de
   l'emploi figé — chaque nouvelle semaine, le planning se reconstruit
   et les fériés passés ne s'affichent plus. */
function holidaySemaineCourante() {
    return holidayCleDate(holidayDateDuJour(0, 0));
}

/* Les fériés passés ne servent plus à rien : la liste reste courte. */
function holidayPurger() {
    const aujourdhui = holidayCleDate(new Date());
    Object.keys(holidayDates).forEach(function (cle) {
        if (cle < aujourdhui) {
            delete holidayDates[cle];
            delete holidayDroppedDates[cle];
        }
    });
    Object.keys(holidayDroppedDates).forEach(function (cle) {
        if (!Object.prototype.hasOwnProperty.call(holidayDates, cle)) delete holidayDroppedDates[cle];
    });
}

function holidayEstFerie(cle) {
    return Object.prototype.hasOwnProperty.call(holidayDates, String(cle));
}

function holidayPoserDate(cle, mode) {
    holidayDates[String(cle)] = mode || 'keep';
}

function holidayRetirerDate(cle) {
    delete holidayDates[String(cle)];
    delete holidayDroppedDates[String(cle)];
}

function holidayToutEffacer() {
    holidayDates = {};
    holidayDroppedDates = {};
}

/* L'interface du moteur de planning : le jour affiché appartient
   toujours à la semaine qui contient aujourd'hui. */
function isHoliday(dayIndex) {
    return holidayEstFerie(holidayCleDate(holidayDateDuJour(dayIndex, 0)));
}

function holidayMode(dayIndex) {
    const cle = holidayCleDate(holidayDateDuJour(dayIndex, 0));
    if (!holidayEstFerie(cle)) return null;
    return holidayDates[cle] || null;
}

function holidayDroppedIds(dayIndex) {
    const cle = holidayCleDate(holidayDateDuJour(dayIndex, 0));
    const list = holidayDroppedDates[cle] || [];
    return Array.isArray(list) ? list : [];
}

function holidayFormaterDate(cle) {
    try {
        const d = new Date(String(cle) + 'T12:00:00');
        return HOLIDAY_JOURS[(d.getDay() + 6) % 7] + ' ' + d.getDate() + ' ' + HOLIDAY_MOIS[d.getMonth()];
    } catch (e) {
        return String(cle);
    }
}

function holidayApresChangement() {
    renderHolidays();
    var planning = document.getElementById('planningModal');
    if (planning && planning.classList.contains('active') && typeof renderPlanning === 'function') {
        try { renderPlanning(); } catch (e) {}
    }
}

function goToHolidays() {
    var planning = document.getElementById('planningModal');
    if (planning && !planning.classList.contains('active') && typeof generatePlanning === 'function') generatePlanning();
    if (typeof navigateTo === 'function') navigateTo('feries');
    else renderHolidays();
}

function goBackFromHolidays() {
    if (typeof navigateTo === 'function') navigateTo('planning');
}

/* Poser ou retirer un férié pour une date précise. */
function holidayBasculerDate(cle) {
    cle = String(cle);
    if (holidayEstFerie(cle)) holidayRetirerDate(cle);
    else holidayPoserDate(cle, null);
    holidayApresChangement();
}

function holidayPoserMode(cle, mode) {
    holidayDates[String(cle)] = mode;
    holidayApresChangement();
}

function holidayDecocher(cle, id) {
    cle = String(cle);
    const list = (Array.isArray(holidayDroppedDates[cle]) ? holidayDroppedDates[cle] : []).slice();
    const at = list.indexOf(id);
    if (at === -1) list.push(id);
    else list.splice(at, 1);
    holidayDroppedDates[cle] = list;
    holidayApresChangement();
}

function holidayEscape(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function holidayJs(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function renderHolidays() {
    const grid = document.getElementById('holidayDaysGrid');
    if (!grid) return;
    holidayPurger();
    const aujourdhui = holidayCleDate(new Date());

    /* Les deux grilles : cette semaine, puis la suivante. Les jours
       passés ne se posent plus : un férié sert à préparer, pas à
       rattraper. */
    const sections = [0, 1].map(function (decalage) {
        const titre = decalage === 0 ? 'Cette semaine' : 'Semaine suivante';
        const pastilles = HOLIDAY_COURTS.map(function (nom, i) {
            const date = holidayDateDuJour(i, decalage);
            const cle = holidayCleDate(date);
            const on = holidayEstFerie(cle);
            const passe = cle < aujourdhui;
            const style = passe
                ? 'width:4.6rem;height:2.75rem;border-radius:1.375rem;border:none;font-weight:700;font-size:0.78rem;background:#f3f4f6;color:#d1d5db;cursor:default;'
                : 'width:4.6rem;height:2.75rem;border-radius:1.375rem;border:none;cursor:pointer;font-weight:700;font-size:0.78rem;background:' + (on ? '#10b981' : '#f3f4f6') + ';color:' + (on ? 'white' : '#4b5563') + ';';
            return '<button type="button"' + (passe ? ' disabled' : ' onclick="holidayBasculerDate(\'' + cle + '\')"') + ' style="' + style + '" title="' + holidayEscape(holidayFormaterDate(cle)) + '">' + nom + ' ' + date.getDate() + '/' + ('0' + (date.getMonth() + 1)).slice(-2) + '</button>';
        }).join('');
        return '<p style="font-size:0.78rem;font-weight:700;color:#56665e;margin:0.75rem 0 0.45rem;text-align:center;">' + titre + '</p><div style="display:flex;justify-content:center;gap:0.45rem;flex-wrap:wrap;">' + pastilles + '</div>';
    }).join('');

    const feries = Object.keys(holidayDates).sort();
    const box = document.getElementById('holidayCartes');

    if (!feries.length) {
        grid.innerHTML = sections;
        if (box) box.innerHTML = '<p style="margin:0;text-align:center;color:#6b7280;font-size:0.9rem;">Aucun jour férié pour cette semaine ni la suivante.</p>';
        return;
    }

    const missing = feries.some(function (cle) { return !holidayDates[cle]; });
    const choices = [
        ['keep', '📅', 'Garder mon emploi du temps', 'Cours, révisions et activités restent comme prévus.'],
        ['light', '🌿', 'Diminuer les activités', 'Tu vois les activités prévues ce jour. Décoche celles que tu ne veux pas.'],
        ['free', '🎮', 'Temps libre toute la journée', 'Rien ne sera prévu dans votre emploi du temps.']
    ];
    if (box) {
        box.innerHTML = (missing ? '<p style="text-align:center;color:#6b7280;font-size:0.85rem;margin-bottom:0.8rem;">Choisis une option pour chaque jour férié.</p>' : '') + feries.map(function (cle) {
            const current = holidayDates[cle];
            const cards = choices.map(function (choice) {
                const selected = current === choice[0];
                return '<button type="button" onclick="holidayPoserMode(\'' + cle + '\', \'' + choice[0] + '\')" style="width: 100%; text-align: left; padding: 0.8rem 0.9rem; border-radius: 0.9rem; cursor: pointer; border: 2px solid ' + (selected ? '#10b981' : '#e5e7eb') + '; background: ' + (selected ? '#ecfdf5' : 'white') + ';"><div style="font-weight: 700; color: #111827; font-size: 0.9rem;">' + choice[1] + ' ' + choice[2] + '</div><div style="font-size: 0.78rem; color: #6b7280; margin-top: 0.2rem; line-height: 1.4;">' + choice[3] + '</div></button>';
            }).join('');
            return '<div style="margin-bottom: 1.25rem;"><p style="font-weight: 800; color: #064e3b; margin-bottom: 0.5rem;">Que faire le ' + holidayFormaterDate(cle) + ' ?</p><div style="display: flex; flex-direction: column; gap: 0.5rem;">' + cards + '</div>' + (current === 'light' ? holidayDropList(cle) : '') + '</div>';
        }).join('');
    }
    grid.innerHTML = sections;
}

/* La liste des activités du jour (mode « light ») : celles du jour de
   semaine correspondant — la semaine suivante suit le même modèle. */
function holidayDropList(cle) {
    let events = [];
    let dayIndex = 0;
    try {
        const d = new Date(String(cle) + 'T12:00:00');
        dayIndex = (d.getDay() + 6) % 7;
    } catch (e) {}
    try {
        events = (typeof normalDayEvents === 'function' ? normalDayEvents(dayIndex) : []).filter(function (ev) {
            return ev && ev.id !== 'wakeup' && ev.id !== 'sleep' && !ev.hidden;
        });
    } catch (e) {
        events = [];
    }
    if (!events.length) {
        return '<p style="margin-top:0.75rem;color:#6b7280;font-size:0.85rem;">Aucune activité prévue ce jour-là.</p>';
    }
    const dropped = Array.isArray(holidayDroppedDates[String(cle)]) ? holidayDroppedDates[String(cle)] : [];
    const rows = events.map(function (ev) {
        const off = dropped.indexOf(ev.id) !== -1;
        return '<label style="display:flex;align-items:center;gap:0.65rem;padding:0.6rem 0.75rem;border:1px solid ' + (off ? '#fecaca' : '#e5e7eb') + ';border-radius:0.75rem;background:' + (off ? '#fef2f2' : 'white') + ';cursor:pointer;">'
            + '<input type="checkbox"' + (off ? '' : ' checked') + ' onchange="holidayDecocher(\'' + holidayJs(cle) + '\', \'' + holidayJs(ev.id) + '\')" style="width:1.05rem;height:1.05rem;">'
            + '<span style="font-size:1rem;">' + holidayEscape(ev.icon || '•') + '</span>'
            + '<span style="flex:1;font-size:0.85rem;font-weight:600;color:#111827;">' + holidayEscape(ev.title) + '</span>'
            + '<span style="font-size:0.75rem;color:#6b7280;white-space:nowrap;">' + holidayEscape(ev.startTime) + ' → ' + holidayEscape(ev.endTime) + '</span>'
            + '</label>';
    }).join('');
    return '<div style="margin-top:0.75rem;"><p style="font-size:0.82rem;font-weight:700;color:#374151;margin-bottom:0.45rem;">Activités prévues le ' + holidayFormaterDate(cle) + '. Décoche celles que tu retires.</p><div style="display:flex;flex-direction:column;gap:0.4rem;">' + rows + '</div></div>';
}
