/* Contrôle du cycle réel, notamment plein écran et créneau planifié expiré. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8599/';
const browser = await chromium.launch({ ...(portable ? { executablePath: await portable.executablePath() } : {}), args: [...(portable ? portable.args.filter(x => x !== '--single-process') : []), '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
try {
  await page.clock.install({ time: new Date('2031-06-15T10:00:00') });
  await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; localStorage.setItem('studyPlanIB_focusDurees', JSON.stringify({focus: 1, short: 1, long: 2, seances: 4})); });
  await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, {timeout: 60000});
  await page.evaluate(() => {
    document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active'));
    document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro');
    focusSeanceMinuteur = {id: 'seance-qui-expire', date: new Date().toDateString(), debut: focusMinutesMaintenant() - 1, fin: focusMinutesMaintenant() + 1};
    chronoAnnoncerPause = (minutes, suite) => setTimeout(suite, 1000);
    chronoAnnoncerReprise = suite => setTimeout(suite, 1000);
  });
  await page.locator('#focusPlay').click();
  await page.getByRole('button', {name: 'Agrandir'}).click();
  await page.waitForFunction(() => document.fullscreenElement === document.getElementById('panelPomodoro'), null, {timeout: 10000});
  await page.clock.fastForward(60000); await page.clock.fastForward(1000); await page.clock.fastForward(60000);
  assert.equal(await page.evaluate(() => focusEtat.transition), 'reprise-annonce');
  assert.equal(await page.locator('#focusReprise').isVisible(), false);
  const minuteurAvant = await page.locator('#focusTime').boundingBox();
  await page.clock.fastForward(1000);
  assert.equal(await page.evaluate(() => focusEtat.transition), 'attente-reprise');
  assert.equal(await page.locator('#focusReprise').isVisible(), true);
  const minuteurApres = await page.locator('#focusTime').boundingBox();
  for (const k of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(minuteurAvant[k] - minuteurApres[k]) < 1, 'le plein écran ne doit pas déplacer le minuteur : ' + k);
  assert.equal(await page.locator('#focusRepriseCompte').innerText(), 'Séance 2 sur 4');
  assert.equal(await page.evaluate(() => document.fullscreenElement.contains(document.getElementById('focusReprise'))), true, 'la fenêtre doit être dans la zone plein écran');
  async function verifierPied(element) {
    const surcouche = await element.boundingBox(), pied = await page.locator('#focusPage .focus-bottom').boundingBox();
    assert.ok(surcouche.y + surcouche.height <= pied.y + 1, 'la reprise ne doit pas recouvrir la barre en plein écran');
    for (const cible of await page.locator('#focusPage .focus-bottom button, #focusPage .focus-flamme').all()) {
      await cible.evaluate(el => { const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); if (!el.contains(hit)) throw new Error('outil plein écran recouvert'); });
    }
  }
  await verifierPied(page.locator('#focusReprise'));
  const bouton = page.locator('.focus-reprise-attendre');
  await bouton.evaluate(el => { const r = el.getBoundingClientRect(); const cible = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); if (!el.contains(cible)) throw new Error('la fenêtre est invisible ou recouverte en plein écran'); });
  const attente = await page.evaluate(() => ({mode: focusEtat.mode, restant: focusEtat.restant, serie: focusEtat.serie, objectif: focusEtat.objectif}));
  await bouton.click();
  assert.equal(await page.evaluate(() => focusEtat.running), false);
  assert.equal(await page.locator('#focusRepriseRappel').isVisible(), true);
  await verifierPied(page.locator('#focusRepriseRappel'));
  await page.clock.fastForward(30000);
  assert.equal(await page.evaluate(() => focusEtat.running), false, 'Pas encore ne doit pas redémarrer');
  assert.deepEqual(await page.evaluate(() => ({mode: focusEtat.mode, restant: focusEtat.restant, serie: focusEtat.serie, objectif: focusEtat.objectif})), attente, 'Pas encore ne modifie ni la durée ni la progression');
  await page.locator('#focusRepriseRappel').click();
  await page.locator('.focus-reprise-oui').click();
  const apres = await page.evaluate(() => ({mode: focusEtat.mode, running: focusEtat.running, restant: focusEtat.restant, serie: focusEtat.serie, objectif: focusEtat.objectif}));
  assert.deepEqual(apres, {mode: 'focus', running: true, restant: 60, serie: 1, objectif: 4}, 'la confirmation doit reprendre la série même après expiration du créneau');
  await page.clock.fastForward(3000);
  assert.ok(await page.evaluate(() => focusEtat.restant) <= 57, 'la concentration doit réellement se décompter');
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => !document.fullscreenElement && document.getElementById('focusReprise').parentNode === document.body);
  // En quittant le minuteur, un rechargement du planning doit restaurer le
  // chrono et, si la pause est passée pendant l'absence, montrer la fenêtre.
  await page.evaluate(() => {
    sessionStorage.setItem('studyPlanIB_focusSeanceEnCours', JSON.stringify(focusSeanceMinuteur));
    memoireAller('planning');
  });
  const echeance = await page.evaluate(() => focusEtat.fin);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, {timeout: 60000});
  assert.equal(await page.evaluate(fin => focusPret && focusEtat.running && focusEtat.fin === fin, echeance), true, 'le minuteur doit reprendre sur une autre page après rechargement');
  await page.evaluate(() => {
    focusEtat.mode = 'short'; focusEtat.total = 60; focusEtat.restant = 0; focusEtat.running = true;
    focusEtat.fin = Date.now() - 1000; focusEtat.run = true; focusEtat.serie = 1; focusEtat.objectif = 4;
    focusEtat.pauseFinale = false; focusEtat.transition = ''; focusSauverEtat();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, {timeout: 60000});
  assert.equal(await page.evaluate(() => focusPret && focusEtat.transition === 'attente-reprise' && !focusEtat.running), true);
  assert.equal(await page.locator('#focusReprise').isVisible(), true, 'la pause terminée pendant l’absence doit être récupérée');
  assert.equal(await page.locator('#focusRepriseCompte').innerText(), 'Séance 2 sur 4');
  await page.evaluate(() => { document.querySelectorAll('.app-panel.active').forEach(e => e.classList.remove('active')); document.getElementById('planningModal').classList.add('active'); });
  await page.locator('.focus-reprise-oui').focus();
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('focus-reprise-oui')), true, 'la fenêtre doit être accessible au clavier depuis le planning');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('focus-reprise-attendre')), true, 'Tab doit atteindre les deux choix');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('focus-reprise-oui')), true);
  await page.locator('.focus-reprise-oui').press('Enter');
  assert.equal(await page.evaluate(() => focusEtat.running && focusEtat.mode === 'focus' && focusEtat.serie === 1), true);
  assert.deepEqual(erreurs, []);
  console.log('OK plein écran réel, fenêtre et rappel cliquables, attente, expiration du créneau et restauration depuis une autre page');
} finally { await browser.close(); }
