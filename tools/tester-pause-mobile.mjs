/* Vrai navigateur : pause automatique avec annonce, reprise et outils mobiles. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8553/';
const browser = await chromium.launch(portable ? { executablePath: await portable.executablePath(), args: portable.args.filter(x => x !== '--single-process') } : {});
async function pagePour(viewport, seances = 2) {
  const page = await browser.newPage({ viewport, serviceWorkers: 'block' });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/*', r => r.request().url().startsWith(site) ? r.continue() : r.abort());
  await page.clock.install({ time: new Date('2031-06-15T10:00:00') });
  await page.addInitScript(({ seances }) => {
    window.__STUDYPLAN_E2E = true;
    localStorage.setItem('studyPlanIB_focusDurees', JSON.stringify({ focus: 1, short: 1, long: 2, seances }));
  }, { seances });
  await page.goto(site, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
  await page.evaluate(() => {
    document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active'));
    document.getElementById('planningModal').classList.add('active');
    selectedDay = 6; planningDecalageSemaine = 0; sundayWakeup = '08:00'; sundaySleepHours = 8;
    subjects = [{ name: 'Physique', icon: '📚', level: 'HL' }]; optionalSubjects = []; selectedActivities = [];
    customEvents = [{ id: 'serie-test', day: 6, date: '2031-06-15', title: 'Physique — séance', startTime: '09:30', endTime: '11:30', type: 'study', source: 'custom', pinned: true, timestamp: Date.now() }];
    emploiFige = null; v3Save(); navigateTo('pomodoro');
    window.__annonces = [];
    const originale = chronoAnnoncerPause;
    chronoAnnoncerPause = function (minutes) {
      window.__annonces.push({ minutes, mode: focusEtat.mode, running: focusEtat.running, restant: focusEtat.restant, fin: focusEtat.fin });
      return originale(minutes);
    };
  });
  return { page, errors };
}
async function terminer(page, errors) { assert.deepEqual(errors, []); await page.close(); }
async function avance(page, ms) { await page.clock.fastForward(ms); }
async function etat(page) { return page.evaluate(() => ({ mode: focusEtat.mode, running: focusEtat.running, restant: focusEtat.restant, fin: focusEtat.fin, serie: focusEtat.serie, run: focusEtat.run, pauseFinale: focusEtat.pauseFinale, annonces: window.__annonces })); }

try {
  // Minuteur libre : pause automatique, voix lancée au même changement et reprise manuelle par défaut.
  let { page, errors } = await pagePour({ width: 390, height: 844 });
  await page.locator('#focusPlay').click();
  await avance(page, 60000);
  let s = await etat(page);
  assert.equal(s.mode, 'short'); assert.equal(s.running, true); assert.ok(s.restant >= 59 && s.restant <= 60);
  assert.deepEqual(s.annonces.map(a => [a.minutes, a.mode, a.running, a.restant]), [[1, 'short', true, 60]]);
  await avance(page, 3000); assert.ok((await etat(page)).restant >= 55 && (await etat(page)).restant <= 57);
  const fin = (await etat(page)).fin;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
  await page.evaluate(() => { document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); });
  s = await etat(page); assert.equal(s.mode, 'short'); assert.equal(s.running, true); assert.equal(s.fin, fin); assert.ok(s.restant > 0 && s.restant <= 57);
  await avance(page, 60000); s = await etat(page); assert.equal(s.mode, 'focus'); assert.equal(s.running, false);
  await terminer(page, errors);

  // Couper la voix ne bloque pas la pause automatique.
  ({ page, errors } = await pagePour({ width: 390, height: 844 }));
  await page.evaluate(() => localStorage.setItem('studyPlanIB_voixActive', 'false'));
  await page.locator('#focusPlay').click(); await avance(page, 60000);
  s = await etat(page); assert.equal(s.mode, 'short'); assert.equal(s.running, true); assert.equal(s.annonces.length, 1);
  await terminer(page, errors);

  // Le réglage facultatif ne commande que la reprise après la pause.
  ({ page, errors } = await pagePour({ width: 390, height: 844 }, 1));
  await page.evaluate(() => focusMajReglage('auto', true));
  await page.locator('#focusPlay').click(); await avance(page, 60000);
  s = await etat(page); assert.equal(s.mode, 'long'); assert.equal(s.running, true); assert.equal(s.annonces[0].minutes, 2);
  await avance(page, 120000); s = await etat(page); assert.equal(s.mode, 'focus'); assert.equal(s.running, true);
  await terminer(page, errors);

  // Séance planifiée : reprise automatique entre deux concentrations, mais
  // une vraie pause après la dernière sans redémarrer une série de trop.
  ({ page, errors } = await pagePour({ width: 390, height: 844 }));
  await page.evaluate(() => { focusMajReglage('auto', true); navigateTo('seances'); });
  await page.locator('#focusAccueilListe .focus-seance').filter({ hasText: 'Physique — séance' }).click();
  await page.locator('#focusAccueilContinuer').click();
  await avance(page, 60000); s = await etat(page); assert.equal(s.mode, 'short'); assert.equal(s.running, true); assert.equal(s.serie, 1); assert.equal(s.pauseFinale, false);
  await avance(page, 60000); s = await etat(page); assert.equal(s.mode, 'focus'); assert.equal(s.running, true);
  await avance(page, 60000); s = await etat(page); assert.equal(s.mode, 'short'); assert.equal(s.running, true); assert.equal(s.serie, 2); assert.equal(s.pauseFinale, true);
  const finFinale = s.fin;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
  await page.evaluate(() => { document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); });
  s = await etat(page); assert.equal(s.mode, 'short'); assert.equal(s.running, true); assert.equal(s.pauseFinale, true); assert.equal(s.fin, finFinale);
  await avance(page, 60000); s = await etat(page); assert.equal(s.mode, 'focus'); assert.equal(s.running, false); assert.equal(s.serie, 2);
  await terminer(page, errors);
  console.log('OK pause, voix, durée, reprise et fin de série après rechargement');

  // Les boutons doivent être dans la zone visible et réellement cliquables,
  // même sur petits téléphones et en paysage.
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 400 }, { width: 375, height: 667 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
    ({ page, errors } = await pagePour(viewport));
    // Le panneau entre avec une animation : mesurer seulement une fois posé.
    await page.waitForFunction(() => {
      const b = document.getElementById('panelPomodoro').getBoundingClientRect();
      return Math.abs(b.left) < 1 && Math.abs(b.width - innerWidth) < 1;
    }, null, { timeout: 10000 });
    const controls = page.locator('#focusPage .focus-bottom button');
    assert.equal(await controls.count(), 6);
    for (const button of await controls.all()) {
      const b = await button.boundingBox();
      assert.ok(b && b.x >= -1 && b.y >= -1 && b.x + b.width <= viewport.width + 1 && b.y + b.height <= viewport.height + 1, `${viewport.width}x${viewport.height}: bouton hors écran ${JSON.stringify(b)}`);
      await button.evaluate(el => { const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); if (!el.contains(hit)) throw new Error('Bouton recouvert : ' + el.getAttribute('aria-label')); });
    }
    await page.locator('#focusBtnReglages').click(); assert.equal(await page.locator('#focusReglages').isVisible(), true);
    await page.locator('.focus-tiroir-fermer').click();
    await page.locator('#focusBtnTaches').click(); assert.equal(await page.locator('#focusTaches').isVisible(), true);
    await page.locator('#focusNouvelle').click();
    await page.locator('#focusNouvelle').fill('Réviser');
    await page.locator('#focusNouvelle').press('Enter');
    assert.match(await page.locator('#focusListe').innerText(), /Réviser/);
    await page.locator('#focusBtnTaches').click();
    await page.locator('#focusBtnSon').click(); assert.equal(await page.locator('#focusSons').isVisible(), true);
    await page.locator('#focusBtnSon').click();
    await page.locator('#focusBtnAstuce').click(); assert.equal(await page.locator('#focusAstuce').isVisible(), true);
    if (process.env.STUDY_CAPTURE && viewport.width === 320) await page.screenshot({ path: process.env.STUDY_CAPTURE });
    await terminer(page, errors);
    console.log(`OK outils Pomodoro ${viewport.width}×${viewport.height}`);
  }
} finally { await browser.close(); }
