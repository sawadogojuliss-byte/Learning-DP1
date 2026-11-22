/* Lecture réelle des nouvelles prises et du secours masculin, sans écoute humaine. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const {chromium} = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8691/';
const browser = await chromium.launch({args: [...(portable ? portable.args.filter(x => x !== '--single-process') : []), '--autoplay-policy=no-user-gesture-required', '--mute-audio'], ...(portable ? {executablePath: await portable.executablePath()} : {})});
try {
  const page = await browser.newPage({serviceWorkers: 'block'});
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('**/*', r => r.request().url().startsWith(site) ? r.continue() : r.abort());
  await page.addInitScript(() => {window.__STUDYPLAN_E2E = true;});
  await page.goto(site, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, {timeout:60000});
  const result = await page.evaluate(async () => {
    localStorage.setItem('studyPlanIB_voixType','feminine');
    localStorage.setItem('studyPlanIB_voixActive','true');
    chronoVoixPreparer([5, 8]);
    const names = ['feminine-complet-5','masculine-complet-8','feminine-fin-une-seance','feminine-fin-serie','feminine-reprise'];
    await Promise.all(names.map(chronoVoixCharger));
    const ctx = chronoVoixContexte();
    await ctx.resume();
    const played = [];
    const original = chronoVoixJouerTampons;
    chronoVoixJouerTampons = (noms, done, opts) => original(noms, ok => {played.push({nom:noms[0], ok}); done(ok);}, opts);
    try {
      await new Promise(done => chronoAnnoncerPause(5, done));
      await new Promise(done => chronoAnnoncerPause(8, done));
      await new Promise(done => chronoAnnoncerFinSerie(done, true));
      await new Promise(done => chronoAnnoncerFinSerie(done, false));
      await new Promise(done => chronoAnnoncerReprise(done));
    } finally {chronoVoixJouerTampons = original;}
    return played;
  });
  assert.deepEqual(result, ['feminine-complet-5','masculine-complet-8','feminine-fin-une-seance','feminine-fin-serie','feminine-reprise'].map(nom => ({nom, ok:true})));
  const panne = await page.evaluate(async () => {
    let synthese = false;
    const tampon = chronoVoixJouerTampons, lecteur = chronoVoixJouerLecteurs, original = chronoVoixSynthese;
    chronoVoixJouerTampons = (n, fin) => fin(false);
    chronoVoixJouerLecteurs = (n, fin) => fin(false);
    chronoVoixSynthese = () => {synthese = true;};
    try {await new Promise(done => chronoAnnoncerPause(5, done));}
    finally {chronoVoixJouerTampons = tampon; chronoVoixJouerLecteurs = lecteur; chronoVoixSynthese = original;}
    return {synthese, enCours: chronoAnnonceEnCours};
  });
  assert.deepEqual(panne, {synthese:false, enCours:false});
  assert.deepEqual(errors, []);
  console.log('OK lecture féminine, secours masculin 8 minutes, fins, reprise et panne bornée');
} finally {await browser.close();}
