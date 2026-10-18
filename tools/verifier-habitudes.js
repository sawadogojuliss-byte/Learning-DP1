/* Vérifie que Tes habitudes est branchée pour tout le monde
   et que le planning reprend les faits saisis, sans changer
   un emploi tant que la page n'a pas été validée. */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.join(__dirname, '..');
var echecs = [];

function lire(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(cond, message) {
    if (!cond) echecs.push(message);
}

function contient(rel, extrait, message) {
    var texte = lire(rel);
    assert(texte.indexOf(extrait) !== -1, message || (rel + ' ne contient pas ' + extrait));
    return texte;
}

var registre = lire('js/registre.js');
var sommeil = registre.indexOf('pages/onboarding-sommeil.html');
var habitudesHtml = registre.indexOf('pages/onboarding-habitudes.html');
var sommeilJs = registre.indexOf('js/pages/onboarding-sommeil.js');
var habitudesJs = registre.indexOf('js/pages/onboarding-habitudes.js');
assert(sommeil !== -1 && habitudesHtml > sommeil, 'la page habitudes doit suivre la page sommeil');
assert(sommeilJs !== -1 && habitudesJs > sommeilJs, 'le script habitudes doit suivre le script sommeil');

contient('js/pages/onboarding-sommeil.js', "showHabitsPage('transport')", 'le sommeil doit ouvrir les habitudes');
contient('js/pages/onboarding-transport.js', "showHabitsPage('transport')", 'le retour transport doit revenir aux habitudes');
contient('pages/planning.html', 'id="menuHabitudes"', 'le menu doit proposer Tes habitudes');
var menu = lire('pages/planning.html');
var blocMenu = menu.slice(menu.indexOf('id="menuHabitudes"'), menu.indexOf('id="menuHabitudes"') + 280);
assert(blocMenu.indexOf('display:none') === -1, 'le menu habitudes ne doit pas être caché');
assert(blocMenu.indexOf('boiteEstAdmin') === -1, 'les habitudes ne sont pas réservées aux admins');

var memoire = lire('js/memoire.js');
assert(memoire.indexOf("habitsModal: 'habitudes'") !== -1, 'la mémoire doit connaître la page');
assert(memoire.indexOf('habitudesDefinies') !== -1, 'la mémoire doit enregistrer la validation');
assert(memoire.indexOf("habitudes: 'sommeil'") !== -1, 'le retour navigateur doit aller au sommeil');
assert(memoire.indexOf("transport: 'habitudes'") !== -1, 'le transport doit revenir aux habitudes');

var moteur = lire('js/pages/planning-moteur.js');
assert(moteur.indexOf('habitudesRepas') !== -1, 'le moteur doit lire les repas saisis');
assert(moteur.indexOf('habitudesDureeMatin') !== -1, 'le moteur doit lire la préparation du matin');
assert(moteur.indexOf('poserPreparationSoir') !== -1, 'le moteur doit placer la préparation du soir');
assert(moteur.indexOf('faits.habitudes') !== -1, 'la signature ne doit inclure les habitudes que si elles sont validées');
assert(moteur.indexOf("reglesPlanning: '20261018b'") !== -1, 'ne pas forcer la reconstruction de tous les emplois');

var page = lire('pages/onboarding-habitudes.html');
assert(page.indexOf('Tes habitudes') !== -1, 'titre manquant');
assert(page.indexOf('Préparation du matin') !== -1, 'préparation du matin manquante');
assert(page.indexOf('Préparation du soir') !== -1, 'préparation du soir manquante');
assert(page.indexOf('Petit-déjeuner') !== -1, 'petit-déjeuner manquant');
assert(page.indexOf('Dîner') !== -1, 'dîner manquant');
assert(page.indexOf('Aucun') !== -1, 'le repas doit pouvoir rester vide');
assert(page.indexOf("Choisis l'heure de début et de fin de chaque préparation.") !== -1, 'la description de la préparation reste');
assert(page.indexOf('Indique aussi') === -1, 'la phrase sur les repas est retirée');
assert(page.indexOf('À toi de choisir') === -1, 'le bloc À toi de choisir est retiré');
assert(page.indexOf('Tu peux ne pas en prendre') === -1, 'la phrase optionnelle des repas est retirée');
assert(lire('js/pages/onboarding-habitudes.js').indexOf('10, 120') === -1, 'la durée minimale des repas n’est plus 10 minutes');
assert(page.indexOf('validateHabits()') !== -1 && page.indexOf('hideHabitsPage()') !== -1, 'boutons Continuer et Retour manquants');

var store = {};
var sandbox = {
    console: console,
    setInterval: function () { return 0; },
    setTimeout: function () { return 0; },
    clearInterval: function () {},
    clearTimeout: function () {},
    localStorage: {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
    },
    document: {
        getElementById: function () { return null; },
        querySelectorAll: function () { return []; },
        addEventListener: function () {}
    },
    addEventListener: function () {},
    removeEventListener: function () {},
    window: {},
    subjects: [{ name: 'Mathématiques', level: 'SL', icon: '📐' }],
    optionalSubjects: [],
    phoneDays: [],
    samePhoneDuration: true,
    phoneDuration: 60,
    phoneDayDurations: {},
    weekdayWakeup: '06:00',
    saturdayWakeup: '07:00',
    sundayWakeup: '08:00',
    weekdaySleepHours: 8,
    saturdaySleepHours: 8,
    sundaySleepHours: 8,
    selectedActivities: [],
    customEvents: [],
    transportMode: 'voiture',
    carDeparture: '07:20',
    carToSchool: 30,
    carFromSchool: 40,
    motoDeparture: '07:00',
    motoReturn: '',
    motoToSchool: 25,
    motoFromSchool: 25,
    holidayBypass: false,
    holidayDays: [],
    holidayModes: {},
    freeTimeMinutes: 60,
    sameFreeTime: true,
    freeTimeByDay: {},
    userName: 'Test',
    targetScore: 36,
    currentMood: '',
    ibYear: 'DP1',
    memoirLevel: '',
    iaLevel: '',
    iaLevels: {},
    memoirPlan: [],
    iaPlans: {}
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.bedtimeForDay = function (day) {
    var wake = day === 5 ? sandbox.saturdayWakeup : (day === 6 ? sandbox.sundayWakeup : sandbox.weekdayWakeup);
    var hours = day === 5 ? 8 : (day === 6 ? 8 : 8);
    var parts = wake.split(':');
    var mins = (parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) - hours * 60 + 1440) % 1440;
    return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
};
sandbox.holidayMode = function () { return null; };
sandbox.freeMinutesForDay = function () { return 60; };
sandbox.formatDuration = function (m) { return m + ' min'; };
sandbox.filePriorite = function (list) { return list || []; };
sandbox.sujetDuJour = function (list) { return list && list[0]; };
sandbox.sousTitreMatiere = function () { return ''; };
sandbox.couleurMatiere = function () { return 'study'; };
sandbox.COURSES = true;

vm.createContext(sandbox);
vm.runInContext(lire('js/pages/planning-base.js'), sandbox, { filename: 'planning-base.js' });
vm.runInContext(lire('js/pages/onboarding-habitudes.js'), sandbox, { filename: 'habitudes.js' });
vm.runInContext(lire('js/pages/planning-moteur.js'), sandbox, { filename: 'planning-moteur.js' });

function jour(index) {
    sandbox.window.__emploiCalculBrut = true;
    sandbox.emploiFige = null;
    return sandbox.generateDayEvents(index);
}

function trouver(events, id) {
    return (events || []).filter(function (ev) { return ev && ev.id === id; })[0] || null;
}

function minutes(valeur) {
    var parts = String(valeur || '00:00').split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

assert(sandbox.habitudesActives() === false, 'les habitudes ne sont pas actives avant validation');
assert(sandbox.habitudesRepas('breakfast').mode === 'defaut', 'sans validation, le petit-déjeuner garde le placement actuel');
assert(sandbox.habitudesDureeSoir().mode === 'defaut', 'sans validation, pas de préparation du soir imposée');

var avant = jour(0);
var prepAvant = trouver(avant, 'prep');
var dejAvant = trouver(avant, 'breakfast');
var dinerAvant = trouver(avant, 'dinner');
assert(prepAvant && minutes(prepAvant.endTime) - minutes(prepAvant.startTime) === 30, 'préparation par défaut de 30 min');
assert(dejAvant, 'petit-déjeuner présent par défaut');
assert(dinerAvant, 'dîner présent par défaut');
assert(!trouver(avant, 'prepSoir'), 'pas de préparation du soir avant validation');
var sigAvant = sandbox.emploiFaitsSignature();
assert(sigAvant.indexOf('habitudes') === -1, 'la signature ne change pas tant que les habitudes ne sont pas validées');

sandbox.habitudesDefinies = true;
sandbox.prepMatinMinutes = 40;
sandbox.prepSoirMinutes = 25;
sandbox.petitDejHeure = '06:15';
sandbox.petitDejMinutes = 20;
sandbox.dinerHeure = '19:10';
sandbox.dinerMinutes = 50;

var semaine = jour(0);
var prep = trouver(semaine, 'prep');
var dej = trouver(semaine, 'breakfast');
var diner = trouver(semaine, 'dinner');
var soir = trouver(semaine, 'prepSoir');
var trajet = trouver(semaine, 'commute1');
assert(prep && minutes(prep.endTime) - minutes(prep.startTime) === 40, 'préparation du matin de 40 min, pas 30');
assert(prep && trajet && prep.endTime === trajet.startTime, 'la préparation du matin finit quand le trajet école commence');
assert(minutes(prep.startTime) < minutes(trajet.startTime), 'la préparation reste avant le trajet école');
assert(dej && dej.startTime === '06:15' && dej.endTime === '06:35', 'petit-déjeuner exactement à 06:15 pendant 20 min');
assert(diner && diner.startTime === '19:10' && diner.endTime === '20:00', 'dîner exactement à 19:10 pendant 50 min');
assert(soir && soir.endTime === sandbox.bedtimeForDay(0), 'la préparation du soir finit au coucher');
var dimanche = jour(6);
var dinerDimanche = trouver(dimanche, 'dinner');
var prepDimanche = trouver(dimanche, 'prep');
assert(dinerDimanche && dinerDimanche.startTime === '19:10' && dinerDimanche.endTime === '20:00', 'le dîner du dimanche n’est plus forcé à 19:00');
assert(prepDimanche && minutes(prepDimanche.endTime) - minutes(prepDimanche.startTime) === 40, 'la préparation du week-end garde la durée saisie');
assert(soir && minutes(soir.endTime) - minutes(soir.startTime) === 25, 'préparation du soir de 25 min');
sandbox.prepMatinDebut = '06:00';
sandbox.prepMatinFin = '06:25';
sandbox.prepSoirDebut = '20:10';
sandbox.prepSoirFin = '20:40';
var choisi = jour(0);
var prepChoisi = trouver(choisi, 'prep');
var soirChoisi = trouver(choisi, 'prepSoir');
assert(prepChoisi && prepChoisi.startTime === '06:00' && prepChoisi.endTime === '06:25', 'la préparation du matin suit les heures choisies');
assert(soirChoisi && soirChoisi.startTime === '20:10' && soirChoisi.endTime === '20:40', 'la préparation du soir suit les heures choisies');
sandbox.prepMatinDebut = '';
sandbox.prepMatinFin = '';
sandbox.prepSoirDebut = '';
sandbox.prepSoirFin = '';
assert(sandbox.emploiFaitsSignature().indexOf('"prepMatin":40') !== -1, 'la signature retient la préparation saisie');

sandbox.petitDejHeure = '';
sandbox.dinerHeure = '';
var sansRepas = jour(1);
assert(!trouver(sansRepas, 'breakfast'), 'petit-déjeuner absent si laissé vide');
assert(!trouver(sansRepas, 'dinner'), 'dîner absent si laissé vide');
assert(trouver(sansRepas, 'prep'), 'la préparation du matin reste');
assert(trouver(sansRepas, 'prepSoir'), 'la préparation du soir reste');

sandbox.petitDejHeure = '05:00';
sandbox.petitDejMinutes = 60;
var tot = jour(2);
var dejTot = trouver(tot, 'breakfast');
assert(dejTot && dejTot.startTime === '05:00' && dejTot.endTime === '06:00', 'un créneau 5 h – 6 h reste autorisé');
assert(sandbox.habitudesChevaucheCours('05:00', 60) === false, '5 h – 6 h ne chevauche pas les cours');
assert(sandbox.habitudesChevaucheCours('07:50', 30) === true, '07:50 – 08:20 chevauche les cours');
assert(sandbox.habitudesChevaucheCours('16:35', 30) === false, '16:35 ne chevauche pas les cours');
assert(sandbox.habitudesChevaucheCours('16:25', 30) === false, '16:25 ne chevauche pas les cours');
assert(sandbox.habitudesChevaucheCours('16:20', 15) === true, '16:20 chevauche encore les cours');
assert(sandbox.habitudesChevaucheCours('16:20', 30) === true, '16:20 – 16:50 chevauche les cours');

var message = sandbox.habitudesMessageFormulaire({
    petitDejChoix: '',
    dinerChoix: 'aucun',
    petitDejHeure: '07:00',
    petitDejMinutes: 30,
    dinerHeure: '19:00',
    dinerMinutes: 45
});
assert(message.indexOf('petit-déjeuner') !== -1, 'un repas non choisi bloque la validation');
var cours = sandbox.habitudesMessageFormulaire({
    petitDejChoix: 'heure',
    dinerChoix: 'aucun',
    petitDejHeure: '10:00',
    petitDejMinutes: 30,
    dinerHeure: '19:00',
    dinerMinutes: 45
});
assert(cours.indexOf('cours') !== -1, 'un repas pendant les cours est refusé');

sandbox.habitudesDefinies = false;
sandbox.prepMatinMinutes = 40;
var encoreDefaut = jour(3);
var prepDefaut = trouver(encoreDefaut, 'prep');
assert(prepDefaut && minutes(prepDefaut.endTime) - minutes(prepDefaut.startTime) === 30, 'une durée saisie mais non validée ne remplace pas le défaut');
assert(!trouver(encoreDefaut, 'prepSoir'), 'la préparation du soir n’apparaît pas avant validation');
sandbox.habitudesBrouillon = { petitDejMinutes: 10, dinerMinutes: 10 };
sandbox.ajusterHabitude('petitDej', -5);
sandbox.ajusterHabitude('diner', -5);
assert(sandbox.habitudesBrouillon.petitDejMinutes === 5, 'le petit-déjeuner peut durer 5 minutes');
assert(sandbox.habitudesBrouillon.dinerMinutes === 5, 'le dîner peut durer 5 minutes');
sandbox.ajusterHabitude('petitDej', -5);
assert(sandbox.habitudesBrouillon.petitDejMinutes === 5, 'le petit-déjeuner ne descend pas sous 5 minutes');

if (echecs.length) {
    console.error('échecs ' + echecs.length);
    echecs.forEach(function (e) { console.error('- ' + e); });
    process.exit(1);
}
console.log('échecs 0');
