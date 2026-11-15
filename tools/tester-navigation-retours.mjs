/* Historique réel et rechargement : aucune connexion distante nécessaire. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const base=process.env.STUDY_SITE||'http://127.0.0.1:8651/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
const ready=page=>page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800},serviceWorkers:'block'});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true});await page.goto(base,{waitUntil:'domcontentloaded'});await ready(page);
 await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');userName='Élève';ibYear='DP1';subjects=[];optionalSubjects=[];window.__profilComplet=true;memoireSauvegarder()});
 await page.waitForTimeout(300);
 for(const name of ['soutien','exercices','devoirs','emploi','legende','eeia','feries','seances','pomodoro','aide','feedback','annonce']) {
   await page.evaluate(name=>navigateTo(name),name);
   await page.waitForFunction(name=>memoireEtapeActive()===name && history.state?.etape===name,name,{timeout:15000});
   await page.reload({waitUntil:'domcontentloaded'});await ready(page);
   await page.waitForFunction(name=>memoireEtapeActive()===name,name,{timeout:15000});
   console.log('OK rechargement',name);
 }
 await page.evaluate(()=>navigateTo('planning'));await page.waitForFunction(()=>history.state?.etape==='planning');
 await page.evaluate(()=>navigateTo('aide'));await page.waitForFunction(()=>history.state?.etape==='aide');
 await page.evaluate(()=>navigateTo('feedback'));await page.waitForFunction(()=>history.state?.etape==='feedback');
 await page.reload({waitUntil:'domcontentloaded'});await ready(page);
 await page.locator('#panelFeedback button[onclick="memoireRetour()"]').click();await page.waitForFunction(()=>memoireEtapeActive()==='aide');
 await page.goForward();await page.waitForFunction(()=>memoireEtapeActive()==='feedback');
 await page.goBack();await page.waitForFunction(()=>memoireEtapeActive()==='aide');
 console.log('OK retour réel après rechargement, navigation arrière et avant');
 for(const [nom,id] of [['soutien','panelSoutien'],['exercices','panelExercices'],['devoirs','panelDevoirs'],['legende','panelLegende'],['eeia','panelEEia'],['feries','panelFeries'],['aide','panelAide'],['feedback','panelFeedback'],['annonce','panelAnnonce']]) {
   await page.evaluate(()=>navigateTo('soutien'));await page.waitForFunction(()=>history.state?.etape==='soutien');
   if(nom==='soutien') { await page.evaluate(()=>navigateTo('aide'));await page.waitForFunction(()=>history.state?.etape==='aide'); }
   await page.evaluate(nom=>navigateTo(nom),nom);await page.waitForFunction(nom=>history.state?.etape===nom,nom);
   await page.locator('#'+id+' button[onclick="memoireRetour()"]').first().click();
   await page.waitForFunction(prec=>memoireEtapeActive()===prec,nom==='soutien'?'aide':'soutien');
   console.log('OK bouton retour',nom);
 }
 assert.deepEqual(errors,[]);await page.close();
 const inscription=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 const erreursInscription=[];inscription.on('pageerror',e=>erreursInscription.push(String(e)));await inscription.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await inscription.addInitScript(()=>{window.__STUDYPLAN_E2E=true});
 await inscription.goto(base,{waitUntil:'domcontentloaded'});await ready(inscription);
 await inscription.evaluate(()=>openContextModal());await inscription.locator('#nameInput').fill('Camille');await inscription.locator('#contextModal .btn-continue').click();await inscription.waitForFunction(()=>memoireEtapeActive()==='classe');
 await inscription.evaluate(()=>setIbYear('DP1'));await inscription.locator('#classeContinueBtn').click();await inscription.waitForFunction(()=>memoireEtapeActive()==='objectif');
 await inscription.reload({waitUntil:'domcontentloaded'});await ready(inscription);assert.equal(await inscription.evaluate(()=>memoireEtapeActive()),'objectif');
 await inscription.locator('#objectivesModal .btn-back').click();assert.equal(await inscription.evaluate(()=>memoireEtapeActive()),'classe');await inscription.locator('#classeModal .btn-back').click();assert.equal(await inscription.evaluate(()=>memoireEtapeActive()),'prenom');
 assert.deepEqual(erreursInscription,[]);await inscription.close();console.log('OK inscription : objectif conservé et retours classe puis prénom');
}finally{await browser.close()}
