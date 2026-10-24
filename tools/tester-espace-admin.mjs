/* Vérifie la nouvelle navigation avec un rôle simulé dans un navigateur jetable.
   Aucun compte admin réel, aucun mail, aucune fiche Firestore. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const SITE = 'https://sawadogojuliss-byte.github.io/Learning-DP1/';
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 850 } });
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__STUDYPLAN_READY === true, null, { timeout: 60000 });
    await page.evaluate(() => {
        window.boiteVerifierAdmin = () => Promise.resolve(false);
        window.boiteSignalerOuverture = () => {};
        window.boiteEstAdmin = () => false;
        boiteMajMenu();
        annonceMajMenu();
    });
    const affichage = id => page.locator('#' + id).evaluate(el => getComputedStyle(el).display);
    assert.equal(await affichage('menuAnnonce'), 'flex', 'les élèves gardent la lecture des annonces');
    assert.equal(await affichage('menuEspaceAdmin'), 'none');
    await page.evaluate(() => navigateTo('admin'));
    assert.equal(await page.locator('#panelAdmin').isVisible(), false, 'la page ne doit pas s’ouvrir pour un élève');
    await page.evaluate(() => {
        window.boiteEstAdmin = () => true;
        window.boiteOuvrirAdmin = section => {
            document.getElementById({ retours:'panelRetours', questions:'panelQuestions', emplois:'panelEmplois' }[section]).classList.add('active');
        };
        window.initAnnonce = () => {}; // Navigation uniquement ; pas d'initialisation ni d'envoi.
        boiteMajMenu();
        annonceMajMenu();
        document.getElementById('sideMenu').style.right = '0';
        document.getElementById('sideMenuOverlay').style.display = 'block';
    });
    assert.equal(await affichage('menuEspaceAdmin'), 'flex');
    for (const id of ['menuAnnonce', 'menuRetours', 'menuQuestions', 'menuEmplois']) {
        assert.equal(await affichage(id), 'none', id + ' doit être regroupé');
    }
    await page.locator('#menuEspaceAdmin').click();
    assert.equal(await page.locator('#panelAdmin').isVisible(), true);
    assert.equal(await page.locator('#panelAdmin nav button').count(), 4);
    assert.equal(await page.locator('#panelAdmin .admin-atelier-rail').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(22, 70, 51)');
    const destinations = [
        ['annonce','panelAnnonce'], ['retours','panelRetours'],
        ['questions','panelQuestions'], ['emplois','panelEmplois']
    ];
    for (const [name,id] of destinations) {
        await page.locator('#panelAdmin nav button[onclick="navigateTo(\'' + name + '\')"]').click();
        assert.equal(await page.locator('#' + id).isVisible(), true, 'lien ' + name);
        await page.evaluate(() => navigateTo('admin'));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#panelAdmin .admin-atelier-rail').isVisible(), false);
    assert.equal(await page.locator('#panelAdmin .admin-atelier-retour-mobile').isVisible(), true);
    assert.equal(await page.locator('#panelAdmin nav button').count(), 4);
    await page.evaluate(() => {
        window.boiteEstAdmin = () => false;
        boiteMajMenu(); annonceMajMenu();
    });
    assert.equal(await affichage('menuAnnonce'), 'flex');
    assert.equal(await affichage('menuEspaceAdmin'), 'none');
    assert.deepEqual(errors, [], errors.join(' | '));
    console.log('ok Espace admin navigateur : menu élèves/admin, quatre destinations existantes, Atelier et mobile, aucune donnée distante');
} finally {
    await browser.close();
}
