/* Semaine et synchronisation : sous-section « semaine » de chaque fiche,
   indicateur d'effacement qui suit l'élève, vérification hebdomadaire sur le
   serveur, et règles de la collection synchronisation. Sans réseau. */
const fs = require('fs');
/* Objets créés dans un autre contexte d'exécution : comparaison du contenu. */
function same(a, b, message) { assert.strictEqual(JSON.stringify(a), JSON.stringify(b), message); }
const vm = require('vm');
const assert = require('assert');

const boite = fs.readFileSync('js/pages/boite.js', 'utf8');
const regles = fs.readFileSync('firestore.rules', 'utf8');

function extraire(source, nom) {
    const debut = source.indexOf('function ' + nom + '(');
    assert(debut !== -1, 'fonction absente : ' + nom);
    const fin = source.indexOf('\n}', debut);
    return source.slice(debut, fin + 2);
}

/* 1. Sous-section « semaine » : dates, numéro ISO et année ISO. */
const ctxSemaine = vm.createContext({ console });
vm.runInContext(
    extraire(boite, 'boiteJourCle') + extraire(boite, 'boiteSemaineInfo') + extraire(boite, 'boiteEffacementGarde') +
    extraire(boite, 'boiteSemaineARefaire') + extraire(boite, 'boiteEmploiPourFirestore'),
    ctxSemaine);
const info = ctxSemaine.boiteSemaineInfo;
same(JSON.parse(JSON.stringify(info(new Date(2026, 9, 31)))),
    { dates: '26 oct. – 1 nov. 2026', debut: '2026-10-26', fin: '2026-11-01', numero: 44, annee: 2026 }, 'semaine 44 de 2026 (samedi 31 octobre)');
same(JSON.parse(JSON.stringify(info(new Date(2026, 0, 1)))),
    { dates: '29 déc. – 4 janv. 2026', debut: '2025-12-29', fin: '2026-01-04', numero: 1, annee: 2026 }, 'premier jeudi de 2026 : semaine 1');
same(JSON.parse(JSON.stringify(info(new Date(2027, 0, 1)))),
    { dates: '28 déc. – 3 janv. 2027', debut: '2026-12-28', fin: '2027-01-03', numero: 53, annee: 2026 }, 'vendredi 1er janvier 2027 : semaine 53 de 2026');
same(JSON.parse(JSON.stringify(info(new Date(2026, 9, 26)))),
    { dates: '26 oct. – 1 nov. 2026', debut: '2026-10-26', fin: '2026-11-01', numero: 44, annee: 2026 }, 'lundi : même semaine');

const fiche = ctxSemaine.boiteEmploiPourFirestore({
    type: 'emploi', id: 'e_x', at: '2026-10-31T08:00:00.000Z', nom: 'Ali', matieres: ['Maths'],
    jours: [{ j: 'Lundi', s: [{ d: '08:00', f: '09:00', t: 'Maths' }] }]
}, new Date(2026, 9, 31));
same(JSON.parse(JSON.stringify(fiche['Semaine actuelle'])),
    { dates: '26 oct. – 1 nov. 2026', debut: '2026-10-26', fin: '2026-11-01', numero: 44, annee: 2026 }, 'sous-section semaine dans la fiche');
assert(Object.keys(fiche).includes('03_emploi_du_temps'), 'créneaux toujours présents');

/* 2. L'indicateur d'effacement suit l'élève. */
same(ctxSemaine.boiteEffacementGarde({ effaceParEleve: true, effaceLe: 'A' }, null), { effaceLe: 'A' },
    'la synchronisation effacée marque la nouvelle semaine');
same(ctxSemaine.boiteEffacementGarde(null, { z_donnees_techniques: { effaceParEleve: true, effaceLe: 'B' } }), { effaceLe: 'B' },
    'la fiche effacée est gardée');
assert.strictEqual(ctxSemaine.boiteEffacementGarde({}, { z_donnees_techniques: {} }), null, 'rien à garder sans marque');
assert.strictEqual(ctxSemaine.boiteEffacementGarde(null, null), null, 'rien sans sync ni fiche');

/* 3. Décision hebdomadaire. */
assert.strictEqual(ctxSemaine.boiteSemaineARefaire(null, true, '2026-10-26'), true, 'sans synchronisation : renvoyer');
assert.strictEqual(ctxSemaine.boiteSemaineARefaire({ semaine: '2026-10-19' }, true, '2026-10-26'), true, 'autre semaine : renvoyer');
assert.strictEqual(ctxSemaine.boiteSemaineARefaire({ semaine: '2026-10-26' }, false, '2026-10-26'), true, 'fiche absente : renvoyer');
assert.strictEqual(ctxSemaine.boiteSemaineARefaire({ semaine: '2026-10-26' }, true, '2026-10-26'), false, 'à jour : rien à refaire');

/* 4. Vérification sur le serveur : les quatre cas, avec une fausse base. */
const store = {};
function docRef(nom, id) {
    return {
        get() {
            const cle = nom + '/' + id;
            return Promise.resolve(store[cle] !== undefined
                ? { exists: true, data: () => JSON.parse(JSON.stringify(store[cle])) }
                : { exists: false });
        }
    };
}
const appels = [];
const ctx = vm.createContext({
    console,
    window: {},
    BOITE_EMPLOIS_SUSPENDUS: false,
    boiteNom: () => 'Ali',
    boiteFirebasePret: () => Promise.resolve({ uid: 'U1' }),
    boiteIdEmploi: () => Promise.resolve('ID1'),
    boiteSemaineCle: () => '2026-10-26',
    boitePublierEmploi: (...args) => { appels.push(args); },
    firebase: { firestore: () => ({ collection: (nom) => ({ doc: (id) => docRef(nom, id) }) }) },
    boiteSemaineVerifiee: ''
});
vm.runInContext(extraire(boite, 'boiteSemaineARefaire') + extraire(boite, 'boiteVerifierSemaine'), ctx);

async function scenario(nom, sync, emploi, attendu) {
    for (const cle of Object.keys(store)) delete store[cle];
    if (sync !== undefined) store['synchronisation/U1'] = sync;
    if (emploi) store['emplois_du_temps/ID1'] = { z_donnees_techniques: { firebaseUid: 'U1' } };
    appels.length = 0;
    ctx.boiteSemaineVerifiee = '';
    await ctx.boiteVerifierSemaine(true);
    same(appels.map(a => a.slice(0, 2)), [attendu], nom);
}

(async function () {
    await scenario('semaine courante et fiche présente : envoi normal', { semaine: '2026-10-26' }, true, [false]);
    await scenario('nouvelle semaine : renvoi forcé', { semaine: '2026-10-19' }, true, [false, true]);
    await scenario('fiche de la semaine absente : renvoi forcé', { semaine: '2026-10-26' }, false, [false, true]);
    await scenario('synchronisation absente : renvoi forcé', undefined, true, [false, true]);

    /* Une seule vérification par semaine et par session, sauf à la connexion. */
    appels.length = 0;
    ctx.boiteSemaineVerifiee = '2026-10-26';
    await ctx.boiteVerifierSemaine(false);
    assert.strictEqual(appels.length, 0, 'déjà vérifiée cette semaine');
    await ctx.boiteVerifierSemaine(true);
    assert.strictEqual(appels.length, 1, 'la connexion force la vérification');

    /* 5. Règles : sous-section optionnelle ; synchronisation réservée à son propriétaire. */
    const debutEmplois = regles.indexOf('match /emplois_du_temps/{message}');
    const debutValide = regles.indexOf('function emploiValide()');
    const bloc = regles.slice(debutValide, debutEmplois);
    assert(bloc.includes("'Semaine actuelle'") && bloc.includes("!('Semaine actuelle' in request.resource.data)"), 'emploiValide accepte la sous-section Semaine actuelle');
    const debutSync = regles.indexOf('match /synchronisation/{uid}');
    assert(debutSync !== -1, 'bloc synchronisation présent');
    const blocSync = regles.slice(debutSync, regles.indexOf('\n    }', debutSync) + 6);
    assert(!/allow (read|list): if true/.test(blocSync), 'synchronisation jamais publique');
    assert(blocSync.includes('allow list: if false'), 'synchronisation jamais listée');
    assert(blocSync.includes("request.auth.uid == uid"), 'synchronisation réservée au propriétaire');
    assert(!/estAdmin\(\)/.test(blocSync), 'synchronisation : même les admins n\'ont pas accès');
    assert(blocSync.includes('allow delete: if false'), 'synchronisation non effaçable');

    /* 6. Câblage : les écritures passent par un seul lot, et le dédoublonnage tient compte de la semaine. */
    assert(boite.includes("JSON.stringify(faits) + '|' + boiteSemaineCle(new Date())"), 'nouvelle semaine = nouvelle version');
    assert(boite.includes("envoi.set(synchro, syncDoc, { merge: true })"), 'synchronisation écrite avec la semaine');
    assert(boite.includes("boiteVerifierSemaine(false);"), 'vérification à chaque changement (une fois par semaine)');
    const compte = fs.readFileSync('js/compte.js', 'utf8');
    assert(compte.includes('boiteVerifierSemaine(true)'), 'vérification à la connexion');

    console.log('verifier-semaine-sync : OK');
})().catch(function (err) {
    console.error('verifier-semaine-sync : ÉCHEC', err && err.message);
    process.exit(1);
});
