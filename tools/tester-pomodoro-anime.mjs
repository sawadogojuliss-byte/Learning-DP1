/* STUDY_TEST_MODULES=/chemin/node_modules LD_LIBRARY_PATH=... node tools/tester-pomodoro-anime.mjs
   Le serveur STUDY_SITE sert le dépôt. Aucun compte réel ni donnée réelle. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8501/';
const browser = await chromium.launch({executablePath: await portable.executablePath(), args: [...portable.args.filter(x => x !== '--single-process'), '--autoplay-policy=no-user-gesture-required']});
try {
  for (const viewport of [{width:390,height:844},{width:1280,height:800}]) {
    const page = await browser.newPage({viewport}); const erreurs = [];
    page.on('pageerror', e => erreurs.push(String(e)));
    await page.route('**/*', r => r.request().url().startsWith(site) ? r.continue() : r.abort());
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    await page.goto(site, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), {timeout:60000});
    await page.evaluate(() => {
      document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active'));
      document.getElementById('planningModal').classList.add('active');
      navigateTo('pomodoro'); focusBasculerReglages(); focusChoisirOnglet('themes');
    });
    assert.equal(await page.locator('#focusReglages').isVisible(), true);
    assert.deepEqual(await page.locator('#focusThemesCorps .focus-rangee h4').allTextContents().then(a => a.slice(-1)), ['Animé']);
    const tuile = page.locator('#focusThemesCorps .focus-rangee').last().locator('.focus-tuile-theme');
    assert.equal(await tuile.count(), 1);
    assert.match(await tuile.innerText(), /Chalet sous la neige/);
    await tuile.click();
    const video = page.locator('#focusBg video');
    await page.waitForFunction(() => { const v=document.querySelector('#focusBg video'); return v && v.readyState >= 2 && !v.paused && v.currentTime > .1 && v.classList.contains('is-visible'); }, {timeout:30000});
    let etat = await video.evaluate(v => ({loop:v.loop, muted:v.muted, inline:v.playsInline, duration:v.duration, time:v.currentTime}));
    assert.equal(etat.loop,true); assert.equal(etat.muted,true); assert.equal(etat.inline,true); assert.ok(etat.duration > 10);
    await page.waitForTimeout(550); assert.ok(await video.evaluate(v => v.currentTime) > etat.time);
    /* Fin atteinte : le lecteur revient au début et continue de tourner. */
    await video.evaluate(v => { v.currentTime = v.duration - .4; });
    await page.waitForFunction(() => { const v=document.querySelector('#focusBg video'); return v && v.currentTime < 2 && !v.paused; }, {timeout:10000});
    assert.equal(await tuile.getAttribute('aria-pressed'), 'true');
    await page.locator('#focusFiltresFonds [data-cat="anime"]').click();
    assert.equal(await page.locator('#focusThemesCorps .focus-grille-fonds .focus-tuile-theme').count(), 1);
    await page.evaluate(() => { focusPoserFond(focusIndexParId('lumiere')); });
    assert.equal(await video.count(),0,'la vidéo est retirée pour un thème statique');
    await page.waitForFunction(() => document.querySelector('#focusBg').style.backgroundImage.includes('lumiere.webp'));
    await page.evaluate(() => { focusPoserFond(focusIndexParId('chalet-neige-anime')); });
    await page.waitForFunction(() => document.querySelector('#focusBg video')?.currentTime > .1, {timeout:30000});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), {timeout:60000});
    await page.evaluate(() => { document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active')); document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); });
    assert.equal(await page.evaluate(() => FOCUS_FONDS[focusEtat.fond].id), 'chalet-neige-anime');
    await page.waitForFunction(() => document.querySelector('#focusBg video')?.currentTime > .1, {timeout:30000});
    await page.evaluate(() => navigateTo('seances'));
    await page.waitForFunction(() => !document.querySelector('#focusBg video') && document.querySelector('#focusAccueilFond video'));
    await page.evaluate(() => navigateTo('exercices'));
    await page.waitForFunction(() => !document.querySelector('#focusAccueilFond video') && !document.querySelector('#focusBg video'));
    assert.deepEqual(erreurs, []);
    console.log('OK thèmes, lecture et boucle, restauration et navigation :', viewport.width+'×'+viewport.height);
    await page.close();
  }
} finally { await browser.close(); }
