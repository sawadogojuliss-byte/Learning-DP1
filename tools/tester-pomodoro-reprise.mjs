/* Simule le refus d'autoplay et une erreur réseau, puis teste le bouton de reprise. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE||'http://127.0.0.1:8524/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')} : {});
try {
 for (const mode of ['autoplay','network']) {
  const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});
  const page=await context.newPage();
  let refus=0;
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(!url.startsWith(site)) return route.abort();
   if(mode==='network' && url.includes('chalet-neige-anime.mp4') && !refus++) return route.fulfill({status:503,body:'temporairement indisponible'});
   return route.continue();
  });
  if(mode==='autoplay') await page.addInitScript(()=>{
   const original=HTMLMediaElement.prototype.play;
   let refuse=true;
   HTMLMediaElement.prototype.play=function(){if(refuse && this.tagName==='VIDEO'){refuse=false;this.autoplay=false;return Promise.reject(new DOMException('Lecture bloquée','NotAllowedError'))}return original.apply(this,arguments)};
  });
  await page.addInitScript(()=>window.__STUDYPLAN_E2E=true);
  await page.goto(site,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
  await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusPoserFond(focusIndexParId('chalet-neige-anime'))});
  const video=page.locator('#focusBg video');
  const aide=page.locator('#panelPomodoro .focus-video-reessayer');
  await aide.waitFor({state:'visible',timeout:30000});
  assert.equal(await video.evaluate(v=>getComputedStyle(v).visibility),'visible');
  await aide.click();
  await page.waitForFunction(()=>{const v=document.querySelector('#focusBg video');return v&&!v.paused&&v.currentTime>.2&&v.classList.contains('is-visible')},{timeout:30000});
  await aide.waitFor({state:'detached'});
  await page.evaluate(()=>focusPoserFond(focusIndexParId('lumiere')));
  assert.equal(await page.locator('#panelPomodoro .focus-video-reessayer').count(),0);
  console.log('OK reprise du décor après '+mode);
  await context.close();
 }
} finally {await browser.close()}
