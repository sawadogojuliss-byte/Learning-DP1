/* Profil fictif, aucune donnée réelle. STUDY_SITE et STUDY_TEST_MODULES configurables. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const {chromium} = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8508/';
const browser = await chromium.launch(portable ? {executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')} : {});
async function boot(page) {
  await page.waitForFunction(()=>window.__STUDYPLAN_READY && !document.body.classList.contains('booting'),null,{timeout:60000});
  await page.evaluate(()=>{
    document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));
    document.getElementById('planningModal').classList.add('active');
    userName='Test'; subjects=[{name:'Mathématiques',icon:'🔢',level:'HL'},{name:'Français',icon:'📚',level:'SL'}]; optionalSubjects=[];
    navigateTo('exercices');
  });
}
async function noOverflow(page) {
  const bad=await page.locator('#panelExercices').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
  assert.ok(bad.scroll <= bad.client+1, `débordement horizontal : ${JSON.stringify(bad)}`);
}
try {
  for (const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]) {
    const context=await browser.newContext({viewport}); const page=await context.newPage(); const erreurs=[];
    page.on('pageerror',e=>erreurs.push(String(e)));
    await page.route('**/*',r=>r.request().url().startsWith(site)?r.continue():r.abort());
    await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true});
    await page.goto(site,{waitUntil:'domcontentloaded'}); await boot(page);
    assert.equal(await page.locator('#panelExercices').isVisible(),true);
    await page.waitForFunction(() => Math.abs(document.getElementById('panelExercices').getBoundingClientRect().left) < 1);
    assert.equal(await page.locator('#exoSubjectGrid button').count(),2);
    await noOverflow(page);
    if(process.env.STUDY_TEST_CAPTURE) await page.screenshot({path:`${process.env.STUDY_TEST_CAPTURE}/exercices-design-${viewport.width}.png`});
    await page.locator('.ed-submit').click();
    assert.match(await page.locator('#exoSubjectErreur').innerText(),/Choisis une matière/);
    await page.locator('#exoSubjectGrid button').first().click();
    assert.equal(await page.locator('#exoSubjectGrid button').first().getAttribute('aria-pressed'),'true');
    await page.locator('.ed-submit').click(); assert.match(await page.locator('#exoContenuErreur').innerText(),/Décris/);
    await page.locator('#exoTextInput').fill('Dérivées, page 47');
    await page.locator('.ed-submit').click(); assert.match(await page.locator('#exoDeadlineErreur').innerText(),/date limite/);
    const date=await page.evaluate(()=>exoDateLocale(new Date(Date.now()+8*86400000)));
    await page.locator('#exoDeadline').fill(date);
    await page.locator('.exo-preset').nth(1).click(); assert.equal(await page.locator('#exoDurationLabel').innerText(),'45min');
    await page.locator('#exoDurationSlider').fill('75'); assert.equal(await page.locator('#exoDurationLabel').innerText(),'1h15min');
    await page.evaluate(()=>navigateTo('planning')); await page.evaluate(()=>navigateTo('exercices'));
    assert.equal(await page.locator('#exoTextInput').inputValue(),'Dérivées, page 47');
    assert.equal(await page.locator('#exoDeadline').inputValue(),date);
    assert.equal(await page.locator('#exoDurationSlider').inputValue(),'75');
    await page.locator('#fileUploadInput').setInputFiles({name:'fiche-maths.pdf',mimeType:'application/pdf',buffer:Buffer.from('test')});
    assert.match(await page.locator('#uploadedFileName').innerText(),/fichier non conservé/);
    await page.locator('.ed-submit').click();
    assert.equal(await page.locator('#tabListe').getAttribute('aria-selected'),'true');
    assert.match(await page.locator('#exoListContainer').innerText(),/fiche-maths.pdf/);
    let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('studyPlanIB_exercices')));
    assert.equal(saved.length,1); assert.equal(saved[0].duration,75); assert.equal(saved[0].filename,'fiche-maths.pdf');
    assert.equal(saved[0].text,'Dérivées, page 47'); assert.equal(saved[0].deadline,date);
    await noOverflow(page);
    if(process.env.STUDY_TEST_CAPTURE) await page.screenshot({path:`${process.env.STUDY_TEST_CAPTURE}/exercices-liste-${viewport.width}.png`});
    await page.locator('[data-exo-action=fait]').click(); assert.equal(await page.locator('#exoCountBadge').innerText(),'0 exercice à faire');
    await page.locator('[data-exo-filtre=afaire]').click(); assert.match(await page.locator('#exoListContainer').innerText(),/Aucun exercice à faire/);
    await page.locator('[data-exo-filtre=faits]').click(); assert.equal(await page.locator('[data-exo-action=fait]').count(),1);
    await page.locator('[data-exo-action=fait]').click();
    await page.locator('[data-exo-filtre=tous]').click();
    await page.locator('[data-exo-action=planifier]').click();
    assert.equal(await page.locator('#tabPlanifier').getAttribute('aria-selected'),'true');
    assert.doesNotMatch(await page.locator('#planifierContent').innerText(),/Résumé global/);
    assert.match(await page.locator('#planifierContent').innerText(),/Combien|Comment veux-tu avancer/);
    // Planning fictif vide : inclut les séances datées après confirmation.
    await page.evaluate(()=>{ generateDayEvents = (day,date) => customEvents.filter(e=>e && e.date && date && e.date===exoDateLocale(date) && e.day===day && !e.deleted); renderPlanifier(); });
    await page.locator('[data-exo-action=auto]').click();
    assert.ok(await page.locator('[data-exo-action=choisir]').count()>0,'des séances fictives doivent être proposées');
    await noOverflow(page);
    if(process.env.STUDY_TEST_CAPTURE) await page.screenshot({path:`${process.env.STUDY_TEST_CAPTURE}/exercices-planifier-${viewport.width}.png`});
    await page.locator('[data-exo-action=choisir]').first().click();
    saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('studyPlanIB_exercices')));
    assert.ok(saved[0].scheduledSlot); assert.ok(await page.evaluate(()=>customEvents.some(e=>e.exoId===exercices[0].id)));
    await page.locator('#tabListe').click(); await page.locator('[data-exo-action=supprimer]').click();
    assert.equal(await page.locator('[data-exo-action=fait]').count(),0);
    await page.locator('.suppression-toast button').getByText('Annuler').click();
    assert.equal(await page.locator('[data-exo-action=fait]').count(),1);
    assert.ok(await page.evaluate(()=>customEvents.some(e=>e.exoId===exercices[0].id)));
    await page.reload({waitUntil:'domcontentloaded'}); await boot(page); await page.locator('#tabListe').click();
    assert.match(await page.locator('#exoListContainer').innerText(),/fiche-maths.pdf/);
    assert.match(await page.locator('#exoListContainer').innerText(),/Planifié/);
    await page.locator('#tabAjouter').click(); await page.locator('#exoTextInput').fill('Un brouillon');
    await page.locator('.ed-clear').click(); assert.equal(await page.locator('#exoTextInput').inputValue(),'');
    await page.locator('.ed-back').click(); assert.equal(await page.locator('#panelExercices').isVisible(),false);
    assert.deepEqual(erreurs,[]); console.log(`OK Exercices : interactions, persistance, planification et navigation ${viewport.width}×${viewport.height}`);
    await context.close();
  }
} finally {await browser.close();}
