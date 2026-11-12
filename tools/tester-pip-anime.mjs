/* Vérifie les deux mini-fenêtres, leurs vidéos et le retour aux images fixes. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE||'http://127.0.0.1:8520/';
const browser=await chromium.launch(portable ? {executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')} : {});
try {
 for (const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]) {
  const page=await browser.newPage({viewport}); const erreurs=[];page.on('pageerror',e=>erreurs.push(String(e)));
  await page.addInitScript(()=>window.__STUDYPLAN_E2E=true);
  await page.goto(site,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
  await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusPoserFond(focusIndexParId('pluie-palmes-anime'));focusOuvrirPipLocal()});
  const video=page.locator('#focusPipScene .pip-video');
  await page.waitForFunction(()=>{const v=document.querySelector('#focusPipScene .pip-video');return v&&v.currentTime>.1&&!v.paused&&v.readyState>=2},{timeout:30000});
  let state=await video.evaluate(v=>({muted:v.muted,loop:v.loop,inline:v.playsInline,t:v.currentTime,src:v.currentSrc}));
  assert.ok(state.muted&&state.loop&&state.inline);assert.match(state.src,/pluie-palmes-anime/);
  const sample=await video.evaluate(v=>{const c=document.createElement('canvas');c.width=160;c.height=90;c.getContext('2d').drawImage(v,0,0,160,90);return Array.from(c.getContext('2d').getImageData(0,0,160,90).data)});
  await page.waitForTimeout(900);
  assert.notEqual(await video.evaluate(v=>v.currentTime),state.t);
  let delta=0;
  for(let essais=0;essais<6 && delta<=.1;essais++) {
  if(essais) await page.waitForTimeout(500);
  delta=await video.evaluate((v,a)=>{const c=document.createElement('canvas');c.width=160;c.height=90;const x=c.getContext('2d');x.drawImage(v,0,0,160,90);const b=x.getImageData(0,0,160,90).data;let d=0;for(let i=0;i<b.length;i+=4)d+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);return d/(160*90*3)},sample);
  }
  assert.ok(delta>.1,'les images changent réellement : '+delta);
  await page.locator('#focusPipPlay').click();assert.equal(await page.evaluate(()=>focusEtat.running),true);
  await page.locator('#focusPipPlay').click();assert.equal(await page.evaluate(()=>focusEtat.running),false);
  await page.evaluate(()=>focusPoserFond(focusIndexParId('lumiere')));assert.equal(await video.count(),0);
  await page.evaluate(()=>focusPoserFond(focusIndexParId('arbres-rivage-anime')));
  await page.waitForFunction(()=>document.querySelector('#focusPipScene .pip-video')?.currentSrc.includes('arbres-rivage-anime'),{timeout:30000});
  // Un refus de lecture affiche une action qui permet de réessayer.
  await page.evaluate(()=>{focusFermerPip();window.__playOriginal=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.classList.contains('pip-video')) return Promise.reject(new DOMException('Bloqué','NotAllowedError'));return window.__playOriginal.call(this)};focusOuvrirPipLocal()});
  await page.locator('#focusPipScene .pip-video-reessayer').waitFor();
  await page.evaluate(()=>{HTMLMediaElement.prototype.play=window.__playOriginal});
  await page.locator('#focusPipScene .pip-video-reessayer').click();
  await page.waitForFunction(()=>{const v=document.querySelector('#focusPipScene .pip-video');return v && !v.paused && v.readyState>=2},{timeout:30000});
  await page.waitForFunction(()=>!document.querySelector('#focusPipScene .pip-video-reessayer'));
  // Le lecteur local s'arrête si l'onglet est masqué puis reprend au retour.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
  assert.equal(await video.count(),0);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});
  await page.waitForFunction(()=>document.querySelector('#focusPipScene .pip-video')?.currentTime>.1,{timeout:30000});
  await page.evaluate(()=>{focusFermerPip();focusPoserFond(focusIndexParId('pluie-palmes-anime'))});assert.equal(await video.count(),0);
  await page.waitForFunction(()=>document.querySelector('#focusBg video')?.currentTime>.1,{timeout:30000});
  // Quand Chromium expose Document PiP, utiliser la vraie API avec un clic.
  if (await page.evaluate(()=>!!window.documentPictureInPicture?.requestWindow)) {
  const popupPromise=page.waitForEvent('popup');await page.locator('#focusBtnPip').click();const popup=await popupPromise;
  await popup.waitForFunction(()=>document.querySelector('#pipScene video')?.currentTime>.1,{timeout:30000});
  const ext=popup.locator('#pipScene video');state=await ext.evaluate(v=>({muted:v.muted,loop:v.loop,src:v.currentSrc,t:v.currentTime}));assert.ok(state.muted&&state.loop);assert.match(state.src,/pluie-palmes-anime/);
  await page.waitForTimeout(700);assert.notEqual(await ext.evaluate(v=>v.currentTime),state.t);
  await popup.locator('#pipPlay').click();assert.equal(await page.evaluate(()=>focusEtat.running),true);
  await popup.locator('#pipPlay').click();assert.equal(await page.evaluate(()=>focusEtat.running),false);
  await page.evaluate(()=>focusPoserFond(focusIndexParId('lumiere')));assert.equal(await ext.count(),0);
  await page.evaluate(()=>focusPoserFond(focusIndexParId('arbres-rivage-anime')));
  await popup.waitForFunction(()=>document.querySelector('#pipScene video')?.currentSrc.includes('arbres-rivage-anime'),{timeout:30000});
  await popup.close();await page.waitForFunction(()=>!focusPip);
  } else console.log('Document PiP non disponible dans ce navigateur de test');
  assert.deepEqual(erreurs,[]);console.log(`OK mini-fenêtres animées et commandes ${viewport.width}×${viewport.height}`);await page.close();
 }
} finally {await browser.close()}
