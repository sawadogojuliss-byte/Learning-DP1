/* Clic réel sur « Lancer le minuteur », avec le vrai moteur et une horloge contrôlée. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8552/';
const browser = await chromium.launch(portable ? { executablePath: await portable.executablePath(), args: portable.args.filter(x => x !== '--single-process') } : {});

async function ouvrir(width, heure = '2031-06-15T10:00:00', debut = '09:30', fin = '10:30', reveil = '08:00') {
    const page = await browser.newPage({ viewport: { width, height: width === 320 ? 568 : 844 }, serviceWorkers: 'block' });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('**/*', r => r.request().url().startsWith(site) ? r.continue() : r.abort());
    await page.clock.install({ time: new Date(heure) });
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    await page.goto(site, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
    await page.evaluate(({ debut, fin, reveil }) => {
        document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active'));
        document.getElementById('planningModal').classList.add('active');
        selectedDay = 6; planningDecalageSemaine = 0;
        sundayWakeup = reveil; sundaySleepHours = 8;
        subjects = [{ name: 'Mathématiques', icon: '📚', level: 'HL' }];
        optionalSubjects = []; selectedActivities = [];
        customEvents = [{ id: 'minuteur-test', day: 6, date: '2031-06-15', title: 'Révision de physique', startTime: debut, endTime: fin, type: 'study', icon: '📚', source: 'custom', pinned: true, timestamp: Date.now() }];
        emploiFige = null; v3Save(); navigateTo('seances');
    }, { debut, fin, reveil });
    return { page, errors };
}
async function choisir(page) {
    const carte = page.locator('#focusAccueilListe .focus-seance').filter({ hasText: 'Révision de physique' });
    assert.equal(await carte.count(), 1);
    assert.equal(await carte.isEnabled(), true);
    await carte.click();
    assert.equal(await page.locator('#focusAccueilContinuer').isEnabled(), true);
}
async function finir(page, errors) { assert.deepEqual(errors, []); await page.close(); }

try {
    for (const width of [320, 390, 1280]) {
        // Le bouton démarre vraiment, et le retour ou un second clic ne met pas en pause.
        let { page, errors } = await ouvrir(width);
        await choisir(page);
        const planning = await page.evaluate(() => JSON.stringify(customEvents));
        await page.locator('#focusAccueilContinuer').click();
        assert.equal(await page.locator('#panelPomodoro').evaluate(el => el.classList.contains('active')), true);
        assert.equal(await page.locator('#focusTache').inputValue(), 'Révision de physique');
        const depart = await page.evaluate(() => ({ running: focusEtat.running, restant: focusEtat.restant, fin: focusEtat.fin, id: focusSeanceMinuteur?.id }));
        assert.equal(depart.running, true); assert.equal(depart.id, 'minuteur-test');
        await page.clock.fastForward(3000);
        assert.ok(await page.evaluate(() => focusEtat.restant) <= depart.restant - 3);
        await page.evaluate(() => navigateTo('seances'));
        assert.equal(await page.locator('#focusAccueil').isVisible(), true);
        await page.locator('#focusAccueilContinuer').click();
        assert.equal(await page.evaluate(() => focusEtat.running), true);
        assert.equal(await page.evaluate(() => focusEtat.fin), depart.fin);
        assert.equal(await page.evaluate(() => JSON.stringify(customEvents)), planning);
        // Le compte à rebours continue après un rechargement, sans repartir à zéro.
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
        await page.evaluate(() => { document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); });
        assert.equal(await page.evaluate(() => focusEtat.running), true);
        assert.equal(await page.evaluate(() => focusEtat.fin), depart.fin);
        const avant = await page.evaluate(() => focusEtat.restant);
        await page.clock.fastForward(3000);
        assert.ok(await page.evaluate(() => focusEtat.restant) <= avant - 3);
        await page.locator('#focusPlay').click();
        assert.equal(await page.evaluate(() => focusEtat.running), false);
        const enPause = await page.evaluate(() => focusEtat.restant);
        await page.evaluate(() => navigateTo('seances'));
        await choisir(page);
        await page.locator('#focusAccueilContinuer').click();
        assert.equal(await page.evaluate(() => focusEtat.running), true);
        assert.equal(await page.evaluate(() => focusEtat.restant), enPause);
        await finir(page, errors);

        // Un objectif préexistant est conservé, ou explicitement complété.
        for (const ajouter of (width === 390 ? [false, true] : [false])) {
            ({ page, errors } = await ouvrir(width));
            await page.evaluate(() => navigateTo('pomodoro'));
            await page.locator('#focusTache').fill('Mon objectif');
            await page.evaluate(() => navigateTo('seances'));
            await choisir(page);
            await page.locator('#focusAccueilContinuer').click();
            assert.equal(await page.evaluate(() => focusEtat.running), false);
            await page.getByRole('button', { name: ajouter ? 'Accoler la séance' : 'Garder mon objectif' }).click();
            assert.equal(await page.locator('#focusTache').inputValue(), ajouter ? 'Mon objectif · Révision de physique' : 'Mon objectif');
            assert.equal(await page.evaluate(() => focusEtat.running), true);
            await finir(page, errors);
        }
        if (width !== 390) {
            console.log(`OK lancement, retour et objectif ${width}px`);
            continue;
        }
        // Si la séance expire pendant la confirmation, rien ne démarre et l'objectif reste intact.
        ({ page, errors } = await ouvrir(width, '2031-06-15T10:00:30', '09:30', '10:01'));
        await page.evaluate(() => navigateTo('pomodoro'));
        await page.locator('#focusTache').fill('Objectif à conserver');
        await page.evaluate(() => navigateTo('seances'));
        await choisir(page);
        await page.locator('#focusAccueilContinuer').click();
        await page.clock.fastForward(31000);
        await page.getByRole('button', { name: 'Accoler la séance' }).click();
        assert.equal(await page.evaluate(() => focusEtat.running), false);
        assert.equal(await page.locator('#focusTache').inputValue(), 'Objectif à conserver');
        assert.equal(await page.locator('#panelSeances').evaluate(el => el.classList.contains('active')), true);
        await finir(page, errors);

        // Une séance réellement terminée à minuit est accessible avant minuit.
        ({ page, errors } = await ouvrir(width, '2031-06-15T23:50:00', '23:30', '00:00'));
        await choisir(page);
        assert.equal(await page.evaluate(() => focusSeancesJour().find(s => s.id === 'minuteur-test').duree), 30);
        await page.locator('#focusAccueilContinuer').click();
        assert.equal(await page.evaluate(() => focusEtat.running && focusSeanceMinuteur.fin === 1440), true);
        await finir(page, errors);

        // Une séance future ou passée reste inaccessible, avec explication visible.
        ({ page, errors } = await ouvrir(width, '2031-06-15T10:00:00', '13:00', '14:00', '12:00'));
        assert.equal(await page.locator('#focusAccueilContinuer').isDisabled(), true);
        assert.match(await page.locator('#focusAccueilNote').innerText(), /Aucune séance en cours/);
        assert.equal(await page.evaluate(() => focusEtat.running), false);
        await finir(page, errors);
        console.log(`OK lancement, retour, objectif, expiration et minuit ${width}px`);
    }
} finally { await browser.close(); }
