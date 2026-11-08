/* Citation saisie, appliquée immédiatement, conservée, modifiable et sûre. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8612/';
const browser = await chromium.launch(portable ? { executablePath: await portable.executablePath(), args: portable.args.filter(x => x !== '--single-process') } : {});
try {
  for (const viewport of [{width: 390, height: 844}, {width: 1280, height: 800}]) {
    const page = await browser.newPage({viewport, serviceWorkers: 'block'});
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    await page.goto(site, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, {timeout: 60000});
    await page.evaluate(() => { document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active')); document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); });
    await page.waitForFunction(() => Math.abs(document.getElementById('panelPomodoro').getBoundingClientRect().left) < 1);
    await page.locator('#focusBtnReglages').click();
    await page.locator('.focus-tiroir-item[data-onglet="citations"]').click();
    const champ = page.locator('#focusCitationPersonnelle'), citation = page.locator('#focusCitation');
    assert.equal(await champ.isVisible(), true);
    const saisie = 'Chaque petit pas compte, même aujourd’hui !';
    await champ.fill(saisie);
    assert.equal(await page.locator('#focusCategorieCitation').inputValue(), 'personnelle');
    assert.equal(await citation.textContent(), `“${saisie}”`);
    assert.equal(await page.locator('#focusOptCitation').isChecked(), true);
    await page.waitForTimeout(1200); assert.equal(await champ.inputValue(), saisie, 'aucune perte de saisie pendant le rafraîchissement');
    if (process.env.STUDY_CAPTURE_DIR) await page.screenshot({path: `${process.env.STUDY_CAPTURE_DIR}/citations-${viewport.width}.png`});
    await page.locator('.focus-tiroir-fermer').click();
    assert.equal(await citation.isVisible(), true);
    await page.reload({waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, {timeout: 60000});
    await page.evaluate(() => { document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); });
    assert.equal(await citation.textContent(), `“${saisie}”`, 'la citation survit au rechargement');
    await page.waitForFunction(() => Math.abs(document.getElementById('panelPomodoro').getBoundingClientRect().left) < 1);
    await page.locator('#focusBtnReglages').click(); await page.locator('.focus-tiroir-item[data-onglet="citations"]').click();
    assert.equal(await champ.inputValue(), saisie);
    await page.locator('#focusCategorieCitation').selectOption('motivation');
    assert.notEqual(await citation.textContent(), `“${saisie}”`); assert.equal(await champ.inputValue(), saisie, 'les catégories ne suppriment pas la citation');
    await page.locator('#focusCategorieCitation').selectOption('personnelle'); assert.equal(await citation.textContent(), `“${saisie}”`);
    const malicieux = '<img src=x onerror=alert(1)> & toujours avancer.';
    await champ.fill(malicieux); assert.equal(await citation.textContent(), `“${malicieux}”`);
    assert.equal(await citation.locator('img').count(), 0, 'le texte utilisateur ne doit pas créer de HTML');
    await champ.fill(''); assert.ok((await citation.textContent()).length > 2, 'citation quotidienne quand le champ est vide');
    await page.locator('#focusOptCitation').uncheck(); assert.equal(await citation.isVisible(), false);
    await champ.fill('Avance à ton rythme'); assert.equal(await citation.isVisible(), true, 'écrire une citation doit l’afficher');
    assert.equal(await page.locator('#focusOptCitation').isChecked(), true);
    assert.deepEqual(erreurs, []);
    await page.close(); console.log(`OK citation personnelle ${viewport.width}×${viewport.height}`);
  }
  // Une citation longue ne doit ni déplacer le minuteur à l'arrivée de la
  // fenêtre ni rendre les commandes centrales inaccessibles.
  for (const viewport of [{width: 320, height: 568}, {width: 390, height: 400}, {width: 375, height: 667}, {width: 390, height: 844}]) {
    const page = await browser.newPage({viewport, serviceWorkers: 'block'});
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    await page.goto(site, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, {timeout: 60000});
    await page.evaluate(() => {
      document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active'));
      document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro');
      focusMajReglage('citationPersonnelle', 'A'.repeat(140)); focusMajReglage('citationCategorie', 'personnelle'); focusPeindre();
    });
    await page.waitForFunction(() => Math.abs(document.getElementById('panelPomodoro').getBoundingClientRect().left) < 1);
    const avant = await page.locator('#focusTime').boundingBox();
    await page.evaluate(() => { focusEtat.run = true; focusEtat.objectif = 4; focusEtat.serie = 1; focusEtat.transition = 'attente-reprise'; focusPeindre(); });
    const apres = await page.locator('#focusTime').boundingBox(), fenetre = await page.locator('#focusReprise').boundingBox();
    for (const k of ['x','y','width','height']) assert.ok(Math.abs(avant[k] - apres[k]) < 1, `citation longue : déplacement ${k}`);
    for (const element of await page.locator('#focusPage .focus-center button').all()) {
      if (!await element.isVisible()) continue;
      await element.scrollIntoViewIfNeeded();
      await element.evaluate(e => { const r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); if (!e.contains(hit)) throw new Error('commande cachée après une citation longue'); });
    }
    assert.ok(fenetre && fenetre.y >= 0);
    assert.equal(await page.locator('#focusCitation').getAttribute('tabindex'), '0', 'citation débordante accessible au clavier');
    await page.close();
    console.log(`OK citation longue et reprise ${viewport.width}×${viewport.height}`);
  }
} finally { await browser.close(); }
