/* Réception simulée dans le vrai navigateur : même minuteur et saisie non interrompue. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const {chromium} = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8643/';
const browser = await chromium.launch(portable ? {executablePath:await portable.executablePath(), args:portable.args.filter(x=>x!=='--single-process')} : {});
try {
  for (const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]) {
    const page = await browser.newPage({viewport, serviceWorkers:'block'}), errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.route('**/*',r=>r.request().url().startsWith(site)?r.continue():r.abort());
    await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true;});
    await page.goto(site,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
    await page.evaluate(()=>{
      document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));
      document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro');
      focusEcrireReglages({citation:true,citationCategorie:'personnelle',citationPersonnelle:'Citation locale'}); focusPeindre();
      window.__recevoirCitation = function(texte) {
        var data = memoireLireEtat();
        var reglages = syncFocusLire(); reglages.modifieAt = Math.max(Date.now(), syncFocusCourant().modifieAt + 1000);
        reglages.parametres = Object.assign({}, reglages.parametres, {citation:true,citationCategorie:'personnelle',citationPersonnelle:texte});
        data.focusReglages = reglages;
        compteAfficherProfil(data);
      };
    });
    assert.equal(await page.evaluate(()=>focusEtat.running),false);
    await page.evaluate(()=>window.__recevoirCitation('Reçue de mon autre appareil'));
    assert.equal(await page.locator('#focusCitation').textContent(),'“Reçue de mon autre appareil”','actualisation sans démarrer le minuteur');
    assert.equal(await page.evaluate(()=>focusEtat.running),false);
    await page.locator('#focusBtnReglages').click();
    await page.locator('.focus-tiroir-item[data-onglet="citations"]').click();
    const champ=page.locator('#focusCitationPersonnelle');
    assert.equal(await champ.inputValue(),'Reçue de mon autre appareil');
    assert.match(await page.locator('.focus-citation-personnelle small').innerText(),/synchronisée avec ton compte/);
    await champ.focus();
    await page.evaluate(()=>window.__recevoirCitation('Une nouvelle citation'));
    assert.equal(await champ.inputValue(),'Reçue de mon autre appareil','la saisie active reste intacte');
    assert.equal(await page.locator('#focusCitation').textContent(),'“Une nouvelle citation”');
    await champ.blur();
    assert.equal(await champ.inputValue(),'Une nouvelle citation','la dernière valeur reçue apparaît après sortie du champ');
    await page.locator('.focus-tiroir-fermer').click();
    await page.locator('#focusPlay').click();
    const fin = await page.evaluate(()=>focusEtat.fin);
    assert.equal(await page.evaluate(()=>focusEtat.running),true);
    await page.evaluate(()=>window.__recevoirCitation('Nouvelle motivation'));
    assert.equal(await page.locator('#focusCitation').textContent(),'“Nouvelle motivation”');
    assert.equal(await page.evaluate(()=>focusEtat.running && focusEtat.fin),fin,'la réception ne redémarre ni ne coupe le minuteur');
    assert.deepEqual(errors,[]);
    console.log(`OK réception citation sans interrompre minuteur ou saisie ${viewport.width}px`);
    await page.close();
  }
} finally { await browser.close(); }
