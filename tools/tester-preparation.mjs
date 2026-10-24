/**
 * Vérifie en vrai navigateur, sur le site déployé, que la préparation
 * des devoirs et des examens entre vraiment dans le planning.
 *
 * Le test installe dans le navigateur un profil complet (DP2) et un
 * programme : un devoir de Chimie demain avec 2 séances de révision
 * choisies, et un examen de Physique dans 3 jours. Puis il regarde ce
 * que le site affiche vraiment :
 *   1. la séance de révision du devoir apparaît dès aujourd'hui ;
 *   2. le compte à rebours est visible sous les blocs ;
 *   3. les révisions de l'examen apparaissent dans la semaine ;
 *   4. le devoir occupe ses heures le jour J (s'il est dans la
 *      semaine affichée) ;
 *   5. le popup du bac ne revient pas (réponse déjà donnée) ;
 *   6. aucune erreur JavaScript.
 *   7. l'analyse des documents ne propose que les matières de l'élève ;
 *   8. l'emploi du temps scolaire : vrais cours, travail dans les
 *      creux, et matières vues au programme de tout le planning ;
 *   9. le bouton Continuer de la page Emploi du temps ouvre vraiment
 *      le planning, le Retour y ramène depuis le menu ;
 *  10. la musique : tomate au menu Pomodoro, panneau Sons sur la page
 *      Séance, section Playlist totalement retirée.
 */
import { chromium } from 'playwright';

const SITE = 'https://sawadogojuliss-byte.github.io/Learning-DP1/';

function echec(message) {
    console.error('ECHEC ' + message);
    process.exit(1);
}
function jourCle(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const erreurs = [];
page.on('pageerror', function (e) {
    erreurs.push(String(e));
    console.error('ERREUR JS ' + e);
});
page.on('console', function (m) {
    if (m.type() === 'error') console.error('CONSOLE ' + m.text().slice(0, 300));
});

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });

const demain = new Date(Date.now() + 86400000);
const dans3jours = new Date(Date.now() + 3 * 86400000);

/* le profil complet et le programme, comme un élève qui revient */
await page.evaluate(function (programme) {
    localStorage.setItem('studyPlanIB_profil', JSON.stringify({
        v: 1, savedAt: new Date().toISOString(), etape: 'planning', profilComplet: true,
        userName: 'E2E Preparation', targetScore: 36,
        weekdayWakeup: '05:30', saturdayWakeup: '08:30', sundayWakeup: '09:00',
        subjects: [
            { name: 'Mathématiques AA', level: 'HL', icon: '🔢' },
            { name: 'Chimie', level: 'SL', icon: '⚗️' }
        ],
        optionalSubjects: [{ name: 'Physique', level: 'SL', icon: '⚛️' }],
        ibYear: 'DP2', transportMode: 'walking',
        selectedActivities: [], holidayDates: {}, holidayDroppedDates: {},
        phoneDays: [], samePhoneDuration: true, phoneDuration: 30, phoneDayDurations: {},
        sameFreeTime: true, freeTimeMinutes: 60, freeTimeByDay: {},
        weekdaySleepHours: 8, saturdaySleepHours: 8, sundaySleepHours: 8
    }));
    localStorage.setItem('studyPlanIB_devoirs', JSON.stringify({
        bac: false, bacDemande: 2,
        devoirs: [{
            id: 'e2eseance', matiere: 'Chimie', date: programme.demain,
            debut: '08:00', fin: '10:00', seances: 2, ajouteAt: new Date().toISOString()
        }],
        examens: [{
            id: 'e2eexamen', matiere: 'Physique', date: programme.examen,
            debut: '13:00', fin: '15:00', ajouteAt: new Date().toISOString()
        }]
    }));
}, { demain: jourCle(demain), examen: jourCle(dans3jours) });

await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
try {
    await page.waitForFunction(() => window.__STUDYPLAN_READY === true, null, { timeout: 60000 });
} catch (e) {
    console.error('ECHEC le site n’a pas fini de démarrer. Erreurs JS : ' + JSON.stringify(erreurs.slice(0, 6)));
    process.exit(1);
}
/* Le signal READY précède de 180 ms la disparition de l'écran de
   démarrage : attendre l'interface visible avant de tester scroll/focus. */
await page.waitForFunction(() => !document.body.classList.contains('booting'), null, { timeout: 10000 });

/* Le démarrage seul ne garantit pas que le navigateur ait chargé la
   version de la boîte qui trie les quatre catégories. Aucun envoi réel. */
const destinations = await page.evaluate(() => window.BOITE_COLLECTIONS || null);
for (const [type, collection] of Object.entries({
    question: 'questions', feedback: 'feedbacks',
    emploi: 'emplois_du_temps', reponse: 'reponses'
})) {
    if (!destinations || destinations[type] !== collection) {
        echec('collection du site déployé incorrecte pour ' + type + ' : '
            + JSON.stringify(destinations));
    }
}

if (await page.evaluate(() => window.BOITE_EMPLOIS_SUSPENDUS !== true ||
    typeof boiteEmploiAvecCreneaux !== 'function' ||
    boiteEmploiAvecCreneaux({ jours: [] }) !== false)) {
    echec('le site déployé peut encore envoyer des emplois du temps pendant la purge');
}

/* Vérifie également la présentation du planning dans Firestore, sans
   écrire de document ni envoyer de mail : toute la semaine dans une fiche. */
const fiche = await page.evaluate(() => {
    if (typeof boiteEmploiPourFirestore !== 'function' || typeof boiteEmploiDepuisDocument !== 'function') return null;
    const brut = { type: 'emploi', id: 'e-local', at: new Date().toISOString(),
        nom: 'Élève', matieres: ['Physique HL'],
        jours: [{ j: 'Lundi', s: [{ d: '08:00', f: '09:00', t: 'Physique' }] }] };
    const format = boiteEmploiPourFirestore(brut);
    return { nom: format['01_nom_utilisateur'],
        matieres: format['02_matieres'],
        jour: format['03_emploi_du_temps']?.['01_Lundi']?.[0],
        retour: boiteEmploiDepuisDocument(format).jours[0]?.s[0]?.t };
});
if (!fiche || fiche.nom !== 'Élève' || fiche.matieres[0] !== 'Physique HL' ||
    fiche.jour !== '08h00 – 09h00  ·  Physique' || fiche.retour !== 'Physique') {
    echec('fiche emploi du temps déployée incorrecte : ' + JSON.stringify(fiche));
}

/* Schéma déployé : aucune écriture distante ni aucun mail. */
const messageCompact = await page.evaluate(() => {
    if (typeof boiteMessagePourFirestore !== 'function' || typeof boiteMessageDepuisFirestore !== 'function') return null;
    const brut = { type: 'feedback', id: 'f-local', at: new Date().toISOString(),
        '01_heure_envoi': '24/10/2026 10:30', '02_nom_utilisateur': 'Élève',
        '04_feedback': 'Avis local', z_email_reponse: 'eleve@example.com' };
    const doc = boiteMessagePourFirestore(brut);
    const relu = boiteMessageDepuisFirestore('feedbacks', doc, 'id-firebase');
    const ancienEnAttente = boiteMessagePourFirestore({ type: 'feedback',
        id: 'f-attente', at: '2026-10-24T02:34:00.000Z', nom: 'Élève',
        texte: 'Avis conservé', email: 'contact@example.com' });
    return { champs: Object.keys(doc).sort(), email: relu.email, texte: relu.texte,
        heureReprise: ancienEnAttente['01_heure_envoi'] };
});
if (!messageCompact || messageCompact.champs.join('|') !==
    '01_heure_envoi|02_nom_utilisateur|04_feedback|z_donnees_techniques' ||
    messageCompact.email !== 'eleve@example.com' || messageCompact.texte !== 'Avis local' ||
    !messageCompact.heureReprise.includes('Ouagadougou')) {
    echec('fiche feedback déployée incorrecte : ' + JSON.stringify(messageCompact));
}

/* Lot 2, deux premiers points : vrai moteur dans le navigateur,
   sans notification, courrier ni écriture distante. */
const revisionsLot2 = await page.evaluate(() => {
    if (typeof devoirsAdapterJour !== 'function' || typeof indexJourCourant !== 'function') return null;
    const aujourdhui = indexJourCourant();
    const jour = [
        { id: 'emploi-rev-e2e', title: 'Révisions Histoire', startTime: '08:00', endTime: '08:45', type: 'study' },
        { id: 'emploi-exo-e2e', title: 'Exercices Histoire', startTime: '09:00', endTime: '09:45', type: 'study' },
        { id: 'revgap-e2e', title: 'Révisions Histoire', startTime: '10:00', endTime: '10:45', type: 'study' },
        { id: 'cours-e2e', title: 'Cours', startTime: '11:00', endTime: '12:00', type: 'school' },
        { id: 'repas-e2e', title: 'Repas', startTime: '12:00', endTime: '13:00', type: 'meal' },
        { id: 'personnel-e2e', title: 'Révision personnelle', startTime: '15:00', endTime: '16:00', type: 'study' }
    ];
    const actuel = devoirsAdapterJour(jour, aujourdhui);
    const passe = aujourdhui > 0 ? devoirsAdapterJour(jour, aujourdhui - 1) : null;
    return {
        habituelsRetires: ['emploi-rev-e2e', 'emploi-exo-e2e', 'revgap-e2e']
            .every(id => !actuel.some(ev => ev.id === id)),
        protegesConserves: ['cours-e2e', 'repas-e2e', 'personnel-e2e']
            .every(id => actuel.some(ev => ev.id === id)),
        aucunAjoutPasse: passe === null || !passe.some(ev => ev.devoirsBloc)
    };
});
if (!revisionsLot2 || !revisionsLot2.habituelsRetires || !revisionsLot2.protegesConserves ||
    !revisionsLot2.aucunAjoutPasse) {
    echec('révisions du lot 2 dans le navigateur : ' + JSON.stringify(revisionsLot2));
}

/* Chaque examen a sa fenêtre J-14, testée sur le code du site
   déployé sans conserver les données provisoires de ce navigateur. */
const fenetreExamen = await page.evaluate(() => {
    const sauvegarde = devoirsLireStore();
    const cle = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
        '-' + String(d.getDate()).padStart(2, '0');
    const aujourdhui = new Date();
    const dans = n => new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() + n);
    const idx = indexJourCourant();
    const base = [{ id: 'repas-local', title: 'Déjeuner', startTime: '12:00', endTime: '13:00', type: 'meal' }];
    try {
        devoirsEcrireStore({ bac: false, devoirs: [], examens: [
            { id: 'loin-local', matiere: 'Physique', date: cle(dans(90)), debut: '08:00', fin: '10:00' }
        ] });
        const loin = devoirsAdapterJour(base.slice(), idx);
        devoirsEcrireStore({ bac: false, devoirs: [], examens: [
            { id: 'proche-local', matiere: 'Physique', date: cle(dans(14)), debut: '08:00', fin: '10:00' },
            { id: 'loin-local', matiere: 'Chimie', date: cle(dans(90)), debut: '08:00', fin: '10:00' }
        ] });
        const proche = devoirsAdapterJour(base.slice(), idx);
        return {
            pasDeRevisionLoin: !loin.some(ev => ev.devoirsBloc),
            revisionJ14: proche.some(ev => ev.devoirsBloc && /Physique/.test(ev.title)),
            autreExamenIgnore: !proche.some(ev => ev.devoirsBloc && /Chimie/.test(ev.title)),
            repasGarde: proche.some(ev => ev.id === 'repas-local')
        };
    } finally {
        devoirsEcrireStore(sauvegarde);
    }
});
if (!fenetreExamen || Object.values(fenetreExamen).some(resultat => !resultat)) {
    echec('fenêtre de préparation des examens : ' + JSON.stringify(fenetreExamen));
}

/* Lots 1 et 2.3/2.4 : import et aperçu réellement visibles dans
   les deux onglets. Le test ne touche qu'au stockage de CE navigateur. */
await page.evaluate(() => {
    navigateTo('devoirs');
    devoirsBasculerOnglet('examens');
    document.getElementById('devoirsTexteColleExam').value = 'Physique — 31/02/2027, 08h00 à 10h00';
    devoirsLireDocument('examens');
});
/* L'aperçu doit atteindre réellement le viewport après la frame de
   rendu : mesurer dans le même appel que scrollIntoView est prématuré. */
let apercuVisible = false;
try {
    await page.waitForFunction(() => {
        const zone = document.getElementById('devoirsConfirmation');
        const rect = zone.getBoundingClientRect();
        return !!zone.querySelector('[data-prop]') && !!zone.querySelector('.prop-date') &&
            !zone.querySelector('.prop-date').value && rect.height > 0 &&
            rect.top < innerHeight && rect.bottom > 0 &&
            !document.getElementById('onglet-devoirs').contains(zone) &&
            !document.getElementById('onglet-examens').contains(zone);
    }, null, { timeout: 5000 });
    apercuVisible = true;
} catch (e) {
    console.error('aperçu après rendu : ' + JSON.stringify(await page.evaluate(() => {
        const panel = document.getElementById('panelDevoirs');
        const rect = document.getElementById('devoirsConfirmation').getBoundingClientRect();
        return { panel: panel.className, scrollTop: panel.scrollTop,
            top: rect.top, bottom: rect.bottom, height: rect.height, viewport: innerHeight };
    })));
}
const importExamens = await page.evaluate((apercuVisible) => {
    const original = devoirsLireStore();
    const zone = document.getElementById('devoirsConfirmation');
    const date = zone.querySelector('.prop-date');
    const dateSignalee = document.getElementById('exaOcrStatut').textContent.includes('Date à préciser');
    const aucunAjout = devoirsLireStore().examens.length;
    devoirsConfirmerPropositions('examens');
    const refusDate = devoirsLireStore().examens.length === aucunAjout &&
        zone.querySelector('.prop-date') === date;
    const demain = new Date();
    demain.setDate(demain.getDate() + 10);
    date.value = demain.getFullYear() + '-' + String(demain.getMonth() + 1).padStart(2, '0') +
        '-' + String(demain.getDate()).padStart(2, '0');
    document.getElementById('devoirsTexteColle').value = 'brouillon devoir';
    devoirsBasculerOnglet('devoirs');
    const visibleApresChangement = zone.getBoundingClientRect().height > 0;
    devoirsConfirmerPropositions('examens');
    const ajouteDansExamens = devoirsLireStore().examens.length === aucunAjout + 1 &&
        devoirsLireStore().devoirs.length === original.devoirs.length;
    const bilanBonOnglet = document.getElementById('exaOcrStatut').textContent.includes('ajouté');
    devoirsBasculerOnglet('examens');
    document.getElementById('devoirsTexteColleExam').value = 'Physique — 31/02/2027, 08h00 à 10h00';
    devoirsLireDocument('examens');
    devoirsBasculerOnglet('devoirs');
    devoirsViderPropositions();
    const autreBrouillonGarde = document.getElementById('devoirsTexteColle').value === 'brouillon devoir';
    devoirsBasculerOnglet('devoirs');
    devoirsMontrerPropositions('', 'devoirs', true);
    const ligneOcrVide = zone.querySelector('[data-prop]');
    const champsCompleter = !!ligneOcrVide && !!zone.querySelector('.prop-matiere') &&
        !!zone.querySelector('.prop-date') &&
        document.getElementById('devoirsOcrStatut').textContent.includes('Complète la ligne');
    devoirsConfirmerPropositions('devoirs');
    const rienPlanifieSansMatiere = devoirsLireStore().devoirs.length === original.devoirs.length &&
        document.activeElement === zone.querySelector('.prop-matiere');
    devoirsViderPropositions();
    devoirsEcrireStore(original);
    devoirsRendre();
    document.getElementById('devoirsTexteColle').value = '';
    navigateTo('planning');
    return { apercuVisible, dateSignalee, refusDate, visibleApresChangement,
        ajouteDansExamens, bilanBonOnglet, autreBrouillonGarde,
        champsCompleter, rienPlanifieSansMatiere };
}, apercuVisible);
if (!importExamens || Object.values(importExamens).some(resultat => !resultat)) {
    echec('aperçu commun, date à préciser et confirmation des examens : ' + JSON.stringify(importExamens));
}

/* Le changement du fichier dans Examens déclenche bien la lecture ;
   reconnaissance simulée ici pour tester l'interface sans gros OCR. */
await page.evaluate(() => {
    navigateTo('devoirs');
    devoirsBasculerOnglet('examens');
    window.__lecturePhotoOriginale = devoirsOcrImage;
    window.devoirsOcrImage = () => Promise.resolve('Physique — 31/02/2027, 08h00 à 10h00');
});
await page.locator('#devoirsFichierExam').setInputFiles({
    name: 'planning.png', mimeType: 'image/png', buffer: Buffer.from('photo simulée')
});
try {
    await page.waitForFunction(() => document.getElementById('exaOcrStatut')?.textContent.includes('Date à préciser'),
        null, { timeout: 10000 });
} catch (e) {
    echec('sélectionner une photo dans Examens ne déclenche pas la lecture');
}
await page.evaluate(() => {
    window.devoirsOcrImage = window.__lecturePhotoOriginale;
    delete window.__lecturePhotoOriginale;
    devoirsViderPropositions();
    navigateTo('planning');
});

await page.waitForFunction(() => {
    const zone = document.querySelector('#eventsContainer');
    return zone && zone.textContent.trim().length > 30;
}, null, { timeout: 60000 });

/* 5. le popup du bac ne revient pas : la réponse est déjà donnée */
if (await page.evaluate(() => !!document.getElementById('bacQuestionModal'))) {
    echec('le popup du bac est réapparu alors que la réponse est déjà donnée');
}

/* 1 et 2. aujourd'hui : la préparation du devoir de demain est affichée,
   avec son compte à rebours */
const texteJour = await page.evaluate(() => document.querySelector('#eventsContainer').textContent);
if (texteJour.indexOf('Révision · Chimie') === -1) {
    echec("la séance de révision du devoir de demain n'apparaît pas dans le planning du jour. Contenu : "
        + texteJour.slice(0, 400));
}
if (texteJour.indexOf('dans ') === -1 && texteJour.indexOf('demain') === -1 && texteJour.indexOf("aujourd'hui") === -1) {
    echec('le compte à rebours manque sous les blocs de préparation');
}

/* 3 et 4. la semaine entière, calculée par le vrai moteur du site */
const semaine = await page.evaluate(() => {
    const idx = (d) => (d.getDay() === 0 ? 6 : d.getDay() - 1);
    const aujourdhui = new Date();
    const lundi = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - idx(aujourdhui));
    const jours = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + i);
        const cle = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        let evts = [];
        let panne = '';
        try {
            evts = generateDayEvents(i).map(function (e) {
                return (e.title || '') + ' ' + (e.startTime || '') + '-' + (e.endTime || '');
            });
        } catch (e) {
            panne = String(e && e.message || e);
        }
        jours.push({ cle: cle, evts: evts, panne: panne });
    }
    return jours;
});

const cleDemain = jourCle(demain);
if (!semaine.some(j => j.evts.some(t => t.indexOf('Révision · Physique') !== -1))) {
    /* le journal dit exactement ce que le planning a reçu, jour par
       jour, pour que la panne se lise sans revenir sur le site */
    console.log('journal des sept jours :');
    semaine.forEach(function (j) {
        console.log('  ' + j.cle + (j.panne ? ' — ERREUR ' + j.panne : ' : ' + j.evts.join(' | ')));
    });
    console.log('programme du jour : ' + JSON.stringify(await page.evaluate(function () {
        try {
            return {
                devoirs: (devoirsLireStore().devoirs || []).map(function (d) { return d.matiere + ' ' + d.date + ' ' + (d.seances == null ? 'auto' : d.seances) + ' → ' + devoirsNombreSeances(d); }),
                examens: (devoirsLireStore().examens || []).map(function (d) { return d.matiere + ' ' + d.date + ' ' + (d.debut || ''); }),
                sujetsDevoirs: (typeof planningSujetsDesDevoirs === 'function' ? planningSujetsDesDevoirs() : []).map(function (s) { return s.name; })
            };
        } catch (e) { return { erreur: String(e && e.message || e) }; }
    })));
    echec("les révisions de l'examen de Physique n'apparaissent sur aucun jour de la semaine : "
        + JSON.stringify(semaine.map(j => j.cle)));
}
const jourDevoir = semaine.filter(j => j.cle === cleDemain)[0];
if (jourDevoir) {
    if (!jourDevoir.evts.some(t => t.indexOf('Devoir · Chimie 08:00-10:00') !== -1)) {
        echec("le devoir de Chimie n'occupe pas ses heures demain : " + JSON.stringify(jourDevoir.evts));
    }
} else {
    console.log('information : le devoir est hors de la semaine affichée (fin de semaine), le bloc du jour J se vérifie à la semaine prochaine');
}

/* 7. chaque élève a ses propres matières : l'analyse du document
   (le vrai code du site, avec le profil installé) ne propose que ce
   que CET élève suit — puis un autre élève est simulé dans la même
   page : le même document doit lui proposer autre chose. */
const futur = new Date(Date.now() + 10 * 86400000);
const jjmm = String(futur.getDate()).padStart(2, '0') + '/' + String(futur.getMonth() + 1).padStart(2, '0');
const parEleve = await page.evaluate(function (dateDoc) {
    /* l'élève installé : Mathématiques AA, Chimie, Physique */
    const eleveA = devoirsParserTexte(
        'Mathematics — ' + dateDoc + ', 8h00 à 10h00\n' +
        'Economics — ' + dateDoc + ', 13h00 à 15h00\n' +
        'Chimie — ' + dateDoc + ', 15h00 à 17h00').map(p => p.matiere);
    /* un autre élève, simulé : Économie et Philosophie */
    const sujets = subjects, optionnels = optionalSubjects;
    subjects = [{ name: 'Économie', level: 'HL' }];
    optionalSubjects = [{ name: 'Philosophie', level: 'SL' }];
    const eleveB = devoirsParserTexte(
        'Mathematics — ' + dateDoc + ', 8h00 à 10h00\n' +
        'Economics — ' + dateDoc + ', 13h00 à 15h00\n' +
        'Chimie — ' + dateDoc + ', 15h00 à 17h00').map(p => p.matiere);
    subjects = sujets;
    optionalSubjects = optionnels;
    return { eleveA: eleveA, eleveB: eleveB };
}, jjmm);
if (parEleve.eleveA.join(',') !== 'Mathématiques AA,Chimie') {
    echec("l'analyse ne suit pas les matières de l'élève installé : " + JSON.stringify(parEleve.eleveA));
}
if (parEleve.eleveB.join(',') !== 'Économie') {
    echec("le même document doit changer selon l'élève (Économie attendue pour l'autre élève) : " + JSON.stringify(parEleve.eleveB));
}

/* 8. l'emploi du temps scolaire : les vrais cours remplacent les
   créneaux génériques et les heures creuses reçoivent du travail —
   vérifié avec le vrai moteur du site déployé, sur un jour de classe
   de la semaine affichée (demain s'il est de classe, aujourd'hui le
   vendredi, sinon le lundi affiché). Le temps de la vérification, le
   devoir et l'examen du scénario sont mis de côté : sans eux, le soir
   reste un soir de classe ordinaire. Tout est remis en place ensuite. */
const idxJourDepart = (new Date().getDay() + 6) % 7;
const idxJourSuivant = idxJourDepart + 1;
const idxVerifie = (idxJourSuivant >= 1 && idxJourSuivant <= 4) ? idxJourSuivant : (idxJourDepart <= 4 ? idxJourDepart : 0);
const emploi = await page.evaluate(function (idx) {
    const sauveEmploi = localStorage.getItem('studyPlanIB_emploiScolaire');
    const sauveDevoirs = localStorage.getItem('studyPlanIB_devoirs');
    const figeSauve = typeof emploiFige !== 'undefined' ? emploiFige : null;
    try {
        localStorage.setItem('studyPlanIB_devoirs', JSON.stringify({ bac: false, bacDemande: 2, devoirs: [], examens: [] }));
        localStorage.setItem('studyPlanIB_emploiScolaire', JSON.stringify({
            at: new Date().toISOString(),
            jours: (() => { const j = [[], [], [], [], [], [], []]; j[idx] = [
                { id: 'e1', nom: 'Maths AA', matiere: 'Mathématiques AA', debut: '08:00', fin: '09:30' },
                { id: 'e2', nom: 'Chimie', matiere: 'Chimie', debut: '11:10', fin: '12:40' }
            ]; return j; })()
        }));
        emploiFige = null;     /* le planning figé pendant la semaine de révision ne doit pas resservir ici */
        emploiNePasSauver = 1; /* la vérification ne fige rien */
        const evts = generateDayEvents(idx);
        return {
            lignes: evts.map(e => (e.id || '') + '|' + (e.title || '') + '|' + (e.startTime || '') + '-' + (e.endTime || '')),
            programme: (typeof emploiScolaireProgramme === 'function' ? emploiScolaireProgramme(idx) : []).map(s => s.name)
        };
    } finally {
        if (sauveEmploi == null) localStorage.removeItem('studyPlanIB_emploiScolaire'); else localStorage.setItem('studyPlanIB_emploiScolaire', sauveEmploi);
        if (sauveDevoirs == null) localStorage.removeItem('studyPlanIB_devoirs'); else localStorage.setItem('studyPlanIB_devoirs', sauveDevoirs);
        emploiFige = figeSauve;
        emploiNePasSauver = 0;
    }
}, idxVerifie);
if (!emploi.lignes.some(l => l.indexOf('Maths AA|08:00-09:30') !== -1 || l.indexOf('|Maths AA|') !== -1 && l.indexOf('08:00-09:30') !== -1)) {
    echec("le vrai cours de Maths AA (8h00-9h30) n'apparaît pas : " + JSON.stringify(emploi.lignes.slice(0, 12)));
}
if (!emploi.lignes.some(l => l.indexOf('Chimie|11:10-12:40') !== -1 || l.indexOf('|Chimie|') !== -1 && l.indexOf('11:10-12:40') !== -1)) {
    echec("le vrai cours de Chimie (11h10-12h40) n'apparaît pas : " + JSON.stringify(emploi.lignes.slice(0, 12)));
}
if (emploi.lignes.some(l => l.indexOf('school1|') !== -1 || l.indexOf('school2|') !== -1)) {
    echec('les créneaux Cours génériques doivent disparaître quand lemploi du temps est chargé : ' + JSON.stringify(emploi.lignes.slice(0, 12)));
}
if (!emploi.lignes.some(l => l.indexOf('emploi-') !== -1)) {
    echec("l'heure creuse 9h30-11h10 doit recevoir du travail : " + JSON.stringify(emploi.lignes.slice(0, 12)));
}
/* le programme du planning suit l'emploi du temps : le soir, les
   matières vues dans la journée passent en premier, puis le complément */
if (emploi.programme.join(',') !== 'Mathématiques AA,Chimie,Physique') {
    echec('le programme doit suivre l\'emploi du temps (matières vues puis complément) : ' + emploi.programme.join(','));
}
if (!emploi.lignes.some(l => l.indexOf('study1|Révisions Mathématiques AA|') !== -1)) {
    echec('le soir doit réviser la première matière vue dans la journée (Mathématiques AA) : ' + JSON.stringify(emploi.lignes.slice(0, 16)));
}

/* 8bis. le programme trimestriel des devoirs de niveau : l'analyse
   propose les matières de l'élève (sans heures du document), les
   propositions reçoivent celles du créneau DEVOIR DE NIVEAU de
   l'emploi du temps, le créneau générique disparaît le jour du devoir,
   et le nombre de séances choisi est tenu jour par jour — même sur un
   planning plein — par le vrai moteur du site */
const devoirsNiveau = await page.evaluate(function () {
    const cle = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const mois = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
    const sauveEmploi = localStorage.getItem('studyPlanIB_emploiScolaire');
    const sauveDevoirs = localStorage.getItem('studyPlanIB_devoirs');
    const aujourdhui = new Date();
    const idxJour = (aujourdhui.getDay() + 6) % 7;
    /* les prochains mercredis, pour le programme du trimestre */
    const mer1 = new Date(aujourdhui.getTime() + 86400000);
    while (mer1.getDay() !== 3) mer1.setDate(mer1.getDate() + 1);
    const mer2 = new Date(mer1.getTime() + 7 * 86400000);
    /* le vendredi de la semaine affichée (aujourd'hui si on est
       vendredi) : le devoir y remplacera le créneau ; le week-end n'a
       pas de cours dans l'emploi du temps */
    const vendredi = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() + (4 - idxJour));
    const idxCible = idxJour <= 4 ? 4 : -1;
    const demain = new Date(aujourdhui.getTime() + 86400000);
    /* l'emploi du temps : le créneau du mercredi, et des cours + créneau
       le jour ciblé */
    const jours = [[], [], [], [], [], [], []];
    jours[2] = [{ id: 't1', nom: 'DEVOIR DE NIVEAU', matiere: '', debut: '13:00', fin: '16:30' }];
    if (idxCible >= 0) {
        jours[idxCible] = [
            { id: 't2', nom: 'Géographie', matiere: 'Histoire', debut: '08:00', fin: '09:25' },
            { id: 't3', nom: 'DEVOIR DE NIVEAU', matiere: '', debut: '13:00', fin: '16:30' }
        ];
    }
    try {
        localStorage.setItem('studyPlanIB_emploiScolaire', JSON.stringify({ at: new Date().toISOString(), jours: jours }));
        /* 1. le programme du trimestre : deux matières suivies sans
           heures, une matière non suivie */
        const programme = 'PROGRAMME DES DEVOIRS DE NIVEAU - TRIMESTRE 1\n' +
            'Mercredi ' + mer1.getDate() + ' ' + mois[mer1.getMonth()] + ' : Mathématiques AA, Chimie\n' +
            'Mercredi ' + mer2.getDate() + ' ' + mois[mer2.getMonth()] + ' : Économie';
        const props = devoirsParserTexte(programme);
        const analyses = props.map(function (p) { return { matiere: p.matiere, date: p.date, debut: p.debut, fin: p.fin }; });
        /* 2. les propositions sans heures reçoivent le créneau du
           mercredi, partagé entre les deux matières */
        devoirsRemplirCreneaux(props);
        const preremplies = props.map(function (p) { return p.matiere + ' ' + p.debut + '-' + p.fin; });
        /* 3. le créneau remplacé par le devoir réel, le jour ciblé */
        let creneau = null;
        if (idxCible >= 0) {
            localStorage.setItem('studyPlanIB_devoirs', JSON.stringify({
                bac: false, bacDemande: 2,
                devoirs: [{ id: 'e2eniveau', matiere: 'Mathématiques AA', date: cle(vendredi), ajouteAt: new Date().toISOString() }],
                examens: []
            }));
            const evts = generateDayEvents(idxCible);
            creneau = {
                generique: evts.some(function (e) { return String(e.title || '').indexOf('DEVOIR DE NIVEAU') !== -1; }),
                devoir: evts.filter(function (e) { return String(e.title || '').indexOf('Devoir · Mathématiques AA') !== -1; })
                    .map(function (e) { return (e.startTime || '') + '-' + (e.endTime || ''); }).join(',')
            };
        }
        /* 4. la garantie : 3 séances choisies pour un devoir de Chimie
           demain — le compte doit être exact sur chaque jour affiché */
        localStorage.setItem('studyPlanIB_devoirs', JSON.stringify({
            bac: false, bacDemande: 2,
            devoirs: [{ id: 'e2egarantie', matiere: 'Chimie', date: cle(demain), debut: '08:00', fin: '10:00', seances: 3, ajouteAt: new Date().toISOString() }],
            examens: []
        }));
        /* les séances se comptent de date à date : le jour du devoir
           n'en porte pas, la veille en porte toujours */
        const joursRestants = Math.max(1, Math.round((new Date(cle(demain) + 'T00:00:00').getTime() - new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate()).getTime()) / 86400000));
        const rep = devoirsRepartitionSeances(3, joursRestants);
        const lundi = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - idxJour);
        const parJour = [];
        let total = 0;
        for (let i = 0; i < 7; i++) {
            const off = Math.round((new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + i).getTime() - new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate()).getTime()) / 86400000);
            const attendu = rep[off] || 0;
            const pose = generateDayEvents(i).filter(function (e) {
                return e.devoirsBloc && String(e.title || '').indexOf('Révision · Chimie') === 0;
            }).length;
            parJour.push(off + ':' + pose + '/' + attendu);
            total += pose;
        }
        return { analyses: analyses, preremplies: preremplies, creneau: creneau, parJour: parJour, total: total };
    } finally {
        if (sauveEmploi == null) localStorage.removeItem('studyPlanIB_emploiScolaire'); else localStorage.setItem('studyPlanIB_emploiScolaire', sauveEmploi);
        if (sauveDevoirs == null) localStorage.removeItem('studyPlanIB_devoirs'); else localStorage.setItem('studyPlanIB_devoirs', sauveDevoirs);
    }
});
const mer1Cle = await page.evaluate(function () {
    const m = new Date(Date.now() + 86400000);
    while (m.getDay() !== 3) m.setDate(m.getDate() + 1);
    return m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0') + '-' + String(m.getDate()).padStart(2, '0');
});
if (devoirsNiveau.analyses.length !== 2) {
    echec("le programme trimestriel doit proposer exactement les 2 matières suivies (Économie non suivie) : " + JSON.stringify(devoirsNiveau.analyses));
} else {
    if (devoirsNiveau.analyses.some(function (p) { return p.date !== mer1Cle; })) {
        echec('les propositions du programme doivent porter sur le mercredi annoncé : ' + JSON.stringify(devoirsNiveau.analyses));
    }
    if (devoirsNiveau.analyses.some(function (p) { return p.debut !== '' || p.fin !== ''; })) {
        echec('sans heures dans le document, les propositions doivent rester à compléter : ' + JSON.stringify(devoirsNiveau.analyses));
    }
}
const formatHeures = / [0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}$/;
if (devoirsNiveau.preremplies.length !== 2 ||
    devoirsNiveau.preremplies.some(function (t) { return !formatHeures.test(t); }) ||
    devoirsNiveau.preremplies[0].indexOf(' 13:00-') === -1) {
    echec('les propositions sans heures doivent recevoir le créneau du mercredi partagé : ' + JSON.stringify(devoirsNiveau.preremplies));
}
if (devoirsNiveau.creneau) {
    if (devoirsNiveau.creneau.generique) {
        echec("le créneau DEVOIR DE NIVEAU doit disparaître le jour du devoir");
    }
    if (devoirsNiveau.creneau.devoir !== '13:00-16:30') {
        echec("le devoir sans heures doit occuper le créneau entier (13h00-16h30) : " + devoirsNiveau.creneau.devoir);
    }
} else {
    console.log('information : fin de semaine (vendredi soir ou week-end), le remplacement du créneau se vérifie la semaine prochaine');
}
devoirsNiveau.parJour.forEach(function (r) {
    const parts = r.split(':'), compte = parts[1].split('/');
    if (compte[0] !== compte[1]) {
        echec('les séances choisies doivent être posées au compte exact (' + r + ') : ' + JSON.stringify(devoirsNiveau.parJour));
    }
});
if (devoirsNiveau.total < 1) {
    echec('au moins une séance du devoir doit apparaître dans la semaine affichée : ' + JSON.stringify(devoirsNiveau.parJour));
}

/* 8ter. la liste des devoirs montre les séances et permet de les
   changer à tout moment */
await page.evaluate(() => { navigateTo('devoirs'); });
const listeSeances = await page.evaluate(function () {
    const sauve = localStorage.getItem('studyPlanIB_devoirs');
    try {
        const dateLocale = function (n) {
            const d = new Date(Date.now() + n * 86400000);
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        };
        localStorage.setItem('studyPlanIB_devoirs', JSON.stringify({
            bac: false, bacDemande: 2,
            devoirs: [
                { id: 'e2eliste', matiere: 'Chimie', date: dateLocale(3), debut: '13:00', fin: '14:30', seances: 3, ajouteAt: new Date().toISOString() },
                { id: 'e2eauto', matiere: 'Physique', date: dateLocale(6), debut: '08:00', fin: '10:00', seances: 'auto', ajouteAt: new Date().toISOString() }
            ],
            examens: []
        }));
        devoirsRendre();
        const zone = document.getElementById('devoirsListe');
        return {
            badge: zone ? zone.innerHTML.indexOf('📚 3') !== -1 : false,
            auto: zone ? zone.innerHTML.indexOf('✨ 2') !== -1 && zone.innerHTML.indexOf('choisies par le site') !== -1 : false,
            editeur: typeof devoirsEditerSeances === 'function',
            bouton: zone ? zone.innerHTML.indexOf('devoirsEditerSeances') !== -1 : false
        };
    } finally {
        if (sauve == null) localStorage.removeItem('studyPlanIB_devoirs'); else localStorage.setItem('studyPlanIB_devoirs', sauve);
    }
});
if (!listeSeances.editeur || !listeSeances.badge || !listeSeances.bouton) {
    echec('la liste des devoirs doit montrer les séances choisies et permettre de les changer : ' + JSON.stringify(listeSeances));
}
if (!listeSeances.auto) {
    echec('la liste doit montrer le nombre de séances que le site programme (✨ 2, choisies par le site) : ' + JSON.stringify(listeSeances));
}
await page.evaluate(() => { navigateTo('planning'); });

/* 8quater. les jours fériés : une date pour une semaine — la page
   montre cette semaine et la suivante avec leurs vraies dates, et le
   jour posé libère sa journée dans le planning */
const feriesE2E = await page.evaluate(function () {
    const auj = new Date();
    const idx = (auj.getDay() + 6) % 7;
    const demainIdx = idx + 1;
    const res = { demainIdx: demainIdx, sections: '', pastilleDate: false, pose: false, carteLibre: false };
    try {
        navigateTo('feries');
        const grille = document.getElementById('holidayDaysGrid');
        res.sections = grille ? grille.textContent : '';
        res.pastilleDate = !!grille && /\d{1,2}\/\d{2}/.test(grille.textContent);
        if (demainIdx <= 6) {
            const cle = holidayCleDate(holidayDateDuJour(demainIdx, 0));
            holidayBasculerDate(cle);
            holidayPoserMode(cle, 'free');
            res.pose = holidayMode(demainIdx) === 'free';
            navigateTo('planning');
            selectDay(demainIdx);
            const conteneur = document.getElementById('eventsContainer');
            res.carteLibre = !!conteneur && conteneur.innerHTML.indexOf('jour-libre') !== -1;
        }
        return res;
    } finally {
        if (demainIdx <= 6) {
            holidayToutEffacer();
            navigateTo('planning');
            selectDay(idx);
        }
    }
});
if (feriesE2E.demainIdx > 6) {
    console.log('information : dimanche — la pose d\'un jour férié de la semaine affichée se vérifie la semaine prochaine');
} else {
    if (feriesE2E.sections.indexOf('Cette semaine') === -1 || feriesE2E.sections.indexOf('Semaine suivante') === -1) {
        echec('la page des jours fériés doit montrer cette semaine et la suivante : ' + JSON.stringify(feriesE2E.sections));
    }
    if (!feriesE2E.pastilleDate) {
        echec('les pastilles des jours fériés doivent porter leurs dates : ' + JSON.stringify(feriesE2E.sections));
    }
    if (!feriesE2E.pose) {
        echec('la pose d\'un jour férié pour demain doit être enregistrée');
    }
    if (!feriesE2E.carteLibre) {
        echec('le jour férié libre doit montrer la carte « Jour libre » dans le planning');
    }
}

/* 9. le bouton Continuer de la page Emploi du temps mène vraiment au
   planning (la page se ferme), et le Retour y ramène depuis le menu */
await page.evaluate(() => { showEmploiPage(); });
if (!await page.evaluate(() => document.getElementById('emploiModal').classList.contains('active'))) {
    echec("la page Emploi du temps ne s'ouvre pas");
}
await page.click('#emploiModal .btn-continue');
await page.waitForFunction(() =>
    !document.getElementById('emploiModal').classList.contains('active') &&
    document.getElementById('planningModal').classList.contains('active'), null, { timeout: 15000 });
await page.evaluate(() => { navigateTo('emploi'); });
await page.click('#emploiModal .btn-back');
await page.waitForFunction(() =>
    !document.getElementById('emploiModal').classList.contains('active') &&
    document.getElementById('planningModal').classList.contains('active'), null, { timeout: 15000 });

/* 10. la musique : la tomate au menu Pomodoro, le panneau Sons sur la
   page Séance du jour, et la section Playlist totalement retirée */
const menuPomodoro = await page.evaluate(() => {
    const bouton = document.getElementById('menuMinuteur');
    return bouton ? bouton.textContent : '';
});
if (menuPomodoro.indexOf('🍅') === -1 || menuPomodoro.indexOf('⏱') !== -1) {
    echec("le menu Pomodoro doit montrer une tomate 🍅 et non le minuteur : " + menuPomodoro);
}
if (await page.evaluate(() => !!document.getElementById('focusBtnPlaylist'))) {
    echec("le bouton Playlist doit avoir disparu du minuteur");
}
await page.evaluate(() => { navigateTo('seances'); });
const pageSeances = await page.evaluate(() => ({
    sons: !!document.getElementById('accueilBtnSons'),
    playlist: !!document.getElementById('accueilBtnPlaylist'),
    panneauPlaylist: !!document.getElementById('focusPlaylist'),
    playlistLire: typeof playlistLire !== 'undefined'
}));
if (!pageSeances.sons) {
    echec("la page Séance de révision du jour doit avoir le bouton Sons");
}
if (pageSeances.playlist || pageSeances.panneauPlaylist || pageSeances.playlistLire) {
    echec('la section Playlist doit avoir totalement disparu : ' + JSON.stringify(pageSeances));
}
const sonsAccueil = await page.evaluate(() => {
    focusBasculerSonsAccueil();
    const panneau = document.getElementById('accueilSons');
    const grille = document.querySelectorAll('#accueilSonsGrille .focus-son').length;
    return { ouvert: panneau && !panneau.hidden, grille: grille };
});
if (!sonsAccueil.ouvert || sonsAccueil.grille < 10) {
    echec("le panneau Sons de la page Séance du jour ne s'affiche pas ou sa grille est vide : " + JSON.stringify(sonsAccueil));
}
/* la galerie des décors : le bouton existe, la bande se remplit des
   vingt-trois décors d'avant plus les neuf photos d'octobre 2026, et
   choisir une photo pose le décor de la page Séance */
await page.evaluate(() => { focusFermerMusique(); });
const galerieAccueil = await page.evaluate(() => {
    const bouton = document.getElementById('accueilBtnFonds');
    if (!bouton) return { bouton: false };
    accueilBasculerFonds();
    const bande = document.getElementById('accueilFonds');
    const vignettes = bande ? bande.querySelectorAll('.focus-vignette') : [];
    const noms = FOCUS_FONDS.map(function (f) { return f.id; });
    const indexLac = noms.indexOf('lac-alpin');
    if (indexLac >= 0 && vignettes[indexLac]) vignettes[indexLac].click();
    return {
        bouton: true,
        ouvert: !!bande && !bande.hidden,
        vignettes: vignettes.length,
        lacAlpin: indexLac !== -1,
        index: indexLac,
        choix: (function () {
            const actifs = document.querySelectorAll('#accueilFonds .focus-vignette.is-on').length;
            return actifs;
        })(),
        garde: (function () { try { return localStorage.getItem('studyPlanIB_focusFond'); } catch (e) { return ''; } })()
    };
});
if (!galerieAccueil.bouton || !galerieAccueil.ouvert) {
    echec("la page Séance du jour doit offrir le bouton « Changer l'image » et sa galerie : " + JSON.stringify(galerieAccueil));
}
if (galerieAccueil.vignettes < 32) {
    echec('la galerie doit proposer les 32 décors (23 + 9 photos) : ' + galerieAccueil.vignettes);
}
if (!galerieAccueil.lacAlpin || galerieAccueil.choix !== 1) {
    echec('choisir « Lac alpin » doit marquer cette photo dans la galerie : ' + JSON.stringify(galerieAccueil));
}
/* l'image est décodée avant d'être posée : on l'attend */
let fondAlpin = false;
try {
    await page.waitForFunction(function () {
        const fond = document.getElementById('focusAccueilFond');
        return !!fond && String(fond.style.backgroundImage || '').indexOf('lac-alpin') !== -1;
    }, null, { timeout: 15000 });
    fondAlpin = true;
} catch (e) {}
if (!fondAlpin) {
    echec('choisir « Lac alpin » doit poser ce décor sur la page Séance : ' + JSON.stringify(galerieAccueil));
}
/* le décor choisi ici est celui que le minuteur retrouvera */
if (String(galerieAccueil.garde) !== String(galerieAccueil.index)) {
    echec('le décor choisi sur la page Séance doit être gardé pour le minuteur : ' + JSON.stringify(galerieAccueil));
}
/* la navigation referme le panneau des sons et la galerie */
await page.evaluate(() => { navigateTo('planning'); });
const panneauReferme = await page.evaluate(() => {
    const panneau = document.getElementById('accueilSons');
    const galerie = document.getElementById('accueilFonds');
    return (!panneau || panneau.hidden) && (!galerie || galerie.hidden);
});
if (!panneauReferme) {
    echec("la navigation doit refermer le panneau des sons et la galerie de la page Séance");
}

/* Lot 3 : la page Séance lit aujourd'hui, pas le jour cliqué dans le
   planning. Horloge et trois créneaux simulés, sans modifier le profil. */
const fondAvantLots34 = await page.evaluate(() => localStorage.getItem('studyPlanIB_focusFond'));
const gardeSeances = await page.evaluate(() => {
    const ancienJour = selectedDay;
    const ancienneGeneration = generateDayEvents;
    const ancienneHeure = focusMinutesMaintenant;
    selectedDay = (indexJourCourant() + 1) % 7;
    focusMinutesMaintenant = () => 10 * 60 + 30;
    generateDayEvents = (jour) => jour === indexJourCourant() ? [
        { id: 'lot3-passe', title: 'Passée', startTime: '09:00', endTime: '10:00', type: 'study' },
        { id: 'lot3-actuelle', title: 'En cours', startTime: '10:00', endTime: '11:00', type: 'study' },
        { id: 'lot3-future', title: 'À venir', startTime: '11:00', endTime: '12:00', type: 'study' }
    ] : [{ id: 'lot3-autre-jour', title: 'Mauvais jour', startTime: '10:00', endTime: '11:00', type: 'study' }];
    navigateTo('seances');
    focusPeindreAccueil();
    const cartes = [...document.querySelectorAll('#focusAccueilListe .focus-seance')];
    const resultat = {
        jourPlanningInchange: selectedDay === (indexJourCourant() + 1) % 7,
        jourSeance: focusJourIndex() === indexJourCourant(),
        date: document.getElementById('focusAccueilBonjour').textContent.includes(focusDateTexte(indexJourCourant())),
        cartes: cartes.length, etats: cartes.map(b => b.disabled),
        choix: focusSeanceChoisie, lancer: !document.getElementById('focusAccueilContinuer').disabled,
        sansLibre: !document.querySelector('#panelSeances .focus-accueil-libre')
    };
    focusEntrerPiece(true);
    resultat.blocageLibre = document.getElementById('panelSeances').classList.contains('active');
    focusEntrerPiece();
    resultat.ouvertureActuelle = document.getElementById('panelPomodoro').classList.contains('active') &&
        !!sessionStorage.getItem('studyPlanIB_focusSeanceEnCours');
    focusMinutesMaintenant = () => 12 * 60 + 30;
    focusBasculer();
    resultat.blocageMinuteur = !focusEtat.running && document.getElementById('panelSeances').classList.contains('active');
    focusEntrerPiece();
    resultat.blocagePasse = document.getElementById('panelSeances').classList.contains('active');
    focusMinutesMaintenant = ancienneHeure;
    generateDayEvents = ancienneGeneration;
    selectedDay = ancienJour;
    focusPoserFond(5);
    navigateTo('planning');
    navigateTo('seances');
    resultat.fondConserveAuRetour = focusEtat.fond === 5 && localStorage.getItem('studyPlanIB_focusFond') === '5';
    navigateTo('planning');
    return resultat;
});
if (!gardeSeances.jourPlanningInchange || !gardeSeances.jourSeance || !gardeSeances.date ||
    gardeSeances.cartes !== 3 || gardeSeances.etats.join('|') !== 'true|false|true' ||
    gardeSeances.choix !== 'lot3-actuelle' || !gardeSeances.lancer || !gardeSeances.sansLibre ||
    !gardeSeances.blocageLibre || !gardeSeances.ouvertureActuelle || !gardeSeances.blocageMinuteur ||
    !gardeSeances.blocagePasse || !gardeSeances.fondConserveAuRetour) {
    echec('garde des séances du moment et décor du lot 3 : ' + JSON.stringify(gardeSeances));
}

/* Lots 10–11 : l'identifiant du devoir et ses révisions survivent à
   l'édition ; le même import met à jour au lieu de dupliquer. */
const correctionDevoir = await page.evaluate(() => {
    const avant = devoirsLireStore();
    const date = new Date(Date.now() + 12 * 86400000);
    const cle = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    const id = devoirsAjouter('devoirs', { matiere: 'Physique', date: cle, debut: '08:00', fin: '10:00', seances: 3 });
    navigateTo('devoirs');
    devoirsEditer('devoirs', id);
    const modal = document.getElementById('devoirsEditionModal');
    if (!modal) return { erreur: 'édition inaccessible' };
    modal.querySelector('#devoirsEditDebut').value = '09:00';
    modal.querySelector('#devoirsEditFin').value = '11:00';
    modal.querySelector('#devoirsEditSauver').click();
    const corrige = devoirsLireStore().devoirs.find(d => d.id === id);
    const choix = corrige && corrige.seances === 3 && corrige.debut === '09:00';
    const previsualisation = devoirsChercherDoublon(devoirsLireStore(), 'devoirs', { matiere: 'Physique', date: cle });
    devoirsEcrireStore(avant);
    devoirsRendre();
    navigateTo('planning');
    return { choix, memeId: previsualisation?.id === id, modaleFermee: !modal.isConnected };
});
if (!correctionDevoir.choix || !correctionDevoir.memeId || !correctionDevoir.modaleFermee)
    echec('lots 10–11, édition du devoir : ' + JSON.stringify(correctionDevoir));

/* Lot 5 : un exercice réellement ajouté dans CE navigateur, coché,
   filtré puis relu après rechargement. Aucun envoi distant ni mail. */
const exercicesAvantLot5 = await page.evaluate(() => {
    const ancien = localStorage.getItem('studyPlanIB_exercices');
    localStorage.setItem('studyPlanIB_exercices', '[]');
    exercices = [];
    navigateTo('exercices');
    return ancien;
});
const erreurMatiereExo = await page.evaluate(() => {
    addExercice();
    return !!document.getElementById('exoSubjectErreur').textContent &&
        document.activeElement === document.querySelector('#exoSubjectGrid button');
});
if (!erreurMatiereExo) echec('le formulaire Exercices doit signaler la matière sous le champ et y placer le focus');
await page.locator('#exoSubjectGrid [data-exo-idx="0"]').click();
const erreurContenuExo = await page.evaluate(() => {
    addExercice();
    return !!document.getElementById('exoContenuErreur').textContent &&
        document.activeElement === document.getElementById('exoTextInput');
});
if (!erreurContenuExo) echec('le formulaire Exercices doit signaler la description sous le champ');
await page.locator('#exoTextInput').fill('Exercice témoin du lot cinq');
const erreurDateExo = await page.evaluate(() => {
    addExercice();
    return !!document.getElementById('exoDeadlineErreur').textContent &&
        document.activeElement === document.getElementById('exoDeadline');
});
if (!erreurDateExo) echec('le formulaire Exercices doit demander la date sous le champ');
const demainExo = new Date(Date.now() + 86400000);
await page.locator('#exoDeadline').fill(jourCle(demainExo));
await page.locator('[onclick="addExercice()"]').click();
const exerciceAjoute = await page.evaluate(() => {
    switchExoTab('planifier');
    return { badge: document.getElementById('exoCountBadge').textContent,
        minutes: document.getElementById('planifierContent').textContent,
        id: exercices[0]?.id, filtre: document.querySelector('[data-exo-filtre="tous"]').getAttribute('aria-pressed') };
});
if (!exerciceAjoute.id || !exerciceAjoute.badge.includes('1 exercice') ||
    !exerciceAjoute.minutes.includes('60') && !exerciceAjoute.minutes.includes('1h') ||
    exerciceAjoute.filtre !== 'true') {
    echec('exercice ajouté et compteurs : ' + JSON.stringify(exerciceAjoute));
}
const exerciceDansPlanning = await page.evaluate(() => {
    const id = exercices[0].id, day = indexJourCourant();
    customEvents.push({ id: 'e2e-exercice-fait', day, exoId: id, source: 'exercice', pinned: true,
        title: 'Exercices Physique', startTime: '18:00', endTime: '18:30', type: 'study' });
    exercices[0].scheduledSlot = 'Aujourd’hui · 18:00–18:30';
    localStorage.setItem('studyPlanIB_exercices', JSON.stringify(exercices));
    v3Save();
    return generateDayEvents(day).some(e => e.exoId === id);
});
if (!exerciceDansPlanning) echec('le créneau lié à un exercice à faire doit figurer au planning');
await page.evaluate(() => switchExoTab('liste'));
await page.locator('#exoListContainer [onclick^="basculerExoFait"]').click();
const exerciceFait = await page.evaluate(() => {
    switchExoTab('planifier');
    return { done: exercices[0]?.done, badge: document.getElementById('exoCountBadge').textContent,
        resume: document.getElementById('planifierContent').textContent,
        carte: document.getElementById('exoListContainer').textContent,
        enStock: JSON.parse(localStorage.getItem('studyPlanIB_exercices'))[0]?.done };
});
const exerceRetireDuPlanning = await page.evaluate(() =>
    !generateDayEvents(indexJourCourant()).some(e => e.exoId === exercices[0].id));
if (!exerceRetireDuPlanning) echec('Fait laisse le créneau de cet exercice dans l’emploi du temps');
if (!exerciceFait.done || !exerciceFait.enStock || !exerciceFait.badge.includes('0 exercice') ||
    !exerciceFait.resume.includes('0min') || !exerciceFait.resume.includes('Tous les exercices sont faits') ||
    !exerciceFait.carte.includes('À faire')) echec('état Fait et compteurs : ' + JSON.stringify(exerciceFait));
await page.evaluate(() => switchExoTab('liste'));
await page.locator('[data-exo-filtre="afaire"]').click();
if (!await page.locator('#exoListContainer').textContent().then(t => t.includes('Aucun exercice à faire'))) {
    echec('le filtre à faire garde des exercices déjà terminés');
}
await page.locator('[data-exo-filtre="faits"]').click();
if (!await page.locator('#exoListContainer [onclick^="basculerExoFait"]').count()) {
    echec('le filtre faits doit montrer l’exercice terminé');
}
await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__STUDYPLAN_READY === true && !document.body.classList.contains('booting'), null, { timeout: 60000 });
if (await page.evaluate(() => generateDayEvents(indexJourCourant()).some(e => e.exoId === exercices[0]?.id)))
    echec('un exercice fait réapparaît au premier affichage du planning après rechargement');
const apresRechargement = await page.evaluate(() => {
    navigateTo('exercices');
    switchExoTab('liste');
    return { done: exercices[0]?.done, carte: document.getElementById('exoListContainer').textContent,
        badge: document.getElementById('exoCountBadge').textContent };
});
if (await page.evaluate(() => generateDayEvents(indexJourCourant()).some(e => e.exoId === exercices[0].id)))
    echec('un exercice fait réapparaît dans le planning après rechargement');
if (!apresRechargement.done || !apresRechargement.carte.includes('À faire') ||
    !apresRechargement.badge.includes('0 exercice')) {
    echec('l’état Fait ne survit pas au rechargement : ' + JSON.stringify(apresRechargement));
}
await page.locator('#exoListContainer [onclick^="basculerExoFait"]').click();
const exerciceRetabli = await page.evaluate(() => ({ done: exercices[0]?.done,
    badge: document.getElementById('exoCountBadge').textContent,
    carte: document.getElementById('exoListContainer').textContent }));
if (!await page.evaluate(() => generateDayEvents(indexJourCourant()).some(e => e.exoId === exercices[0].id)))
    echec('remettre À faire ne restaure pas le créneau de l’exercice');
if (exerciceRetabli.done || !exerciceRetabli.badge.includes('1 exercice') ||
    !exerciceRetabli.carte.includes('✓ Fait')) echec('décochement réversible : ' + JSON.stringify(exerciceRetabli));
await page.evaluate((avant) => {
    if (avant == null) localStorage.removeItem('studyPlanIB_exercices');
    else localStorage.setItem('studyPlanIB_exercices', avant);
    exercices = avant ? JSON.parse(avant) : [];
    customEvents = customEvents.filter(e => e && e.id !== 'e2e-exercice-fait');
    v3Save();
    navigateTo('planning');
}, exercicesAvantLot5);

/* Le rechargement utilisé pour le lot 5 prouve aussi la persistance
   du décor du lot 3. Les préférences de ce navigateur seront restaurées. */
const fondApresReload = await page.evaluate(() => {
    navigateTo('seances');
    return { indice: focusEtat.fond, stocke: localStorage.getItem('studyPlanIB_focusFond') };
});
if (fondApresReload.indice !== 5 || fondApresReload.stocke !== '5') {
    echec('le décor de la séance ne survit pas au rechargement : ' + JSON.stringify(fondApresReload));
}
await page.evaluate((avant) => {
    if (avant == null) localStorage.removeItem('studyPlanIB_focusFond');
    else localStorage.setItem('studyPlanIB_focusFond', avant);
    focusPoserFond(avant == null ? focusIndexParId('lumiere') : Number(avant), true);
    navigateTo('planning');
}, fondAvantLots34);

/* Lot 4 : trois suppressions testées sur des données locales provisoires,
   sans toucher au profil réel ni appeler un service externe. */
const annulations = await page.evaluate(() => {
    const coursAvant = localStorage.getItem('studyPlanIB_emploiScolaire');
    const devoirsAvant = localStorage.getItem('studyPlanIB_devoirs');
    const exosAvant = localStorage.getItem('studyPlanIB_exercices');
    const eventsAvant = localStorage.getItem('studyPlanIB_customEvents_juliss');
    const anciensExos = exercices.slice();
    const anciensEvents = customEvents.slice();
    const jour = indexJourCourant();
    const modele = { jours: [[], [], [], [], [], [], []], at: new Date().toISOString() };
    modele.jours[jour] = [
        { id: 'lot4-a', nom: 'Physique', matiere: 'Physique', debut: '09:00', fin: '10:00' },
        { id: 'lot4-b', nom: 'Physique', matiere: 'Physique', debut: '11:00', fin: '12:00' },
        { id: 'lot4-c', nom: 'Chimie', matiere: 'Chimie', debut: '13:00', fin: '14:00' }
    ];
    emploiScolaireEcrire(modele);
    const original = devoirsLireStore();
    const devoir = { id: 'lot4-dev', matiere: 'Physique', date: '2027-01-10', debut: '09:00', fin: '10:00' };
    const examen = { id: 'lot4-exa', matiere: 'Chimie', date: '2027-01-12', debut: '09:00', fin: '10:00' };
    devoirsEcrireStore({ ...original, devoirs: original.devoirs.concat(devoir), examens: original.examens.concat(examen) });
    exercices = [{ id: 'lot4-exo', subject: 'Physique', subjectIcon: '📚', text: 'Témoin', duration: 30,
        deadline: '2027-01-09', done: false, scheduledSlot: 'Aujourd’hui' }];
    localStorage.setItem('studyPlanIB_exercices', JSON.stringify(exercices));
    customEvents.push({ id: 'lot4-lie', exoId: 'lot4-exo', day: jour, title: 'Exercice Physique',
        startTime: '16:00', endTime: '16:30', type: 'study', pinned: true });
    localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(customEvents));
    const boutonAnnuler = () => [...document.querySelectorAll('.suppression-toast button')].find(b => b.textContent === 'Annuler');
    emploiSupprimer('lot4-b');
    const coursRetire = !emploiScolaireLire().jours[jour].some(c => c.id === 'lot4-b');
    const deplacementPropose = !![...document.querySelectorAll('.suppression-toast button')]
        .find(b => b.textContent.includes('Déplacer les révisions'));
    boutonAnnuler()?.click();
    const coursRestaure = emploiScolaireLire().jours[jour].some(c => c.id === 'lot4-b');
    emploiSupprimer('lot4-b');
    [...document.querySelectorAll('.suppression-toast button')]
        .find(b => b.textContent.includes('Déplacer les révisions'))?.click();
    const revisionDeplacee = customEvents.some(e => e.source === 'emploi-deplace');
    boutonAnnuler()?.click();
    const deplacementAnnule = !customEvents.some(e => e.source === 'emploi-deplace') &&
        emploiScolaireLire().jours[jour].some(c => c.id === 'lot4-b');
    emploiToutEffacer();
    const confirmeEffacer = !!document.getElementById('confirmationAction') &&
        emploiScolaireLire().jours[jour].length === 3 &&
        document.getElementById('confirmationAction').textContent.includes('Télécharger mes données');
    document.querySelector('#confirmationAction button')?.click();
    const pasEfface = emploiScolaireLire().jours[jour].length === 3;
    devoirsSupprimer('devoirs', 'lot4-dev');
    const devoirRetire = !devoirsLireStore().devoirs.some(d => d.id === 'lot4-dev');
    boutonAnnuler()?.click();
    const devoirRestaure = devoirsLireStore().devoirs.some(d => d.id === 'lot4-dev');
    devoirsSupprimer('examens', 'lot4-exa');
    const examenProtege = devoirsLireStore().examens.some(d => d.id === 'lot4-exa') &&
        !!document.getElementById('confirmationAction');
    document.querySelector('#confirmationAction button')?.click();
    deleteExo('lot4-exo');
    const exerciceRetire = !exercices.some(e => e.id === 'lot4-exo') &&
        !customEvents.some(e => e.exoId === 'lot4-exo');
    boutonAnnuler()?.click();
    const exerciceRestaure = exercices.some(e => e.id === 'lot4-exo') &&
        customEvents.some(e => e.exoId === 'lot4-exo');
    if (coursAvant == null) localStorage.removeItem('studyPlanIB_emploiScolaire');
    else localStorage.setItem('studyPlanIB_emploiScolaire', coursAvant);
    if (devoirsAvant == null) localStorage.removeItem('studyPlanIB_devoirs');
    else localStorage.setItem('studyPlanIB_devoirs', devoirsAvant);
    if (exosAvant == null) localStorage.removeItem('studyPlanIB_exercices');
    else localStorage.setItem('studyPlanIB_exercices', exosAvant);
    if (eventsAvant == null) localStorage.removeItem('studyPlanIB_customEvents_juliss');
    else localStorage.setItem('studyPlanIB_customEvents_juliss', eventsAvant);
    exercices = anciensExos;
    customEvents = anciensEvents;
    generatePlanning();
    return { coursRetire, deplacementPropose, coursRestaure, revisionDeplacee, deplacementAnnule, confirmeEffacer, pasEfface,
        devoirRetire, devoirRestaure, examenProtege, exerciceRetire, exerciceRestaure };
});
if (Object.values(annulations).some(v => !v)) echec('annulations et confirmations du lot 4 : ' + JSON.stringify(annulations));

/* 6. aucune erreur JavaScript */
if (erreurs.length) {
    echec('erreurs JavaScript dans la page : ' + erreurs.join(' | ').slice(0, 400));
}

await browser.close();
console.log('ok préparation en vrai navigateur : séance du devoir visible aujourd\u2019hui avec compte à rebours, '
    + 'révisions de l\u2019examen dans la semaine, devoir à ses heures le jour J, aucun popup bac, '
    + 'l\u2019analyse ne propose que les matières de chaque élève, '
    + 'programme trimestriel des devoirs lu avec les matières de l\u2019élève, créneau DEVOIR DE NIVEAU remplacé par le devoir réel, '
    + 'nombre de séances choisi tenu au compte exact sur chaque jour même planning plein, séances visibles et modifiables dans la liste des devoirs, jours fériés posés par date pour une semaine avec la carte Jour libre, '
    + 'vrais cours de l\u2019emploi du temps au planning avec travail dans les heures creuses, '
    + 'matières vues au programme de tout le planning, bouton Continuer de l\u2019emploi du temps ouvrant vraiment le planning, '
    + 'tomate au menu Pomodoro, panneau Sons et galerie de 32 décors sur la page Séance du jour, section Playlist retirée, 0 erreur JavaScript');
