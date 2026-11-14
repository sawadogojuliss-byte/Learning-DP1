/* Profils fictifs et horloge contrôlée : permission, persistance et rappels. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE||'http://127.0.0.1:8525/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
const ready=async page=>{await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});};
try {
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]) {
  const context=await browser.newContext({viewport,serviceWorkers:'block'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',r=>r.request().url().startsWith(site)?r.continue():r.abort());
  await page.clock.install({time:new Date('2031-06-09T10:00:00')});
  await page.addInitScript(()=>{
   window.__STUDYPLAN_E2E=true; window.__notifications=[];
   window.Notification=class {static permission='granted';static requestPermission(){return Promise.resolve(this.permission)} constructor(title,options){window.__notifications.push({title,options})}};
  });
  await page.goto(site,{waitUntil:'domcontentloaded'});await ready(page);
  await page.evaluate(()=>{
   document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));
   document.getElementById('planningModal').classList.add('active');
   selectedDay=indexJourCourant();planningDecalageSemaine=0;
   customEvents=[{id:'rappel-test',day:selectedDay,title:'Réviser les maths',startTime:'10:07',endTime:'10:37',type:'activity',icon:'📚',source:'custom',pinned:true}];
   v3Save();renderPlanning();
   const i=v3LastRendered.findIndex(e=>e.id==='rappel-test');if(i<0)throw Error('Activité introuvable');v3OpenEditByIndex(i);
  });
  const bouton=page.locator('#rappelActiviteBouton');await bouton.waitFor({state:'visible'});assert.equal(await bouton.getAttribute('aria-pressed'),'false');
  await bouton.click();assert.equal(await bouton.getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#rappelActiviteMessage').innerText(),/Garde Studyplan ouvert/);
  let stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('studyPlanIB_rappelsActivites_v1')));assert.equal(stored.length,1);assert.equal(stored[0].id,'rappel-test');
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);
  await page.evaluate(()=>{document.getElementById('planningModal').classList.add('active');selectedDay=indexJourCourant();planningDecalageSemaine=0;renderPlanning();const i=v3LastRendered.findIndex(e=>e.id==='rappel-test');if(i<0)throw Error('Activité absente après actualisation');v3OpenEditByIndex(i)});
  assert.equal(await bouton.getAttribute('aria-pressed'),'true');
  await page.clock.fastForward('01:30');assert.equal(await page.evaluate(()=>window.__notifications.length),0);
  await page.clock.fastForward('00:35');await page.waitForFunction(()=>window.__notifications.length===1);
  const notification=await page.evaluate(()=>window.__notifications[0]);assert.match(notification.title,/Studyplan/);assert.match(notification.options.body,/Réviser les maths/);assert.match(notification.options.body,/10:07/);assert.match(notification.options.icon,/images\/logo\.png$/);
  await page.clock.fastForward('01:00');assert.equal(await page.evaluate(()=>window.__notifications.length),1);
  stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('studyPlanIB_rappelsActivites_v1')));assert.equal(stored[0].envoye,true);
  assert.deepEqual(errors,[]);console.log('OK rappel, sauvegarde après actualisation, notification et absence de doublon : '+viewport.width+'×'+viewport.height);
  await context.close();
 }
 for (const mode of ['permission','deplace','supprime','service-worker']) {
  const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});
  const page=await context.newPage();
  await page.route('**/*',r=>r.request().url().startsWith(site)?r.continue():r.abort());
  await page.clock.install({time:new Date('2031-06-15T10:00:00')});
  await page.addInitScript(mode=>{
   window.__STUDYPLAN_E2E=true;window.__notifications=[];
   window.Notification=class {static permission=mode==='permission'?'denied':'granted';static requestPermission(){return Promise.resolve(this.permission)} constructor(title,options){window.__notifications.push({title,options})}};
   if(mode==='service-worker') Object.defineProperty(navigator.serviceWorker,'getRegistration',{value:async()=>({showNotification:async(title,options)=>window.__notifications.push({title,options})})});
  },mode);
  await page.goto(site,{waitUntil:'domcontentloaded'});await ready(page);
  await page.evaluate(()=>{document.getElementById('planningModal').classList.add('active');selectedDay=indexJourCourant();planningDecalageSemaine=0;sundayWakeup='08:00';sundaySleepHours=8;customEvents=[{id:'mask-early',day:selectedDay,date:'2031-06-15',replacesId:'revgap-520',deleted:true,timestamp:1},{id:'mask-free',day:selectedDay,date:'2031-06-15',replacesId:'libre-autre-6',deleted:true,timestamp:2},{id:'rappel-test',day:selectedDay,title:'Réviser les maths',startTime:'10:07',endTime:'10:40',type:'activity',icon:'📚',source:'custom',pinned:true}];v3Save();renderPlanning();v3OpenEditByIndex(v3LastRendered.findIndex(e=>e.id==='rappel-test'))});
  const bouton=page.locator('#rappelActiviteBouton');await bouton.click();
  if(mode==='permission') {
   assert.equal(await bouton.getAttribute('aria-pressed'),'false');assert.match(await page.locator('#rappelActiviteMessage').innerText(),/Autorise les notifications/);
   assert.equal(await page.evaluate(()=>localStorage.getItem('studyPlanIB_rappelsActivites_v1')),null);
   await page.evaluate(()=>Notification.permission='granted');await bouton.click();assert.equal(await bouton.getAttribute('aria-pressed'),'true');await bouton.click();assert.equal(await bouton.getAttribute('aria-pressed'),'false');
   assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('studyPlanIB_rappelsActivites_v1'))),[]);
  } else if(mode==='deplace') {
   await page.locator('#editEventTitle').fill('Réviser la physique');await page.locator('#editEventStart').fill('10:10');await page.locator('#editEventEnd').fill('10:40');
   await page.locator('#editSaveButton').click();
   assert.equal(await page.locator('#editEventModal').isVisible(),false);
   await page.clock.fastForward('02:10');assert.equal(await page.evaluate(()=>window.__notifications.length),0);
   await page.clock.fastForward('03:00');await page.waitForFunction(()=>window.__notifications.length===1);
   assert.match(await page.evaluate(()=>window.__notifications[0].options.body),/Réviser la physique commence à 10:10/);
  } else if(mode==='supprime') {
   await page.evaluate(()=>deleteEditedEvent());await page.clock.fastForward('02:10');assert.equal(await page.evaluate(()=>window.__notifications.length),0);
  } else {
   await page.clock.fastForward('02:10');await page.waitForFunction(()=>window.__notifications.length===1);
   assert.match(await page.evaluate(()=>window.__notifications[0].options.icon),/images\/logo\.png$/);
  }
  console.log('OK rappels : '+mode);await context.close();
 }

 // Deux onglets partagent le verrou et ne doivent pas notifier deux fois.
 {
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.addInitScript(()=>{window.__STUDYPLAN_E2E=true;window.__notifications=[];window.Notification=class {static permission='granted';constructor(title,options){window.__notifications.push({title,options})}}});
  const a=await context.newPage();await a.clock.install({time:new Date('2031-06-09T10:00:00')});
  await a.goto(site,{waitUntil:'domcontentloaded'});await ready(a);
  await a.evaluate(()=>{document.getElementById('planningModal').classList.add('active');selectedDay=indexJourCourant();planningDecalageSemaine=0;customEvents=[{id:'rappel-test',day:selectedDay,title:'Lecture',startTime:'10:07',endTime:'10:37',type:'activity',icon:'📚',source:'custom',pinned:true}];v3Save();renderPlanning();v3OpenEditByIndex(v3LastRendered.findIndex(e=>e.id==='rappel-test'))});
  await a.locator('#rappelActiviteBouton').click();
  const b=await context.newPage();await b.clock.install({time:new Date('2031-06-09T10:00:00')});await b.goto(site,{waitUntil:'domcontentloaded'});await ready(b);
  await Promise.all([a.clock.fastForward('02:10'),b.clock.fastForward('02:10')]);
  await a.waitForTimeout(300);
  assert.equal(await a.evaluate(()=>window.__notifications.length)+await b.evaluate(()=>window.__notifications.length),1);
  console.log('OK un seul rappel entre deux onglets');await context.close();
 }

} finally {await browser.close()}
