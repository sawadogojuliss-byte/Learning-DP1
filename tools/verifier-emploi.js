#!/usr/bin/env node
/* ============================================================
   Vérificateur — Emploi du temps scolaire
   1. La page existe : parcours après Temps libre, menu, scripts,
      question du bac juste après.
   2. Le lecteur décode un vrai emploi du temps en colonnes (items avec
      positions) : jours, heures am/pm, noms sur deux lignes, événements
      de l'école écartés. Entraîné sur la géométrie d'un vrai document.
   3. Le planning utilise les vrais cours : plus de créneaux « Cours »
      génériques, déjeuner dans le creux du midi, travail dans les
      heures creuses (révisions de la prochaine matière, exercices,
      mémoire, IA, CAS), vendredi du bac réservé.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const echecs = [];
function ok(cond, message) { if (!cond) echecs.push(message); }

/* ── 1. Statique ───────────────────────────────────────────────────── */
const emploiHtml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'emploi-temps.html'), 'utf8');
const emploiJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'emploi-temps.js'), 'utf8');
const moteurJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'emploi-temps-moteur.js'), 'utf8');
const planningMoteur = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'planning-moteur.js'), 'utf8');
const planningHtml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'planning.html'), 'utf8');
const libreHtml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'onboarding-libre.html'), 'utf8');
const memoireJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'memoire.js'), 'utf8');
const registreJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'registre.js'), 'utf8');
const navJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'navigation.js'), 'utf8');
const matieresJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'onboarding-matieres.js'), 'utf8');

ok(emploiHtml.indexOf('id="emploiModal"') !== -1, 'la page Emploi du temps scolaire manque');
ok(libreHtml.indexOf('showEmploiPage()') !== -1, 'le bouton Continuer de Temps libre doit mener à la page Emploi du temps');
ok(emploiJs.indexOf('function validateEmploiTemps') !== -1, 'la validation de la page manque');
ok(emploiJs.indexOf('devoirsPoserQuestionBac') !== -1, 'la question du bac doit venir juste après l\'emploi du temps scolaire (DP2)');
ok(matieresJs.indexOf('devoirsPoserQuestionBac') === -1, 'la question du bac ne doit plus être après les matières');
ok(planningHtml.indexOf('Emploi du temps scolaire') !== -1, 'l\'entrée de menu manque');
ok(planningHtml.indexOf('Emploi du temps scolaire') > planningHtml.indexOf('Devoirs et Examens'), 'l\'entrée doit venir après Devoirs et Examens');
ok(registreJs.indexOf('pages/emploi-temps.html') !== -1, 'la page n\'est pas enregistrée');
ok(registreJs.indexOf('js/pages/emploi-temps.js') !== -1 && registreJs.indexOf('js/pages/emploi-temps-moteur.js') !== -1, 'les scripts ne sont pas enregistrés');
ok(registreJs.indexOf('js/pages/emploi-temps-moteur.js') < registreJs.indexOf('js/pages/planning-moteur.js'), 'le moteur emploi doit se charger avant planning-moteur');
ok(navJs.indexOf("page === 'emploi'") !== -1, 'la navigation ne connaît pas la page emploi');
ok(memoireJs.indexOf("emploiModal: 'emploi'") !== -1, 'l\'étape emploi manque dans la mémoire');
ok(memoireJs.indexOf('emploiScolaireCompact') !== -1, 'l\'emploi du temps ne voyage pas avec le compte');
ok(moteurJs.indexOf('function emploiScolaireTrous') !== -1, 'la détection des heures creuses manque');
ok(moteurJs.indexOf('function emploiScolaireBlocsTravail') !== -1, 'le remplissage des heures creuses manque');
ok(moteurJs.indexOf('function emploiScolaireSujets') !== -1, 'l\'extraction des matières vues manque');
ok(planningMoteur.indexOf('cours-reel-') !== -1, 'le planning n\'utilise pas les vrais cours');
ok(planningMoteur.indexOf('function emploiScolaireProgramme') !== -1, 'le planning doit suivre le programme des matières vues');
ok(planningMoteur.indexOf('emploiScolaireCompact') !== -1, 'l\'emploi du temps doit faire partie des faits (reconstruction)');
ok(planningMoteur.indexOf("'20261018a'") !== -1, 'les règles du planning doivent être versionnées pour reconstruire les plannings figés');
const fonctionContinuer = emploiJs.slice(emploiJs.indexOf('function validateEmploiTemps'));
ok(fonctionContinuer.indexOf("classList.remove('active')") !== -1, 'Continuer doit fermer la page Emploi du temps (elle restait au-dessus du planning)');
const fonctionRetour = emploiJs.slice(emploiJs.indexOf('function goBackFromEmploi'));
ok(fonctionRetour.indexOf('__profilComplet') !== -1, 'le Retour doit ramener au planning quand le profil est complet');

/* ── 2. Le lecteur, sur la géométrie d'un vrai document ───────────── */
const store = {};
const context = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    setTimeout: setTimeout,
    localStorage: {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
    },
    document: {
        getElementById: function () { return null; },
        createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; },
        querySelector: function () { return null; },
        body: { appendChild: function () {} },
        addEventListener: function () {}
    },
    subjects: [{ name: 'Maths AA', level: 'SL', icon: '🔢' }, { name: 'Physics', level: 'SL', icon: '⚛️' }, { name: 'English B', level: 'HL', icon: '🔤' }],
    optionalSubjects: [{ name: 'French A: Langue et littérature', level: 'SL', icon: '🇫🇷' }, { name: 'ESS', level: 'SL', icon: '🌱' }, { name: 'Geography', level: 'SL', icon: '🌍' }],
    ibYear: 'DP2'
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'devoirs.js'), 'utf8'), context);
vm.runInContext(emploiJs, context);
vm.runInContext(moteurJs, context);

const ENTRAINEMENT = [{"str": "19 Oct", "x": 48.749997968749994, "y": 513.4199834375}, {"str": "Mon", "x": 80.0624966640625, "y": 513.4199834375}, {"str": "20 Oct", "x": 202.64061655664062, "y": 513.4199834375}, {"str": "Tue", "x": 233.9531152519531, "y": 513.4199834375}, {"str": "21 Oct", "x": 356.5312351445312, "y": 513.4199834375}, {"str": "Wed", "x": 387.8437338398437, "y": 513.4199834375}, {"str": "22 Oct", "x": 510.4218537324218, "y": 513.4199834375}, {"str": "Thu", "x": 541.7343524277344, "y": 513.4199834375}, {"str": "23 Oct", "x": 664.3124723203125, "y": 513.4199834375}, {"str": "Fri", "x": 695.624971015625, "y": 513.4199834375}, {"str": "Special Events", "x": 45.74999809375, "y": 493.16998428125004}, {"str": "Picture Day", "x": 45.74999809375, "y": 476.66998496875004}, {"str": "DP2 Geography SL&HL", "x": 45.74999809375, "y": 452.6699859687501}, {"str": "P1 · 8:00 am - 9:30 am", "x": 45.74999809375, "y": 439.91998650000005}, {"str": "DP2- Theory of knowledge", "x": 45.74999809375, "y": 410.66998771875006}, {"str": "P3 · 11:10 am - 12:40 pm", "x": 45.74999809375, "y": 397.9199882500001}, {"str": "DP2 ESS SL", "x": 45.74999809375, "y": 368.66998946875003}, {"str": "P4 · 1:25 pm - 2:55 pm", "x": 45.74999809375, "y": 355.9199900000001}, {"str": "DP2 Physics SL&HL", "x": 45.74999809375, "y": 326.66999121875006}, {"str": "P5 · 2:55 pm - 4:25 pm", "x": 45.74999809375, "y": 313.91999175000007}, {"str": "DP2 Maths AA SL", "x": 199.6406166816406, "y": 452.6699859687501}, {"str": "P1 · 8:00 am - 9:30 am", "x": 199.6406166816406, "y": 439.91998650000005}, {"str": "DP2 English B HL", "x": 199.6406166816406, "y": 410.66998771875006}, {"str": "P2 · 9:40 am - 11:10 am", "x": 199.6406166816406, "y": 397.9199882500001}, {"str": "DP2 - K4C", "x": 199.6406166816406, "y": 368.66998946875003}, {"str": "P3 · 11:10 am - 12:40 pm", "x": 199.6406166816406, "y": 355.9199900000001}, {"str": "DP2 French A: language and", "x": 199.6406166816406, "y": 326.66999121875006}, {"str": "literature SL&HL", "x": 199.6406166816406, "y": 313.91999175000007}, {"str": "P4 · 1:25 pm - 2:55 pm", "x": 199.6406166816406, "y": 301.1699922812501}, {"str": "DP2-Sport", "x": 199.6406166816406, "y": 271.9199935000001}, {"str": "P5 · 2:55 pm - 4:25 pm", "x": 199.6406166816406, "y": 259.1699940312501}, {"str": "DP2 Geography SL&HL", "x": 353.53123526953124, "y": 452.6699859687501}, {"str": "P1 · 8:00 am - 9:25 am", "x": 353.53123526953124, "y": 439.91998650000005}, {"str": "DP2 Physics SL&HL", "x": 353.53123526953124, "y": 410.66998771875006}, {"str": "P2 · 9:30 am - 10:55 am", "x": 353.53123526953124, "y": 397.9199882500001}, {"str": "DP2 English B HL", "x": 353.53123526953124, "y": 368.66998946875003}, {"str": "P3 · 10:55 am - 12:20 pm", "x": 353.53123526953124, "y": 355.9199900000001}, {"str": "DP2 - DEVOIR DE NIVEAU", "x": 353.53123526953124, "y": 326.66999121875006}, {"str": "P9 · 1:00 pm - 4:30 pm", "x": 353.53123526953124, "y": 313.91999175000007}, {"str": "DP2 Maths AA SL", "x": 507.4218538574218, "y": 452.6699859687501}, {"str": "P1 · 8:00 am - 9:30 am", "x": 507.4218538574218, "y": 439.91998650000005}, {"str": "DP2 French A: language and", "x": 507.4218538574218, "y": 410.66998771875006}, {"str": "literature SL&HL", "x": 507.4218538574218, "y": 397.9199882500001}, {"str": "P2 · 9:40 am - 11:10 am", "x": 507.4218538574218, "y": 385.16998878125}, {"str": "DP2 ESS SL", "x": 507.4218538574218, "y": 355.9199900000001}, {"str": "P3 · 11:10 am - 12:40 pm", "x": 507.4218538574218, "y": 343.16999053125005}, {"str": "DP2 Geography SL&HL", "x": 507.4218538574218, "y": 313.91999175000007}, {"str": "P5 · 2:55 pm - 4:25 pm", "x": 507.4218538574218, "y": 301.1699922812501}, {"str": "DP2 - Reiforcement (1)", "x": 507.4218538574218, "y": 271.9199935000001}, {"str": "P5 · 2:55 pm - 4:25 pm", "x": 507.4218538574218, "y": 259.1699940312501}, {"str": "DP2 Physics SL&HL", "x": 661.3124724453126, "y": 452.6699859687501}, {"str": "P1 · 8:00 am - 9:30 am", "x": 661.3124724453126, "y": 439.91998650000005}, {"str": "DP2 English B HL", "x": 661.3124724453126, "y": 410.66998771875006}, {"str": "P3 · 11:10 am - 12:40 pm", "x": 661.3124724453126, "y": 397.9199882500001}, {"str": "DP2 French A: language and", "x": 661.3124724453126, "y": 368.66998946875003}, {"str": "literature SL&HL", "x": 661.3124724453126, "y": 355.9199900000001}, {"str": "P4 · 1:25 pm - 2:55 pm", "x": 661.3124724453126, "y": 343.16999053125005}];
const res = context.emploiParseItems(ENTRAINEMENT);
ok(res.colonnes === 5, 'cinq colonnes de jours attendues, trouvé : ' + res.colonnes);
const attendus = [
    [0, 4], [1, 5], [2, 4], [3, 5], [4, 3], [5, 0], [6, 0]
];
attendus.forEach(function (a) {
    ok(res.jours[a[0]].length === a[1], 'jour ' + a[0] + ' : ' + a[1] + ' cours attendus, trouvé : ' + res.jours[a[0]].length + ' → ' + res.jours[a[0]].map(function (c) { return c.nom; }).join(' | '));
});
const lundi0 = res.jours[0][0] || {};
ok(lundi0.nom === 'DP2 Geography SL&HL' && lundi0.plage.debut === '08:00' && lundi0.plage.fin === '09:30',
    'premier cours de lundi : ' + JSON.stringify(lundi0));
ok(res.jours[0].every(function (c) { return c.nom.indexOf('Picture Day') === -1 && c.nom.indexOf('Special') === -1; }),
    'les événements de l\'école ne doivent pas devenir des cours');
const mardiFrancais = res.jours[1].filter(function (c) { return c.nom.indexOf('French') !== -1; })[0] || {};
ok(mardiFrancais.nom.indexOf('language and literature') !== -1 && mardiFrancais.plage.debut === '13:25',
    'nom sur deux lignes recollé : ' + JSON.stringify(mardiFrancais));
const mercrediDevoir = res.jours[2].filter(function (c) { return c.nom.indexOf('DEVOIR') !== -1; })[0] || {};
ok(mercrediDevoir.plage.debut === '13:00' && mercrediDevoir.plage.fin === '16:30',
    'après-midi pm : ' + JSON.stringify(mercrediDevoir));

/* les matières de l'élève sont reconnues dans les cours */
ok(context.emploiMatiereDe('DP2 Geography SL&HL') === 'Geography', 'Geography doit revenir au nom de l\'élève');
ok(context.emploiMatiereDe('DP2 Maths AA SL') === 'Maths AA', 'Maths AA doit être reconnu');
ok(context.emploiMatiereDe('DP2 - K4C') === '', 'K4C n\'est pas une matière de l\'élève');
ok(context.emploiNettoyerNom('DP2- Theory of knowledge') === 'Theory of knowledge', 'nettoyage du préfixe DP2');

/* le store garde les cours */
context.emploiScolaireEcrire({ at: 'x', jours: [[{ id: 'a1', nom: 'Maths AA', matiere: 'Maths AA', debut: '08:00', fin: '09:30' }], [], [], [], [], [], []] });
ok(context.emploiScolaireJour(0).length === 1 && context.emploiScolaireJour(1).length === 0, 'le store emploi du temps est mal lu');
ok(context.emploiScolaireActif() === true, 'emploiScolaireActif');
context.emploiScolaireVider();
ok(context.emploiScolaireActif() === false, 'vider le store emploi du temps');

/* le bouton Continuer referme la page et ouvre le planning ; le
   bouton Retour sait d'où l'élève vient */
var fauxModales = {};
context.document.getElementById = function (id) {
    if (!fauxModales[id]) {
        fauxModales[id] = { classList: {
            _etats: {},
            add: function (c) { this._etats[c] = 1; },
            remove: function (c) { delete this._etats[c]; },
            contains: function (c) { return !!this._etats[c]; }
        } };
    }
    return fauxModales[id];
};
var appelsPlanning = 0;
context.generatePlanning = function () { appelsPlanning++; };
context.devoirsBacADemander = function () { return false; };
context.__profilComplet = false;
context.document.getElementById('emploiModal'); /* crée le faux élément */
fauxModales.emploiModal.classList.add('active');
context.validateEmploiTemps();
ok(appelsPlanning === 1, 'Continuer doit construire le planning');
ok(!fauxModales.emploiModal.classList.contains('active'), 'Continuer doit fermer la page Emploi du temps (elle restait au-dessus du planning)');
var retoursLibre = 0;
context.goToFreeTime = function () { retoursLibre++; };
fauxModales.emploiModal.classList.add('active');
context.goBackFromEmploi();
ok(retoursLibre === 1 && appelsPlanning === 1, 'le Retour pendant l\'inscription ramène à Temps libre');
context.__profilComplet = true;
fauxModales.emploiModal.classList.add('active');
context.goBackFromEmploi();
ok(appelsPlanning === 2 && retoursLibre === 1, 'le Retour depuis le menu ramène au planning');
context.__profilComplet = false;

/* les heures creuses et leur travail */
const coursLundi = res.jours[0].map(function (c) { return { nom: c.nom, matiere: context.emploiMatiereDe(c.nom), debut: c.plage.debut, fin: c.plage.fin }; });
const trous = context.emploiScolaireTrous(coursLundi, 40);
ok(trous.length === 2, 'lundi doit avoir deux heures creuses (9h30-11h10 et 12h40-13h25), trouvé : ' + trous.length);
const trouMatin = trous.filter(function (t) { return t.debut === 9 * 60 + 30; })[0];
ok(trouMatin && trouMatin.fin === 11 * 60 + 10, 'le trou du matin : ' + JSON.stringify(trouMatin && { d: trouMatin.debut, f: trouMatin.fin }));
const trouMidi = context.emploiScolaireTrouMidi(coursLundi);
ok(trouMidi && trouMidi.debut === 12 * 60 + 40, 'le creux du midi : ' + JSON.stringify(trouMidi && { d: trouMidi.debut, f: trouMidi.fin }));
const blocsMatin = context.emploiScolaireBlocsTravail({ debut: 9 * 60 + 30, fin: 11 * 60 + 10, avant: coursLundi[1] }, { sujets: context.devoirsFamillesEleve ? [] : [], memoire: true, ia: false });
ok(blocsMatin.some(function (b) { return b.titre.indexOf('CAS') !== -1; }), 'un trou sans matière suivie reçoit du travail : ' + JSON.stringify(blocsMatin.map(function (b) { return b.titre; })));

/* ── 3. La chaîne complète du planning ────────────────────────────── */
const store2 = {};
const contexteMoteur = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    addEventListener: function () {}, removeEventListener: function () {},
    localStorage: {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store2, k) ? store2[k] : null; },
        setItem: function (k, v) { store2[k] = String(v); },
        removeItem: function (k) { delete store2[k]; }
    },
    document: {
        getElementById: function () { return null; },
        createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {}, remove: function () {}, classList: { add: function () {}, remove: function () {} } }; },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; },
        body: { appendChild: function () {}, classList: { add: function () {}, remove: function () {} } },
        addEventListener: function () {}
    },
    subjects: [{ name: 'Maths AA', level: 'SL', icon: '🔢' }, { name: 'Physique', level: 'SL', icon: '⚛️' }],
    optionalSubjects: [{ name: 'ESS', level: 'SL', icon: '🌱' }],
    ibYear: 'DP2',
    weekdayWakeup: '05:30', saturdayWakeup: '08:30', sundayWakeup: '09:00',
    weekdaySleepHours: 8, saturdaySleepHours: 8, sundaySleepHours: 8,
    allSubj: [], customEvents: [], selectedActivities: [], phoneTime: 0, phoneDays: [],
    holidayBypass: 0, holidayDays: [], holidayModes: {}, holidayDropped: {},
    COURS_DEBUT: 470, COURS_FIN: 985, COURS_FIN_MATIN: 750, transportMode: 'walking',
    carDeparture: '', carToSchool: 30, carFromSchool: 40, carReturnTime: '',
    motoDeparture: '', motoToSchool: 25, motoFromSchool: 25, motoReturn: '',
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
contexteMoteur.allSubj = contexteMoteur.subjects.concat(contexteMoteur.optionalSubjects);
contexteMoteur.window = contexteMoteur;
vm.createContext(contexteMoteur);
[fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'devoirs.js'), 'utf8'),
 fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'devoirs-moteur.js'), 'utf8'),
 emploiJs, moteurJs,
 fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'planning-base.js'), 'utf8'),
 planningMoteur].forEach(function (src, i) {
    vm.runInContext(src, contexteMoteur, { filename: 'moteur-' + i + '.js' });
});

/* lundi réel : les cours du document remplacent les créneaux génériques */
const lundiReel = res.jours[0].map(function (c, i) {
    return { id: 'l' + i, nom: context.emploiNettoyerNom(c.nom), matiere: context.emploiMatiereDe(c.nom), debut: c.plage.debut, fin: c.plage.fin };
});
contexteMoteur.emploiScolaireEcrire({ at: 'x', jours: [lundiReel, [], [], [], [], [], []] });
const jourGenere = contexteMoteur.generateDayEvents(0);
ok(!jourGenere.some(function (ev) { return ev.id === 'school1' || ev.id === 'school2'; }), 'plus de créneaux Cours génériques quand l\'emploi du temps est chargé');
const blocGeographie = jourGenere.filter(function (ev) { return ev.title === 'Geography'; })[0];
ok(blocGeographie && blocGeographie.startTime === '08:00' && blocGeographie.endTime === '09:30' && blocGeographie.kind === 'fixed',
    'le cours réel de Geography doit occuper 8h00-9h30 en fixe : ' + JSON.stringify(blocGeographie && { s: blocGeographie.startTime, e: blocGeographie.endTime }));
const dejeuner = jourGenere.filter(function (ev) { return ev.id === 'lunch'; })[0];
ok(dejeuner && dejeuner.startTime >= '12:40' && dejeuner.endTime <= '13:25',
    'le déjeuner doit se poser dans le creux du midi 12h40-13h25 : ' + JSON.stringify(dejeuner && { s: dejeuner.startTime, e: dejeuner.endTime }));
const travailMatin = jourGenere.filter(function (ev) { return String(ev.id).indexOf('emploi-') === 0; });
ok(travailMatin.length >= 1, 'le trou de 9h30-11h10 doit recevoir du travail, trouvé : ' + travailMatin.length);
ok(travailMatin.every(function (ev) { return ev.startTime >= '09:30' && ev.endTime <= '11:10'; }), 'le travail du matin doit rester dans le trou');
const trajets = jourGenere.filter(function (ev) { return ev.id === 'commute1' || ev.id === 'commute2'; });
ok(trajets.length === 2, 'les trajets encadrent la journée réelle');
const arrivee = trajets.filter(function (ev) { return ev.id === 'commute1'; })[0];
ok(arrivee && arrivee.endTime <= '08:00', 'le trajet école doit finir avant le premier cours');

/* les matières vues dans la journée nourrissent tout le programme du
   soir : révisions de la première matière vue, exercices de la science
   vue, puis la suite dans l'ordre */
const sujetsVusLundi = contexteMoteur.emploiScolaireSujets(0).map(function (s) { return s.name; });
ok(sujetsVusLundi.join(',') === 'ESS,Physique', 'lundi : les matières suivies vues ce jour-là, dans l\'ordre : ' + sujetsVusLundi.join(','));
const programmeLundi = contexteMoteur.emploiScolaireProgramme(0).map(function (s) { return s.name; });
ok(programmeLundi.join(',') === 'ESS,Physique,Maths AA', 'le programme de lundi : matières vues puis complément : ' + programmeLundi.join(','));
const revSoir = jourGenere.filter(function (ev) { return ev.id === 'study1'; })[0];
ok(revSoir && revSoir.title === 'Révisions ESS', 'le soir doit réviser la première matière vue dans la journée (ESS) : ' + (revSoir && revSoir.title));
const exoSoir = jourGenere.filter(function (ev) { return ev.id === 'exercises'; })[0];
ok(exoSoir && exoSoir.title === 'Exercices Physique', 'les exercices du soir prennent la science vue dans la journée : ' + (exoSoir && exoSoir.title));
const revSoir2 = jourGenere.filter(function (ev) { return ev.id === 'study2'; })[0];
ok(revSoir2 && revSoir2.title === 'Révisions Physique', 'la seconde révision du soir suit l\'ordre des matières vues : ' + (revSoir2 && revSoir2.title));

/* la signature des faits change avec l'emploi du temps */
vm.runInContext('emploiNePasSauver = 1; var js = []; for (var i = 0; i < 7; i++) js.push(emploiReconstruire(i)); emploiFige = { sig: emploiFaitsSignature(), at: new Date().toISOString(), jours: emploiCloner(js) }; emploiNePasSauver = 0;', contexteMoteur);
ok(contexteMoteur.emploiEstFige() === true, 'l\'emploi figé doit être valide');
contexteMoteur.emploiScolaireVider();
ok(contexteMoteur.emploiEstFige() === false, 'retirer l\'emploi du temps doit reconstruire le planning');

/* ── 4. Le week-end et le repli ────────────────────────────────────── */
/* le week-end : les matières de la semaine vues en classe passent avant
   le complément, et le repli sans emploi du temps est total */
contexteMoteur.emploiScolaireEcrire({ at: 'x', jours: [
    [{ id: 'w1', nom: 'Maths AA', matiere: 'Maths AA', debut: '08:00', fin: '09:30' }],
    [{ id: 'w2', nom: 'ESS', matiere: 'ESS', debut: '08:00', fin: '09:30' }],
    [], [], [], [], []
] });
const programmeSamedi = contexteMoteur.emploiScolaireProgramme(5).map(function (s) { return s.name; });
ok(programmeSamedi.join(',') === 'Maths AA,ESS,Physique', 'le programme du week-end : matières de l\'emploi du temps puis complément : ' + programmeSamedi.join(','));
const dimanche = contexteMoteur.generateDayEvents(6);
const revisionsDimanche = dimanche.filter(function (ev) { return /^Révisions/.test(String(ev.title || '')); });
ok(revisionsDimanche.length >= 2, 'le dimanche doit être rempli de révisions du programme : ' + revisionsDimanche.map(function (ev) { return ev.title; }).join(' | '));
ok(revisionsDimanche.some(function (ev) { return /Maths AA|ESS/.test(String(ev.title)); }),
    'le dimanche doit réviser une matière de l\'emploi du temps : ' + revisionsDimanche.map(function (ev) { return ev.title; }).join(' | '));
ok(revisionsDimanche.every(function (ev) { return programmeSamedi.indexOf(String(ev.title).replace(/^Révisions\s?·?\s?/, '')) !== -1; }),
    'toutes les révisions du dimanche viennent du programme (matières vues puis complément) : ' + revisionsDimanche.map(function (ev) { return ev.title; }).join(' | '));
contexteMoteur.emploiScolaireVider();
ok(contexteMoteur.emploiScolaireProgramme(0) === null, 'sans emploi du temps, le planning garde ses règles habituelles');

/* ── Bilan ─────────────────────────────────────────────────────────── */
if (echecs.length) {
    console.error('Emploi du temps scolaire : échecs ' + echecs.length);
    echecs.forEach(function (e) { console.error(' - ' + e); });
    process.exit(1);
}
console.log('ok emploi du temps scolaire : lecture du document (colonnes, am/pm, deux lignes, événements écartés), vrais cours au planning, déjeuner et travail dans les creux, question du bac après la page, reconstruction au changement, Continuer referme la page et ouvre le planning, les matières vues nourrissent tout le programme (soir, week-end, repli identique sans emploi)');
