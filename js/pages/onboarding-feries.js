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

/* Le moteur lit une date explicite seulement pendant le rendu d'une
   semaine voisine. L'écran Jours fériés et la Séance restent ancrés au jour réel. */
function holidayDatePlanning(dayIndex, date) {
    var vue = date || window.__planningDateApercue;
    if (vue instanceof Date && !isNaN(vue.getTime()) &&
        (vue.getDay() + 6) % 7 === Number(dayIndex)) return vue;
    return holidayDateDuJour(dayIndex, 0);
}

function isHoliday(dayIndex, date) {
    return holidayEstFerie(holidayCleDate(holidayDatePlanning(dayIndex, date)));
}

function holidayMode(dayIndex, date) {
    const cle = holidayCleDate(holidayDatePlanning(dayIndex, date));
    if (!holidayEstFerie(cle)) return null;
    return holidayDates[cle] || null;
}

function holidayDroppedIds(dayIndex, date) {
    const cle = holidayCleDate(holidayDatePlanning(dayIndex, date));
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

function holidayRetablirFocus(repere) {
    if (!repere || !repere.date) return;
    var elements = Array.from(document.querySelectorAll('#panelFeries [data-holiday-date]'));
    var cible = elements.find(function (el) {
        return el.dataset.holidayDate === repere.date && el.dataset.holidayMode === repere.mode && el.dataset.holidayActivity === repere.activity;
    });
    if (cible) cible.focus({preventScroll:true});
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
    const actif = document.activeElement;
    const repere = actif && actif.dataset ? {date: actif.dataset.holidayDate, mode: actif.dataset.holidayMode, activity: actif.dataset.holidayActivity} : null;
    holidayPurger();
    const aujourdhui = holidayCleDate(new Date());

    /* Les deux grilles : cette semaine, puis la suivante. Les jours
       passés ne se posent plus : un férié sert à préparer, pas à
       rattraper. */
    const sections = [0, 1].map(function (decalage) {
        const titre = decalage === 0 ? 'Cette semaine' : 'Semaine suivante';
        const debut = holidayDateDuJour(0, decalage);
        const fin = holidayDateDuJour(6, decalage);
        const periode = debut.getDate() + ' ' + HOLIDAY_MOIS[debut.getMonth()] + ' — ' + fin.getDate() + ' ' + HOLIDAY_MOIS[fin.getMonth()];
        const pastilles = HOLIDAY_COURTS.map(function (nom, i) {
            const date = holidayDateDuJour(i, decalage);
            const cle = holidayCleDate(date);
            const on = holidayEstFerie(cle);
            const passe = cle < aujourdhui;
            return '<button type="button" class="holiday-day" data-holiday-date="' + cle + '" aria-label="' + holidayEscape(holidayFormaterDate(cle)) + '" aria-pressed="' + String(on) + '"' + (passe ? ' disabled' : ' onclick="holidayBasculerDate(\'' + cle + '\')"') + ' title="' + holidayEscape(holidayFormaterDate(cle)) + '"><span>' + nom + '</span><strong>' + date.getDate() + '/' + ('0' + (date.getMonth() + 1)).slice(-2) + '</strong></button>';
        }).join('');
        return '<section class="holiday-week" aria-label="' + titre + '"><div class="holiday-week-head"><h4>' + titre + '</h4><span>' + periode + '</span></div><div class="holiday-days">' + pastilles + '</div></section>';
    }).join('');

    const feries = Object.keys(holidayDates).sort();
    const box = document.getElementById('holidayCartes');

    if (!feries.length) {
        grid.innerHTML = sections;
        if (box) box.innerHTML = '<div class="holiday-empty"><span class="holiday-empty-icon" aria-hidden="true">✧</span><div><strong>Un espace pour tes journées spéciales</strong><p>Aucun jour férié pour cette semaine ni la suivante. Sélectionne une date ci-dessus pour commencer.</p></div></div>';
        holidayRetablirFocus(repere);
        return;
    }

    const choices = [
        ['keep', '📅', 'Garder mon emploi du temps', 'Cours, révisions et activités restent comme prévus.'],
        ['light', '🌿', 'Diminuer les activités', 'Choisis les activités que tu souhaites retirer.'],
        ['free', '🎮', 'Temps libre toute la journée', 'Rien ne sera prévu dans ton emploi du temps.']
    ];
    if (box) {
        box.innerHTML = feries.map(function (cle) {
            const current = holidayDates[cle];
            const cards = choices.map(function (choice) {
                const selected = current === choice[0];
                return '<button type="button" class="holiday-choice" data-holiday-date="' + cle + '" data-holiday-mode="' + choice[0] + '" aria-pressed="' + String(selected) + '" onclick="holidayPoserMode(\'' + cle + '\', \'' + choice[0] + '\')"><span class="holiday-choice-icon" aria-hidden="true">' + choice[1] + '</span><strong>' + choice[2] + '</strong><small>' + choice[3] + '</small>' + (selected ? '<span class="holiday-choice-state">✓ Choisi</span>' : '') + '</button>';
            }).join('');
            const jour = new Date(cle + 'T12:00:00').getDate();
            return '<section class="holiday-date-card"><div class="holiday-date-title"><div class="holiday-date-badge" aria-hidden="true">' + jour + '</div><div><span>TA JOURNÉE FÉRIÉE</span><h3>' + holidayEscape(holidayFormaterDate(cle)) + '</h3></div></div><div class="holiday-choices" role="group" aria-label="Organisation du ' + holidayEscape(holidayFormaterDate(cle)) + '">' + cards + '</div>' + (current === 'light' ? holidayDropList(cle) : '') + '</section>';
        }).join('');
    }

    grid.innerHTML = sections;
    holidayRetablirFocus(repere);
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
        return '<div class="holiday-activity-list"><p>Aucune activité prévue ce jour-là.</p></div>';
    }
    const dropped = Array.isArray(holidayDroppedDates[String(cle)]) ? holidayDroppedDates[String(cle)] : [];
    const rows = events.map(function (ev) {
        const off = dropped.indexOf(ev.id) !== -1;
        return '<label class="holiday-activity' + (off ? ' is-off' : '') + '">'
            + '<input type="checkbox" data-holiday-date="' + holidayEscape(cle) + '" data-holiday-activity="' + holidayEscape(ev.id) + '"' + (off ? '' : ' checked') + ' onchange="holidayDecocher(\'' + holidayEscape(holidayJs(cle)) + '\', \'' + holidayEscape(holidayJs(ev.id)) + '\')">'
            + '<span aria-hidden="true">' + holidayEscape(ev.icon || '•') + '</span>'
            + '<span class="holiday-activity-name">' + holidayEscape(ev.title) + '</span>'
            + '<span class="holiday-activity-time">' + holidayEscape(ev.startTime) + ' → ' + holidayEscape(ev.endTime) + '</span>'
            + '</label>';
    }).join('');
    return '<div class="holiday-activity-list"><p>Activités prévues le ' + holidayEscape(holidayFormaterDate(cle)) + '. Décoche celles que tu retires.</p><div class="holiday-activity-rows">' + rows + '</div></div>';
}
