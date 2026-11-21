/* Un ancien cache contenant une vidéo complète ne doit pas intercepter Range. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE||'http://127.0.0.1:8524/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')} : {});
try {
 const page=await browser.newPage();
 await page.goto(site,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__STUDYPLAN_READY,{timeout:60000});
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>navigator.serviceWorker.controller,{timeout:30000});
 const result=await page.evaluate(async()=>{
  const url=new URL('images/pomodoro/chalet-neige-anime.mp4?v=20261107b',location.href).href;
  const cache=await caches.open('study-plan-test-video');
  await cache.put(url,new Response('donnee-obsolete',{headers:{'Content-Type':'video/mp4'}}));
  try {
   const res=await fetch(url,{headers:{Range:'bytes=0-511'}});
   const bytes=await res.arrayBuffer();
   return {status:res.status,size:bytes.byteLength,type:res.headers.get('content-type')};
  } finally {await caches.delete('study-plan-test-video')}
 });
 assert.ok([200,206].includes(result.status));assert.ok(result.size>=512);assert.match(result.type,/video\/mp4/i);
 console.log('OK cache et requête partielle vidéo :',result.status,result.size,'octets');
 if(site.startsWith('https:')) {
  const assembly=await page.evaluate(async()=>{
   const res=await fetch(new URL('videos/arbres-au-bord-de-leau-assemblage.mp4',location.href),{headers:{Range:'bytes=0-511'}});
   const reader=res.body.getReader();const chunk=await reader.read();await reader.cancel();
   return {status:res.status,type:res.headers.get('content-type'),signature:Array.from(chunk.value.slice(4,8))};
  });
  assert.ok([200,206].includes(assembly.status));assert.match(assembly.type,/video\/mp4/i);
  assert.deepEqual(assembly.signature,[102,116,121,112]);
  console.log('OK vidéo assemblée publique disponible');
 }

} finally {await browser.close()}
