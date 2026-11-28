'use strict';
// Simulation de clavier couvrant le viewport : aucune connexion ou donnée réelle.
const assert=require('node:assert/strict');
const {chromium}=require((process.env.STUDY_TEST_MODULES||'/home/user/studio-test/node_modules')+'/playwright');
const base=process.env.STUDY_SITE||'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch(process.env.STUDY_PLAYWRIGHT_SYSTEM?{headless:true}:{executablePath:process.env.STUDY_CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const viewport of [{width:768,height:1024},{width:1024,height:768}]){
   const ctx=await browser.newContext({viewport,hasTouch:true,serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
   await page.addInitScript(()=>{
    window.__STUDYPLAN_E2E=true;
    const vv=new EventTarget();Object.assign(vv,{height:innerHeight,width:innerWidth,offsetTop:0,offsetLeft:0,scale:1});
    Object.defineProperty(window,'visualViewport',{configurable:true,value:vv});
    window.__clavier=(height,top)=>{vv.height=height;vv.offsetTop=top;vv.dispatchEvent(new Event('resize'));};
   });
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
   await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');});
   await page.locator('#focusBtnTaches').click();
   await page.evaluate(()=>{focusTaches=Array.from({length:12},(_,i)=>({id:i+1,texte:'Tâche '+(i+1),fait:false}));focusPeindreTaches()});
   async function testerChamp(champ){
    await champ.focus();await page.evaluate(()=>window.__clavier(340,40));await page.waitForTimeout(150);
    const etat=await champ.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {top:r.top,bottom:r.bottom,width:r.width,caret:s.caretColor,selection:s.userSelect,font:parseFloat(s.fontSize),color:s.color,background:s.backgroundColor,actif:document.activeElement===e}});
    assert.equal(etat.actif,true);assert.ok(etat.top>=40&&etat.bottom<=380,'le champ reste au-dessus du clavier : '+JSON.stringify(etat));
    assert.notEqual(etat.caret,'rgba(0, 0, 0, 0)','curseur visible');assert.notEqual(etat.caret,'transparent');assert.equal(etat.selection,'text');assert.ok(etat.font>=16,'pas de zoom automatique au clavier');
   }
   const nouvelle=page.locator('#focusNouvelle');await testerChamp(nouvelle);await nouvelle.fill('Chapitre de physique');assert.equal(await nouvelle.inputValue(),'Chapitre de physique');
   assert.ok(await page.locator('.focus-ajout-centre').evaluate(e=>e.getBoundingClientRect().bottom<=380),'le bouton Ajouter reste accessible au-dessus du clavier');
   if(process.env.TABLETTE_CAPTURE)await page.screenshot({path:process.env.TABLETTE_CAPTURE+'-'+viewport.width+'.png'});
   await nouvelle.selectText();assert.equal(await nouvelle.evaluate(e=>e.selectionEnd-e.selectionStart), 'Chapitre de physique'.length,'la sélection du texte reste possible');
   await page.locator('.focus-ajout-centre').click();assert.ok(await page.evaluate(()=>focusTaches.some(t=>t.texte==='Chapitre de physique')));
   await page.evaluate(()=>{window.__clavier(innerHeight,0);document.activeElement.blur();});await page.waitForTimeout(100);
   const premiere=page.locator('#focusListe > li').first();await premiere.locator(':scope > .focus-ligne [aria-label="Modifier la tâche"]').click();
   const edition=premiere.locator(':scope > .focus-edition-tache input');await testerChamp(edition);await edition.fill('Tâche modifiée');await edition.press('Enter');assert.equal(await page.evaluate(()=>focusTaches[0].texte),'Tâche modifiée');
   await page.evaluate(()=>{window.__clavier(innerHeight,0);document.activeElement.blur();});await page.waitForTimeout(100);
   await premiere.locator(':scope > .focus-ligne .focus-tache-menu:not(.focus-tache-modifier)').click();await premiere.getByRole('menuitem',{name:'Ajouter une sous-tâche'}).click();
   const sous=premiere.locator('.focus-sous-form input');await testerChamp(sous);await sous.fill('Sous-tâche visible');await sous.press('Enter');assert.equal(await page.evaluate(()=>focusTaches[0].sous[0].texte),'Sous-tâche visible');
   await page.evaluate(()=>{window.__clavier(innerHeight,0);document.activeElement.blur();});await page.waitForTimeout(100);await page.locator('#focusBtnTaches').click();
   const objectif=page.locator('#focusTache');await testerChamp(objectif);await objectif.fill('Nouvel objectif');assert.equal(await objectif.inputValue(),'Nouvel objectif');
   await page.evaluate(()=>{window.__clavier(innerHeight,0);document.activeElement.blur();});await page.waitForTimeout(100);assert.equal(await page.locator('#focusPage').evaluate(e=>e.classList.contains('focus-objectif-saisie')),false);
   // Le panneau de tâches est aussi utilisé au-dessus de l'écran des salons.
   await page.evaluate(()=>{document.body.classList.add('salon-actif');document.getElementById('salonEcran').hidden=false;focusBasculerTaches();});
   await testerChamp(nouvelle);assert.equal(await nouvelle.evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===e;}),true,'champ accessible au-dessus du salon');
   await nouvelle.fill('Tâche en salon');await page.locator('.focus-ajout-centre').click();assert.ok(await page.evaluate(()=>focusTaches.some(t=>t.texte==='Tâche en salon')));
   assert.deepEqual(errors,[]);console.log('OK clavier simulé : tâches, modification, sous-tâche et objectif '+viewport.width+'×'+viewport.height);await ctx.close();
  }
  // Les téléphones et les ordinateurs gardent leur placement d'origine.
  for(const cfg of [{viewport:{width:390,height:844},hasTouch:true,isMobile:true},{viewport:{width:844,height:390},screen:{width:390,height:844},hasTouch:true,isMobile:true},{viewport:{width:1280,height:800},hasTouch:false}]){
   const ctx=await browser.newContext({...cfg,serviceWorkers:'block'}),page=await ctx.newPage();
   await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
   await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true;});
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
   await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerTaches();});
   await page.locator('#focusNouvelle').focus();await page.waitForTimeout(100);
   assert.equal(await page.locator('#focusTaches').evaluate(e=>e.classList.contains('focus-saisie-clavier')),false,'aucun déplacement sur téléphone ou ordinateur');
   await page.locator('#focusTache').focus();await page.waitForTimeout(100);
   assert.equal(await page.locator('#focusPage').evaluate(e=>e.classList.contains('focus-objectif-saisie')),false);
   if(!cfg.hasTouch)assert.notEqual(await page.locator('#focusTache').evaluate(e=>getComputedStyle(e).caretColor),'rgba(0, 0, 0, 0)','curseur ordinateur visible');
   console.log('OK position inchangée '+cfg.viewport.width+'×'+cfg.viewport.height);await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
