/* Tests des images ajoutées, sur un profil fictif et sans accès au Drive. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE || 'http://127.0.0.1:8518/';
const inventory=JSON.parse(fs.readFileSync(new URL('../livrables/publication-themes/images.json', import.meta.url)));
assert.equal(inventory.length,29);
const browser=await chromium.launch(portable ? {executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')} : {});
try {
 for (const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]) {
  const context=await browser.newContext({viewport}); const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',r=>r.request().url().startsWith(site)?r.continue():r.abort());
  await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true;if(!sessionStorage.getItem('__testThemeInit')){localStorage.setItem('studyPlanIB_focusFond','32');sessionStorage.setItem('__testThemeInit','1')}});
  await page.goto(site,{waitUntil:'domcontentloaded'}); await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
  await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerReglages();focusChoisirOnglet('themes')});
  assert.equal(await page.evaluate(()=>FOCUS_FONDS[focusEtat.fond].id),'chalet-neige-anime','ancien indice préservé');
  assert.equal(await page.locator('#focusThemesCorps .focus-rangee').last().locator('h4').innerText(),'Animé');
  for (const cat of [...new Set(inventory.map(i=>i.cat))]) {
   await page.locator(`#focusFiltresFonds [data-cat="${cat}"]`).click();
   for(const item of inventory.filter(i=>i.cat===cat)) {
    const index=await page.evaluate(id=>focusIndexParId(id),item.id); assert.ok(index>=33,item.id);
    const tile=page.locator(`#focusThemesCorps .focus-tuile-theme[data-index="${index}"]`);
    assert.equal(await tile.count(),1,item.id);assert.equal((await tile.innerText()).trim(),item.nom);
    const image=await page.evaluate(async i=>{
      const f=FOCUS_FONDS[i];
      return Promise.all([f.src,f.mini].map(src=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve({ok:!!im.naturalWidth,w:im.naturalWidth});im.onerror=()=>resolve({ok:false});im.src=src})))
    },index);
    assert.ok(image.every(i=>i.ok),item.id+' image et vignette chargées');
    await tile.click();
    await page.waitForFunction(id=>{const f=FOCUS_FONDS[focusEtat.fond];return f.id===id&&document.getElementById('focusBg').style.backgroundImage.includes(id+'.webp')},item.id,{timeout:20000});
    assert.equal(await tile.getAttribute('aria-pressed'),'true');
   }
  }
  // La sauvegarde est bien persistante après rechargement ; ne plus réécrire
  // l'ancien indice au démarrage de cette seconde page.
  const selected=inventory.at(-1).id;
  await page.evaluate(id=>{focusPoserFond(focusIndexParId(id));},selected);
  assert.equal(await page.evaluate(()=>localStorage.getItem('studyPlanIB_focusFond')),String(await page.evaluate(id=>focusIndexParId(id),selected)));
  await page.reload({waitUntil:'domcontentloaded'}); await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
  await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro')});
  assert.equal(await page.evaluate(()=>FOCUS_FONDS[focusEtat.fond].id),selected,'nouveau thème restauré');
  await page.waitForFunction(id=>document.getElementById('focusBg').style.backgroundImage.includes(id+'.webp'),selected,{timeout:20000});
  await context.close();
  assert.deepEqual(errors,[]);console.log('OK 29 thèmes, catégories, images et sélection : '+viewport.width+'×'+viewport.height);
 }
} finally {await browser.close()}
