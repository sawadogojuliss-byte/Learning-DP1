/* Vérifie les créneaux répartis et anciens, avec un planning fictif. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE || 'http://127.0.0.1:8510/';
const browser=await chromium.launch(portable ? {executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')} : {});
async function boot(page) {
  await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
  await page.evaluate(()=>{
    document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));
    document.getElementById('planningModal').classList.add('active');
    subjects=[{name:'Mathématiques',icon:'📚',level:'HL'}]; optionalSubjects=[];
  });
}
try {
  for (const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]) {
    const context=await browser.newContext({viewport}); const page=await context.newPage(); const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.route('**/*',r=>r.request().url().startsWith(site)?r.continue():r.abort());
    await page.addInitScript(()=>window.__STUDYPLAN_E2E=true);
    await page.goto(site,{waitUntil:'domcontentloaded'}); await boot(page);
    await page.evaluate(()=>{
      customEvents=[{id:'autre-evenement',day:0,date:'2099-01-01',title:'Non lié',startTime:'08:00',endTime:'09:00'}];
      exercices=[{id:'exo-test-multiple',subject:'Mathématiques',subjectIcon:'📚',text:'Travail long',duration:180,deadline:exoDateLocale(new Date(Date.now()+14*86400000)),done:false,scheduledSlot:null}];
      exoSauvegarder();
      // Deux occupations par jour ne laissent qu'une plage de 20 minutes.
      generateDayEvents=()=>[{startTime:'06:00',endTime:'13:00'},{startTime:'13:20',endTime:'22:30'}];
      navigateTo('exercices'); switchExoTab('planifier');
    });
    const card=page.locator('.ed-slot-details').first();
    if (!await page.locator('.ed-slot-details').count()) console.log('Diagnostic',await page.evaluate(()=>({exo:exercices[0], generated:findAvailableSlots(exercices[0]), html:document.querySelector('#planifierContent').innerText})));
    assert.ok(await page.locator('.ed-slot-details').count()>0);
    assert.equal(await card.locator('.ed-slot-part').first().isVisible(),false);
    assert.match(await card.locator('summary').innerText(),/séances.*180 min au total/);
    await card.locator('summary').click();
    const parts=await card.locator('.ed-slot-part').allTextContents();
    assert.ok(parts.length>=7,`au moins 7 parties attendues : ${parts.length}`);
    if(process.env.STUDY_TEST_CAPTURE) { await card.scrollIntoViewIfNeeded(); await page.screenshot({path:`${process.env.STUDY_TEST_CAPTURE}/creneaux-proposition-${viewport.width}.png`}); }
    await card.locator('[data-exo-action=creneau]').click();
    const state=await page.evaluate(()=>({exo:exercices[0],events:customEvents.filter(e=>e.exoId===exercices[0].id),other:customEvents.some(e=>e.id==='autre-evenement')}));
    assert.ok(state.exo.scheduledSlot); assert.equal(state.events.length,parts.length); assert.equal(state.other,true);
    assert.equal(state.events.reduce((sum,e)=>sum+(Number(e.endTime.slice(0,2))*60+Number(e.endTime.slice(3)))-(Number(e.startTime.slice(0,2))*60+Number(e.startTime.slice(3))),0),180);
    const savedParts=page.locator('.ed-scheduled .ed-slot-part');
    assert.equal(await savedParts.count(),parts.length);
    assert.match(await page.locator('.ed-scheduled').innerText(),/Exercice planifié/);
    assert.match(await page.locator('.ed-scheduled').innerText(),/180 min au total/);
    assert.deepEqual(await savedParts.allTextContents(),parts);
    assert.ok(await page.locator('.ed-slot-details').count()>0);
    assert.equal(await page.locator('.ed-slot-details summary').first().innerText().then(t=>t.includes('Proposition 1')),true);
    assert.ok(await page.locator('#panelExercices').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
    if(process.env.STUDY_TEST_CAPTURE) { await page.locator('.ed-scheduled').scrollIntoViewIfNeeded(); await page.screenshot({path:`${process.env.STUDY_TEST_CAPTURE}/creneaux-planifie-${viewport.width}.png`}); }
    // Replanifier une autre proposition conserve l'événement non lié.
    const autre=page.locator('.ed-slot-details').first(); await autre.locator('summary').click(); await autre.locator('[data-exo-action=creneau]').click();
    const replan=await page.evaluate(()=>({exo:exercices[0],events:customEvents.filter(e=>e.exoId===exercices[0].id),other:customEvents.some(e=>e.id==='autre-evenement')}));
    assert.notEqual(replan.exo.scheduledSlot,state.exo.scheduledSlot); assert.equal(replan.other,true);
    assert.equal(new Set(replan.events.map(e=>e.planVersion)).size,1); assert.equal(replan.events[0].planVersion,replan.exo.planVersion);
    await page.reload({waitUntil:'domcontentloaded'}); await boot(page);
    await page.evaluate(()=>{navigateTo('exercices');switchExoTab('planifier')});
    assert.ok(await page.locator('.ed-scheduled .ed-slot-part').count()>=7);
    assert.equal(await page.evaluate(()=>exercices[0].scheduledSlot),replan.exo.scheduledSlot);
    // Libellé ancien semblable à celui de la capture, puis format inconnu :
    // les deux doivent être affichés sans changer la chaîne enregistrée.
    const ancien='P1 7 novembre 13:30–13:55 · P2 9 novembre 17:35–18:00 · P3 11 novembre 06:40–06:55 · P4 14 novembre 06:10–07:00 · P5 14 novembre 13:30–13:55 · P6 16 novembre 17:35–18:00 · P7 18 novembre 06:40–06:55 (180/180 min)';
    await page.evaluate(label=>{exercices[0].scheduledSlot=label;renderPlanifier()},ancien);
    assert.equal(await page.locator('.ed-scheduled .ed-slot-part').count(),7);
    assert.match(await page.locator('.ed-scheduled').innerText(),/14 novembre/);
    assert.equal(await page.evaluate(()=>exercices[0].scheduledSlot),ancien);
    const etrange='<img src=x onerror="window.__injection=true"> · ancien format';
    await page.evaluate(label=>{exercices[0].scheduledSlot=label;renderPlanifier()},etrange);
    assert.equal(await page.locator('.ed-slot-fallback').innerText(),etrange);
    assert.equal(await page.evaluate(()=>!!window.__injection),false);
    assert.deepEqual(errors,[]); console.log(`OK créneaux répartis, anciennes données et replanification ${viewport.width}×${viewport.height}`);
    await context.close();
  }
} finally {await browser.close();}
