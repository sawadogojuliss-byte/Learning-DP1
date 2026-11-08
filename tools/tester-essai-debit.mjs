/* La page Studyplan doit permettre d'écouter l'essai et la référence inchangée. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8599/';
const browser = await chromium.launch({ ...(portable ? { executablePath: await portable.executablePath() } : {}), args: [...(portable ? portable.args.filter(x => x !== '--single-process') : []), '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
try {
  for (const viewport of [{width: 320, height: 568}, {width: 1280, height: 800}]) {
    const page = await browser.newPage({ viewport, serviceWorkers: 'block' });
    const response = await page.goto(new URL('livrables/publication-voix/essai-debit.html', site).href);
    assert.equal(response.status(), 200);
    const resultats = await page.evaluate(async () => {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const lectures = Array.from(document.querySelectorAll('audio'));
      return await Promise.all(lectures.map(async el => {
        const reponse = await fetch(el.src);
        const son = await context.decodeAudioData(await reponse.arrayBuffer());
        const b = el.getBoundingClientRect();
        return { ok: reponse.ok, secondes: son.duration, accessible: el.controls && b.left >= 0 && b.right <= innerWidth };
      }));
    });
    assert.equal(resultats.length, 2);
    for (const r of resultats) { assert.equal(r.ok, true); assert.equal(r.accessible, true); assert.ok(r.secondes > 3 && r.secondes < 8); }
    const pageTraitement = new URL('livrables/publication-voix/essai-traitement/', site).href;
    assert.equal((await page.goto(pageTraitement)).status(), 200);
    const audiosTraites = await page.evaluate(async () => {
      const contexte = new (window.AudioContext || window.webkitAudioContext)();
      return await Promise.all(Array.from(document.querySelectorAll('audio')).map(async el => {
        const r = await fetch(el.src); const data = await contexte.decodeAudioData(await r.arrayBuffer());
        const b = el.getBoundingClientRect();
        return { ok: r.ok, secondes: data.duration, accessible: el.controls && b.left >= 0 && b.right <= innerWidth };
      }));
    });
    assert.equal(audiosTraites.length, 2);
    for (const r of audiosTraites) { assert.equal(r.ok, true); assert.equal(r.accessible, true); assert.ok(r.secondes > 4 && r.secondes < 12); }
    const nouvellePrise = await page.evaluate(async url => {
      const r = await fetch(url); if (!r.ok) return null;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      return (await ctx.decodeAudioData(await r.arrayBuffer())).duration;
    }, new URL('livrables/publication-voix/essai-prononciation-claire-5.mp3', site).href);
    assert.ok(nouvellePrise > 3 && nouvellePrise < 8, 'essai de prononciation absent ou illisible');
    await page.close();
  }
  console.log('OK lecteur Studyplan : essai fluide et reprise de référence décodés sur mobile et ordinateur');
} finally { await browser.close(); }
