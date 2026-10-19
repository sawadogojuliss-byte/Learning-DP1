#!/usr/bin/env node
/* ============================================================
   Vérificateur — Jours fériés
   Un jour férié est une DATE, pas un jour de semaine : posé pour
   cette semaine ou la suivante, il ne vaut que ce jour-là. La
   semaine d'après, le même jour redevient normal tout seul, avec
   les cours et les activités de l'élève — même si le planning de
   la semaine précédente avait été figé avec le jour vidé.
   1. Statique : le modèle par date partout, plus aucun jour de
      semaine répété chaque semaine, la signature de l'emploi figé
      contient la semaine affichée.
   2. Deux semaines simulées : le férié vide son jour, l'activité
      décochée disparaît, puis la semaine suivante tout revient —
      et l'emploi figé de la veille ne peut pas resservir le jour
      vide, la signature a changé.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const echecs = [];
function ok(cond, message) { if (!cond) echecs.push(message); }
const lire = function (f) { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); };

/* ── 1. Statique ───────────────────────────────────────────────────── */
const feriesJs = lire('js/pages/onboarding-feries.js');
const feriesHtml = lire('pages/feries.html');
const moteur = lire('js/pages/planning-moteur.js');
const memoire = lire('js/memoire.js');
const compte = lire('js/compte.js');

ok(/\bholidayDays\b/.test(feriesJs) === false, 'les jours fériés ne doivent plus être des jours de semaine (holidayDays) dans la page');
ok(/\bholidayModes\b/.test(feriesJs) === false, 'les modes ne doivent plus être rangés par jour de semaine');
ok(/\bholidayDropped\b/.test(feriesJs) === false, 'les activités retirées ne doivent plus être rangées par jour de semaine');
['holidayDates', 'holidayDateDuJour', 'holidaySemaineCourante', 'holidayPurger', 'holidayBasculerDate', 'holidayPoserMode', 'holidayDecocher'].forEach(function (nom) {
    ok(feriesJs.indexOf(nom) !== -1, 'la page des jours fériés doit connaître ' + nom);
});
ok(feriesJs.indexOf('Cette semaine') !== -1 && feriesJs.indexOf('Semaine suivante') !== -1, 'la page doit proposer cette semaine et la suivante');
ok(feriesJs.indexOf("passe ? ' disabled'") !== -1, 'un jour passé ne doit plus pouvoir être posé férié');
ok(feriesHtml.indexOf('Cette semaine et la suivante') !== -1, 'le sous-titre de la page doit parler des deux semaines');
ok(feriesHtml.indexOf("ne dure qu'une semaine") !== -1, 'la page doit dire qu\'un férié ne dure qu\'une semaine');
ok(moteur.indexOf('holidaySemaine:') !== -1, 'la signature de l\'emploi figé doit contenir la semaine affichée (sinon le jour vidé serait resservi la semaine suivante)');
ok(moteur.indexOf('holidayDates:') !== -1 && moteur.indexOf('holidayDroppedDates:') !== -1, 'la signature doit suivre les fériés posés et les activités retirées');
ok(/\bholidayDays\b/.test(moteur) === false, 'le moteur ne doit plus connaître holidayDays');
ok(memoire.indexOf('holidayDates') !== -1 && memoire.indexOf('holidayDroppedDates') !== -1, 'le profil doit sauver les fériés par date');
ok(/\bholidayDays\b/.test(memoire) === false, 'le profil ne doit plus restaurer les fériés par jour de semaine (les anciens sont abandonnés)');
ok(memoire.indexOf('holidayBasculerDate') !== -1 && memoire.indexOf('holidayPoserMode') !== -1 && memoire.indexOf('holidayDecocher') !== -1, 'les gestes de la page doivent déclencher la sauvegarde');
ok(/\bholidayDays\b/.test(compte) === false, 'la fusion des comptes ne doit plus fusionner holidayDays');
ok(moteur.indexOf("reglesPlanning: '20261019a'") !== -1, 'les règles du planning doivent être versionnées (reconstruction des plannings figés)');
/* plus personne n'a de férié hebdomadaire enregistré — Kenzah comprise */
const comptes = JSON.parse(lire('data/comptes.json'));
ok(comptes.comptes.every(function (c) { return !(((c.data || {}).holidayDays) || []).length; }),
    'aucun compte ne doit plus porter de jours fériés hebdomadaires');

/* ── 2. Deux semaines simulées ─────────────────────────────────────── */
/* Lundi 19 octobre 2026, 10h — puis lundi 26 octobre, même élève. Le
   localStorage (le profil) traverse les deux semaines : c'est là que
   voyagent les fériés et l'emploi figé. */
const store = {};
function monterContexte(instant) {
    const VRAIE_DATE = Date;
    const FIXE = instant;
    class DateFigee extends VRAIE_DATE {
        constructor(...a) { if (!a.length) super(FIXE); else super(...a); }
        static now() { return FIXE; }
    }
    const ctx = {
        console: { log: function () {}, warn: function () {}, error: function () {} },
        setTimeout: setTimeout, clearTimeout: clearTimeout,
        addEventListener: function () {}, removeEventListener: function () {},
        localStorage: {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
            setItem: function (k, v) { store[k] = String(v); },
            removeItem: function (k) { delete store[k]; }
        },
        document: {
            getElementById: function () { return null; },
            createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {}, remove: function () {}, classList: { add: function () {}, remove: function () {} } }; },
            querySelector: function () { return null; }, querySelectorAll: function () { return []; },
            body: { appendChild: function () {}, classList: { add: function () {}, remove: function () {} } },
            addEventListener: function () {}
        },
        subjects: [{ name: 'Mathématiques AA', level: 'HL', icon: '🔢' }, { name: 'Chimie', level: 'SL', icon: '⚗️' }],
        optionalSubjects: [],
        ibYear: 'DP2',
        weekdayWakeup: '05:30', saturdayWakeup: '08:30', sundayWakeup: '09:00',
        weekdaySleepHours: 8, saturdaySleepHours: 8, sundaySleepHours: 8,
        customEvents: [], selectedActivities: [],
        phoneTime: 0, phoneDays: [], phoneDuration: 30, samePhoneDuration: true, phoneDayDurations: {},
        sameFreeTime: true, freeTimeMinutes: 60, freeTimeByDay: {},
        holidayBypass: 0, holidayDates: {}, holidayDroppedDates: {},
        COURS_DEBUT: 470, COURS_FIN: 985, COURS_FIN_MATIN: 750,
        transportMode: 'walking',
        carDeparture: '', carToSchool: 30, carFromSchool: 40, carReturnTime: '',
        motoDeparture: '', motoToSchool: 25, motoFromSchool: 25, motoReturn: '',
        targetScore: 36,
        sousTitreMatiere: function (s) { return (s && s.level) || ''; },
        couleurMatiere: function () { return '#0ea5e9'; },
        formatDuration: function (m) { return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); },
        calculateBedtime: function (w, h) {
            var p = String(w).split(':');
            var m = (Number(p[0]) * 60 + Number(p[1])) - (h || 8) * 60;
            m = ((m % 1440) + 1440) % 1440;
            return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
        },
        bedtimeForDay: function (d) { return d === 5 ? '00:30' : '22:00'; }
    };
    ctx.allSubj = ctx.subjects.concat(ctx.optionalSubjects);
    ctx.Date = DateFigee;
    ctx.window = ctx;
    vm.createContext(ctx);
    ['js/pages/devoirs.js', 'js/pages/devoirs-moteur.js', 'js/pages/onboarding-feries.js', 'js/pages/planning-base.js', 'js/pages/planning-moteur.js'].forEach(function (f) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
    });
    return ctx;
}

const semaineA = monterContexte(new Date(2026, 9, 19, 10, 0, 0).getTime());

/* L'élève : natation le jeudi après-midi. */
semaineA.selectedActivities = [{ name: 'Natation', icon: '🏊', days: [3], sameTime: true, startTime: '14:00', endTime: '16:00', dayTimes: {} }];

/* Un férié posé pour cette semaine : mercredi 21 octobre, libre. */
semaineA.holidayPoserDate('2026-10-21', 'free');
ok(semaineA.isHoliday(2) === true, 'le mercredi de cette semaine doit être férié');
ok(semaineA.holidayMode(2) === 'free', 'le mode du mercredi doit être « temps libre »');
ok(semaineA.isHoliday(3) === false, 'le jeudi de cette semaine ne doit pas être férié');
const mercrediA = semaineA.generateDayEvents(2);
ok(Array.isArray(mercrediA) && mercrediA.length === 0, 'le mercredi férié (libre) doit être vidé, trouvé : ' + (mercrediA || []).length + ' blocs');

/* Le jeudi reste normal : la natation y est. */
const jeudiA = semaineA.generateDayEvents(3);
ok(jeudiA.some(function (ev) { return String(ev.title).indexOf('Natation') !== -1; }), 'le jeudi normal doit garder la natation');

/* Maintenant le jeudi 22 devient férié allégé : l'élève décoche la
   natation. Le planning doit se reconstruire tout seul (l'emploi figé
   d'avant le férié n'est plus valide). */
const idNatation = (jeudiA.filter(function (ev) { return String(ev.title).indexOf('Natation') !== -1; })[0] || {}).id;
ok(!!idNatation, 'la natation du jeudi doit avoir un identifiant');
semaineA.holidayPoserDate('2026-10-22', 'light');
semaineA.holidayDecocher('2026-10-22', idNatation);
const jeudiAlloge = semaineA.generateDayEvents(3);
ok(!jeudiAlloge.some(function (ev) { return String(ev.title).indexOf('Natation') !== -1; }), 'la natation décochée doit disparaître du jeudi férié');
ok(jeudiAlloge.some(function (ev) { return ev.id === 'wakeup' || ev.id === 'sleep'; }), 'le jeudi allégé garde réveil et coucher');

/* La semaine change : lundi 26 octobre. Le profil (localStorage) est
   le même : mêmes fériés enregistrés, et l'emploi figé de la semaine
   passée voyage avec lui. */
ok(semaineA.emploiEstFige() === true, 'l\'emploi de la semaine A doit être figé après génération');
const figeA = vm.runInContext('emploiFige', semaineA);
const semaineB = monterContexte(new Date(2026, 9, 26, 10, 0, 0).getTime());
semaineB.selectedActivities = semaineA.selectedActivities;
/* les fériés du profil, tels qu'ils ont été sauvegardés */
semaineB.holidayPoserDate('2026-10-21', 'free');
semaineB.holidayPoserDate('2026-10-22', 'light');
/* l'emploi figé de la semaine passée, restauré par le profil */
vm.runInContext('emploiFige = ' + JSON.stringify(figeA), semaineB);

ok(semaineB.isHoliday(2) === false, 'le mercredi de la semaine suivante ne doit PAS être férié');
ok(semaineB.holidayMode(2) === null, 'le mercredi suivant ne doit avoir aucun mode');
ok(semaineB.emploiEstFige() === false, 'l\'emploi figé de la semaine passée doit être invalide (la signature contient la semaine) — sinon le mercredi vidé serait resservi');

const mercrediB = semaineB.generateDayEvents(2);
ok(mercrediB.length > 0 && mercrediB.some(function (ev) { return ev.id === 'wakeup'; }), 'le mercredi suivant doit redevenir une journée normale');
const jeudiB = semaineB.generateDayEvents(3);
ok(jeudiB.some(function (ev) { return String(ev.title).indexOf('Natation') !== -1; }), 'la natation doit revenir toute seule le jeudi suivant');

/* La pose d'un férié change la signature : le planning se reconstruit
   dès que l'élève en pose un (pas seulement au changement de semaine). */
const sigSans = vm.runInContext('emploiFaitsSignature()', semaineB);
semaineB.holidayPoserDate('2026-10-29', 'free');
const sigAvec = vm.runInContext('emploiFaitsSignature()', semaineB);
ok(sigSans !== sigAvec, 'poser un férié doit changer la signature (reconstruction immédiate)');

/* Les dates passées quittent la liste d'elles-mêmes. */
semaineB.holidayPoserDate('2026-10-25', 'free');
semaineB.holidayPurger();
ok(semaineB.holidayEstFerie('2026-10-25') === false, 'un férié passé doit être purgé');
ok(semaineB.holidayEstFerie('2026-10-21') === false, 'les fériés de la semaine passée doivent être purgés aussi');
ok(semaineB.holidayEstFerie('2026-10-29') === true, 'un férié à venir reste en place');

/* La semaine affichée est bien dans la signature : deux lundis
   différents donnent deux signatures différentes, mêmes fériés. */
const sigA = vm.runInContext('emploiFaitsSignature()', semaineA);
const sigB2 = vm.runInContext('emploiFaitsSignature()', semaineB);
ok(sigA !== sigB2, 'la signature doit changer d\'une semaine à l\'autre');

if (echecs.length) {
    console.error('jours fériés : échecs ' + echecs.length);
    echecs.forEach(function (e) { console.error(' - ' + e); });
    process.exit(1);
}
console.log('ok jours fériés : posés par date pour une semaine, la suivante redevient normale avec ses activités, emploi figé invalidé au changement de semaine, dates passées purgées');
