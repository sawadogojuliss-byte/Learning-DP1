/**
 * Test en vrai : un vrai navigateur (Playwright) joue l'envoi d'une question
 * et d'une suggestion sur le site déployé, et vérifie que :
 *   1. les quatre comptes admins sont prévenus dès l'appui sur Envoyer
 *      (les requêtes vers le script sont interceptées : aucun vrai mail
 *      n'est expédié aux admins par ce test) ;
 *   2. la question atteint vraiment le fil ntfy ;
 *   3. quand le fil est mort, les admins sont quand même prévenus, la
 *      question reste en file locale, et le message reste honnête ;
 *   4. aucune erreur JavaScript ne se produit dans la page.
 *
 * Les envois portent des identifiants qtest… / ftest… : ils sont ignorés
 * par la synchronisation et par les écrans admins.
 */
import { chromium } from 'playwright';

const SITE = 'https://sawadogojuliss-byte.github.io/Learning-DP1/';
const FIL = 'ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b';
const ADMINS = ['ashleytamini10@gmail.com', 'faridsere86@gmail.com',
    'rayyanouedraogo87@gmail.com', 'sawadogojuliss@gmail.com'];
const MARQUE = 'E2E' + Date.now().toString(36);

function echec(message) {
    console.error('ECHEC ' + message);
    process.exit(1);
}

async function lireFil(depuisMinutes) {
    const res = await fetch('https://ntfy.sh/' + FIL + '/json?poll=1&since=' + depuisMinutes + 'm');
    const texte = await res.text();
    const items = [];
    for (const ligne of texte.split('\n')) {
        if (!ligne.trim()) continue;
        let enveloppe;
        try { enveloppe = JSON.parse(ligne); } catch (e) { continue; }
        if (enveloppe.event && enveloppe.event !== 'message') continue;
        try { items.push(JSON.parse(enveloppe.message || '{}')); } catch (e) {}
    }
    return items;
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    const erreursPage = [];

    async function nouvellePage(mode) {
        const page = await browser.newPage();
        page.on('pageerror', function (e) { erreursPage.push(String(e)); });
        const avis = [];
        await page.route('**script.google.com**', async function (route) {
            const requete = route.request();
            if (requete.method() !== 'POST') { await route.continue(); return; }
            let payload = {};
            try { payload = JSON.parse(requete.postData() || '{}'); } catch (e) {}
            avis.push({ t: Date.now(), payload: payload });
            if (mode === 'script-mort') { await route.abort(); return; }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, id: payload.nonce || 'mock' })
            });
        });
        if (mode === 'fil-mort') {
            await page.route('**ntfy.sh**', async function (route) {
                if (route.request().method() === 'POST') { await route.abort(); return; }
                await route.continue();
            });
        }
        await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
        /* Les scripts de la page arrivent après le document : attendre
           qu'ils soient tous en place avant de jouer l'utilisateur. */
        await page.waitForFunction(function () {
            return typeof window.navigateTo === 'function' && typeof window.boiteId === 'function';
        }, undefined, { timeout: 60000 });
        await page.waitForSelector('#panelAide', { state: 'attached', timeout: 60000 });
        /* Les identifiants des envois de test : invisibles partout. */
        await page.evaluate(function () {
            const origine = window.boiteId;
            window.boiteId = function (p) {
                const base = origine ? origine(p) : (p + Date.now().toString(16));
                if (p === 'q') return 'qtest' + base;
                if (p === 'f') return 'ftest' + base;
                return base;
            };
        });
        return { page: page, avis: avis };
    }

    async function attendreStatut(page, identifiant) {
        await page.waitForFunction(function (id) {
            const el = document.getElementById(id);
            return el && el.textContent && el.textContent !== 'Envoi…';
        }, identifiant, { timeout: 25000 });
        return page.textContent('#' + identifiant);
    }

    async function attendreAvis(avis) {
        /* Les avis suivent un aller-retour vers la config du script :
           ils partent juste après l'appui, on leur laisse une seconde
           pour traverser le réseau. */
        for (let i = 0; i < 24 && avis.length < 4; i++) {
            await new Promise(function (r) { setTimeout(r, 250); });
        }
    }

    function verifierAvis(avis, sujet, morceau, debut, delaiMax) {
        if (avis.length !== 4) echec('avis attendus : 4, captés : ' + avis.length + ' (' + sujet + ')');
        const cibles = avis.map(function (a) { return a.payload.to; }).sort();
        if (JSON.stringify(cibles) !== JSON.stringify(ADMINS.slice().sort())) {
            echec('destinataires des avis : ' + cibles.join(','));
        }
        avis.forEach(function (a) {
            if (!/^[a-z0-9]{16,40}$/.test(a.payload.nonce || '')) echec('nonce mal formé : ' + a.payload.nonce);
            if (a.payload.subject !== sujet) echec('sujet d\'avis : ' + a.payload.subject);
            if (String(a.payload.text || '').indexOf(morceau) === -1) echec('le texte envoyé manque dans l\'avis');
            if (String(a.payload.html || '').indexOf('Study Plan IB') === -1) echec('le HTML manque dans l\'avis');
            if (a.t - debut > delaiMax) echec('avis parti ' + (a.t - debut) + ' ms après l\'appui (max ' + delaiMax + ')');
        });
    }

    /* 1) Question, chemin direct */
    {
        const { page, avis } = await nouvellePage('direct');
        await page.evaluate(function () { navigateTo('aide'); });
        await page.fill('#aideEmail', 'e2e-' + MARQUE + '@example.com');
        await page.fill('#aideTexte', 'Test automatique de l\'envoi, ignoré — ' + MARQUE + 'q');
        const debut = Date.now();
        await page.click('#aideEnvoi');
        const statut = await attendreStatut(page, 'aideStatut');
        const duree = Date.now() - debut;
        console.log('question directe : « ' + statut + ' » en ' + duree + ' ms');
        if (statut !== 'Question envoyée.') echec('statut de la question directe : ' + statut);
        if (duree > 8000) echec('l\'envoi direct a pris ' + duree + ' ms');
        await attendreAvis(avis);
        verifierAvis(avis, 'Nouvelle question — Study Plan IB', MARQUE + 'q', debut, 1500);
        let recu = null;
        for (let i = 0; i < 10 && !recu; i++) {
            await page.waitForTimeout(1500);
            const fil = await lireFil(15);
            recu = fil.find(function (it) {
                return it && it.type === 'question' && String(it.texte || '').indexOf(MARQUE + 'q') !== -1;
            }) || null;
        }
        if (!recu) echec('la question n\'est jamais arrivée sur le fil');
        if (String(recu.id || '').indexOf('qtest') !== 0) echec('identifiant de test non marqué : ' + recu.id);
        await page.close();
        console.log('question directe : fil atteint, 4 admins prévenus dès l\'appui — OK');
    }

    /* 2) Question, fil mort : prévenus quand même, question gardée */
    {
        const { page, avis } = await nouvellePage('fil-mort');
        await page.evaluate(function () { navigateTo('aide'); });
        await page.fill('#aideEmail', 'e2e-' + MARQUE + '@example.com');
        await page.fill('#aideTexte', 'Test automatique fil mort, ignoré — ' + MARQUE + 'b');
        const debut = Date.now();
        await page.click('#aideEnvoi');
        const statut = await attendreStatut(page, 'aideStatut');
        console.log('question fil mort : « ' + statut + ' » en ' + (Date.now() - debut) + ' ms');
        if (statut.indexOf('Question envoyée par mail') === -1) echec('statut fil mort : ' + statut);
        await attendreAvis(avis);
        verifierAvis(avis, 'Nouvelle question — Study Plan IB', MARQUE + 'b', debut, 1500);
        const enFile = await page.evaluate(function (marque) {
            for (let i = 0; i < localStorage.length; i++) {
                const cle = localStorage.key(i);
                let data;
                try { data = JSON.parse(localStorage.getItem(cle) || 'null'); } catch (e) { continue; }
                const liste = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : null);
                if (liste && liste.some(function (it) { return it && String(it.texte || '').indexOf(marque) !== -1; })) return true;
            }
            return false;
        }, MARQUE + 'b');
        if (!enFile) echec('la question n\'est pas restée en file locale pendant le fil mort');
        await page.close();
        console.log('question fil mort : 4 admins prévenus quand même, question gardée en file — OK');
    }

    /* 3) Suggestion, chemin direct */
    {
        const { page, avis } = await nouvellePage('direct');
        await page.evaluate(function () { navigateTo('feedback'); });
        await page.fill('#feedbackEmail', 'e2e-' + MARQUE + '@example.com');
        await page.fill('#feedbackTexte', 'Test automatique de la suggestion, ignoré — ' + MARQUE + 'f');
        const debut = Date.now();
        await page.click('#feedbackEnvoi');
        const statut = await attendreStatut(page, 'feedbackStatut');
        const duree = Date.now() - debut;
        console.log('suggestion directe : « ' + statut + ' » en ' + duree + ' ms');
        if (statut !== 'Suggestion envoyée.') echec('statut de la suggestion : ' + statut);
        await attendreAvis(avis);
        verifierAvis(avis, 'Nouvelle suggestion — Study Plan IB', MARQUE + 'f', debut, 1500);
        let recue = null;
        for (let i = 0; i < 10 && !recue; i++) {
            await page.waitForTimeout(1500);
            const fil = await lireFil(15);
            recue = fil.find(function (it) {
                return it && it.type === 'feedback' && String(it.texte || '').indexOf(MARQUE + 'f') !== -1;
            }) || null;
        }
        if (!recue) echec('la suggestion n\'est jamais arrivée sur le fil');
        if (String(recue.id || '').indexOf('ftest') !== 0) echec('identifiant de test non marqué : ' + recue.id);
        await page.close();
        console.log('suggestion directe : fil atteint, 4 admins prévenus dès l\'appui — OK');
    }

    if (erreursPage.length) echec('erreurs JavaScript dans la page : ' + erreursPage.join(' | '));
    await browser.close();
    console.log('E2E ENVOI : TOUT EST VERT');
}

main().catch(function (e) {
    console.error(e && e.stack || e);
    process.exit(1);
});
