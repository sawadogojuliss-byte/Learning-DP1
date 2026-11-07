/* Navigation et lecture des décors animés avec des profils fictifs. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE || 'http://127.0.0.1:8520/';
const browser=await chromium.launch(portable ? {executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')} : {});
const themes=[{id:'chalet-neige-anime',nom:'Chalet sous la neige'},{id:'dunes-lagunes-anime',nom:'Dunes et lagunes'},{id:'pluie-palmes-anime',nom:'Pluie sur les palmes'}];
try {
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]) {
  const page=await browser.newPage({viewport});const erreurs=[];page.on('pageerror',e=>erreurs.push(String(e)));
  await page.route('**/*',r=>r.request().url().startsWith(site)?r.continue():r.abort());
  await page.addInitScript(()=>window.__STUDYPLAN_E2E=true);
  await page.goto(site,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
  await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerReglages();focusChoisirOnglet('themes')});
  assert.equal(await page.locator('#focusReglages').isVisible(),true);
  const section=page.locator('#focusThemesCorps .focus-rangee').last();
  assert.equal(await section.locator('h4').innerText(),'Animé');
  assert.deepEqual(await section.locator('.focus-tuile-theme .focus-tuile-nom').allTextContents(),themes.map(t=>t.nom));
  for(const item of themes) {
   const tuile=section.locator('.focus-tuile-theme').filter({hasText:item.nom});await tuile.click();
   const video=page.locator('#focusBg video');
   await page.waitForFunction(id=>{const v=document.querySelector('#focusBg video');return v&&v.currentSrc.includes(id+'.mp4')&&v.readyState>=2&&!v.paused&&v.currentTime>.1&&v.classList.contains('is-visible')},item.id,{timeout:30000});
   const state=await video.evaluate(v=>({loop:v.loop,muted:v.muted,inline:v.playsInline,duration:v.duration,time:v.currentTime}));
   assert.equal(state.loop,true);assert.equal(state.muted,true);assert.equal(state.inline,true);assert.ok(state.duration>3);
   await page.waitForTimeout(550);assert.ok(await video.evaluate(v=>v.currentTime)>state.time);
   await video.evaluate(v=>{v.currentTime=v.duration-.4});
   await page.waitForFunction(()=>{const v=document.querySelector('#focusBg video');return v&&v.currentTime<2&&!v.paused},{timeout:15000});
   if (item.id==='pluie-palmes-anime') {
    // Observer deux boucles consécutives à vitesse normale, sans avancer le temps.
    const loopCheck=await video.evaluate(v=>new Promise((resolve,reject)=>{
     let wraps=0,last=v.currentTime,start=performance.now(), samples=0;
     const timer=setInterval(()=>{
      if(v.paused||v.ended){clearInterval(timer);reject(new Error('lecture interrompue'));return;}
      const t=v.currentTime;samples++;
      if(last>v.duration-0.6&&t<0.6) wraps++;
      last=t;
      if(wraps===2){clearInterval(timer);resolve({wraps,samples,elapsed:performance.now()-start})}
      else if(performance.now()-start>13000){clearInterval(timer);reject(new Error('boucles non détectées'))}
     },100);
    }));
    assert.equal(loopCheck.wraps,2);assert.ok(loopCheck.samples>30);
   }
   assert.equal(await tuile.getAttribute('aria-pressed'),'true');
  }
  await page.locator('#focusFiltresFonds [data-cat="anime"]').click();
  assert.equal(await page.locator('#focusThemesCorps .focus-grille-fonds .focus-tuile-theme').count(),3);
  await page.evaluate(()=>focusPoserFond(focusIndexParId('lumiere')));assert.equal(await page.locator('#focusBg video').count(),0);
  await page.waitForFunction(()=>document.querySelector('#focusBg').style.backgroundImage.includes('lumiere.webp'));
  await page.evaluate(()=>focusPoserFond(focusIndexParId('pluie-palmes-anime')));
  await page.waitForFunction(()=>document.querySelector('#focusBg video')?.currentTime>.1,{timeout:30000});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
  await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro')});
  assert.equal(await page.evaluate(()=>FOCUS_FONDS[focusEtat.fond].id),'pluie-palmes-anime');
  await page.waitForFunction(()=>document.querySelector('#focusBg video')?.currentTime>.1,{timeout:30000});
  await page.evaluate(()=>navigateTo('seances'));
  await page.waitForFunction(()=>!document.querySelector('#focusBg video')&&document.querySelector('#focusAccueilFond video')?.currentSrc.includes('pluie-palmes-anime.mp4'));
  await page.evaluate(()=>navigateTo('exercices'));await page.waitForFunction(()=>!document.querySelector('#focusAccueilFond video')&&!document.querySelector('#focusBg video'));
  assert.deepEqual(erreurs,[]);console.log('OK trois thèmes animés, lecture, boucles, restauration et navigation : '+viewport.width+'×'+viewport.height);await page.close();
 }
} finally {await browser.close()}
