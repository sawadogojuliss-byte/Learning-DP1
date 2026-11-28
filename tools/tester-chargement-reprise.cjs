'use strict';
const assert = require('node:assert/strict');
const { chromium } = require((process.env.STUDY_TEST_MODULES || '/home/user/studio-test/node_modules') + '/playwright');
const base = process.env.STUDY_SITE || 'http://127.0.0.1:8765/';
(async () => {
 const browser = await chromium.launch(process.env.STUDY_PLAYWRIGHT_SYSTEM ? {headless:true} : {executablePath:process.env.STUDY_CHROMIUM_PATH || '/tmp/chromium', args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
  const page = await browser.newPage({serviceWorkers:'block'}), erreurs=[]; let requetes=0;
  page.on('pageerror',e=>erreurs.push(String(e)));
  await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true});
  await page.route('**/*', async route => {
   const url=route.request().url(); if (!url.startsWith(base)) return route.abort();
   if (url.includes('/js/pages/planning-moteur.js?') && ++requetes <= 2) return route.abort('failed');
   if (url.includes('/js/pages/planning-interface.js?')) {
    const reponse = await route.fetch();
    const source = await reponse.text();
    return route.fulfill({response:reponse,body:'window.__moteurManquantAuChargement = typeof v3Save !== "function";\n'+source});
   }
   return route.continue();
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:90000});
  assert.ok(requetes >= 3, 'le script temporairement indisponible est redemandé');
  assert.equal(await page.evaluate(()=>typeof v3Save),'function');
  assert.equal(await page.evaluate(()=>window.__moteurManquantAuChargement),false,'les dépendants attendent le moteur');
  assert.equal(await page.locator('.boot-modules-erreur').count(),0);
  assert.deepEqual(erreurs,[]); console.log('OK démarrage : panne transitoire du moteur, reprise et ordre des dépendances');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
