/* Test de la page d’écoute des pistes actuellement activées. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const {chromium} = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8691/';
const browser = await chromium.launch(portable ? {executablePath: await portable.executablePath(), args: portable.args.filter(x => x !== '--single-process')} : {});
try {
  for (const width of [320, 1280]) {
    const page = await browser.newPage({viewport: {width, height: 800}, serviceWorkers: 'block'});
    const response = await page.goto(new URL('livrables/publication-voix/essai-feminine/', site).href);
    assert.equal(response.status(), 200);
    assert.equal(await page.locator('audio').count(), 63);
    assert.equal(await page.locator('audio[aria-label]').count(), 63);
    for (const [n, nom] of [[16,'16-sese'], [42,'42-nouvelle'], [43,'43-nouvelle'], [51,'51-cinquante-tiret-une'], [56,'56-nouvelle'], [57,'57-nouvelle']]) {
      assert.equal(await page.locator(`audio[aria-label="Écouter : Pause de ${n} minutes"]`).getAttribute('src'), `harmonise/${nom}.mp3`);
    }
    assert.equal(await page.locator('audio[aria-label="Écouter : Pause de 60 minutes"]').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `débordement à ${width}px`);
    if (width === 1280) {
    const result = await page.evaluate(async () => {
      const context = new AudioContext();
      try {
        const audios = Array.from(document.querySelectorAll('audio'));
        const resultats = [];
        for (let i = 0; i < audios.length; i += 5) resultats.push(...await Promise.all(audios.slice(i, i + 5).map(async audio => {
          const response = await fetch(audio.src);
          if (!response.ok) throw new Error(`Audio HTTP ${response.status}: ${audio.src}`);
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          return {duration: buffer.duration, channels: buffer.numberOfChannels};
        })));
        return resultats;
      } finally { await context.close(); }
    });
    assert.equal(result.length, 63);
    assert.ok(result.every(x => x.duration > 0.5 && x.duration < 20 && x.channels >= 1));
    }
    await page.close();
  }
  console.log('OK : page responsive et 63 pistes décodées en navigateur (qualité auditive non vérifiée)');
} finally { await browser.close(); }
