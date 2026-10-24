/* Popup en vrai navigateur, avec activités fictives dans une session jetable.
   Aucun compte, aucun envoi distant, aucune fiche de test. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const SITE = 'https://sawadogojuliss-byte.github.io/Learning-DP1/';
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__STUDYPLAN_READY === true, null, { timeout: 60000 });
    await page.evaluate(() => {
        selectedDay = 0;
        selectedActivities = [];
        customEvents = [];
        window.__testSaves = 0;
        window.__testEvents = [{ id: 'sport', title: 'Sport', type: 'activity', icon: '⚽',
            startTime: '18:00', endTime: '19:00', editable: true, kind: 'pinned' }];
        window.generateDayEvents = () => {
            const out = window.__testEvents.map(ev => {
                const ov = customEvents.find(item => item.replacesId === ev.id);
                return ov ? { ...ev, startTime: ov.startTime, endTime: ov.endTime } : ev;
            });
            return out.concat(customEvents.filter(ev => !ev.replacesId));
        };
        window.v3Save = () => { window.__testSaves++; };
        window.renderPlanning = () => {};
        window.closeAddModal = () => {};
        window.closeEditModal = () => { editingEvent = null; };
        window.v3Toast = () => {};
        window.bedtimeForDay = () => '22:00';
        document.getElementById('activityNameInput').value = 'Lecture';
        document.getElementById('activityStartInput').value = '18:30';
        document.getElementById('activityEndInput').value = '19:00';
        confirmAddActivity();
    });
    const popup = page.locator('#chevauchementPopup');
    assert.equal(await popup.count(), 1);
    assert.match(await popup.innerText(), /Rien n’a été modifié/);
    assert.match(await popup.innerText(), /Sport/);
    assert.equal(await popup.locator('[data-deplacer]').count(), 1);
    assert.equal(await popup.locator('.chev-dialogue').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
    await popup.locator('[data-deplacer]').click();
    assert.match(await popup.locator('#chevauchementApercu').innerText(), /Sport/);
    assert.match(await popup.locator('#chevauchementApercu').innerText(), /19:00 → 20:00/);
    assert.equal(await page.evaluate(() => window.__testSaves), 0);
    await popup.locator('[data-retour]').click();
    await popup.locator('[data-autre-creneau]').click();
    assert(await popup.locator('.chev-proposition').count() > 0);
    await popup.locator('#chevauchementChoix [data-annuler]').click();
    assert.equal(await popup.count(), 0);
    assert.equal(await page.evaluate(() => window.__testSaves), 0);
    await page.evaluate(() => confirmAddActivity());
    await popup.locator('[data-deplacer]').click();
    await popup.locator('[data-confirmer]').click();
    assert.equal(await popup.count(), 0);
    assert.deepEqual(await page.evaluate(() => ({
        saves: window.__testSaves,
        sport: customEvents.find(e => e.replacesId === 'sport')?.endTime,
        lecture: customEvents.find(e => e.title === 'Lecture')?.endTime
    })), { saves: 1, sport: '20:00', lecture: '19:00' });
    await page.evaluate(() => {
        customEvents = [];
        window.__testEvents = [
            { id: 'cours', title: 'Cours', type: 'school', startTime: '18:00', endTime: '19:00' }
        ];
        v3OuvrirChoixChevauchement({ mode: 'ajout', day: 0, title: 'Lecture', icon: '📖',
            start: '18:30', end: '19:00', excludeIds: [], conflits: window.__testEvents });
    });
    assert.equal(await popup.locator('[data-deplacer]').count(), 0, 'ne jamais déplacer un cours');
    await page.keyboard.press('Escape');
    assert.equal(await popup.count(), 0);
    await page.evaluate(() => {
        window.__testEvents = [
            { id: 'sport', title: 'Sport', type: 'activity', startTime: '18:00', endTime: '19:00', editable: true },
            { id: 'danse', title: 'Danse', type: 'activity', startTime: '18:15', endTime: '18:45', editable: true }
        ];
        v3OuvrirChoixChevauchement({ mode: 'ajout', day: 0, title: 'Lecture', icon: '📖',
            start: '18:30', end: '19:00', excludeIds: [], conflits: window.__testEvents });
    });
    assert.equal(await popup.locator('.chev-carte-deja').count(), 2);
    assert.equal(await popup.locator('[data-deplacer]').count(), 0);
    assert.deepEqual(errors, [], 'erreurs JavaScript : ' + errors.join(' | '));
    console.log('ok popup navigateur mobile : ajout réel, choix/retour/annulation, aperçu, deux durées, cours protégé, conflits multiples, aucune donnée envoyée');
} finally {
    await browser.close();
}
