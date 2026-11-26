'use strict';
// Test réel de transport depuis l'origine Studyplan, sans compte ni jeton.
// La requête est rejetée avant tout accès Firestore, création ou envoi de mail.
const {chromium}=require((process.env.STUDY_TEST_MODULES || '/home/user/studio-test/node_modules')+'/playwright');
const ORIGINE='https://sawadogojuliss-byte.github.io/Learning-DP1/';
const API='https://script.google.com/macros/s/AKfycbyj9XN-o0AJa34uk7e98ZTcVNGovwWVcZSeKIitj9iOGPQmjnCCd3_hwApgJXlYAmAqjA/exec';
(async()=>{
 const browser=await chromium.launch(process.env.STUDY_PLAYWRIGHT_SYSTEM?{headless:true}:{executablePath:process.env.STUDY_CHROMIUM_PATH || '/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();
  // Une page locale interceptée conserve l'origine réelle, sans charger ni
  // modifier le profil de qui que ce soit.
  await page.route(ORIGINE,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Test de transport</title>'}));
  await page.goto(ORIGINE,{waitUntil:'domcontentloaded'});
  const resultat=await page.evaluate(async api=>{
   const controle=new AbortController(), timer=setTimeout(()=>controle.abort(),20000);
   try{
    const r=await fetch(api,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({actionSalons:'liste'}),cache:'no-store',credentials:'omit',redirect:'follow',referrerPolicy:'no-referrer',signal:controle.signal});
    return {status:r.status,data:await r.json()};
   }catch(e){return {erreur:String(e && e.message || e)};}finally{clearTimeout(timer);}
  },API);
  if(resultat.erreur)throw Error('Transport navigateur non vérifié : '+resultat.erreur);
  if(resultat.status!==200 || resultat.data.success!==false || resultat.data.error!=='auth-requise')throw Error('Réponse inattendue : '+JSON.stringify(resultat));
  console.log('OK transport réel navigateur : requête non authentifiée refusée, aucun mail ni écriture.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
