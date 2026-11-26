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
    window.__calls=[];window.__visible=false;window.__created=false;window.__reponse='attente';
    const user={uid:'hote',isAnonymous:false,providerData:[{providerId:'google.com'}],getIdToken:async()=> 'jeton-fictif'};
    window.firebase={auth:()=>({currentUser:user,onAuthStateChanged:cb=>cb(user)})};
    window.fetch=async(url,opt)=>{
     if(url==='data/salons-planifies.json')return {ok:true,json:async()=>({url:'https://script.google.com/macros/s/AKfycbyj9XN-o0AJa34uk7e98ZTcVNGovwWVcZSeKIitj9iOGPQmjnCCd3_hwApgJXlYAmAqjA/exec'})};
     const d=JSON.parse(opt.body);window.__calls.push(d);let data={};
     if(d.actionSalons==='membres')data={visible:window.__visible,eleves:[{id:'u1',nom:'Élève DP1',classe:'DP1'},{id:'u2',nom:'Élève DP2',classe:'DP2'}]};
     if(d.actionSalons==='inscription'){window.__visible=d.visible;data={visible:d.visible};}
     if(d.actionSalons==='creer'){window.__created=true;data={id:'abc'};}
     if(d.actionSalons==='repondre'){window.__reponse=d.reponse;data={reponse:d.reponse};}
     if(d.actionSalons==='liste')data={salons:[{id:'inv1',nom:'Révisions',organisateurNom:'Awa',debut:Date.now()+3600000,fin:Date.now()+7200000,fuseau:'UTC',role:'invite',reponse:window.__reponse,annule:false,lien:''}].concat(window.__created?[{id:'abc',nom:'Séance test',debut:Date.now()+3600000,fin:Date.now()+7200000,fuseau:'UTC',role:'organisateur',annule:false,lien:''}]:[])};
     return {ok:true,json:async()=>({success:true,resultat:data})};
    };
   });
   await page.addScriptTag({content:fs.readFileSync('js/pages/salons-planifies.js','utf8')});
   await page.waitForSelector('#salonsPlanifiesBandeau:not([hidden])');assert.equal(await page.locator('#salonsPlanifiesBandeau').textContent().then(t=>t.includes('Awa veut faire une séance')),true);
   assert.equal(await page.locator('#salonsPlanifiesAnnonce').evaluate(e=>e.parentElement.contains(document.querySelector('#joursFlamme'))),true);
   await page.click('.salons-programme-accepter');await page.waitForFunction(()=>window.__reponse==='accepte');await page.waitForFunction(()=>document.querySelector('#salonsPlanifiesBandeau').textContent.includes('INVITATION ACCEPTÉE'));
   await page.click('#salonsPlanifiesOuvrir');
   await page.waitForSelector('#salonsPlanifiesForm:not([hidden])');
   assert.equal(await page.locator('#salonsPlanifiesEleves fieldset').count(),2);
   await page.check('#salonsPlanifiesVisible');await page.waitForFunction(()=>window.__visible===true);
   await page.fill('#salonsPlanifiesNom','Séance test');
   const date=await page.evaluate(()=>{const d=new Date(Date.now()+3600000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
   await page.fill('#salonsPlanifiesDate',date);const fin=await page.evaluate(()=>{const d=new Date(Date.now()+7200000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});await page.fill('#salonsPlanifiesFin',fin);await page.check('input[name=salonsInvite][value=u2]');await page.click('#salonsPlanifiesValider');
   await page.waitForFunction(()=>window.__created===true);
   await page.waitForSelector('#salonsPlanifiesBandeau:not([hidden])');
   assert.equal(await page.locator('#salonsPlanifiesBandeau').textContent().then(t=>t.includes('Séance test')),true);
   const appels=await page.evaluate(()=>window.__calls);const cree=appels.find(x=>x.actionSalons==='creer');assert.deepEqual(cree.invites,['u2']);assert.ok(cree.fin>cree.debut);assert.equal(cree.jeton,'jeton-fictif');assert.match(cree.demandeId,/^[a-f0-9]{32}$/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'pas de débordement');
   await page.close();
  }
  console.log('ok interface salons planifiés : desktop et mobile, DP1/DP2, consentement, création et annonce sur le planning (simulation)');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
