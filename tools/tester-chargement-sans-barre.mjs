/* Vérifie le premier chargement et une actualisation, réseau volontairement lent. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8628/';
const browser = await chromium.launch(portable ? { executablePath: await portable.executablePath(), args: portable.args.filter(a => a !== '--single-process') } : {});
try {
  const page = await browser.newPage({ serviceWorkers: 'block' });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (!url.startsWith(site)) return route.abort();
    if (url.includes('/pages/') && url.includes('.html')) await new Promise(resolve => setTimeout(resolve, 1300));
    return route.continue();
  });
  async function controler(enCours) {
    const state = await page.evaluate(() => ({
      loading: document.body.classList.contains('booting'),
      status: !!document.querySelector('#boot-status') && getComputedStyle(document.querySelector('#boot-status')).display !== 'none',
      bars: document.querySelectorAll('#boot-status [role="progressbar"], #boot-jauge, .boot-jauge').length
    }));
    assert.equal(state.loading, enCours);
    assert.equal(state.status, enCours);
    assert.equal(state.bars, 0, 'aucune barre sur l’écran de chargement');
  }
  for (let i = 0; i < 2; i++) {
    if (i) await page.reload({ waitUntil: 'domcontentloaded' });
    else await page.goto(site, { waitUntil: 'domcontentloaded' });
    await controler(true);
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
    await controler(false);
  }
  assert.deepEqual(errors, []);
  console.log('OK : chargement et actualisation sans barre, démarrage normal');
} finally { await browser.close(); }
