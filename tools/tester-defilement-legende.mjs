/* Navigation, calques et légende sur profils fictifs. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE || 'http://127.0.0.1:8515/';
const browser=await chromium.launch(portable ? {executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')} : {});
const top=async page=>page.evaluate(()=>({html:getComputedStyle(document.documentElement).overflowY,body:getComputedStyle(document.body).overflowY}));
async function lock(page,what) { const t=await top(page); assert.equal(t.html,'hidden',what+' : fond html verrouillé'); assert.equal(t.body,'hidden',what+' : fond body verrouillé'); }
async function scrollReach(page,selector) {
  const result=await page.locator(selector).evaluate(el=>{ const ancien=el.style.scrollBehavior; el.style.scrollBehavior='auto'; const old=el.scrollTop,max=el.scrollHeight-el.clientHeight; el.scrollTop=max; const bottom=el.scrollTop; el.scrollTop=old; el.style.scrollBehavior=ancien; return {max,bottom,overflow:getComputedStyle(el).overflowY}; });
  if(result.max>2){ assert.ok(['auto','scroll'].includes(result.overflow),`${selector} accessible ${JSON.stringify(result)}`); assert.ok(result.bottom>=result.max-2,`${selector} bas accessible ${JSON.stringify(result)}`); }
}
try {
 for (const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]) {
  const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',r=>r.request().url().startsWith(site)?r.continue():r.abort());await page.addInitScript(()=>window.__STUDYPLAN_E2E=true);
  await page.goto(site,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
  assert.notEqual((await top(page)).html,'hidden','accueil accessible');
  await page.evaluate(()=>openContextModal());await lock(page,'inscription');await page.evaluate(()=>closeContextModal());assert.notEqual((await top(page)).html,'hidden','retour depuis inscription');
  // Toutes les étapes de configuration et l'emploi du temps : une seule
  // fenêtre active, et retour possible à l'accueil sans verrou persistant.
  const contextIds=await page.locator('.context-modal').evaluateAll(els=>els.map(e=>e.id));
  for (const id of contextIds) {
   await page.evaluate(id=>{document.querySelectorAll('.app-panel.active,.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById(id).classList.add('active')},id);
   await lock(page,id);await scrollReach(page,'#'+id);
  }
  await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');userName='Test';subjects=[{name:'Mathématiques',icon:'📚',level:'HL'}];optionalSubjects=[];selectedDay=0;planningDecalageSemaine=0;renderPlanning();});
  await lock(page,'planning');await scrollReach(page,'#planningModal');
  await page.locator('#planningModal').evaluate(e=>{e.style.scrollBehavior='auto';e.scrollTop=0});
  await page.mouse.move(viewport.width/2,viewport.height/2);await page.mouse.wheel(0,350);await page.waitForTimeout(300);
  assert.ok(await page.locator('#planningModal').evaluate(e=>e.scrollTop)>0,'défilement réel du planning');
  await page.evaluate(()=>{document.getElementById('planningModal').scrollTop=180;openSideMenu()}); await page.waitForTimeout(450);
  assert.equal(await page.locator('#planningModal').evaluate(e=>getComputedStyle(e).overflowY),'hidden','menu : planning derrière figé');
  const menu=page.locator('#sideMenu > div').nth(1);assert.equal(await menu.evaluate(e=>getComputedStyle(e).overflowY),'auto');await scrollReach(page,'#sideMenu > div:nth-child(2)');
  await page.evaluate(()=>closeSideMenu()); await page.waitForTimeout(400);
  assert.equal(await page.locator('#planningModal').evaluate(e=>getComputedStyle(e).overflowY),'auto');
  assert.ok(await page.locator('#planningModal').evaluate(e=>e.scrollTop)>0,'position du planning conservée');
  // Formulaire d'ajout + une longue liste de matières : un seul défilement.
  await page.evaluate(()=>openAddModal());assert.equal(await page.locator('#addEventModal').isVisible(),true);
  assert.equal(await page.locator('#planningModal').evaluate(e=>getComputedStyle(e).overflowY),'hidden');
  await page.evaluate(()=>{const grid=document.getElementById('subjectPickerGrid');grid.style.display='flex';grid.innerHTML=Array.from({length:30},(_,i)=>'<button type="button">Matière fictive '+i+'</button>').join('')});
  assert.equal(await page.locator('#subjectPickerGrid').evaluate(e=>getComputedStyle(e).overflowY),'visible');await scrollReach(page,'#addEventModal');
  await page.evaluate(()=>closeAddModal());assert.equal(await page.locator('#planningModal').evaluate(e=>getComputedStyle(e).overflowY),'auto');
  // Édition et conflit, puis ses propositions : le dialogue est l'unique zone.
  await page.evaluate(()=>{selectedDay=0;planningDecalageSemaine=0;openEditModal('dinner','Dîner','19:00','19:45','meal','🍽️')});
  assert.equal(await page.locator('#editEventModal').isVisible(),true);assert.equal(await page.locator('#planningModal').evaluate(e=>getComputedStyle(e).overflowY),'hidden');await scrollReach(page,'#editEventModal > div');await page.evaluate(()=>closeEditModal());
  await page.evaluate(()=>{selectedDay=0;planningDecalageSemaine=0;selectedActivities=[{name:'Sport',icon:'⚽',days:[0],sameTime:true,startTime:'18:00',endTime:'19:00'}];customEvents=[];weekdayWakeup='06:00';weekdaySleepHours=8;emploiFige=null;document.getElementById('activityNameInput').value='Lecture';document.getElementById('activityStartInput').value='18:15';document.getElementById('activityEndInput').value='18:45';confirmAddActivity()});
  assert.equal(await page.locator('#chevauchementPopup').count(),1);assert.equal(await page.locator('#planningModal').evaluate(e=>getComputedStyle(e).overflowY),'hidden');
  await page.locator('#chevauchementPopup [data-autre-creneau]').click();
  assert.equal(await page.locator('#chevauchementPopup .chev-propositions').evaluate(e=>getComputedStyle(e).overflowY),'visible');await scrollReach(page,'#chevauchementPopup .chev-dialogue');
  await page.locator('#chevauchementAutres [data-annuler]').first().click(); assert.equal(await page.locator('#chevauchementPopup').count(),0);
  // Pages du menu (y compris les pages dont l'accès dépend normalement du profil).
  for (const name of ['soutien','exercices','legende','devoirs','eeia','feries','seances','pomodoro','aide','feedback','annonce']) {
   await page.evaluate(name=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo(name)},name);
   await lock(page,name);assert.equal(await page.locator('#planningModal').evaluate(e=>getComputedStyle(e).overflowY),'hidden',name+' : fond planning');
   const panel=page.locator('.app-panel.active');assert.equal(await panel.count(),1,name+' : panneau actif');
   const id=await panel.getAttribute('id'); if(!['panelSeances','panelPomodoro'].includes(id)) await scrollReach(page,'#'+id);
  }
  // Fenêtres Devoirs : le dialogue passe devant et reste le seul à défiler.
  await page.evaluate(()=>{navigateTo('devoirs');devoirsEcrireStore({bac:null,bacDemande:0,devoirs:[{id:'test-devoir',matiere:'Mathématiques',date:'2099-01-01',debut:'08:00',fin:'09:00',seances:null}],examens:[]},{brut:true});devoirsEditer('devoirs','test-devoir')});
  assert.equal(await page.locator('#devoirsEditionModal').evaluate(e=>getComputedStyle(e).zIndex),'100001');
  assert.equal(await page.locator('#panelDevoirs').evaluate(e=>getComputedStyle(e).overflowY),'hidden');
  await scrollReach(page,'#devoirsEditionModal .devoirs-dialogue');await page.locator('#devoirsEditAnnuler').click();
  assert.equal(await page.locator('#panelDevoirs').evaluate(e=>getComputedStyle(e).overflowY),'auto');
  await page.evaluate(()=>devoirsDemanderSeances(['test-devoir']));
  assert.equal(await page.locator('#seancesQuestionModal').evaluate(e=>getComputedStyle(e).zIndex),'100001');
  assert.equal(await page.locator('#panelDevoirs').evaluate(e=>getComputedStyle(e).overflowY),'hidden');
  await scrollReach(page,'#seancesQuestionModal > div');await page.locator('#seancesQuestionAnnuler').click();
  assert.equal(await page.locator('#panelDevoirs').evaluate(e=>getComputedStyle(e).overflowY),'auto');
  // Panneaux réservés à certains profils : inspection isolée sans compte réel.
  for (const id of ['panelTutoriel','panelAdmin','panelRetours','panelQuestions','panelEmplois']) {
   await page.evaluate(id=>{document.querySelectorAll('.app-panel.active').forEach(e=>e.classList.remove('active'));document.getElementById(id).classList.add('active')},id);
   await lock(page,id);assert.equal(await page.locator('#planningModal').evaluate(e=>getComputedStyle(e).overflowY),'hidden');await scrollReach(page,'#'+id);
  }
  // Légende : 12 catégories et couleurs d'origine, et retour au planning.
  await page.evaluate(()=>navigateTo('legende'));
  const cards=page.locator('#panelLegende [style*="border-left:4px"]'); assert.equal(await cards.count(),12);
  const palette=await cards.evaluateAll(els=>els.map(e=>[e.textContent.trim(),e.style.borderLeftColor,e.style.borderLeftStyle]));
  assert.deepEqual(palette, [
    ['😴 Sommeil','rgb(129, 140, 248)','solid'], ['🏫 Cours','rgb(96, 165, 250)','solid'],
    ['🔴 Révision critique (≤2/7)','rgb(239, 68, 68)','solid'], ['🟠 Révision à améliorer (≤4/7)','rgb(245, 158, 11)','solid'],
    ['📚 Révision normale','rgb(251, 146, 60)','solid'], ['🎯 Activités','rgb(167, 139, 250)','solid'],
    ['🚗 Transport','rgb(34, 211, 238)','solid'], ['🍽️ Repas','rgb(156, 163, 175)','solid'],
    ['📱 Téléphone','rgb(244, 114, 182)','solid'], ['🎮 Temps libre','rgb(74, 222, 128)','solid'],
    ['📋 Évaluation interne','rgb(251, 113, 133)','solid'], ['📖 Mémoire','rgb(77, 99, 161)','dashed']
  ]);
  assert.ok(await page.locator('#panelLegende').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await scrollReach(page,'#panelLegende');
  if(process.env.STUDY_TEST_CAPTURE){await page.locator('#panelLegende').evaluate(e=>e.scrollTop=0);await page.screenshot({path:`${process.env.STUDY_TEST_CAPTURE}/legende-ancienne-${viewport.width}.png`});}
  await page.getByRole('button',{name:'Revenir au planning'}).click();assert.equal(await page.locator('#panelLegende').isVisible(),false);assert.equal(await page.locator('#planningModal').evaluate(e=>getComputedStyle(e).overflowY),'auto');
  // Séances longues : un seul défilement, tous les boutons restent atteignables.
  await page.evaluate(()=>{navigateTo('seances');const list=document.getElementById('focusAccueilListe');list.innerHTML=Array.from({length:18},(_,i)=>'<button class="focus-seance" type="button">Séance fictive '+(i+1)+'</button>').join('')});
  assert.equal(await page.locator('#focusAccueilListe').evaluate(e=>getComputedStyle(e).overflowY),'visible');await scrollReach(page,'#focusAccueil');
  await page.locator('#focusAccueilContinuer').scrollIntoViewIfNeeded();assert.equal(await page.locator('#focusAccueilContinuer').isVisible(),true);
  // Retour à l'accueil et compte : le verrou ne doit pas survivre à la fermeture.
  await page.evaluate(()=>{navigateTo('planning');document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));});
  assert.notEqual((await top(page)).html,'hidden');await page.evaluate(()=>ouvrirCompte());await lock(page,'compte');await scrollReach(page,'.compte-card');await page.evaluate(()=>fermerCompte());assert.notEqual((await top(page)).html,'hidden');
  assert.deepEqual(errors,[]);console.log(`OK défilement, fenêtres, navigation et légende ${viewport.width}×${viewport.height}`);await context.close();
 }
} finally {await browser.close();}
