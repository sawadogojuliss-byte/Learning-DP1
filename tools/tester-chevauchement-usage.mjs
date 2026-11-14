/* Test navigateur du moteur réel et de l'ergonomie du dialogue.
   STUDY_SITE=http://127.0.0.1:8501/ node tools/tester-chevauchement-usage.mjs
   Option : STUDY_CHROMIUM_LOCAL=1 utilise @sparticuz/chromium. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const options = { headless: true };
if (process.env.STUDY_CHROMIUM_LOCAL && !process.env.STUDY_PLAYWRIGHT_SYSTEM) {
    const portable = require('@sparticuz/chromium').default;
    options.executablePath = await portable.executablePath();
    options.args = portable.args.filter(arg => arg !== '--single-process');
}
let browser;
const base = process.env.STUDY_SITE || 'http://127.0.0.1:8501/';
try {
    for (const viewport of [{ width: 320, height: 568 }, { width: 1280, height: 800 }]) {
        browser = await chromium.launch(options);
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        await page.route('**/*', route => {
            const url = route.request().url();
            return url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:') ? route.continue() : route.abort();
        });
        await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
        await page.goto(base, { waitUntil:'domcontentloaded' });
        await page.waitForFunction(() => window.__STUDYPLAN_READY === true && !document.body.classList.contains('booting'));
        const reset = () => page.evaluate(() => {
            v3FermerChoixChevauchement(); document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active'));
            document.getElementById('planningModal').classList.add('active'); navigateTo('planning');
            localStorage.clear(); selectedDay=0; planningDecalageSemaine=0;
            selectedActivities=[{name:'Sport',icon:'⚽',days:[0],sameTime:true,startTime:'18:00',endTime:'19:00'}];
            customEvents=[]; weekdayWakeup='06:00'; weekdaySleepHours=8; emploiFige=null;
        });
        const open = () => page.evaluate(() => {
            document.getElementById('activityNameInput').value='Lecture';
            document.getElementById('activityStartInput').value='18:15';
            document.getElementById('activityEndInput').value='18:45';
            confirmAddActivity();
        });
        const popup = page.locator('#chevauchementPopup');
        await reset(); await open();
        assert.equal(await popup.count(), 1);
        assert.match(await popup.locator('[data-remplacer]').innerText(), /Retirer « Sport »/);
        await page.waitForFunction(() => document.activeElement.id === 'chevTitre');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'chevTitre', 'le titre reçoit le focus à l’ouverture');
        await page.keyboard.press('Shift+Tab');
        assert.match(await page.evaluate(() => document.activeElement.textContent), /Annuler/, 'le focus reste dans la fenêtre');
        await page.keyboard.press('Tab');
        if (await page.evaluate(() => document.activeElement.hasAttribute('data-fermer'))) await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-autre-creneau')), true);
        await popup.locator('[data-autre-creneau]').click();
        assert.equal(await page.evaluate(() => document.activeElement.dataset.filtreHoraire), 'libres');
        const time = popup.locator('#chevauchementDebut');
        await time.fill('');
        assert.match(await popup.locator('#chevauchementVerdict').innerText(), /Saisis une heure de début/);
        assert.match(await popup.locator('#chevauchementFin').innerText(), /à renseigner/);
        assert.equal(await popup.locator('[data-placer]').isDisabled(), true);
        await time.fill('18:00');
        assert.match(await popup.locator('#chevauchementVerdict').innerText(), /Sport/);
        await popup.locator('[data-placer]').click();
        assert.match(await popup.locator('#chevEtapeInitiale').innerText(), /Sport/);
        await popup.locator('[data-remplacer]').click();
        assert.equal(await page.evaluate(() => document.activeElement.type), 'checkbox', 'le focus suit la nouvelle étape');
        const carte = popup.locator('#chevListeRetraits .chev-retrait').first();
        assert.equal(await carte.evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(239, 248, 241)', 'fond vert avant sélection');
        await carte.locator('input').check();
        assert.equal(await carte.evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(217, 242, 225)', 'fond vert après sélection');
        assert.equal(await carte.locator('input').evaluate(e => getComputedStyle(e).accentColor), 'rgb(22, 129, 93)');
        await carte.locator('input').uncheck();
        assert.equal(await popup.locator('#chevHoraireMode').isVisible(), false, 'aucune option inutile après le choix d’un horaire');
        await popup.locator('#chevListeRetraits input').check();
        const before = await page.evaluate(() => ({ records:JSON.stringify(customEvents), saved:localStorage.getItem('studyPlanIB_customEvents_juliss') }));
        await popup.locator('[data-continuer-selection]').click();
        assert.equal(await page.evaluate(() => document.activeElement.id), 'chevTitre');
        assert.equal(await popup.locator('.chev-dialogue').evaluate(e => e.scrollTop), 0, 'l’aperçu commence en haut');
        assert.match(await popup.locator('#chevauchementApercu').innerText(), /Sport/);
        assert.deepEqual(await page.evaluate(() => ({ records:JSON.stringify(customEvents), saved:localStorage.getItem('studyPlanIB_customEvents_juliss') })), before, 'aucune écriture avant la confirmation');
        await page.evaluate(() => customEvents.push({id:'changement',day:1,title:'Autre jour',startTime:'10:00',endTime:'11:00',type:'activity'}));
        await popup.locator('#chevauchementApercu [data-confirmer]').click();
        assert.match(await popup.locator('#chevauchementErreur').innerText(), /changé/);
        assert.equal(await popup.locator('#chevauchementErreur').evaluate(e => {
            const r=e.getBoundingClientRect(), d=e.closest('.chev-dialogue').getBoundingClientRect();
            return r.top >= d.top - 1 && r.bottom <= d.bottom + 1;
        }), true, 'erreur visible après une confirmation périmée');
        assert.equal(await page.evaluate(() => customEvents.length), 1, 'aucun ajout ni retrait appliqué');
        await popup.locator('[data-retour-apercu]').click();
        await popup.locator('#chevSelectionActions [data-annuler]').click();
        assert.equal(await popup.count(), 0);

        // Confirmation réelle ; l'aperçu et le résultat doivent correspondre.
        await reset(); await open();
        await popup.locator('[data-remplacer]').click();
        await popup.locator('#chevListeRetraits input').check();
        await popup.locator('[data-continuer]').click();
        const preview = await popup.locator('#chevauchementApercu').innerText();
        assert.match(preview, /Sport/);
        assert.match(preview, /Autres changements dus au recalcul/);
        assert.equal(await popup.locator('.chev-dialogue').evaluate(e => e.scrollTop), 0);
        await popup.locator('#chevauchementApercu [data-confirmer]').click();
        if (await popup.locator('[data-confirmer-essentiel]').count()) await popup.locator('[data-confirmer-essentiel]').click();
        assert.equal(await popup.count(), 0);
        const day = await page.evaluate(() => generateDayEvents(0).map(e => [e.id,e.title,e.startTime,e.endTime]));
        assert.ok(day.some(e => e[1] === 'Lecture' && e[2] === '18:15'));
        assert.ok(!day.some(e => e[1] === 'Sport'));
        assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('studyPlanIB_customEvents_juliss')).some(e=>e.title==='Lecture')));
        const rebuilt = await page.evaluate(() => { emploiFige=null; return generateDayEvents(0).map(e=>[e.id,e.title,e.startTime,e.endTime]); });
        assert.deepEqual(rebuilt, day, 'le planning confirmé survit au recalcul');
        await page.reload({ waitUntil:'domcontentloaded' });
        await page.waitForFunction(() => window.__STUDYPLAN_READY === true && !document.body.classList.contains('booting'));
        const reloaded = await page.evaluate(() => {
            selectedActivities=[{name:'Sport',icon:'⚽',days:[0],sameTime:true,startTime:'18:00',endTime:'19:00'}];
            weekdayWakeup='06:00'; weekdaySleepHours=8; emploiFige=null; selectedDay=0;
            return generateDayEvents(0).map(e=>[e.id,e.title,e.startTime,e.endTime]);
        });
        assert.deepEqual(reloaded, day, 'le planning confirmé survit au rechargement');
        // Modifier un créneau existant vers Sport.
        await page.reload({ waitUntil:'domcontentloaded' });
        await page.waitForFunction(() => window.__STUDYPLAN_READY === true && !document.body.classList.contains('booting'));
        await reset();
        await page.evaluate(() => {
            openEditModal('dinner','Dîner','19:00','19:45','meal','🍽️'); selectedDay=0;
            document.getElementById('editEventStart').value='18:15';
            document.getElementById('editEventEnd').value='18:45';
            saveEditedEvent();
        });
        assert.match(await popup.locator('#chevIntro').innerText(), /Dîner.*Sport/);
        await popup.locator('[data-remplacer]').click();
        await popup.locator('#chevListeRetraits input').check();
        await popup.locator('[data-continuer]').click();
        assert.match(await popup.locator('#chevauchementApercu').innerText(), /Dîner.*Sport/s);
        await popup.locator('#chevauchementApercu [data-confirmer]').click();
        if (await popup.locator('[data-confirmer-essentiel]').count()) await popup.locator('[data-confirmer-essentiel]').click();
        assert.equal(await popup.count(), 0, 'édition enregistrée');
        assert.ok(await page.evaluate(() => generateDayEvents(0).some(e => e.id==='dinner' && e.startTime==='18:15')));

        // La suppression future ne touche pas la semaine actuelle.
        await page.reload({ waitUntil:'domcontentloaded' });
        await page.waitForFunction(() => window.__STUDYPLAN_READY === true && !document.body.classList.contains('booting'));
        await reset(); await page.evaluate(() => { planningDecalageSemaine=1; selectedDay=0; }); await open();
        await popup.locator('[data-remplacer]').click();
        await popup.locator('#chevListeRetraits input').check();
        await popup.locator('[data-continuer]').click();
        assert.match(await popup.locator('#chevauchementApercu').innerText(), /uniquement le/);
        await popup.locator('#chevauchementApercu [data-confirmer]').click();
        if (await popup.locator('[data-confirmer-essentiel]').count()) await popup.locator('[data-confirmer-essentiel]').click();
        assert.equal(await popup.count(), 0, 'exception future enregistrée');
        assert.ok(await page.evaluate(() => customEvents.length >= 2 && customEvents.every(e => !!e.date)));
        assert.ok(await page.evaluate(() => v3EvenementsJour(0).some(e => e.title==='Lecture')));
        assert.ok(await page.evaluate(() => { planningDecalageSemaine=0; emploiFige=null; return generateDayEvents(0).some(e=>e.title==='Sport') && !generateDayEvents(0).some(e=>e.title==='Lecture'); }));
        assert.deepEqual(errors, [], 'erreurs JavaScript : ' + errors.join(' | '));
        await page.close();
        await browser.close(); browser = null;
        console.log(`ok navigateur ${viewport.width}×${viewport.height} : clavier, saisie, aperçu, confirmation, édition et date future`);
    }
} finally { if (browser) await browser.close(); }
