/* Lots 7 et 14 : test navigateur sans compte ni données réelles. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const SITE = process.env.STUDY_SITE || 'https://sawadogojuliss-byte.github.io/Learning-DP1/';
(async function () {
    const options = { headless: true };
    if (process.env.STUDY_CHROMIUM_LOCAL) {
        const aws = require('@sparticuz/chromium');
        options.executablePath = await aws.executablePath();
        options.args = aws.args;
    }
    const browser = await chromium.launch(options);
    try {
        const page = await browser.newPage({ viewport: { width: 320, height: 720 }, reducedMotion: 'reduce' });
        const erreurs = [];
        page.on('pageerror', e => erreurs.push(e.message));
        await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
        await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
        const base = await page.evaluate(() => ({
            region: document.querySelectorAll('#annonceUnique[aria-live]').length,
            vivantes: document.querySelectorAll('[aria-live]').length,
            images: Array.from(document.querySelectorAll('img')).filter(img => !img.width || !img.height).length,
            largeur: document.documentElement.scrollWidth,
            accueil: document.documentElement.clientWidth,
            animations: getComputedStyle(document.querySelector('.shape')).animationDuration
        }));
        assert.equal(base.region, 1, 'une région persistante');
        assert.equal(base.vivantes, 1, 'aucune annonce locale en doublon');
        assert.equal(base.images, 0, 'images avec dimensions');
        assert.equal(base.largeur, base.accueil, 'pas de débordement sur l’accueil à 320 px');
        await page.evaluate(() => {
            document.querySelectorAll('.app-panel.active,.context-modal.active').forEach(el => el.classList.remove('active'));
            const bouton = document.createElement('button'); bouton.id = 'declencheur-accessibilite'; bouton.textContent = 'Ouvrir';
            document.body.appendChild(bouton); bouton.focus(); openContextModal();
        });
        await page.waitForFunction(() => document.getElementById('contextModal').contains(document.activeElement), null, { timeout: 1500 });
        assert.equal(await page.evaluate(() => document.getElementById('contextModal').contains(document.activeElement)), true, 'focus dans le dialogue');
        const avantTab = await page.evaluate(() => ({
            element: document.activeElement?.id || document.activeElement?.tagName,
            role: document.getElementById('contextModal').getAttribute('role'),
            visibilite: getComputedStyle(document.getElementById('contextModal')).visibility,
            taille: document.getElementById('contextModal').getClientRects().length,
            parent: getComputedStyle(document.getElementById('app-pages')).visibility
        }));
        await page.keyboard.press('Shift+Tab');
        const apresTab = await page.evaluate(() => ({
            dedans: document.getElementById('contextModal').contains(document.activeElement),
            element: document.activeElement?.id || document.activeElement?.tagName,
            fenetres: Array.from(document.querySelectorAll('.context-modal.active,.app-panel.active')).map(el => el.id)
        }));
        assert.equal(apresTab.dedans, true, 'focus retenu dans le dialogue : ' + JSON.stringify({ avantTab, apresTab }));
        await page.evaluate(() => { const el = document.getElementById('contextModal'); el.tabIndex = -1; el.focus(); });
        await page.keyboard.press('Shift+Tab');
        assert.equal(await page.evaluate(() => document.getElementById('contextModal').contains(document.activeElement)), true,
            'Shift+Tab ne sort pas du dialogue lorsque son conteneur porte le focus');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(80);
        assert.equal(await page.evaluate(() => document.getElementById('contextModal').classList.contains('active')), false, 'Échap ferme le dialogue');
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'declencheur-accessibilite', 'focus rendu au déclencheur');
        await page.evaluate(() => {
            document.getElementById('planningModal').classList.add('active');
            document.getElementById('panelDevoirs').classList.add('active');
        });
        await page.waitForTimeout(80);
        assert.equal(await page.evaluate(() => {
            document.getElementById('devoirsRecherche').focus();
            return document.activeElement?.id;
        }), 'devoirsRecherche', 'un panneau du menu reste accessible au-dessus du planning');
        await page.evaluate(() => {
            document.getElementById('panelDevoirs').classList.remove('active');
            document.getElementById('planningModal').classList.remove('active');
            document.getElementById('emploiModal').classList.add('active');
        });
        await page.waitForTimeout(80);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320, 'emploi à 320 px');
        await page.evaluate(() => {
            localStorage.setItem(EMPLOI_CLE, JSON.stringify({ at: 'test', jours: [[{ id:'ancien', nom:'Maths AA', debut:'08:00', fin:'09:00', src:'doc' }],[],[],[],[],[],[]] }));
            emploiMontrerPropositions({ jours: [[{ nom:'Physics', plage:{ debut:'08:30', fin:'09:30' } }],[],[],[],[],[],[]] });
        });
        assert.match(await page.locator('#emploiConflitsImport').textContent(), /1 conflit horaire/);
        assert.equal(await page.evaluate(() => document.querySelectorAll('[aria-live]').length), 1, 'messages d’import sans région vocale doublée');
        assert.equal(await page.locator('.ep-remplacer:checked').count(), 0, 'anciens jamais cochés automatiquement');
        await page.getByRole('button', { name: 'Enregistrer mes cours' }).click();
        assert.deepEqual(await page.evaluate(() => emploiScolaireJour(0).map(c => c.id)), ['ancien'], 'un conflit non validé ne modifie rien');
        await page.locator('#emploiConflitsAccord').check();
        await page.getByRole('button', { name: 'Enregistrer mes cours' }).click();
        assert.equal(await page.evaluate(() => emploiScolaireJour(0).length), 2, 'l’ancien cours survit à l’import');
        assert.deepEqual(erreurs, [], 'aucune exception navigateur : ' + erreurs.join(' | '));
        console.log('ok navigateur : focus, Échap, région unique, largeur 320 px, import non destructif');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
