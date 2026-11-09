/* Test navigateur : choix, persistance, fichiers décodables et annonce de fin. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8595/';
const browser = await chromium.launch({ ...(portable ? { executablePath: await portable.executablePath(), args: portable.args.filter(x => x !== '--single-process') } : {}), args: [...(portable ? portable.args.filter(x => x !== '--single-process') : []), '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
try {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const page = await browser.newPage({ viewport, serviceWorkers: 'block' });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
    await page.evaluate(() => { document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active')); document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); });
    await page.waitForFunction(() => {
      const panel = document.getElementById('panelPomodoro'), page = document.getElementById('focusPage');
      const b = panel.getBoundingClientRect();
      return panel.classList.contains('active') && !page.hidden && Math.abs(b.left) < 1 && Math.abs(b.width - innerWidth) < 1;
    }, null, { timeout: 10000 });
    await page.locator('#focusBtnReglages').click();
    await page.locator('#focusReglages [data-onglet="voix"]').click();
    await page.locator('.focus-voix-option').first().waitFor({ state: 'visible' });
    const feminine = page.locator('input[name=focusVoixType][value=feminine]');
    const masculine = page.locator('input[name=focusVoixType][value=masculine]');
    assert.equal(await feminine.isChecked(), true, 'la voix féminine doit rester le défaut');
    const options = page.locator('.focus-voix-option'); assert.equal(await options.count(), 2);
    for (const option of await options.all()) {
      await option.scrollIntoViewIfNeeded();
      const b = await option.boundingBox(); assert.ok(b && b.x >= -1 && b.x + b.width <= viewport.width + 1, 'option hors écran ' + JSON.stringify(b));
    }
    await options.nth(1).click();
    assert.equal(await masculine.isChecked(), true); assert.equal(await page.evaluate(() => localStorage.getItem('studyPlanIB_voixType')), 'masculine');
    assert.deepEqual(await page.evaluate(() => chronoVoixPhrasePause(21)), ['masculine-complet-21']);
    assert.ok((await page.evaluate(() => chronoVoixUrl('masculine-complet-21'))).includes('essai-prises-continues/21.mp3'));
    // Le navigateur décode les vraies ressources et programme la prise approuvée dans l'AudioContext.
    if (viewport.width === 1280) {
      const fichiers = await page.evaluate(async () => {
        const noms = ['masculine-debut', 'masculine-pause'];
        for (let n = 1; n <= 60; n++) noms.push('masculine-n-' + n);
        for (const n of [1, 2, 3, 4, 5, 10, 15, 21]) noms.push('masculine-complet-' + n);
        // Éviter 62 téléchargements simultanés : GitHub Pages peut limiter
        // une telle rafale, contrairement au préchargement réel de quelques fichiers.
        const resultats = [];
        for (let i = 0; i < noms.length; i += 5) {
          resultats.push(...await Promise.all(noms.slice(i, i + 5).map(async nom => {
            try { const b = await chronoVoixCharger(nom); return { nom, duree: b.duration }; }
            catch (e) { return { nom, erreur: String(e) }; }
          })));
        }
        return resultats.filter(x => x.erreur || x.duree < .25);
      });
      assert.deepEqual(fichiers, [], 'tous les fichiers masculins doivent être disponibles et décodables');
      const joue = await page.evaluate(async () => {
        return await new Promise(resolve => {
          const noms = chronoVoixPhrasePause(21);
          chronoVoixJouerTampons(noms, ok => resolve({ ok, noms, sources: chronoVoixSources.length }));
        });
      });
      assert.equal(joue.ok, true); assert.equal(joue.sources, 0, 'les sources terminées doivent être libérées');
      await page.evaluate(() => {
        window.__dernierEssai = null;
        const original = chronoVoixJouerTampons;
        chronoVoixJouerTampons = function (noms, suite, options) { window.__dernierEssai = noms.slice(); return original(noms, suite, options); };
        chronoAnnoncerPause(60);
      });
      await page.waitForFunction(() => window.__dernierEssai !== null, null, { timeout: 10000 });
      assert.deepEqual(await page.evaluate(() => window.__dernierEssai), ['masculine-debut', 'masculine-n-60', 'masculine-pause']);
      await page.evaluate(() => { chronoAnnonceGeneration++; chronoVoixArreter(); });
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
    await page.evaluate(() => { document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); focusBasculerReglages(); focusChoisirOnglet('voix'); });
    assert.equal(await masculine.isChecked(), true, 'choix masculin perdu après rechargement');
    await options.nth(0).click();
    assert.equal(await feminine.isChecked(), true);
    assert.deepEqual(await page.evaluate(() => chronoVoixPhrasePause(5)), ['seance-fin', 'n-5', 'minutes-de-pause']);
    await page.locator('#focusVoixActive').uncheck({ force: true });
    assert.equal(await page.evaluate(() => chronoVoixActive()), false);
    assert.deepEqual(errors, []); await page.close();
  }
  console.log('OK choix des voix, mobile, persistance, décodage des 60 durées et lecture réelle');
} finally { await browser.close(); }
