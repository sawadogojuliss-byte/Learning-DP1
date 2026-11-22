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
    assert.equal(await page.locator('audio').count(), 40);
    assert.equal(await page.locator('audio[aria-label]').count(), 40);
    assert.equal(await page.locator('audio[aria-label="Écouter : Pause de 16 minutes"]').getAttribute('src'), 'harmonise/16-nouvelle.mp3');
    assert.equal(await page.locator('audio[aria-label="Écouter : Pause de 38 minutes"]').count(), 0);
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
    assert.equal(result.length, 40);
    assert.ok(result.every(x => x.duration > 0.5 && x.duration < 20 && x.channels >= 1));
    }
    await page.close();
  }
  console.log('OK : page responsive et 40 pistes décodées en navigateur (qualité auditive non vérifiée)');
} finally { await browser.close(); }
