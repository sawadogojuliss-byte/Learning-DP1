/* Vérifie la boîte privée : les messages partent dans Firestore, seuls
   les quatre comptes admins peuvent les lire, et le mail de réponse
   part par le script Google avec un secret qui n'est plus dans la page.

   Régressions couvertes :
   — un canal public (ntfy) exposait questions, emplois du temps et
     adresses à quiconque connaissait son nom ;
   — le prénom tapé à l'accueil ouvrait les sections réservées ;
   — le secret d'envoi des mails et les adresses des admins étaient
     écrits dans la page, donc lisibles par tous ;
   — une réponse partie pour une autre question s'affichait sur celle
     de Kenzah, cochée « répondue » alors que non ;
   — le popup « nouveaux messages » nommait le mauvais expéditeur ;
   — un accident pendant l'envoi laissait « Envoi… » bloqué. */
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
let firestoreEchec = false;
let nouvellesRegles = true;
let utilisateur = null;
const bdd = { boite: [], publie: [], config: { mail: { secret: 'spx-test-secret' } } };

function fausseCollection(nom) {
    return {
        add: function (data) {
            if (firestoreEchec) return Promise.reject(new Error('firestore'));
            if (!nouvellesRegles && nom !== 'boite' && nom !== 'publie') return Promise.reject(Object.assign(new Error('anciennes règles'), { code: 'permission-denied' }));
            bdd[nom] = bdd[nom] || [];
            bdd[nom].push(data);
            return Promise.resolve({ id: nom + bdd[nom].length });
        },
        orderBy: function () { return this; },
        where: function () { return this; },
        limit: function () { return this; },
        get: function () {
            var docs = (bdd[nom] || []).map(function (d) {
                return { data: function () { return d; } };
            });
            return Promise.resolve({ forEach: function (fn) { docs.forEach(fn); } });
        },
        doc: function (id) {
            return {
                get: function () {
                    var v = (bdd[nom] || {})[id];
                    return Promise.resolve({ exists: !!v, data: function () { return v; } });
                }
            };
        }
    };
}

const fauxFirebase = {
    apps: [{}],
    auth: function () {
        return {
            currentUser: utilisateur,
            onAuthStateChanged: function (cb) { setTimeout(function () { cb(utilisateur); }, 0); }
        };
    },
    firestore: function () { return { collection: fausseCollection }; }
};

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
/* Firebase est remplacé par une base en mémoire : le test ne sort pas. */
context.firebase = fauxFirebase;
context.compteChargerFirebase = function () { return Promise.resolve(fauxFirebase); };

function attendre(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

const boite = fs.readFileSync('js/pages/boite.js', 'utf8');
const regles = fs.readFileSync('firestore.rules', 'utf8');
const compte = fs.readFileSync('js/compte.js', 'utf8');
const aide = fs.readFileSync('pages/aide.html', 'utf8');

/* — Rien de privé dans la page — */
assert.strictEqual(boite.indexOf('ntfy.sh'), -1, 'le canal public est encore dans la page');
assert.strictEqual(boite.indexOf('BOITE_SUJET'), -1, 'le nom du canal public est encore dans la page');
assert.strictEqual(boite.indexOf('BOITE_SCRIPT_SECRET'), -1, 'le secret d’envoi est encore dans la page');
assert.strictEqual(boite.indexOf('spib-'), -1, 'le secret d’envoi est encore dans la page');
assert.strictEqual(boite.indexOf('kvdb'), -1, 'le coffre public est encore dans la page');
['sawadogojuliss@gmail.com', 'faridsere86@gmail.com', 'ashleytamini10@gmail.com', 'rayyanouedraogo87@gmail.com'].forEach(function (mail) {
    assert.strictEqual(boite.indexOf(mail), -1, 'une adresse admin est encore dans la page : ' + mail);
});
assert.strictEqual(compte.indexOf('gmail.send'), -1, 'la connexion Google ne doit pas demander le droit Gmail');
assert.strictEqual(compte.indexOf('boiteEcrireNtfy'), -1, 'la progression ne doit plus partir sur un fil public');
assert.ok(compte.indexOf('firebase.auth().signOut()') !== -1, 'la déconnexion doit fermer la session Firebase');
assert.deepStrictEqual(JSON.parse(fs.readFileSync('data/boite-url.json', 'utf8')), {}, 'le nom du canal public traîne encore');
assert.deepStrictEqual(JSON.parse(fs.readFileSync('data/emplois.json', 'utf8')).emplois, [], 'les emplois du temps restent publics');
assert.deepStrictEqual(JSON.parse(fs.readFileSync('data/comptes.json', 'utf8')).comptes, [], 'les profils restent publics');

/* — Les règles Firestore font la vraie serrure — */
assert.ok(regles.indexOf('match /boite/') !== -1, 'la collection privée n’est pas protégée');
assert.ok(/match \/boite\/\{message\} \{\s*allow read: if estAdmin\(\);/.test(regles), 'la lecture privée n’est pas réservée aux admins');
assert.ok(/allow create: if messageValide\(\)/.test(regles), 'l’écriture doit rester ouverte');
assert.ok(regles.includes("'ibstudyplan@gmail.com'"), 'le compte entreprise ne peut pas lire');
assert.ok(regles.indexOf('allow read: if true') !== -1, 'les annonces et tutoriels doivent rester publics');
assert.ok(regles.indexOf("request.auth.token.email in [") !== -1, 'les admins ne sont pas reconnus par leur compte');

/* — Les identifiants admins, et eux seuls — */
context.compteSession = { sub: '116965022060639990571', email: 'x@y.z' };
assert.strictEqual(context.boiteEstAdmin(), true, 'le compte de Juliss n’est pas reconnu');
assert.strictEqual(context.boiteNom(), 'Sawadogo Juliss Bill Owen', 'le compte gardé doit rester le seul nom d’admin');
context.compteSession = { sub: 'subtest', email: 'sawadogojuliss@gmail.com' };
assert.strictEqual(context.boiteEstAdmin(), false, 'une adresse seule ne doit plus ouvrir les sections');
context.compteSession = null;
context.userName = 'Sawadogo Juliss Bill Owen';
assert.strictEqual(context.boiteEstAdmin(), false, 'le prénom tapé ne doit plus ouvrir les sections');
context.userName = '';

/* — Une question part dans la base privée — */
context.userName = 'Awa';
delete store[context.BOITE_FILE];
bdd.questions = [];
aideTexte.value = 'Où est le mémoire de français ?';
aideEmail.value = 'eleve@example.com';
aideStatut.textContent = '';
context.boiteQuestion(null);

attendre(200).then(function () {
    assert.strictEqual(aideStatut.textContent, 'Question envoyée.', 'statut reçu : ' + aideStatut.textContent);
    assert.strictEqual(bdd.questions.length, 1, 'la question n’est pas partie dans la boîte privée');
    assert.strictEqual(bdd.questions[0].type, 'question');
    assert.strictEqual(bdd.questions[0].email, 'eleve@example.com');
    assert.ok(String(bdd.questions[0].texte).indexOf('mémoire de français') !== -1, 'le texte manque');
    assert.strictEqual(aideTexte.value, '', 'la question n’a pas été effacée après l’envoi');
    assert.strictEqual(context.boiteEnvoiEnCours, false, 'le bouton reste bloqué après un envoi réussi');
    assert.ok(!appels.some(function (item) {
        return item && item.url && (item.url.indexOf('ntfy.sh') !== -1 || item.url.indexOf('kvdb.io') !== -1);
    }), 'un service public a été appelé');

    /* — La base refuse : la question est gardée, l'échec annoncé — */
    firestoreEchec = true;
    delete store[context.BOITE_FILE];
    aideTexte.value = 'Deuxième question, la base est muette.';
    aideStatut.textContent = '';
    context.boiteQuestion(null);
    return attendre(200);
}).then(function () {
    assert.ok(aideStatut.textContent.indexOf('n\'a pas abouti') !== -1, 'l’échec doit être annoncé : ' + aideStatut.textContent);
    assert.strictEqual(context.boiteEnvoiEnCours, false, 'le bouton reste bloqué après l’échec');
    const file = JSON.parse(store[context.BOITE_FILE] || '[]');
    assert.ok(file.some(function (item) {
        return item.type === 'question' && String(item.texte).indexOf('base est muette') !== -1;
    }), 'la question ratée n’est pas gardée en file');

    /* — La base revient : la file se vide — */
    firestoreEchec = false;
    bdd.questions = [];
    return context.boiteReessayer().then(function () { return attendre(80); });
}).then(function () {
    const file = JSON.parse(store[context.BOITE_FILE] || '[]');
    assert.ok(!file.some(function (item) { return String(item.texte).indexOf('base est muette') !== -1; }), 'la question gardée n’a pas été rejouée');
    assert.strictEqual(bdd.questions.length, 1, 'la reprise n’a rien écrit');

    /* — Le mail de réponse : secret lu dans la configuration privée — */
    utilisateur = { uid: '116965022060639990571', email: 'sawadogojuliss@gmail.com' };
    context.compteSession = { sub: '116965022060639990571', email: 'sawadogojuliss@gmail.com' };
    context.userName = 'Sawadogo Juliss Bill Owen';
    const question = {
        id: 'q1a14ada5592fd8140b9',
        at: '2026-10-17T17:13:05.170Z',
        texte: "vous avez dit que le nombre maximum d'heure de sommeil est de 5 heures.",
        email: 'doriilboudo235@gmail.com',
        google: 'doriilboudo235@gmail.com',
        nom: 'Kenzah',
        googleNom: 'Kenzah ILBOUDO'
    };
    context.boiteListesCache = { questions: [question], reponses: [], feedbacks: [], emplois: [] };
    zone.textContent = '';
    bouton.disabled = false;
    appels.length = 0;
    context.boiteRepondre(question.id, bouton);
    return attendre(250).then(function () {
        const envoi = appels.filter(function (item) {
            return item && item.url && item.url.indexOf('script.google.com') !== -1;
        })[0];
        assert.ok(envoi, 'le script d’envoi n’a pas été appelé');
        const payload = JSON.parse(envoi.opts.body);
        assert.strictEqual(payload.to, 'doriilboudo235@gmail.com');
        assert.strictEqual(payload.secret, 'spx-test-secret', 'le secret ne vient pas de la configuration privée');
        assert.ok(payload.subject.indexOf('Study Plan IB') !== -1, payload.subject);
        assert.ok(/^(Bonjour|Bonsoir) Kenzah,$/.test(payload.salutation), 'salutation inattendue : ' + payload.salutation);
        assert.ok(payload.text.indexOf(payload.salutation + '\n') === 0, 'le mail ne commence pas par la salutation');
        assert.ok(payload.text.indexOf('Ta question :') !== -1, 'la question d’origine manque');
        assert.ok(payload.text.indexOf('À bientôt,\nL\'équipe Study Plan IB') !== -1, 'la signature manque');
        assert.ok(payload.html.indexOf('Study Plan IB') !== -1, 'le HTML manque');
        const record = (context.boiteListesCache.reponses || []).filter(function (rep) { return rep.questionId === question.id; })[0];
        assert.ok(record, 'la réponse n’est pas gardée');
        assert.strictEqual(record.mail, true, 'marquée non envoyée');
        assert.strictEqual(record.repondu, true);
        assert.strictEqual(record.destinataire, 'doriilboudo235@gmail.com');

        /* — Un échec d'envoi n'est jamais marqué comme parti — */
        reponseScript = function () { return { success: false, error: 'Activation' }; };
        context.boitePosterChamps = function () { return Promise.reject(new Error('mail')); };
        context.boitePosterFormulaire = function () { return Promise.reject(new Error('mail')); };
        const autre = { id: 'q2', at: '2026-10-17T17:13:05.170Z', texte: 'Aide', email: 'eleve@example.com', nom: 'Awa' };
        context.boiteListesCache = { questions: [autre], reponses: [], feedbacks: [], emplois: [] };
        bouton.disabled = false;
        zone.textContent = '';
        context.boiteRepondre('q2', bouton);
        return attendre(250);
    });
}).then(function () {
    const parti = (context.boiteListesCache.reponses || []).some(function (rep) { return rep.mail; });
    assert.strictEqual(parti, false, 'un échec a été marqué comme envoyé');
    assert.strictEqual(bouton.disabled, false, 'le bouton doit redevenir cliquable après un échec');
    assert.ok(zone.textContent.length > 5, 'aucun message d’échec affiché');

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
    assert.strictEqual(context.boiteReponseLiee(faridPourKenzaEcole, kenzah, {}), false, 'l’ancienne réponse pour l’adresse école ne doit pas se rattacher');
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
    assert.ok(neuf.lignes[1].indexOf('Kenzah ILBOUDO') !== -1, 'le nom du compte Google doit l’emporter : ' + neuf.lignes[1]);

    /* — Les annonces et tutoriels restent publics, le reste non — */
    assert.ok(boite.indexOf("annonce: 'publie', tutoriel: 'publie'") !== -1, 'la séparation public / privé manque');
    assert.ok(boite.indexOf('BOITE_COLLECTIONS[propre.type]') !== -1, 'les messages ne sont pas triés');

    /* Refus Firebase : surtout PAS de succès trompeur ni de repli dans
       boite. La file conserve le message si le formulaire a été utilisé. */
    nouvellesRegles = false;
    var archivesAvant = bdd.boite.length;
    return context.boiteEcrireBoite({ type: 'question', id: 'q-refuse', at: new Date().toISOString(), texte: 'Accès refusé' }).then(function () {
        throw new Error('un refus Firestore a été signalé comme succès');
    }, function (err) {
        assert.strictEqual(err.code, 'permission-denied', 'le vrai refus a disparu');
        assert.strictEqual(bdd.boite.length, archivesAvant, 'repli silencieux dans boite');
        nouvellesRegles = true;
        /* Le cinquième compte Google est reconnu par une vraie lecture
           Firestore, pas par l'adresse tapée dans le navigateur. */
        context.compteSession = { sub: 'entreprise-sub', email: 'ibstudyplan@gmail.com' };
        utilisateur = { uid: 'firebase-entreprise', email: 'ibstudyplan@gmail.com' };
        context.boiteAdminVerifie = false;
        context.boiteAdminTente = false;
        return context.boiteVerifierAdmin();
    }).then(function (admin) {
        assert.strictEqual(admin, true, 'le compte entreprise ne voit pas la boîte');
        bdd.boite = [{ type: 'question', id: 'q-archive', at: '2026-10-19T06:00:00Z', texte: 'Ancienne question' }];
        bdd.feedbacks = [{ type: 'feedback', id: 'f-new', at: '2026-10-24T06:00:00Z', texte: 'Feedback privé' }];
        bdd.reponses = [{ type: 'reponse', id: 'r-new', at: '2026-10-24T06:01:00Z', texte: 'Réponse privée' }];
        bdd.emplois_du_temps = [{ type: 'emploi', id: 'e-new', at: '2026-10-24T06:02:00Z' }];
        context.boiteBruts = [];
        context.boiteDernierAt = '';
        return context.boiteLireBoite();
    }).then(function (items) {
        assert.ok(items.some(function (item) { return item.id === 'q-archive'; }), 'ancienne question perdue');
        assert.ok(items.some(function (item) { return item.id === 'f-new'; }), 'nouveau feedback absent');
        assert.ok(items.some(function (item) { return item.id === 'r-new'; }), 'nouvelle réponse absente');
        assert.ok(items.some(function (item) { return item.id === 'e-new'; }), 'nouvel emploi du temps absent');
        return context.boiteEcrireBoite({ type: 'emploi', id: 'e-envoye', at: new Date().toISOString() });
    }).then(function () {
        assert.ok(bdd.emplois_du_temps.some(function (item) { return item.id === 'e-envoye'; }), 'écriture emploi du temps dans la mauvaise collection');
        store[context.BOITE_VUS] = JSON.stringify({ questions: [{ texte: 'copie privée' }] });
        context.boiteSecretCache = 'secret temporaire';
        context.boiteNettoyerSession();
        assert.strictEqual(store[context.BOITE_VUS], undefined, 'une copie privée reste sur l’appareil');
        assert.strictEqual(context.boiteSecretCache, '', 'le secret mail reste après déconnexion');
        assert.strictEqual(context.boiteBruts.length, 0, 'la boîte reste en mémoire après déconnexion');
    }).then(function () {
        /* — La page Aide reste sobre — */
        assert.strictEqual(aide.indexOf('indésirable'), -1, 'la page Aide parle encore des indésirables');
        assert.strictEqual(aide.indexOf('ibstudyplan@gmail.com'), -1, 'la page Aide montre encore l’adresse de l’équipe');
        assert.ok(boite.indexOf("'Question envoyée.'") !== -1, 'le message de succès doit être sobre');
    });
})
    .then(function () {
        console.log('ok boîte privée (Firestore), admins par compte Google, mail de réponse, rattachement strict, popup aux bons noms');
    })
    .catch(function (err) {
        console.error(err);
        process.exit(1);
    });
