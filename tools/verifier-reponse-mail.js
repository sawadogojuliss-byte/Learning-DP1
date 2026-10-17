/* Vérifie le mail de réponse aux questions (script Google), le rattachement
   d'une réponse à SA question, l'attribution des feedbacks — et le parcours
   complet d'un utilisateur qui envoie une question depuis la page Aide.
   Régressions couvertes :
   — la réponse partie pour une autre question s'affichait sur celle de
     Kenzah, cochée « répondue par Farid » alors que non ;
   — le popup « nouveaux messages » nommait le mauvais expéditeur ;
   — un accident pendant l'envoi (planning, coffre) laissait « Envoi… »
     bloqué pour toujours : le bouton ne faisait plus rien ;
   — la création d'un coffre kvdb cassait (403) et retardait chaque envoi ;
   — la page Aide parlait d'indésirables et de l'adresse de l'équipe. */
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
const aideTexte = { value: '' };
const aideEmail = { value: '' };
const aideStatut = { textContent: '', style: {} };
const aideChoix = { style: {} };
let reponseScript = function (payload) { return { success: true, id: payload.nonce }; };
let ntfyReponses = [];

const context = {
    console: console,
    Promise: Promise,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: function () { return 0; },
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
        if (id === 'aideTexte') return aideTexte;
        if (id === 'aideEmail') return aideEmail;
        if (id === 'aideStatut') return aideStatut;
        if (id === 'aideChoix') return aideChoix;
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
    if (u.indexOf('data/boite-url.json') !== -1) {
        return Promise.resolve({
            ok: true, status: 200,
            json: function () { return Promise.resolve({ sujet: 'ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b', kvdb: '', archive: '' }); }
        });
    }
    if (u.indexOf('ntfy.sh') !== -1) {
        var reponse = ntfyReponses.length ? ntfyReponses.shift() : { ok: true, status: 200 };
        return Promise.resolve({
            ok: !!reponse.ok,
            status: reponse.status || 200,
            json: function () { return Promise.resolve({}); },
            text: function () { return Promise.resolve(''); }
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

function attendre(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}
function postNtfy() {
    return appels.filter(function (item) {
        return item && item.url && item.url.indexOf('ntfy.sh') !== -1 && item.opts && item.opts.method === 'POST';
    });
}

/* — Pages et statiques — */
const html = fs.readFileSync('pages/compte.html', 'utf8');
assert.strictEqual(html.indexOf('compteGmail'), -1, 'le champ e-mail de connexion est encore là');
assert.strictEqual(html.indexOf('type="email"'), -1, 'la connexion demande encore de taper un e-mail');
const compte = fs.readFileSync('js/compte.js', 'utf8');
assert.strictEqual(compte.indexOf('gmail.send'), -1, 'la connexion Google ne doit pas demander le droit Gmail');
const boite = fs.readFileSync('js/pages/boite.js', 'utf8');
assert.strictEqual(boite.indexOf('boiteMotPresent'), -1, 'le rattachement d\'une réponse par simple prénom est de retour');
assert.strictEqual(boite.indexOf('https://kvdb.io'), -1, 'le navigateur ne doit plus créer de coffre kvdb lui-même');
assert.strictEqual(context.BOITE_EXPEDITEUR, 'ibstudyplan@gmail.com');

/* — Les quatre admins sont définis, et notifiés — */
assert.ok(boite.indexOf('BOITE_ADMINS_MAIL') !== -1, 'la liste des admins manque');
assert.ok(boite.indexOf('}, 6000)') !== -1, 'l\'envoi vers le fil ne doit plus attendre 12 s');
assert.ok(boite.indexOf('setTimeout(resolve, 1500)') !== -1, 'la reprise après un hoquet doit venir vite');
assert.ok(boite.indexOf("item.id.indexOf('qtest') === 0") !== -1, 'les envois de test doivent rester invisibles chez les admins');
assert.ok(fs.readFileSync('tools/sync-emplois.py', 'utf8').indexOf('qtest') !== -1, 'la synchronisation doit ignorer les envois de test');
['sawadogojuliss@gmail.com', 'faridsere86@gmail.com', 'ashleytamini10@gmail.com', 'rayyanouedraogo87@gmail.com'].forEach(function (mail) {
    assert.ok(boite.indexOf(mail) !== -1, 'admin manquant : ' + mail);
});
assert.ok(boite.indexOf('boiteAvertirAdmins(record)') !== -1, 'une question partie ne prévient pas les admins');
assert.ok(boite.indexOf('90000') !== -1, 'la surveillance de la boîte pour les admins manque');
assert.ok(boite.indexOf('boiteSignalerOuverture(true)') !== -1, 'le popup admin ne se rafraîchit pas tout seul');
assert.ok(fs.readFileSync('tools/sync-emplois.py', 'utf8').indexOf('def avertir_admins') !== -1, 'le filet de la synchronisation manque');

/* L'empreinte d'avis doit être identique en JS et en Python : c'est elle
   qui empêche le navigateur et la synchronisation de prévenir deux fois. */
const empreintePy = require('child_process').execFileSync('python3', ['-c',
    "import importlib.util as iu; spec = iu.spec_from_file_location('se', 'tools/sync-emplois.py'); m = iu.module_from_spec(spec); spec.loader.exec_module(m); print(m.cle_avertir('q1a14ada5592fd8140b9', 'faridsere86@gmail.com'))"
], { encoding: 'utf8' }).trim();
assert.strictEqual(context.boiteCleAvertir('q1a14ada5592fd8140b9', 'faridsere86@gmail.com'), empreintePy, 'les empreintes JS et Python diffèrent');
assert.strictEqual(context.boiteCleAvertir('q1', 'a@b.fr'), context.boiteCleAvertir('q1', 'a@b.fr'), 'empreinte instable');
assert.notStrictEqual(context.boiteCleAvertir('q1', 'a@b.fr'), context.boiteCleAvertir('q2', 'a@b.fr'), 'empreinte sans effet');

const aide = fs.readFileSync('pages/aide.html', 'utf8');
assert.strictEqual(aide.indexOf('indésirable'), -1, 'la page Aide parle encore des indésirables');
assert.strictEqual(aide.indexOf('ibstudyplan@gmail.com'), -1, 'la page Aide montre encore l\'adresse de l\'équipe');
assert.ok(boite.indexOf("'Question envoyée.'") !== -1, 'le message de succès doit être sobre');
assert.ok(boite.indexOf('Question envoyée. La réponse viendra de') === -1, 'l\'ancien message avec l\'adresse de l\'équipe est encore là');

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
            ntfyReponses = [];
            context.boiteRepondre(question.id, bouton);
            return attendre(120).then(function () {
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
    /* — Un échec d'envoi de mail n'est jamais marqué comme parti — */
    reponseScript = function () { return { success: false, error: 'Activation' }; };
    context.boitePosterChamps = function () { return Promise.reject(new Error('mail')); };
    context.boitePosterFormulaire = function () { return Promise.reject(new Error('mail')); };
    context.boiteAttendreConfirmation = function () { return Promise.reject(new Error('mail')); };
    context.userName = 'Sawadogo Juliss Bill Owen';
    context.boiteListesCache = { questions: [{ id: 'q2', at: '2026-10-17T17:13:05.170Z', texte: 'Aide', email: 'eleve@example.com', nom: 'Awa' }], reponses: [], feedbacks: [], emplois: [] };
    bouton.disabled = false;
    zone.textContent = '';
    context.boiteRepondre('q2', bouton);
    return attendre(120);
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

    /* — Parcours utilisateur : envoyer une question depuis la page Aide — */
    reponseScript = function (payload) { return { success: true, id: payload.nonce }; };
    context.userName = 'Awa';
    delete store[context.BOITE_FILE];
    appels.length = 0;
    ntfyReponses = [];
    aideTexte.value = 'Où est le mémoire de français ?';
    aideEmail.value = 'eleve@example.com';
    aideStatut.textContent = '';
    context.boiteQuestion(null);
    return attendre(150).then(function () {
        assert.strictEqual(aideStatut.textContent, 'Question envoyée.', 'statut reçu : ' + aideStatut.textContent);
        const envois = postNtfy();
        assert.ok(envois.length >= 1, 'la question n\'est pas partie vers le fil');
        const corps = JSON.parse(envois[0].opts.body);
        assert.strictEqual(corps.type, 'question');
        assert.strictEqual(corps.email, 'eleve@example.com');
        assert.ok(corps.texte.indexOf('mémoire de français') !== -1, 'le texte de la question manque');
        assert.strictEqual(envois[0].opts.headers.Title, 'question');
        assert.ok(!appels.some(function (item) { return item && item.url && item.url.indexOf('kvdb.io') !== -1; }), 'le navigateur a tenté de créer un coffre');
        assert.strictEqual(context.boiteEnvoiEnCours, false, 'le bouton reste bloqué après un envoi réussi');
        assert.strictEqual(aideTexte.value, '', 'la question n\'a pas été effacée après l\'envoi');

        /* — Les quatre admins sont prévenus par mail — */
        const avis = appels.filter(function (item) {
            if (!item || !item.url || item.url.indexOf('script.google.com') === -1) return false;
            try { return JSON.parse(item.opts.body).subject === 'Nouvelle question — Study Plan IB'; } catch (e) { return false; }
        });
        const cibles = avis.map(function (item) { return JSON.parse(item.opts.body).to; }).sort();
        assert.deepStrictEqual(cibles, ['ashleytamini10@gmail.com', 'faridsere86@gmail.com', 'rayyanouedraogo87@gmail.com', 'sawadogojuliss@gmail.com'].sort(), 'les quatre admins ne sont pas tous prévenus : ' + cibles.join(','));
        const corpsAvis = JSON.parse(avis[0].opts.body);
        assert.ok(/^n[a-f0-9]{16,}$/.test(corpsAvis.nonce), 'empreinte d\'avis mal formée : ' + corpsAvis.nonce);
        assert.ok(corpsAvis.text.indexOf('Awa') !== -1, 'l\'expéditeur manque dans l\'avis');
        assert.ok(corpsAvis.text.indexOf('mémoire de français') !== -1, 'la question manque dans l\'avis');
        assert.ok(corpsAvis.text.indexOf('Study Plan IB') !== -1, 'l\'équipe manque dans l\'avis');
        assert.ok(corpsAvis.html.indexOf('Study Plan IB') !== -1, 'le HTML de l\'avis manque');

        /* — Le fil hoquette une fois : la reprise doit suffire — */
        delete store[context.BOITE_FILE];
        appels.length = 0;
        ntfyReponses = [{ ok: false, status: 429 }, { ok: true, status: 200 }];
        aideTexte.value = 'Deuxième question, le fil hoquette.';
        aideStatut.textContent = '';
        context.boiteQuestion(null);
        return attendre(3200);
    }).then(function () {
        assert.strictEqual(aideStatut.textContent, 'Question envoyée.', 'reprise ratée, statut : ' + aideStatut.textContent);
        assert.strictEqual(postNtfy().length, 2, 'il devait y avoir deux tentatives');
        assert.strictEqual(context.boiteEnvoiEnCours, false);

        /* — Le planning plante : la question part quand même — */
        context.boitePublierEmploi = function () { throw new Error('boom'); };
        delete store[context.BOITE_FILE];
        appels.length = 0;
        ntfyReponses = [];
        aideTexte.value = 'Troisième question, le planning plante.';
        aideStatut.textContent = '';
        context.boiteQuestion(null);
        return attendre(150);
    }).then(function () {
        assert.strictEqual(aideStatut.textContent, 'Question envoyée.', 'le planning a emporté la question : ' + aideStatut.textContent);
        assert.strictEqual(context.boiteEnvoiEnCours, false, 'le bouton reste bloqué après l\'accident');
        assert.ok(postNtfy().length >= 1);

        /* — Le fil est vraiment mort : échec annoncé, question gardée,
             bouton réutilisable, puis réparation par la file — */
        delete store[context.BOITE_FILE];
        appels.length = 0;
        ntfyReponses = [{ ok: false, status: 503 }, { ok: false, status: 503 }];
        aideTexte.value = 'Quatrième question, le fil est mort.';
        aideStatut.textContent = '';
        context.boiteQuestion(null);
        return attendre(3200);
    }).then(function () {
        assert.ok(aideStatut.textContent.indexOf('Question envoyée par mail') !== -1, 'le fil est mort mais les admins sont prévenus : ' + aideStatut.textContent);
        const avisMorts = appels.filter(function (item) {
            if (!item || !item.url || item.url.indexOf('script.google.com') === -1) return false;
            try { return JSON.parse(item.opts.body).subject === 'Nouvelle question — Study Plan IB'; } catch (e) { return false; }
        });
        assert.ok(avisMorts.length >= 1, 'personne n\'a été prévenu pendant que le fil était mort');
        assert.strictEqual(context.boiteEnvoiEnCours, false, 'le bouton reste bloqué après l\'échec');
        const file = JSON.parse(store[context.BOITE_FILE] || '[]');
        assert.ok(file.some(function (item) { return item.type === 'question' && String(item.texte).indexOf('le fil est mort') !== -1; }), 'la question ratée n\'est pas gardée en file');
        assert.strictEqual(aideTexte.value, 'Quatrième question, le fil est mort.', 'la question ratée a été effacée');

        /* le fil revient : la file se vide toute seule */
        appels.length = 0;
        ntfyReponses = [];
        context.boiteReessayer();
        return attendre(150);
    }).then(function () {
        const file = JSON.parse(store[context.BOITE_FILE] || '[]');
        assert.ok(!file.some(function (item) { return String(item.texte).indexOf('le fil est mort') !== -1; }), 'la question gardée n\'a pas été rejouée');
        assert.ok(postNtfy().length >= 1, 'la reprise n\'a rien envoyé');

        /* — Fil mort ET script mort : là seulement, on annonce l'échec — */
        reponseScript = function () { return { success: false, error: 'reseau' }; };
        delete store[context.BOITE_FILE];
        appels.length = 0;
        ntfyReponses = [{ ok: false, status: 503 }, { ok: false, status: 503 }];
        aideTexte.value = 'Cinquième question, tout est mort.';
        aideStatut.textContent = '';
        context.boiteQuestion(null);
        return attendre(3200);
    }).then(function () {
        assert.ok(aideStatut.textContent.indexOf('n\'a pas abouti') !== -1, 'l\'échec total doit être annoncé : ' + aideStatut.textContent);
        assert.strictEqual(context.boiteEnvoiEnCours, false, 'bouton bloqué après l\'échec total');
        const fileTotale = JSON.parse(store[context.BOITE_FILE] || '[]');
        assert.ok(fileTotale.some(function (item) { return String(item.texte).indexOf('tout est mort') !== -1; }), 'la question de l\'échec total n\'est pas gardée');
        reponseScript = function (payload) { return { success: true, id: payload.nonce }; };
        delete store[context.BOITE_FILE];

        /* — Un admin qui envoie ne se prévient pas lui-même — */
        context.compteSession = { sub: 'subtest', email: 'sawadogojuliss@gmail.com' };
        delete store[context.BOITE_FILE];
        appels.length = 0;
        ntfyReponses = [];
        aideTexte.value = 'Question envoyée par un admin.';
        aideEmail.value = 'sawadogojuliss@gmail.com';
        aideStatut.textContent = '';
        context.boiteQuestion(null);
        return attendre(150);
    }).then(function () {
        const avis = appels.filter(function (item) {
            if (!item || !item.url || item.url.indexOf('script.google.com') === -1) return false;
            try { return JSON.parse(item.opts.body).subject === 'Nouvelle question — Study Plan IB'; } catch (e) { return false; }
        });
        const cibles = avis.map(function (item) { return JSON.parse(item.opts.body).to; }).sort();
        assert.deepStrictEqual(cibles, ['ashleytamini10@gmail.com', 'faridsere86@gmail.com', 'rayyanouedraogo87@gmail.com'].sort(), 'un admin s\'est prévenu lui-même : ' + cibles.join(','));
        delete context.compteSession;
    });
}).then(function () {
    console.log('ok question d’utilisateur (fil + reprise + file), mail de réponse, rattachement strict, popup aux bons noms');
}).catch(function (err) {
    console.error(err);
    process.exit(1);
});
