#!/usr/bin/env node
/* ============================================================
   Vérificateur — Devoirs & Examens
   1. La page existe, le menu la place sous Mes Exercices, la
      navigation l'atteint, les scripts se chargent, l'OCR embarqué
      est complet.
   2. Le lecteur de texte décode dates, heures et matières (français) :
      un programme de devoirs pour le trimestre se lit aussi — des
      mercredis, une ou plusieurs matières, avec ou sans heures.
   3. Le moteur adapte le planning :
      - un devoir devient un bloc fixe à ses heures, et ce qui
        chevauche est retiré ou raccourci ;
      - le créneau « DEVOIR DE NIVEAU » de l'emploi du temps disparaît
        le jour du devoir : sa place va au(x) devoir(s) réel(s), aux
        heures du document ou, sans heures, partagé entre eux ;
      - les séances de révision choisies par l'élève sont garanties :
        ce que les moments libres n'ont pas accueilli prend la place
        des blocs d'étude du jour (jamais cours, repas, sommeil,
        trajets, téléphone) ;
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
const devoirsSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'devoirs.js'), 'utf8');
const moteurSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'devoirs-moteur.js'), 'utf8');

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
/* le réglage du bac n'est plus sur la page Devoirs (retiré sur demande) :
   la question passe par le popup, une seule fois */
ok(devoirsHtml.indexOf('devoirsReglageBac') === -1, 'la zone de réglage du bac doit avoir disparu de la page');
ok(fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'devoirs.js'), 'utf8').indexOf('devoirsBasculerBac') === -1, 'le bouton de réglage du bac doit avoir disparu');
/* les PDF téléchargés s'ouvrent aussi */
ok(devoirsHtml.indexOf('accept="image/*,application/pdf,.pdf"') !== -1, 'le sélecteur de fichiers doit accepter les PDF');
['lib/pdf/pdf.min.js', 'lib/pdf/pdf.worker.min.js'].forEach(function (f) {
    ok(fs.existsSync(path.join(__dirname, '..', f)), 'lecteur de PDF manquant : ' + f);
});
const devoirsSrcComplet = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'devoirs.js'), 'utf8');
ok(devoirsSrcComplet.indexOf('lib/pdf/pdf.min.js') !== -1, 'le lecteur de PDF n\'est pas câblé');
ok(devoirsSrcComplet.indexOf('devoirsBacADemander') !== -1, 'la règle de re-demande du popup manque');
ok(boot.indexOf('devoirsBacADemander') !== -1 && boot.indexOf('tenterBac') !== -1, 'le popup doit repasser pour tous les DP2 déjà connectés');
ok(moteur.indexOf('if (reveilSamedi > 7 * 60) wakeupTime = \'07:00\';') !== -1, 'le samedi du bac doit lever l\'élève au plus tard à 7h00');
ok(moteur.indexOf('calculateBedtime(wakeupTime, heuresSamedi)') !== -1, 'le coucher du samedi du bac doit suivre le réveil (jamais moins de 5 h de sommeil)');
/* le cours d'économie du samedi est retiré pour TOUS les élèves :
   plus aucune condition bac dans le détecteur */
var sectionEco = moteur.slice(moteur.indexOf('function coursEconomieSamedi'), moteur.indexOf('function annoterPlages'));
ok(sectionEco.indexOf('devoirsFaitBac') === -1, 'le cours d\'économie du samedi ne doit plus dépendre du bac : retiré pour tous');
ok(moteurSrc.indexOf('if (Number(dayIndex) === 5) {') !== -1, 'le retrait du samedi doit être inconditionnel dans l\'adaptateur');
ok(moteur.indexOf('devoirsAdapterJour') !== -1, 'le planning n\'appelle pas l\'adaptateur devoirs');
ok(boot.indexOf('devoirsPoserQuestionBac') !== -1, 'le popup du bac pour les DP2 déjà inscrits manque');
/* La question du bac vient maintenant juste après la page d'insertion
   de l'emploi du temps scolaire (plus après les matières). */
var emploiSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'emploi-temps.js'), 'utf8');
ok(emploiSrc.indexOf('devoirsPoserQuestionBac') !== -1 && emploiSrc.indexOf('validateEmploiTemps') !== -1,
    'la question du bac doit venir juste après la page de l\'emploi du temps scolaire');
ok(matieres.indexOf('devoirsPoserQuestionBac') === -1, 'la question du bac ne doit plus être après les matières');
ok(fs.readFileSync(path.join(__dirname, '..', 'js', 'memoire.js'), 'utf8').indexOf('devoirsStoreCompact') !== -1, 'le store devoirs ne voyage pas avec le compte');
ok(moteurSrc.indexOf('devoirsEstCreneauDevoir') !== -1 && moteurSrc.indexOf('devoirsDecouperCreneau') !== -1, 'le remplacement du créneau de devoirs manque au moteur');
ok(moteurSrc.indexOf('devoirsGarantirSeances') !== -1 && moteurSrc.indexOf('devoirsBlocConvertible') !== -1, 'la garantie des séances manque au moteur');
ok(devoirsSrc.indexOf('devoirsRemplirCreneaux') !== -1 && devoirsSrc.indexOf("if (genre === 'devoirs') devoirsRemplirCreneaux") !== -1, 'les propositions sans heures ne reçoivent pas celles du créneau');
ok(devoirsSrc.indexOf('devoirsEditerSeances') !== -1, 'les séances doivent pouvoir se modifier depuis la liste des devoirs');
ok(devoirsSrc.indexOf('devoirsAppliquerSeances') !== -1, 'le choix de séances doit s\'appliquer à toute la fournée');

/* L'analyse des documents (OCR des devoirs et de l'emploi du temps)
   est ouverte à TOUS les élèves : elle se passe entièrement dans le
   navigateur, sans compte, sans session, sans statut admin. Aucune
   évolution ne doit jamais la conditionner. */
var emploiHtmlVerif = fs.readFileSync(path.join(__dirname, '..', 'pages', 'emploi-temps.html'), 'utf8');
['boiteEstAdmin', 'annonceEstAdmin', 'tutorielEstAdmin', 'BOITE_ADMINS', 'boiteNom', 'compteSession', 'googleNom'].forEach(function (jeton) {
    ok(devoirsSrcComplet.indexOf(jeton) === -1, 'la lecture des devoirs ne doit dépendre d\'aucun compte (' + jeton + ')');
    ok(emploiSrc.indexOf(jeton) === -1, 'la lecture de l\'emploi du temps ne doit dépendre d\'aucun compte (' + jeton + ')');
});
ok(devoirsHtml.indexOf('onchange="devoirsLireDocument()"') !== -1 && devoirsHtml.indexOf('>Lire le document</button>') !== -1, 'le bouton de lecture des devoirs doit être posé sans condition');
ok(emploiHtmlVerif.indexOf('onchange="emploiLireDocument()"') !== -1 && emploiHtmlVerif.indexOf('>Lire le document</button>') !== -1, 'le bouton de lecture de l\'emploi du temps doit être posé sans condition');
ok(devoirsSrcComplet.indexOf('lib/ocr/tesseract.min.js') !== -1 && emploiSrc.indexOf('devoirsChargerTesseract') !== -1, 'le lecteur OCR doit rester embarqué dans le site, identique pour tous');

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
    optionalSubjects: [{ name: 'Histoire', level: 'SL', icon: '🌍' }, { name: 'ESS', level: 'SL', icon: '🌱' }],
    ibYear: 'DP2',
    weekdayWakeup: '05:30',
    saturdayWakeup: '08:30',
    sundayWakeup: '09:00'
};
/* Date figée pour des tests reproductibles : mercredi 14 octobre 2026,
   10h30. La semaine affichée va du lundi 12 au dimanche 18 — il reste
   des jours futurs dans la semaine, comme en vrai usage. */
const VRAIE_DATE = Date;
const FIXE = new VRAIE_DATE(2026, 9, 14, 10, 30, 0).getTime();
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

/* — 2. Le lecteur de texte, avec les matières de l'élève — */
/* l'élève de test suit : Mathématiques AA, Physique, Histoire, ESS.
   Philosophie, Chimie, Anglais, Géographie, Économie : non suivies. */
const texte = [
    'PLANNING DES DEVOIRS',
    'Mathématiques AA — 23/10, 8h00 à 13h00',
    'Physique : 24/10 8h - 10h',
    'Philosophie 08h00-13h00',
    'Chimie le 25 octobre de 14h55 à 16h25',
    'ESS le 27 octobre, 13h25 à 14h55',
    'Mathematics 08h00-13h00'
].join('\n');
const propositions = context.devoirsParserTexte(texte);
ok(propositions.length === 4, 'le lecteur doit trouver 4 créneaux (les matières non suivies ignorées), trouvé : ' + propositions.length + ' : ' + JSON.stringify(propositions.map(function (x) { return x.matiere; })));
const p0 = propositions[0] || {};
ok(p0.matiere === 'Mathématiques AA', 'matière 1 : ' + p0.matiere);
ok(p0.date === '2026-10-23', 'date 1 : ' + p0.date);
ok(p0.debut === '08:00' && p0.fin === '13:00', 'heures 1 : ' + p0.debut + '-' + p0.fin);
ok(propositions.filter(function (x) { return x.matiere === 'Philosophie' || x.matiere === 'Chimie'; }).length === 0, 'les matières non suivies ne doivent jamais être proposées');
const p2 = propositions[2] || {};
ok(p2.matiere === 'ESS' && p2.date === '2026-10-27' && p2.debut === '13:25' && p2.fin === '14:55', 'date et heures en toutes lettres : ' + JSON.stringify(p2));
const p3 = propositions[3] || {};
ok(p3.matiere === 'Mathématiques AA', 'le nom anglais (Mathematics) doit revenir au nom de l\'élève : ' + p3.matiere);
ok(p3.date === '2026-10-27', 'la date de la ligne précédente doit servir de contexte : ' + p3.date);
ok(p3.debut === '08:00' && p3.fin === '13:00', 'heures après nom anglais : ' + p3.debut + '-' + p3.fin);

/* une matière non suivie : jamais proposée, même complète */
ok(context.devoirsParserTexte('Anglais — 30/10, 8h00 à 10h00').length === 0, 'une matière non suivie ne doit pas être proposée');
/* ni ses heures dans un bloc de tableau */
ok(context.devoirsParserTexte(['30/10/2026', '13:00 – 15:00', 'Economics', 'Paper 1 - SL', '01h 30 min'].join('\n')).length === 0,
    'les heures d\'une matière non suivie ne doivent pas être proposées non plus');
/* sans profil (élève pas encore inscrit), toutes les matières restent proposables */
var subjectsSauves = context.subjects, optionnellesSauvees = context.optionalSubjects;
context.subjects = [];
context.optionalSubjects = [];
var propsSansProfil = context.devoirsParserTexte('Philosophie — 30/10, 8h00 à 10h00');
ok(propsSansProfil.length === 1 && propsSansProfil[0].matiere === 'Philosophie', 'sans profil, la matière reste proposable');
context.subjects = subjectsSauves;
context.optionalSubjects = optionnellesSauvees;

/* — 2bis. Chaque élève a ses propres matières — */
/* Le même document est présenté à trois élèves différents : chacun ne
   doit recevoir que les créneaux de ses matières, à ses propres noms. */
const docCommun = ['12/11/2026', '13:00 – 15:00', '15:00 – 16:30', 'Mathematics', 'Economics', 'Paper 1 - SL', '01h 30 min'].join('\n');
/* élève A (celui du harnais) : Mathématiques AA, Physique, Histoire, ESS */
var propsA = context.devoirsParserTexte(docCommun);
ok(propsA.length === 1 && propsA[0].matiere === 'Mathématiques AA' && propsA[0].debut === '13:00',
    'élève A (Maths AA) : seule sa matière, à son nom, trouvé : ' + JSON.stringify(propsA.map(function (x) { return x.matiere; })));
/* élève B : Économie et Philosophie */
var sujetsA = context.subjects, optionnelsA = context.optionalSubjects;
context.subjects = [{ name: 'Économie', level: 'HL', icon: '💹' }];
context.optionalSubjects = [{ name: 'Philosophie', level: 'SL', icon: '🤔' }];
var propsB = context.devoirsParserTexte(docCommun);
ok(propsB.length === 1 && propsB[0].matiere === 'Économie' && propsB[0].debut === '13:00',
    'élève B (Économie) : le même document ne lui propose que l\'Économie, trouvé : ' + JSON.stringify(propsB.map(function (x) { return x.matiere; })));
/* élève C : ni Maths ni Économie */
context.subjects = [{ name: 'Musique', level: 'HL', icon: '🎵' }];
context.optionalSubjects = [];
var propsC = context.devoirsParserTexte(docCommun);
ok(propsC.length === 0, 'élève C (aucune des deux matières) : aucune proposition, trouvé : ' + propsC.length);
/* la liste de saisie manuelle suit aussi l'élève courant */
context.subjects = sujetsA;
context.optionalSubjects = optionnelsA;
ok(context.devoirsMatieresEleve().length === 4, 'les matières de l\'élève A doivent revenir après restauration, trouvé : ' + context.devoirsMatieresEleve().length);

/* — 2ter. Les plannings en tableau (date, heures, matières, papiers) — */
const texteTableau = [
    'ÉPREUVES DU TRIMESTRE',
    '12/11/2026',
    '13:00 – 15:00',
    '15:00 – 16:30',
    'Histoire - Géographie',
    'Anglais A, B',
    'Paper 1 - SL',
    'Paper 1 - SL & HL',
    '01h 30 min',
    '01h 30 min',
    'DURAND / COMPAORE',
    '19/11/2026',
    '13:00 – 15:00',
    'Mathematics',
    'Paper 1 - SL & HL',
    '01h 30 min'
].join('\n');
const propsTableau = context.devoirsParserTexte(texteTableau);
ok(propsTableau.length === 2, 'le tableau doit donner 2 créneaux (Anglais non suivi), trouvé : ' + propsTableau.length + ' : ' + JSON.stringify(propsTableau.map(function (x) { return x.matiere; })));
const t0 = propsTableau[0] || {}, t1 = propsTableau[1] || {};
ok(t0.matiere === 'Histoire' && t0.date === '2026-11-12' && t0.debut === '13:00' && t0.fin === '15:00',
    'ligne 1 du tableau (Géographie non suivie, Histoire suivie) : ' + JSON.stringify(t0));
ok(t1.matiere === 'Mathématiques AA' && t1.date === '2026-11-19' && t1.debut === '13:00' && t1.fin === '15:00',
    'ligne 3 du tableau, au nom de l\'élève : ' + JSON.stringify(t1));
ok(propsTableau.every(function (x) { return x.matiere !== 'Anglais'; }), 'la ligne d\'Anglais (non suivi) ne doit pas être proposée');

/* l'après-midi à l'anglaise */
const propsAmPm = context.devoirsParserTexte('ESS : lundi, 1:25 pm - 2:55 pm');
ok(propsAmPm.length === 1 && propsAmPm[0].debut === '13:25' && propsAmPm[0].fin === '14:55' && propsAmPm[0].matiere === 'ESS',
    'heures am/pm : ' + JSON.stringify(propsAmPm[0] || {}));

/* la re-demande du popup : tout DP2 déjà connecté doit le revoir une fois */
context.devoirsEcrireStore({ bac: true, devoirs: [], examens: [] });
ok(context.devoirsBacADemander() === true, 'une réponse d\'avant la correction doit déclencher le popup à nouveau');
context.devoirsEcrireStore({ bac: true, bacDemande: 2, devoirs: [], examens: [] });
ok(context.devoirsBacADemander() === false, 'après la réponse actuelle, plus jamais de popup');
context.devoirsEcrireStore({ bac: false, bacDemande: 2, devoirs: [], examens: [] });
ok(context.devoirsBacADemander() === false, 'idem après « Non »');
context.devoirsEcrireStore({ bac: null, devoirs: [], examens: [] });
ok(context.devoirsBacADemander() === true, 'sans réponse, le popup vient');

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
/* Aujourd'hui (figé) : mercredi 14 octobre. Devoir demain jeudi 15. */
const cleJour = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
/* toutes les dates du test suivent la date figée de la machine virtuelle */
const aujourdhui = new Date(2026, 9, 14, 10, 30, 0);
const demain = new Date(aujourdhui.getTime() + 86400000);
context.devoirsEcrireStore({ bac: true, devoirs: [{ id: 'd1', matiere: 'Physique', date: cleJour(demain), debut: '08:00', fin: '13:00' }], examens: [] });

const idxJour = (aujourdhui.getDay() + 6) % 7;
const apresDevoir = context.devoirsAdapterJour(jourSimple.slice(), idxJour);
const revisionsDemain = apresDevoir.filter(function (ev) { return ev.devoirsBloc && String(ev.title).indexOf('Révision · Physique') !== -1; });
ok(revisionsDemain.length >= 1, 'aucune révision posée la veille du devoir');
ok(revisionsDemain.length <= 3, 'au plus trois révisions de devoir par jour, trouvé : ' + revisionsDemain.length);
ok(apresDevoir.every(function (ev) { return !ev.devoirsBloc || String(ev.title).indexOf('Devoir') === -1; }), 'le devoir ne doit pas apparaître avant sa date');

/* — 3a2. Dès l'ajout d'un examen, même des semaines à l'avance, des
   révisions se posent — sans toucher au reste de l'emploi du temps. */
context.devoirsEcrireStore({
    bac: false, devoirs: [],
    examens: [{ id: 'xloin', matiere: 'Physique', date: cleJour(new Date(aujourdhui.getTime() + 20 * 86400000)), debut: '08:00', fin: '13:00' }]
});
const jourPreparation = context.devoirsAdapterJour(jourSimple.concat([
    { id: 'study1', title: 'Révisions Chimie', startTime: '14:00', endTime: '15:30', type: 'study' },
    { id: 'memoir-page', title: 'Mémoire', startTime: '16:00', endTime: '16:40', type: 'memoir' },
    { id: 'ia-page-x', title: 'Évaluation interne', startTime: '17:00', endTime: '17:40', type: 'ia' },
    { id: 'activity-Foot', title: 'Foot', startTime: '18:00', endTime: '19:00', type: 'activity' }
]), idxJour);
ok(jourPreparation.some(function (ev) { return ev.type === 'memoir'; }), 'loin de l\'épreuve, le mémoire reste : la préparation ne retire rien');
ok(jourPreparation.some(function (ev) { return ev.type === 'activity'; }), 'loin de l\'épreuve, les activités restent');
const blocsPrep = jourPreparation.filter(function (ev) { return ev.devoirsBloc && String(ev.title).indexOf('Révision · Physique') !== -1; });
ok(blocsPrep.length >= 1, 'un examen dans 20 jours doit déjà donner des révisions, trouvé : ' + blocsPrep.length);
ok(blocsPrep.length <= 2, 'au plus deux blocs de préparation par jour, trouvé : ' + blocsPrep.length);

/* — 3a3. Dès l'ajout d'un devoir, même loin de l'échéance — */
context.devoirsEcrireStore({
    bac: false,
    devoirs: [{ id: 'dloin', matiere: 'Chimie', date: cleJour(new Date(aujourdhui.getTime() + 10 * 86400000)), debut: '08:00', fin: '10:00' }],
    examens: []
});
const jourDevoirLoin = context.devoirsAdapterJour(jourSimple.slice(), idxJour);
const blocsDevoirLoin = jourDevoirLoin.filter(function (ev) { return ev.devoirsBloc && String(ev.title).indexOf('Révision · Chimie') !== -1; });
ok(blocsDevoirLoin.length >= 1, 'un devoir dans 10 jours doit déjà donner des révisions, trouvé : ' + blocsDevoirLoin.length);

/* — 3a4. Le budget suit la deadline : plus elle approche, plus le
   temps de préparation grandit (45 → 90 → 150 → 225 min par jour). */
function minutesBloc(ev) { return context.devoirsH2M(ev.endTime) - context.devoirsH2M(ev.startTime); }
function blocsDe(matiere, jour) {
    return jour.filter(function (ev) { return ev.devoirsBloc && String(ev.title).indexOf(matiere) !== -1; });
}
/* devoir dans 10 jours : deux blocs de 45 min */
context.devoirsEcrireStore({ bac: false, devoirs: [{ id: 'd10', matiere: 'Chimie', date: cleJour(new Date(aujourdhui.getTime() + 10 * 86400000)), debut: '08:00', fin: '10:00' }], examens: [] });
var j10 = context.devoirsAdapterJour(jourSimple.slice(), idxJour);
var b10 = blocsDe('Chimie', j10);
ok(b10.length === 2, 'devoir a 10 jours : 2 blocs attendus, trouvé : ' + b10.length);
ok(b10.length === 2 && minutesBloc(b10[0]) === 45, 'devoir a 10 jours : blocs de 45 min, trouvé : ' + (b10[0] ? minutesBloc(b10[0]) : '?'));
/* devoir dans 5 jours : deux blocs de 75 min */
context.devoirsEcrireStore({ bac: false, devoirs: [{ id: 'd5', matiere: 'Chimie', date: cleJour(new Date(aujourdhui.getTime() + 5 * 86400000)), debut: '08:00', fin: '10:00' }], examens: [] });
var j5 = context.devoirsAdapterJour(jourSimple.slice(), idxJour);
var b5 = blocsDe('Chimie', j5);
ok(b5.length === 2, 'devoir a 5 jours : 2 blocs attendus, trouvé : ' + b5.length);
ok(b5.length === 2 && minutesBloc(b5[0]) === 75, 'devoir a 5 jours : blocs de 75 min, trouvé : ' + (b5[0] ? minutesBloc(b5[0]) : '?'));
/* devoir dans 2 jours : trois blocs de 75 min, compte a rebours visible */
context.devoirsEcrireStore({ bac: false, devoirs: [{ id: 'd2', matiere: 'Chimie', date: cleJour(new Date(aujourdhui.getTime() + 2 * 86400000)), debut: '08:00', fin: '10:00' }], examens: [] });
var j2 = context.devoirsAdapterJour(jourSimple.slice(), idxJour);
var b2 = blocsDe('Chimie', j2);
ok(b2.length === 3, 'devoir a 2 jours : 3 blocs attendus, trouvé : ' + b2.length);
ok(b2.length >= 1 && String(b2[0].subtitle || '').indexOf('dans 2 j') !== -1, 'le compte a rebours manque : ' + JSON.stringify(b2[0] && b2[0].subtitle));
/* examen dans 20 jours : un seul bloc leger */
context.devoirsEcrireStore({ bac: false, devoirs: [], examens: [{ id: 'xe20', matiere: 'Physique', date: cleJour(new Date(aujourdhui.getTime() + 20 * 86400000)), debut: '08:00', fin: '13:00' }] });
var je20 = context.devoirsAdapterJour(jourSimple.slice(), idxJour);
var be20 = blocsDe('Physique', je20);
ok(be20.length === 1, 'examen a 20 jours : 1 bloc attendu, trouvé : ' + be20.length);
/* examen dans 10 jours : deux blocs, matieres les plus proches d'abord */
context.devoirsEcrireStore({ bac: false, devoirs: [], examens: [
    { id: 'xea', matiere: 'Physique', date: cleJour(new Date(aujourdhui.getTime() + 10 * 86400000)), debut: '08:00', fin: '10:00' },
    { id: 'xeb', matiere: 'Histoire', date: cleJour(new Date(aujourdhui.getTime() + 13 * 86400000)), debut: '08:00', fin: '10:00' }
] });
var je10 = context.devoirsAdapterJour(jourSimple.slice(), idxJour);
ok(blocsDe('Physique', je10).length === 1 && blocsDe('Histoire', je10).length === 1, 'examen a 10 jours : une révision par matière (les deux plus proches)');
ok(blocsDe('Physique', je10).length === 1 && minutesBloc(blocsDe('Physique', je10)[0]) === 45, 'examen a 10 jours : bloc de 45 min');

/* — 3a4b. Les séances choisies par l'élève — */
/* la répartition : n séances sur les jours restants, la veille en porte
   toujours une, et elles se resserrent vers l'échéance */
var rep32 = context.devoirsRepartitionSeances(3, 2);
ok(rep32[0] === 1 && rep32[1] === 2, '3 séances en 2 jours : 1 puis 2, trouvé : ' + JSON.stringify(rep32));
var rep15 = context.devoirsRepartitionSeances(1, 5);
ok(rep15[4] === 1 && Object.keys(rep15).length === 1, '1 séance en 5 jours : la veille seulement, trouvé : ' + JSON.stringify(rep15));
var rep210 = context.devoirsRepartitionSeances(2, 10);
ok(rep210[9] === 1 && rep210[0] === 1, '2 séances en 10 jours : veille + aujourd\'hui, trouvé : ' + JSON.stringify(rep210));
var rep52 = context.devoirsRepartitionSeances(5, 2);
ok((rep52[0] + rep52[1]) === 5, '5 séances en 2 jours : toutes posées, trouvé : ' + JSON.stringify(rep52));

/* un devoir avec 2 séances choisies, dans 6 jours : une séance
   aujourd'hui, l'autre la veille — pas la rampe automatique */
context.devoirsEcrireStore({ bac: false, devoirs: [{ id: 'dseances', matiere: 'Chimie', date: cleJour(new Date(aujourdhui.getTime() + 6 * 86400000)), debut: '08:00', fin: '10:00', seances: 2 }], examens: [] });
var jSeances = context.devoirsAdapterJour(jourSimple.slice(), idxJour);
var blocsSeances = jSeances.filter(function (ev) { return ev.devoirsBloc && String(ev.title).indexOf('Révision · Chimie') !== -1; });
ok(blocsSeances.length === 1, 'devoir à 6 jours avec 2 séances : une seule aujourd\'hui (l\'autre la veille), trouvé : ' + blocsSeances.length);
ok(blocsSeances.length === 1 && (context.devoirsH2M(blocsSeances[0].endTime) - context.devoirsH2M(blocsSeances[0].startTime)) >= 40, 'la séance du jour dure au moins 40 min');
ok(blocsSeances.length === 1 && String(blocsSeances[0].subtitle || '').indexOf('séance') === -1, 'une seule séance aujourd\'hui : pas de numérotation');
/* le choix voyage dans le store */
ok(context.devoirsAjouter('devoirs', { matiere: 'Physique', date: cleJour(demain), debut: '08:00', fin: '10:00', seances: 4 }),
    'l\'ajout avec séances doit réussir');
var entreeSeances = context.devoirsLireStore().devoirs.filter(function (d) { return d.matiere === 'Physique'; })[0];
ok(entreeSeances && entreeSeances.seances === 4, 'le choix de séances doit être gardé, trouvé : ' + JSON.stringify(entreeSeances && entreeSeances.seances));

/* — 3a6. Le programme trimestriel des devoirs — */
/* Les documents de devoirs annoncent les compositions d'un trimestre :
   des mercredis, une ou plusieurs matières, avec ou sans heures. Seules
   les matières de l'élève sont proposées. */
const progColonnes = context.devoirsParserTexte(
    'PROGRAMME DES DEVOIRS DE NIVEAU - 1er TRIMESTRE\n' +
    'Mercredi 21 octobre : Mathématiques AA\n' +
    'Mercredi 4 novembre : Histoire\n' +
    'Mercredi 2 decembre : Économie');
ok(progColonnes.length === 2, 'le programme doit proposer les 2 matières suivies (Économie non suivie), trouvé : ' + progColonnes.length + ' : ' + JSON.stringify(progColonnes.map(function (p) { return p.matiere; })));
ok(progColonnes.every(function (p) { return p.debut === '' && p.fin === ''; }), 'sans heures dans le document, les propositions restent à compléter');
ok(progColonnes[0] && progColonnes[0].date === '2026-10-21' && progColonnes[1] && progColonnes[1].date === '2026-11-04', 'les dates des mercredis doivent être reconnues : ' + JSON.stringify(progColonnes.map(function (p) { return p.date; })));
const progPlusieurs = context.devoirsParserTexte(
    'DEVOIRS DE NIVEAU - TRIMESTRE 1\n' +
    'Mercredi 21 Octobre\n' +
    'Maths AA, Physique\n' +
    'Mercredi 4 Novembre\n' +
    'Histoire, ESS');
ok(progPlusieurs.length === 4, 'chaque matière suivie d\'un mercredi doit être proposée, trouvé : ' + JSON.stringify(progPlusieurs.map(function (p) { return p.matiere + ' ' + p.date; })));
ok(progPlusieurs.filter(function (p) { return p.date === '2026-10-21'; }).length === 2 && progPlusieurs.filter(function (p) { return p.date === '2026-11-04'; }).length === 2, 'les matières se répartissent sur leurs mercredis : ' + JSON.stringify(progPlusieurs.map(function (p) { return p.matiere + ' ' + p.date; })));
const progHeures = context.devoirsParserTexte('Mercredi 21/10 : Maths AA (13h00-14h30), Physique (14h45-16h15)');
ok(progHeures.length === 2, 'deux matières avec leurs heures : deux propositions, trouvé : ' + JSON.stringify(progHeures));
ok(progHeures[0] && progHeures[0].matiere === 'Mathématiques AA' && progHeures[0].debut === '13:00' && progHeures[0].fin === '14:30', 'la première matière garde ses heures : ' + JSON.stringify(progHeures[0]));
ok(progHeures[1] && progHeures[1].matiere === 'Physique' && progHeures[1].debut === '14:45' && progHeures[1].fin === '16:15', 'la deuxième matière garde ses heures : ' + JSON.stringify(progHeures[1]));
/* le préremplissage sans emploi du temps chargé ne crashe pas et ne
   remplit rien */
const propsCreneau = context.devoirsParserTexte('Mercredi 21 octobre : Mathématiques AA');
context.devoirsRemplirCreneaux(propsCreneau);
ok(propsCreneau.length === 1 && propsCreneau[0].debut === '' && propsCreneau[0].fin === '', 'sans emploi du temps chargé, les heures restent à compléter');

/* — 3a7. Le créneau des devoirs remplace « DEVOIR DE NIVEAU » — */
const jourCreneau = [
    { id: 'wakeup', title: 'Réveil', startTime: '05:30', endTime: '05:45', type: 'wakeup' },
    { id: 'cours-reel-0', title: 'Géographie', startTime: '08:00', endTime: '09:25', type: 'school' },
    { id: 'cours-reel-3', title: 'DEVOIR DE NIVEAU', startTime: '13:00', endTime: '16:30', type: 'school' },
    { id: 'dinner', title: 'Dîner', startTime: '19:00', endTime: '19:45', type: 'meal' }
];
/* aux heures exactes du créneau */
context.devoirsEcrireStore({ bac: false, devoirs: [{ id: 'dc1', matiere: 'Mathématiques AA', date: cleJour(aujourdhui), debut: '13:00', fin: '16:30' }], examens: [] });
var jC1 = context.devoirsAdapterJour(jourCreneau.slice(), idxJour);
ok(!jC1.some(function (ev) { return String(ev.title).indexOf('DEVOIR DE NIVEAU') !== -1; }), 'le créneau générique doit disparaître le jour du devoir');
ok(jC1.some(function (ev) { return ev.id === 'devoir-dc1' && ev.startTime === '13:00' && ev.endTime === '16:30'; }), 'le devoir prend la place du créneau');
/* à d'autres heures : le créneau disparaît quand même */
context.devoirsEcrireStore({ bac: false, devoirs: [{ id: 'dc2', matiere: 'Mathématiques AA', date: cleJour(aujourdhui), debut: '17:00', fin: '18:30' }], examens: [] });
var jC2 = context.devoirsAdapterJour(jourCreneau.slice(), idxJour);
ok(!jC2.some(function (ev) { return String(ev.title).indexOf('DEVOIR DE NIVEAU') !== -1; }), 'le créneau disparaît même si le document donne d\'autres heures');
ok(jC2.some(function (ev) { return ev.id === 'devoir-dc2' && ev.startTime === '17:00' && ev.endTime === '18:30'; }), 'les heures du document gagnent : ' + JSON.stringify(jC2.map(function (e) { return e.id + ' ' + e.startTime; })));
/* sans heures : le créneau entier */
context.devoirsEcrireStore({ bac: false, devoirs: [{ id: 'dc3', matiere: 'Mathématiques AA', date: cleJour(aujourdhui) }], examens: [] });
var jC3 = context.devoirsAdapterJour(jourCreneau.slice(), idxJour);
ok(jC3.some(function (ev) { return ev.id === 'devoir-dc3' && ev.startTime === '13:00' && ev.endTime === '16:30'; }), 'un devoir sans heures prend le créneau entier : ' + JSON.stringify(jC3.map(function (e) { return e.id + ' ' + e.startTime + '-' + e.endTime; })));
ok(!jC3.some(function (ev) { return String(ev.title).indexOf('DEVOIR DE NIVEAU') !== -1; }), 'le créneau générique a disparu');
/* deux devoirs sans heures : le créneau se partage, sans chevauchement */
context.devoirsEcrireStore({ bac: false, devoirs: [
    { id: 'dc4', matiere: 'Mathématiques AA', date: cleJour(aujourdhui) },
    { id: 'dc5', matiere: 'Physique', date: cleJour(aujourdhui) }
], examens: [] });
var jC4 = context.devoirsAdapterJour(jourCreneau.slice(), idxJour);
var poses45 = jC4.filter(function (ev) { return ev.id === 'devoir-dc4' || ev.id === 'devoir-dc5'; });
ok(poses45.length === 2, 'deux devoirs sans heures : deux blocs posés, trouvé : ' + poses45.length);
if (poses45.length === 2) {
    var pA = poses45.filter(function (e) { return e.id === 'devoir-dc4'; })[0];
    var pB = poses45.filter(function (e) { return e.id === 'devoir-dc5'; })[0];
    ok(context.devoirsH2M(pA.endTime) <= context.devoirsH2M(pB.startTime), 'les deux devoirs ne se chevauchent pas : ' + pA.startTime + '-' + pA.endTime + ' / ' + pB.startTime + '-' + pB.endTime);
    ok(context.devoirsH2M(pA.startTime) >= 13 * 60 && context.devoirsH2M(pB.endTime) <= 16 * 60 + 30, 'les deux devoirs restent dans le créneau');
}
/* un devoir aux heures précises + un sans heures : le second prend le
   reste du créneau */
context.devoirsEcrireStore({ bac: false, devoirs: [
    { id: 'dc6', matiere: 'Mathématiques AA', date: cleJour(aujourdhui), debut: '13:00', fin: '14:30' },
    { id: 'dc7', matiere: 'Physique', date: cleJour(aujourdhui) }
], examens: [] });
var jC5 = context.devoirsAdapterJour(jourCreneau.slice(), idxJour);
var p7 = jC5.filter(function (ev) { return ev.id === 'devoir-dc7'; })[0];
ok(p7 && context.devoirsH2M(p7.startTime) >= 14 * 60 + 30 && context.devoirsH2M(p7.endTime) <= 16 * 60 + 30, 'le devoir sans heures prend le reste du créneau : ' + (p7 ? p7.startTime + '-' + p7.endTime : 'rien'));
/* sans devoir ce jour-là : le créneau reste tel quel */
context.devoirsEcrireStore({ bac: false, devoirs: [{ id: 'dc8', matiere: 'Mathématiques AA', date: cleJour(demain), debut: '13:00', fin: '14:30' }], examens: [] });
var jC6 = context.devoirsAdapterJour(jourCreneau.slice(), idxJour);
ok(jC6.some(function (ev) { return String(ev.title).indexOf('DEVOIR DE NIVEAU') !== -1; }), 'sans devoir ce jour-là, le créneau reste');
/* sans créneau dans l'emploi : un devoir sans heures n'est pas posé */
const jourSansCreneau = jourCreneau.filter(function (ev) { return ev.id !== 'cours-reel-3'; });
context.devoirsEcrireStore({ bac: false, devoirs: [{ id: 'dc9', matiere: 'Mathématiques AA', date: cleJour(aujourdhui) }], examens: [] });
var jC7 = context.devoirsAdapterJour(jourSansCreneau.slice(), idxJour);
ok(!jC7.some(function (ev) { return String(ev.title).indexOf('Devoir ·') !== -1; }), 'sans créneau, un devoir sans heures n\'est posé nulle part (il reste dans la liste)');

/* — 3a8. La promesse des séances est tenue, même planning plein — */
/* Une journée sans aucun moment libre : les séances choisies prennent
   la place des blocs d'étude du site — jamais des cours, repas ou
   téléphones. */
const jourPlein = [
    { id: 'prep', title: 'Préparation', startTime: '05:30', endTime: '07:50', type: 'prep' },
    { id: 'school1', title: 'Cours', startTime: '07:50', endTime: '12:30', type: 'school' },
    { id: 'lunch', title: 'Déjeuner', startTime: '12:30', endTime: '13:30', type: 'meal' },
    { id: 'school2', title: 'Cours', startTime: '13:30', endTime: '16:30', type: 'school' },
    { id: 'phone', title: 'Téléphone', startTime: '16:30', endTime: '17:30', type: 'phone' },
    { id: 'study1', title: 'Révisions Chimie', startTime: '17:30', endTime: '19:00', type: 'study' },
    { id: 'dinner', title: 'Dîner', startTime: '19:00', endTime: '19:45', type: 'meal' },
    { id: 'study2', title: 'Exercices Physique', startTime: '19:45', endTime: '21:15', type: 'study' },
    { id: 'sleep', title: 'Coucher', startTime: '22:00', endTime: '05:30', type: 'sleep' }
];
/* deux séances promises pour demain : deux séances posées */
context.devoirsEcrireStore({ bac: false, devoirs: [{ id: 'dp1', matiere: 'Chimie', date: cleJour(demain), debut: '08:00', fin: '10:00', seances: 2 }], examens: [] });
var jP1 = context.devoirsAdapterJour(JSON.parse(JSON.stringify(jourPlein)), idxJour);
var revP1 = jP1.filter(function (ev) { return ev.devoirsBloc && String(ev.title).indexOf('Révision · Chimie') === 0; });
ok(revP1.length === 2, 'deux séances promises, planning plein : deux séances posées, trouvé : ' + revP1.length);
ok(!jP1.some(function (ev) { return ev.id === 'study1' || ev.id === 'study2'; }), 'les blocs d\'étude ont cédé leur place aux séances');
ok(jP1.some(function (ev) { return ev.id === 'phone'; }) && jP1.some(function (ev) { return ev.id === 'lunch'; }) && jP1.some(function (ev) { return ev.id === 'school1'; }), 'téléphone, repas et cours restent en place');
ok(revP1.every(function (ev) { return context.devoirsH2M(ev.endTime) - context.devoirsH2M(ev.startTime) >= 40; }), 'chaque séance posée dure au moins 40 min');
/* une seule séance promise aujourd'hui (répartition 3 séances sur
   2 jours) : un seul bloc d'étude cède sa place */
context.devoirsEcrireStore({ bac: false, devoirs: [{ id: 'dp2', matiere: 'Chimie', date: cleJour(new Date(aujourdhui.getTime() + 2 * 86400000)), debut: '08:00', fin: '10:00', seances: 3 }], examens: [] });
var jP2 = context.devoirsAdapterJour(JSON.parse(JSON.stringify(jourPlein)), idxJour);
var revP2 = jP2.filter(function (ev) { return ev.devoirsBloc && String(ev.title).indexOf('Révision · Chimie') === 0; });
ok(revP2.length === 1, '3 séances en 2 jours : une seule aujourd\'hui, trouvé : ' + revP2.length);
ok(jP2.some(function (ev) { return ev.id === 'study2'; }), 'un seul bloc d\'étude cède sa place quand une seule séance est promise');
/* sans choix de séances, la rampe automatique se pose aussi */
context.devoirsEcrireStore({ bac: false, devoirs: [{ id: 'dp3', matiere: 'Chimie', date: cleJour(demain), debut: '08:00', fin: '10:00' }], examens: [] });
var jP3 = context.devoirsAdapterJour(JSON.parse(JSON.stringify(jourPlein)), idxJour);
var autoP3 = jP3.filter(function (ev) { return ev.devoirsBloc && /· Chimie/.test(String(ev.title)); });
ok(autoP3.length >= 2, 'la rampe automatique doit aussi se poser sur un planning plein, trouvé : ' + autoP3.length + ' : ' + JSON.stringify(jP3.filter(function (e) { return e.devoirsBloc; }).map(function (e) { return e.title; })));
ok(jP3.some(function (ev) { return ev.id === 'phone'; }), 'le téléphone n\'est jamais pris');
/* un seul bloc d'étude disponible : la promesse s'arrête à ce qui
   existe vraiment, sans rien inventer */
const jourUneEtude = jourPlein.map(function (ev) {
    return ev.id === 'study2' ? { id: 'etude-perso', title: 'Étude perso', startTime: ev.startTime, endTime: ev.endTime, type: 'study' } : ev;
});
context.devoirsEcrireStore({ bac: false, devoirs: [{ id: 'dp4', matiere: 'Chimie', date: cleJour(demain), debut: '08:00', fin: '10:00', seances: 2 }], examens: [] });
var jP4 = context.devoirsAdapterJour(JSON.parse(JSON.stringify(jourUneEtude)), idxJour);
var revP4 = jP4.filter(function (ev) { return ev.devoirsBloc && String(ev.title).indexOf('Révision · Chimie') === 0; });
ok(revP4.length === 1, 'un seul bloc d\'étude du site disponible : une seule séance de plus, rien n\'est inventé, trouvé : ' + revP4.length);
ok(jP4.some(function (ev) { return ev.id === 'etude-perso'; }), 'un créneau posé par l\'élève lui-même n\'est jamais pris');

/* — 3a8b. Semaine de révisions : plus de plafond par jour — */
/* Des examens arrivent : les séances choisies du devoir restent
   entières (l'ancien plafond de deux par jour est parti). */
context.devoirsEcrireStore({
    bac: false,
    devoirs: [{ id: 'dr1', matiere: 'Chimie', date: cleJour(demain), debut: '08:00', fin: '10:00', seances: 3 }],
    examens: [{ id: 'xr1', matiere: 'Physique', date: cleJour(new Date(aujourdhui.getTime() + 3 * 86400000)), debut: '08:00', fin: '13:00' }]
});
var jR1 = context.devoirsAdapterJour(jourSimple.slice(), idxJour);
var revR1 = jR1.filter(function (ev) { return ev.devoirsBloc && String(ev.title).indexOf('Révision · Chimie') === 0; });
ok(revR1.length === 3, '3 séances la veille du devoir pendant la semaine de révisions : 3 posées, trouvé : ' + revR1.length);

/* — 3a8c. Les blocs de comblement « revgap » cèdent leur place aussi — */
/* Le vrai moteur remplit les trous du jour avec des blocs « revgap-… »
   (week-end, heures creuses) : la garantie doit les reconnaître comme
   des blocs d'étude du site, sinon une journée pleine de revgap ne
   reçoit qu'une séance. Bug vu par le test navigateur du 18/10. */
var jourRevGap = [
    { id: 'prep', title: 'Préparation', startTime: '05:30', endTime: '07:50', type: 'prep' },
    { id: 'school1', title: 'Cours', startTime: '07:50', endTime: '12:30', type: 'school' },
    { id: 'lunch', title: 'Déjeuner', startTime: '12:30', endTime: '13:30', type: 'meal' },
    { id: 'school2', title: 'Cours', startTime: '13:30', endTime: '15:00', type: 'school' },
    { id: 'phone', title: 'Téléphone', startTime: '16:30', endTime: '17:30', type: 'phone' },
    { id: 'revgap-910', title: 'Révisions · Mathématiques AA', startTime: '15:00', endTime: '16:30', type: 'study' },
    { id: 'revgap-1050', title: 'Révisions · Chimie', startTime: '17:30', endTime: '19:00', type: 'study' },
    { id: 'dinner', title: 'Dîner', startTime: '19:00', endTime: '19:45', type: 'meal' },
    { id: 'revgap-1185', title: 'Révisions · Physique', startTime: '19:45', endTime: '21:15', type: 'study' },
    { id: 'sleep', title: 'Coucher', startTime: '22:00', endTime: '05:30', type: 'sleep' }
];
context.devoirsEcrireStore({ bac: false, devoirs: [{ id: 'dp5', matiere: 'Chimie', date: cleJour(demain), debut: '08:00', fin: '10:00', seances: 3 }], examens: [] });
var jRG = context.devoirsAdapterJour(JSON.parse(JSON.stringify(jourRevGap)), idxJour);
var revRG = jRG.filter(function (ev) { return ev.devoirsBloc && String(ev.title).indexOf('Révision · Chimie') === 0; });
ok(revRG.length === 3, 'une journée pleine de blocs revgap reçoit quand même ses 3 séances, trouvé : ' + revRG.length);
ok(revRG.some(function (ev) { return String(ev.id).indexOf('devrev-dp5-g') === 0; }), 'un bloc revgap doit céder sa place à une séance manquante');
ok(jRG.some(function (ev) { return ev.id === 'lunch'; }) && jRG.some(function (ev) { return ev.id === 'dinner'; }) && jRG.some(function (ev) { return ev.id === 'phone'; }) && jRG.some(function (ev) { return ev.id === 'school1'; }), 'repas, téléphone et cours ne sont jamais pris');
ok(jRG.every(function (ev) { return String(ev.id).indexOf('revgap-') !== 0 || ev.devoirsBloc === true; }), 'tout revgap a cédé sa place ou est devenu une séance');


/* — 3a9. La question des séances : une seule pour toute la fournée — */
context.devoirsEcrireStore({ bac: false, devoirs: [
    { id: 'da', matiere: 'Mathématiques AA', date: cleJour(demain), debut: '13:00', fin: '14:30' },
    { id: 'db', matiere: 'Physique', date: cleJour(demain), debut: '14:45', fin: '16:15' },
    { id: 'dd', matiere: 'Histoire', date: cleJour(new Date(aujourdhui.getTime() + 7 * 86400000)), debut: '13:00', fin: '14:30' }
], examens: [] });
context.devoirsAppliquerSeances(['da', 'db', 'dd'], 4);
var stSeances = context.devoirsLireStore();
ok(stSeances.devoirs.every(function (d) { return d.seances === 4; }), 'le même nombre de séances s\'applique à toute la fournée : ' + JSON.stringify(stSeances.devoirs.map(function (d) { return d.seances; })));
context.devoirsAppliquerSeances(['da'], 'auto');
ok(context.devoirsLireStore().devoirs.filter(function (d) { return d.id === 'da'; })[0].seances === 'auto', 'une matière peut passer en automatique');
context.devoirsAppliquerSeances(['db'], 9);
ok(context.devoirsLireStore().devoirs.filter(function (d) { return d.id === 'db'; })[0].seances === 4, 'un nombre hors bornes ne change rien');
/* ajout sans heures : le créneau du jour l'accueillera */
ok(context.devoirsAjouter('devoirs', { matiere: 'ESS', date: cleJour(demain) }) !== false, 'un devoir sans heures doit pouvoir s\'ajouter');
ok(context.devoirsAjouter('examens', { matiere: 'ESS', date: cleJour(demain) }) === false, 'un examen sans heures reste refusé');
ok(context.devoirsAjouter('devoirs', { matiere: 'ESS', date: cleJour(demain), debut: '13:00' }) === false, 'un devoir avec une seule heure reste refusé');

/* — 3a5. Les creneaux passes ne se programment jamais — */
const aujT = new Date(2026, 9, 14, 10, 30, 0);
const hierT = new Date(aujT.getTime() - 86400000);
const demainT = new Date(aujT.getTime() + 86400000);
ok(context.devoirsEstPasse(cleJour(hierT), '08:00') === true, 'hier est passé');
ok(context.devoirsEstPasse(cleJour(demainT), '08:00') === false, 'demain n\'est pas passé');
ok(context.devoirsEstPasse(cleJour(aujT), '23:00') === false, "aujourd'hui plus tard n'est pas passé");
ok(context.devoirsEstPasse(cleJour(aujT), '09:00') === true, "aujourd'hui plus tôt est passé");
ok(context.devoirsEstPasse(cleJour(aujT), '') === false, 'sans heure, on ne saurait pas');
context.devoirsEcrireStore({ bac: false, devoirs: [], examens: [] });
ok(context.devoirsAjouter('devoirs', { matiere: 'Chimie', date: cleJour(hierT), debut: '08:00', fin: '10:00' }) === false, 'un créneau passé doit être refusé');
ok(context.devoirsLireStore().devoirs.length === 0, 'aucun créneau passé ne doit entrer dans le store');
/* même si de vieux créneaux passés traînent dans le store : jamais affichés */
context.devoirsEcrireStore({ bac: false, devoirs: [{ id: 'dvx', matiere: 'Chimie', date: cleJour(hierT), debut: '08:00', fin: '10:00' }], examens: [{ id: 'exx', matiere: 'Physique', date: cleJour(new Date(aujT.getTime() - 2 * 86400000)), debut: '08:00', fin: '10:00' }] });
var jPasse = context.devoirsAdapterJour(jourSimple.slice(), idxJour);
ok(!jPasse.some(function (ev) { return ev.devoirsBloc; }), 'des créneaux passés dans le store ne programment rien');

/* — 3b. La semaine avant les examens — */
/* Samedi 17 (dans 3 jours) et lundi 19 : aujourd'hui mercredi 14
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
/* Chimie composée hier (mardi 13), Mathématiques à venir demain
   (jeudi 15). Aujourd'hui, on révise les Maths, plus la Chimie. */
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
/* Examen de Mathématiques aujourd'hui (mercredi 14) de 14h00 à 17h00 :
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
ok(!samediSansBac.some(function (ev) { return ev.id === 'eco'; }), 'sans le bac, le cours d\'économie du samedi doit aussi disparaître : le retrait est pour tous les élèves');

/* — le voyage avec le compte Google — */
context.devoirsEcrireStore({
    bac: true,
    bacDemande: 2,
    devoirs: [{ id: 'd9', matiere: 'Philosophie', date: '2026-10-20', debut: '08:00', fin: '13:00' }],
    examens: [{ id: 'x9', matiere: 'Chimie', date: '2026-10-22', debut: '08:00', fin: '10:00' }]
});
const compact = context.devoirsStoreCompact();
ok(compact && compact.bac === true, 'le store compact perd le réglage du bac');
ok(compact && Array.isArray(compact.devoirs) && compact.devoirs.length === 1 && compact.devoirs[0].matiere === 'Philosophie', 'le store compact perd les devoirs');
ok(compact && Array.isArray(compact.examens) && compact.examens.length === 1 && compact.examens[0].date === '2026-10-22', 'le store compact perd les examens');
ok(compact && compact.bacDemande === 2, 'le store compact perd la version de la question posée');


/* ── 4. Le parcours complet du popup, sur le vrai moteur ─────────── */
/* Bug corrigé : répondre « Oui » au popup ne changeait rien, car la
   réponse au bac n'entrait pas dans la signature des faits — l'emploi
   figé d'avant la réponse était resservi tel quel. Ici on fige un
   emploi SANS bac (comme tous les élèves déjà inscrits), on répond
   « Oui », et le planning doit se reconstruire avec les créneaux du
   bac. Répondre « Non » plus tard reconstruit aussi. */
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
    subjects: [{ name: 'Mathématiques AA', level: 'HL', icon: '🔢' }, { name: 'Philosophie', level: 'SL', icon: '🤔' }],
    optionalSubjects: [],
    ibYear: 'DP2',
    weekdayWakeup: '05:30', saturdayWakeup: '08:30', sundayWakeup: '09:00',
    weekdaySleepHours: 8, saturdaySleepHours: 8, sundaySleepHours: 8,
    allSubj: [], customEvents: [], selectedActivities: [],
    phoneTime: 0, phoneDays: [], holidayBypass: 0, holidayDays: [], holidayModes: {}, holidayDropped: {},
    COURS_DEBUT: 470, COURS_FIN: 985, COURS_FIN_MATIN: 750,
    transportMode: 'walking',
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
contexteMoteur.Date = DateFigee; /* même date figée que l'autre machine : les créneaux passés doivent le rester pour elle aussi */
contexteMoteur.window = contexteMoteur;
vm.createContext(contexteMoteur);
[devoirsSrc, moteurSrc, fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'planning-base.js'), 'utf8'), fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'planning-moteur.js'), 'utf8')].forEach(function (src, i) {
    vm.runInContext(src, contexteMoteur, { filename: 'moteur-' + i + '.js' });
});

/* sans réponse, la signature ne change pas : les emplois figés d'avant
   la fonctionnalité restent valides (personne ne subit de reconstruction) */
ok(contexteMoteur.emploiFaitsSignature().indexOf('bacNational') === -1, 'la signature ne doit contenir bacNational qu\'après une réponse');

/* figer un emploi AVANT la réponse, comme tous les élèves déjà inscrits */
vm.runInContext('emploiNePasSauver = 1; var j = []; for (var i = 0; i < 7; i++) j.push(emploiReconstruire(i)); emploiFige = { sig: emploiFaitsSignature(), at: new Date().toISOString(), jours: emploiCloner(j) }; emploiNePasSauver = 0;', contexteMoteur);
ok(contexteMoteur.emploiEstFige() === true, 'l\'emploi figé avant la réponse doit être valide');

/* répondre « Oui » dans le popup : la signature change, le cliché
   d'avant n'est plus bon — c'était le bug « rien ne change » */
contexteMoteur.devoirsEcrireStore({ bac: true, devoirs: [], examens: [] });
ok(contexteMoteur.emploiEstFige() === false, 'répondre « Oui » doit invalider l\'emploi figé d\'avant la réponse (bug du popup)');

/* le planning reconstruit porte les créneaux du bac */
const vendrediBac = contexteMoteur.emploiReconstruire(4);
const blocVendredi = vendrediBac.filter(function (ev) { return ev.id === 'bac-vendredi'; })[0];
ok(blocVendredi, 'le vendredi reconstruit doit porter le bloc du bac');
if (blocVendredi) {
    ok(blocVendredi.startTime === '14:55' && blocVendredi.endTime === '16:25', 'vendredi du bac : ' + blocVendredi.startTime + '-' + blocVendredi.endTime);
    ok(String(blocVendredi.title).indexOf('Bac national') !== -1, 'titre du vendredi du bac : ' + blocVendredi.title);
}
const coursVendredi = vendrediBac.filter(function (ev) { return ev.id === 'school2'; })[0];
ok(coursVendredi && coursVendredi.endTime === '14:55', 'le vendredi du bac doit couper les cours à 14h55, trouvé : ' + (coursVendredi ? coursVendredi.endTime : 'rien'));

const samediBacJour = contexteMoteur.emploiReconstruire(5);
const blocSamedi = samediBacJour.filter(function (ev) { return ev.id === 'bac-samedi'; })[0];
ok(blocSamedi && blocSamedi.startTime === '08:00' && blocSamedi.endTime === '13:00', 'le samedi du bac doit être 8h00 → 13h00, trouvé : ' + (blocSamedi ? blocSamedi.startTime + '-' + blocSamedi.endTime : 'rien'));
const reveilSamedi = samediBacJour.filter(function (ev) { return ev.id === 'wakeup'; })[0];
ok(reveilSamedi && reveilSamedi.startTime <= '07:00', 'le samedi du bac doit se lever au plus tard à 7h00, trouvé : ' + (reveilSamedi ? reveilSamedi.startTime : 'rien'));
const coucherSamedi = samediBacJour.filter(function (ev) { return ev.id === 'sleep'; })[0];
if (coucherSamedi && reveilSamedi) {
    const dornee = (24 * 60 + reveilSamedi.startTime.split(':')[0] * 60 + reveilSamedi.startTime.split(':')[1] * 1) - (coucherSamedi.startTime.split(':')[0] * 60 + coucherSamedi.startTime.split(':')[1] * 1);
    ok(dornee >= 5 * 60, 'le samedi du bac doit garder au moins 5 h de sommeil : ' + Math.floor(dornee / 60) + ' h');
}

/* le cours d'économie épinglé du samedi disparaît pour les élèves du bac.
   customEvents est une liaison « let » du script : il faut l'écrire
   depuis l'intérieur de la machine virtuelle. */
vm.runInContext('customEvents = [{ id: "eco-test", day: 5, title: "Cours d\'économie", startTime: "15:00", endTime: "17:00", type: "school" }]', contexteMoteur);
const samediAvecEco = contexteMoteur.emploiReconstruire(5);
ok(!samediAvecEco.some(function (ev) { return ev.id === 'eco-test'; }), 'le cours d\'économie du samedi doit disparaître pour l\'élève du bac');
ok(samediAvecEco.some(function (ev) { return ev.id === 'study1' || ev.id === 'study2'; }) || samediAvecEco.length > 3, 'le reste du samedi doit rester rempli');

/* le nouvel état figé (avec bac) est stable, et « Non » reconstruit aussi */
vm.runInContext('var j2 = []; for (var i = 0; i < 7; i++) j2.push(emploiReconstruire(i));', contexteMoteur);
ok(contexteMoteur.emploiEstFige() === true, 'l\'emploi figé après la réponse doit être valide');
contexteMoteur.devoirsEcrireStore({ bac: false, devoirs: [], examens: [] });
ok(contexteMoteur.emploiEstFige() === false, 'répondre « Non » plus tard doit aussi reconstruire');
const samediSansBacJour = contexteMoteur.emploiReconstruire(5);
ok(!samediSansBacJour.some(function (ev) { return String(ev.id).indexOf('bac-samedi') === 0; }), 'sans le bac, le samedi ne porte plus le créneau du bac');
ok(!samediSansBacJour.some(function (ev) { return ev.id === 'eco-test'; }), 'sans le bac, le cours d\'économie du samedi ne revient pas : retiré pour tous, pour toujours');

/* ── 5. La chaîne complète du planning, pour de vrai ──────────────── */
/* generateDayEvents est la fonction même du site : génération brute,
   figage, adaptateur, garanties du jour. Un devoir de Chimie mardi
   (3 séances choisies) et un examen de Physique vendredi — semaine de
   révision active. On regarde ce que le planning affiche vraiment. */
contexteMoteur.devoirsEcrireStore({
    bac: false,
    devoirs: [{ id: 'sch1', matiere: 'Chimie', date: '2026-10-16', debut: '08:00', fin: '10:00', seances: 3, ajouteAt: '2026-10-14T08:00:00.000Z' }],
    examens: [{ id: 'sex1', matiere: 'Physique', date: '2026-10-18', debut: '13:00', fin: '15:00', ajouteAt: '2026-10-14T08:00:00.000Z' }]
});
function compterBloc(jourGenere, texte) {
    return jourGenere.filter(function (ev) { return String(ev.title || '').indexOf(texte) !== -1; }).length;
}
/* mercredi 14 (aujourd'hui) : une séance de Chimie + révisions de Physique */
const mercrediReel = contexteMoteur.generateDayEvents(2);
ok(compterBloc(mercrediReel, 'Révision · Chimie') === 1, 'aujourd\'hui : une séance de Chimie attendue, trouvé : ' + compterBloc(mercrediReel, 'Révision · Chimie'));
ok(compterBloc(mercrediReel, 'Révision · Physique') >= 1, 'aujourd\'hui : révisions de l\'examen de Physique attendues');
ok(!mercrediReel.some(function (ev) { return ev.type === 'memoir' || ev.type === 'ia' || ev.type === 'activity'; }), 'semaine de révision : ni mémoire, ni éval interne, ni CAS');
/* jeudi 15 : deux séances de Chimie (répartition 1 + 2 avant vendredi) */
const jeudiReel = contexteMoteur.generateDayEvents(3);
ok(compterBloc(jeudiReel, 'Révision · Chimie') === 2, 'jeudi : deux séances de Chimie attendues, trouvé : ' + compterBloc(jeudiReel, 'Révision · Chimie'));
/* vendredi 16 : le devoir lui-même, à ses heures, créneau fixe */
const vendrediReel = contexteMoteur.generateDayEvents(4);
const blocDevoirReel = vendrediReel.filter(function (ev) { return ev.id === 'devoir-sch1'; })[0];
ok(blocDevoirReel && blocDevoirReel.startTime === '08:00' && blocDevoirReel.endTime === '10:00' && blocDevoirReel.kind === 'fixed',
    'vendredi : le devoir doit occuper 8h00-10h00 en créneau fixe, trouvé : ' + JSON.stringify(blocDevoirReel && { s: blocDevoirReel.startTime, e: blocDevoirReel.endTime, k: blocDevoirReel.kind }));
/* dimanche 18 : l'examen à ses heures */
const dimancheReel = contexteMoteur.generateDayEvents(6);
const blocExamenReel = dimancheReel.filter(function (ev) { return ev.id === 'exam-sex1'; })[0];
ok(blocExamenReel && blocExamenReel.startTime === '13:00' && blocExamenReel.endTime === '15:00',
    'dimanche : l\'examen doit occuper 13h00-15h00, trouvé : ' + JSON.stringify(blocExamenReel && { s: blocExamenReel.startTime, e: blocExamenReel.endTime }));
/* les jours restent cohérents : remplis et ordonnés */
[mercrediReel, jeudiReel, vendrediReel, dimancheReel].forEach(function (jr, k) {
    ok(jr.length > 2 && jr[0] && jr[jr.length - 1], 'le jour ' + k + ' doit rester rempli et ordonné');
});

/* ── Bilan ─────────────────────────────────────────────────────────── */
if (echecs.length) {
    console.error('Devoirs & Examens : échecs ' + echecs.length);
    echecs.forEach(function (e) { console.error(' - ' + e); });
    process.exit(1);
}
console.log('ok devoirs et examens : OCR, parser, compositions, semaines de révision et d\u2019examens, bac national');
