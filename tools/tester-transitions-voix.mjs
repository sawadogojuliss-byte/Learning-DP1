/* Test navigateur réel : préchargement, horloge audio et cycle avec confirmation. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8598/';
const browser = await chromium.launch({ ...(portable ? { executablePath: await portable.executablePath() } : {}), args: [...(portable ? portable.args.filter(x => x !== '--single-process') : []), '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => {
    window.__STUDYPLAN_E2E = true;
    window.__horlogeAudio = { oscillateurs: [], sources: [] };
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const osc = AC.prototype.createOscillator;
    AC.prototype.createOscillator = function () {
      const source = osc.apply(this, arguments), original = source.stop;
      source.stop = function (quand) { window.__horlogeAudio.oscillateurs.push(quand); return original.apply(this, arguments); };
      return source;
    };
    const buffer = AC.prototype.createBufferSource;
    AC.prototype.createBufferSource = function () {
      const source = buffer.apply(this, arguments), original = source.start;
      source.start = function (quand, decalage, duree) {
        const nom = Object.keys(window.chronoVoixTampons || {}).find(k => window.chronoVoixTampons[k] === source.buffer);
        const bornes = source.buffer && typeof window.chronoVoixBornes === 'function' ? window.chronoVoixBornes(source.buffer) : null;
        window.__horlogeAudio.sources.push({ nom, quand, decalage, duree, avantVoix: bornes && bornes.avantVoix });
        return original.apply(this, arguments);
      };
      return source;
    };
  });
  await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.setItem('studyPlanIB_voixType', 'masculine');
    localStorage.setItem('studyPlanIB_focusDurees', JSON.stringify({ focus: 1, short: 3, long: 15, seances: 2 }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
  await page.evaluate(() => { document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active')); document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); focusBasculerReglages(); focusChoisirOnglet('minuteur'); });
  const champ = page.locator('#focusDureeShort');
  await champ.fill('9');
  await page.waitForFunction(() => !!chronoVoixTampons['masculine-complet-9'] && !!chronoVoixTampons['masculine-reprise'], null, { timeout: 20000 });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('studyPlanIB_focusDurees')).short), 3, 'le préchargement doit précéder la sauvegarde du champ');
  await champ.blur();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('studyPlanIB_focusDurees')).short), 9);
  await page.locator('.focus-tiroir-fermer').click();
  await page.locator('#focusPlay').click();
  await page.evaluate(() => { window.__horlogeAudio = { oscillateurs: [], sources: [] }; focusEtat.restant = 0; focusEtat.fin = Date.now() - 1; focusTick(); });
  await page.waitForFunction(() => window.__horlogeAudio.sources.length === 1, null, { timeout: 10000 });
  const timing = await page.evaluate(() => ({ ...window.__horlogeAudio, state: { mode: focusEtat.mode, running: focusEtat.running, restant: focusEtat.restant, transition: focusEtat.transition } }));
  assert.deepEqual(timing.sources.map(s => s.nom), ['masculine-complet-9']);
  assert.equal(timing.state.transition, 'pause-annonce'); assert.equal(timing.state.running, false); assert.equal(timing.state.restant, 540);
  const finBip = Math.max(...timing.oscillateurs);
  assert.ok(Math.abs((timing.sources[0].quand + timing.sources[0].avantVoix) - finBip) < .012, 'la voix doit commencer à la fin du bip');
  for (let i = 1; i < timing.sources.length; i++) assert.ok(Math.abs(timing.sources[i].quand - (timing.sources[i-1].quand + timing.sources[i-1].duree)) < .001, 'aucun délai ajouté entre deux morceaux');
  await page.waitForFunction(() => focusEtat.running && focusEtat.transition === '' && focusEtat.mode === 'short', null, { timeout: 20000 });
  assert.ok(await page.evaluate(() => focusEtat.restant >= 539), 'la pause commence après la voix');
  await page.evaluate(() => { window.__horlogeAudio = { oscillateurs: [], sources: [] }; focusEtat.fin = Date.now() - 1; focusTick(); });
  await page.waitForFunction(() => window.__horlogeAudio.sources.length === 1, null, { timeout: 10000 });
  assert.equal((await page.evaluate(() => window.__horlogeAudio.sources))[0].nom, 'masculine-reprise');
  assert.equal(await page.locator('#focusReprise').isVisible(), false, 'la fenêtre ne doit pas précéder la fin de la voix');
  await page.waitForFunction(() => focusEtat.transition === 'attente-reprise', null, { timeout: 15000 });
  assert.equal(await page.locator('#focusReprise').isVisible(), true);
  assert.equal(await page.locator('#focusRepriseTitre').innerText(), 'Es-tu prêt à reprendre ?');
  assert.equal(await page.locator('#focusRepriseCompte').innerText(), 'Séance 2 sur 2');
  assert.equal(await page.locator('#focusRepriseBarres i').count(), 2);
  await page.evaluate(() => navigateTo('planning'));
  assert.equal(await page.locator('#focusReprise').isVisible(), true, 'la reprise doit rester accessible hors du minuteur');
  await page.locator('.focus-reprise-attendre').click();
  assert.equal(await page.locator('#focusRepriseRappel').isVisible(), true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
  await page.evaluate(() => { document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); });
  assert.equal(await page.locator('#focusRepriseRappel').isVisible(), true, 'le report doit survivre au rechargement');
  assert.equal(await page.evaluate(() => focusEtat.running), false);
  await page.evaluate(() => navigateTo('planning'));
  await page.locator('#focusRepriseRappel').click(); await page.locator('.focus-reprise-oui').click();
  assert.equal(await page.evaluate(() => focusEtat.running && focusEtat.mode === 'focus' && document.getElementById('panelPomodoro').classList.contains('active')), true, 'la confirmation depuis une autre page doit ouvrir et démarrer le minuteur');
  // Si l'utilisateur change de mode pendant la voix, aucun callback ancien
  // ne doit relancer la pause une fois la nouvelle sélection effectuée.
  await page.evaluate(() => { window.__horlogeAudio = { oscillateurs: [], sources: [] }; focusEtat.fin = Date.now() - 1; focusTick(); });
  await page.waitForFunction(() => window.__horlogeAudio.sources.length === 1, null, { timeout: 10000 });
  const finale = await page.evaluate(() => window.__horlogeAudio.sources);
  assert.deepEqual(finale.map(s => s.nom), ['masculine-fin-serie']);
  assert.deepEqual(await page.evaluate(() => [focusEtat.mode, focusEtat.running, focusEtat.transition]), ['focus', false, 'fin-annonce']);
  await page.evaluate(() => focusChoisirMode('focus'));
  await page.waitForTimeout(1500);
  assert.deepEqual(await page.evaluate(() => [focusEtat.mode, focusEtat.running, focusEtat.transition]), ['focus', false, '']);
  // Voix désactivée : le bip est gardé, sans aucun fichier vocal.
  await page.evaluate(() => { localStorage.setItem('studyPlanIB_voixActive', 'false'); window.__horlogeAudio = { oscillateurs: [], sources: [] }; focusBasculer(); focusEtat.fin = Date.now() - 1; focusTick(); });
  await page.waitForFunction(() => focusEtat.running && focusEtat.mode === 'short', null, { timeout: 4000 });
  assert.equal(await page.evaluate(() => window.__horlogeAudio.sources.length), 0);
  assert.ok(await page.evaluate(() => window.__horlogeAudio.oscillateurs.length >= 2));
  // Panne simultanée du décodage et des lecteurs : on ne bloque pas la pause
  // et on ne remplace pas la voix masculine par une synthèse différente.
  await page.evaluate(() => {
    focusChoisirMode('focus'); focusEtat.run = false; focusEtat.serie = 0;
    localStorage.setItem('studyPlanIB_voixActive', 'true');
    window.__syntheseImprevue = false;
    chronoVoixJouerTampons = (n, suite) => setTimeout(() => suite(false), 10);
    chronoVoixJouerLecteurs = (n, suite) => setTimeout(() => suite(false), 10);
    chronoVoixSynthese = () => { window.__syntheseImprevue = true; };
    focusBasculer(); focusEtat.fin = Date.now() - 1; focusTick();
  });
  await page.waitForFunction(() => focusEtat.running && (focusEtat.mode === 'short' || focusEtat.mode === 'long'), null, { timeout: 4000 });
  assert.equal(await page.evaluate(() => window.__syntheseImprevue), false);
  assert.deepEqual(errors, []);
  console.log('OK préchargement pendant saisie, bip et voix synchronisés, pause après voix, reprise masculine et confirmation persistée');
} finally { await browser.close(); }
