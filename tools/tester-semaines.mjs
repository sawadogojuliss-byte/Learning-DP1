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
    assert.equal(await page.locator('#addPlanningBtn').isVisible(), true, 'la prochaine semaine est modifiable');
    assert.equal(await page.locator('#planningSemaineLecture').count(), 0, 'plus de texte Consultation seulement');
    assert.equal(await page.locator('#planningSemaineType').evaluate(el => getComputedStyle(el).color), 'rgb(35, 93, 74)', 'le seul libellé de semaine adopte le vert Atelier');
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
    assert.equal(await page.locator('#addPlanningBtn').isVisible(), true, 'même un jour libre à venir peut recevoir une activité');
    await page.evaluate(() => {
        openAddModal();
        document.getElementById('activityNameInput').value = 'Sport du jour';
        document.getElementById('activityStartInput').value = '17:30';
        document.getElementById('activityEndInput').value = '18:00';
        confirmAddActivity();
    });
    assert(await page.evaluate(() => v3LastRendered.some(e => e.title === 'Sport du jour')), 'ajout réel sur le jour libre');
    assert.equal(await page.evaluate(() => customEvents.find(e => e.title === 'Sport du jour')?.date), actual.dateLundi, 'activité sauvegardée avec la date du lundi');
    await page.locator('#planningModal .planning-semaine-actions button[aria-label="Semaine suivante"]').click();
    assert.equal(await page.evaluate(() => v3LastRendered.some(e => e.title === 'Sport du jour')), false, 'le prochain lundi ne reçoit pas cette activité');
    await page.locator('#planningModal .planning-semaine-actions button[aria-label="Semaine précédente"]').click();
    await jours.nth(2).click();
    const dateTest = new Date(actual.dateMercredi + 'T12:00:00');
    const dateFormatee = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(dateTest);
    assert.equal((await page.locator('#planningJourDate').textContent()).toLowerCase(), dateFormatee.toLowerCase(), 'date complète du jour sélectionné');
    const mercredi = await page.evaluate(() => ({ ids: v3LastRendered.map(e => e.id), cartes: document.getElementById('eventsContainer').textContent,
        date: getWeekDates(new Date(), planningDecalageSemaine)[selectedDay].date.getDate() }));
    assert(mercredi.ids.includes('devoir-test-lot6-dev'), 'le devoir doit apparaître à sa date exacte');
    assert(mercredi.ids.includes('breakfast'), 'le créneau hebdomadaire fixé doit rester visible');
    assert.equal(await page.evaluate(() => v3LastRendered.find(e => e.id === 'breakfast')?.startTime), '06:30', 'l’horaire fixé doit rester inchangé');
    await page.evaluate(() => v3PoserPoignee(v3LastRendered.findIndex(e => e.id === 'breakfast')));
    assert((await page.locator('#eventsContainer [data-v3-idx] .v3-pouce').count()) > 0, 'la poignée peut être ouverte pour déplacer dans le futur');
    // Modification réelle d'un créneau hebdomadaire fixé, limitée à cette date.
    await page.evaluate(() => v3OpenEditByIndex(v3LastRendered.findIndex(e => e.id === 'breakfast')));
    assert.equal(await page.locator('#editEventModal').isVisible(), true, 'la fenêtre de modification s’ouvre dans le futur');
    assert.match(await page.locator('#editCascadeInfo').innerText(), /Pour cette date seulement/, 'la fenêtre annonce la portée exacte du changement');
    await page.locator('#editEventTitle').fill('Petit-déjeuner daté');
    await page.locator('#editEventEnd').fill('06:45');
    await page.evaluate(() => saveEditedEventCascade());
    assert.equal(await page.evaluate(() => v3LastRendered.find(e => e.id === 'breakfast')?.title), 'Petit-déjeuner daté', 'la date choisie affiche la modification');
    assert.equal(await page.evaluate(() => customEvents.find(e => e.replacesId === 'breakfast' && e.date === planningDateEdition(2))?.title), 'Petit-déjeuner daté', 'l’exception est conservée avec sa date');
    const apresEdition = await page.evaluate(() => ({ cache: JSON.stringify(emploiFige), hebdo: customEvents.find(e => e.replacesId === 'breakfast' && !e.date)?.title, seance: focusSignatureSeances(), rappel: getNextActivity()?.startTime || null }));
    assert.equal(apresEdition.hebdo, 'Petit-déjeuner', 'le modèle hebdomadaire reste inchangé');
    assert.equal(apresEdition.cache, actual.cache, 'le gel hebdomadaire reste intact');
    assert.equal(apresEdition.seance, actual.signature, 'la page Séance reste sur la date réelle');
    assert.equal(apresEdition.rappel, actual.rappel, 'le minuteur/rappel réel ne suit pas la navigation');
    assert.equal(await page.evaluate(() => {
        const copie = JSON.parse(JSON.stringify(memoireLireEtat()));
        customEvents = [];
        memoireAppliquer(copie, { compte: true });
        renderPlanning();
        return v3LastRendered.find(e => e.id === 'breakfast')?.title;
    }), 'Petit-déjeuner daté', 'la restauration du profil retrouve la modification de cette date');
    await page.locator('#planningModal .planning-semaine-actions button[aria-label="Semaine suivante"]').click();
    assert.equal(await page.evaluate(() => v3LastRendered.find(e => e.id === 'breakfast')?.title), 'Petit-déjeuner', 'le même mercredi, une semaine plus tard, est intact');
    await page.locator('#planningModal .planning-semaine-actions button[aria-label="Semaine précédente"]').click();
    assert.equal(await page.evaluate(() => v3LastRendered.find(e => e.id === 'breakfast')?.title), 'Petit-déjeuner daté', 'retour à la date modifiée');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'));
    await page.evaluate(() => { generatePlanning(); planningChangerSemaine(1); selectDay(2); });
    assert.equal(await page.evaluate(() => v3LastRendered.find(e => e.id === 'breakfast')?.title), 'Petit-déjeuner daté', 'la modification datée survit au rechargement');
    assert(await page.evaluate(() => memoireLireEtat().customEvents.some(e => e.replacesId === 'breakfast' && e.date === planningDateEdition(2))), 'la sauvegarde du profil contient la date');
    await page.evaluate(() => v3OpenEditByIndex(v3LastRendered.findIndex(e => e.id === 'breakfast')));
    await page.evaluate(() => deleteEditedEvent());
    assert.equal(await page.evaluate(() => v3LastRendered.some(e => e.id === 'breakfast')), false, 'la suppression masque uniquement cette date');
    await page.locator('.v3-toast-btn').click();
    assert.equal(await page.evaluate(() => v3LastRendered.find(e => e.id === 'breakfast')?.title), 'Petit-déjeuner daté', 'Annuler rétablit l’édition datée');
    await page.evaluate(() => v3ResetDay());
    assert.match(await page.locator('#confirmationActionTitre').textContent(), /20[0-9]{2}-[0-9]{2}-[0-9]{2}/, 'la remise à zéro nomme la date exacte');
    await page.locator('#confirmationAction button').last().click();
    assert.equal(await page.evaluate(() => v3LastRendered.find(e => e.id === 'breakfast')?.title), 'Petit-déjeuner', 'la date revient au modèle après confirmation');
    assert.equal(await page.evaluate(() => customEvents.some(e => e.date === planningDateEdition(2) && !e.resetDate)), false, 'la remise à zéro retire seulement les changements de la date sélectionnée');
    assert(await page.evaluate(() => customEvents.some(e => e.date === planningDateEdition(2) && e.resetDate)), 'le profil garde la trace de la réinitialisation contre les anciennes copies');
    assert(await page.evaluate(() => customEvents.some(e => e.title === 'Sport du jour' && e.date)), 'la remise à zéro conserve l’autre jour modifié');
    assert.equal(await page.evaluate(() => customEvents.find(e => e.replacesId === 'breakfast' && !e.date)?.title), 'Petit-déjeuner', 'la remise à zéro ne supprime pas le modèle hebdomadaire');
    assert.equal(await page.evaluate(() => {
        const actuel = customEvents;
        const date = planningDateEdition(2);
        const ancien = { id: 'ancienne-copie', day: 2, date, replacesId: 'breakfast',
            title: 'Ancienne copie', startTime: '06:30', endTime: '06:45', timestamp: 100 };
        const reset = customEvents.find(e => e.date === date && e.resetDate);
        try {
            customEvents = compteUnionParId([[ancien], [reset, ...actuel]], 'id', true);
            return generateDayEvents(2, planningDateSelectionnee(2)).find(e => e.id === 'breakfast')?.title;
        } finally { customEvents = actuel; }
    }), 'Petit-déjeuner', 'une ancienne copie de compte ne restaure pas la date réinitialisée');
    await page.locator('.v3-toast-btn').click();
    assert.equal(await page.evaluate(() => v3LastRendered.find(e => e.id === 'breakfast')?.title), 'Petit-déjeuner daté', 'Annuler la remise à zéro restaure la date');
    await jours.nth(0).click();
    await page.evaluate(() => {
        openAddModal();
        document.getElementById('activityNameInput').value = 'Lecture du jour';
        document.getElementById('activityStartInput').value = '17:40';
        document.getElementById('activityEndInput').value = '17:55';
        confirmAddActivity();
    });
    assert.equal(await page.locator('#chevauchementPopup').count(), 1, 'le conflit sur une date future demande un choix explicite');
    await page.evaluate(() => v3FermerChoixChevauchement());
    assert.equal(await page.evaluate(() => customEvents.some(e => e.title === 'Lecture du jour')), false, 'Annuler le conflit n’enregistre rien');
    await page.evaluate(() => confirmAddActivity());
    assert.equal(await page.evaluate(() => {
        const sport = customEvents.find(e => e.title === 'Sport du jour');
        return v3AppliquerChoixChevauchement(window.__chevauchementCtx, {
            type: 'remplacer', utilisateur: { start: '17:30', end: '17:45' }, supprimerIds: [sport.id]
        });
    }), true, 'le choix explicite de retrait s’enregistre');
    assert.equal(await page.evaluate(() => v3LastRendered.some(e => e.title === 'Sport du jour')), false, 'l’activité réellement retirée disparaît à cette date');
    assert(await page.evaluate(() => v3LastRendered.some(e => e.title === 'Lecture du jour')), 'le nouveau créneau apparaît à cette date');
    await page.locator('#planningModal .planning-semaine-actions button[aria-label="Semaine suivante"]').click();
    assert.equal(await page.evaluate(() => v3LastRendered.some(e => e.title === 'Lecture du jour')), false, 'la résolution du conflit ne se répète pas la semaine suivante');
    await page.locator('#planningModal .planning-semaine-actions button[aria-label="Semaine précédente"]').click();
    await jours.nth(3).click();
    assert((await page.evaluate(() => v3LastRendered.map(e => e.id))).some(id => id === 'exam-test-lot6-exam'), 'l’examen est à sa date exacte');
    await page.locator('#planningAujourdhui').click();
    assert.equal(await page.locator('#planningSemaineType').textContent(), 'Semaine actuelle');
    assert.equal(await page.evaluate(() => selectedDay), await page.evaluate(() => indexJourCourant()), 'retour au vrai jour');
    assert.equal(await page.locator('#addPlanningBtn').isVisible(), true, 'édition normale retrouvée');
    assert.equal(await page.evaluate(() => {
        const jour = indexJourCourant(), cle = planningCleDate(new Date());
        customEvents.push({ id: 'test-arrivee-date', day: jour, date: cle,
            replacesId: 'breakfast', title: 'Petit-déjeuner', type: 'meal',
            startTime: '06:30', endTime: '06:45', deleted: true });
        const portée = planningDateEdition(jour);
        customEvents = customEvents.filter(e => e.id !== 'test-arrivee-date');
        return portée;
    }), await page.evaluate(() => planningCleDate(new Date())), 'un jour préparé reste daté lorsqu’il devient aujourd’hui');
    await page.locator('#planningModal .planning-semaine-actions button[aria-label="Semaine précédente"]').click();
    assert.equal(await page.locator('#planningSemaineType').textContent(), 'Semaine précédente');
    assert.equal(await page.locator('#addPlanningBtn').isVisible(), false, 'la semaine passée reste en lecture seule');
    assert.notEqual(await page.evaluate(() => { openAddModal(); return document.getElementById('addEventModal').style.display; }), 'flex', 'une écriture programmatique dans le passé est refusée');
    // Le raccourci n’est affiché que quand le vrai minuteur est en cours.
    await page.evaluate(() => { focusEtat.running = true; focusEtat.fin = Date.now() + 120000; planningMinuteurEntete(); });
    assert.match(await page.locator('#planningMinuteurEntete').innerText(), /Minuteur/);
    await page.locator('#planningMinuteurEntete').click();
    assert.equal(await page.locator('#panelPomodoro').isVisible(), true, 'le raccourci ouvre le vrai minuteur');
    assert.equal(await page.evaluate(() => planningDecalageSemaine), -1, 'l’ouverture du minuteur ne recale pas sa date');
    assert.deepEqual(errors, [], 'aucune erreur navigateur : ' + errors.join(' | '));
    console.log('ok navigateur semaine : flèches, dates, devoir/examen/férié, cache, modification datée, rechargement, Séance, minuteur, mobile');
} finally { await browser.close(); }
