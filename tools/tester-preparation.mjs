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
 *  10. la musique : tomate au menu Pomodoro, section Playlist
 *      (YouTube) à côté des Sons sur les deux pages, Spotify retiré.
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

/* 8. l'emploi du temps scolaire : les vrais cours remplacent les
   créneaux génériques et les heures creuses reçoivent du travail —
   vérifié avec le vrai moteur du site déployé. */
const demainIdx = (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1 + 1) % 7;
const idxDemain = ((new Date().getDay() + 6) % 7 + 1) % 7;
const emploi = await page.evaluate(function (idx) {
    localStorage.setItem('studyPlanIB_emploiScolaire', JSON.stringify({
        at: new Date().toISOString(),
        jours: (() => { const j = [[], [], [], [], [], [], []]; j[idx] = [
            { id: 'e1', nom: 'Maths AA', matiere: 'Mathématiques AA', debut: '08:00', fin: '09:30' },
            { id: 'e2', nom: 'Chimie', matiere: 'Chimie', debut: '11:10', fin: '12:40' }
        ]; return j; })()
    }));
    const evts = generateDayEvents(idx);
    return evts.map(e => (e.id || '') + '|' + (e.title || '') + '|' + (e.startTime || '') + '-' + (e.endTime || ''));
}, idxDemain);
if (!emploi.some(l => l.indexOf('Maths AA|08:00-09:30') !== -1 || l.indexOf('|Maths AA|') !== -1 && l.indexOf('08:00-09:30') !== -1)) {
    echec("le vrai cours de Maths AA (8h00-9h30) n'apparaît pas : " + JSON.stringify(emploi.slice(0, 12)));
}
if (!emploi.some(l => l.indexOf('Chimie|11:10-12:40') !== -1 || l.indexOf('|Chimie|') !== -1 && l.indexOf('11:10-12:40') !== -1)) {
    echec("le vrai cours de Chimie (11h10-12h40) n'apparaît pas : " + JSON.stringify(emploi.slice(0, 12)));
}
if (emploi.some(l => l.indexOf('school1|') !== -1 || l.indexOf('school2|') !== -1)) {
    echec('les créneaux Cours génériques doivent disparaître quand lemploi du temps est chargé : ' + JSON.stringify(emploi.slice(0, 12)));
}
if (!emploi.some(l => l.indexOf('emploi-') !== -1)) {
    echec("l'heure creuse 9h30-11h10 doit recevoir du travail : " + JSON.stringify(emploi.slice(0, 12)));
}

/* le programme du planning suit l'emploi du temps : le soir, les
   matières vues dans la journée passent en premier, puis le complément */
const programmeJour = await page.evaluate(function (idx) {
    return emploiScolaireProgramme(idx).map(s => s.name);
}, idxDemain);
if (programmeJour.join(',') !== 'Mathématiques AA,Chimie,Physique') {
    echec('le programme doit suivre l\'emploi du temps (matières vues puis complément) : ' + programmeJour.join(','));
}
if (!emploi.some(l => l.indexOf('study1|Révisions Mathématiques AA|') !== -1)) {
    echec('le soir doit réviser la première matière vue dans la journée (Mathématiques AA) : ' + JSON.stringify(emploi.slice(0, 16)));
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

/* 10. la musique : la tomate au menu Pomodoro, la section Playlist
   (Spotify · YouTube) à côté des Sons sur les deux pages musique */
const menuPomodoro = await page.evaluate(() => {
    const bouton = document.getElementById('menuMinuteur');
    return bouton ? bouton.textContent : '';
});
if (menuPomodoro.indexOf('🍅') === -1 || menuPomodoro.indexOf('⏱') !== -1) {
    echec("le menu Pomodoro doit montrer une tomate 🍅 et non le minuteur : " + menuPomodoro);
}
if (!await page.evaluate(() => !!document.getElementById('focusBtnPlaylist'))) {
    echec("le bouton Playlist doit exister à côté du bouton Sons du minuteur");
}
await page.evaluate(() => { navigateTo('seances'); });
const boutonsSeances = await page.evaluate(() => ({
    sons: !!document.getElementById('accueilBtnSons'),
    playlist: !!document.getElementById('accueilBtnPlaylist')
}));
if (!boutonsSeances.sons || !boutonsSeances.playlist) {
    echec('la page Séance de révision du jour doit avoir les boutons Sons et Playlist');
}
const playlistOuverte = await page.evaluate(() => {
    focusBasculerPlaylist();
    const panneau = document.getElementById('focusPlaylist');
    return panneau && !panneau.hidden;
});
if (!playlistOuverte) {
    echec("le panneau Playlist ne s'ouvre pas depuis la page Séance du jour");
}
/* les Mix automatiques sont refusés avec la marche à suivre, et un
   lien watch?v=…&list=… démarre le lecteur sur cette vidéo */
const refusMix = await page.evaluate(() => {
    return playlistAjouterLien('https://www.youtube.com/watch?v=abcdefghijk&list=RDGMEMmixE2E');
});
if (refusMix.ok || refusMix.message.indexOf('Mix') === -1) {
    echec('un lien de Mix doit être refusé avec la marche à suivre : ' + JSON.stringify(refusMix));
}
const ajouts = await page.evaluate(() => {
    const watch = playlistAjouterLien('https://www.youtube.com/watch?v=vidE2E12345&list=PLwatchE2E');
    playlistPeindre();
    return { ok: watch.ok, embed: playlistLire().liste.filter(p => p.cle === 'PLwatchE2E')[0].embed,
        secours: (document.querySelector('#fpLecteur .fp-secours') || {}).href || '' };
});
if (!ajouts.ok || ajouts.embed !== 'https://www.youtube-nocookie.com/embed/vidE2E12345?list=PLwatchE2E') {
    echec('le lecteur doit démarrer sur la vidéo du lien watch : ' + JSON.stringify(ajouts));
}
if (ajouts.secours.indexOf('PLwatchE2E') === -1 && ajouts.secours.indexOf('list=') === -1) {
    echec('la porte de secours vers YouTube manque sous le lecteur : ' + JSON.stringify(ajouts));
}

const lecteurs = await page.evaluate(() => {
    const youtube = playlistAjouterLien('https://www.youtube.com/playlist?list=PLE2Etest');
    const spotify = playlistAjouterLien('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=e2e');
    const musique = playlistAjouterLien('https://music.youtube.com/playlist?list=RDCLB-e2e');
    playlistPeindre();
    const iframes = Array.from(document.querySelectorAll('#focusPlaylist iframe')).map(f => f.src);
    const cartes = Array.from(document.querySelectorAll('#fpListe .fp-carte')).length;
    return { youtubeOk: youtube.ok, spotifyOk: spotify.ok, spotifyMessage: spotify.message || '', musiqueOk: musique.ok, iframes: iframes, cartes: cartes };
});
if (!lecteurs.youtubeOk || !lecteurs.musiqueOk) {
    echec('les liens de playlists YouTube doivent être acceptés : ' + JSON.stringify(lecteurs));
}
if (lecteurs.spotifyOk || lecteurs.spotifyMessage.indexOf('YouTube') === -1) {
    echec('un lien Spotify doit être refusé avec un message qui guide vers YouTube : ' + JSON.stringify(lecteurs));
}
if (lecteurs.cartes < 2) {
    echec('les deux playlists YouTube doivent apparaître dans la liste : ' + JSON.stringify(lecteurs));
}
if (!lecteurs.iframes.some(src => src.indexOf('/embed/videoseries?list=') !== -1)) {
    echec('le lecteur YouTube intégré manque : ' + JSON.stringify(lecteurs.iframes));
}
/* toucher la première carte affiche son lecteur */
const carteActivee = await page.evaluate(() => {
    const store = playlistLire();
    const premiere = store.liste[0];
    if (!premiere) return '';
    playlistActiver(premiere.id);
    playlistPeindre();
    const cadre = document.querySelector('#focusPlaylist iframe');
    return cadre ? cadre.src : '';
});
if (carteActivee.indexOf('youtube-nocookie.com/embed/') === -1 || carteActivee.indexOf('list=') === -1) {
    echec('le lecteur de la playlist activée manque : ' + carteActivee);
}
const sonsAccueil = await page.evaluate(() => {
    focusFermerMusique();
    focusBasculerSonsAccueil();
    const panneau = document.getElementById('accueilSons');
    const grille = document.querySelectorAll('#accueilSonsGrille .focus-son').length;
    return { ouvert: panneau && !panneau.hidden, grille: grille };
});
if (!sonsAccueil.ouvert || sonsAccueil.grille < 10) {
    echec("le panneau Sons de la page Séance du jour ne s'affiche pas ou sa grille est vide : " + JSON.stringify(sonsAccueil));
}
await page.evaluate(() => { focusFermerMusique(); });

/* 6. aucune erreur JavaScript */
if (erreurs.length) {
    echec('erreurs JavaScript dans la page : ' + erreurs.join(' | ').slice(0, 400));
}

await browser.close();
console.log('ok préparation en vrai navigateur : séance du devoir visible aujourd\u2019hui avec compte à rebours, '
    + 'révisions de l\u2019examen dans la semaine, devoir à ses heures le jour J, aucun popup bac, '
    + 'l\u2019analyse ne propose que les matières de chaque élève, vrais cours de l\u2019emploi du temps au planning avec travail dans les heures creuses, '
    + 'matières vues au programme de tout le planning, bouton Continuer de l\u2019emploi du temps ouvrant vraiment le planning, '
    + 'tomate au menu Pomodoro, section Playlist YouTube jouant dans le site à côté des Sons sur les deux pages musique (Spotify retiré), 0 erreur JavaScript');
