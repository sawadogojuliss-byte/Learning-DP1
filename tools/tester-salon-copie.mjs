/* Copie réelle dans Chromium et replis simulés ; aucun Firebase réel. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const base=process.env.STUDY_SITE||'http://127.0.0.1:8645/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
const id='abcdef0123456789abcdef0123456789abcdef0123456789', attendu=new URL('#salon='+id,base).href;
async function scenario(mode,viewport){
 const context=await browser.newContext({viewport});
 if(mode==='reel')await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(base).origin});
 await context.addInitScript((m)=>{
  window.__STUDYPLAN_E2E=true;window.__copie='';window.__exec=0;
  if(m!=='reel'){
   if(m==='absent'||m==='ancien')Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});
   else Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:function(text){if(m==='refuse')return Promise.reject(new DOMException('Refus','NotAllowedError'));if(m==='exception')throw new Error('indisponible');window.__copie=text;return Promise.resolve();}}});
   document.execCommand=function(op){if(op==='copy'){window.__exec++;if(m==='ancien'){window.__copie=document.activeElement.value;return true;}}return false;};
  }
  const session=d=>({id:'abcdef0123456789abcdef0123456789abcdef0123456789',role:'hote',maintenant:()=>Date.now(),observer(cb){queueMicrotask(()=>cb({...d,revision:1,ferme:false,membres:[{pseudo:'Organisateur'}]},{connecte:true}));return()=>{}},modifier:async()=>{},quitter:async()=>{},fermer:async()=>{}});
  window.SALON_FOCUS_TRANSPORT={creer:async d=>session(d),rejoindre:async()=>{}};
 },mode);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});
 await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerReglages();focusChoisirOnglet('salon')});
 await page.locator('#salonNom').fill('Révisions ensemble');await page.locator('#salonCreer').click();await page.locator('#salonLienCarte').waitFor({state:'visible'});
 assert.equal(await page.locator('#salonLienAffiche').inputValue(),attendu);assert.equal(await page.locator('#salonLienCarte').evaluate(e=>e.open),true,'carte de création en dialogue');
 assert.match(await page.locator('#salonLienStatut').evaluate(e=>e.previousElementSibling.textContent),/Seules les personnes/);
 await page.getByRole('button',{name:'Copier le lien',exact:true}).click();
 if(['refuse','exception','absent'].includes(mode)){
  await page.waitForFunction(()=>document.getElementById('salonLienStatut').textContent.includes('manuellement'));
  assert.equal(await page.locator('#salonLienCarte').isVisible(),true);
  assert.equal(await page.locator('#salonLienAffiche').inputValue(),attendu);assert.equal(await page.locator('#salonLienCarte').evaluate(e=>e.open),true,'carte de création en dialogue');
  assert.equal(await page.locator('#salonLienAffiche').evaluate(e=>e.selectionStart===0&&e.selectionEnd===e.value.length),true,'lien sélectionné');
  assert.ok(await page.evaluate(()=>window.__exec)>0);
 }else{
  await page.waitForFunction(()=>document.getElementById('salonLienStatut').textContent.includes('Lien copié'));
  const copie=mode==='reel'?await page.evaluate(()=>navigator.clipboard.readText()):await page.evaluate(()=>window.__copie);
  assert.equal(copie,attendu,'le contenu du presse-papiers est le lien Studyplan du salon');
 }
 assert.match(await page.locator('#salonLienStatut').evaluate(e=>e.previousElementSibling.textContent),/Seules les personnes/,'message initial conservé au-dessus de la confirmation');
 assert.doesNotMatch(await page.locator('#salonMessage').textContent(),/Lien copié|manuellement/,'aucune confirmation sur la page principale');
 // Même action depuis la feuille Groupe, notamment après fermeture de la carte.
 await page.locator('#salonLienCarte .salon-lien-fermer').click();
 await page.evaluate(()=>{window.__copie='';document.getElementById('salonGroupePartageStatut').textContent='';});
 if(mode==='reel')await page.evaluate(()=>navigator.clipboard.writeText('ancien contenu'));
 await page.locator('#salonBtnReglages').click();await page.locator('[data-onglet="reunion-groupe"]').click();await page.getByRole('button',{name:'Copier le lien d’invitation'}).click();
 if(['refuse','exception','absent'].includes(mode)){
  await page.waitForFunction(()=>!document.getElementById('salonLienCarte').hidden && document.getElementById('salonGroupePartageStatut').textContent.includes('manuellement'));
  assert.equal(await page.locator('#focusReglages').isVisible(),false,'le panneau ne masque pas le lien');
  await page.locator('#salonLienAffiche').click();
  assert.match(await page.locator('#salonGroupePartageStatut').textContent(),/manuellement/);
 }else {
  await page.waitForFunction(()=>document.getElementById('salonGroupePartageStatut').textContent.includes('Lien copié'));
  assert.equal(mode==='reel'?await page.evaluate(()=>navigator.clipboard.readText()):await page.evaluate(()=>window.__copie),attendu,'le bouton de la fiche groupe copie aussi le lien');
 }
 assert.deepEqual(errors,[]);console.log('OK copie '+mode+' '+viewport.width+'×'+viewport.height);await context.close();
}
try {
 await scenario('reel',{width:1280,height:800});
 await scenario('refuse',{width:320,height:568});
 for(const mode of ['refuse','absent','exception','ancien'])await scenario(mode,{width:390,height:844});
}finally{await browser.close()}
