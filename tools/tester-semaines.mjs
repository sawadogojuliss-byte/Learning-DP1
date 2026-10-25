/* Lot 6 : vraie interface du planning. Profil et données uniquement dans
   ce navigateur isolé ; aucune connexion, aucun mail, aucune écriture distante. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const site = process.env.STUDY_SITE || 'https://sawadogojuliss-byte.github.io/Learning-DP1/';
const options = { headless: true };
if (process.env.STUDY_CHROMIUM_LOCAL) {
    const aws = (await import('@sparticuz/chromium')).default;
    options.executablePath = await aws.executablePath();
    options.args = aws.args;
}
const browser = await chromium.launch(options);
try {
    const page = await browser.newPage({ viewport: { width: 320, height: 720 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
    const actual = await page.evaluate(() => {
        const dateCle = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        const jour = getWeekDates(new Date(), 1);
        const dateLundi = dateCle(jour[0].date), dateMercredi = dateCle(jour[2].date), dateJeudi = dateCle(jour[3].date);
        subjects = [{ name: 'Chimie', level: 'HL', icon: '⚗️', grade: 4 }];
        optionalSubjects = [];
        selectedActivities = [];
        customEvents = [{ id: 'test-lot6', replacesId: 'breakfast', day: 2, title: 'Petit-déjeuner', startTime: '06:30', endTime: '07:00', type: 'meal', icon: '🥐', source: 'custom', pinned: true }];
        emploiFige = null;
        holidayDates = { [dateLundi]: 'free' };
        holidayDroppedDates = {};
        localStorage.setItem('studyPlanIB_devoirs', JSON.stringify({
            bac: false, bacDemande: 2,
            devoirs: [{ id: 'test-lot6-dev', matiere: 'Chimie', date: dateMercredi, debut: '08:00', fin: '09:00', seances: 2 }],
            examens: [{ id: 'test-lot6-exam', matiere: 'Chimie', date: dateJeudi, debut: '13:00', fin: '14:00' }]
        }));
        // Un horaire réellement fixé apparaît dans les deux semaines.
        const fixes = generateDayEvents(2).filter(e => e.id === 'breakfast').map(e => e.startTime);
        generatePlanning();
        return { dateLundi, dateMercredi, dateJeudi, fixes,
            cache: JSON.stringify(emploiFige), signature: focusSignatureSeances(),
            rappel: getNextActivity()?.startTime || null,
            jour: selectedDay, ancienneDate: getWeekDates(new Date(), -1)[0].date.getDay(),
            passageAnnee: getWeekDates(new Date(2026,11,31), 1).map(x => [x.date.getFullYear(), x.date.getMonth()+1, x.date.getDate()]) };
    });
    assert.equal(actual.ancienneDate, 1, 'la semaine précédente commence un lundi');
    assert.deepEqual(actual.passageAnnee[0], [2027,1,4], 'lundi après le Nouvel An');
    assert.deepEqual(actual.passageAnnee[6], [2027,1,10], 'dimanche de la même semaine');
    assert.equal(actual.fixes[0], '06:30', 'l’horaire fixé existe');
    assert.equal(await page.locator('#planningSemaineType').textContent(), 'Semaine actuelle');
    await page.locator('#planningModal .planning-semaine-actions button[aria-label="Semaine suivante"]').click();
    assert.equal(await page.locator('#planningSemaineType').textContent(), 'Semaine suivante');
    assert.equal(await page.locator('#planningAujourdhui').isVisible(), true);
    assert.equal(await page.locator('#addPlanningBtn').isVisible(), false, 'pas d’édition isolée par date');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= 320), true, 'aucun débordement à 320 px');
    const memeJour = await page.evaluate(() => ({ jour: selectedDay, cache: JSON.stringify(emploiFige),
        signature: focusSignatureSeances(), rappel: getNextActivity()?.startTime || null,
        contexte: window.__planningDateApercue }));
    assert.equal(memeJour.jour, actual.jour, 'la flèche conserve le jour de la semaine');
    assert.equal(memeJour.cache, actual.cache, 'le cache réel ne se modifie pas pendant la consultation');
    assert.equal(memeJour.signature, actual.signature, 'Séance reste sur la date réelle');
    assert.equal(memeJour.rappel, actual.rappel, 'la prochaine activité reste attachée à l’heure réelle');
    assert.equal(memeJour.contexte, undefined, 'aucune date consultée ne fuit dans les autres pages');
    const jours = page.locator('#dayNavigation button');
    await jours.nth(0).click();
    assert.equal(await page.locator('#eventsContainer img[alt^="Jour libre"]').count(), 1, 'férié daté sur le bon lundi');
    await jours.nth(2).click();
    const dateTest = new Date(actual.dateMercredi + 'T12:00:00');
    const dateFormatee = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(dateTest);
    assert.equal((await page.locator('#planningJourDate').textContent()).toLowerCase(), dateFormatee.toLowerCase(), 'date complète du jour sélectionné');
    const mercredi = await page.evaluate(() => ({ ids: v3LastRendered.map(e => e.id), cartes: document.getElementById('eventsContainer').textContent,
        date: getWeekDates(new Date(), planningDecalageSemaine)[selectedDay].date.getDate() }));
    assert(mercredi.ids.includes('devoir-test-lot6-dev'), 'le devoir doit apparaître à sa date exacte');
    assert(mercredi.ids.includes('breakfast'), 'le créneau hebdomadaire fixé doit rester visible');
    assert.equal(await page.evaluate(() => v3LastRendered.find(e => e.id === 'breakfast')?.startTime), '06:30', 'l’horaire fixé doit rester inchangé');
    assert.equal(await page.locator('#eventsContainer [data-v3-idx] .v3-pouce').count(), 0, 'aucune poignée de déplacement hors semaine actuelle');
    await jours.nth(3).click();
    assert((await page.evaluate(() => v3LastRendered.map(e => e.id))).some(id => id === 'exam-test-lot6-exam'), 'l’examen est à sa date exacte');
    const lecture = await page.evaluate(() => {
        openAddModal(); v3ResetDay();
        return { modal: document.getElementById('addEventModal').style.display, drag: v3DonnerHoraireCible(0,1),
            cache: JSON.stringify(emploiFige) };
    });
    assert.notEqual(lecture.modal, 'flex', 'une ouverture programmatique ne permet pas d’écrire dans une autre semaine');
    assert.equal(lecture.drag, false, 'déplacement impossible hors semaine actuelle');
    assert.equal(lecture.cache, actual.cache, 'ni glisser ni réinitialiser ne changent le gel');
    await page.locator('#planningAujourdhui').click();
    assert.equal(await page.locator('#planningSemaineType').textContent(), 'Semaine actuelle');
    assert.equal(await page.evaluate(() => selectedDay), await page.evaluate(() => indexJourCourant()), 'retour au vrai jour');
    assert.equal(await page.locator('#addPlanningBtn').isVisible(), true, 'édition normale retrouvée');
    await page.locator('#planningModal .planning-semaine-actions button[aria-label="Semaine précédente"]').click();
    assert.equal(await page.locator('#planningSemaineType').textContent(), 'Semaine précédente');
    assert.match(await page.locator('#planningSemaineLecture').innerText(), /ne sont pas archivées/);
    // Le raccourci n’est affiché que quand le vrai minuteur est en cours.
    await page.evaluate(() => { focusEtat.running = true; focusEtat.fin = Date.now() + 120000; planningMinuteurEntete(); });
    assert.match(await page.locator('#planningMinuteurEntete').innerText(), /Minuteur/);
    await page.locator('#planningMinuteurEntete').click();
    assert.equal(await page.locator('#panelPomodoro').isVisible(), true, 'le raccourci ouvre le vrai minuteur');
    assert.equal(await page.evaluate(() => planningDecalageSemaine), -1, 'l’ouverture du minuteur ne recale pas sa date');
    assert.deepEqual(errors, [], 'aucune erreur navigateur : ' + errors.join(' | '));
    console.log('ok navigateur semaine : flèches, dates, devoir/examen/férié, cache, lecture seule, Séance, minuteur, mobile');
} finally { await browser.close(); }
