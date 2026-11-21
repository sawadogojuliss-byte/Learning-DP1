/* Design et interactions des trois pages, sans envoyer de données réelles. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const base=process.env.STUDY_SITE||'http://127.0.0.1:8671/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
try {
 for(const width of [320,390,1280]) {
  const page=await browser.newPage({viewport:{width,height:800},serviceWorkers:'block'});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true});await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
  await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');userName='Élève';ibYear='DP1';subjects=[];optionalSubjects=[];window.__profilComplet=true;memoireSauvegarder();});
  for(const [name,id] of [['soutien','panelSoutien'],['aide','panelAide'],['feedback','panelFeedback']]) {
   await page.evaluate(n=>navigateTo(n),name);await page.waitForFunction(n=>memoireEtapeActive()===n,name);
   const panel=page.locator('#'+id);assert.equal(await panel.isVisible(),true);
   assert.equal(await panel.locator('.study-topbar').isVisible(),true,'barre existante conservée');
   assert.equal(await panel.locator('.care-card').first().isVisible(),true);
   const dims=await panel.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,background:getComputedStyle(el).backgroundImage}));
   assert.ok(dims.scroll<=dims.client+1,`${name} : débordement horizontal`);assert.match(dims.background,/gradient/,`${name} : style chargé`);
   if(process.env.STUDY_CAPTURE && width===390) await panel.screenshot({path:`/tmp/study-${name}.png`});
   if(name==='soutien') {
    assert.equal(await panel.locator('.mood-btn').count(),12);
    assert.deepEqual(await panel.locator('.care-mood-emoji').allTextContents(),['🔥','😊','😴','😰','📉','😕','😟','😞','🤯','🏆','😑','😐']);
    const position=await panel.locator('.care-layout').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return {offset:Math.abs((r.left+r.right-p.left-p.right)/2), grid:el.querySelector('.care-mood-grid').getBoundingClientRect().top,guide:el.querySelector('.care-side').getBoundingClientRect().top}});
    assert.ok(position.offset<2,'grille centrée');assert.ok(position.guide>position.grid,'guide sous la grille');

    for(const btn of await panel.locator('.mood-btn').all()){
     await btn.click();assert.equal(await btn.getAttribute('aria-pressed'),'true');
     assert.equal(await panel.locator('.mood-btn[aria-pressed="true"]').count(),1);
     assert.equal(await panel.locator('#encouragementSection').isVisible(),true);
     assert.ok(await panel.locator('#quoteText').innerText());
    }
    await panel.getByRole('button',{name:'Changer d’humeur'}).click();
    assert.equal(await panel.locator('.mood-btn[aria-pressed="true"]').count(),0);
    assert.equal(await panel.locator('#soutienVide').isVisible(),true);
   } else {
    assert.equal(await panel.locator(`#${name}Images`).count(),1,'images disponibles');
    if(width===390){
     const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=12;c.height=12;const ctx=c.getContext('2d');ctx.fillStyle='#10b981';ctx.fillRect(0,0,12,12);return c.toDataURL('image/png').split(',')[1]});
     await panel.locator(`#${name}Images input[type=file]`).setInputFiles({name:'capture-fictive.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
     await panel.locator(`#${name}Images .boite-images-apercu`).waitFor();
     assert.equal(await panel.locator(`#${name}Images .boite-images-apercu`).count(),1,'aperçu visible');
     await panel.locator(`#${name}Images .boite-images-apercu button`).click();
     assert.equal(await panel.locator(`#${name}Images .boite-images-apercu`).count(),0,'image retirable');
    }
    await panel.locator(`#${name}Envoi`).click();
    assert.ok(await panel.locator(`#${name}Statut`).innerText(),'validation affichée');
    await panel.locator(`#${name}Email`).fill('eleve@example.test');
    await panel.locator(`#${name}Texte`).fill('Ceci est un message fictif.');
    await page.evaluate(()=>{window.__envoisTest=[];boitePublierEmploi=()=>{};boiteEnvoyerAvecImages=(record,type)=>{window.__envoisTest.push({record,type});return Promise.resolve()}});
    await panel.locator(`#${name}Envoi`).click();
    await page.waitForFunction(n=>document.getElementById(n+'Statut').textContent.includes('envoyé'),name);
    const result=await page.evaluate(()=>window.__envoisTest);
    assert.equal(result.length,1);assert.equal(result[0].type,name);
    assert.equal(await panel.locator(`#${name}Texte`).inputValue(),'');
    await page.evaluate(n=>navigateTo(n),'soutien');await page.evaluate(n=>navigateTo(n),name);
    assert.equal(await panel.locator(`#${name}Images`).count(),1,'pas de duplication après navigation');
   }
   console.log('OK',width,name);
  }
  assert.deepEqual(errors,[]);await page.close();
 }
} finally {await browser.close()}
