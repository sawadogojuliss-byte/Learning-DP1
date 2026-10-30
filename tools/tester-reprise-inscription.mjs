/* Vérifie, dans un navigateur jetable, que l'inscription reprend au bon écran.
   Pour chaque écran atteint, le navigateur est fermé juste après le passage
   puis rouvert avec le même stockage : l'écran doit être le même qu'avant.
   Aucun compte réel, aucune donnée Firestore. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const SITE = process.env.SITE || 'https://sawadogojuliss-byte.github.io/Learning-DP1/';
const ANNEE = process.env.ANNEE || 'DP1';

const attendrePret = async page => {
    await page.waitForFunction(() => window.__STUDYPLAN_READY === true, null, { timeout: 60000 });
    await page.waitForTimeout(500);
};
const ecran = page => page.evaluate(() =>
    [...document.querySelectorAll('.context-modal.active, .app-panel.active')].map(el => el.id).join(',') || 'accueil');

const etapes = [
    ['classe : choix de l\'année', page => page.evaluate(annee => setIbYear(annee), ANNEE)],
    ['classe → objectif', page => page.click('button[onclick="validateClasse()"]')],
    ['objectif → Retour à la classe', page => page.click('button[onclick="hideObjectivesPage()"]')],
    ['classe → objectif (2)', page => page.click('button[onclick="validateClasse()"]')],
    ['objectif → matières', page => page.click('button[onclick="validateObjective()"]')],
    ['matières → sommeil', async page => {
        await page.evaluate(() => {
            subjects = [
                { name: 'Mathématiques AA', level: 'HL' }, { name: 'Anglais A', level: 'HL' }, { name: 'Chimie', level: 'HL' },
                { name: 'Français A', level: 'SL' }, { name: 'Biologie', level: 'SL' }, { name: 'Histoire', level: 'SL' }
            ];
            optionalSubjects = [];
            updateSubjectsUI();
        });
        await page.click('button[onclick="validateSubjects()"]');
    }],
    ['sommeil → habitudes', page => page.click('button[onclick="validateSleep()"]')],
    ['habitudes → transport', async page => {
        await page.evaluate(() => { choisirRepas('petitDej', 'aucun'); choisirRepas('diner', 'aucun'); });
        await page.click('button[onclick="validateHabits()"]');
    }],
    ['transport → voiture', page => page.click('button[onclick="selectTransport(\'voiture\')"]')],
    ['voiture → activités', page => page.click('button[onclick="saveCarConfig()"]')],
    ['activités → écran', page => page.click('button[onclick="goToScreenTime()"]')],
    ['écran → temps libre', page => page.click('button[onclick="goToFreeTime()"]')]
];

const browser0 = await chromium.launch({ headless: true });
let browser = browser0;
try {
    let context = await browser.newContext({ viewport: { width: 1240, height: 850 } });
    let page = await context.newPage();
    const erreurs = [];
    page.on('pageerror', error => erreurs.push(String(error)));
    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await attendrePret(page);
    await page.click('#btnCommencer');
    await page.waitForTimeout(300);
    await page.fill('#nameInput', 'Testeur');
    await page.click('button[onclick="handleContinue()"]');
    await page.waitForTimeout(150);

    for (const [nom, action] of etapes) {
        await action(page);
        await page.waitForTimeout(150);
        const avant = await ecran(page);
        const stockage = await context.storageState();
        await browser.close();
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({ viewport: { width: 1240, height: 850 }, storageState: stockage });
        page = await context.newPage();
        page.on('pageerror', error => erreurs.push(String(error)));
        await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await attendrePret(page);
        const apres = await ecran(page);
        assert.equal(apres, avant, `après « ${nom} », la réouverture doit revenir à l'écran affiché`);
        console.log(`OK ${nom} : ${apres}`);
    }
    assert.deepEqual(erreurs, [], 'aucune erreur JavaScript pendant l\'inscription');
    console.log('Reprise de l\'inscription : OK');
} finally {
    await browser.close();
}
