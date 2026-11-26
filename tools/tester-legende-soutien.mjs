/* Couleurs existantes, humeur persistante et navigation, profils fictifs. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const base=process.env.STUDY_SITE||'http://127.0.0.1:8671/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
const attendu=[['😴 Sommeil','#818cf8','#eef2ff','solid'],['🏫 Cours','#60a5fa','#eff6ff','solid'],['🔴 Révision critique (≤2/7)','#ef4444','#fef2f2','solid'],['🟠 Révision à améliorer (≤4/7)','#f59e0b','#fffbeb','solid'],['📚 Révision normale','#fb923c','#fff7ed','solid'],['🎯 Activités','#a78bfa','#faf5ff','solid'],['🚗 Transport','#22d3ee','#ecfeff','solid'],['🍽️ Repas','#9ca3af','#f9fafb','solid'],['📱 Téléphone','#f472b6','#fdf2f8','solid'],['🎮 Temps libre','#4ade80','#f0fdf4','solid'],['📋 Évaluation interne','#fb7185','#fff1f2','solid'],['📖 Mémoire','#4d63a1','#eef2ff','dashed']];
const rgb=hex=>`rgb(${parseInt(hex.slice(1,3),16)}, ${parseInt(hex.slice(3,5),16)}, ${parseInt(hex.slice(5,7),16)})`;
try { for(const width of [320,390,768,1280]) {
 const page=await browser.newPage({viewport:{width,height:700},serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true});await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
 await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');userName='Élève';ibYear='DP1';subjects=[];optionalSubjects=[];window.__profilComplet=true;memoireSauvegarder();navigateTo('legende')});
 const legende=page.locator('#panelLegende');assert.equal(await legende.isVisible(),true);assert.equal(await legende.locator('.legend-welcome').isVisible(),true);
 const palette=await legende.locator('.legend-item').evaluateAll(els=>els.map(e=>[e.textContent.trim(),e.style.borderLeftColor,e.style.backgroundColor,e.style.borderLeftStyle]));
 assert.deepEqual(palette,attendu.map(([nom,b,f,style])=>[nom,rgb(b),rgb(f),style]));assert.equal(await legende.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'pas de débordement');
 if(process.env.STUDY_CAPTURE_LEGENDE)await legende.screenshot({path:`/tmp/legende-${width}.png`});
 await page.evaluate(()=>navigateTo('soutien'));const panel=page.locator('#panelSoutien');
 await panel.locator('[data-mood=fatigue]').click();const selection=panel.locator('[data-mood=fatigue]');
 await page.mouse.move(width/2,350);await page.mouse.wheel(0,-600);await page.waitForTimeout(300);
 assert.equal(await selection.getAttribute('aria-pressed'),'true');assert.ok(await selection.evaluate(e=>e.classList.contains('selected')));
 const avant=await panel.locator('#quoteText').innerText();await page.evaluate(()=>initSoutien());
 assert.equal(await selection.getAttribute('aria-pressed'),'true','initialisation ne désélectionne pas');assert.equal(await panel.locator('#quoteText').innerText(),avant,'citation conservée');
 await page.evaluate(()=>{navigateTo('planning');navigateTo('soutien')});assert.equal(await selection.getAttribute('aria-pressed'),'true','retour conserve l’humeur');
 assert.equal(await page.evaluate(()=>currentMood),'fatigue');assert.equal(await panel.locator('#encouragementSection').isVisible(),true);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
 await page.evaluate(()=>navigateTo('soutien'));assert.equal(await panel.locator('[data-mood=fatigue]').getAttribute('aria-pressed'),'true','humeur restaurée après rechargement');
 await panel.getByRole('button',{name:'Changer d’humeur'}).click();assert.equal(await page.evaluate(()=>currentMood),null);assert.equal(await panel.locator('.mood-btn[aria-pressed=true]').count(),0);
 assert.deepEqual(errors,[]);await page.close();console.log('OK palette et humeur',width);
} } finally {await browser.close();}
