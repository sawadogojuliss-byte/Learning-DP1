/* Parcours fictif : import automatique, édition datée et fin singulière. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE||'http://127.0.0.1:8683/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{ });
try {
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>r.request().url().startsWith(site)?r.continue():r.abort());
 await page.clock.install({time:new Date('2031-06-15T10:00:00')});await page.addInitScript(()=>window.__STUDYPLAN_E2E=true);
 await page.goto(site,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
 const result=await page.evaluate(()=>{
  userName='Test';ibYear='DP1';window.__profilComplet=true;subjects=[{name:'Physique',level:'HL',icon:'⚛️',grade:4}];optionalSubjects=[];
  let st=devoirsLireStore();st.bac=true;st.bacDemande=2;st.examens=[];st.devoirs=[];devoirsEcrireStore(st);
  devoirsImporterLecture([{matiere:'Physique',date:'2031-06-23',debut:'08:00',fin:'10:00'},{matiere:'Chimie',date:'',debut:'08:00',fin:'09:00'}],'examens');
  devoirsImporterLecture([{matiere:'Physique',date:'2031-06-23',debut:'08:00',fin:'10:00'}],'examens');
  devoirsImporterLecture([{matiere:'Chimie',date:'2031-06-24',debut:'',fin:'',plageSession:['11:00','13:00'],indice:'Plage de session'}],'examens');
  return {examens:devoirsLireStore().examens, modal:!!document.querySelector('#seancesQuestionModal'), confirmations:document.querySelectorAll('#devoirsConfirmation button').length, message:document.getElementById('exaOcrStatut').textContent};
 });
 assert.equal(result.examens.length,2);assert.equal(result.examens[1].debut,'11:00');assert.match(result.message,/plages de session/);assert.equal(result.examens[0].date,'2031-06-23');assert.equal(result.examens[0].debut,'08:00');assert.equal(result.modal,false);assert.equal(result.confirmations,0);
 await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('planning');selectedDay=5;planningDecalageSemaine=1;emploiFige=null;renderPlanning();});
 await page.evaluate(()=>{buildSubjectPicker()});
 assert.doesNotMatch(await page.locator('#subjectPickerGrid').innerText(),/\d+\s*\/\s*[47]/);assert.match(await page.locator('#subjectPickerGrid').innerText(),/Bac national/);
 const bacIndex=await page.evaluate(()=>Array.from(document.querySelectorAll('#subjectPickerGrid button')).findIndex(b=>b.textContent.includes('Bac national')));
 await page.evaluate(i=>pickSubject(i),bacIndex);assert.equal(await page.evaluate(()=>newEventSelectedSubject.name),'Bac national');
 const edit=page.locator('#editEventModal');
 const reveil=page.locator('#eventsContainer [data-v3-idx]').filter({hasText:'Réveil'});await reveil.click();await edit.waitFor({state:'visible'});
 assert.equal(await page.locator('#editEventTitle').getAttribute('readonly'),'');
 await page.locator('#editEventStart').fill('06:30');await page.locator('#editEventEnd').fill('06:40');await page.locator('#editSaveButton').click();assert.equal(await edit.isVisible(),false);
 assert.equal(await page.evaluate(()=>v3LastRendered.find(e=>e.id==='wakeup').startTime),'06:30');
 const bac=page.locator('#eventsContainer [data-v3-idx]').filter({hasText:'Bac national'}).first();await bac.click();await edit.waitFor({state:'visible'});
 assert.equal(await page.locator('#editEventTitle').inputValue(),'Bac national');
 // Modifier l’horaire du bac lui-même, pas seulement le titre.
 await page.locator('#editEventTitle').fill('Bac national personnalisé');await page.locator('#editEventEnd').fill('12:45');await page.locator('#editSaveButton').click();
 assert.equal(await edit.isVisible(),false,await page.locator('#editTimeError').innerText());
 assert.ok(await page.evaluate(()=>v3LastRendered.some(e=>e.title==='Bac national personnalisé')));
 const events=await page.evaluate(()=>({date:planningCleDate(planningDateSelectionnee(5)),custom:customEvents.filter(e=>e.date===planningCleDate(planningDateSelectionnee(5))),next:generateDayEvents(5,new Date('2031-06-28T12:00:00')).find(e=>e.id==='wakeup').startTime}));
 assert.equal(events.date,'2031-06-21');assert.equal(events.next,'07:00');assert.ok(events.custom.some(e=>e.replacesId==='wakeup'));
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
 const apres=await page.evaluate(()=>({wake:generateDayEvents(5,new Date('2031-06-21T12:00:00')).find(e=>e.id==='wakeup').startTime,bac:generateDayEvents(5,new Date('2031-06-21T12:00:00')).find(e=>e.id==='bac-samedi')?.title,finBac:generateDayEvents(5,new Date('2031-06-21T12:00:00')).find(e=>e.id==='bac-samedi')?.endTime,exams:devoirsLireStore().examens.length}));
 assert.deepEqual(apres,{wake:'06:30',bac:'Bac national personnalisé',finBac:'12:45',exams:2});
 const voix=await page.evaluate(async()=>{const original=chronoLancerAnnonce;let calls=[];chronoLancerAnnonce=(n,t,p,done)=>{calls.push({n,t,p});if(done)done()};try{focusEtat.objectif=1;focusTerminerSerie(false);focusEtat.objectif=2;focusTerminerSerie(false);}finally{chronoLancerAnnonce=original;}const r=await fetch(chronoVoixUrl('masculine-fin-une-seance'));const ctx=new AudioContext();const b=await ctx.decodeAudioData(await r.arrayBuffer());await ctx.close();return {calls,duree:b.duration};});
 assert.deepEqual(voix.calls.map(x=>x.n),[['masculine-fin-une-seance'],['masculine-fin-serie']]);assert.equal(voix.calls[0].p,'Ta séance de révision est terminée.');assert.ok(voix.duree>1.5&&voix.duree<3);
 assert.deepEqual(errors,[]);console.log('OK import automatique, bac, réveil daté et voix singulière');
} finally { await browser.close(); }
