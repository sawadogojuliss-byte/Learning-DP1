/* Parcours réel navigateur : aucune image personnelle ne quitte l'appareil. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8628/';
const browser = await chromium.launch(portable ? { executablePath: await portable.executablePath(), args: portable.args.filter(x => x !== '--single-process') } : {});
async function image(page, w, h, mime) {
  const url = await page.evaluate(({ w, h, mime }) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#189a77'; x.fillRect(0, 0, w, h); return c.toDataURL(mime); }, { w, h, mime });
  return Buffer.from(url.split(',')[1], 'base64');
}
async function ouvrir(page) {
  await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
  await page.evaluate(() => { document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active')); document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); focusBasculerReglages(); focusChoisirOnglet('themes'); });
  await page.locator('#focusThemePersonnel').scrollIntoViewIfNeeded();
}
async function fichier(page, name, mimeType, buffer) { await page.locator('#focusPersonnelFichier').setInputFiles({ name, mimeType, buffer }); }
try {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const ctx = await browser.newContext({ viewport, serviceWorkers: 'block' });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('**/*', r => r.request().url().startsWith(site) ? r.continue() : r.abort());
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    await ouvrir(page);
    const panel = page.locator('#focusThemePersonnel'), dialog = page.locator('#focusPersonnelErreur');
    assert.equal(await panel.isVisible(), true);
    assert.equal(await dialog.evaluate(el => el.open), false, 'aucune popup avant un choix invalide');
    assert.equal(await page.locator('#focusPersonnelSecondaires').isVisible(), false);
    const box = await panel.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= viewport.width + 1, 'carte dans l’écran');
    const portrait = await image(page, 80, 120, 'image/png');
    await fichier(page, 'vertical.png', 'image/png', portrait);
    await dialog.waitFor({ state: 'visible' });
    assert.match(await dialog.innerText(), /horizontale/i);
    assert.match(await dialog.innerText(), /JPG, PNG ou WebP/);
    assert.match(await dialog.innerText(), /10 Mo/);
    assert.match(await page.locator('#focusPersonnelErreurTexte').innerText(), /verticale ou carrée/);
    assert.notEqual(await page.evaluate(() => FOCUS_FONDS[focusEtat.fond].id), 'personnel-local');
    await page.locator('.focus-perso-dialog-fermer').click();
    assert.equal(await dialog.evaluate(el => el.open), false);
    await fichier(page, 'square.png', 'image/png', await image(page, 80, 80, 'image/png'));
    await dialog.waitFor({ state: 'visible' }); await page.keyboard.press('Escape');
    assert.equal(await dialog.evaluate(el => el.open), false, 'Échap ferme la fenêtre');
    await fichier(page, 'document.pdf', 'application/pdf', Buffer.from('%PDF')); await dialog.waitFor({ state: 'visible' });
    assert.match(await page.locator('#focusPersonnelErreurTexte').innerText(), /format/); await page.locator('.focus-perso-dialog-fermer').click();
    await fichier(page, 'corrompue.png', 'image/png', Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.from('pas une image')])); await dialog.waitFor({ state: 'visible' });
    assert.match(await page.locator('#focusPersonnelErreurTexte').innerText(), /ne peut pas être lue/); await page.locator('.focus-perso-dialog-fermer').click();
    await fichier(page, 'usurpation.png', 'image/png', Buffer.from('GIF89a')); await dialog.waitFor({ state: 'visible' });
    assert.match(await page.locator('#focusPersonnelErreurTexte').innerText(), /format/); await page.locator('.focus-perso-dialog-fermer').click();
    await fichier(page, 'grande.jpg', 'image/jpeg', Buffer.alloc(10 * 1024 * 1024 + 1)); await dialog.waitFor({ state: 'visible' });
    assert.match(await page.locator('#focusPersonnelErreurTexte').innerText(), /taille/); await page.locator('.focus-perso-dialog-fermer').click();
    for (const [mime, ext] of [['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]) {
      await fichier(page, `paysage.${ext}`, mime, await image(page, 160, 90, mime));
      await page.waitForFunction(() => FOCUS_FONDS[focusEtat.fond].id === 'personnel-local' && document.getElementById('focusPersonnelImporter').disabled === false, null, { timeout: 20000 });
      assert.equal(await dialog.evaluate(el => el.open), false, mime + ' accepté sans popup');
      assert.equal(await page.locator('#focusPersonnelSecondaires').isVisible(), true);
      assert.equal(await page.locator('#focusPersonnelUtiliser').isDisabled(), true);
      assert.ok((await page.locator('#focusBg').evaluate(el => el.style.backgroundImage)).includes('blob:'), 'fond du minuteur');
      assert.ok((await page.locator('#focusAccueilFond').evaluate(el => el.style.backgroundImage)).includes('blob:'), 'fond des séances');
    }
    // Un refus ne détruit pas le fond déjà choisi.
    await fichier(page, 'encore-verticale.png', 'image/png', portrait); await dialog.waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => FOCUS_FONDS[focusEtat.fond].id), 'personnel-local');
    await page.locator('.focus-perso-dialog-fermer').click();
    // Réouverture : le fichier et le choix personnel survivent au rechargement.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
    await page.evaluate(() => { document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active')); document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro'); focusBasculerReglages(); focusChoisirOnglet('themes'); });
    await page.waitForFunction(() => FOCUS_FONDS[focusEtat.fond].id === 'personnel-local' && !!focusPersonnelUrl, null, { timeout: 20000 });
    assert.ok((await page.locator('#focusBg').evaluate(el => el.style.backgroundImage)).includes('blob:'));
    // Choisir un thème prédéfini puis revenir à sa photo sans la réimporter.
    await page.evaluate(() => focusPoserFond(focusIndexParId('lumiere')));
    await page.locator('#focusThemePersonnel').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#focusPersonnelUtiliser').isEnabled(), true);
    await page.locator('#focusPersonnelUtiliser').click();
    assert.equal(await page.evaluate(() => FOCUS_FONDS[focusEtat.fond].id), 'personnel-local');
    // Une erreur de stockage ne remplace ni ne supprime l'image existante.
    await page.evaluate(() => { window.__stockageTheme = focusPersonnelStocker; focusPersonnelStocker = (action, blob) => action === 'ecrire' ? Promise.reject(new Error('quota')) : window.__stockageTheme(action, blob); });
    await fichier(page, 'quota.jpg', 'image/jpeg', await image(page, 160, 90, 'image/jpeg'));
    await dialog.waitFor({ state: 'visible' }); assert.match(await page.locator('#focusPersonnelErreurTexte').innerText(), /enregistrée/);
    assert.equal(await page.evaluate(() => FOCUS_FONDS[focusEtat.fond].id), 'personnel-local');
    await page.locator('.focus-perso-dialog-fermer').click(); await page.evaluate(() => { focusPersonnelStocker = window.__stockageTheme; });
    // Changer de thème pendant une écriture lente ne doit pas imposer la photo,
    // et celle-ci doit rester disponible sans recharger.
    await page.evaluate(() => {
      window.__stockageTheme = focusPersonnelStocker;
      focusPersonnelStocker = (action, blob) => action === 'ecrire'
        ? new Promise((resolve, reject) => { window.__terminerEcriture = () => window.__stockageTheme(action, blob).then(resolve, reject); })
        : window.__stockageTheme(action, blob);
    });
    await fichier(page, 'lente.png', 'image/png', await image(page, 160, 90, 'image/png'));
    await page.waitForFunction(() => typeof window.__terminerEcriture === 'function');
    await page.evaluate(() => { focusPoserFond(focusIndexParId('lumiere')); window.__terminerEcriture(); });
    await page.waitForFunction(() => !focusPersonnelOccupe);
    assert.equal(await page.evaluate(() => FOCUS_FONDS[focusEtat.fond].id), 'lumiere');
    assert.equal(await page.locator('#focusPersonnelUtiliser').isEnabled(), true);
    await page.locator('#focusPersonnelUtiliser').click();
    assert.equal(await page.evaluate(() => FOCUS_FONDS[focusEtat.fond].id), 'personnel-local');
    await page.evaluate(() => { focusPersonnelStocker = window.__stockageTheme; });
    await page.locator('#focusPersonnelSecondaires button').last().click();
    await page.waitForFunction(() => !focusPersonnelUrl, null, { timeout: 10000 });
    assert.notEqual(await page.evaluate(() => FOCUS_FONDS[focusEtat.fond].id), 'personnel-local');
    assert.equal(await page.locator('#focusPersonnelSecondaires').isVisible(), false);
    assert.deepEqual(errors, []);
    await ctx.close(); console.log(`OK photo personnelle, formats, erreurs, stockage, rechargement et suppression ${viewport.width}×${viewport.height}`);
  }
} finally { await browser.close(); }
