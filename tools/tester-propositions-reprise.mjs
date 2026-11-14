/* Vérifie les trois maquettes de reprise, sans lancer de minuteur. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8596/';
const browser = await chromium.launch(portable ? { executablePath: await portable.executablePath(), args: portable.args.filter(x => x !== '--single-process') } : {});
try {
  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
    const page = await browser.newPage({ viewport });
    const errors = []; page.on('pageerror', error => errors.push(String(error)));
    const response = await page.goto(new URL('livrables/propositions-pomodoro/', site).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.equal(response.status(), 200);
    assert.equal(await page.locator('[data-choice]').count(), 3);
    for (const name of ['a', 'b', 'c']) {
      await page.locator(`[data-choice="${name}"]`).click();
      assert.equal(await page.locator(`[data-choice="${name}"]`).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-choice][aria-pressed="true"]').count(), 1);
      const popup = page.locator(`[data-popup="${name}"]`);
      assert.equal(await popup.isVisible(), true);
      assert.equal(await page.locator('[data-popup]:visible').count(), 1);
      const rect = await popup.evaluate(el => {
        const p = el.getBoundingClientRect(), stage = el.closest('.stage').getBoundingClientRect();
        return { left: p.left, right: p.right, top: p.top, bottom: p.bottom, sl: stage.left, sr: stage.right, st: stage.top, sb: stage.bottom };
      });
      assert.ok(rect.left >= rect.sl && rect.right <= rect.sr && rect.top >= rect.st && rect.bottom <= rect.sb, `${viewport.width}x${viewport.height} : fenêtre hors de l'aperçu ${name}`);
      for (const button of await popup.locator('button').all()) {
        await button.scrollIntoViewIfNeeded();
        const bounds = await button.boundingBox();
        assert.ok(bounds && bounds.width >= 44 && bounds.height >= 40 && bounds.x >= -1 && bounds.x + bounds.width <= viewport.width + 1, 'bouton inaccessible ' + name);
      }
      const url = page.url();
      await popup.locator('[data-demo="reprendre"]').click();
      assert.match(await page.locator('.demo-status').innerText(), /Aperçu uniquement/);
      assert.equal(page.url(), url, 'un clic de maquette ne doit pas naviguer');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'débordement horizontal');
    assert.deepEqual(errors, []); await page.close();
    console.log(`OK trois propositions, interactions et affichage ${viewport.width}×${viewport.height}`);
  }
} finally { await browser.close(); }
