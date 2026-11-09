/* Navigateur réel : le service est optionnel, préchargé et remplacé en cas de panne. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8603/';
const port = await new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = spawn('python3', ['services/voix/serveur.py'], { cwd: racine, env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) }, stdio: ['ignore', 'ignore', 'pipe'] });
let log = '';
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('service indisponible : ' + log)), 15000);
  server.stderr.on('data', bytes => { log += bytes.toString(); if (log.includes('Service prêt')) { clearTimeout(timer); resolve(); } });
  server.once('error', reject); server.once('exit', code => { clearTimeout(timer); reject(new Error(`service arrêté (${code}) : ${log}`)); });
});
let browser;
try {
  browser = await chromium.launch({ ...(portable ? { executablePath: await portable.executablePath() } : {}), args: [...(portable ? portable.args.filter(x => x !== '--single-process') : []), '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  let enPanne = false, demandes = [];
  await page.route('**/api-voix/v1/audio?*', async route => {
    const url = new URL(route.request().url()); demandes.push(url.search);
    if (enPanne) { await route.abort('failed'); return; }
    const r = await fetch(`http://127.0.0.1:${port}/v1/audio${url.search}`);
    await route.fulfill({ status: r.status, contentType: r.headers.get('content-type'), body: Buffer.from(await r.arrayBuffer()) });
  });
  await page.addInitScript(() => {
    window.__STUDYPLAN_E2E = true;
    window.STUDYPLAN_VOIX_BACKEND = '/api-voix'; window.STUDYPLAN_VOIX_DEBIT = 'lent';
    localStorage.setItem('studyPlanIB_voixType', 'masculine');
    localStorage.setItem('studyPlanIB_voixActive', 'true');
    localStorage.setItem('studyPlanIB_focusDurees', JSON.stringify({ focus: 1, short: 5, long: 21, seances: 2 }));
    window.__sourcesService = [];
    const AC = window.AudioContext || window.webkitAudioContext;
    const create = AC.prototype.createBufferSource;
    AC.prototype.createBufferSource = function () {
      const source = create.apply(this, arguments), start = source.start;
      source.start = function () {
        window.__sourcesService.push(Object.keys(window.chronoVoixTampons).find(k => window.chronoVoixTampons[k] === source.buffer));
        return start.apply(this, arguments);
      };
      return source;
    };
  });
  await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
  await page.evaluate(() => {
    document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active'));
    document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro');
    chronoVoixPreparer([5, 20, 21]);
  });
  await page.waitForFunction(() => !!chronoVoixTampons['service-pause-20-lent-1'], null, { timeout: 30000 });
  assert.ok(demandes.some(x => x.includes('minutes=20') && x.includes('finale=1')));
  await page.evaluate(() => { window.__sourcesService = []; window.__finVoixService = false; chronoAnnoncerPause(20, () => { window.__finVoixService = true; }, true); });
  await page.waitForFunction(() => window.__sourcesService.length === 1, null, { timeout: 10000 });
  assert.deepEqual(await page.evaluate(() => window.__sourcesService), ['service-pause-20-lent-1']);
  await page.waitForFunction(() => window.__finVoixService, null, { timeout: 25000 });
  // La prise de cinq minutes, approuvée et publiée sur le site, reste
  // prioritaire même quand un service est configuré puis indisponible.
  await page.waitForFunction(() => !!chronoVoixTampons['masculine-complet-5'], null, { timeout: 30000 });
  enPanne = true;
  await page.evaluate(() => { window.__sourcesService = []; chronoAnnoncerPause(5, () => {}, true); });
  await page.waitForFunction(() => window.__sourcesService.length === 2, null, { timeout: 10000 });
  assert.deepEqual(await page.evaluate(() => window.__sourcesService), ['masculine-fin-serie','masculine-complet-5']);
  await page.evaluate(() => chronoInterrompreAnnonce(false));
  for (const n of [1, 2, 3, 4, 5, 10, 15, 21]) {
    await page.evaluate(n => chronoVoixPreparer(n), n);
    await page.waitForFunction(n => !!chronoVoixTampons['masculine-complet-' + n], n, { timeout: 30000 });
    await page.evaluate(n => { window.__sourcesService = []; chronoAnnoncerPause(n, () => {}, false); }, n);
    await page.waitForFunction(() => window.__sourcesService.length === 1, null, { timeout: 10000 });
    assert.deepEqual(await page.evaluate(() => window.__sourcesService), ['masculine-complet-' + n]);
    await page.evaluate(() => chronoInterrompreAnnonce(false));
  }
  assert.ok(!demandes.some(x => /minutes=(1|2|3|4|5|10|15|21)(&|$)/.test(x)));
  for (const n of [6, 16, 19]) assert.deepEqual(await page.evaluate(n => chronoVoixPhrasePause(n), n), ['masculine-debut', 'masculine-n-' + n, 'masculine-pause']);
  // Si l'AudioContext échoue après préchargement, le lecteur de secours
  // utilise aussi les prises historiques et non le service indisponible.
  const secours = await page.evaluate(async () => {
    window.__jouerLecteursOriginal = chronoVoixJouerLecteurs;
    chronoVoixJouerTampons = (n, cb) => cb(false);
    chronoVoixJouerLecteurs = (n, cb, options) => { window.__secours = { n, pause: options.pauseApresPremier }; cb(true); };
    chronoAnnoncerPause(20, () => {}, true);
    await new Promise(resolve => setTimeout(resolve, 1200));
    return window.__secours;
  });
  assert.deepEqual(secours, { n: ['masculine-fin-serie','masculine-debut','masculine-n-20','masculine-pause'], pause: true });
  // Sans AudioContext, des lecteurs réels (simulés ici seulement côté
  // périphérique) tentent la prise complète sans rejouer les anciens fragments.
  const scenarios = await page.evaluate(async () => {
    const jouerLecteurs = window.__jouerLecteursOriginal;
    // La fonction originale a été sauvegardée avant instrumentation.
    chronoVoixJouerLecteurs = jouerLecteurs;
    chronoVoixJouerTampons = (n, cb) => cb(false);
    chronoBipDoux = () => null;
    const essais = [];
    for (const scenario of ['normal', 'finale', 'finale-echec-complet', 'finale-echec-fin', 'annulation', 'muet']) {
      const lus = []; let fin = 0;
      const avant = chronoVoixLecteur;
      chronoVoixLecteur = nom => ({
        addEventListener(type, callback) { this[type] = callback; },
        play() { lus.push(nom); setTimeout(() => {
          if ((scenario === 'finale-echec-complet' && nom === 'masculine-complet-5') ||
              (scenario === 'finale-echec-fin' && nom === 'masculine-fin-serie' && lus.length === 1)) this.error();
          else this.ended();
        }, 5); return Promise.resolve(); },
        pause() {}, set currentTime(v) {}, set volume(v) {}
      });
      localStorage.setItem('studyPlanIB_voixActive', scenario === 'muet' ? 'false' : 'true');
      chronoAnnoncerPause(5, () => { fin++; }, scenario.startsWith('finale'));
      if (scenario === 'annulation') setTimeout(() => chronoInterrompreAnnonce(false), 100);
      await new Promise(resolve => setTimeout(resolve, scenario === 'annulation' ? 1100 : 2000));
      chronoVoixLecteur = avant; chronoInterrompreAnnonce(false);
      essais.push({ scenario, lus, fin });
    }
    localStorage.setItem('studyPlanIB_voixActive', 'true');
    localStorage.setItem('studyPlanIB_voixType', 'feminine');
    const feminine = chronoVoixPhrasePause(5);
    localStorage.setItem('studyPlanIB_voixType', 'masculine');
    return { essais, feminine, vingtEtUn: chronoVoixPhrasePause(21), reprise: chronoVoixUrl('masculine-reprise') };
  });
  assert.deepEqual(scenarios.essais, [
    { scenario: 'normal', lus: ['masculine-complet-5'], fin: 1 },
    { scenario: 'finale', lus: ['masculine-fin-serie', 'masculine-complet-5'], fin: 1 },
    { scenario: 'finale-echec-complet', lus: ['masculine-fin-serie', 'masculine-complet-5'], fin: 1 },
    { scenario: 'finale-echec-fin', lus: ['masculine-fin-serie'], fin: 1 },
    { scenario: 'annulation', lus: [], fin: 0 },
    { scenario: 'muet', lus: [], fin: 1 }
  ]);
  assert.ok(!scenarios.feminine.includes('masculine-complet-5'));
  assert.deepEqual(scenarios.vingtEtUn, ['masculine-complet-21']);
  assert.ok(scenarios.reprise.includes('reprise-proposition.wav'));
  const limites = await page.evaluate(() => {
    localStorage.setItem('studyPlanIB_voixType', 'feminine');
    const feminine = chronoVoixServiceNom(21, true);
    localStorage.setItem('studyPlanIB_voixType', 'masculine');
    window.STUDYPLAN_VOIX_BACKEND = 'http://service-non-securise.example';
    const nonSecurise = chronoVoixServiceNom(21, true);
    window.STUDYPLAN_VOIX_BACKEND = '/api-voix'; window.STUDYPLAN_VOIX_DEBIT = 'inconnu';
    const debitInconnu = chronoVoixServiceNom(21, true);
    return { feminine, nonSecurise, debitInconnu };
  });
  assert.deepEqual(limites, { feminine: null, nonSecurise: null, debitInconnu: null });
  const ecoute = new URL('livrables/publication-voix/essai-backend/', site).href;
  await page.goto(ecoute);
  assert.equal(await page.locator('audio').count(), 9);
  for (const message of ['fin-serie', 'pause-05', 'pause-21']) for (const debit of ['lent', 'normal', 'rapide']) {
    const r = await page.request.get(new URL(`${message}-${debit}.mp3`, ecoute).href);
    assert.equal(r.status(), 200); assert.ok((await r.body()).length > 5000);
  }
  assert.deepEqual(errors, []);
  console.log('OK service HTTP préchargé, clip unique, panne et secours du minuteur');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
