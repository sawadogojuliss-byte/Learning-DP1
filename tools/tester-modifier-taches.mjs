/* Modification des tâches et sous-tâches Pomodoro, sans compte réel. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8640/';
const browser = await chromium.launch(portable ? { executablePath: await portable.executablePath(), args: portable.args.filter(x => x !== '--single-process') } : {});
async function ouvrir(page) {
  await page.goto(site, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
  await page.evaluate(() => { document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active')); document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); });
  await page.locator('#focusBtnTaches').click();
}
try {
  for (const viewport of [{width:320,height:568}, {width:390,height:844}, {width:1280,height:800}]) {
    const page = await browser.newPage({ viewport, serviceWorkers: 'block' });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.route('**/*', r => r.request().url().startsWith(site) ? r.continue() : r.abort());
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    await ouvrir(page);
    await page.locator('#focusNouvelle').fill('Réviser chimie');
    await page.locator('#focusNouvelle').press('Enter');
    await page.evaluate(() => { focusTaches[0].sous = [{id:987654, texte:'Lire le chapitre', fait:true}]; focusSauverTaches(); focusPeindreTaches(); });
    const tache = page.locator('#focusListe > li').first();
    const ancienId = await page.evaluate(() => focusTaches[0].id);
    const statsAvant = await page.evaluate(() => JSON.stringify(statsLire()));
    await tache.locator(':scope > .focus-ligne .focus-tache').click();
    assert.equal(await page.locator('#focusTache').inputValue(), 'Réviser chimie');
    await tache.locator(':scope > .focus-ligne [aria-label="Modifier la tâche"]').click();
    const champ = tache.locator(':scope > .focus-edition-tache input');
    assert.equal(await champ.inputValue(), 'Réviser chimie');
    await champ.fill('  '); await tache.locator(':scope > .focus-edition-tache button[type=submit]').click();
    assert.match(await tache.locator(':scope > .focus-edition-tache .focus-edition-erreur').innerText(), /nom/);
    assert.equal(await page.evaluate(() => focusTaches[0].texte), 'Réviser chimie');
    await champ.fill('Réviser physique'); await champ.press('Enter');
    assert.equal(await page.evaluate(() => focusTaches[0].id), ancienId);
    assert.equal(await page.evaluate(() => focusTaches[0].texte), 'Réviser physique');
    assert.equal(await page.locator('#focusTache').inputValue(), 'Réviser physique');
    assert.equal(await page.evaluate(() => focusTaches[0].sous[0].fait), true);
    assert.equal(await page.evaluate(() => JSON.stringify(statsLire())), statsAvant, 'modifier ne coche ni ne décoche une tâche');
    assert.equal(await page.evaluate(() => syncFocusLire().taches[0].texte), 'Réviser physique', 'la modification entre dans les réglages synchronisés');
    const sous = tache.locator('.focus-sous > li').first();
    await sous.getByRole('button', {name:'Modifier la sous-tâche'}).click();
    await sous.locator('.focus-edition-tache input').fill('Ne pas garder');
    await sous.locator('.focus-edition-tache').getByRole('button', {name:'Annuler'}).click();
    assert.equal(await page.evaluate(() => focusTaches[0].sous[0].texte), 'Lire le chapitre');
    await sous.getByRole('button', {name:'Modifier la sous-tâche'}).click();
    await sous.locator('.focus-edition-tache input').fill('Faire les exercices');
    await sous.locator('.focus-edition-tache input').press('Escape');
    assert.equal(await page.evaluate(() => focusTaches[0].sous[0].texte), 'Lire le chapitre');
    await sous.locator('.focus-tache-menu:not(.focus-tache-modifier)').click();
    await sous.getByRole('menuitem', {name:'Modifier'}).click();
    await sous.locator('.focus-edition-tache input').fill('Faire les exercices');
    await sous.locator('.focus-edition-tache button[type=submit]').click();
    assert.deepEqual(await page.evaluate(() => ({ id:focusTaches[0].sous[0].id, fait:focusTaches[0].sous[0].fait, texte:focusTaches[0].sous[0].texte })), {id:987654,fait:true,texte:'Faire les exercices'});
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('studyPlanIB_focusTaches'))[0].texte), 'Réviser physique');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, {timeout:60000});
    await page.evaluate(() => { document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active')); document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); });
    await page.locator('#focusBtnTaches').click();
    assert.match(await page.locator('#focusListe').innerText(), /Réviser physique/);
    assert.match(await page.locator('#focusListe').innerText(), /Faire les exercices/);
    assert.deepEqual(errors, []);
    console.log(`OK tâches et sous-tâches : modification, annulation et persistance ${viewport.width}×${viewport.height}`);
    await page.close();
  }
} finally { await browser.close(); }
