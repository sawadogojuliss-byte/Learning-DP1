/* Vérifie le format Atelier sur le site déployé en navigateur. La page
   admin reçoit seulement des données fictives injectées dans CE navigateur :
   aucun document Firestore ni mail de test n'est envoyé. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const SITE = 'https://sawadogojuliss-byte.github.io/Learning-DP1/';
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__STUDYPLAN_READY === true, null, { timeout: 60000 });
    await page.waitForFunction(() => !document.body.classList.contains('booting'), null, { timeout: 10000 });
    await page.evaluate(() => {
        const noms = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
        const jours = noms.map((j,i) => ({ j, s: i===0 ? [{ d:'08:00',f:'09:30',t:'Mathématiques' }] : [] }));
        const ancien = { type:'emploi',id:'e_essai',appareil:'essai',nom:'Élève Atelier',classe:'DP2',
            at:'2026-10-22T08:00:00Z',jours:[jours[0]],complet:1 };
        const nouveau = { ...ancien,at:'2026-10-24T08:00:00Z',jours };
        const contact = { type:'question',id:'q_demo_atelier',nom:'Contact Atelier',at:'2026-10-24T09:00:00Z',texte:'Fictif' };
        const f = boiteFusionner([ancien,nouveau,contact]);
        window.boiteListesCache = f;
        const panel = document.getElementById('panelEmplois');
        panel.classList.add('active');
        boiteBrancherAdmin();
        boiteRendreEmplois(f);
    });
    assert.match(await page.locator('#emploisStatut').innerText(), /2 personnes · 1 planning reçu/);
    assert.equal(await page.locator('#emploisListe .emploi-atelier-personne').count(), 2);
    assert.equal(await page.locator('#emploisDetail .emploi-atelier-jour').count(), 7);
    assert.equal(await page.locator('#emploisDetail .emploi-atelier-slot').count(), 1);
    assert.equal(await page.locator('#emploisDetail .emploi-atelier-historique button').count(), 3);
    assert.equal(await page.locator('#emploisDetail').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
    await page.locator('#emploisFiltre').fill('Contact Atelier');
    assert.equal(await page.locator('#emploisListe .emploi-atelier-personne').count(), 1);
    assert.match(await page.locator('#emploisDetail').innerText(), /Aucun planning reçu/);
    await page.locator('#emploisFiltre').fill('');
    await page.locator('#emploisFiltres [data-emploi-filtre="recus"]').click();
    assert.equal(await page.locator('#emploisListe .emploi-atelier-personne').count(), 1);
    assert.match(await page.locator('#emploisDetail').innerText(), /Mathématiques/);
    await page.locator('#emploisDetail .emploi-atelier-historique summary').click();
    await page.locator('#emploisDetail [data-emploi-version="1"]').click();
    assert.match(await page.locator('#emploisDetail').innerText(), /Jour non transmis dans cette version/);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#emploisDetail .emploi-atelier-jour').count(), 7);
    assert(await page.locator('#emploisDetail .emploi-atelier-calendrier-scroll').evaluate(el => el.scrollWidth > el.clientWidth),
        'le calendrier mobile doit pouvoir défiler horizontalement');
    assert.equal(await page.locator('#panelEmplois .admin-nav').isVisible(), true);
    assert.equal(await page.locator('#panelEmplois .admin-nav-retour').isVisible(), true);
    assert.equal(await page.locator('#panelEmplois .admin-nav-lien[aria-label="Espace admin"]').isVisible(), true);
    assert.deepEqual(errors, [], 'erreur JS sur la page : ' + errors.join(' | '));
    console.log('ok Atelier en navigateur : élèves, filtres, semaines reçues, versions, mobile, aucun envoi distant');
} finally {
    await browser.close();
}
