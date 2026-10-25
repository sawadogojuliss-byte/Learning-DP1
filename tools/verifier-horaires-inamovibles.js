/* Régression : aucun repas du matin le soir, ni trajet/activité décalé(e)
   sans consentement. Profil fictif local ; aucune connexion ni aucun mail. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const lire = file => fs.readFileSync(path.join(root, file), 'utf8');
const storage = new Map();
const ctx = {
    console,
    window: null,
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, String(v)) },
    document: { getElementById: () => null, querySelectorAll: () => [], addEventListener: () => {} },
    setInterval: () => 0, setTimeout: () => 0, clearInterval: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    subjects: [{ name: 'Mathématiques', level: 'SL', icon: '📐' }], optionalSubjects: [],
    phoneDays: [], samePhoneDuration: true, phoneDuration: 60, phoneDayDurations: {},
    weekdayWakeup: '07:00', saturdayWakeup: '07:00', sundayWakeup: '08:00',
    weekdaySleepHours: 8, saturdaySleepHours: 8, sundaySleepHours: 8,
    selectedActivities: [], transportMode: 'voiture', carDeparture: '07:20',
    carToSchool: 30, carFromSchool: 40, motoDeparture: '07:00', motoReturn: '',
    motoToSchool: 25, motoFromSchool: 25,
    holidayBypass: false, holidayDates: {}, freeTimeMinutes: 60, sameFreeTime: true, freeTimeByDay: {},
    userName: 'Profil fictif', targetScore: 36, currentMood: '', ibYear: 'DP1',
    memoirLevel: '', iaLevel: '', iaLevels: {}, memoirPlan: [], iaPlans: {}
};
ctx.window = ctx;
ctx.bedtimeForDay = day => day === 6 ? '00:00' : '23:00';
ctx.holidayMode = () => null;
ctx.freeMinutesForDay = () => 60;
ctx.formatDuration = m => m + ' min';
ctx.filePriorite = list => list || [];
ctx.sujetDuJour = list => list && list[0];
ctx.sousTitreMatiere = () => '';
ctx.couleurMatiere = () => 'study';
vm.createContext(ctx);
for (const file of ['js/pages/planning-base.js', 'js/pages/onboarding-habitudes.js', 'js/pages/planning-moteur.js']) {
    vm.runInContext(lire(file), ctx, { filename: file });
}
const slot = (day, id) => ctx.generateDayEvents(day).find(e => e.id === id);
const heure = t => Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]);

// L'ancien moteur envoyait le petit-déjeuner à 17:05 pour un réveil à 07:00.
let dej = slot(0, 'breakfast');
assert.ok(dej && heure(dej.startTime) < 12 * 60, 'petit-déjeuner envoyé le soir');
assert.equal(dej.conflitHoraire, true, 'l’impossibilité de le placer sans conflit doit rester visible');
assert.equal(slot(0, 'commute1').startTime, '07:20');
assert.equal(slot(0, 'commute2').startTime, '16:25');
assert.equal(slot(0, 'breakfast').startTime, dej.startTime, 'relecture instable');

// Un ancien emploi gelé ne doit pas conserver des erreurs de l'ancien moteur.
ctx.emploiFige.jours[0].find(e => e.id === 'breakfast').startTime = '17:05';
ctx.emploiFige.jours[0].find(e => e.id === 'breakfast').endTime = '17:35';
ctx.emploiFige.jours[0].find(e => e.id === 'commute1').startTime = '19:00';
ctx.emploiFige.jours[0].find(e => e.id === 'commute1').endTime = '19:30';
assert.ok(heure(slot(0, 'breakfast').startTime) < 12 * 60, 'ancien petit-déjeuner figé non réparé');
assert.equal(slot(0, 'commute1').startTime, '07:20', 'ancien trajet du matin non réparé');
assert.equal(slot(0, 'commute1').startTime, '07:20', 'réparation non stable');

// Une activité saisie près d'un cours/trajet reste à l'heure choisie,
// même si le conflit doit être tranché plus tard par l'élève.
ctx.weekdayWakeup = '06:00';
ctx.selectedActivities = [{ name: 'Sport', icon: '🏃', days: [0], sameTime: true,
    startTime: '07:10', endTime: '08:00', dayTimes: {} }];
let sport = slot(0, 'activity-Sport');
assert.ok(sport && sport.startTime === '07:10' && sport.endTime === '08:00', 'activité choisie déplacée');
assert.equal(slot(0, 'commute1').startTime, '07:20', 'trajet déplacé par une activité');
assert.equal(slot(0, 'school1').startTime, '07:50', 'cours déplacé par une activité');
assert.equal(slot(0, 'activity-Sport').startTime, '07:10', 'activité déplacée à la relecture');
ctx.emploiFige.jours[0].find(e => e.id === 'activity-Sport').startTime = '17:35';
ctx.emploiFige.jours[0].find(e => e.id === 'activity-Sport').endTime = '18:25';
assert.equal(slot(0, 'activity-Sport').startTime, '07:10', 'ancienne activité figée non réparée');

// Un créneau ajouté par l'élève reste lui aussi à son heure si un trajet
// ou une autre activité le recouvre, au lieu de pousser un fait du profil.
ctx.selectedActivities = [];
vm.runInContext("customEvents = [{ id: 'perso-1', day: 0, title: 'Sport', startTime: '07:15', endTime: '07:45', type: 'activity', source: 'custom' }]; emploiFige = null;", ctx);
assert.equal(slot(0, 'perso-1').startTime, '07:15');
assert.equal(slot(0, 'commute1').startTime, '07:20');
ctx.emploiFige.jours[0].find(e => e.id === 'perso-1').startTime = '20:00';
assert.equal(slot(0, 'perso-1').startTime, '07:15', 'ancien créneau personnel figé non réparé');
vm.runInContext('customEvents = []; emploiFige = null;', ctx);

// Un trajet ou une préparation dont l'heure a été confirmée dans l'éditeur
// ne doit pas être recalé(e) à l'insu de l'élève au prochain affichage.
vm.runInContext("customEvents = [" +
    "{ id: 'ov-aller', day: 0, replacesId: 'commute1', pinned: true, startTime: '06:55', endTime: '07:15', type: 'transport' }," +
    "{ id: 'ov-prep', day: 0, replacesId: 'prep', pinned: true, startTime: '06:20', endTime: '06:45', type: 'prep' }]; emploiFige = null;", ctx);
assert.equal(slot(0, 'commute1').startTime, '06:55', 'trajet explicitement modifié recalé');
assert.equal(slot(0, 'prep').startTime, '06:20', 'préparation explicitement modifiée recalée');
assert.equal(slot(0, 'commute1').startTime, '06:55', 'trajet modifié instable');
vm.runInContext('customEvents = []; emploiFige = null;', ctx);

// La journée signale le conflit conservé, sans le résoudre en secret.
let alerte;
const conteneur = { parentNode: { insertBefore: element => { alerte = element; } } };
ctx.document.getElementById = id => id === 'eventsContainer' ? conteneur : null;
ctx.document.createElement = tag => ({ tag, style: {}, setAttribute: () => {} });
ctx.document.readyState = 'loading';
vm.runInContext(lire('js/pages/planning-interface.js'), ctx, { filename: 'planning-interface.js' });
ctx.v3SignalerChevauchementJour([
    { id: 'breakfast', title: 'Petit-déjeuner', startTime: '07:10', endTime: '07:40', conflitHoraire: true },
    { id: 'prep', title: 'Préparation', startTime: '07:10', endTime: '07:20', kind: 'pinned', habitudeFixe: true }
], 0);
assert.ok(alerte && alerte.tag === 'div' && alerte.textContent.includes('se chevauchent'), 'alerte fonctionnelle absente');

// Les horaires de repas explicitement enregistrés restent leurs horaires.
ctx.selectedActivities = [];
ctx.habitudesDefinies = true;
ctx.petitDejHeure = '06:15'; ctx.petitDejMinutes = 20;
ctx.dinerHeure = '19:10'; ctx.dinerMinutes = 50;
assert.equal(slot(0, 'breakfast').startTime, '06:15');
assert.equal(slot(0, 'dinner').startTime, '19:10');
ctx.emploiFige.jours[0].find(e => e.id === 'breakfast').startTime = '18:00';
ctx.emploiFige.jours[0].find(e => e.id === 'breakfast').endTime = '18:20';
assert.equal(slot(0, 'breakfast').startTime, '06:15', 'ancienne habitude figée non réparée');
let semaine = '2026-10-19';
ctx.holidaySemaineCourante = () => semaine;
assert.equal(slot(0, 'breakfast').startTime, '06:15');
semaine = '2026-10-26';
assert.equal(slot(0, 'breakfast').startTime, '06:15', 'la semaine suivante a changé le repas choisi');
assert.equal(slot(0, 'commute1').startTime, '07:20', 'la semaine suivante a déplacé le trajet');
console.log('horaires inamovibles : repas, trajets, cours, activités et emploi gelé (0 échec)');
