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
const feedbackTexte = { value: '' };
const feedbackEmail = { value: '' };
const feedbackStatut = { textContent: '', style: {} };
const feedbackEnvoi = { onclick: null };

let reponseScript = function (payload) { return { success: true, id: payload.nonce }; };
let firestoreEchec = false;
let nouvellesRegles = true;
let utilisateur = null;
let autoDoc = 0;
const bdd = { boite: [], publie: [], config: { mail: { secret: 'spx-test-secret' } } };

function fausseCollection(nom) {
    let champOrdre = '';
    return {
        add: function (data) {
            if (firestoreEchec) return Promise.reject(new Error('firestore'));
            if (!nouvellesRegles && nom !== 'boite' && nom !== 'publie') return Promise.reject(Object.assign(new Error('anciennes règles'), { code: 'permission-denied' }));
            bdd[nom] = bdd[nom] || [];
            bdd[nom].push(data);
            return Promise.resolve({ id: nom + bdd[nom].length });
        },
        orderBy: function (champ) { champOrdre = champ; return this; },
        where: function () { return this; },
        limit: function () { return this; },
        get: function () {
            var docs = (bdd[nom] || []).filter(function (d) {
                if (champOrdre === 'at') return !!d.at;
                if (champOrdre === 'z_donnees_techniques.at') return !!(d.z_donnees_techniques && d.z_donnees_techniques.at);
                return true;
            }).map(function (d) {
                return { data: function () { return d; } };
            });
            return Promise.resolve({ forEach: function (fn) { docs.forEach(fn); } });
        },
        doc: function (id) {
            return {
                id: id || 'fake-recu-' + (++autoDoc), nom: nom,
                collection: function () { return { doc: function () { return { id: 'h' + (++autoDoc), nom: nom + '/historique' }; } }; },
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
    firestore: function () { return { collection: fausseCollection, batch: function () {
        var operations = [];
        return { set: function (ref, data) { operations.push({ ref: ref, data: data }); },
            commit: function () {
                if (firestoreEchec || !nouvellesRegles) return Promise.reject(new Error('firestore'));
                operations.forEach(function (op) {
                    if (op.ref.nom === 'receptions_emplois') {
                        bdd.receptions_emplois = bdd.receptions_emplois || {};
                        bdd.receptions_emplois[op.ref.id] = op.data;
                    } else {
                        bdd[op.ref.nom] = bdd[op.ref.nom] || [];
                        bdd[op.ref.nom].push(op.data);
                    }
                });
                return Promise.resolve();
            } };
    } }; }
};
fauxFirebase.firestore.FieldValue = { serverTimestamp: () => "horodatage" };

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
        if (id === 'feedbackTexte') return feedbackTexte;
        if (id === 'feedbackEmail') return feedbackEmail;
        if (id === 'feedbackStatut') return feedbackStatut;
        if (id === 'feedbackEnvoi') return feedbackEnvoi;
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
    assert.notStrictEqual(boite.indexOf(mail), -1, 'adresse admin absente de la liste admin : ' + mail);
});
['Sawadogo Juliss Bill Owen', 'Sere Farid Abdourrahman', 'Tamini Ashley Kania Harisoa', 'Ouedraogo Wendsom Rayyan'].forEach(function (nom) {
    assert.strictEqual(boite.indexOf(nom), -1, 'un nom admin est encore dans la page : ' + nom);
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
assert.ok(regles.includes("ficheValide('question', '04_question')") && regles.includes("ficheValide('feedback', '04_feedback')"), 'le format compact est refusé');
['questions', 'feedbacks'].forEach(function (nom) {
    const create = regles.split('match /' + nom + '/{message} {')[1].split('allow update')[0];
    assert.ok(create.includes('allow create: if ficheValide(') && !create.includes('messageValide()'),
        'un ancien onglet peut encore écrire à plat dans ' + nom);
});
const archiveCreation = regles.split('match /boite/{message} {')[1].split('allow update')[0];
assert.ok(!archiveCreation.includes("'question'") && !archiveCreation.includes("'feedback'"),
    'un ancien onglet peut encore écrire un message à plat dans boite');

/* — Les identifiants admins, et eux seuls — */
context.compteSession = { sub: 'sub-google', email: 'SawadogoJuliss@Gmail.com', name: 'Sawadogo Juliss Bill Owen' };
assert.strictEqual(context.boiteEstAdmin(), true, 'l’adresse admin de Juliss n’est pas reconnue');
assert.strictEqual(context.boiteNom(), 'Sawadogo Juliss Bill Owen', 'la signature doit venir du compte Google, pas du code');
context.compteSession = { sub: 'sub-inconnu', email: 'eleve@example.test' };
assert.strictEqual(context.boiteEstAdmin(), false, 'une session sans adresse admin ne doit pas ouvrir les sections');
context.compteSession = { sub: '116965022060639990571', email: 'x@y.z' };
assert.strictEqual(context.boiteEstAdmin(), false, 'un identifiant seul ne doit plus ouvrir les sections');
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
    const nouvelleQuestion = bdd.questions[0];
    assert.deepStrictEqual(Object.keys(nouvelleQuestion).sort(),
        ['01_heure_envoi', '02_nom_utilisateur', '04_question', 'z_donnees_techniques'].sort(),
        'la fiche a encore des champs techniques visibles');
    assert.strictEqual(nouvelleQuestion.z_donnees_techniques.type, 'question');
    assert.strictEqual(nouvelleQuestion.z_donnees_techniques.email_reponse, 'eleve@example.com');
    assert.strictEqual(nouvelleQuestion['02_nom_utilisateur'], 'Awa');
    assert.ok(/Ouagadougou/.test(nouvelleQuestion['01_heure_envoi']), 'heure de l’envoi illisible');
    assert.ok(String(nouvelleQuestion['04_question']).indexOf('mémoire de français') !== -1, 'le texte manque');
    assert.ok(!('03_compte_gmail' in nouvelleQuestion), 'un visiteur sans Gmail a un faux compte');
    assert.ok(!('jours' in nouvelleQuestion) && !('matieres' in nouvelleQuestion), 'l’emploi du temps est copié dans la question');
    const lecture = context.boiteFusionner([context.boiteMessageDepuisFirestore('questions', nouvelleQuestion, 'doc-question')]);
    assert.strictEqual(lecture.questions[0].texte, 'Où est le mémoire de français ?', 'le site ne relit plus les questions compactes');
    assert.strictEqual(lecture.questions[0].email, 'eleve@example.com', 'l’adresse pour répondre est perdue');
    assert.strictEqual(aideTexte.value, '', 'la question n’a pas été effacée après l’envoi');
    assert.strictEqual(context.boiteEnvoiEnCours, false, 'le bouton reste bloqué après un envoi réussi');
    assert.strictEqual(context.boiteQuestionDepuisDocument({ type: 'question', '02_nom_utilisateur': 'Awa', '03_compte_gmail': 'awa@gmail.com', '04_question': 'Bonjour', z_email_reponse: 'contact@example.com', z_google_connecte: 'awa@gmail.com' }).google, 'awa@gmail.com', 'le Gmail connecté disparaît dans la rubrique admin');
    assert.ok(!appels.some(function (item) {
        return item && item.url && (item.url.indexOf('ntfy.sh') !== -1 || item.url.indexOf('kvdb.io') !== -1);
    }), 'un service public a été appelé');

    /* — Le vrai formulaire feedback suit le même format sans Gmail — */
    bdd.feedbacks = [];
    feedbackTexte.value = 'Suggestion locale';
    feedbackEmail.value = 'retour@example.com';
    context.initFeedback();
    feedbackEnvoi.onclick();
    return attendre(200);
}).then(function () {
    assert.strictEqual(feedbackStatut.textContent, 'Suggestion envoyée.');
    assert.strictEqual(bdd.feedbacks.length, 1);
    const avis = bdd.feedbacks[0];
    assert.deepStrictEqual(Object.keys(avis).sort(),
        ['01_heure_envoi', '02_nom_utilisateur', '04_feedback', 'z_donnees_techniques'].sort());
    assert.strictEqual(avis['04_feedback'], 'Suggestion locale');
    assert.strictEqual(avis.z_donnees_techniques.email_reponse, 'retour@example.com');
    assert.strictEqual(avis.z_donnees_techniques.type, 'feedback');
    const ancienEnAttente = context.boiteMessagePourFirestore({
        type: 'feedback', id: 'f-attente', at: '2026-10-24T02:34:00.000Z',
        nom: 'Awa', texte: 'Avis conservé', email: 'contact@example.com'
    });
    assert.ok(ancienEnAttente['01_heure_envoi'].includes('Ouagadougou'),
        'une file locale ancienne perd son heure à la reprise');
    assert.strictEqual(ancienEnAttente['04_feedback'], 'Avis conservé');
    assert.strictEqual(ancienEnAttente.z_donnees_techniques.email_reponse, 'contact@example.com');

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
        return item.type === 'question' && String(item['04_question']).indexOf('base est muette') !== -1;
    }), 'la question ratée n’est pas gardée en file');

    /* — La base revient : la file se vide — */
    firestoreEchec = false;
    bdd.questions = [];
    return context.boiteReessayer().then(function () { return attendre(80); });
}).then(function () {
    const file = JSON.parse(store[context.BOITE_FILE] || '[]');
    assert.ok(!file.some(function (item) { return String(item['04_question']).indexOf('base est muette') !== -1; }), 'la question gardée n’a pas été rejouée');
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
        assert.ok(payload.subject.indexOf('Studyplan') !== -1, payload.subject);
        assert.ok(/^(Bonjour|Bonsoir) Kenzah,$/.test(payload.salutation), 'salutation inattendue : ' + payload.salutation);
        assert.ok(payload.text.indexOf(payload.salutation + '\n') === 0, 'le mail ne commence pas par la salutation');
        assert.ok(payload.text.indexOf('Ta question :') !== -1, 'la question d’origine manque');
        assert.ok(payload.text.indexOf('À bientôt,\nL\'équipe Studyplan') !== -1, 'la signature manque');
        assert.ok(payload.html.indexOf('Studyplan') !== -1, 'le HTML manque');
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
        const avis = context.boiteMessagePourFirestore({
            type: 'feedback', id: 'f2-new', at: '2026-10-24T06:01:00Z',
            '01_heure_envoi': '24/10/2026 06:01 (Ouagadougou)',
            '02_nom_utilisateur': 'Awa', '03_compte_gmail': 'awa@gmail.com',
            '04_feedback': 'Avis privé', z_email_reponse: 'contact@example.com',
            z_google_connecte: 'awa@gmail.com', z_google_nom: 'Awa'
        });
        assert.deepStrictEqual(Object.keys(avis).sort(),
            ['01_heure_envoi', '02_nom_utilisateur', '03_compte_gmail', '04_feedback', 'z_donnees_techniques'].sort());
        bdd.feedbacks.push(avis);
        bdd.reponses = [{ type: 'reponse', id: 'r-new', at: '2026-10-24T06:01:00Z', texte: 'Réponse privée' }];
        bdd.emplois_du_temps = [
            { type: 'emploi', id: 'e-new', at: '2026-10-24T06:02:00Z', z_donnees_techniques: { firebaseUid: 'uid-eleve' } },
            /* Élève jamais connecté : gardé dans Firebase, jamais affiché dans l'administration. */
            { type: 'emploi', id: 'e-anonyme', at: '2026-10-24T06:03:00Z', z_donnees_techniques: { firebaseUid: '', googleSub: '', google: '', email: '' } }
        ];
        context.boiteBruts = [];
        context.boiteDernierAt = '';
        return context.boiteLireBoite();
    }).then(function (items) {
        assert.ok(items.some(function (item) { return item.id === 'q-archive'; }), 'ancienne question perdue');
        assert.ok(items.some(function (item) { return item.id === 'f-new'; }), 'ancien feedback absent');
        assert.ok(items.some(function (item) { return item.id === 'f2-new' && item.texte === 'Avis privé' && item.email === 'contact@example.com'; }), 'feedback compact ou adresse de réponse perdu');
        assert.ok(items.some(function (item) { return item.id === 'r-new'; }), 'nouvelle réponse absente');
        assert.ok(items.some(function (item) { return item.id === 'e-new'; }), 'nouvel emploi du temps absent');
        assert.ok(!items.some(function (item) { return item.id === 'e-anonyme'; }), 'un élève jamais connecté est affiché');
        const planning = {
            type: 'emploi', id: 'e-envoye', at: new Date().toISOString(),
            nom: 'Awa', classe: 'DP2', appareil: 'app-awa',
            matieres: ['Mathématiques AA SL', 'Physique HL'],
            jours: [
                { j: 'Lundi', s: [
                    { d: '10:00', f: '11:00', t: 'Français' },
                    { d: '08:00', f: '09:30', t: 'Mathématiques' }
                ] },
                { j: 'Mardi', s: [{ d: '14:00', f: '15:00', t: 'Physique' }] }
            ]
        };
        assert.strictEqual(context.boiteDecouperEmploi(planning).length, 1, 'un planning Firestore a été découpé par jour');
        const document = context.boiteEmploiPourFirestore(planning);
        assert.strictEqual(document['01_nom_utilisateur'], 'Awa', 'nom absent en tête');
        assert.strictEqual(document['02_matieres'][1], 'Physique HL', 'matières absentes');
        assert.strictEqual(document['03_emploi_du_temps']['01_Lundi'][0], '08h00 – 09h30  ·  Mathématiques', 'premier jour illisible ou non trié par heure');
        assert.strictEqual(document['03_emploi_du_temps']['02_Mardi'][0], '14h00 – 15h00  ·  Physique', 'semaine incomplète');
        assert.ok(!('jours' in document) && !('matieres' in document) && !('nom' in document), 'champs techniques mélangés à la fiche lisible');
        const relecture = context.boiteFusionner([document]);
        assert.strictEqual(relecture.emplois[0].jours[1].s[0].t, 'Physique', 'le site a perdu les vrais créneaux');
        assert.strictEqual(relecture.emplois[0].jours[0].s[0].t, 'Français', 'le tri d’affichage a modifié le planning source');
        assert.strictEqual(relecture.emplois[0].appareil, 'app-awa', 'l’identifiant du planning est perdu');
        /* Nouvelle semaine complète : la migration conserve la file, la
           création distante est reçue, la question en attente subsiste. */
        const nombreAvant = bdd.emplois_du_temps.length;
        store[context.BOITE_FILE] = JSON.stringify([
            planning,
            { type: 'question', id: 'q-pending', at: new Date().toISOString(), '04_question': 'Question en attente' }
        ]);
        const enAttente = context.boiteLireFile();
        assert.ok(enAttente.some(function (item) { return item.type === 'emploi'; }), 'ancien emploi en attente effacé');
        assert.ok(JSON.parse(store[context.BOITE_FILE]).some(function (item) { return item.id === 'q-pending'; }), 'question en attente effacée');
        planning.jours = planning.jours.concat(['Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(function (j) { return { j: j, s: [] }; }));
        planning.complet = 1;
        planning.schema = 2;
        return context.boiteEnvoyer(planning).then(function (ok) {
            assert.strictEqual(ok, true, 'l’emploi complet doit être reçu');
            assert.strictEqual(bdd.emplois_du_temps.length, nombreAvant + 1, 'la copie n’est pas dans Firestore');
            assert.strictEqual(bdd.emplois_du_temps.at(-1).z_donnees_techniques.jours.length, 7, 'semaine partielle');
            assert.strictEqual(Object.keys(JSON.parse(store[context.BOITE_EMPLOI_FILE] || '{}')).length, 0, 'ACK non retiré');
            assert.strictEqual(context.boiteEmploiAvecCreneaux({ jours: [] }), false, 'un planning vide est validé');
            return context.boiteEcrireBoite({ type: 'emploi', id: 'e-vide', at: new Date().toISOString(), jours: [] }).then(function () {
                throw new Error('un planning vide pourrait partir');
            }, function (vide) { assert.strictEqual(vide.message, 'emploi_vide'); });
        });
    }).then(function () {
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
