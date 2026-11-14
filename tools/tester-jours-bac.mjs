/* Parcours réel dans le navigateur : classe DP2 et jour consulté pendant une restauration. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8640/';
const browser = await chromium.launch(portable ? { executablePath: await portable.executablePath(), args: portable.args.filter(x => x !== '--single-process') } : {});
try {
  for (const reponse of ['Oui', 'Non']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.route('**/*', r => r.request().url().startsWith(site) ? r.continue() : r.abort());
    await page.clock.install({ time: new Date('2031-06-18T10:00:00') }); // mercredi
    await page.goto(site, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
    await page.evaluate(() => { document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active')); showClassePage(); });
    await page.locator('#classeChoices button').filter({ hasText: 'DP1' }).click();
    assert.equal(await page.locator('#bacQuestionModal').count(), 0, 'DP1 ne demande pas le bac');
    await page.locator('#classeChoices button').filter({ hasText: 'DP2' }).click();
    assert.equal(await page.locator('#bacQuestionModal').count(), 1, 'DP2 demande immédiatement le bac');
    await page.locator('#bacQuestion' + reponse).click();
    assert.equal(await page.locator('#bacQuestionModal').count(), 0);
    assert.equal(await page.locator('#classeModal.active').count(), 1, 'répondre ne quitte pas la classe');
    assert.equal(await page.evaluate(() => devoirsLireStore().bac), reponse === 'Oui');
    const blocs = await page.evaluate(() => ({ vendredi: generateDayEvents(4).some(e => e.id === 'bac-vendredi'), samedi: generateDayEvents(5).some(e => e.id === 'bac-samedi') }));
    assert.deepEqual(blocs, { vendredi: reponse === 'Oui', samedi: reponse === 'Oui' });
    // Une restauration d'une copie contradictoire plus ancienne ne doit pas
    // annuler le choix local ni faire réapparaître les blocs du bac.
    const restauration=await page.evaluate((choix)=>{
      const profil=memoireLireEtat();profil.devoirsStore={bac:!choix,bacDemande:2,bacModifieAt:1,devoirs:[],examens:[]};
      memoireAppliquer(profil,{compte:true});return {bac:devoirsLireStore().bac,v:generateDayEvents(4).some(e=>e.id==='bac-vendredi'),s:generateDayEvents(5).some(e=>e.id==='bac-samedi')};
    },reponse==='Oui');
    assert.deepEqual(restauration,{bac:reponse==='Oui',v:reponse==='Oui',s:reponse==='Oui'},'restauration ancienne ne doit pas inverser la réponse');
    // Le store du compte précédent ne doit pas contaminer le compte entrant,
    // même si ce dernier n'a pas encore de données BAC.
    const isolation = await page.evaluate((choix) => {
      const original=devoirsStoreCompact(), profil=memoireLireEtat();
      window.compteChangementDeCompte=true;
      profil.devoirsStore={bac:!choix,bacDemande:2,bacModifieAt:1,devoirs:[],examens:[]};
      memoireAppliquer(profil,{compte:true});const autre=devoirsLireStore().bac;
      delete profil.devoirsStore;memoireAppliquer(profil,{compte:true});const absent=devoirsLireStore().bac;
      window.compteChangementDeCompte=false;devoirsEcrireStore(original,{brut:true});
      return {autre,absent};
    },reponse==='Oui');
    assert.deepEqual(isolation,{autre:reponse!=='Oui',absent:null},'isolation des comptes avec ou sans ancien store');
    // Changer ou reconfirmer la réponse sans devoir recréer son compte.
    await page.evaluate(() => { document.getElementById('classeModal').classList.remove('active'); navigateTo('devoirs'); devoirsRendre(); });
    assert.equal(await page.locator('#devoirsBacEtat').textContent(), reponse);
    await page.getByRole('button',{name:'Modifier ma réponse'}).click();
    await page.locator('#bacQuestionAnnuler').click();
    assert.equal(await page.evaluate(() => devoirsLireStore().bac), reponse === 'Oui');
    await page.getByRole('button',{name:'Modifier ma réponse'}).click();
    await page.locator('#bacQuestion'+(reponse==='Oui'?'Non':'Oui')).click();
    assert.equal(await page.evaluate(() => devoirsLireStore().bac), reponse !== 'Oui');
    assert.equal(await page.evaluate(() => generateDayEvents(4).some(e=>e.id==='bac-vendredi')),reponse !== 'Oui');
    await page.getByRole('button',{name:'Modifier ma réponse'}).click();
    await page.locator('#bacQuestion'+reponse).click();
    assert.equal(await page.locator('#devoirsBacEtat').textContent(), reponse);
    await page.evaluate(() => { document.getElementById('panelDevoirs').classList.remove('active'); showClassePage(); });
    await page.locator('#classeChoices button').filter({ hasText: 'DP2' }).click();
    assert.equal(await page.locator('#bacQuestionModal').count(), 0, 'pas de redemande après réponse');
    await page.locator('#classeContinueBtn').click();
    assert.equal(await page.locator('#objectivesModal.active').count(), 1, 'Continuer mène normalement aux objectifs');
    await page.evaluate(() => { document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active')); document.getElementById('planningModal').classList.add('active'); window.__profilComplet = true; renderPlanning(); });
    await page.locator('#dayNavigation .planning-jour').nth(0).click();
    assert.equal(await page.evaluate(() => selectedDay), 0);
    await page.evaluate(() => { const copie = memoireLireEtat(); compteAfficherProfil(copie); });
    assert.equal(await page.evaluate(() => selectedDay), 0, 'la réception conserve lundi');
    assert.equal(await page.locator('#dayNavigation .planning-jour[aria-pressed="true"]').count(), 1);
    assert.equal(await page.locator('#dayNavigation .planning-jour').nth(0).getAttribute('aria-pressed'), 'true');
    await page.locator('#dayNavigation .planning-jour').nth(4).click();
    assert.equal(await page.evaluate(() => selectedDay), 4, 'les autres jours restent accessibles');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => devoirsLireStore().bac), reponse === 'Oui', 'réponse conservée au rechargement');
    if(reponse==='Non') {
      const ancien=await page.evaluate(()=>{
        ibYear='DP2';subjects=[{name:'Mathématiques'},{name:'Bac national'}];optionalSubjects=[{name:'BAC NATIONAL'}];
        devoirsRendre();return {matieres:exoSujets().map(s=>s.name),suggestions:Array.from(document.querySelectorAll('#devoirsMatiereListe option')).map(x=>x.value),vendredi:generateDayEvents(4).some(e=>e.id==='bac-vendredi'),samedi:generateDayEvents(5).some(e=>e.id==='bac-samedi')};
      });
      assert.deepEqual(ancien,{matieres:['Mathématiques'],suggestions:['Mathématiques'],vendredi:false,samedi:false},'un BAC ancien ne reparaît pas dans les choix ni le planning après Non');
    }
    assert.deepEqual(errors, []);
    console.log('OK DP2 ' + reponse + ' : question immédiate, planning adapté, jour choisi conservé.');
    await page.close();
  }
} finally { await browser.close(); }
