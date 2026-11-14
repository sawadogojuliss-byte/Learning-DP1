/* Le curseur reste constant aux bords et sur les éléments enfants d'une commande. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const base=process.env.STUDY_SITE||'http://127.0.0.1:8648/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});await page.addInitScript(()=>window.__STUDYPLAN_E2E=true);await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
 await page.evaluate(()=>{const d=document.createElement('div');d.id='testCurseur';d.style.cssText='position:fixed;left:50px;top:50px;z-index:999999;';d.innerHTML='<button class="menu-item-btn" style="width:200px;height:50px"><span>Un libellé</span><svg width="20" height="20"><circle cx="10" cy="10" r="5"/></svg></button><input type="text" value="Texte">';document.body.appendChild(d)});
 const button=page.locator('#testCurseur button'),box=await button.boundingBox();await page.mouse.move(box.x+1,box.y+box.height/2);
 const observations=await page.evaluate(async ({x,y})=>{let valeurs=[];for(let i=0;i<60;i++){let el=document.elementFromPoint(x,y);valeurs.push([!!el?.closest('#testCurseur button'),el?getComputedStyle(el).cursor:'']);await new Promise(r=>requestAnimationFrame(r))}return valeurs},{x:box.x+1,y:box.y+box.height/2});
 assert.ok(observations.every(([sur,cursor])=>sur&&cursor==='pointer'),'le bord reste sous la souris au survol');
 assert.equal(await page.locator('#testCurseur span').evaluate(e=>getComputedStyle(e).cursor),'pointer');assert.equal(await page.locator('#testCurseur svg circle').evaluate(e=>getComputedStyle(e).cursor),'pointer');
 assert.equal(await page.locator('#testCurseur input').evaluate(e=>getComputedStyle(e).cursor),'text','le curseur de texte est conservé');
 await page.evaluate(()=>{document.getElementById('testCurseur').remove();document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerReglages();focusChoisirOnglet('salon')});
 const caseTheme=page.locator('[name=salonPartage][value=theme]');await caseTheme.check();assert.equal(await caseTheme.isChecked(),true);assert.equal(await caseTheme.evaluate(e=>getComputedStyle(e).appearance),'none');await caseTheme.uncheck();assert.equal(await caseTheme.isChecked(),false);
 console.log('OK curseur stable : bord, icône, texte et cases du salon');
}finally{await browser.close()}
