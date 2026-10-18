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
page.on('pageerror', function (e) { erreurs.push(String(e)); });

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
        selectedActivities: [], holidayDays: [], holidayModes: {}, holidayDropped: {},
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
await page.waitForFunction(() => window.__STUDYPLAN_READY === true, null, { timeout: 60000 });
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
        const evts = generateDayEvents(i).map(function (e) {
            return (e.title || '') + ' ' + (e.startTime || '') + '-' + (e.endTime || '');
        });
        jours.push({ cle: cle, evts: evts });
    }
    return jours;
});

const cleDemain = jourCle(demain);
if (!semaine.some(j => j.evts.some(t => t.indexOf('Révision · Physique') !== -1))) {
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

/* 6. aucune erreur JavaScript */
if (erreurs.length) {
    echec('erreurs JavaScript dans la page : ' + erreurs.join(' | ').slice(0, 400));
}

await browser.close();
console.log('ok préparation en vrai navigateur : séance du devoir visible aujourd\u2019hui avec compte à rebours, '
    + 'révisions de l\u2019examen dans la semaine, devoir à ses heures le jour J, aucun popup bac, '
    + 'l\u2019analyse ne propose que les matières de chaque élève, 0 erreur JavaScript');
