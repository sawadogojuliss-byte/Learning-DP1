/* Tests de bout en bout isolés, sans compte ni données utilisateur. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE||'http://127.0.0.1:8532/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{ });
async function boot(p){await p.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});await p.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');subjects=[{name:'Mathématiques',icon:'📚',level:'HL'}];optionalSubjects=[];navigateTo('exercices');switchExoTab('planifier')});}
const widths=[320,390,1280].filter(w=>!process.env.STUDY_TEST_WIDTH||w===Number(process.env.STUDY_TEST_WIDTH));
try{for(const width of widths){const page=await browser.newPage({viewport:{width,height:width===320?568:width===390?844:800},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>r.request().url().startsWith(site)?r.continue():r.abort());await page.addInitScript(()=>window.__STUDYPLAN_E2E=true);await page.goto(site,{waitUntil:'domcontentloaded'});await boot(page);
 await page.evaluate(()=>{
  customEvents=[{id:'autre',day:0,date:'2099-01-01',title:'Non lié',startTime:'08:00',endTime:'09:00'}];
  exercices=[{id:'exo-a',subject:'Mathématiques',subjectIcon:'📚',text:'Dérivées',duration:75,deadline:exoDateLocale(new Date(Date.now()+7*86400000)),done:false}, {id:'exo-b',subject:'Français',subjectIcon:'📚',text:'Lecture',duration:45,deadline:exoDateLocale(new Date(Date.now()+8*86400000)),done:false}, {id:'exo-c',subject:'Physique',subjectIcon:'📚',text:'Fait',duration:45,deadline:exoDateLocale(new Date(Date.now()+8*86400000)),done:true}];
  exoSauvegarder();v3Save();window.__originalGenerate=generateDayEvents;
  generateDayEvents=(day,date)=>[{id:'occupe-1',startTime:'06:00',endTime:'08:00'},{id:'occupe-2',startTime:'12:00',endTime:'22:30'}].concat(customEvents.filter(e=>e && e.date && date && e.date===exoDateLocale(date) && e.day===day && !e.deleted));
  switchExoTab('planifier');
 });
 assert.deepEqual(await page.locator('.ed-tabs button').evaluateAll(es=>es.map(e=>e.id)),['tabAjouter','tabPlanifier','tabListe']);
 assert.equal(await page.locator('.epn-exercice').count(),2);assert.doesNotMatch(await page.locator('#planifierContent').innerText(),/Résumé global|Physique/);
 if(process.env.STUDY_TEST_CAPTURE)await page.screenshot({path:`${process.env.STUDY_TEST_CAPTURE}/liste-${width}.png`});
 await page.locator('.epn-exercice').first().click();assert.match(await page.locator('#planifierContent').innerText(),/Comment veux-tu avancer/);
 // L'option automatique adapte la durée si les séances conseillées ne rentrent pas.
 await page.evaluate(()=>{window.__fakeGenerate=generateDayEvents;generateDayEvents=(day,date)=>[{startTime:'06:00',endTime:'13:00'},{startTime:'13:30',endTime:'22:30'}].concat(customEvents.filter(e=>e && e.date && date && e.date===exoDateLocale(date) && e.day===day && !e.deleted));});
 await page.locator('[data-exo-action=auto]').click();assert.match(await page.locator('.epn-results-head').innerText(),/3 séances de 25 min/);assert.ok(await page.locator('[data-exo-action=choisir]').count());
 await page.evaluate(()=>{generateDayEvents=()=>[{startTime:'06:00',endTime:'22:30'}]});await page.locator('[data-exo-action=auto]').click();assert.match(await page.locator('.epn-no-slot').innerText(),/Aucune proposition complète/);assert.equal(await page.evaluate(()=>customEvents.filter(e=>e.exoId==='exo-a').length),0);
 await page.evaluate(()=>{generateDayEvents=window.__fakeGenerate});
 await page.locator('#exoPlanNombre').fill('0');await page.locator('[data-exo-action=calcul]').click();assert.match(await page.locator('#exoPlanErreur').innerText(),/entre 1 et 8/);
 await page.locator('#exoPlanNombre').fill('3');await page.locator('#exoPlanMinutes').selectOption('25');await page.locator('[data-exo-action=calcul]').click();
 assert.match(await page.locator('.epn-results-head').innerText(),/3 séances de 25 min.*1 h 15 min/s);assert.equal(await page.locator('.epn-option').first().locator('.ed-slot-part').count(),3);
 assert.equal(await page.evaluate(()=>customEvents.filter(e=>e.exoId==='exo-a').length),0);
 if(process.env.STUDY_TEST_CAPTURE) {await page.locator('.epn-option').first().scrollIntoViewIfNeeded();await page.screenshot({path:`${process.env.STUDY_TEST_CAPTURE}/propositions-${width}.png`});}
 const before=await page.evaluate(()=>JSON.stringify(customEvents));
 // Invalider la proposition consultée : pas d'écriture ni remplacement silencieux.
 const first=await page.locator('[data-exo-action=choisir]').first().getAttribute('data-signature');
 await page.evaluate(sig=>{const [date,period]=sig.split('|')[0].split('@');const [startTime,endTime]=period.split('-');const d=exoLireDate(date);customEvents.push({id:'conflit-imprevu',date,day:(d.getDay()+6)%7,startTime,endTime,title:'Ajout imprévu'})},first);
 await page.locator('[data-exo-action=choisir]').first().click();assert.match(await page.locator('#exoPlanErreur').innerText(),/plus disponibles/);assert.equal(await page.evaluate(()=>customEvents.some(e=>e.exoId==='exo-a')),false);
 await page.evaluate(()=>customEvents=customEvents.filter(e=>e.id!=='conflit-imprevu'));assert.equal(await page.evaluate(()=>JSON.stringify(customEvents)),before);
 await page.locator('[data-exo-action=auto]').click();assert.match(await page.locator('.epn-results-head').innerText(),/Suggestion Studyplan.*1 séance de 37 min et 1 séance de 38 min.*1 h 15 min/s);
 await page.locator('[data-exo-action=choisir]').first().click();assert.match(await page.locator('.epn-success').innerText(),/enregistrées/);
 let state=await page.evaluate(()=>({exo:exercices[0],events:customEvents.filter(e=>e.exoId==='exo-a'),other:customEvents.some(e=>e.id==='autre')}));assert.equal(state.events.length,2);assert.equal(state.exo.duration,75);assert.equal(state.exo.planMinutes,75);assert.equal(state.other,true);
 assert.ok(state.events.every(e=>e.date && e.startTime && e.endTime && e.planVersion===state.exo.planVersion));
 await page.locator('#tabListe').click();await page.locator('#tabPlanifier').click();assert.equal(await page.locator('.epn-exercice').count(),2);await page.locator('.epn-exercice').first().click();
 await page.locator('#exoPlanNombre').fill('1');await page.locator('#exoPlanMinutes').selectOption('75');await page.locator('[data-exo-action=calcul]').click();await page.locator('[data-exo-action=choisir]').last().click();
 state=await page.evaluate(()=>({exo:exercices[0],events:customEvents.filter(e=>e.exoId==='exo-a'),other:customEvents.some(e=>e.id==='autre')}));assert.equal(state.events.length,1);assert.equal(state.exo.planMinutes,75);assert.equal(state.other,true);
 await page.reload({waitUntil:'domcontentloaded'});await boot(page);await page.locator('.epn-exercice').first().click();assert.equal(await page.locator('.ed-scheduled').count(),1);assert.equal(await page.evaluate(()=>exercices[0].planMinutes),75);
 const ancien='P1 7 novembre 13:30–13:55 · P2 9 novembre 17:35–18:00 (50/50 min)';await page.evaluate(s=>{exercices[0].scheduledSlot=s;renderPlanifier()},ancien);assert.equal(await page.locator('.ed-scheduled .ed-slot-part').count(),2);
 const attaque='<img src=x onerror="window.__injection=true"> ancien';await page.evaluate(s=>{exercices[0].scheduledSlot=s;renderPlanifier()},attaque);assert.equal(await page.locator('.ed-slot-fallback').innerText(),attaque);assert.equal(await page.evaluate(()=>!!window.__injection),false);
 assert.ok(await page.locator('#panelExercices').evaluate(e=>e.scrollWidth<=e.clientWidth+1));assert.deepEqual(errors,[]);console.log(`OK séances : choix, proposition auto, validation, conflits et persistance ${width}px`);await page.close();
}}finally{await browser.close()}
