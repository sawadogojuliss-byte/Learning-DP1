/* Sélection 4K / léger et repli sur défaillance, sans profils réels. */
import assert from 'node:assert/strict';import {createRequire} from 'node:module';import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE||'http://127.0.0.1:8528/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
try {
 for(const scenario of ['4k','echec-4k','lent','images-perdues']) {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  await page.route('**/*',r=>{
   const url=r.request().url();if(!url.startsWith(site))return r.abort();
   if(scenario==='echec-4k' && (url.includes('foret-automne-anime-4k.mp4')||url.includes('foret-automne-anime.mp4')))return r.fulfill({status:503,body:'indisponible'});
   return r.continue();
  });
  await page.addInitScript(scenario=>{
   window.__STUDYPLAN_E2E=true;Object.defineProperty(screen,'width',{value:3840,configurable:true});
   Object.defineProperty(navigator,'connection',{value:{downlink:scenario==='lent'?2:30,saveData:false},configurable:true});
   if(scenario==='images-perdues') {
    let n=0;HTMLVideoElement.prototype.getVideoPlaybackQuality=function(){n++;return {totalVideoFrames:n*100,droppedVideoFrames:n*45}};
   }
  },scenario);
  await page.goto(site,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
  await page.evaluate(()=>{document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusPoserFond(focusIndexParId('foret-automne-anime'))});
  if(scenario==='4k') {
   await page.waitForFunction(()=>{const v=document.querySelector('#focusBg video');return v&&v.currentSrc.includes('-4k.mp4')&&v.videoWidth===3840&&v.currentTime>.15&&!v.paused},null,{timeout:60000});
   const width=await page.locator('#focusBg video').evaluate(v=>v.videoWidth);assert.equal(width,3840);
  } else if(scenario==='images-perdues') {
   await page.waitForFunction(()=>{const v=document.querySelector('#focusBg video');return v&&v.currentSrc.includes('foret-automne-anime.mp4')&&v.currentTime>.1&&!v.paused},null,{timeout:60000});
  } else {
   await page.waitForFunction(()=>{const v=document.querySelector('#focusBg video');return v&&v.currentSrc.includes('-leger.mp4')&&v.currentTime>.1&&!v.paused},null,{timeout:60000});
  }
  console.log('OK forêt : '+scenario);await page.close();
 }
} finally {await browser.close()}
