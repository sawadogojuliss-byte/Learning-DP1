/* Chargement initial et actualisation : vraie progression des pages et scripts. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE||'http://127.0.0.1:8649/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
try {
 for (const reducedMotion of ['no-preference','reduce']) {
  const page=await browser.newPage({viewport:{width:1280,height:800},serviceWorkers:'block',reducedMotion});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true;});
  let nombre=0;
  await page.route('**/*',async route=>{
   const url=route.request().url();if(!url.startsWith(site))return route.abort();
   if(url.includes('/pages/')&&url.includes('.html')) {nombre++;await new Promise(r=>setTimeout(r,nombre%2?500:2200));}
   return route.continue();
  });
  for(let i=0;i<2;i++) {
   nombre=0;
   if(i)await page.reload({waitUntil:'domcontentloaded'});else await page.goto(site,{waitUntil:'domcontentloaded'});
   const jauge=page.locator('#boot-jauge');assert.equal(await jauge.isVisible(),true,'barre visible pendant le démarrage');
   assert.equal(await jauge.getAttribute('role'),'progressbar');
   const debut=Number(await jauge.getAttribute('aria-valuenow'));assert.ok(debut>=6&&debut<100);
   await page.waitForFunction(()=>{const b=document.getElementById('boot-jauge');const n=Number(b?.getAttribute('aria-valuenow'));return n>6&&n<100&&!b.closest('#boot-status').hidden;},null,{timeout:15000});
   const milieu=Number(await jauge.getAttribute('aria-valuenow'));assert.ok(milieu>debut&&milieu<100);
   await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
   assert.equal(Number(await jauge.getAttribute('aria-valuenow')),100,'toutes les étapes sont terminées');
   assert.equal(await jauge.isVisible(),false,'la barre disparaît à la fin');
  }
  assert.deepEqual(errors,[]);await page.close();console.log('OK barre initiale et actualisation : '+reducedMotion);
 }
 // Une page et un module manquants ne doivent ni bloquer la jauge, ni
 // laisser l'application sur un écran de chargement indéfini.
 const page=await browser.newPage({serviceWorkers:'block'});
 await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true;});
 await page.route('**/*',async route=>{
  const url=route.request().url();if(!url.startsWith(site))return route.abort();
  if(url.includes('/js/registre.js')){
   const response=await route.fetch();const body=await response.text();
   return route.fulfill({response,body:body+"\nwindow.STUDYPLAN_HTML.push('pages/absente-pour-test.html');window.STUDYPLAN_SCRIPTS.push('js/module-absent-pour-test.js');"});
  }
  return route.continue();
 });
 await page.goto(site,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
 assert.equal(await page.locator('#boot-jauge').getAttribute('aria-valuenow'),'100');
 assert.equal(await page.locator('#boot-jauge').isVisible(),false);
 assert.equal(await page.locator('.boot-modules-erreur').count(),1);
 await page.close();console.log('OK progression et démarrage en cas de ressources absentes');
}finally{await browser.close()}
