/* Navigation et mise à jour visuelle sur données fictives, sans réseau externe ni mails. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const base = process.env.STUDY_SITE || 'http://127.0.0.1:8691/';
const browser = await chromium.launch(portable ? { executablePath: await portable.executablePath(), args: portable.args.filter(x => x !== '--single-process') } : {});
try {
  for (const width of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport:{width,height:900},serviceWorkers:'block' });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    await page.goto(base, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, {timeout:60000});
    await page.waitForTimeout(1800); // Laisser finir l’initialisation de session avant les données fictives.
    await page.evaluate(async () => {
      document.querySelectorAll('.app-panel.active,.context-modal.active').forEach(el => el.classList.remove('active'));
      document.getElementById('panelEmplois').classList.add('active');
      boiteEstAdmin = () => true;
      const week = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'].map((j,i) => ({j,s:i?[]:[{d:'08:00',f:'09:00',t:'Mathématiques'}]}));
      const a = {type:'emploi',id:'e_alice',at:'2026-11-01T10:00:00Z',nom:'Alice',classe:'DP1',firebaseUid:'alice',docId:'alice',docColl:'emplois_du_temps',jours:week,complet:1};
      const b = {type:'emploi',id:'e_bob',at:'2026-11-01T10:00:00Z',nom:'Bob',classe:'DP2',firebaseUid:'bob',docId:'bob',docColl:'emplois_du_temps',jours:week,complet:1};
      const contact = {type:'question',id:'contact',at:'2026-11-01T11:00:00Z',nom:'Contact'};
      boiteBruts = [a,b];
      window.__flammesTest = {alice:{uid:'alice',flammes:18,flammeJour:'2026-11-01'},bob:{uid:'bob',flammes:0,flammeJour:'2026-10-30'}};
      window.firebase = { firestore: () => ({collection:() => ({doc:uid => ({get:async () => ({exists:!!__flammesTest[uid],data:() => __flammesTest[uid]})})})}) };
      boiteBrancherAdmin();
      window.__fusionTest = boiteFusionner([a,b,contact]);
      boiteChargerListes = () => Promise.resolve(__fusionTest);
      await boiteFlammesLire(__fusionTest,boiteSessionGeneration);
      boiteListesCache = __fusionTest;
      boiteRendreEmplois(__fusionTest);
    });
    const rows = page.locator('#emploisListe .emploi-atelier-personne');
    assert.equal(await rows.count(),3);
    assert.match(await rows.filter({hasText:'Alice'}).innerText(),/18/);
    assert.match(await rows.filter({hasText:'Bob'}).innerText(),/0/);
    assert.match(await rows.filter({hasText:'Contact'}).innerText(),/—/);
    assert.equal(await rows.filter({hasText:'Alice'}).locator('.emploi-atelier-flamme').getAttribute('aria-label'),'18 jours de flammes');
    assert.equal((await rows.filter({hasText:'Alice'}).locator('.emploi-atelier-flamme').innerText()).replace(/\s+/g, ' ').trim(),'🔥 18 jours');
    assert.doesNotMatch(await rows.filter({hasText:'Alice'}).innerText(), /01\/11\/2026|dernière activité/);
    assert.match(await rows.filter({hasText:'Bob'}).innerText(), /0\s+jour/);
    assert.notEqual(await rows.filter({hasText:'Alice'}).locator('.emploi-atelier-flamme').evaluate(el => getComputedStyle(el).backgroundImage),'none');
    assert(await rows.filter({hasText:'Alice'}).locator('.emploi-atelier-flamme').evaluate(el => el.getBoundingClientRect().right <= el.closest('button').getBoundingClientRect().right + 1), 'badge dans la carte');
    await page.locator('#emploisFiltre').fill('Alice');
    assert.equal(await rows.count(),1);
    await page.evaluate(async () => { __flammesTest.alice.flammes=19; __flammesTest.alice.flammeJour='2026-11-02'; boiteFlammesCache=Object.create(null); await boiteFlammesLire(__fusionTest,boiteSessionGeneration); boiteRendreEmplois(__fusionTest); });
    assert.match(await rows.first().innerText(), /19/);
    assert.equal(await page.locator('#emploisFiltre').inputValue(),'Alice');
    assert.match(await page.locator('#emploisDetail').innerText(),/Mathématiques/);
    assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log('ok flammes admin en navigateur : desktop et mobile, design, filtre, mise à jour fictive, aucun envoi');
} finally { await browser.close(); }
