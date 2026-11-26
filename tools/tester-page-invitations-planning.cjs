'use strict';
// Parcours local avec profils et séances fictifs ; aucun service distant ni e-mail.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require((process.env.STUDY_TEST_MODULES||'/home/user/studio-test/node_modules')+'/playwright');
const base=process.env.STUDY_SITE||'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch(process.env.STUDY_PLAYWRIGHT_SYSTEM?{headless:true}:{executablePath:process.env.STUDY_CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:width===390?600:800},serviceWorkers:'block',reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.route('**/*',r=>{const url=r.request().url();if(process.env.STUDY_NAVIGATION_FILE && url.startsWith(base+'js/pages/navigation.js'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(process.env.STUDY_NAVIGATION_FILE)});return url.startsWith(base)?r.continue():r.abort();});
   await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true});
   const ready=async()=>page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
   await page.goto(base,{waitUntil:'domcontentloaded'});await ready();
   await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');userName='Élève';ibYear='DP1';subjects=[];optionalSubjects=[];window.__profilComplet=true;memoireSauvegarder();document.querySelector('#salonsPlanifiesAnnonce').hidden=false;});
   await page.waitForFunction(()=>history.state?.etape==='planning');
   await page.click('#salonsPlanifiesAnnonce');await page.waitForFunction(()=>memoireEtapeActive()==='invitations'&&history.state?.etape==='invitations');
   assert.equal(await page.locator('#salonsPlanifiesBandeau').getAttribute('role'),null,'ceci est une page, pas une modale');
   assert.equal(await page.locator('#salonsPageTitre').isVisible(),true);
   assert.equal(await page.evaluate(()=>document.querySelector('#salonsPlanifiesBandeau').scrollWidth<=innerWidth),true,'aucun débordement horizontal');
   if(process.env.SALONS_PAGE_CAPTURE)await page.screenshot({path:process.env.SALONS_PAGE_CAPTURE+'-'+width+'.png'});
   await page.reload({waitUntil:'domcontentloaded'});await ready();await page.waitForFunction(()=>memoireEtapeActive()==='invitations',null,{timeout:15000});
   await page.goBack();await page.waitForFunction(()=>memoireEtapeActive()==='planning',null,{timeout:15000});
   await page.goForward();await page.waitForFunction(()=>memoireEtapeActive()==='invitations',null,{timeout:15000});
   await page.click('#salonsFermerAnnonces');await page.waitForFunction(()=>memoireEtapeActive()==='planning',null,{timeout:15000});
   // Le défilement reste dans le formulaire d'ajout, pas dans le planning.
   await page.evaluate(()=>{subjects=Array.from({length:8},(_,i)=>({name:'Matière '+i,icon:'📚',level:'HL',grade:5}));optionalSubjects=[];window.getSuggestedStartTime=()=> '17:00';document.getElementById('addEventModal').style.display='flex';selectAddType('matiere');});
   await page.locator('#subjectPickerGrid button').first().click();await page.waitForTimeout(250);
   const scroll=await page.evaluate(()=>{const modal=document.getElementById('addEventModal'),row=document.getElementById('studyTypeRow'),r=row.getBoundingClientRect(),m=modal.getBoundingClientRect();return {top:modal.scrollTop,row:r.top,bottom:r.bottom,visibleTop:m.top,visibleBottom:m.bottom,start:document.getElementById('studyStartInput').value,end:document.getElementById('studyEndInput').value};});
   assert.ok(scroll.row>=scroll.visibleTop-1&&scroll.bottom<=scroll.visibleBottom+1,'les options de session sont visibles');
   assert.equal(scroll.start,'17:00');assert.equal(scroll.end,'18:30');if(width===390)assert.ok(scroll.top>0,'le formulaire descend sur mobile');
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('ok invitations : page, historique, rechargement et défilement des matières sur mobile/ordinateur');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
