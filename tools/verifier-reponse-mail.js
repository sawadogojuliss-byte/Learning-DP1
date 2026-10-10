/* Vérifie le bouton Google et l'envoi d'une réponse admin vers l'e-mail de la question. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const store = {};
const appels = [];
let jetons = 0;
const slot = { innerHTML: '', clientWidth: 320 };
const zone = { textContent: '', style: {} };
const bouton = {
    disabled: false,
    closest: function () { return article; }
};
const article = {
    querySelector: function (sel) {
        if (String(sel).indexOf('statut') !== -1) return zone;
        if (String(sel).indexOf('texte') !== -1) return { value: 'La réponse est prête.' };
        return null;
    }
};
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
    localStorage: {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
    },
    navigator: { language: 'fr' },
    STUDYPLAN_GOOGLE_CLIENT_ID: '775918983331-8igka68v1a6otqudt6nqr2ab1qtqiehj.apps.googleusercontent.com'
};
context.window = context;
context.document = {
    getElementById: function (id) {
        if (id === 'googleBtnSlot') return slot;
        if (id === 'compteInviteTexte') return { textContent: '' };
        if (id === 'compteInvite') return { hidden: false };
        if (id === 'compteMessage') return { hidden: true, textContent: '' };
        return null;
    },
    body: { contains: function () { return true; } },
    addEventListener: function () {}
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
context.google.accounts.oauth2 = {
    initTokenClient: function (opts) {
        jetons += 1;
        appels.push({ token: true });
        return {
            requestAccessToken: function () {
                opts.callback({ access_token: 'jeton-test', expires_in: 3600 });
            }
        };
    }
};
context.fetch = function (url, opts) {
    appels.push({ url: String(url), opts: opts });
    if (String(url).indexOf('userinfo') !== -1) {
        return Promise.resolve({
            ok: true,
            status: 200,
            json: function () { return Promise.resolve({ email: 'ibstudyplan@gmail.com' }); }
        });
    }
    if (String(url).indexOf('messages/send') !== -1) {
        var brut = '';
        try { brut = JSON.parse(opts.body).raw; } catch (e) { brut = ''; }
        var lettre = Buffer.from(String(brut).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        var ok = lettre.indexOf('To: eleve@example.com') !== -1 && lettre.indexOf('ibstudyplan@gmail.com') !== -1;
        return Promise.resolve({
            ok: ok,
            status: ok ? 200 : 400,
            json: function () { return Promise.resolve(ok ? { id: 'gmail-1' } : { error: { message: 'refusé' } }); }
        });
    }
    return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); } });
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/pages/boite.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('js/compte.js', 'utf8'), context);

const html = fs.readFileSync('pages/compte.html', 'utf8');
assert.strictEqual(html.indexOf('compteGmail'), -1, 'le champ e-mail de connexion est encore là');
assert.strictEqual(html.indexOf('type="email"'), -1, 'la connexion demande encore de taper un e-mail');
assert.strictEqual(fs.readFileSync('js/compte.js', 'utf8').indexOf('requestAccessToken'), -1);
assert.strictEqual(context.BOITE_EXPEDITEUR, 'ibstudyplan@gmail.com');

context.compteAfficherBoutonGoogle().then(function (ok) {
    assert.strictEqual(ok, true);
    assert.strictEqual(slot.innerHTML, 'bouton-google');
    const opts = appels.filter(function (item) { return item && item.logo_alignment; })[0];
    assert.strictEqual(opts.text, 'continue_with');
    assert.strictEqual(opts.logo_alignment, 'left');
    assert.strictEqual(opts.locale, 'fr');

    const admins = [
        'Sawadogo Juliss Bill Owen',
        'Sere Farid Abdourrahman',
        'Tamini Ashley Kania Harisoa',
        'Ouedraogo Wendsom Rayyan'
    ];
    const question = { id: 'q1', texte: 'Où est le mémoire ?', email: 'eleve@example.com', nom: 'Awa' };
    return admins.reduce(function (chaine, nom) {
        return chaine.then(function () {
            context.userName = nom;
            assert.strictEqual(context.boiteEstAdmin(), true, nom);
            context.boiteListesCache = { questions: [question], reponses: [], feedbacks: [], emplois: [] };
            zone.textContent = '';
            bouton.disabled = false;
            appels.length = 0;
            context.boiteRepondre('q1', bouton);
            return new Promise(function (resolve) { setTimeout(resolve, 80); }).then(function () {
                const envoi = appels.filter(function (item) { return item && item.url && item.url.indexOf('messages/send') !== -1; })[0];
                assert.ok(envoi, nom + ' n’a pas envoyé');
                const lettre = Buffer.from(JSON.parse(envoi.opts.body).raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
                assert.ok(lettre.indexOf('To: eleve@example.com') !== -1, lettre);
                assert.ok(lettre.indexOf('From: Study Plan IB <ibstudyplan@gmail.com>') !== -1, lettre);
                const morceau = lettre.split('\r\n\r\n').pop().replace(/\s/g, '');
                const texte = Buffer.from(morceau, 'base64').toString('utf8');
                assert.ok(texte.indexOf('La réponse est prête.') !== -1, texte);
                assert.ok(texte.indexOf('Où est le mémoire ?') !== -1, texte);
                const enregistre = (context.boiteListesCache.reponses || []).some(function (rep) {
                    return rep.mail && rep.destinataire === 'eleve@example.com' && rep.email === 'ibstudyplan@gmail.com';
                });
                assert.strictEqual(enregistre, true, nom + ' n’a pas marqué le mail comme parti');
            });
        });
    }, Promise.resolve());
}).then(function () {
    context.userName = 'Sawadogo Juliss Bill Owen';
    context.boiteListesCache = { questions: [{ id: 'q2', texte: 'Aide', email: 'eleve@example.com' }], reponses: [], feedbacks: [], emplois: [] };
    context.fetch = function () {
        return Promise.resolve({
            ok: false,
            status: 422,
            json: function () { return Promise.resolve({ success: 'false', message: 'Activation' }); }
        });
    };
    bouton.disabled = false;
    context.boiteRepondre('q2', bouton);
    return new Promise(function (resolve) { setTimeout(resolve, 20); });
}).then(function () {
    const parti = (context.boiteListesCache.reponses || []).some(function (rep) { return rep.mail; });
    assert.strictEqual(parti, false, 'un échec a été marqué comme envoyé');
    assert.strictEqual(bouton.disabled, false);
    assert.strictEqual(jetons, 1, 'chaque admin a rouvert Google');
    console.log('ok bouton-google et mail Gmail vers eleve@example.com depuis ibstudyplan@gmail.com');
}).catch(function (err) {
    console.error(err);
    process.exit(1);
});
