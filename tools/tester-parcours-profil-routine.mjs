/* Vrais écrans et restauration différée, données fictives et réseau externe bloqué. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const base = process.env.STUDY_SITE || 'http://127.0.0.1:8691/';
const browser = await chromium.launch(portable ? { executablePath: await portable.executablePath(), args: portable.args.filter(x => x !== '--single-process') } : {});
const ready = page => page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
async function mode(page, etape, expected) {
  await page.waitForFunction(([e, m]) => memoireEtapeActive() === e && history.state?.etape === e && history.state.routineMode === m, [etape, expected], { timeout: 15000 });
  const modal = page.locator(etape === 'habitudes' ? '#habitsModal' : '#emploiModal');
  assert.equal(await modal.getAttribute('data-routine-mode'), expected);
  assert.equal(await modal.locator(expected === 'profil' ? '.context-card' : '.routine-hero').isVisible(), true);
  assert.equal(await modal.locator(expected === 'profil' ? '.routine-hero' : '.context-card').count(), 0);
}
async function restauration(page) {
  await page.evaluate(() => {
    const data = memoireLireEtat();
    data.profilComplet = true;
    data.userName = 'Élève Test'; data.ibYear = 'DP1';
    data.subjects = [{ name: 'Maths', level: 'SL' }];
    compteAfficherProfil(data);
  });
}
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 800 }, serviceWorkers: 'block' });
    const errors = [], externes = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('**/*', r => {
      if (r.request().url().startsWith(base)) return r.continue();
      externes.push(r.request().url()); return r.abort();
    });
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    await page.goto(base, { waitUntil: 'domcontentloaded' }); await ready(page);
    await page.evaluate(() => { userName='Élève Test'; ibYear='DP1'; window.__profilComplet=false; showHabitsPage('transport'); memoireSauvegarder(); });
    await mode(page, 'habitudes', 'profil');
    await page.locator('#prepMatinFinInput').fill('07:25');
    await restauration(page); await page.waitForTimeout(2200);
    await mode(page, 'habitudes', 'profil');
    assert.equal(await page.locator('#prepMatinFinInput').inputValue(), '07:25', 'saisie non perdue à la restauration');
    assert.equal(await page.evaluate(() => window.__profilComplet), true, 'la copie complète a été reçue');
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page); await mode(page, 'habitudes', 'profil');
    await page.evaluate(() => history.replaceState(null, '', location.href));
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page); await mode(page, 'habitudes', 'profil');
    await page.locator('#habitsModal .btn-back').click();
    assert.equal(await page.locator('#sleepModal').isVisible(), true, 'retour vers sommeil dans le parcours profil');
    await page.evaluate(() => { window.__profilComplet = true; showTransportPage(); hideTransportPage(); });
    await mode(page, 'habitudes', 'profil');
    await restauration(page); await mode(page, 'habitudes', 'profil');
    await page.evaluate(() => { document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active')); document.getElementById('planningModal').classList.add('active'); window.__profilComplet = true; });
    await page.evaluate(() => goBackFromPlanning());
    assert.equal(await page.locator('#freeTimeModal').isVisible(), true, 'modification des paramètres');
    await page.locator('#freeTimeModal .btn-continue').click(); await mode(page, 'emploi', 'profil');
    await page.locator('#emploiManuelNom').fill('Brouillon cours');
    await restauration(page); await page.waitForTimeout(2200); await mode(page, 'emploi', 'profil');
    assert.equal(await page.locator('#emploiManuelNom').inputValue(), 'Brouillon cours', 'saisie du cours préservée');
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page); await mode(page, 'emploi', 'profil');
    await page.evaluate(() => history.replaceState(null, '', location.href));
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page); await mode(page, 'emploi', 'profil');
    await page.locator('#emploiModal .btn-back').click();
    assert.equal(await page.locator('#freeTimeModal').isVisible(), true, 'retour vers temps libre même avec profil complet');
    await page.locator('#freeTimeModal .btn-continue').click(); await mode(page, 'emploi', 'profil');
    await page.evaluate(() => { document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active')); document.getElementById('planningModal').classList.add('active'); navigateTo('emploi'); });
    await mode(page, 'emploi', 'section'); await restauration(page); await mode(page, 'emploi', 'section');
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page); await mode(page, 'emploi', 'section');
    await page.evaluate(() => showHabitsPage('planning')); await mode(page, 'habitudes', 'section');
    await restauration(page); await mode(page, 'habitudes', 'section');
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page); await mode(page, 'habitudes', 'section');
    await page.goBack(); await mode(page, 'emploi', 'section');
    await page.goForward(); await mode(page, 'habitudes', 'section');
    assert.deepEqual(errors, []);
    // Toute requête externe a été bloquée, notamment les services de mail et Firebase.
    console.log('OK parcours profil, synchronisation, retour, rechargement et sections', width, '(requêtes externes bloquées :', externes.length + ')');
    await page.close();
  }
} finally { await browser.close(); }
