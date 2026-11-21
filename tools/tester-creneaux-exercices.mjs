/* Régression du moteur historique : les anciennes données et la recherche
   complète restent disponibles même après la refonte du parcours visuel. */
import assert from 'node:assert/strict';import {createRequire} from 'node:module';import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE||'http://127.0.0.1:8533/';const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{ });
try{const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>r.request().url().startsWith(site)?r.continue():r.abort());await page.addInitScript(()=>window.__STUDYPLAN_E2E=true);await page.goto(site,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
 const slots=await page.evaluate(()=>{customEvents=[];generateDayEvents=()=>[{startTime:'06:00',endTime:'13:00'},{startTime:'13:20',endTime:'22:30'}];const exo={id:'regression',duration:180,deadline:exoDateLocale(new Date(Date.now()+14*86400000)),done:false};return findAvailableSlots(exo)});
 assert.ok(slots.length>0);assert.equal(slots[0].parts.reduce((sum,p)=>sum+p.duration,0),180);assert.ok(slots[0].parts.length>=7);assert.deepEqual(errors,[]);console.log('OK moteur de créneaux historique : durée complète répartie, jamais partielle.');await page.close();
}finally{await browser.close()}
