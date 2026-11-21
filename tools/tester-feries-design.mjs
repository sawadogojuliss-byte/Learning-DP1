/* Parcours visuel et fonctionnel des fériés, avec un profil fictif. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE||'http://127.0.0.1:8671/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
const pret=page=>page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
try {
 for(const width of [320,390,768,1280]) {
  const page=await browser.newPage({viewport:{width,height:width===320?568:800},serviceWorkers:'block'}), errors=[];
  page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>r.request().url().startsWith(site)?r.continue():r.abort());
  await page.addInitScript(()=>window.__STUDYPLAN_E2E=true);await page.goto(site,{waitUntil:'domcontentloaded'});await pret(page);
  await page.evaluate(()=>{userName='Élève';ibYear='DP1';subjects=[];optionalSubjects=[];window.__profilComplet=true;document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');holidayToutEffacer();navigateTo('planning');});
  await page.waitForFunction(()=>history.state?.etape==='planning');await page.evaluate(()=>navigateTo('feries'));
  await page.waitForFunction(()=>history.state?.etape==='feries');
  const panel=page.locator('#panelFeries');assert.equal(await panel.isVisible(),true);
  assert.equal(await panel.locator('.holiday-week').count(),2);assert.equal(await panel.locator('.holiday-day').count(),14);
  assert.equal(await panel.locator('.holiday-empty').isVisible(),true);assert.equal(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'pas de débordement');
  const dates=await page.evaluate(()=>({past:holidayCleDate(new Date()),current:holidayCleDate(holidayDateDuJour((new Date().getDay()+6)%7,0)),next:holidayCleDate(holidayDateDuJour(0,1))}));
  const jours=await panel.locator('.holiday-day').evaluateAll(els=>els.map(e=>({date:e.dataset.holidayDate,disabled:e.disabled,pressed:e.getAttribute('aria-pressed')})));
  assert.ok(jours.every(e=>e.disabled===(e.date<dates.past)));assert.ok(jours.every(e=>e.pressed==='false'));
  if(process.env.STUDY_CAPTURE_FERIES) await panel.screenshot({path:'/tmp/feries-vide-'+width+'.png'});
  const date=panel.locator('.holiday-day[data-holiday-date="'+dates.next+'"]');await date.click();
  assert.equal(await date.getAttribute('aria-pressed'),'true');assert.match(await date.evaluate(e=>getComputedStyle(e).backgroundImage),/gradient/, 'la sélection reste lisible au survol');assert.equal(await date.evaluate(e=>e===document.activeElement),true,'focus conservé');
  const section=panel.locator('.holiday-date-card').first();assert.equal(await section.isVisible(),true);
  const keep=section.locator('[data-holiday-mode="keep"]'), light=section.locator('[data-holiday-mode="light"]'), free=section.locator('[data-holiday-mode="free"]');
  assert.equal(await keep.getAttribute('aria-pressed'),'true');if(process.env.STUDY_CAPTURE_FERIES) await section.screenshot({path:'/tmp/feries-choix-'+width+'.png'});await free.click();assert.equal(await free.getAttribute('aria-pressed'),'true');
  assert.equal(await free.evaluate(e=>e===document.activeElement),true);assert.equal(await page.evaluate(c=>holidayDates[c],dates.next),'free');
  await page.evaluate(()=>{normalDayEvents=()=>[{id:'test-1',icon:'📚',title:'Lecture fictive',startTime:'10:00',endTime:'11:00'},{id:'test-2',icon:'⚽',title:'Sport fictif',startTime:'14:00',endTime:'15:00'}]});
  await light.click();assert.equal(await light.getAttribute('aria-pressed'),'true');assert.equal(await section.locator('.holiday-activity input').count(),2);
  await section.getByLabel(/Lecture fictive/).uncheck();assert.deepEqual(await page.evaluate(c=>holidayDroppedDates[c],dates.next),['test-1']);
  assert.equal(await section.getByLabel(/Lecture fictive/).evaluate(e=>e===document.activeElement),true);
  await page.evaluate(()=>memoireSauvegarder());await page.reload({waitUntil:'domcontentloaded'});await pret(page);
  assert.equal(await page.evaluate(c=>holidayDates[c],dates.next),'light');assert.deepEqual(await page.evaluate(c=>holidayDroppedDates[c],dates.next),['test-1']);
  assert.equal(await date.getAttribute('aria-pressed'),'true');assert.equal(await light.getAttribute('aria-pressed'),'true');
  await date.click();assert.equal(await date.getAttribute('aria-pressed'),'false');assert.equal(await panel.locator('.holiday-empty').isVisible(),true);assert.equal(await page.evaluate(c=>Object.hasOwn(holidayDroppedDates,c),dates.next),false);
  await panel.locator('.holiday-day[data-holiday-date="'+dates.current+'"]').click();assert.equal(await panel.locator('.holiday-date-card').count(),1);
  await date.click();assert.equal(await panel.locator('.holiday-date-card').count(),2,'plusieurs dates indépendantes');await panel.locator('.holiday-choice[data-holiday-date="'+dates.next+'"][data-holiday-mode="free"]').click();assert.deepEqual(await page.evaluate(d=>[holidayDates[d.current],holidayDates[d.next]],dates),['keep','free']);
  await date.click();assert.equal(await panel.locator('.holiday-date-card').count(),1,'retirer une date conserve les autres');
  assert.equal(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
  if(process.env.STUDY_CAPTURE_FERIES){await panel.evaluate(e=>e.scrollTop=0);await panel.screenshot({path:'/tmp/feries-selection-'+width+'.png'});}
  await panel.locator('.study-back').click();await page.waitForFunction(()=>memoireEtapeActive()==='planning');
  assert.deepEqual(errors,[]);console.log('OK fériés : design, dates, modes et sauvegarde',width);await page.close();
 }
} finally {await browser.close()}
