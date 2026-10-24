/* Popup en vrai navigateur, avec activités fictives dans une session jetable.
   Aucun compte, aucun envoi distant, aucune fiche de test. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const SITE = 'https://sawadogojuliss-byte.github.io/Learning-DP1/';
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__STUDYPLAN_READY === true, null, { timeout: 60000 });
    await page.evaluate(() => {
        selectedDay = 0;
        selectedActivities = [];
        customEvents = [];
        window.__testSaves = 0;
        window.__testEvents = [{ id: 'sport', title: 'Sport', type: 'activity', icon: '⚽',
            startTime: '18:00', endTime: '19:00', editable: true, kind: 'pinned' }];
        window.generateDayEvents = () => {
            const out = window.__testEvents.filter(ev => !customEvents.some(item => item.deleted && item.replacesId === ev.id))
                .map(ev => {
                    const ov = customEvents.find(item => item.replacesId === ev.id && !item.deleted);
                    return ov ? { ...ev, startTime: ov.startTime, endTime: ov.endTime } : ev;
                });
            return out.concat(customEvents.filter(ev => !ev.replacesId && !ev.deleted));
        };
        window.v3Save = () => { window.__testSaves++; };
        window.renderPlanning = () => {};
        window.closeAddModal = () => {};
        window.closeEditModal = () => { editingEvent = null; };
        window.v3Toast = () => {};
        window.bedtimeForDay = () => '22:00';
        document.getElementById('activityNameInput').value = 'Lecture';
        document.getElementById('activityStartInput').value = '18:30';
        document.getElementById('activityEndInput').value = '19:00';
        confirmAddActivity();
    });
    const popup = page.locator('#chevauchementPopup');
    assert.equal(await popup.count(), 1);
    assert.doesNotMatch(await popup.innerText(), /Rien n’a été modifié|ÉTAPE 1 SUR 2|Ce créneau ne peut pas être déplacé automatiquement|Vérifier cet horaire/);
    assert.equal(await popup.locator('[data-placer]').isEnabled(), true, 'l’horaire occupé donne accès aux choix, sans rien retirer');
    assert.match(await popup.innerText(), /Sport/);
    assert.equal(await popup.locator('[data-deplacer]').count(), 1);
    assert.equal(await popup.locator('.chev-dialogue').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
    await popup.locator('[data-deplacer]').click();
    assert.match(await popup.locator('#chevauchementApercu').innerText(), /Sport/);
    assert.match(await popup.locator('#chevauchementApercu').innerText(), /19:00 → 20:00/);
    assert.equal(await page.evaluate(() => window.__testSaves), 0);
    await popup.locator('#chevauchementApercu [data-annuler]').click();
    await page.evaluate(() => confirmAddActivity());
    await popup.locator('[data-autre-creneau]').click();
    assert(await popup.locator('.chev-proposition').count() > 4, 'des horaires de toute la journée');
    assert(await popup.locator('.chev-proposition-libre').count() > 0);
    assert(await popup.locator('.chev-proposition-occupee').count() > 0);
    assert.match(await popup.locator('.chev-proposition-occupee').first().innerText(), /Activités concernées.*Sport/s);
    await popup.locator('[data-filtre-horaire="occupes"]').click();
    assert.equal(await popup.locator('.chev-proposition-libre:visible').count(), 0);
    await popup.locator('.chev-proposition-occupee').filter({ hasText: '18:00 → 18:30' }).click();
    assert.equal(await popup.locator('.chev-carte-deja').count(), 0, 'les anciennes cartes disparaissent après le choix');
    assert.equal(await popup.locator('[data-continuer-selection]').isDisabled(), true, 'aucune décision tacite sur Sport');
    assert.equal(await page.evaluate(() => window.__testSaves), 0);
    await popup.locator('[data-deplacer]').click();
    assert.match(await popup.locator('#chevSelectionEffet').innerText(), /Sport.*19:00 → 20:00/s);
    assert.equal(await popup.locator('[data-continuer-selection]').isEnabled(), true);
    await popup.locator('[data-continuer-selection]').click();
    assert.equal(await popup.count(), 0, 'Continuer applique directement le déplacement choisi');
    assert.deepEqual(await page.evaluate(() => ({
        saves:window.__testSaves, sport:customEvents.find(e => e.replacesId === 'sport')?.endTime,
        lecture:customEvents.find(e => e.title === 'Lecture')?.endTime
    })), { saves:1, sport:'20:00', lecture:'18:30' });
    await page.evaluate(() => { customEvents = []; window.__testSaves = 0; confirmAddActivity(); });
    await popup.locator('[data-autre-creneau]').click();
    await popup.locator('.chev-proposition-libre').filter({ hasText: '19:00 → 19:30' }).click();
    assert.equal(await popup.locator('.chev-carte-deja').count(), 0);
    assert.match(await popup.locator('#chevauchementApercu').innerText(), /18:30 → 19:00.*19:00 → 19:30/s);
    assert.equal(await popup.locator('#chevauchementApercu .chev-actions button').count(), 2, 'Continuer ou annuler seulement');
    await popup.locator('#chevauchementApercu [data-confirmer]').click();
    assert.equal(await popup.count(), 0, 'Continuer sauvegarde directement le créneau libre');
    assert.deepEqual(await page.evaluate(() => ({
        saves:window.__testSaves,
        sport:customEvents.find(e => e.replacesId === 'sport')?.endTime || '',
        lecture:customEvents.find(e => e.title === 'Lecture')?.endTime
    })), { saves:1, sport:'', lecture:'19:30' });
    await page.evaluate(() => { customEvents = []; window.__testSaves = 0; confirmAddActivity(); });
    await popup.locator('[data-autre-creneau]').click();
    await popup.locator('#chevauchementDebut').fill('19:00');
    assert.match(await popup.locator('#chevauchementVerdict').innerText(), /Créneau libre/);
    assert.equal(await popup.locator('[data-placer]').isEnabled(), true);
    await popup.locator('#chevauchementDebut').fill('18:30');
    assert.match(await popup.locator('#chevauchementVerdict').innerText(), /Sport/);
    await popup.locator('[data-placer]').click();
    assert.equal(await popup.locator('.chev-carte-deja').count(), 0, 'saisie manuelle : cartes cachées après le choix');
    await popup.locator('[data-remplacer]').click();
    assert.equal(await popup.locator('[data-continuer-selection]').isDisabled(), true);
    assert.match(await popup.locator('#chevListeRetraits').innerText(), /Sport/);
    await popup.locator('#chevauchementChoix [data-annuler]').click();
    assert.equal(await popup.count(), 0);
    assert.equal(await page.evaluate(() => window.__testSaves), 0);
    await page.evaluate(() => confirmAddActivity());
    await popup.locator('[data-deplacer]').click();
    await popup.locator('[data-confirmer]').click();
    assert.equal(await popup.count(), 0);
    assert.deepEqual(await page.evaluate(() => ({
        saves: window.__testSaves,
        sport: customEvents.find(e => e.replacesId === 'sport')?.endTime,
        lecture: customEvents.find(e => e.title === 'Lecture')?.endTime
    })), { saves: 1, sport: '20:00', lecture: '19:00' });
    await page.evaluate(() => {
        customEvents = [];
        window.__testEvents = [
            { id:'sport', title:'Sport', type:'activity', editable:true, startTime:'18:00', endTime:'19:00' },
            { id:'prep', title:'Préparation', type:'prep', startTime:'17:50', endTime:'18:10' }
        ];
        confirmAddActivity();
    });
    await popup.locator('[data-autre-creneau]').click();
    await popup.locator('.chev-proposition-occupee').filter({ hasText:'18:00 → 18:30' }).click();
    assert.equal(await popup.locator('.chev-carte-deja').count(), 0);
    await popup.locator('[data-remplacer]').click();
    await popup.locator('.chev-retrait').filter({ hasText:'Sport' }).locator('input').check();
    assert.equal(await popup.locator('[data-continuer-selection]').isDisabled(), true, 'Préparation non cochée : pas de retrait implicite');
    await popup.locator('.chev-retrait').filter({ hasText:'Préparation' }).locator('input').check();
    await popup.locator('[data-continuer-selection]').click();
    assert.match(await popup.locator('#chevConfirmEssentiels').innerText(), /Préparation/);
    assert.equal(await page.evaluate(() => window.__testSaves), 1, 'une seule pression sur Continuer ne retire pas un essentiel');
    await popup.locator('[data-renoncer-essentiel]').click();
    await popup.locator('#chevauchementChoix [data-annuler]').click();
    assert.equal(await page.evaluate(() => window.__testSaves), 1);
    await page.evaluate(() => {
        customEvents = [];
        window.__testEvents = [
            { id: 'cours', title: 'Cours', type: 'school', startTime: '18:00', endTime: '19:00' }
        ];
        v3OuvrirChoixChevauchement({ mode: 'ajout', day: 0, title: 'Lecture', icon: '📖',
            start: '18:30', end: '19:00', excludeIds: [], conflits: window.__testEvents });
    });
    assert.equal(await popup.locator('[data-deplacer]').count(), 0, 'ne jamais déplacer un cours');
    await popup.locator('[data-remplacer]').click();
    assert.equal(await popup.locator('.chev-retrait').count(), 1);
    assert.equal(await popup.locator('[data-continuer]').isDisabled(), true, 'aucune suppression implicite');
    await popup.locator('.chev-retrait input').check();
    await popup.locator('[data-continuer]').click();
    assert.match(await popup.locator('#chevauchementApercu').innerText(), /Retirés du planning :.*Cours/s);
    await popup.locator('[data-confirmer]').click();
    assert.match(await popup.locator('#chevConfirmEssentiels').innerText(), /Deuxième confirmation.*Cours/s);
    assert.equal(await page.evaluate(() => window.__testSaves), 1);
    await popup.locator('[data-renoncer-essentiel]').click();
    assert.equal(await popup.locator('#chevConfirmEssentiels').count(), 0);
    await page.keyboard.press('Escape');
    assert.equal(await popup.count(), 0);
    assert.equal(await page.evaluate(() => window.__testSaves), 1);
    await page.evaluate(() => {
        window.__testEvents = [
            { id: 'sport', title: 'Sport', type: 'activity', startTime: '18:00', endTime: '19:00', editable: true },
            { id: 'danse', title: 'Danse', type: 'activity', startTime: '18:15', endTime: '18:45', editable: true },
            { id: 'prep', title: 'Préparation', type: 'prep', startTime: '17:50', endTime: '18:10' }
        ];
        v3OuvrirChoixChevauchement({ mode: 'ajout', day: 0, title: 'Lecture', icon: '📖',
            start: '18:30', end: '19:00', excludeIds: [],
            conflits: v3ConflitsCreneau(0, '18:30', '19:00', []) });
    });
    assert.equal(await popup.locator('.chev-carte-deja').count(), 2);
    assert.equal(await popup.locator('[data-deplacer]').count(), 0);
    await popup.locator('[data-remplacer]').click();
    assert.equal(await popup.locator('.chev-carte-deja').count(), 0, 'les cartes quittent l’écran après le choix de remplacement');
    assert.match(await popup.locator('.chev-mode').nth(0).innerText(), /18:30 → 19:00 · 30 min/);
    assert.match(await popup.locator('.chev-mode').nth(1).innerText(), /18:00 → 19:00 · 1 h/);
    assert.equal(await popup.locator('.chev-retrait').count(), 2, 'ne proposer que les conflits réels du résultat');
    assert.equal(await popup.locator('.chev-retrait').filter({ hasText: 'Préparation' }).count(), 0);
    await popup.locator('input[name="chevMode"][value="prendre"]').check();
    assert.equal(await popup.locator('#chevSource').inputValue(), '0');
    assert.match(await popup.locator('#chevResultat').innerText(), /18:00 → 19:00 · 1 h/);
    assert.equal(await popup.locator('.chev-retrait').count(), 3, 'Préparation chevauche les nouvelles heures seulement');
    assert.equal(await popup.locator('.chev-retrait input:checked').count(), 1, 'source explicitement cochée en mode exact');
    await popup.locator('.chev-retrait').filter({ hasText: 'Danse' }).locator('input').check();
    assert.equal(await popup.locator('[data-continuer]').isDisabled(), true, 'Préparation ne disparaît pas automatiquement');
    await popup.locator('.chev-retrait').filter({ hasText: 'Préparation' }).locator('input').check();
    assert.equal(await popup.locator('[data-continuer]').isEnabled(), true);
    await popup.locator('[data-continuer]').click();
    assert.match(await popup.locator('#chevauchementApercu').innerText(), /18:00 → 19:00/);
    assert.equal(await page.evaluate(() => window.__testSaves), 1);
    await popup.locator('[data-confirmer]').click();
    assert.match(await popup.locator('#chevConfirmEssentiels').innerText(), /Préparation/);
    assert.equal(await page.evaluate(() => window.__testSaves), 1);
    await popup.locator('[data-confirmer-essentiel]').click();
    assert.equal(await popup.count(), 0);
    assert.deepEqual(await page.evaluate(() => ({
        saves: window.__testSaves,
        visibles: generateDayEvents(0).map(ev => [ev.title, ev.startTime, ev.endTime])
    })), { saves: 2, visibles: [['Lecture', '18:00', '19:00']] });
    assert.deepEqual(errors, [], 'erreurs JavaScript : ' + errors.join(' | '));
    console.log('ok popup navigateur mobile : verdict immédiat, choix exact ou durée conservée, retrait ciblé, double confirmation et annulation sans envoi');
} finally {
    await browser.close();
}
