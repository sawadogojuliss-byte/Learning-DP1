/* Vrai navigateur : faits du planning et conflits fictifs, jamais de compte,
   de mail ni d'écriture distante. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage();
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto('https://sawadogojuliss-byte.github.io/Learning-DP1/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__STUDYPLAN_READY === true, null, { timeout: 60000 });
    const result = await page.evaluate(() => {
        const lire = (items, id) => {
            const ev = items.find(e => e.id === id);
            return ev && [ev.startTime, ev.endTime];
        };
        weekdayWakeup = '07:00';
        transportMode = 'voiture'; carDeparture = '07:20'; carToSchool = 30; carFromSchool = 40;
        selectedActivities = []; customEvents = []; habitudesDefinies = false;
        emploiFige = null;
        let events = generateDayEvents(0);
        const matin = { breakfast: lire(events, 'breakfast'), trajet: lire(events, 'commute1'),
            retour: lire(events, 'commute2'), fige: emploiEstFige() };
        const memorise = JSON.parse(JSON.stringify(emploiFige));
        emploiFige = memorise;
        const relu = { breakfast: lire(generateDayEvents(0), 'breakfast'), trajet: lire(generateDayEvents(0), 'commute1') };
        selectedActivities = [{ name: 'Sport', icon: '🏃', days: [0], sameTime: true,
            startTime: '07:10', endTime: '08:00', dayTimes: {} }];
        events = generateDayEvents(0);
        v3SignalerChevauchementJour(events, 0);
        return {
            matin, relu, sport: lire(events, 'activity-Sport'),
            trajet: lire(events, 'commute1'), cours: lire(events, 'school1'),
            alerte: document.getElementById('chevauchementJour')?.textContent || ''
        };
    });
    assert.ok(result.matin.breakfast && result.matin.breakfast[0] < '12:00', 'petit-déjeuner envoyé le soir');
    assert.deepEqual(result.matin.trajet, ['07:20', '07:50']);
    assert.equal(result.matin.retour[0], '16:25');
    assert.equal(result.matin.fige, true);
    assert.deepEqual(result.relu.breakfast, result.matin.breakfast, 'relecture du petit-déjeuner');
    assert.deepEqual(result.relu.trajet, result.matin.trajet, 'relecture du trajet');
    assert.deepEqual(result.sport, ['07:10', '08:00'], 'activité choisie déplacée');
    assert.deepEqual(result.trajet, ['07:20', '07:50'], 'trajet déplacé par l’activité');
    assert.equal(result.cours[0], '07:50', 'cours modifié');
    assert.match(result.alerte, /se chevauchent/, 'conflit non visible');
    assert.deepEqual(errors, [], 'erreurs navigateur : ' + errors.join(' | '));
    console.log('ok horaires en navigateur : repas matin, trajets, activité choisie et conflit visible, sans envoi');
} finally {
    await browser.close();
}
