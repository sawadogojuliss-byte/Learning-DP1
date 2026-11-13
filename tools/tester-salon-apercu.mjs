/* Vérifie uniquement la maquette non connectée : aucun salon n'est créé. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const base=process.env.STUDY_SITE || 'http://127.0.0.1:8645/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
try {
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]) {
  const page=await browser.newPage({viewport});const erreurs=[];page.on('pageerror',e=>erreurs.push(String(e)));
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await page.addInitScript(()=>window.__STUDYPLAN_E2E=true);
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
  await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerReglages()});
  const tab=page.locator('#focusReglages [data-onglet="salon"]');await tab.click();
  const section=page.locator('#focusReglages [data-page="salon"]');assert.equal(await section.isVisible(),true);
  assert.equal(await section.locator('input[name=salonPartage]').count(),6);
  assert.equal(await section.locator('input[name=salonPartage]:checked').count(),0);
  await section.locator('#salonNom').fill('Révisions Partiels');await section.locator('input[value=theme]').check();
  assert.equal(await section.locator('input[value=theme]').isChecked(),true);
  assert.match(await section.locator('#salonSelectionResume').innerText(),/^1 élément partagé/);
  await section.locator('input[value=horloge]').check();
  assert.equal(await section.locator('input[name=salonPartage]:checked').count(),2);
  assert.match(await section.locator('#salonSelectionResume').innerText(),/^2 éléments partagés/);
  await section.locator('input[value=theme]').uncheck();await section.locator('input[value=horloge]').uncheck();
  assert.match(await section.locator('#salonSelectionResume').innerText(),/^Aucun élément/);
  assert.equal(await section.locator('#salonCreer').isDisabled(),true);
  assert.match(await section.locator('.salon-note').innerText(),/n’est pas encore activé/);
  assert.equal(await section.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'pas de débordement horizontal');
  assert.equal(await page.locator('#panelSeances [data-page="salon"]').count(),0);
  assert.deepEqual(erreurs,[]);console.log('OK maquette non connectée '+viewport.width+'×'+viewport.height);await page.close();
 }
} finally {await browser.close()}
