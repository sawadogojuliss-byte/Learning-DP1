'use strict';
// Les dates avancent sans attente ; seuls les gestes Playwright sont de vrais événements navigateur.
const assert = require('node:assert/strict');
const {chromium} = require((process.env.STUDY_TEST_MODULES || '/home/user/studio-test/node_modules') + '/playwright');
const base = process.env.STUDY_SITE || 'http://127.0.0.1:8765/';
(async () => {
 const browser = await chromium.launch(process.env.STUDY_PLAYWRIGHT_SYSTEM ? {headless:true} : {executablePath:process.env.STUDY_CHROMIUM_PATH || '/tmp/chromium', args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
  const page = await browser.newPage({serviceWorkers:'block'});
  await page.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
  await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00'));
  await page.goto(base, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, {timeout:60000});
  await page.evaluate(() => {
   localStorage.setItem('studyPlanIB_flamme','5'); localStorage.setItem('studyPlanIB_flammeJour','2026-10-24');
   localStorage.setItem('studyPlanIB_joursConnectes','20'); localStorage.setItem('studyPlanIB_dernierJour',new Date().toDateString());
   window.__flammeActiviteJour = '';
  });
  const lire = () => page.evaluate(() => ({n:localStorage.getItem('studyPlanIB_flamme'), jour:localStorage.getItem('studyPlanIB_flammeJour'), cumul:localStorage.getItem('studyPlanIB_joursConnectes')}));
  const usage = async () => {await page.keyboard.press('Shift'); await page.waitForTimeout(100)};
  await page.clock.setFixedTime(new Date('2026-10-25T12:00:00'));
  await page.reload({waitUntil:'domcontentloaded'}); await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'),null,{timeout:60000});
  assert.deepEqual(await lire(),{n:'5',jour:'2026-10-24',cumul:'20'},'rechargement seul ne compte pas');
  await page.evaluate(() => {compterJourConnecte();boiteFlammes();focusPeindreFlamme();document.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));});
  assert.deepEqual(await lire(),{n:'5',jour:'2026-10-24',cumul:'20'},'aucun compteur ne progresse par lecture ou événement synthétique');
  await usage(); assert.deepEqual(await lire(),{n:'6',jour:'2026-10-25',cumul:'21'});
  assert.equal(await page.locator('#joursCompte').textContent(),'6');
  assert.equal(await page.locator('#focusFlamme').textContent(),'6');
  await usage(); assert.equal((await lire()).n,'6','une seule flamme par jour');
  await page.clock.setFixedTime(new Date('2026-10-26T12:00:00'));
  await page.evaluate(() => Object.defineProperty(document,'hidden',{configurable:true,value:true}));
  await usage(); assert.equal((await lire()).n,'6','onglet caché ignoré');
  await page.evaluate(() => {delete document.hidden;}); await usage(); assert.equal((await lire()).n,'7');
  await page.clock.setFixedTime(new Date('2026-10-30T12:00:00'));
  await page.evaluate(() => {compterJourConnecte();boiteFlammes();});
  assert.deepEqual(await lire(),{n:'7',jour:'2026-10-26',cumul:'22'},'page laissée ouverte ne simule pas de jours');
  await usage(); assert.deepEqual(await lire(),{n:'0',jour:'2026-10-30',cumul:'23'},'interruption existante après trois jours manqués');
  await usage(); assert.equal((await lire()).n,'0');
  await page.clock.setFixedTime(new Date('2026-10-31T12:00:00')); await usage(); assert.equal((await lire()).n,'1');
  await page.reload({waitUntil:'domcontentloaded'}); await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'),null,{timeout:60000});
  assert.equal((await lire()).n,'1','rechargement sans nouveau geste');
  console.log('OK flammes : inactivité, événement synthétique, onglet caché, activité, limite quotidienne et interruption');
 } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exitCode=1;});
