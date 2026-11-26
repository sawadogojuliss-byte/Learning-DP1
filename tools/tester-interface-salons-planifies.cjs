'use strict';
// Interface testée avec API et comptes fictifs uniquement.
const fs=require('fs');const assert=require('node:assert/strict');
const {chromium}=require((process.env.STUDY_TEST_MODULES || '/home/user/studio-test/node_modules')+'/playwright');
(async()=>{
 const browser=await chromium.launch(process.env.STUDY_PLAYWRIGHT_SYSTEM ? {headless:true} : {executablePath:process.env.STUDY_CHROMIUM_PATH || '/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const largeur of [375,1100]){
   const page=await browser.newPage({viewport:{width:largeur,height:850}});
   await page.setContent('<div id="planningModal"><header><div style="display:flex;justify-content:space-between;align-items:center"><div>Studyplan</div><div style="display:flex;gap:7px"><span id="joursFlamme">🔥 47</span><button>☰</button></div></div></header><div id="iaRappel"></div></div><div class="salon-formulaire"><button id="salonCreer">Créer</button></div>');
   await page.addStyleTag({content:fs.readFileSync('css/pages/salons-planifies.css','utf8')});
   await page.evaluate(()=>{
    window.__calls=[];window.__visible=false;window.__created=false;window.__reponse='attente';window.__historique=[{id:'ancien',nom:'Histoire partagée',organisateurNom:'Awa',debut:Date.now()-7200000,fin:Date.now()-3600000,fuseau:'UTC',role:'invite'}];
    const user={uid:'hote',isAnonymous:false,providerData:[{providerId:'google.com'}],getIdToken:async()=> 'jeton-fictif'};
    window.firebase={auth:()=>({currentUser:user,onAuthStateChanged:cb=>cb(user)}),app:()=>({auth:()=>({currentUser:{uid:'anon1',getIdToken:async()=> 'jeton-salon-fictif'}})})};
    window.fetch=async(url,opt)=>{
     if(url==='data/salons-planifies.json')return {ok:true,json:async()=>({url:'https://script.google.com/macros/s/AKfycbyj9XN-o0AJa34uk7e98ZTcVNGovwWVcZSeKIitj9iOGPQmjnCCd3_hwApgJXlYAmAqjA/exec'})};
     const d=JSON.parse(opt.body);window.__calls.push(d);let data={};
     if(d.actionSalons==='membres')data={visible:window.__visible,eleves:[{id:'u1',nom:'Élève DP1',classe:'DP1'},{id:'u2',nom:'Élève DP2',classe:'DP2'}]};
     if(d.actionSalons==='inscription'){window.__visible=d.visible;data={visible:d.visible};}
     if(d.actionSalons==='creer'){window.__created=true;data={id:'abc'};}
     if(d.actionSalons==='effacer-historique'){window.__historique=[];data={efface:true};}
     if(d.actionSalons==='repondre'){window.__reponse=d.reponse;data={reponse:d.reponse};}
     if(d.actionSalons==='liste')data={historique:window.__historique,salons:[{id:'inv1',nom:'Révisions',organisateurNom:'Awa',debut:Date.now()+3600000,fin:Date.now()+7200000,fuseau:'UTC',role:'invite',reponse:window.__reponse,annule:false,lien:''}].concat(window.__created?[{id:'abc',nom:'Séance test',debut:Date.now()+3600000,fin:Date.now()+7200000,fuseau:'UTC',role:'organisateur',annule:false,lien:''}]:[])};
     return {ok:true,json:async()=>({success:true,resultat:data})};
    };
   });
   await page.addScriptTag({content:fs.readFileSync('js/pages/salons-planifies.js','utf8')});
   await page.waitForSelector('#salonsPlanifiesBandeau:not([hidden])');assert.equal(await page.locator('#salonsPlanifiesBandeau').textContent().then(t=>t.includes('Awa veut faire une séance')),true);
   assert.equal(await page.locator('#salonsPlanifiesAnnonce').evaluate(e=>e.parentElement.contains(document.querySelector('#joursFlamme'))),true);
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('studyplan:salon-rejoint',{detail:{id:'a'.repeat(48),uid:'anon1',identite:'invite'}})));await page.waitForFunction(()=>window.__calls.some(x=>x.actionSalons==='participer' && x.jetonSalon==='jeton-salon-fictif'));
   await page.click('#salonsOnglethistoire');assert.equal(await page.locator('#salonsPlanifiesHistorique').isVisible(),true);assert.equal(await page.locator('#salonsPlanifiesHistorique').textContent().then(t=>t.includes('Histoire partagée')),true);
   await page.click('#salonsOngletavenir');await page.click('.salons-programme-accepter');await page.waitForFunction(()=>window.__reponse==='accepte');await page.waitForFunction(()=>document.querySelector('#salonsPlanifiesBandeau').textContent.includes('INVITATION ACCEPTÉE'));
   await page.click('#salonsFermerAnnonces');await page.click('#salonsPlanifiesOuvrir');
   await page.waitForSelector('#salonsPlanifiesForm:not([hidden])');
   assert.equal(await page.locator('#salonsPlanifiesEleves fieldset').count(),2);
   await page.check('#salonsPlanifiesVisible');await page.waitForFunction(()=>window.__visible===true);
   await page.fill('#salonsPlanifiesNom','Séance test');
   const date=await page.evaluate(()=>{const d=new Date(Date.now()+3600000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
   await page.fill('#salonsPlanifiesDate',date);const fin=await page.evaluate(()=>{const d=new Date(Date.now()+7200000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});await page.fill('#salonsPlanifiesFin',fin);await page.check('input[name=salonsInvite][value=u2]');await page.click('#salonsPlanifiesValider');
   await page.waitForFunction(()=>window.__created===true);
   await page.click('#salonsPlanifiesAnnonce');await page.waitForSelector('#salonsPlanifiesBandeau:not([hidden])');
   await page.waitForFunction(()=>document.querySelector('#salonsPlanifiesBandeau').textContent.includes('Séance test'));
   assert.equal(await page.locator('#salonsPlanifiesBandeau').textContent().then(t=>t.includes('Séance test')),true);
   const appels=await page.evaluate(()=>window.__calls);const cree=appels.find(x=>x.actionSalons==='creer');assert.deepEqual(cree.invites,['u2']);assert.ok(cree.fin>cree.debut);assert.equal(cree.jeton,'jeton-fictif');assert.match(cree.demandeId,/^[a-f0-9]{32}$/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'pas de débordement');
   if(process.env.SALONS_CAPTURE)await page.screenshot({path:process.env.SALONS_CAPTURE+'-'+largeur+'.png'});
   await page.close();
  }
  // L'essai est explicite, limité à l'onglet et au compte, sans activation générale.
  for(const essai of [false,true]){
   const page=await browser.newPage({viewport:{width:390,height:850}});
   await page.route('https://studyplan.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<div id="planningModal"><header><span id="joursFlamme">🔥</span></header></div><button id="salonCreer">Créer</button>'}));
   await page.goto('https://studyplan.test/'+(essai?'?essai-salons=1':''));
   await page.evaluate(()=>{
    window.__calls=[];window.__user={uid:'hote',isAnonymous:false,providerData:[{providerId:'google.com'}],getIdToken:async()=> 'jeton-fictif'};
    const auth={get currentUser(){return window.__user},onAuthStateChanged:cb=>{window.__authcb=cb;cb(window.__user)}};window.firebase={auth:()=>auth};
    window.fetch=async(url,opt)=>{if(url==='data/salons-planifies.json')return {ok:true,json:async()=>({url:''})};window.__calls.push(JSON.parse(opt.body));return {ok:true,json:async()=>({success:true,resultat:{salons:[],historique:[]}})}};
   });
   await page.addScriptTag({content:fs.readFileSync('js/pages/salons-planifies.js','utf8')});
   await page.waitForTimeout(75);assert.equal(await page.evaluate(()=>window.__calls.length),0,'aucun appel avant accord');
   if(essai){
    await page.waitForSelector('#salonsEssaiActiver');page.once('dialog',d=>d.accept());await page.click('#salonsEssaiActiver');
    await page.waitForFunction(()=>window.__calls.some(x=>x.actionSalons==='liste'));
    assert.equal(await page.locator('#salonsEssaiStatut').innerText(),' Essai actif sur cet onglet.');
    const avant=await page.evaluate(()=>window.__calls.length);
    await page.evaluate(()=>{window.__user={uid:'autre',isAnonymous:false,providerData:[{providerId:'google.com'}],getIdToken:async()=> 'autre'};window.__authcb(window.__user);});
    await page.waitForTimeout(75);assert.equal(await page.evaluate(()=>window.__calls.length),avant,'pas de transfert à un autre compte');
    assert.equal(await page.locator('#salonsPlanifiesAnnonce').isHidden(),true);
   } else assert.equal(await page.locator('#salonsEssaiActiver').count(),0);
   await page.close();
  }
  console.log('ok interface salons planifiés : desktop et mobile, DP1/DP2, consentement, création et annonce sur le planning (simulation)');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
