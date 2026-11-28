'use strict';
const assert=require('node:assert/strict');
const {chromium}=require((process.env.STUDY_TEST_MODULES||'/home/user/studio-test/node_modules')+'/playwright');
const site=process.env.STUDY_SITE||'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch(process.env.STUDY_PLAYWRIGHT_SYSTEM?{headless:true}:{executablePath:process.env.STUDY_CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 try {for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
  const page=await browser.newPage({viewport,serviceWorkers:'block'});
  await page.route('**/*',r=>r.request().url().startsWith(site)?r.continue():r.abort());
  await page.addInitScript(()=>window.__STUDYPLAN_E2E=true);
  await page.goto(site,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
  await page.evaluate(()=>{const d=document.createElement('div');d.id='essai-champs';d.style.cssText='position:fixed;z-index:99999;top:10px;left:10px;background:white;padding:10px';d.innerHTML='<input type="text"><input type="email"><input type="search"><input type="number"><textarea></textarea><div contenteditable="true">Texte</div><input type="checkbox">';document.body.appendChild(d)});
  for(const selecteur of ['input[type=text]','input[type=email]','input[type=search]','input[type=number]','textarea','[contenteditable]']){
   const champ=page.locator('#essai-champs '+selecteur);await champ.focus();
   const styles=await champ.evaluate(e=>{const s=getComputedStyle(e);return {outline:s.outlineColor,style:s.outlineStyle,caret:s.caretColor,cursor:s.cursor,selection:s.userSelect,box:s.boxShadow}});
   assert.equal(styles.style,'solid',selecteur);assert.equal(styles.outline,'rgb(4, 120, 87)',selecteur);assert.equal(styles.caret,'rgb(4, 120, 87)',selecteur);assert.equal(styles.cursor,'text',selecteur);assert.equal(styles.selection,'text',selecteur);assert.equal(styles.box,'none',selecteur);
  }
  assert.notEqual(await page.locator('#essai-champs input[type=checkbox]').evaluate(e=>getComputedStyle(e).cursor),'text','les cases restent des commandes');
  await page.evaluate(()=>{document.getElementById('essai-champs').remove();document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerTaches();});
  const tache=page.locator('#focusNouvelle');await tache.focus();
  const style=await tache.evaluate(e=>{const s=getComputedStyle(e);return {outline:s.outlineColor,caret:s.caretColor,cursor:s.cursor,select:s.userSelect}});
  assert.deepEqual(style,{outline:'rgb(110, 231, 183)',caret:'rgb(167, 243, 208)',cursor:'text',select:'text'});
  await page.evaluate(()=>{const form=document.createElement('form');form.id='salonsPlanifiesForm';form.innerHTML='<div id="essai-recherche" class="salons-recherche"><input type="search"></div>';document.body.appendChild(form)});
  await page.locator('#essai-recherche input').focus();
  assert.equal(await page.locator('#essai-recherche input').evaluate(e=>getComputedStyle(e).outlineStyle),'none','pas de cadre blanc intérieur');
  assert.equal(await page.locator('#essai-recherche').evaluate(e=>getComputedStyle(e).outlineColor),'rgb(143, 240, 178)','cadre vert sur la recherche entière');
  await page.close();console.log('OK champs verts, curseur lisible et recherche '+viewport.width+'×'+viewport.height);
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
