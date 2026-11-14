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
    // Une annonce contrôlable avec l'horloge de test : le vrai audio est
    // vérifié séparément dans tester-voix et tester-choix-voix.
    chronoAnnoncerPause = function (minutes, suite, derniereSeance) {
      window.__annonces.push({ minutes, derniereSeance, mode: focusEtat.mode, running: focusEtat.running, restant: focusEtat.restant, fin: focusEtat.fin });
      setTimeout(suite, 2000);
    };
    chronoAnnoncerFinSerie = function (suite) {
      window.__annonces.push({ finale: true, mode: focusEtat.mode, running: focusEtat.running, restant: focusEtat.restant });
      setTimeout(suite, 2000);
    };
    chronoAnnoncerReprise = function (suite) { window.__reprises = (window.__reprises || 0) + 1; setTimeout(suite, 2000); };
  });
  return { page, errors };
}
async function terminer(page, errors) { assert.deepEqual(errors, []); await page.close(); }
async function avance(page, ms) { await page.clock.fastForward(ms); }
async function etat(page) { return page.evaluate(() => ({ mode: focusEtat.mode, running: focusEtat.running, restant: focusEtat.restant, fin: focusEtat.fin, serie: focusEtat.serie, run: focusEtat.run, pauseFinale: focusEtat.pauseFinale, transition: focusEtat.transition, annonces: window.__annonces })); }

try {
  // Minuteur libre : l'annonce se termine avant le démarrage de la pause.
  let { page, errors } = await pagePour({ width: 390, height: 844 });
  await page.locator('#focusPlay').click(); await avance(page, 60000);
  let s = await etat(page);
  assert.equal(s.mode, 'short'); assert.equal(s.running, false); assert.equal(s.transition, 'pause-annonce'); assert.equal(s.restant, 60);
  assert.deepEqual(s.annonces.map(a => [a.minutes, a.mode, a.running, a.restant]), [[1, 'short', false, 60]]);
  await avance(page, 2000); s = await etat(page); assert.equal(s.running, true); assert.ok(s.restant >= 59 && s.restant <= 60);
  await avance(page, 3000); s = await etat(page); assert.ok(s.restant >= 55 && s.restant <= 57);
  const fin = s.fin;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
  await page.evaluate(() => { document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); });
  s = await etat(page); assert.equal(s.mode, 'short'); assert.equal(s.running, true); assert.equal(s.fin, fin); assert.ok(s.restant > 0 && s.restant <= 57);
  await terminer(page, errors);

  // Une voix désactivée laisse quand même la pause démarrer après le signal.
  ({ page, errors } = await pagePour({ width: 390, height: 844 }));
  await page.evaluate(() => localStorage.setItem('studyPlanIB_voixActive', 'false'));
  await page.locator('#focusPlay').click(); await avance(page, 60000);
  s = await etat(page); assert.equal(s.mode, 'short'); assert.equal(s.running, false); assert.equal(s.annonces.length, 1);
  await avance(page, 2000); assert.equal((await etat(page)).running, true);
  await terminer(page, errors);

  // Une seule séance : la voix finale ne démarre jamais de pause.
  ({ page, errors } = await pagePour({ width: 390, height: 844 }, 1));
  await page.evaluate(() => focusMajReglage('auto', true));
  await page.locator('#focusPlay').click(); await avance(page, 60000);
  s = await etat(page); assert.equal(s.transition, 'fin-annonce'); assert.equal(s.running, false); assert.equal(s.annonces[0].finale, true);
  await avance(page, 2000); s = await etat(page);
  assert.equal(s.mode, 'focus'); assert.equal(s.running, false); assert.equal(s.transition, '');
  await avance(page, 120000); assert.equal((await etat(page)).running, false);
  assert.equal(await page.locator('#focusReprise').isVisible(), false);
  assert.equal(await page.evaluate(() => window.__reprises || 0), 0);
  await terminer(page, errors);

  // Séance planifiée : pause intermédiaire puis fin immédiatement arrêtée.
  ({ page, errors } = await pagePour({ width: 390, height: 844 }));
  await page.evaluate(() => { focusMajReglage('auto', true); navigateTo('seances'); });
  await page.locator('#focusAccueilListe .focus-seance').filter({ hasText: 'Physique — séance' }).click();
  await page.locator('#focusAccueilContinuer').click();
  await page.locator('#focusChoixNombre').fill('2');
  await page.locator('#focusChoixLancer').click();
  await avance(page, 60000); s = await etat(page); assert.equal(s.transition, 'pause-annonce'); assert.equal(s.serie, 1);
  await avance(page, 2000); s = await etat(page); assert.equal(s.mode, 'short'); assert.equal(s.running, true);
  await avance(page, 60000); s = await etat(page); assert.equal(s.transition, 'reprise-annonce');
  await avance(page, 2000); s = await etat(page); assert.equal(s.transition, 'attente-reprise');
  assert.equal(await page.locator('#focusRepriseCompte').innerText(), 'Séance 2 sur 2');
  await page.locator('.focus-reprise-attendre').click(); assert.equal(await page.locator('#focusRepriseRappel').isVisible(), true);
  await page.locator('#focusRepriseRappel').click(); await page.locator('.focus-reprise-oui').click();
  await avance(page, 60000); s = await etat(page); assert.equal(s.transition, 'fin-annonce'); assert.equal(s.serie, 2);
  assert.equal(s.running, false); assert.equal(s.annonces.at(-1).finale, true);
  await avance(page, 2000); s = await etat(page); assert.equal(s.mode, 'focus'); assert.equal(s.running, false); assert.equal(s.transition, '');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
  await page.evaluate(() => { document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); });
  s = await etat(page); assert.equal(s.mode, 'focus'); assert.equal(s.running, false); assert.equal(s.serie, 2);
  assert.equal(await page.locator('#focusReprise').isVisible(), false);
  await terminer(page, errors);
  console.log('OK pause intermédiaire et fin sans pause après rechargement');

  // Quatre séances : trois pauses, trois confirmations et une fin seule.
  ({ page, errors } = await pagePour({ width: 1280, height: 800 }, 4));
  await page.locator('#focusPlay').click();
  for (let numero = 1; numero <= 4; numero++) {
    await avance(page, 60000); s = await etat(page);
    if (numero < 4) {
      assert.equal(s.transition, 'pause-annonce'); assert.equal(s.annonces.at(-1).derniereSeance, false);
      await avance(page, 2000); assert.equal((await etat(page)).running, true);
      await avance(page, 60000); assert.equal((await etat(page)).transition, 'reprise-annonce');
      await avance(page, 2000); assert.equal(await page.locator('#focusReprise').isVisible(), true);
      assert.equal(await page.locator('#focusRepriseCompte').innerText(), `Séance ${numero + 1} sur 4`);
      await page.locator('.focus-reprise-oui').click();
    } else {
      assert.equal(s.transition, 'fin-annonce'); assert.equal(s.annonces.at(-1).finale, true); assert.equal(s.running, false);
      await avance(page, 2000); await avance(page, 120000);
      s = await etat(page); assert.equal(s.running, false); assert.equal(s.transition, '');
      assert.equal(await page.locator('#focusReprise').isVisible(), false);
      assert.equal(await page.evaluate(() => window.__reprises), 3);
    }
  }
  await terminer(page, errors);
  console.log('OK quatre séances : trois pauses, fin sans pause');

  // Ajouter une séance pendant la deuxième concentration : le nouvel objectif
  // est sauvegardé et la deuxième séance devient intermédiaire.
  ({ page, errors } = await pagePour({ width: 390, height: 844 }, 2));
  await page.locator('#focusPlay').click(); await avance(page, 60000); await avance(page, 2000);
  await avance(page, 60000); await avance(page, 2000); await page.locator('.focus-reprise-oui').click();
  await page.evaluate(() => { focusRemplirDurees(); document.getElementById('focusDureeSeances').value = '3'; focusSauverDurees(); });
  assert.equal(await page.evaluate(() => focusEtat.objectif), 3);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('studyPlanIB_focusEtat')).objectif), 3);
  await avance(page, 60000); s = await etat(page); assert.equal(s.transition, 'pause-annonce'); assert.equal(s.serie, 2);
  await avance(page, 2000); await avance(page, 60000); await avance(page, 2000);
  assert.equal(await page.locator('#focusRepriseCompte').innerText(), 'Séance 3 sur 3');
  await page.locator('.focus-reprise-oui').click(); await avance(page, 60000);
  s = await etat(page); assert.equal(s.transition, 'fin-annonce'); assert.equal(s.annonces.at(-1).finale, true);
  await terminer(page, errors);

  // Diminuer pendant la concentration : elle finit normalement avant la fin.
  ({ page, errors } = await pagePour({ width: 390, height: 844 }, 3));
  await page.locator('#focusPlay').click(); await avance(page, 10000);
  await page.evaluate(() => { focusRemplirDurees(); document.getElementById('focusDureeSeances').value = '1'; focusSauverDurees(); });
  s = await etat(page); assert.equal(s.running, true); assert.equal(s.mode, 'focus'); assert.equal(s.serie, 0);
  await avance(page, 50000); s = await etat(page); assert.equal(s.transition, 'fin-annonce'); assert.equal(s.annonces.at(-1).finale, true);
  await terminer(page, errors);

  // Diminuer pendant l'annonce de pause invalide le callback précédent :
  // ni pause ni ancienne annonce ne redémarrent après le message final.
  ({ page, errors } = await pagePour({ width: 390, height: 844 }, 3));
  await page.locator('#focusPlay').click(); await avance(page, 60000);
  assert.equal((await etat(page)).transition, 'pause-annonce');
  await page.evaluate(() => { focusRemplirDurees(); document.getElementById('focusDureeSeances').value = '1'; focusSauverDurees(); });
  s = await etat(page); assert.equal(s.transition, 'fin-annonce'); assert.equal(s.annonces.at(-1).finale, true);
  await avance(page, 5000); s = await etat(page); assert.equal(s.running, false); assert.equal(s.mode, 'focus'); assert.equal(s.transition, '');
  await terminer(page, errors);

  // Diminuer pendant une pause déjà lancée ou une attente de reprise met
  // immédiatement fin à la série sans ajouter de concentration.
  for (const attente of [false, true]) {
    ({ page, errors } = await pagePour({ width: 390, height: 844 }, 3));
    await page.locator('#focusPlay').click(); await avance(page, 60000); await avance(page, 2000);
    if (attente) { await avance(page, 60000); await avance(page, 2000); assert.equal((await etat(page)).transition, 'attente-reprise'); }
    else assert.equal((await etat(page)).running, true);
    await page.evaluate(() => { focusRemplirDurees(); document.getElementById('focusDureeSeances').value = '1'; focusSauverDurees(); });
    s = await etat(page); assert.equal(s.transition, 'fin-annonce'); assert.equal(s.running, false);
    await avance(page, 3000); assert.equal((await etat(page)).running, false);
    assert.equal(await page.locator('#focusReprise').isVisible(), false);
    await terminer(page, errors);
  }
  console.log('OK modification du nombre de séances : augmentation, diminution et callbacks annulés');

  // Modifier l'objectif pendant la voix de reprise, avant que son callback
  // n'affiche une fenêtre devenue inutile, doit terminer sans redémarrage.
  ({ page, errors } = await pagePour({ width: 390, height: 844 }, 3));
  await page.locator('#focusPlay').click(); await avance(page, 60000); await avance(page, 2000); await avance(page, 60000);
  assert.equal((await etat(page)).transition, 'reprise-annonce');
  await page.evaluate(() => { focusRemplirDurees(); document.getElementById('focusDureeSeances').value = '1'; focusSauverDurees(); });
  await avance(page, 5000); s = await etat(page);
  assert.equal(s.mode, 'focus'); assert.equal(s.running, false); assert.equal(s.transition, '');
  assert.equal(await page.locator('#focusReprise').isVisible(), false);
  await terminer(page, errors);

  // Concentration finale expirée pendant que la page est fermée : la
  // restauration reste silencieuse et ne lance aucune pause.
  ({ page, errors } = await pagePour({ width: 390, height: 844 }, 1));
  await page.evaluate(() => {
    Object.assign(focusEtat, { mode: 'focus', total: 60, restant: 1, running: true, fin: Date.now() - 1000, serie: 0, run: true, objectif: 1, transition: '' });
    focusSauverEtat();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
  await page.evaluate(() => { document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); });
  s = await etat(page); assert.equal(s.mode, 'focus'); assert.equal(s.running, false); assert.equal(s.serie, 1); assert.equal(s.transition, '');
  await terminer(page, errors);

  // Anciennes sauvegardes d'une pause finale automatique : migration arrêtée.
  ({ page, errors } = await pagePour({ width: 390, height: 844 }, 1));
  await page.evaluate(() => {
    Object.assign(focusEtat, { mode: 'short', total: 60, restant: 60, running: true, fin: Date.now() + 60000, serie: 1, run: false, objectif: 1, pauseFinale: true, transition: '' });
    focusSauverEtat();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
  await page.evaluate(() => { document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); });
  s = await etat(page); assert.equal(s.mode, 'focus'); assert.equal(s.running, false); assert.equal(s.transition, '');
  await terminer(page, errors);
  console.log('OK reprise en cours et restauration de fin sans pause');

  // Les boutons doivent être dans la zone visible et réellement cliquables,
  // même sur petits téléphones et en paysage.
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 400 }, { width: 375, height: 667 }, { width: 760, height: 600 }, { width: 844, height: 390 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }]) {
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
    const avant = await page.locator('#focusTime').boundingBox();
    await page.evaluate(() => { focusEtat.run = true; focusEtat.objectif = 4; focusEtat.serie = 1; focusEtat.transition = 'attente-reprise'; focusEtat.repriseMasquee = false; focusPeindre(); });
    const popup = page.locator('#focusReprise'); assert.equal(await popup.isVisible(), true);
    const apresPopup = await page.locator('#focusTime').boundingBox();
    for (const k of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(avant[k] - apresPopup[k]) < 1, `le minuteur a bougé (${viewport.width}×${viewport.height}, ${k})`);
    const rect = await popup.boundingBox();
    assert.ok(rect.x >= apresPopup.x + apresPopup.width || rect.x + rect.width <= apresPopup.x || rect.y >= apresPopup.y + apresPopup.height || rect.y + rect.height <= apresPopup.y, 'la fenêtre recouvre le minuteur');
    assert.ok(rect && rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= viewport.width + 1 && rect.y + rect.height <= viewport.height + 1, 'fenêtre hors écran : ' + JSON.stringify(rect));
    for (const button of await popup.locator('button').all()) {
      const b = await button.boundingBox(); assert.ok(b && b.width >= 44 && b.height >= 40, 'action inaccessible');
      await button.evaluate(el => { const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); if (!el.contains(hit)) throw new Error('Action de reprise recouverte'); });
    }
    async function verifierBarre(surcouche) {
      const superpose = await surcouche.boundingBox();
      const pied = await page.locator('#focusPage .focus-bottom').boundingBox();
      assert.ok(superpose.y + superpose.height <= pied.y + 1, 'fenêtre doit rester au-dessus de la barre');
      for (const el of await page.locator('#focusPage .focus-bottom button, #focusPage .focus-flamme').all()) {
        const b = await el.boundingBox();
        assert.ok(b && b.y >= 0 && b.y + b.height <= viewport.height + 1, 'outil ou flamme hors écran');
        await el.evaluate(e => { const r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); if (!e.contains(hit)) throw new Error('Outil ou flamme recouvert : ' + (e.getAttribute('aria-label') || e.className)); });
      }
    }
    await verifierBarre(popup);
    if (process.env.STUDY_CAPTURE_DIR) await page.screenshot({ path: `${process.env.STUDY_CAPTURE_DIR}/popup-${viewport.width}x${viewport.height}.png` });
    // Le contenu central peut défiler sur les très petits écrans : chaque
    // commande doit rester accessible sans passer sous la fenêtre ou le rappel.
    async function verifierCentre(surcouche) {
      for (const el of await page.locator('#focusPage .focus-center button, #focusTache').all()) {
        if (!await el.isVisible()) continue;
        await el.scrollIntoViewIfNeeded();
        const b = await el.boundingBox(), couche = await surcouche.boundingBox();
        assert.ok(b.x >= couche.x + couche.width || b.x + b.width <= couche.x || b.y >= couche.y + couche.height || b.y + b.height <= couche.y, 'une partie de la commande centrale est recouverte');
        await el.evaluate(e => { const r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); if (!e.contains(hit)) throw new Error('Commande centrale recouverte ou inaccessible : ' + (e.id || e.textContent)); });
      }
    }
    await verifierCentre(popup);
    const avantRappel = await page.locator('#focusTime').boundingBox();
    await page.locator('.focus-reprise-attendre').click();
    const rappel = page.locator('#focusRepriseRappel'); assert.equal(await rappel.isVisible(), true);
    const apresRappel = await page.locator('#focusTime').boundingBox();
    for (const k of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(avantRappel[k] - apresRappel[k]) < 1, `le rappel déplace le minuteur (${k})`);
    await verifierBarre(rappel);
    if (process.env.STUDY_CAPTURE_DIR) await page.screenshot({ path: `${process.env.STUDY_CAPTURE_DIR}/rappel-${viewport.width}x${viewport.height}.png` });
    await verifierCentre(rappel);
    await terminer(page, errors);
    console.log(`OK outils Pomodoro ${viewport.width}×${viewport.height}`);
  }
} finally { await browser.close(); }
