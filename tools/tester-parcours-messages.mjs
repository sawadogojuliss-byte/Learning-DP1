/* Deux présentations du même formulaire et limites des messages sans données réelles. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE||'http://127.0.0.1:8671/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
const ready=page=>page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nm6cAAAAASUVORK5CYII=','base64');
try {
 for(const width of [320,390,1280]) {
  const page=await browser.newPage({viewport:{width,height:width===320?568:800},serviceWorkers:'block'}), errors=[];
  page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>r.request().url().startsWith(site)?r.continue():r.abort());
  await page.addInitScript(()=>window.__STUDYPLAN_E2E=true);await page.goto(site,{waitUntil:'domcontentloaded'});await ready(page);
  await page.evaluate(()=>{userName='Élève';ibYear='DP1';subjects=[];optionalSubjects=[];window.__profilComplet=false;showHabitsPage('transport');memoireSauvegarder()});
  const habits=page.locator('#habitsModal');assert.equal(await habits.locator('.context-card').isVisible(),true);assert.equal(await habits.locator('.routine-hero').count(),0);
  assert.equal(await habits.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
  await page.waitForFunction(()=>history.state?.etape==='habitudes');await page.reload({waitUntil:'domcontentloaded'});await ready(page);
  assert.equal(await habits.locator('.context-card').isVisible(),true,'profil habitudes au rechargement');assert.equal(await page.evaluate(()=>!!window.__profilComplet),false);
  await habits.locator('#petitDejBtnAucun').click();await habits.locator('#dinerBtnAucun').click();await habits.locator('.btn-continue').click();
  assert.equal(await page.evaluate(()=>habitudesDefinies),true,'habitudes enregistrées depuis le profil');assert.equal(await page.locator('#transportModal').isVisible(),true);
  await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));showEmploiPage();memoireSauvegarder()});
  const emploi=page.locator('#emploiModal');assert.equal(await emploi.locator('.context-card').isVisible(),true,'ancien emploi pendant inscription');
  assert.equal(await emploi.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
  await emploi.locator('#emploiManuelJour').selectOption('0');await emploi.locator('#emploiManuelNom').fill('Biologie');await emploi.locator('#emploiManuelDebut').fill('09:00');await emploi.locator('#emploiManuelFin').fill('10:00');await emploi.locator('#emploiAjouterBouton').click();assert.match(await emploi.locator('#emploiListe').innerText(),/Biologie/);
  await page.waitForFunction(()=>history.state?.etape==='emploi');await page.reload({waitUntil:'domcontentloaded'});await ready(page);
  assert.equal(await emploi.locator('.context-card').isVisible(),true,'ancien emploi après rechargement');assert.equal(await page.evaluate(()=>!!window.__profilComplet),false);assert.match(await emploi.locator('#emploiListe').innerText(),/Biologie/);
  await emploi.locator('.btn-back').click();assert.equal(await page.locator('#freeTimeModal').isVisible(),true,'retour inscription vers temps libre');
  await page.evaluate(()=>{window.__profilComplet=true;document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('aide')});
  await page.waitForFunction(()=>history.state?.etape==='aide');await page.evaluate(()=>navigateTo('emploi'));await page.waitForFunction(()=>history.state?.etape==='emploi');
  assert.equal(await emploi.locator('.routine-hero').isVisible(),true,'emploi section préservé');assert.match(await emploi.locator('#emploiListe').innerText(),/Biologie/);
  await emploi.locator('.study-back').click();await page.waitForFunction(()=>memoireEtapeActive()==='planning');assert.equal(await page.locator('#planningModal').isVisible(),true,'retour direct au planning même depuis aide');
  await page.evaluate(()=>showHabitsPage('planning'));assert.equal(await habits.locator('.routine-hero').isVisible(),true,'habitudes section préservées');
  await page.waitForFunction(()=>history.state?.etape==='habitudes');await page.reload({waitUntil:'domcontentloaded'});await ready(page);
  assert.equal(await habits.locator('.routine-hero').isVisible(),true,'section habitudes au rechargement');await habits.locator('.study-back').click();await page.waitForFunction(()=>memoireEtapeActive()==='planning');
  await page.evaluate(()=>{window.__docs=[];boiteEcrireBoite=r=>{window.__docs.push(boiteMessagePourFirestore(r));return Promise.resolve(true)};boitePublierEmploi=()=>{};});
  for(const type of ['aide','feedback']) {
   await page.evaluate(t=>navigateTo(t),type);const input=page.locator('#'+type+'Texte'), button=page.locator('#'+type+'Envoi');
   await page.locator('#'+type+'Email').fill('test@example.org');
   const texte=Array(1000).fill('bonjour').join(' \n');assert.ok(texte.length>800);
   await input.fill(texte+' supplémentaire');assert.match(await page.locator('#'+type+'Compteur').innerText(),/1\s?001/);
   const avant=await page.evaluate(()=>window.__docs.length);await button.click();assert.match(await page.locator('#'+type+'Statut').innerText(),/dépasse 1 000 mots/);assert.equal(await page.evaluate(()=>window.__docs.length),avant);assert.equal(await input.inputValue(),texte+' supplémentaire');
   await input.fill(texte);await button.click();await page.waitForFunction(t=>document.getElementById(t+'Statut').textContent.includes('envoyé'),type);
   assert.equal(await page.evaluate(t=>window.__docs.at(-1)[t==='aide'?'04_question':'04_feedback'],type),texte,'aucune troncature texte');
   await page.locator('#'+type+'Images input').setInputFiles({name:'pixel.png',mimeType:'image/png',buffer:pixel});await page.waitForFunction(t=>document.querySelectorAll('#'+t+'Images .boite-images-apercu').length===1,type);
   await input.fill(texte);await button.click();await page.waitForFunction(t=>document.getElementById(t+'Statut').textContent.includes('envoyé'),type);
   const saved=await page.evaluate(t=>boiteImagesDecoder(window.__docs.at(-1)[t==='aide'?'04_question':'04_feedback']),type);
   assert.equal(saved.texte,texte,'aucune troncature avec image');assert.equal(saved.images.length,1);
  }
  assert.deepEqual(errors,[]);await page.close();console.log('OK parcours, retour et 1 000 mots',width);
 }
} finally {await browser.close()}
