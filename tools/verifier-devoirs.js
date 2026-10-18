#!/usr/bin/env node
/* ============================================================
   Vérificateur — Devoirs & Examens
   1. La page existe, le menu la place sous Mes Exercices, la
      navigation l'atteint, les scripts se chargent, l'OCR embarqué
      est complet.
   2. Le lecteur de texte décode dates, heures et matières (français).
   3. Le moteur adapte le planning :
      - un devoir devient un bloc fixe à ses heures, et ce qui
        chevauche est retiré ou raccourci ;
      - la semaine avant les examens : révisions et exercices sur les
        matières à examiner, plus aucun CAS, mémoire ni éval interne ;
      - la semaine des examens : l'épreuve à ses heures, et une
        matière composée n'est plus jamais révisée ;
      - sans examen proche : les révisions des devoirs se posent dans
        les moments libres.
   4. Le bac national (DP2) découpe le vendredi et occupe le samedi.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const echecs = [];
function ok(cond, message) { if (!cond) echecs.push(message); }

/* ── 1. Statique ───────────────────────────────────────────────────── */
const planning = fs.readFileSync(path.join(__dirname, '..', 'pages', 'planning.html'), 'utf8');
const devoirsHtml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'devoirs.html'), 'utf8');
const nav = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'navigation.js'), 'utf8');
const registre = fs.readFileSync(path.join(__dirname, '..', 'js', 'registre.js'), 'utf8');
const moteur = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'planning-moteur.js'), 'utf8');
const boot = fs.readFileSync(path.join(__dirname, '..', 'js', 'boot.js'), 'utf8');
const matieres = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'onboarding-matieres.js'), 'utf8');

ok(devoirsHtml.indexOf('id="panelDevoirs"') !== -1, 'le panneau Devoirs et Examens manque');
ok(planning.indexOf('Devoirs et Examens') !== -1, 'le bouton du menu manque');
ok(planning.indexOf('Devoirs et Examens') > planning.indexOf('Mes Exercices'), 'Devoirs et Examens doit venir après Mes Exercices dans le menu');
ok(planning.indexOf('Devoirs et Examens') < planning.indexOf('EE &amp; IA'), 'Devoirs et Examens doit venir avant EE & IA dans le menu');
ok(nav.indexOf("page === 'devoirs'") !== -1, 'la navigation ne connaît pas la page devoirs');
ok(registre.indexOf('pages/devoirs.html') !== -1, 'la page devoirs.html n\'est pas enregistrée');
ok(registre.indexOf('js/pages/devoirs.js') !== -1, 'le script devoirs.js n\'est pas enregistré');
ok(registre.indexOf('js/pages/devoirs-moteur.js') !== -1, 'le script devoirs-moteur.js n\'est pas enregistré');
ok(registre.indexOf('js/pages/devoirs-moteur.js') < registre.indexOf('js/pages/planning-moteur.js'), 'devoirs-moteur.js doit se charger avant planning-moteur.js');
['lib/ocr/tesseract.min.js', 'lib/ocr/worker.min.js', 'lib/ocr/tesseract-core-simd-lstm.wasm.js', 'lib/ocr/tesseract-core-lstm.wasm.js', 'lib/ocr/langs/fra.traineddata.gz'].forEach(function (f) {
    ok(fs.existsSync(path.join(__dirname, '..', f)), 'OCR embarqué incomplet : ' + f);
});
/* Le worker importe les colles « .wasm.js » (wasm embarqué en base64) :
   elles doivent être assez grosses pour contenir le moteur. */
['lib/ocr/tesseract-core-simd-lstm.wasm.js', 'lib/ocr/tesseract-core-lstm.wasm.js'].forEach(function (f) {
    var taille = fs.statSync(path.join(__dirname, '..', f)).size;
    ok(taille > 3000000, 'la colle OCR semble tronquée (' + taille + ' octets) : ' + f);
});
ok(moteur.indexOf('bac-vendredi') !== -1, 'le vendredi du bac national manque');
ok(moteur.indexOf('bac-samedi') !== -1, 'le samedi du bac national manque');
ok(moteur.indexOf("fixed('bac-samedi', 'Bac national', '8h00 → 13h00', '08:00', '13:00'") !== -1, 'le samedi du bac doit être 8h00 → 13h00');
ok(moteur.indexOf("fixed('bac-vendredi', 'Bac national', '14h55 → 16h25', '14:55', '16:25'") !== -1, 'le vendredi du bac doit être 14h55 → 16h25');
ok(moteur.indexOf("fixed('school2', 'Cours', '13h30 → 14h55'") !== -1, 'le vendredi du bac doit couper les cours à 14h55');
ok(moteur.indexOf('dayIndex === 4 && typeof devoirsFaitBac === \'function\' && devoirsFaitBac()') !== -1, 'la découpe du vendredi ne doit toucher que les élèves du bac');
ok(moteur.indexOf('if (reveilSamedi > 7 * 60) wakeupTime = \'07:00\';') !== -1, 'le samedi du bac doit lever l\'élève au plus tard à 7h00');
ok(moteur.indexOf('calculateBedtime(wakeupTime, heuresSamedi)') !== -1, 'le coucher du samedi du bac doit suivre le réveil (jamais moins de 5 h de sommeil)');
ok(moteur.indexOf('if (!(typeof devoirsFaitBac === \'function\' && devoirsFaitBac())) return false;') !== -1, 'le cours d\'économie du samedi ne doit disparaître que pour les élèves du bac');
ok(moteur.indexOf('devoirsAdapterJour') !== -1, 'le planning n\'appelle pas l\'adaptateur devoirs');
ok(boot.indexOf('devoirsPoserQuestionBac') !== -1, 'le popup du bac pour les DP2 déjà inscrits manque');
ok(matieres.indexOf('devoirsPoserQuestionBac') !== -1, 'la question du bac après les matières manque');
ok(fs.readFileSync(path.join(__dirname, '..', 'js', 'memoire.js'), 'utf8').indexOf('devoirsStoreCompact') !== -1, 'le store devoirs ne voyage pas avec le compte');

/* ── 2 et 3. Dans une machine virtuelle ───────────────────────────── */
const store = {};
const context = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    setTimeout: setTimeout,
    document: {
        getElementById: function () { return null; },
        createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; },
        body: { appendChild: function () {} },
        addEventListener: function () {}
    },
    localStorage: {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
    },
    subjects: [{ name: 'Mathématiques AA', level: 'HL', icon: '🔢' }, { name: 'Physique', level: 'HL', icon: '⚛️' }],
    optionalSubjects: [{ name: 'Histoire', level: 'SL', icon: '🌍' }],
    ibYear: 'DP2',
    weekdayWakeup: '05:30',
    saturdayWakeup: '08:30',
    sundayWakeup: '09:00'
};
/* Date figée pour des tests reproductibles : dimanche 18 octobre 2026,
   10h30. La semaine affichée va du lundi 12 au dimanche 18. */
const VRAIE_DATE = Date;
const FIXE = new VRAIE_DATE(2026, 9, 18, 10, 30, 0).getTime();
class DateFigee extends VRAIE_DATE {
    constructor(...args) {
        if (args.length === 0) super(FIXE);
        else super(...args);
    }
    static now() { return FIXE; }
}
context.Date = DateFigee;
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'devoirs.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'devoirs-moteur.js'), 'utf8'), context);

/* — 2. Le lecteur de texte — */
const texte = [
    'PLANNING DES DEVOIRS',
    'Mathématiques AA — 23/10, 8h00 à 13h00',
    'Physique : 24/10 8h - 10h',
    'Philosophie 08h00-13h00',
    'Chimie le 25 octobre de 14h55 à 16h25'
].join('\n');
const propositions = context.devoirsParserTexte(texte);
ok(propositions.length === 4, 'le lecteur doit trouver 4 créneaux, trouvé : ' + propositions.length);
const p0 = propositions[0] || {};
ok(p0.matiere === 'Mathématiques AA', 'matière 1 : ' + p0.matiere);
ok(p0.date === '2026-10-23', 'date 1 : ' + p0.date);
ok(p0.debut === '08:00' && p0.fin === '13:00', 'heures 1 : ' + p0.debut + '-' + p0.fin);
const p2 = propositions[2] || {};
ok(p2.matiere === 'Philosophie', 'matière 3 : ' + p2.matiere);
ok(p2.date === (propositions[1] || {}).date, 'la date de la ligne précédente doit servir de contexte');
const p3 = propositions[3] || {};
ok(p3.date === '2026-10-25', 'date en toutes lettres : ' + p3.date);
ok(p3.debut === '14:55' && p3.fin === '16:25', 'heures en toutes lettres : ' + p3.debut + '-' + p3.fin);

/* — 3a0. La découpe des chevauchements, directement — */
const jourSimple = [
    { id: 'prep', title: 'Préparation', startTime: '05:30', endTime: '06:00', type: 'prep' },
    { id: 'school1', title: 'Cours', startTime: '07:50', endTime: '12:30', type: 'school' },
    { id: 'plage', title: 'Étude perso', startTime: '09:00', endTime: '11:00', type: 'study' },
    { id: 'lunch', title: 'Déjeuner', startTime: '12:30', endTime: '13:30', type: 'meal' },
    { id: 'dinner', title: 'Dîner', startTime: '19:00', endTime: '19:45', type: 'meal' }
];
const decoupe = context.devoirsPoserBloc(jourSimple.slice(), { id: 'devoir-t', titre: 'Devoir · Test', debut: '08:00', fin: '13:00' });
const blocT = decoupe.filter(function (ev) { return ev.id === 'devoir-t'; })[0];
ok(blocT && blocT.startTime === '08:00' && blocT.endTime === '13:00' && blocT.kind === 'fixed', 'le bloc posé doit être fixe et à ses heures');
ok(!decoupe.some(function (ev) { return ev.id === 'plage'; }), 'un créneau entièrement chevauché doit disparaître');
ok(!decoupe.some(function (ev) { return ev.id === 'school1'; }), 'un cours presque chevauché (10 min restants) doit disparaître');
const lunchApres = decoupe.filter(function (ev) { return ev.id === 'lunch'; })[0];
ok(lunchApres && lunchApres.startTime === '13:00' && lunchApres.endTime === '13:30', 'le déjeuner doit être raccourci à 13h00 → 13h30, trouvé : ' + (lunchApres ? lunchApres.startTime + '-' + lunchApres.endTime : 'rien'));

/* — 3a. Un devoir : révision la veille, bloc le jour J — */
/* Aujourd'hui (figé) : dimanche 18 octobre. Devoir demain lundi 19. */
const cleJour = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
const aujourdhui = new Date();
const demain = new Date(aujourdhui.getTime() + 86400000);
context.devoirsEcrireStore({ bac: true, devoirs: [{ id: 'd1', matiere: 'Physique', date: cleJour(demain), debut: '08:00', fin: '13:00' }], examens: [] });

const idxJour = (aujourdhui.getDay() + 6) % 7;
const apresDevoir = context.devoirsAdapterJour(jourSimple.slice(), idxJour);
const revisionsDemain = apresDevoir.filter(function (ev) { return ev.devoirsBloc && String(ev.title).indexOf('Révision · Physique') !== -1; });
ok(revisionsDemain.length >= 1, 'aucune révision posée la veille du devoir');
ok(revisionsDemain.length <= 2, 'au plus deux révisions de devoir par jour, trouvé : ' + revisionsDemain.length);
ok(apresDevoir.every(function (ev) { return !ev.devoirsBloc || String(ev.title).indexOf('Devoir') === -1; }), 'le devoir ne doit pas apparaître avant sa date');

/* — 3b. La semaine avant les examens — */
/* Mercredi 21 (dans 3 jours) et vendredi 23 : aujourd'hui dimanche 18
   est dans la semaine de révision. */
const dans3Jours = new Date(aujourdhui.getTime() + 3 * 86400000);
context.devoirsEcrireStore({
    bac: false,
    devoirs: [],
    examens: [
        { id: 'x1', matiere: 'Mathématiques AA', date: cleJour(dans3Jours), debut: '08:00', fin: '13:00' },
        { id: 'x2', matiere: 'Histoire', date: cleJour(new Date(aujourdhui.getTime() + 5 * 86400000)), debut: '08:00', fin: '10:00' }
    ]
});
const jourAvecTout = jourSimple.concat([
    { id: 'study1', title: 'Révisions Chimie', startTime: '14:00', endTime: '15:30', type: 'study' },
    { id: 'memoir-page', title: 'Mémoire', startTime: '16:00', endTime: '16:40', type: 'memoir' },
    { id: 'ia-page-x', title: 'Évaluation interne', startTime: '17:00', endTime: '17:40', type: 'ia' },
    { id: 'activity-Foot', title: 'Foot', startTime: '18:00', endTime: '19:00', type: 'activity' }
]);
const apresRevision = context.devoirsAdapterJour(jourAvecTout.slice(), idxJour);
ok(!apresRevision.some(function (ev) { return ev.type === 'memoir' || ev.type === 'ia' || ev.type === 'activity'; }), 'la semaine de révisions doit retirer mémoire, éval interne et CAS');
ok(!apresRevision.some(function (ev) { return ev.id === 'study1'; }), 'les blocs d\'étude habituels doivent laisser la place aux révisions ciblées');
const ciblees = apresRevision.filter(function (ev) { return ev.devoirsBloc && /Révision|Exercices/.test(String(ev.title)); });
ok(ciblees.length >= 2, 'au moins deux révisions ciblées attendues, trouvé : ' + ciblees.length);
ok(ciblees.every(function (ev) { return /Mathématiques AA|Histoire/.test(String(ev.title)); }), 'les révisions ne portent que sur les matières à examiner');
const ordreProximite = ciblees.map(function (ev) { return String(ev.title).indexOf('Mathématiques AA') !== -1 ? 'M' : 'H'; }).join('');
ok(ordreProximite.indexOf('M') === 0, 'la matière examinée en premier doit être révisée en premier : ' + ordreProximite);

/* — 3c. Une matière composée n'est plus jamais révisée — */
/* Chimie composée hier (samedi 17), Mathématiques à venir demain
   (lundi 19). Aujourd'hui, on révise les Maths, plus la Chimie. */
const hier = new Date(aujourdhui.getTime() - 86400000);
context.devoirsEcrireStore({
    bac: false,
    devoirs: [],
    examens: [
        { id: 'xp', matiere: 'Chimie', date: cleJour(hier), debut: '08:00', fin: '13:00' },
        { id: 'x1', matiere: 'Mathématiques AA', date: cleJour(demain), debut: '08:00', fin: '13:00' }
    ]
});
const apresSemaineExamens = context.devoirsAdapterJour(jourSimple.slice(), idxJour);
ok(!apresSemaineExamens.some(function (ev) { return String(ev.title).indexOf('Chimie') !== -1; }), 'la matière déjà composée ne doit plus être révisée');
const restantes = apresSemaineExamens.filter(function (ev) { return ev.devoirsBloc; });
ok(restantes.some(function (ev) { return String(ev.title).indexOf('Mathématiques AA') !== -1; }), 'la matière à venir doit être révisée');

/* — 3c2. Le jour de l'épreuve, l'examen est posé à ses heures — */
/* Examen de Mathématiques aujourd'hui (dimanche 18) de 14h00 à 17h00 :
   l'après-midi du jour figé. */
context.devoirsEcrireStore({
    bac: false, devoirs: [],
    examens: [{ id: 'xj', matiere: 'Mathématiques AA', date: cleJour(aujourdhui), debut: '14:00', fin: '17:00' }]
});
const jourExamen = context.devoirsAdapterJour(jourSimple.slice(), idxJour);
const blocExamen = jourExamen.filter(function (ev) { return ev.id === 'exam-xj'; })[0];
ok(blocExamen, 'le bloc de l\'examen manque le jour de l\'épreuve');
if (blocExamen) {
    ok(blocExamen.startTime === '14:00' && blocExamen.endTime === '17:00', 'heures de l\'examen : ' + blocExamen.startTime + '-' + blocExamen.endTime);
    ok(String(blocExamen.title).indexOf('Examen · Mathématiques AA') !== -1, 'titre de l\'examen : ' + blocExamen.title);
    ok(blocExamen.kind === 'fixed', 'l\'examen doit être un créneau fixe');
}
/* le dîner (19h) reste, le déjeuner (12h30) reste : pas de chevauchement */
ok(jourExamen.some(function (ev) { return ev.id === 'lunch' && ev.id === 'dinner'; }) || (jourExamen.some(function (ev) { return ev.id === 'lunch'; }) && jourExamen.some(function (ev) { return ev.id === 'dinner'; })), 'les repas hors de l\'épreuve doivent rester');

/* — 3d. Après la dernière épreuve, le planning redevient normal — */
const ilYADeuxSemaines = new Date(aujourdhui.getTime() - 14 * 86400000);
context.devoirsEcrireStore({
    bac: false, devoirs: [],
    examens: [{ id: 'xv', matiere: 'Chimie', date: cleJour(ilYADeuxSemaines), debut: '08:00', fin: '13:00' }]
});
const apresFini = context.devoirsAdapterJour(jourAvecTout.slice(), idxJour);
ok(apresFini.some(function (ev) { return ev.id === 'study1'; }), 'après les examens, les blocs d\'étude habituels reviennent');
ok(apresFini.some(function (ev) { return ev.type === 'memoir'; }), 'après les examens, le mémoire revient');

/* — bac national : la question et le réglage — */
context.devoirsEcrireStore({ bac: null, devoirs: [], examens: [] });
ok(context.devoirsFaitBac() === false, 'sans réponse, le bac n\'est pas actif');
context.devoirsEcrireStore({ bac: true, devoirs: [], examens: [] });
ok(context.devoirsFaitBac() === true, 'la réponse « oui » active le bac');

/* — le bac national : le samedi — */
const samediEco = [
    { id: 'wakeup', title: 'Réveil', startTime: '07:00', endTime: '07:10', type: 'wakeup' },
    { id: 'eco', title: 'Cours d\'économie', startTime: '08:00', endTime: '10:00', type: 'school' },
    { id: 'study1', title: 'Révisions', startTime: '15:00', endTime: '16:30', type: 'study' }
];
const samediBac = context.devoirsAdapterJour(samediEco.slice(), 5);
ok(!samediBac.some(function (ev) { return ev.id === 'eco'; }), 'le samedi du bac national, le cours d\'économie disparaît');
ok(samediBac.some(function (ev) { return ev.id === 'study1'; }), 'le reste du samedi reste en place');
const dimancheBac = context.devoirsAdapterJour(samediEco.slice(), 6);
ok(dimancheBac.some(function (ev) { return ev.id === 'eco'; }), 'un autre jour que le samedi garde le cours');
context.devoirsEcrireStore({ bac: false, devoirs: [], examens: [] });
const samediSansBac = context.devoirsAdapterJour(samediEco.slice(), 5);
ok(samediSansBac.some(function (ev) { return ev.id === 'eco'; }), 'sans le bac, le cours d\'économie du samedi reste');

/* — le voyage avec le compte Google — */
context.devoirsEcrireStore({
    bac: true,
    devoirs: [{ id: 'd9', matiere: 'Philosophie', date: '2026-10-20', debut: '08:00', fin: '13:00' }],
    examens: [{ id: 'x9', matiere: 'Chimie', date: '2026-10-22', debut: '08:00', fin: '10:00' }]
});
const compact = context.devoirsStoreCompact();
ok(compact && compact.bac === true, 'le store compact perd le réglage du bac');
ok(compact && Array.isArray(compact.devoirs) && compact.devoirs.length === 1 && compact.devoirs[0].matiere === 'Philosophie', 'le store compact perd les devoirs');
ok(compact && Array.isArray(compact.examens) && compact.examens.length === 1 && compact.examens[0].date === '2026-10-22', 'le store compact perd les examens');

/* ── Bilan ─────────────────────────────────────────────────────────── */
if (echecs.length) {
    console.error('Devoirs & Examens : échecs ' + echecs.length);
    echecs.forEach(function (e) { console.error(' - ' + e); });
    process.exit(1);
}
console.log('ok devoirs et examens : OCR, parser, compositions, semaines de révision et d\u2019examens, bac national');
