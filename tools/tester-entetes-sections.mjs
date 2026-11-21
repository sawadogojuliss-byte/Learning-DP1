/* Vérifie les barres des sections choisies, leurs retours et leur taille. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const base=process.env.STUDY_SITE||'http://127.0.0.1:8653/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
const sections=[['eeia','panelEEia'],['feries','panelFeries'],['soutien','panelSoutien'],['feedback','panelFeedback'],['aide','panelAide'],['legende','panelLegende']];
try {
 for(const width of [320,390,1280]) {
  const page=await browser.newPage({viewport:{width,height:800},serviceWorkers:'block'});
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
  await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');userName='Élève';ibYear='DP1';subjects=[];optionalSubjects=[];window.__profilComplet=true;memoireSauvegarder()});
  for(const [name,id] of sections) {
   const previous=name==='aide'?'soutien':'aide';
   await page.evaluate(n=>navigateTo(n),previous);
   await page.waitForFunction(n=>history.state?.etape===n,previous);
   await page.evaluate(n=>navigateTo(n),name);
   await page.waitForFunction(n=>history.state?.etape===n,name);
   const panel=page.locator('#'+id); const bar=panel.locator('.study-topbar');
   assert.equal(await bar.count(),1,name); assert.equal(await bar.isVisible(),true,name);
   const style=await bar.evaluate(el=>({radius:getComputedStyle(el).borderRadius,background:getComputedStyle(el).backgroundImage,logo:el.querySelector('img').naturalWidth,rect:el.getBoundingClientRect().toJSON()}));
   assert.equal(style.radius,'20px',name); assert.match(style.background,/linear-gradient/,name); assert.ok(style.logo>0,name+' logo');
   assert.ok(style.rect.left>=0 && style.rect.right<=width,name+' dans l’écran');
   assert.ok(style.rect.width<=width,name+' barre sans débordement');
   await panel.locator('.study-back').click(); await page.waitForFunction(n=>memoireEtapeActive()===n,previous);
   console.log('OK',width,name);
  }
  assert.equal(await page.locator('#panelPomodoro .study-topbar, #salonFocus .study-topbar').count(),0);
  await page.close();
 }
}finally{await browser.close()}
