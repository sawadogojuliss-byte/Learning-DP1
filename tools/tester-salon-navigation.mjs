/* Retour au planning et reprise du salon, avec transport simulé. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const base=process.env.STUDY_SITE||'http://127.0.0.1:8651/';const id='a'.repeat(48);
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800},serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await page.addInitScript(id=>{window.__STUDYPLAN_E2E=true;let room;
  const session=()=>({id,uid:'host',role:'hote',maintenant:()=>Date.now(),observer(cb){queueMicrotask(()=>cb(room,{connecte:true}));return()=>{}},modifier:async()=>{},quitter:async()=>{},fermer:async()=>{}});
  window.SALON_FOCUS_TRANSPORT={creer:async data=>{room={...data,revision:1,ferme:false,organisateurUid:'host',membres:[{uid:'host',pseudo:'Hôte'}]};sessionStorage.setItem('testRoom',JSON.stringify(room));return session()},reprendre:async()=>{room=JSON.parse(sessionStorage.getItem('testRoom'));return session()},rejoindre:async()=>session()};
 },id);
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
 await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');userName='Élève';ibYear='DP1';window.__profilComplet=true;memoireSauvegarder();navigateTo('pomodoro');focusBasculerReglages();focusChoisirOnglet('salon')});
 await page.locator('#salonNom').fill('Révision');await page.locator('#salonCreer').click();await page.locator('.salon-lien-fermer').click();await page.waitForFunction(()=>document.querySelector('#salonEtatConnexion').textContent.includes('Connecté'));
 assert.equal(await page.evaluate(()=>location.hash),'#salon='+id);
 const historiqueAvant=await page.evaluate(()=>history.length);
 const ecritures=await page.evaluate(()=>{let n=0;const pousser=history.pushState, remplacer=history.replaceState;history.pushState=function(){n++;return pousser.apply(this,arguments)};history.replaceState=function(){n++;return remplacer.apply(this,arguments)};for(let i=0;i<5;i++)memoirePoserHash('pomodoro');history.pushState=pousser;history.replaceState=remplacer;return n});
 assert.equal(ecritures,0,'aucune réécriture répétée du fragment du salon');
 await page.waitForTimeout(5500);
 assert.equal(await page.evaluate(()=>history.length),historiqueAvant,'les sauvegardes périodiques ne doivent pas ajouter des entrées de salon');
 assert.equal(await page.evaluate(()=>location.hash),'#salon='+id);
 await page.locator('[onclick="salonMasquer()"]').click();await page.waitForFunction(()=>memoireEtapeActive()==='planning');await page.waitForTimeout(1800);
 assert.equal((await page.evaluate(()=>location.hash)).includes('salon='),false);assert.equal(await page.locator('#salonRaccourci').isVisible(),true);
 await page.locator('#salonRaccourci').click();assert.equal(await page.locator('#salonEcran').isVisible(),true);assert.equal(await page.evaluate(()=>location.hash),'#salon='+id);
 await page.locator('[onclick="salonMasquer()"]').click();await page.waitForFunction(()=>memoireEtapeActive()==='planning');await page.waitForTimeout(400);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000}).catch(async e=>{console.error('Diagnostic démarrage:',await page.evaluate(()=>({ready:window.__STUDYPLAN_READY,classes:document.body.className,etat:document.getElementById('bootStatus')?.textContent,hash:location.hash})),errors);throw e});
 await page.locator('#salonRaccourci').waitFor({state:'visible',timeout:15000});assert.equal(await page.evaluate(()=>memoireEtapeActive()),'planning');assert.equal((await page.evaluate(()=>location.hash)).includes('salon='),false);
 await page.locator('#salonRaccourci').click();await page.waitForFunction(()=>document.getElementById('salonEcran')&&!document.getElementById('salonEcran').hidden&&!document.getElementById('salonInvitation').open,{timeout:15000});
 assert.equal(await page.evaluate(()=>location.hash),'#salon='+id);assert.deepEqual(errors,[]);console.log('OK salon masqué, lien supprimé et reprise avant/après rechargement');
}finally{await browser.close()}
