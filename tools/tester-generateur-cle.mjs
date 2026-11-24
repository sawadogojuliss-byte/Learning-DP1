/* Clé générée dans le navigateur de test uniquement, aucun secret réel. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const site=process.env.STUDY_SITE||'http://127.0.0.1:8698/';
const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
try {
 const page=await browser.newPage({serviceWorkers:'block'}), requetes=[];
 page.on('request', r=>requetes.push(r.url()));
 await page.route('**/*', r=>r.request().url().startsWith(site)?r.continue():r.abort());
 await page.goto(site+'livrables/generer-cle-mail.html');
 await page.locator('#creer').click();
 const une=await page.locator('#cle').inputValue();
 assert.match(une,/^[0-9a-f]{64}$/);
 await page.locator('#creer').click();
 const deux=await page.locator('#cle').inputValue();
 assert.match(deux,/^[0-9a-f]{64}$/); assert.notEqual(une,deux);
 assert.deepEqual(requetes,[site+'livrables/generer-cle-mail.html']);
 assert.equal(await page.evaluate(()=>localStorage.length),0);
 console.log('ok générateur local : 256 bits, renouvellement, pas de stockage ni réseau');
} finally {await browser.close()}
