/* Vérifie le mail de réponse aux questions (script Google), le rattachement
   d'une réponse à SA question, et l'attribution des feedbacks.
   Régressions couvertes :
   — la réponse partie pour une autre question s'affichait sur celle de
     Kenzah, cochée « répondue par Farid » alors que non ;
   — le popup « nouveaux messages » nommait le mauvais expéditeur. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const store = {};
const appels = [];
const slot = { innerHTML: '', clientWidth: 320 };
const zone = { textContent: '', style: {} };
const bouton = { disabled: false, closest: function () { return article; } };
const article = {
    querySelector: function (sel) {
        if (String(sel).indexOf('statut') !== -1) return zone;
        if (String(sel).indexOf('texte') !== -1) return { value: 'La réponse est prête.' };
        return null;
    }
};
let reponseScript = function (payload) { return { success: true, id: payload.nonce }; };

const context = {
    console: console,
    Promise: Promise,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Date: Date,
    JSON: JSON,
    Math: Math,
    String: String,
    Number: Number,
    Array: Array,
    Object: Object,
    RegExp: RegExp,
    Error: Error,
    encodeURIComponent: encodeURIComponent,
    unescape: unescape,
    btoa: function (s) { return Buffer.from(s, 'binary').toString('base64'); },
    AbortController: AbortController,
    TextEncoder: TextEncoder,
    XMLHttpRequest: function () { throw new Error('xhr interdit dans ce test'); },
    localStorage: {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
    },
    navigator: { language: 'fr' },
    STUDYPLAN_GOOGLE_CLIENT_ID: '775918983331-8igka68v1a6otqudt6nqr2ab1qtqiehj.apps.googleusercontent.com'
};
context.window = context;
context.location = { origin: 'https://sawadogojuliss-byte.github.io' };
context.document = {
    getElementById: function (id) {
        if (id === 'googleBtnSlot') return slot;
        if (id === 'compteInviteTexte') return { textContent: '' };
        if (id === 'compteInvite') return { hidden: false };
        if (id === 'compteMessage') return { hidden: true, textContent: '' };
        return null;
    },
    body: { contains: function () { return true; }, appendChild: function () {} },
    head: { appendChild: function () {} },
    addEventListener: function () {},
    createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; }
};
context.google = {
    accounts: {
        id: {
            initialize: function () { appels.push('initialize'); },
            renderButton: function (el, opts) {
                appels.push(opts);
                el.innerHTML = 'bouton-google';
            }
        }
    }
};
context.fetch = function (url, opts) {
    appels.push({ url: String(url), opts: opts });
    var u = String(url);
    if (u.indexOf('data/mail-script.json') !== -1) {
        return Promise.resolve({
            ok: true, status: 200,
            json: function () { return Promise.resolve({ url: 'https://script.google.com/macros/s/AKfycbxTEST0123456789/exec' }); }
        });
    }
    if (u.indexOf('script.google.com') !== -1) {
        var payload = {};
        try { payload = JSON.parse(opts && opts.body); } catch (e) {}
        var data = reponseScript(payload);
        return Promise.resolve({
            ok: !!(data && data.success),
            status: data && data.success ? 200 : 500,
            json: function () { return Promise.resolve(data || {}); }
        });
    }
    return Promise.resolve({
        ok: false, status: 404,
        json: function () { return Promise.resolve({}); },
        text: function () { return Promise.resolve(''); }
    });
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/pages/boite.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('js/compte.js', 'utf8'), context);

/* — Pages et statiques — */
const html = fs.readFileSync('pages/compte.html', 'utf8');
assert.strictEqual(html.indexOf('compteGmail'), -1, 'le champ e-mail de connexion est encore là');
assert.strictEqual(html.indexOf('type="email"'), -1, 'la connexion demande encore de taper un e-mail');
const compte = fs.readFileSync('js/compte.js', 'utf8');
assert.strictEqual(compte.indexOf('gmail.send'), -1, 'la connexion Google ne doit pas demander le droit Gmail');
const boite = fs.readFileSync('js/pages/boite.js', 'utf8');
assert.strictEqual(boite.indexOf('boiteMotPresent'), -1, 'le rattachement d\'une réponse par simple prénom est de retour');
assert.strictEqual(context.BOITE_EXPEDITEUR, 'ibstudyplan@gmail.com');

/* — Bouton Google de connexion — */
context.compteAfficherBoutonGoogle().then(function (ok) {
    assert.strictEqual(ok, true);
    assert.strictEqual(slot.innerHTML, 'bouton-google');
    const opts = appels.filter(function (item) { return item && item.logo_alignment; })[0];
    assert.ok(opts, 'le bouton Google ne s\'est pas affiché');
    assert.strictEqual(opts.text, 'continue_with');
    assert.strictEqual(opts.logo_alignment, 'left');
    assert.strictEqual(opts.locale, 'fr');

    /* — Le mail de réponse part par le script Google, au nom de l'équipe — */
    const question = {
        id: 'q1a14ada5592fd8140b9',
        at: '2026-10-17T17:13:05.170Z',
        texte: "vous avez dit que le nombre maximum d'heure de sommeil est de 5 heures. Pourtant pour moi sa m'a mis 3 heures de sommeil.",
        email: 'doriilboudo235@gmail.com',
        google: 'doriilboudo235@gmail.com',
        nom: 'Kenzah',
        googleNom: 'Kenzah ILBOUDO'
    };
    const admins = [
        'Sawadogo Juliss Bill Owen',
        'Sere Farid Abdourrahman',
        'Tamini Ashley Kania Harisoa',
        'Ouedraogo Wendsom Rayyan'
    ];
    return admins.reduce(function (chaine, nom) {
        return chaine.then(function () {
            context.userName = nom;
            assert.strictEqual(context.boiteEstAdmin(), true, nom);
            context.boiteListesCache = { questions: [question], reponses: [], feedbacks: [], emplois: [] };
            zone.textContent = '';
            bouton.disabled = false;
            appels.length = 0;
            context.boiteRepondre(question.id, bouton);
            return new Promise(function (resolve) { setTimeout(resolve, 120); }).then(function () {
                const envoi = appels.filter(function (item) { return item && item.url && item.url.indexOf('script.google.com') !== -1; })[0];
                assert.ok(envoi, nom + ' n’a pas appelé le script d’envoi');
                const payload = JSON.parse(envoi.opts.body);
                assert.strictEqual(payload.to, 'doriilboudo235@gmail.com');
                assert.strictEqual(payload.secret, context.BOITE_SCRIPT_SECRET);
                assert.ok(payload.subject.indexOf('Study Plan IB') !== -1, payload.subject);
                assert.ok(/^(Bonjour|Bonsoir) Kenzah,$/.test(payload.salutation), payload.salutation);
                assert.ok(payload.text.indexOf(payload.salutation + '\n') === 0, 'le mail ne commence pas par la salutation');
                assert.ok(payload.text.indexOf('La réponse est prête.') !== -1, 'la réponse manque');
                assert.ok(payload.text.indexOf('Ta question :') !== -1, 'la question d\'origine manque');
                assert.ok(payload.text.indexOf('3 heures de sommeil') !== -1, 'le texte de Kenzah manque');
                assert.ok(payload.text.indexOf('À bientôt,\nL\'équipe Study Plan IB') !== -1, 'la signature manque');
                assert.ok(payload.html.indexOf('Study Plan IB') !== -1, 'le HTML manque');
                const record = (context.boiteListesCache.reponses || []).filter(function (rep) { return rep.questionId === question.id; })[0];
                assert.ok(record, nom + ' n’a pas gardé la réponse');
                assert.strictEqual(record.mail, true, 'marquée non envoyée');
                assert.strictEqual(record.repondu, true);
                assert.strictEqual(record.destinataire, 'doriilboudo235@gmail.com');
                assert.strictEqual(record.nom, nom, 'la réponse doit porter le nom de l’admin qui l’écrit');
                assert.ok(record.salutation === payload.salutation);
            });
        });
    }, Promise.resolve());
}).then(function () {
    /* — Un échec d'envoi n'est jamais marqué comme parti — */
    reponseScript = function () { return { success: false, error: 'Activation' }; };
    context.boitePosterChamps = function () { return Promise.reject(new Error('mail')); };
    context.boitePosterFormulaire = function () { return Promise.reject(new Error('mail')); };
    context.boiteAttendreConfirmation = function () { return Promise.reject(new Error('mail')); };
    context.userName = 'Sawadogo Juliss Bill Owen';
    context.boiteListesCache = { questions: [{ id: 'q2', at: '2026-10-17T17:13:05.170Z', texte: 'Aide', email: 'eleve@example.com', nom: 'Awa' }], reponses: [], feedbacks: [], emplois: [] };
    bouton.disabled = false;
    zone.textContent = '';
    context.boiteRepondre('q2', bouton);
    return new Promise(function (resolve) { setTimeout(resolve, 120); });
}).then(function () {
    const parti = (context.boiteListesCache.reponses || []).some(function (rep) { return rep.mail; });
    assert.strictEqual(parti, false, 'un échec a été marqué comme envoyé');
    assert.strictEqual(bouton.disabled, false, 'le bouton doit redevenir cliquable après un échec');
    assert.ok(zone.textContent.length > 5, 'aucun message d\'échec affiché');

    /* — Une réponse ne se rattache qu'à SA question — */
    const kenzah = {
        id: 'q1a14ada5592fd8140b9', at: '2026-10-17T17:13:05.170Z',
        email: 'doriilboudo235@gmail.com', google: 'doriilboudo235@gmail.com', nom: 'Kenzah'
    };
    const owen = {
        id: 'q0', at: '2026-10-10T14:13:17.490Z',
        email: 'sawadogoowen797@gmail.com', google: 'sawadogoowen797@gmail.com', nom: 'Owen'
    };
    const faridPourOwen = { id: 'r1', at: '2026-10-10T15:22:34.569Z', destinataire: 'sawadogoowen797@gmail.com', mail: true, nom: 'Sere Farid Abdourrahman' };
    const faridPourKenzaEcole = { id: 'r2', at: '2026-10-10T14:12:19.477Z', destinataire: 'ilboudo.kenza@enkoschools.com', mail: true, nom: 'Sere Farid Abdourrahman', personne: 'Kenza Ilboudo' };
    const tropTot = { id: 'r3', at: '2026-10-17T10:00:00.000Z', destinataire: 'doriilboudo235@gmail.com', mail: true, nom: 'Sere Farid Abdourrahman' };
    const apres = { id: 'r4', at: '2026-10-17T18:00:00.000Z', destinataire: 'doriilboudo235@gmail.com', mail: true, nom: 'Sere Farid Abdourrahman' };
    const direct = { id: 'r5', questionId: kenzah.id, mail: true, nom: 'Sere Farid Abdourrahman' };

    assert.strictEqual(context.boiteReponseLiee(direct, kenzah, {}), true, 'la réponse numérotée doit se rattacher');
    assert.strictEqual(context.boiteReponseLiee(faridPourOwen, kenzah, {}), false, 'une réponse pour une autre adresse ne doit pas se rattacher à Kenzah');
    assert.strictEqual(context.boiteReponseLiee(faridPourKenzaEcole, kenzah, {}), false, 'l’ancienne réponse pour l’adresse école ne doit pas se rattacher à la nouvelle question');
    assert.strictEqual(context.boiteReponseLiee(tropTot, kenzah, {}), false, 'une réponse antérieure à la question ne se rattache pas');
    assert.strictEqual(context.boiteReponseLiee(apres, kenzah, {}), true, 'un ancien envoi, même adresse et postérieur, se rattache');
    assert.strictEqual(context.boiteReponseLiee({ at: '2026-10-17T18:00:00.000Z', destinataire: 'doriilboudo235@gmail.com', mail: false }, kenzah, {}), false, 'un envoi non confirmé ne se rattache jamais');

    const fusion = { questions: [kenzah, owen], reponses: [faridPourOwen, faridPourKenzaEcole, tropTot], feedbacks: [], emplois: [] };
    context.boiteListesCache = fusion;
    assert.strictEqual(context.boiteReponsesDe(fusion, kenzah.id).length, 0, 'la question de Kenzah doit rester décochée');
    assert.strictEqual(context.boiteReponsesDe(fusion, owen.id).length, 1, 'la question d’Owen garde sa réponse');

    /* — Le popup nomme le vrai expéditeur, avec son adresse — */
    context.userName = 'Sawadogo Juliss Bill Owen';
    Object.keys(store).forEach(function (cle) { if (cle.indexOf('alertesVues') !== -1) delete store[cle]; });
    const mathis = { type: 'feedback', id: 'f1', at: '2026-10-17T15:04:16.595Z', nom: 'Mathis', googleNom: 'Aimery Mathis D. S Kafando', email: 'mathis.kafando@enkoschools.com', google: 'mathis.kafando@enkoschools.com' };
    const piege = { type: 'feedback', id: 'f2', at: '2026-10-17T15:10:00.000Z', nom: 'Farid', googleNom: 'Kenzah ILBOUDO', email: 'doriilboudo235@gmail.com', google: 'doriilboudo235@gmail.com' };
    const mien = { type: 'feedback', id: 'f3', at: '2026-10-17T15:11:00.000Z', nom: 'Sawadogo Juliss Bill Owen', email: '', google: '' };
    const neuf = context.boiteNouveauxRetours({ feedbacks: [mathis, piege, mien], questions: [] });
    assert.strictEqual(neuf.lignes.length, 2, 'ses propres feedbacks ne doivent pas alerter');
    assert.ok(neuf.lignes[0].indexOf('Mathis') !== -1 && neuf.lignes[0].indexOf('mathis.kafando@enkoschools.com') !== -1, neuf.lignes[0]);
    assert.ok(neuf.lignes[1].indexOf('Kenzah ILBOUDO') !== -1, 'le nom du compte Google doit l’emporter sur le prénom tapé : ' + neuf.lignes[1]);
    assert.ok(neuf.lignes[1].indexOf('doriilboudo235@gmail.com') !== -1, neuf.lignes[1]);

    console.log('ok mail de réponse (script Google), rattachement strict des réponses, popup aux bons noms');
}).catch(function (err) {
    console.error(err);
    process.exit(1);
});
