/* Vérifie la nouvelle navigation avec un rôle simulé dans un navigateur jetable.
   Aucun compte admin réel, aucun mail, aucune fiche Firestore. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const SITE = 'https://sawadogojuliss-byte.github.io/Learning-DP1/';
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 850 } });
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__STUDYPLAN_READY === true, null, { timeout: 60000 });
    await page.waitForFunction(() => !document.body.classList.contains('booting'), null, { timeout: 10000 });
    await page.evaluate(() => {
        // Le menu est dans le planning, normalement ouvert après l'inscription.
        document.getElementById('planningModal').classList.add('active');
        window.boiteVerifierAdmin = () => Promise.resolve(false);
        window.boiteSignalerOuverture = () => {};
        window.boiteEstAdmin = () => false;
        boiteMajMenu();
        annonceMajMenu();
    });
    const affichage = id => page.locator('#' + id).evaluate(el => getComputedStyle(el).display);
    assert.equal(await affichage('menuAnnonce'), 'flex', 'les élèves gardent la lecture des annonces');
    assert.equal(await affichage('menuEspaceAdmin'), 'none');
    await page.evaluate(() => { navigateTo('annonce'); annonceMajMenu(); });
    assert.equal(await page.locator('#panelAnnonce').isVisible(), true);
    assert.equal(await page.locator('#panelAnnonce .admin-nav-lien[aria-label="Annonce"]').isVisible(), true);
    assert.equal(await page.locator('#panelAnnonce .admin-nav-lien[aria-label="Espace admin"]').isVisible(), false,
        'le lecteur public ne voit pas les raccourcis privés');
    assert.equal(await page.locator('#annonceComposer').isVisible(), false);
    await page.evaluate(() => {
        tutorielListe = [{ type:'tutoriel', id:'video-fictive', titre:'Guide fictif',
            url:'https://youtu.be/abcdefghijk', publie:1, at:new Date().toISOString() }];
        window.tutorielCharger = () => Promise.resolve(tutorielListe);
        tutorielMajMenu();
        navigateTo('tutoriel');
    });
    assert.equal(await page.locator('#panelTutoriel').isVisible(), true, 'les élèves gardent les vidéos publiées');
    assert.equal(await page.locator('#panelTutoriel .tutoriel-rail').isVisible(), false);
    assert.equal(await page.locator('#tutorielCompose').isVisible(), false);
    await page.evaluate(() => navigateTo('admin'));
    assert.equal(await page.locator('#panelAdmin').isVisible(), false, 'la page ne doit pas s’ouvrir pour un élève');
    await page.evaluate(() => {
        window.boiteEstAdmin = () => true;
        window.boiteOuvrirAdmin = section => {
            document.getElementById({ retours:'panelRetours', questions:'panelQuestions', emplois:'panelEmplois' }[section]).classList.add('active');
        };
        window.initAnnonce = () => {}; // Navigation uniquement ; pas d'initialisation ni d'envoi.
        boiteMajMenu();
        annonceMajMenu();
        tutorielMajMenu();
        window.tutorielCharger = () => Promise.resolve([]); // Pas de lecture réelle dans le test.
        document.getElementById('sideMenu').style.right = '0';
        document.getElementById('sideMenuOverlay').style.display = 'block';
    });
    assert.equal(await affichage('menuEspaceAdmin'), 'flex');
    assert.equal(await affichage('menuTutoriel'), 'none', 'le tutoriel admin passe dans le bureau');
    for (const id of ['menuAnnonce', 'menuRetours', 'menuQuestions', 'menuEmplois']) {
        assert.equal(await affichage(id), 'none', id + ' doit être regroupé');
    }
    await page.locator('#menuEspaceAdmin').click();
    assert.equal(await page.locator('#panelAdmin').isVisible(), true);
    assert.equal(await page.locator('#panelAdmin .admin-atelier-cartes > button').count(), 5);
    assert.equal(await page.locator('#panelAdmin .admin-atelier-rail').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(22, 70, 51)');
    const destinations = [
        ['annonce','panelAnnonce'], ['retours','panelRetours'],
        ['questions','panelQuestions'], ['emplois','panelEmplois'], ['tutoriel','panelTutoriel']
    ];
    for (const [name,id] of destinations) {
        await page.locator('#panelAdmin .admin-atelier-cartes button[onclick="navigateTo(\'' + name + '\')"]').click();
        assert.equal(await page.locator('#' + id).isVisible(), true, 'lien ' + name);
        if (name === 'annonce') await page.evaluate(() => annonceMajMenu());
        const nav = page.locator('#' + id + ' .admin-nav');
        assert.equal(await nav.locator('.admin-nav-lien[aria-current="page"]').getAttribute('aria-label'),
            { annonce:'Annonce', retours:'Retour des feedbacks', questions:'Questions des utilisateurs', emplois:'Emplois du temps', tutoriel:'Tutoriel' }[name]);
        assert.equal(await nav.locator('.admin-nav-lien[aria-label="Espace admin"]').isVisible(), true,
            'le dossier reste visible dans ' + name);
        assert.equal(await nav.locator('.admin-nav-lien').count(), 6);
        assert.deepEqual(await nav.locator('.admin-nav-liens').evaluate(el => {
            const style = getComputedStyle(el);
            return [style.backgroundColor, style.backdropFilter, style.borderBottomWidth];
        }), ['rgba(0, 0, 0, 0)', 'none', '0px'], 'pas de bande blanchâtre dans le rail ' + name);
        assert.equal(await nav.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(22, 70, 51)');
        await page.evaluate(() => navigateTo('admin'));
    }
    await page.evaluate(() => {
        window.boiteSession = () => ({ sub: 'sub-test', email: 'faridsere86@gmail.com' });
        window.__approvalClicks = 0;
        window.annonceAccepter = () => { window.__approvalClicks++; return Promise.resolve(true); }; // Aucun envoi.
        annonceListe = annonceFusionner([{ type:'annonce', id:'fake-pending', at:new Date().toISOString(),
            titre:'Annonce à vérifier', texte:'Le texte entier est disponible dans la popup.',
            nom:'Admin fictif', auteurCle:'juliss', acceptations:{}, publie:0, envoyes:[] }]);
        annonceOuvrirAlerte('fake-pending');
    });
    assert.match(await page.locator('#annonceAlerte').innerText(), /Le texte entier est disponible dans la popup/);
    assert.match(await page.locator('#annonceAlerte').innerText(), /Une annonce attend votre validation/);
    await page.locator('#annonceAlerte [data-annonce-confirmer]').click();
    assert.equal(await page.locator('#annonceAlerte').count(), 0);
    assert.equal(await page.evaluate(() => window.__approvalClicks), 1, 'un seul clic, sans mail');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#panelAdmin .admin-atelier-rail').isVisible(), true);
    assert.equal(await page.locator('#panelAdmin .admin-atelier-cartes > button').count(), 5);
    await page.locator('#panelAdmin .admin-nav-lien[aria-label="Questions des utilisateurs"]').click();
    assert.equal(await page.locator('#panelQuestions').isVisible(), true);
    assert.equal(await page.locator('#panelQuestions .admin-nav').isVisible(), true);
    assert.equal(await page.locator('#panelQuestions .admin-page-entete h2').evaluate(el => getComputedStyle(el).fontFamily),
        'Georgia, serif');
    await page.locator('#panelQuestions .admin-nav-lien[aria-label="Espace admin"]').click();
    assert.equal(await page.locator('#panelAdmin').isVisible(), true);
    await page.evaluate(() => {
        window.boiteEstAdmin = () => false;
        boiteMajMenu(); annonceMajMenu();
    });
    assert.equal(await affichage('menuAnnonce'), 'flex');
    assert.equal(await affichage('menuEspaceAdmin'), 'none');
    assert.deepEqual(errors, [], errors.join(' | '));
    console.log('ok Espace admin navigateur : cinq destinations, tutoriel public, popup annonce complète, vote unique simulé, aucun envoi');
} finally {
    await browser.close();
}
