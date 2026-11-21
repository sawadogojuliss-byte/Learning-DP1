/* Parcours fictifs : présentation et interactions, sans compte ni données réelles. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE||'http://127.0.0.1:8671/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
try {
 for(const width of [320,390,768,1280]) {
  const page=await browser.newPage({viewport:{width,height:800},serviceWorkers:'block'});const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',r=>r.request().url().startsWith(site)?r.continue():r.abort());
  await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true});
  await page.goto(site,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
  await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));userName='Élève';ibYear='DP1';subjects=[];optionalSubjects=[];window.__profilComplet=true;document.getElementById('planningModal').classList.add('active');});
  await page.evaluate(()=>showHabitsPage('planning'));
  const habits=page.locator('#habitsModal');assert.equal(await habits.isVisible(),true);
  assert.equal(await habits.locator('.routine-welcome').isVisible(),true);
  assert.deepEqual(await habits.locator('.routine-card-head .routine-emoji').allTextContents(),['🚿','🥐','🍽️']);
  assert.equal(await habits.locator('#habitsProgress').isVisible(),false,'progression masquée depuis le planning');
  assert.equal(await habits.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'habitudes : débordement horizontal');
  assert.equal(await habits.locator('.routine-actions').count(),0,'boutons inférieurs retirés');
  if(width>=701) { const rects=await habits.locator('.routine-grid > .routine-card').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}})); assert.equal(rects.length,3);assert.ok(rects.every(r=>Math.abs(r.top-rects[0].top)<1 && Math.abs(r.bottom-rects[0].bottom)<1),'trois cartes alignées en hauteur');assert.ok(rects[0].right<=rects[1].left && rects[1].right<=rects[2].left,'trois cartes sur la même ligne'); }
  if(process.env.STUDY_CAPTURE_ORGANISATION) await habits.screenshot({path:`/tmp/habitudes-${width}.png`});
  await habits.locator('#petitDejBtnHeure').click();assert.equal(await habits.locator('#petitDejChamps').isVisible(),true);
  await habits.locator('[aria-label="Augmenter la durée du petit-déjeuner"]').click();assert.equal(await habits.locator('#petitDejDureeLabel').innerText(),'35 min');
  await habits.locator('#petitDejBtnAucun').click();assert.equal(await habits.locator('#petitDejVide').isVisible(),true);
  await habits.locator('#dinerBtnAucun').click();
  await habits.locator('#prepMatinFinInput').fill('06:45');
  await habits.getByRole('button',{name:/Enregistrer/}).click();
  assert.match(await habits.locator('#habitsError').innerText(),/fin doit être après le début/);assert.equal(await page.evaluate(()=>habitudesDefinies),false,'un horaire invalide ne peut pas être sauvegardé');
  await habits.locator('#prepMatinFinInput').fill('07:25');
  await habits.getByRole('button',{name:/Enregistrer/}).click();
  assert.match(await habits.locator('#habitsSaved').innerText(),/enregistrées/);assert.equal(await habits.isVisible(),true,'enregistrer reste dans la section');
  assert.equal(await page.evaluate(()=>habitudesDefinies),true);assert.equal(await page.evaluate(()=>prepMatinFin),'07:25');assert.equal(await page.evaluate(()=>petitDejHeure),'');
  await page.waitForFunction(()=>history.state?.etape==='habitudes');await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
  assert.equal(await habits.locator('#prepMatinFinInput').inputValue(),'07:25','sauvegarde conservée après rechargement');assert.equal(await page.evaluate(()=>habitudesDefinies),true);
  await page.evaluate(()=>{window.__rendusHabitudes=0;const original=renderPlanning;renderPlanning=function(){window.__rendusHabitudes++;return original.apply(this,arguments)}});
  await habits.locator('.study-back').click();assert.equal(await page.locator('#planningModal').isVisible(),true,'retour au planning');assert.ok(await page.evaluate(()=>window.__rendusHabitudes)>0,'le planning est recalculé au retour');
  await page.evaluate(()=>{window.__profilComplet=false;showHabitsPage('transport')});assert.equal(await habits.locator('#habitsProgress').isVisible(),true,'progression visible pendant inscription');
  assert.equal(await habits.locator('.context-card').isVisible(),true,'ancienne carte blanche pour le profil');
  assert.equal(await habits.locator('.study-topbar').count(),0);
  await habits.locator('.btn-back').click();assert.equal(await page.locator('#sleepModal').isVisible(),true,'retour vers sommeil');
  await page.evaluate(()=>window.__profilComplet=true);
  await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');localStorage.removeItem(EMPLOI_CLE);showEmploiPage();});
  const emploi=page.locator('#emploiModal');assert.equal(await emploi.isVisible(),true);
  assert.equal(await emploi.locator('.routine-welcome').isVisible(),true);
  assert.equal(await emploi.locator('.routine-actions').count(),0,'ancienne rangée retirée');
  assert.equal(await emploi.getByRole('button',{name:'Voir mon planning'}).count(),0,'bouton Mon planning retiré');
  const centre=await emploi.locator('.routine-list-card').evaluate(el=>{const a=el.getBoundingClientRect(),p=el.closest('.routine-shell').getBoundingClientRect();return Math.abs((a.left+a.right-p.left-p.right)/2)});assert.ok(centre<2,'cours centrés');
  assert.equal(await emploi.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'emploi : débordement horizontal');
  if(process.env.STUDY_CAPTURE_ORGANISATION) await emploi.screenshot({path:`/tmp/emploi-${width}.png`});
  await emploi.locator('#emploiAjouterBouton').click();assert.match(await emploi.locator('#emploiAjoutStatut').innerText(),/nécessaires/);
  await emploi.locator('#emploiManuelJour').selectOption('0');await emploi.locator('#emploiManuelNom').fill('Maths');
  await emploi.locator('#emploiManuelDebut').fill('09:00');await emploi.locator('#emploiManuelFin').fill('10:00');await emploi.locator('#emploiAjouterBouton').click();
  assert.match(await emploi.locator('#emploiListe').innerText(),/Maths/);
  await emploi.getByRole('button',{name:'Modifier Maths'}).click();await emploi.locator('#emploiManuelNom').fill('Physique');await emploi.locator('#emploiAjouterBouton').click();
  assert.match(await emploi.locator('#emploiListe').innerText(),/Physique/);assert.doesNotMatch(await emploi.locator('#emploiListe').innerText(),/Maths/);
  await emploi.locator('#emploiManuelNom').fill('Chimie');await emploi.locator('#emploiManuelDebut').fill('09:30');await emploi.locator('#emploiManuelFin').fill('10:30');await emploi.locator('#emploiAjouterBouton').click();
  assert.equal(await emploi.locator('#emploiConflit').isVisible(),true);await emploi.locator('#emploiConflitAnnuler').click();assert.doesNotMatch(await emploi.locator('#emploiListe').innerText(),/Chimie/);
  await emploi.locator('.study-back').click();assert.equal(await emploi.isVisible(),false);assert.equal(await page.locator('#planningModal').isVisible(),true,'planning accessible');
  assert.deepEqual(errors,[]);await page.close();console.log('OK',width,'habitudes et emploi');
 }
} finally {await browser.close()}
