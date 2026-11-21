/* Sans données personnelles : transport Firestore simulé et rendu admin. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE||'http://127.0.0.1:8526/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nm6cAAAAASUVORK5CYII=','base64');
try {
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]) {
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',r=>r.request().url().startsWith(site)?r.continue():r.abort());
  await page.addInitScript(()=>window.__STUDYPLAN_E2E=true);
  await page.goto(site,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
  await page.evaluate(()=>{
   document.getElementById('planningModal').classList.add('active');
   window.__docs=[];window.__fail=false;
   boiteEcrireBoite=function(r){if(window.__fail)return Promise.reject(new Error('hors-ligne'));window.__docs.push({type:r.type,data:boiteMessagePourFirestore(r)});return Promise.resolve(true)};
  });
  for(const type of ['feedback','aide']) {
   await page.evaluate(t=>navigateTo(t),type);
   const prefix='#'+type+'Images';const input=page.locator(prefix+' input');
   await input.setInputFiles([{name:'capture.png',mimeType:'image/png',buffer:pixel},{name:'autre.png',mimeType:'image/png',buffer:pixel}]);
   await page.waitForFunction(t=>document.querySelectorAll('#'+t+'Images .boite-images-apercu').length===2,type);
   assert.equal(await page.locator(prefix+' .boite-images-apercu').count(),2);
   await input.setInputFiles({name:'troisieme.png',mimeType:'image/png',buffer:pixel});
   assert.match(await page.locator(prefix+' .boite-images-statut').innerText(),/deux images maximum/);
   await page.locator(prefix+' .boite-images-apercu button').first().click();assert.equal(await page.locator(prefix+' .boite-images-apercu').count(),1);
   await page.locator('#'+type+'Email').fill('eleve@example.org');await page.locator('#'+type+'Texte').fill('Un message de test avec image.');
   await page.evaluate(()=>window.__fail=true);await page.locator('#'+type+'Envoi').click();await page.waitForFunction(t=>document.getElementById(t+'Statut').textContent.includes('pas abouti'),type);
   assert.equal(await page.locator(prefix+' .boite-images-apercu').count(),1);assert.equal(await page.locator('#'+type+'Texte').inputValue(),'Un message de test avec image.');
   await page.evaluate(()=>window.__fail=false);await page.locator('#'+type+'Envoi').click();
   await page.waitForFunction(t=>document.getElementById(t+'Statut').textContent.includes('envoyé'),type);
   assert.equal(await page.locator(prefix+' .boite-images-apercu').count(),0);assert.equal(await page.locator('#'+type+'Texte').inputValue(),'');
   const received=await page.evaluate(t=>{
    const doc=window.__docs.find(d=>d.type===(t==='aide'?'question':'feedback'));const champ=t==='aide'?'04_question':'04_feedback';
    const item=boiteMessageDepuisFirestore(t==='aide'?'questions':'feedbacks',doc.data,'faux-doc');
    let html=t==='aide'?boiteCarteQuestion(item,[]):boiteCarte('Suggestion','',boiteEchap(item.texte),item.images);
    const box=document.createElement('div');box.innerHTML=html;
    return {text:item.texte,n:item.images.length,src:item.images[0],htmlImages:box.querySelectorAll('.boite-images-recues img').length,href:box.querySelector('.boite-images-recues a')?.getAttribute('href'),stored:doc.data[champ],otherKeys:Object.keys(doc.data)};
   },type);
   assert.equal(received.text,'Un message de test avec image.');assert.equal(received.n,1);assert.equal(received.htmlImages,1);assert.match(received.src,/^data:image\/jpeg;base64,/);assert.equal(received.href,received.src);
   assert.ok(received.stored.length<210000);assert.equal(received.otherKeys.includes('images'),false);
  }
  const injection=await page.evaluate(()=>{
   const f=boiteImagesDecoder('[studyplan-images-v1]\\n'+JSON.stringify({texte:'essai',images:['data:image/jpeg;base64,AAA\" onerror=alert(1)']}));
   return {images:f.images.length,html:boiteImagesAdmin(['data:image/jpeg;base64,AAA\" onerror=alert(1)'])};
  });assert.equal(injection.images,0);assert.equal(injection.html,'');
  assert.deepEqual(errors,[]);console.log('OK aide et feedback : pièces jointes, échec, réception admin simulée et sécurité '+viewport.width+'×'+viewport.height);await page.close();
 }
} finally {await browser.close()}
