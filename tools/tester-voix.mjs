/**
 * Vérifie en vrai navigateur, sur le site déployé, la fin d'un
 * chronomètre : la musique s'arrête, le bip sonne, la voix parle, et
 * rien ne se relance tout seul.
 *
 * Le test installe un profil, ouvre le minuteur, lance une séance,
 * met une ambiance, puis force la fin du temps de concentration. Il
 * écoute ce que le navigateur reçoit vraiment : les sons programmés
 * dans l'AudioContext, et l'état des lecteurs d'ambiance.
 */
import { chromium } from 'playwright';

const SITE_OK = 'https://sawadogojuliss-byte.github.io/Learning-DP1/';

function echec(message) {
    console.error('ECHEC ' + message);
    process.exit(1);
}

const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio']
});
const page = await browser.newPage();
const erreurs = [];
page.on('pageerror', function (e) { erreurs.push(String(e)); });

/* On compte les sons que le code programme VRAIMENT dans l'AudioContext,
   avant même que les scripts du site ne se chargent. */
await page.addInitScript(function () {
    window.__sonsProgrammes = [];
    window.__oscillateurs = 0;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const decale = function (proto) {
        if (!proto) return;
        const vraiBuffer = proto.createBufferSource;
        proto.createBufferSource = function () {
            const source = vraiBuffer.apply(this, arguments);
            const vraiStart = source.start;
            source.start = function (quand) {
                window.__sonsProgrammes.push({ quand: quand, duree: source.buffer ? source.buffer.duration : 0 });
                return vraiStart.apply(source, arguments);
            };
            return source;
        };
        const vraiOsc = proto.createOscillator;
        proto.createOscillator = function () {
            window.__oscillateurs += 1;
            return vraiOsc.apply(this, arguments);
        };
    };
    decale(AC.prototype);
});

await page.goto(SITE_OK, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate(function () {
    localStorage.setItem('studyPlanIB_profil', JSON.stringify({
        v: 1, savedAt: new Date().toISOString(), etape: 'planning', profilComplet: true,
        userName: 'E2E Voix', targetScore: 36,
        weekdayWakeup: '05:30', saturdayWakeup: '08:30', sundayWakeup: '09:00',
        subjects: [{ name: 'Mathématiques AA', level: 'HL' }, { name: 'Chimie', level: 'SL' }],
        optionalSubjects: [{ name: 'Physique', level: 'SL' }],
        ibYear: 'DP2', transportMode: 'walking', selectedActivities: [],
        holidayDates: {}, holidayDroppedDates: {}, phoneDays: [],
        samePhoneDuration: true, phoneDuration: 30, phoneDayDurations: {},
        sameFreeTime: true, freeTimeMinutes: 60, freeTimeByDay: {},
        weekdaySleepHours: 8, saturdaySleepHours: 8, sundaySleepHours: 8
    }));
    localStorage.setItem('studyPlanIB_focusDurees', JSON.stringify({ focus: 25, short: 5, long: 15 }));
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__STUDYPLAN_READY === true, null, { timeout: 60000 });

/* Le module doit être là : c'est lui qui parle. */
const modulePret = await page.evaluate(() => typeof chronoAnnoncerPause === 'function');
if (!modulePret) echec('le module de fin de chronomètre n\'est pas chargé sur le site déployé');

/* Ouvrir le minuteur, lancer une séance, mettre une ambiance. */
await page.evaluate(function () {
    if (typeof navigateTo === 'function') navigateTo('pomodoro');
    else if (typeof memoireAller === 'function') memoireAller('pomodoro');
    if (typeof focusOuvrirMinuteur === 'function') focusOuvrirMinuteur();
});
await page.waitForTimeout(400);

const lance = await page.evaluate(function () {
    const bouton = document.getElementById('focusPlay');
    if (bouton) bouton.click();
    else if (typeof focusBasculer === 'function') focusBasculer();
    return { enMarche: !!(window.focusEtat && focusEtat.running), bouton: !!bouton };
});
if (!lance.enMarche) echec('le minuteur ne démarre pas (bouton : ' + lance.bouton + ')');

/* les morceaux de la fin de séance se préparent sur ce geste */
await page.waitForTimeout(1500);
const prepares = await page.evaluate(function () {
    return {
        tampons: Object.keys(window.chronoVoixTampons || {}),
        absents: Object.keys(window.chronoVoixAbsents || {})
    };
});
if (!prepares.tampons.length) echec('aucun morceau de voix n\'a pu être chargé : absents = ' + JSON.stringify(prepares.absents));

/* une ambiance en cours, comme un élève qui écoute la pluie */
const ambiance = await page.evaluate(function () {
    if (typeof focusChoisirSon === 'function') focusChoisirSon('pluie');
    return typeof focusSonActif === 'function' ? focusSonActif('pluie') : null;
});
if (ambiance !== true) echec('l\'ambiance de test n\'a pas démarré');

/* la fin du temps de concentration, forcée pour ne pas attendre 25 min */
await page.evaluate(function () {
    focusEtat.restant = 0;
    focusEtat.fin = Date.now() - 50;
    focusTick();
});
await page.waitForTimeout(2600);

const fin = await page.evaluate(function () {
    return {
        mode: window.focusEtat ? focusEtat.mode : null,
        enMarche: window.focusEtat ? focusEtat.running : null,
        restant: window.focusEtat ? focusEtat.restant : null,
        sons: window.__sonsProgrammes || [],
        oscillateurs: window.__oscillateurs || 0,
        ambianceEncore: typeof focusSonActif === 'function' ? focusSonActif('pluie') : null,
        sources: (window.chronoVoixSources || []).length
    };
});

if (fin.enMarche !== false) echec('le chronomètre continue tout seul après la fin de la concentration');
if (fin.mode !== 'short') echec('la phase suivante doit être une pause courte, trouvée : ' + fin.mode);
if (fin.ambianceEncore !== false) echec('la musique d\'ambiance continue pendant la pause');
if (fin.oscillateurs < 2) echec('le bip de fin n\'a pas sonné (oscillateurs : ' + fin.oscillateurs + ')');
if (fin.sons.length < 3) echec('la voix n\'a pas été programmée (sons : ' + JSON.stringify(fin.sons) + ')');
const total = fin.sons.reduce(function (s, x) { return s + (x.duree || 0); }, 0);
if (total < 6) echec('l\'annonce est trop courte pour être la phrase entière (' + total.toFixed(1) + ' s)');
/* Lot 13 : les réglages survivent, et couper la voix laisse le bip.
   Aucun texte d'annonce ni nouveau son n'est programmé après ce choix. */
const muetAvant = await page.evaluate(() => {
    const active = document.getElementById('focusVoixActive');
    const volume = document.getElementById('focusVoixVolume');
    active.checked = false;
    volume.value = '23';
    chronoSauverReglagesVoix();
    return { sons: window.__sonsProgrammes.length, bip: window.__oscillateurs };
});
await page.evaluate(() => chronoAnnoncerPause(5));
await page.waitForTimeout(1400);
const muet = await page.evaluate(() => ({
    sons: window.__sonsProgrammes.length,
    bip: window.__oscillateurs,
    stocke: localStorage.getItem('studyPlanIB_voixActive'),
    volume: localStorage.getItem('studyPlanIB_voixVolume'),
    ambiance: JSON.parse(localStorage.getItem('studyPlanIB_focusAmbiance') || '[]')
}));
if (muet.sons !== muetAvant.sons || muet.bip <= muetAvant.bip || muet.stocke !== 'false' ||
    muet.volume !== '0.23' || !muet.ambiance.includes('pluie'))
    echec('voix coupée ou choix de son non respecté : ' + JSON.stringify(muet));
await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
const restaure = await page.evaluate(() => {
    navigateTo('pomodoro');
    return { voix: document.getElementById('focusVoixActive').checked,
        volume: document.getElementById('focusVoixVolume').value,
        son: focusAmbianceChoisie.includes('pluie'),
        auto: focusSonActif('pluie') };
});
if (restaure.voix !== false || restaure.volume !== '23' || !restaure.son || restaure.auto)
    echec('préférences de son perdues ou démarrage automatique : ' + JSON.stringify(restaure));
if (erreurs.length) echec('erreurs JavaScript : ' + erreurs.join(' | '));

console.log('ok fin de chronomètre en vrai navigateur : '
    + fin.sons.length + ' sons (' + total.toFixed(1) + ' s), bip ' + fin.oscillateurs
    + ', musique arrêtée, pause ' + fin.mode + ' proposée');

await browser.close();
