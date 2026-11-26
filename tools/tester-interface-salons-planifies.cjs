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
   await page.addStyleTag({content:fs.readFileSync('css/pages/planning-panels.css','utf8')});
   await page.addStyleTag({content:fs.readFileSync('css/pages/salon-focus.css','utf8')});
   await page.addStyleTag({content:fs.readFileSync('css/pages/salons-planifies.css','utf8')});
   await page.addStyleTag({content:fs.readFileSync('css/accessibilite.css','utf8')});
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
   await page.waitForSelector('#salonsPlanifiesBadge:not([hidden])');assert.equal(await page.locator('#salonsPlanifiesBadge').innerText(),'1');
   assert.equal(await page.locator('#salonsPlanifiesBandeau').isHidden(),true,'ne pas marquer comme lu avant ouverture');
   assert.equal(await page.locator('#salonsPlanifiesAnnonce svg').count(),1);
   await page.click('#salonsPlanifiesAnnonce');await page.waitForSelector('#salonsPlanifiesBandeau.active');
   if(process.env.SALONS_PAGE_MOCK_CAPTURE)await page.screenshot({path:process.env.SALONS_PAGE_MOCK_CAPTURE+'-'+largeur+'.png'});
   assert.equal(await page.locator('#salonsPlanifiesBadge').isHidden(),true);
   assert.equal(await page.locator('#salonsPlanifiesBandeau').textContent().then(t=>t.includes('Awa veut faire une séance')),true);
   assert.match(await page.locator('#salonsOngletavenir').innerText(),/^Séances de pomodoro/);assert.match(await page.locator('#salonsOnglethistoire').innerText(),/^Mon historique/);
   assert.equal(await page.locator('#salonsPlanifiesAnnonce').evaluate(e=>e.parentElement.contains(document.querySelector('#joursFlamme'))),true);
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('studyplan:salon-rejoint',{detail:{id:'a'.repeat(48),uid:'anon1',identite:'invite'}})));await page.waitForFunction(()=>window.__calls.some(x=>x.actionSalons==='participer' && x.jetonSalon==='jeton-salon-fictif'));
   await page.click('#salonsOnglethistoire');assert.equal(await page.locator('#salonsPlanifiesHistorique').isVisible(),true);assert.equal(await page.locator('#salonsPlanifiesHistorique').textContent().then(t=>t.includes('Histoire partagée')),true);
   await page.click('#salonsOngletavenir');await page.click('.salons-programme-accepter');await page.waitForFunction(()=>window.__reponse==='accepte');await page.waitForFunction(()=>document.querySelector('#salonsPlanifiesBandeau').textContent.includes('DEMANDE ACCEPTÉE'));
   await page.click('#salonsFermerAnnonces');await page.click('#salonsPlanifiesOuvrir');
   await page.waitForSelector('#salonsPlanifiesForm:not([hidden])');
   assert.equal(await page.locator('#salonsPlanifiesEleves fieldset').count(),2);
   if(largeur===1100){
    await page.locator('.salon-formulaire').evaluate(e=>{e.style.maxWidth='320px'});
    const placements=await page.evaluate(()=>{const d=document.querySelector('#salonsPlanifiesDate').getBoundingClientRect(),f=document.querySelector('#salonsPlanifiesFin').getBoundingClientRect(),parent=document.querySelector('.salon-formulaire').getBoundingClientRect();return {d:d.toJSON(),f:f.toJSON(),parent:parent.toJSON()};});
    assert.ok(placements.f.y>placements.d.y,'les horaires s’empilent dans un tiroir étroit même sur grand écran');
    assert.ok(placements.d.right<=placements.parent.right+1,'le champ reste dans le tiroir');
   }
   await page.check('#salonsPlanifiesVisible');await page.waitForFunction(()=>window.__visible===true);
   await page.fill('#salonsPlanifiesNom','Séance test');
   const date=await page.evaluate(()=>{const d=new Date(Date.now()+3600000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
   await page.fill('#salonsPlanifiesDate',date);const fin=await page.evaluate(()=>{const d=new Date(Date.now()+7200000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});await page.fill('#salonsPlanifiesFin',fin);await page.check('input[name=salonsInvite][value=u2]');assert.equal(await page.locator('#salonsPlanifiesSelection').innerText(),'1 / 20 sélectionné');assert.equal(await page.locator('input[name=salonsInvite][value=u2]').locator('..').evaluate(e=>e.classList.contains('selectionnee')),true);
   const membresAvantRecherche=await page.evaluate(()=>window.__calls.filter(c=>c.actionSalons==='membres').length);
   await page.fill('#salonsPlanifiesRecherche','ELEVE DP1');
   // La règle globale d'accessibilité ne doit pas dessiner de rectangle blanc dans le champ.
   async function verifierFocusRecherche(){
    const styles=await page.locator('#salonsPlanifiesRecherche').evaluate(e=>({focus:document.activeElement===e,outline:getComputedStyle(e).outlineStyle,ombre:getComputedStyle(e).boxShadow,contour:getComputedStyle(e.parentElement).outlineStyle,largeur:getComputedStyle(e.parentElement).outlineWidth}));
    assert.equal(styles.focus,true);assert.equal(styles.outline,'none');assert.equal(styles.ombre,'none');
    assert.equal(styles.contour,'solid');assert.notEqual(styles.largeur,'0px','focus visible autour du champ entier');
   }
   await verifierFocusRecherche();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'salonsPlanifiesEffacerRecherche');await page.keyboard.press('Shift+Tab');await verifierFocusRecherche();
   await page.emulateMedia({forcedColors:'active'});await verifierFocusRecherche();await page.emulateMedia({forcedColors:'none'});
   await page.press('#salonsPlanifiesRecherche','Enter');
   assert.equal(await page.evaluate(()=>window.__calls.some(c=>c.actionSalons==='creer')),false,'Entrée dans la recherche ne crée pas de séance');
   assert.equal(await page.locator('input[name=salonsInvite][value=u1]').isVisible(),true,'recherche insensible à la casse et aux accents');
   assert.equal(await page.locator('input[name=salonsInvite][value=u2]').isHidden(),true);assert.equal(await page.locator('input[name=salonsInvite][value=u2]').isChecked(),true,'la sélection filtrée reste cochée');
   assert.equal(await page.locator('#salonsPlanifiesResultats').innerText(),'1 camarade trouvé');
   assert.equal(await page.locator('#salonsPlanifiesChoix').isVisible(),true,'les personnes sélectionnées restent visibles pendant la recherche');
   await page.getByRole('button',{name:'Retirer Élève DP2 de la séance'}).click();assert.equal(await page.locator('input[name=salonsInvite][value=u2]').isChecked(),false);
   assert.equal(await page.locator('#salonsPlanifiesChoix').isHidden(),true);assert.equal(await page.locator('#salonsPlanifiesSelection').innerText(),'0 / 20 sélectionné');
   await page.fill('#salonsPlanifiesRecherche','inexistant');assert.equal(await page.locator('#salonsPlanifiesResultats').innerText(),'0 camarade trouvé');
   assert.equal(await page.locator('.salons-programme-vide:visible').count(),2);
   await page.click('#salonsPlanifiesEffacerRecherche');assert.equal(await page.locator('#salonsPlanifiesRecherche').inputValue(),'');assert.equal(await page.locator('input[name=salonsInvite][value=u2]').isChecked(),false);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'salonsPlanifiesRecherche');await page.check('input[name=salonsInvite][value=u2]');
   await page.fill('#salonsPlanifiesRecherche','DP1');
   assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.actionSalons==='membres').length),membresAvantRecherche,'la recherche ne sollicite pas le serveur');
   const avantMembres=await page.evaluate(()=>window.__calls.filter(c=>c.actionSalons==='membres').length);
   await page.click('#salonsPlanifiesOuvrir');await page.waitForFunction(n=>window.__calls.filter(c=>c.actionSalons==='membres').length>n && !document.querySelector('#salonsPlanifiesStatut').textContent,avantMembres);
   assert.equal(await page.locator('input[name=salonsInvite][value=u2]').isChecked(),true,'sélection gardée pendant un rechargement de l’annuaire');
   assert.equal(await page.locator('input[name=salonsInvite][value=u2]').isHidden(),true);
   await page.click('#salonsPlanifiesValider');
   await page.waitForFunction(()=>window.__created===true && document.querySelector('#salonsPlanifiesForm').hidden);
   await page.click('#salonsPlanifiesOuvrir');await page.waitForSelector('#salonsPlanifiesForm:not([hidden])');
   assert.equal(await page.locator('#salonsPlanifiesRecherche').inputValue(),'');assert.equal(await page.locator('input[name=salonsInvite][value=u2]').isChecked(),false,'une nouvelle séance repart sans sélection');
   await page.click('#salonsPlanifiesAnnonce');await page.waitForSelector('#salonsPlanifiesBandeau.active');
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
  {
   // Une configuration momentanément indisponible se recharge au clic ;
   // elle ne doit pas produire un faux message de désactivation définitive.
   const page=await browser.newPage();
   await page.setContent('<header><span id="joursFlamme">🔥</span></header><button id="salonCreer">Créer</button>');
   await page.evaluate(()=>{
    window.__configs=0;window.__membres=0;
    const user={uid:'u',isAnonymous:false,providerData:[{providerId:'google.com'}],getIdToken:async()=> 'faux'};
    window.firebase={auth:()=>({currentUser:user,onAuthStateChanged:cb=>cb(user)})};
    window.fetch=async(url,opt)=>{
     if(url==='data/salons-planifies.json'){window.__configs++;if(window.__configs===1)throw Error('réseau');return {ok:true,json:async()=>({url:'https://script.google.com/macros/s/AKfycbyj9XN-o0AJa34uk7e98ZTcVNGovwWVcZSeKIitj9iOGPQmjnCCd3_hwApgJXlYAmAqjA/exec'})};}
     const d=JSON.parse(opt.body);if(d.actionSalons==='membres')window.__membres++;
     return {ok:true,json:async()=>({success:true,resultat:d.actionSalons==='membres'?{visible:false,eleves:[]}:{salons:[],historique:[]}})};
    };
   });
   await page.addScriptTag({content:fs.readFileSync('js/pages/salons-planifies.js','utf8')});
   await page.addScriptTag({content:fs.readFileSync('js/pages/salons-planifies.js','utf8')});
   assert.equal(await page.locator('#salonsPlanifiesOuvrir').count(),1,'une seule interface même après double chargement');
   await page.click('#salonsPlanifiesOuvrir');await page.waitForFunction(()=>window.__membres===1);
   assert.equal(await page.locator('#salonsPlanifiesForm').isVisible(),true);assert.equal(await page.locator('#salonsPlanifiesStatut').innerText(),'');
   assert.ok(await page.evaluate(()=>window.__configs>=2));await page.close();
  }
  {
   // Firebase peut arriver après le module ; une réponse de l'ancien compte
   // ne doit jamais être affichée dans la session suivante.
   const page=await browser.newPage();
   await page.setContent('<header><span id="joursFlamme">🔥</span></header><button id="salonCreer">Créer</button>');
   await page.evaluate(()=>{
    window.__user={uid:'premier',isAnonymous:false,providerData:[{providerId:'google.com'}],getIdToken:async()=> 'ancien'};
    window.__requetes=[];
    window.fetch=async(url,opt)=>{
     if(url==='data/salons-planifies.json')return {ok:true,json:async()=>({url:'https://script.google.com/macros/s/AKfycbyj9XN-o0AJa34uk7e98ZTcVNGovwWVcZSeKIitj9iOGPQmjnCCd3_hwApgJXlYAmAqjA/exec'})};
     const d=JSON.parse(opt.body);window.__requetes.push(d);
     if(d.actionSalons==='liste' && d.jeton==='ancien')await new Promise(resolve=>window.__debloquer=resolve);
     return {ok:true,json:async()=>({success:true,resultat:{salons:d.jeton==='ancien'?[{id:'secret',nom:'Privé ancien compte',debut:Date.now()+3600000,role:'organisateur'}]:[],historique:[]}})};
    };
   });
   await page.addScriptTag({content:fs.readFileSync('js/pages/salons-planifies.js','utf8')});
   await page.evaluate(()=>{
    const auth={get currentUser(){return window.__user},onAuthStateChanged(cb){window.__authcb=cb;cb(window.__user)}};
    window.firebase={apps:[{}],auth:()=>auth};window.dispatchEvent(new Event('focus'));
   });
   await page.waitForFunction(()=>!!window.__debloquer);
   await page.evaluate(()=>{window.__user={uid:'second',isAnonymous:false,providerData:[{providerId:'google.com'}],getIdToken:async()=> 'nouveau'};window.__authcb(window.__user);window.__debloquer();});
   await page.waitForFunction(()=>window.__requetes.some(r=>r.jeton==='nouveau'));
   await page.waitForFunction(()=>!document.querySelector('#salonsPlanifiesAnnonce').hidden);
   assert.equal(await page.locator('#salonsPlanifiesBandeau').textContent().then(t=>t.includes('Privé ancien compte')),false);
   assert.equal(await page.locator('#salonsPlanifiesAnnonce svg').count(),1);assert.equal(await page.locator('#salonsPlanifiesBadge').isHidden(),true);
   await page.close();
  }
  {
   // La nouvelle API supprime la case sans casser l'ancienne API v7.
   const page=await browser.newPage();
   await page.setContent('<header><span id="joursFlamme">🔥</span></header><button id="salonCreer">Créer</button>');
   await page.addStyleTag({content:fs.readFileSync('css/pages/salons-planifies.css','utf8')});
   await page.evaluate(()=>{
    const user={uid:'u',isAnonymous:false,providerData:[{providerId:'google.com'}],getIdToken:async()=> 'faux'};
    window.firebase={auth:()=>({currentUser:user,onAuthStateChanged:cb=>cb(user)})};window.__calls=[];
    window.fetch=async(url,opt)=>{
     if(url==='data/salons-planifies.json')return {ok:true,json:async()=>({url:'https://script.google.com/macros/s/AKfycbyj9XN-o0AJa34uk7e98ZTcVNGovwWVcZSeKIitj9iOGPQmjnCCd3_hwApgJXlYAmAqjA/exec'})};
     let action=JSON.parse(opt.body).actionSalons;window.__calls.push(action);
     return {ok:true,json:async()=>({success:true,resultat:action==='membres'?{annuaireAutomatique:true,eleves:[{id:'u1',nom:'Élève DP2',classe:'DP2'}]}:{salons:[],historique:[]}})};
    };
   });
   await page.addScriptTag({content:fs.readFileSync('js/pages/salons-planifies.js','utf8')});
   await page.click('#salonsPlanifiesOuvrir');await page.waitForSelector('#salonsPlanifiesForm:not([hidden])');
   assert.equal(await page.locator('#salonsPlanifiesVisible').isVisible(),false);assert.equal(await page.locator('#salonsPlanifiesForm').innerText().then(t=>t.includes('10 minutes avant')),false,'texte retiré');
   assert.equal(await page.locator('#salonsPlanifiesAnnuaireInfo').isVisible(),true);
   assert.equal(await page.locator('#salonsPlanifiesEleves').textContent().then(t=>t.includes('Élève DP2')),true);
   assert.equal(await page.evaluate(()=>window.__calls.includes('inscription')),false);
   await page.close();
  }
  {
   // Les demandes lues ne redeviennent pas non lues au rechargement :
   // la marque est locale à ce navigateur et isolée par compte.
   const page=await browser.newPage({viewport:{width:390,height:850}});
   await page.route('https://studyplan.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<header><span id="joursFlamme">🔥</span></header><button id="salonCreer">Créer</button>'}));
   await page.addInitScript(()=>{
    window.__user={uid:'compteA',isAnonymous:false,providerData:[{providerId:'google.com'}],getIdToken:async()=> 'faux'};
    const auth={get currentUser(){return window.__user},onAuthStateChanged(cb){window.__authcb=cb;cb(window.__user)}};window.firebase={apps:[{}],auth:()=>auth};
    window.__salons=[{id:'demande1',nom:'Séance fictive',organisateurNom:'Lina',debut:Date.now()+3600000,fin:Date.now()+7200000,role:'invite',reponse:'attente'}];
    window.fetch=async url=>url==='data/salons-planifies.json'?{ok:true,json:async()=>({url:'https://script.google.com/macros/s/AKfycbyj9XN-o0AJa34uk7e98ZTcVNGovwWVcZSeKIitj9iOGPQmjnCCd3_hwApgJXlYAmAqjA/exec'})}:{ok:true,json:async()=>({success:true,resultat:{salons:window.__salons,historique:[]}})};
   });
   await page.goto('https://studyplan.test/');await page.addStyleTag({content:fs.readFileSync('css/pages/salons-planifies.css','utf8')});
   await page.addScriptTag({content:fs.readFileSync('js/pages/salons-planifies.js','utf8')});
   await page.waitForSelector('#salonsPlanifiesBadge:not([hidden])');
   assert.equal(await page.locator('#salonsPlanifiesBadge').innerText(),'1');
   assert.equal(await page.locator('#salonsPlanifiesBadge').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(220, 38, 38)');
   assert.match(await page.locator('#salonsPlanifiesAnnonce').getAttribute('aria-label'),/1 demande non lue/);
   await page.click('#salonsPlanifiesAnnonce');assert.equal(await page.locator('#salonsPlanifiesBadge').isHidden(),true);
   await page.reload();await page.addStyleTag({content:fs.readFileSync('css/pages/salons-planifies.css','utf8')});await page.addScriptTag({content:fs.readFileSync('js/pages/salons-planifies.js','utf8')});
   await page.waitForSelector('#salonsPlanifiesAnnonce:not([hidden])');assert.equal(await page.locator('#salonsPlanifiesBadge').isHidden(),true,'une demande lue reste lue');
   await page.evaluate(()=>{window.__salons.push({...window.__salons[0],id:'demande2'});window.__authcb(window.__user);});
   await page.waitForSelector('#salonsPlanifiesBadge:not([hidden])');assert.equal(await page.locator('#salonsPlanifiesBadge').innerText(),'1','seule la nouvelle demande est non lue');
   await page.evaluate(()=>{window.__user={uid:'compteB',isAnonymous:false,providerData:[{providerId:'google.com'}],getIdToken:async()=> 'autre'};window.__authcb(window.__user);});
   await page.waitForFunction(()=>document.querySelector('#salonsPlanifiesBadge').textContent==='2');
   assert.equal(await page.locator('#salonsPlanifiesBadge').innerText(),'2','les vues du premier compte ne sont pas transférées');
   await page.click('#salonsPlanifiesAnnonce');assert.equal(await page.locator('#salonsPlanifiesBadge').isHidden(),true);
   await page.evaluate(()=>{window.__salons.push({...window.__salons[0],id:'demande3'});window.__authcb(window.__user);});
   await page.waitForFunction(()=>document.querySelector('#salonsOngletavenir').textContent.endsWith('3'));
   assert.equal(await page.locator('#salonsPlanifiesBadge').isHidden(),true,'les nouvelles demandes affichées sont lues');
   await page.click('#salonsOnglethistoire');
   await page.evaluate(()=>{window.__salons.push({...window.__salons[0],id:'demande4'});window.__authcb(window.__user);});
   await page.waitForSelector('#salonsPlanifiesBadge:not([hidden])');assert.equal(await page.locator('#salonsPlanifiesBadge').innerText(),'1','l’historique ne marque pas les nouvelles demandes comme lues');
   await page.click('#salonsOngletavenir');assert.equal(await page.locator('#salonsPlanifiesBadge').isHidden(),true);
   await page.click('#salonsFermerAnnonces');
   await page.evaluate(()=>{window.__salons.push({...window.__salons[0],id:'demande5'});window.__authcb(window.__user);});
   await page.waitForSelector('#salonsPlanifiesBadge:not([hidden])');assert.equal(await page.locator('#salonsPlanifiesBadge').innerText(),'1');
   await page.close();
  }
  {
   // Une longue liste ne doit pas sauter lors du rafraîchissement en remontant.
   const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
   await page.setContent('<header><span id="joursFlamme">🔥</span></header><button id="salonCreer">Créer</button>');
   for(const css of ['css/pages/planning-panels.css','css/pages/salon-focus.css','css/pages/salons-planifies.css','css/accessibilite.css'])await page.addStyleTag({content:fs.readFileSync(css,'utf8')});
   await page.evaluate(()=>{
    const u={uid:'fictif',isAnonymous:false,providerData:[{providerId:'google.com'}],getIdToken:async()=> 'faux'};
    window.firebase={auth:()=>({currentUser:u,onAuthStateChanged:cb=>cb(u)})};
    const now=Date.now();window.__salons=Array.from({length:30},(_,i)=>({id:'futur'+i,nom:'Révision '+i,organisateurNom:'Awa',role:'invite',reponse:'attente',debut:now+3600000,fin:now+7200000}));
    window.__passes=Array.from({length:20},(_,i)=>({id:'passe'+i,nom:'Ancien '+i,role:'organisateur',debut:now-3600000-i*60000,fin:now-1800000-i*60000}));window.__lectures=0;
    const interval=window.setInterval;window.setInterval=(fn,ms)=>{if(ms===60000){window.__rafraichir=fn;return 1;}return interval(fn,ms);};
    window.fetch=async url=>url==='data/salons-planifies.json'?{ok:true,json:async()=>({url:'https://script.google.com/macros/s/AKfycbyj9XN-o0AJa34uk7e98ZTcVNGovwWVcZSeKIitj9iOGPQmjnCCd3_hwApgJXlYAmAqjA/exec'})}:{ok:true,json:async()=>{window.__lectures++;return {success:true,resultat:{salons:window.__salons,historique:window.__passes}}}};
   });
   await page.addScriptTag({content:fs.readFileSync('js/pages/salons-planifies.js','utf8')});await page.waitForSelector('#salonsPlanifiesBadge:not([hidden])');
   await page.click('#salonsPlanifiesAnnonce');await page.waitForFunction(()=>document.querySelectorAll('#salonsPlanifiesListe article').length===30);
   await page.locator('#salonsPlanifiesBandeau').evaluate(e=>e.scrollTop=1700);await page.waitForTimeout(60);
   await page.evaluate(()=>{let p=document.querySelector('#salonsPlanifiesBandeau');window.__repere=[...p.querySelectorAll('#salonsPlanifiesListe article')].find(e=>e.getBoundingClientRect().bottom>0);window.__haut=window.__repere.getBoundingClientRect().top;window.__repere.querySelector('button').focus({preventScroll:true});window.__focus=document.activeElement;window.__avant=window.__lectures;window.__rafraichir();});
   await page.waitForFunction(()=>window.__lectures>window.__avant);await page.waitForTimeout(60);
   assert.equal(await page.evaluate(()=>window.__repere.isConnected&&document.activeElement===window.__focus),true,'une liste inchangée conserve carte et focus');
   assert.ok(await page.evaluate(()=>Math.abs(window.__repere.getBoundingClientRect().top-window.__haut)<2),'pas de saut sur une liste inchangée');
   await page.evaluate(()=>{window.__salons.shift();window.__rafraichir();});await page.waitForFunction(()=>document.querySelectorAll('#salonsPlanifiesListe article').length===29);
   assert.equal(await page.evaluate(()=>window.__repere.isConnected),true);
   assert.ok(await page.evaluate(()=>Math.abs(window.__repere.getBoundingClientRect().top-window.__haut)<2),'une séance supprimée plus haut ne fait pas sauter le contenu visible');
   await page.evaluate(()=>{window.__repereId=window.__repere.dataset.salonId;window.__salons.find(s=>s.id===window.__repereId).nom='Révision modifiée';window.__salons.shift();window.__rafraichir();});
   await page.waitForFunction(()=>document.querySelectorAll('#salonsPlanifiesListe article').length===28);
   assert.ok(await page.evaluate(()=>{const c=[...document.querySelectorAll('#salonsPlanifiesListe article')].find(e=>e.dataset.salonId===window.__repereId);return c.textContent.includes('Révision modifiée')&&Math.abs(c.getBoundingClientRect().top-window.__haut)<2;}),'la carte visible peut changer sans sauter');
   await page.mouse.move(800,360);const bas=await page.locator('#salonsPlanifiesBandeau').evaluate(e=>e.scrollTop);await page.mouse.wheel(0,-400);await page.waitForTimeout(120);
   assert.ok(await page.locator('#salonsPlanifiesBandeau').evaluate((e,n)=>e.scrollTop<n,bas),'la roulette remonte normalement');
   await page.click('#salonsOnglethistoire');await page.locator('#salonsPlanifiesBandeau').evaluate(e=>e.scrollTop=1100);await page.waitForTimeout(60);
   await page.evaluate(()=>{let p=document.querySelector('#salonsPlanifiesBandeau');window.__repere=[...p.querySelectorAll('#salonsPlanifiesHistoriqueListe article')].find(e=>e.getBoundingClientRect().bottom>0);window.__haut=window.__repere.getBoundingClientRect().top;window.__passes.shift();window.__rafraichir();});
   await page.waitForFunction(()=>document.querySelectorAll('#salonsPlanifiesHistoriqueListe article').length===19);
   assert.ok(await page.evaluate(()=>window.__repere.isConnected&&Math.abs(window.__repere.getBoundingClientRect().top-window.__haut)<2),'le défilement de l’historique reste stable aussi');
   await page.close();
  }
  console.log('ok interface salons planifiés : desktop et mobile, DP1/DP2, consentement, création et annonce sur le planning (simulation)');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
