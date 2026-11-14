/* Vérifie les réponses réseau tardives ; le transport est simulé, pas Firebase. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const base=process.env.STUDY_SITE||'http://127.0.0.1:8648/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
const first='a'.repeat(48), second='b'.repeat(48);
async function pageTest() {
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(({first,second})=>{
  window.__STUDYPLAN_E2E=true;window.__observers={};window.__deleted=0;window.__rooms={};let n=0;
  const session=(id,role)=>({id,role,uid:role==='hote'?'host':'guest',maintenant:()=>Date.now(),observer(cb){window.__observers[id]=cb;queueMicrotask(()=>cb(window.__rooms[id],{connecte:true}));return()=>delete window.__observers[id]},modifier(revision,mod){return new Promise(resolve=>window.__finishModify=()=>resolve({...window.__rooms[id],...mod,revision:revision+1}))},quitter:async()=>{window.__deleted++},fermer:async()=>{}});
  window.SALON_FOCUS_TRANSPORT={creer:async data=>{const id=n++===0?first:second;window.__rooms[id]={...data,revision:1,ferme:false,organisateurUid:'host',membres:[{uid:'host',pseudo:'Organisateur'}]};return session(id,'hote')},rejoindre:(id,pseudo)=>new Promise(resolve=>window.__finishJoin=()=>{window.__rooms[id]={nom:'Invitation',revision:1,ferme:false,organisateurUid:'host',options:{},partage:{},chrono:{mode:'focus',total:1500,restant:1500,running:false,fin:0},membres:[{uid:'guest',pseudo}]};resolve(session(id,'invite'))})};
 },{first,second});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());return {page,context,errors};
}
try {
 for(const cancel of ['bouton','escape']) {
  const {page,context,errors}=await pageTest();await page.goto(base+'#salon='+first,{waitUntil:'domcontentloaded'});
  await page.locator('#salonPseudo').waitFor({state:'visible',timeout:60000});await page.locator('#salonPseudo').fill('Camille');await page.locator('#salonRejoindreBouton').click();await page.waitForFunction(()=>typeof window.__finishJoin==='function');
  if(cancel==='bouton')await page.getByRole('button',{name:'Annuler',exact:true}).click();else await page.keyboard.press('Escape');
  assert.notEqual(await page.evaluate(()=>location.hash),'#salon='+first,'annulation retire le lien');
  await page.evaluate(()=>window.__finishJoin());await page.waitForTimeout(500);
  assert.equal(await page.locator('#salonEcran').isVisible(),false,'une entrée annulée ne rouvre pas le salon');
  assert.notEqual(await page.evaluate(()=>location.hash),'#salon='+first,'une réponse tardive ne restaure pas le lien');
  assert.equal(await page.evaluate(()=>window.__deleted),1,'inscription tardive annulée au mieux');assert.deepEqual(errors,[]);await context.close();
 }
 const {page,context,errors}=await pageTest();await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
 await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerReglages();focusChoisirOnglet('salon')});
 await page.locator('#salonNom').fill('Premier salon');await page.locator('#salonCreer').click();await page.locator('.salon-lien-fermer').click();await page.waitForFunction(()=>document.getElementById('salonTitre').textContent==='Premier salon');
 await page.locator('#salonDemarrer').click();await page.waitForFunction(()=>typeof window.__finishModify==='function');
 await page.evaluate(first=>window.__observers[first]({...window.__rooms[first],ferme:true,revision:2},{connecte:true}),first);
 await page.locator('#salonNom').fill('Second salon');await page.locator('#salonCreer').click();await page.locator('.salon-lien-fermer').click();await page.waitForFunction(()=>document.getElementById('salonTitre').textContent==='Second salon');
 await page.evaluate(()=>window.__finishModify());await page.waitForTimeout(500);
 assert.equal(await page.locator('#salonTitre').innerText(),'Second salon','une ancienne commande ne remplace pas le nouveau salon');assert.equal(await page.evaluate(()=>location.hash),'#salon='+second);assert.deepEqual(errors,[]);
 await context.close();console.log('OK réponses tardives : annulation, retour navigateur et isolation des salons');
} finally {await browser.close()}
