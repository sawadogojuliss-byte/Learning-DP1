/* Vrai navigateur : catégories, rotation affichée et texte personnel conservé. */
import assert from 'node:assert/strict';import {createRequire} from 'node:module';import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE||'http://127.0.0.1:8653/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
try{
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]){
  const page=await browser.newPage({viewport,serviceWorkers:'block'}),erreurs=[];page.on('pageerror',e=>erreurs.push(String(e)));
  await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true});
  await page.goto(site,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
  await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro')});
  await page.waitForFunction(()=>Math.abs(document.getElementById('panelPomodoro').getBoundingClientRect().left)<1);
  await page.locator('#focusBtnReglages').click();await page.locator('.focus-tiroir-item[data-onglet="citations"]').click();
  const select=page.locator('#focusCategorieCitation'),citation=page.locator('#focusCitation');
  const saisie='Ma phrase personnelle reste à moi';await page.locator('#focusCitationPersonnelle').fill(saisie);
  for(const id of ['motivation','inspiration','bien-etre','toutes']){
   await select.selectOption(id);const texte=await citation.textContent();
   assert.equal(texte,await page.evaluate(()=>focusCitationDuJour()));
   assert.equal(await page.evaluate(id=>focusCitationsDeCategorie(id).some(x=>'“'+x.t+'”'===focusCitationDuJour()),id),true);
   assert.equal(await page.locator('#focusCitationPersonnelle').inputValue(),saisie);
  }
  await select.selectOption('personnelle');assert.equal(await citation.textContent(),'“'+saisie+'”');
  await select.selectOption('bien-etre');await page.locator('.focus-tiroir-fermer').click();
  assert.equal(await citation.isVisible(),true);await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
  await page.evaluate(()=>{document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro')});
  assert.equal(await page.evaluate(()=>focusLireReglages().citationCategorie),'bien-etre');assert.equal(await citation.textContent(),await page.evaluate(()=>focusCitationDuJour()));
  assert.equal(await page.evaluate(()=>focusLireReglages().citationPersonnelle),saisie);assert.deepEqual(erreurs,[]);
  await page.close();console.log(`OK citations et réglages ${viewport.width}×${viewport.height}`);
 }
}finally{await browser.close()}
