/* Deux salons et une arrivée tardive avec un serveur simulé, jamais Firebase. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES,'../package.json') : import.meta.url);
const {chromium}=require('playwright');
const core=createRequire(import.meta.url)('../js/pages/salon-focus-coeur.js');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const base=process.env.STUDY_SITE||'http://127.0.0.1:8645/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
const salles=new Map();
const clone=x=>structuredClone(x);
async function backend(actor,operation,arg={}) {
 if(operation==='create') {
   const id=core.nouvelIdentifiant(webcrypto);if(salles.has(id))throw Error('collision');
   salles.set(id,{...clone(arg),revision:1,ferme:false,membres:[{uid:actor,pseudo:actor}],hote:actor});
   return {id,role:'hote'};
 }
 const room=salles.get(arg.id);if(!room||room.ferme)throw Error('salon absent');
 if(operation==='join'){room.membres.push({uid:actor,pseudo:arg.pseudo});return {id:arg.id,role:'invite'};}
 if(operation==='read')return clone(room);
 if(operation==='modify'){if(room.hote!==actor||room.revision!==arg.revision)throw Error('refus');Object.assign(room,clone(arg.changement));room.revision++;return clone(room);}
 if(operation==='leave'){room.membres=room.membres.filter(x=>x.uid!==actor);return;}
 if(operation==='close'){if(room.hote!==actor)throw Error('refus');room.ferme=true;return;}
 throw Error('operation inconnue');
}
async function utilisateur(actor){
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.exposeFunction('__backend',(op,arg)=>backend(actor,op,arg));
 await context.addInitScript(()=>{
  window.__STUDYPLAN_E2E=true;window.__copie='';
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async x=>{window.__copie=x;}}});
  function session(s){return {...s,maintenant:()=>Date.now(),observer(cb,err){let ferme=false;const read=()=>window.__backend('read',{id:s.id}).then(d=>{if(!ferme)cb(d,{connecte:true})},e=>{if(!ferme)err(e)});read();const t=setInterval(read,200);return()=>{ferme=true;clearInterval(t)}},modifier:(revision,changement)=>window.__backend('modify',{id:s.id,revision,changement}),quitter:()=>window.__backend('leave',{id:s.id}),fermer:()=>window.__backend('close',{id:s.id})};}
  window.SALON_FOCUS_TRANSPORT={creer:d=>window.__backend('create',d).then(session),rejoindre:(id,pseudo)=>window.__backend('join',{id,pseudo}).then(session)};
 });
 const page=await context.newPage(),erreurs=[];page.on('pageerror',e=>erreurs.push(String(e)));await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());return {context,page,erreurs};
}
async function ouvrir(page){await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});await page.evaluate(()=>{document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));document.getElementById('planningModal').classList.add('active');navigateTo('pomodoro');focusBasculerReglages();focusChoisirOnglet('salon')});}
async function creer(page,nom,partages){await ouvrir(page);await page.locator('#salonNom').fill(nom);for(const x of partages)await page.locator(`[name=salonPartage][value=${x}]`).check();await page.locator('#salonCreer').click();await page.locator('#salonEcran').waitFor();await page.getByRole('button',{name:'Copier le lien d’invitation'}).click();await page.waitForFunction(()=>window.__copie.includes('#salon='));return page.evaluate(()=>window.__copie);}
try {
 const h1=await utilisateur('hote-un'),h2=await utilisateur('hote-deux'),g=await utilisateur('invite');
 const l1=await creer(h1.page,'Salon A',['theme']);const l2=await creer(h2.page,'Salon B',['theme','horloge']);
 assert.equal(new URL(l1).origin,new URL(base).origin,'lien sur le même site Studyplan');assert.equal(new URL(l1).pathname,new URL(base).pathname);
 const id1=new URL(l1).hash.slice(7),id2=new URL(l2).hash.slice(7);assert.match(id1,/^[0-9a-f]{48}$/);assert.match(id2,/^[0-9a-f]{48}$/);assert.notEqual(id1,id2);
 assert.deepEqual(Object.keys(salles.get(id1).partage),['theme']);assert.deepEqual(Object.keys(salles.get(id2).partage).sort(),['horloge','theme']);
 await h1.page.locator('#salonDemarrer').click();await h1.page.waitForFunction(()=>document.getElementById('salonInfoChrono').textContent==='En cours');
 await g.page.goto(l1,{waitUntil:'domcontentloaded'});await g.page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),{timeout:60000});await g.page.locator('#salonPseudo').fill('Camille');await g.page.locator('#salonRejoindreBouton').click();await g.page.locator('#salonEcran').waitFor();await g.page.waitForFunction(()=>document.getElementById('salonInfoChrono').textContent==='En cours');
 const secondes=s=>s.split(':').reduce((n,x)=>n*60+Number(x),0),a=secondes(await h1.page.locator('#salonTemps').innerText()),b=secondes(await g.page.locator('#salonTemps').innerText());
 assert.ok(Math.abs(a-b)<=1,`arrivée tardive : ${a} contre ${b}`);assert.ok(a<1500,'la séance a déjà commencé');assert.equal(await g.page.locator('#salonTitre').innerText(),'Salon A');assert.equal(await h2.page.locator('#salonTitre').innerText(),'Salon B');assert.equal(salles.get(id2).chrono.running,false,'les salons restent isolés');
 assert.deepEqual(h1.erreurs,[]);assert.deepEqual(h2.erreurs,[]);assert.deepEqual(g.erreurs,[]);
 console.log('OK simulation : liens distincts, partage individuel et arrivée en cours de séance');
 await h1.context.close();await h2.context.close();await g.context.close();
} finally {await browser.close()}
