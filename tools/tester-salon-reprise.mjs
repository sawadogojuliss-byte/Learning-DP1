/* Reprise d'organisateur et refus d'usurpation, avec un serveur simulé. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const base=process.env.STUDY_SITE||'http://127.0.0.1:8645/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
const id='abcdef0123456789abcdef0123456789abcdef0123456789';
let horsLigne=true;
const room={nom:'Maths',revision:1,ferme:false,organisateurUid:'host',options:{},partage:{},chrono:{mode:'focus',total:1500,restant:1380,running:false,fin:0},membres:[{uid:'host',pseudo:'Organisateur'}]};
async function utilisateur(actor){
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.exposeFunction('__backend',async(op)=>{if(op==='resume'){if(horsLigne)throw Error('offline');if(actor!=='host')throw Error('permission-denied');return {id,uid:'host',role:'hote'};}if(op==='read')return room;if(op==='join')return {id,uid:actor,role:'invite'};throw Error('unexpected');});
 await context.addInitScript(()=>{
  window.__STUDYPLAN_E2E=true;
  const call=(op)=>window.__backend(op).catch(e=>{let x=Error(e.message);if(e.message.includes('permission-denied'))x.code='permission-denied';throw x;});
  const session=s=>({...s,maintenant:()=>Date.now(),observer(cb,err){let stopped=false;call('read').then(d=>{if(!stopped)cb(d,{connecte:true})},err);return()=>{stopped=true}},modifier:async()=>{},quitter:async()=>{},fermer:async()=>{}});
  window.SALON_FOCUS_TRANSPORT={creer:async()=>{},reprendre:()=>call('resume').then(session),rejoindre:()=>call('join').then(session)};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());return {page,context,errors};
}
try {
 const h=await utilisateur('host');await h.page.goto(base+'#salon='+id,{waitUntil:'domcontentloaded'});
 await h.page.waitForFunction(()=>document.getElementById('salonInvitationTitre')?.textContent==='Vérifier ton accès',{timeout:60000});
 assert.equal(await h.page.locator('#salonPseudo').isVisible(),false,'aucun pseudo demandé en cas d’échec réseau');
 horsLigne=false;await h.page.locator('#salonRejoindreBouton').click();
 await h.page.waitForFunction(()=>!document.getElementById('salonInvitation').open&&!document.getElementById('salonCommandes').hidden);
 assert.equal(await h.page.locator('#salonTemps').textContent(),'23:00');
 horsLigne=true;await h.page.reload({waitUntil:'domcontentloaded'});
 await h.page.waitForFunction(()=>document.getElementById('salonInvitationTitre')?.textContent==='Reprendre ton salon',{timeout:60000});
 assert.equal(await h.page.locator('#salonPseudo').isVisible(),false,'le propriétaire en reconnexion ne voit pas le pseudo');
 horsLigne=false;await h.page.locator('#salonRejoindreBouton').click();await h.page.waitForFunction(()=>!document.getElementById('salonInvitation').open&&!document.getElementById('salonCommandes').hidden);
 const g=await utilisateur('guest');await g.page.goto(base+'#salon='+id,{waitUntil:'domcontentloaded'});
 await g.page.locator('#salonPseudo').waitFor({state:'visible',timeout:60000});await g.page.locator('#salonPseudo').fill('Camille');await g.page.locator('#salonRejoindreBouton').click();
 await g.page.waitForFunction(()=>!document.getElementById('salonInvitation').open);assert.equal(await g.page.locator('#salonCommandes').isVisible(),false);
 assert.deepEqual(h.errors,[]);assert.deepEqual(g.errors,[]);await h.context.close();await g.context.close();
 console.log('OK reprise simulée : propriétaire sans mémo, panne puis reprise, invité non propriétaire');
}finally{await browser.close()}
