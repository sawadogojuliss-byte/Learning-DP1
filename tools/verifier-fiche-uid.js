/* Fiche d'emploi par élève : identifiant = UID (comme comptes/{uid} et
   synchronisation/{uid}), accusé à identifiant aléatoire, trace de suppression
   par semaine, élève sans compte inchangé. Tout est simulé en mémoire : rien
   n'est écrit dans Firestore. Les règles sont reproduites ici en version simple ;
   le fichier firestore.rules reste la référence. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/pages/boite.js', 'utf8');
const donnees = {};
const base = {};            // 'nom/id' -> document
let utilisateur = null;
let auto = 0;
let heure = Date.parse('2026-10-26T09:00:00.000Z');  // lundi 26 oct. 2026
let refus = 0;

class Horloge extends Date {
    constructor(...args) { super(...(args.length ? args : [heure])); }
    static now() { return heure; }
}
const storage = {
    getItem(cle) { return Object.hasOwn(donnees, cle) ? donnees[cle] : null; },
    setItem(cle, value) { donnees[cle] = String(value); },
    removeItem(cle) { delete donnees[cle]; }
};
const copie = (v) => JSON.parse(JSON.stringify(v));

/* Règles simplifiées : retourne true si l'ensemble d'écritures est accepté. */
function accepte(ecritures) {
    const attendu = {};
    const existe = (chemin) => (chemin in attendu) ? attendu[chemin] !== null : (chemin in base);
    const lire = (chemin) => (chemin in attendu) ? attendu[chemin] : base[chemin];
    for (const op of ecritures) {
        const chemin = op.nom + '/' + op.id;
        if (op.type === 'delete') {
            if (!utilisateur || !utilisateur.admin) return false;
            attendu[chemin] = null;
            continue;
        }
        if (op.nom === 'emplois_du_temps') {
            const creation = !existe(chemin);
            const z = op.data.z_donnees_techniques;
            if (utilisateur) {
                if (op.id !== utilisateur.uid) return false;
                if (creation && existe('suppressions_emplois/' + op.id + '_' + z.semaine)) return false;
                if (!creation && lire(chemin).z_donnees_techniques.firebaseUid !== utilisateur.uid) return false;
            } else {
                if (!creation || z.firebaseUid !== '') return false;
                if (existe('suppressions_emplois/' + op.id)) return false;
            }
            attendu[chemin] = copie(op.data);
        } else if (op.nom === 'synchronisation') {
            if (!utilisateur || op.id !== utilisateur.uid) return false;
            attendu[chemin] = Object.assign({}, lire(chemin) || {}, copie(op.data));
        } else if (op.nom === 'receptions_emplois') {
            if (existe(chemin)) return false;
            const fiche = utilisateur ? 'emplois_du_temps/' + utilisateur.uid : 'emplois_du_temps/' + op.id;
            const doc = lire(fiche);
            if (!doc) return false;
            if (utilisateur && doc.z_donnees_techniques.accuse !== op.id) return false;
            attendu[chemin] = copie(op.data);
        } else if (op.nom === 'suppressions_emplois') {
            if (!utilisateur || !utilisateur.admin) return false;
            attendu[chemin] = copie(op.data);
        } else {
            return false;
        }
    }
    for (const chemin of Object.keys(attendu)) {
        if (attendu[chemin] === null) delete base[chemin];
        else base[chemin] = attendu[chemin];
    }
    return true;
}

function document(nom, id) {
    return {
        nom, id,
        get() {
            const chemin = nom + '/' + id;
            return Promise.resolve(chemin in base
                ? { exists: true, data: () => copie(base[chemin]) }
                : { exists: false, data: () => undefined });
        },
        set(data) {
            if (!accepte([{ type: 'set', nom, id, data }])) { refus++; return Promise.reject({ code: 'permission-denied' }); }
            return Promise.resolve();
        }
    };
}

const firebase = {
    auth() { return { currentUser: utilisateur, onAuthStateChanged(fn) { fn(utilisateur); } }; },
    firestore() {
        return {
            batch() {
                const ecritures = [];
                return {
                    set(ref, data, options) { ecritures.push({ type: 'set', nom: ref.nom, id: ref.id, data, merge: !!(options && options.merge) }); },
                    delete(ref) { ecritures.push({ type: 'delete', nom: ref.nom, id: ref.id }); },
                    commit() {
                        if (!accepte(ecritures)) { refus++; return Promise.reject({ code: 'permission-denied' }); }
                        return Promise.resolve();
                    }
                };
            },
            collection(nom) {
                return {
                    doc(id) { return document(nom, id || ('auto' + (++auto))); },
                    add(data) {
                        const id = 'auto' + (++auto);
                        if (!accepte([{ type: 'set', nom, id, data }])) return Promise.reject({ code: 'permission-denied' });
                        return Promise.resolve({ id });
                    }
                };
            }
        };
    }
};
firebase.firestore.FieldValue = { serverTimestamp: () => 'horodatage' };

const context = {
    console: { log() {}, warn() {}, error() {} },
    Promise, Date: Horloge, JSON, Math, Object, Array, String, Number, Uint8Array, crypto: globalThis.crypto,
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; },
    localStorage: storage, firebase,
    compteChargerFirebase() { return Promise.resolve(firebase); },
    document: { getElementById() { return null; }, addEventListener() {} },
    location: { reload() {} }, alert() {}
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context);
context.boiteEstAdmin = () => !!(utilisateur && utilisateur.admin);
context.userName = 'Camille';

const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
function fiche(at, titre) {
    return { type: 'emploi', id: 'e_a', appareil: 'a', at, nom: 'Camille', classe: 'DP1',
        jours: jours.map((j, i) => ({ j, s: i === 0 ? [{ d: '08:00', f: '09:00', t: titre }] : [] })),
        schema: 2, complet: 1, google: '', googleSub: '', email: '', matieres: ['Mathématiques'] };
}
const UID = 'UIDELEVE0000000000000000001';
const SUB = 'sub-eleve';

(async () => {
    /* 1. Élève connecté, première semaine : fiche = UID, accusé aléatoire. */
    utilisateur = { uid: UID, email: 'eleve@example.org', providerData: [{ providerId: 'google.com', uid: SUB }] };
    const accuse1 = await context.boiteEcrireBoite(fiche('2026-10-26T08:00:00.000Z', 'Maths'));
    const doc1 = base['emplois_du_temps/' + UID];
    assert.ok(doc1, 'la fiche n’est pas créée sous l’UID');
    assert.equal(doc1.z_donnees_techniques.semaine, '2026-10-26', 'semaine absente de la fiche');
    assert.equal(doc1.z_donnees_techniques.accuse, accuse1, 'la fiche ne porte pas l’accusé');
    assert.match(accuse1, /^[0-9a-f]{40}$/, 'l’accusé doit être aléatoire (40 caractères)');
    assert.notEqual(accuse1, UID, 'l’accusé ne doit jamais être l’UID');
    assert.equal(base['receptions_emplois/' + accuse1].recu, true, 'accusé non créé');
    assert.equal(base['synchronisation/' + UID].emploi, UID, 'synchronisation ne pointe pas la fiche UID');
    assert.equal(base['synchronisation/' + UID].semaine, '2026-10-26');
    assert.equal(Object.keys(base).filter((c) => c.startsWith('emplois_du_temps/')).length, 1, 'plusieurs fiches pour un élève');
    console.log('fiche créée sous l’UID, accusé aléatoire, synchronisation OK');

    /* 2. Semaine suivante, même élève : la fiche est remplacée, pas recréée. */
    heure = Date.parse('2026-11-02T09:00:00.000Z');
    const accuse2 = await context.boiteEcrireBoite(fiche('2026-11-02T08:00:00.000Z', 'Physique'));
    assert.equal(accuse2, accuse1, 'la semaine suivante ne doit pas créer un nouvel accusé');
    assert.equal(base['emplois_du_temps/' + UID].z_donnees_techniques.semaine, '2026-11-02', 'la fiche n’est pas remplacée');
    assert.equal(Object.keys(base).filter((c) => c.startsWith('receptions_emplois/')).length, 1, 'accusé dupliqué');
    console.log('semaine suivante : même fiche, mise à jour');

    /* 3. L'administration supprime cette semaine. */
    utilisateur.admin = true;
    context.boiteSupprimerEmploi(['emplois_du_temps/' + UID + '#2026-11-02']);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(base['emplois_du_temps/' + UID], undefined, 'la fiche supprimée reste dans la base');
    assert.ok(base['suppressions_emplois/' + UID + '_2026-11-02'], 'trace par semaine absente');
    assert.equal(base['suppressions_emplois/' + UID], undefined, 'trace non limitée à la semaine');
    console.log('suppression admin : fiche retirée, trace de la semaine écrite');

    /* 4. Même semaine : l'élève ne la recrée pas, et l'écriture ne signale pas d'erreur. */
    utilisateur.admin = false;
    const refusesAvant = refus;
    const accuse4 = await context.boiteEcrireBoite(fiche('2026-11-02T10:00:00.000Z', 'Physique bis'));
    assert.equal(base['emplois_du_temps/' + UID], undefined, 'la semaine supprimée a été recréée');
    assert.ok(refus > refusesAvant, 'l’écriture aurait dû être refusée par la trace');
    assert.ok(accuse4, 'la reprise ne rend rien');
    console.log('même semaine après suppression : rien recréé');

    /* 5. Semaine suivante : une nouvelle fiche est permise. */
    heure = Date.parse('2026-11-09T09:00:00.000Z');
    const accuse5 = await context.boiteEcrireBoite(fiche('2026-11-09T08:00:00.000Z', 'Chimie'));
    assert.equal(base['emplois_du_temps/' + UID].z_donnees_techniques.semaine, '2026-11-09', 'nouvelle semaine refusée');
    assert.notEqual(accuse5, accuse1, 'nouvelle fiche sans nouvel accusé');
    assert.equal(base['receptions_emplois/' + accuse5].recu, true, 'accusé de la nouvelle fiche absent');
    console.log('semaine suivante après suppression : nouvelle fiche créée');

    /* 6. Élève sans compte Google : identifiant aléatoire, comme avant. */
    utilisateur = null;
    const sansCompte = await context.boiteEcrireBoite(fiche('2026-11-09T11:00:00.000Z', 'Anglais'));
    assert.ok(base['emplois_du_temps/' + sansCompte], 'fiche sans compte non créée');
    assert.equal(base['receptions_emplois/' + sansCompte].recu, true, 'accusé sans compte non créé');
    assert.equal(base['emplois_du_temps/' + sansCompte].z_donnees_techniques.firebaseUid, '');
    assert.notEqual(sansCompte, UID, 'un élève sans compte ne doit pas recevoir l’UID');
    console.log('élève sans compte : identifiant aléatoire conservé');

    /* 7. Aucune fiche d'élève connecté ne porte un identifiant calculé. */
    const fichesConnectees = Object.keys(base).filter((c) => c.startsWith('emplois_du_temps/') && base[c].z_donnees_techniques.firebaseUid);
    assert.ok(fichesConnectees.every((c) => c === 'emplois_du_temps/' + UID), 'identifiant hors UID pour un compte connecté');
    console.log('OK : fiche par UID, accusé aléatoire, trace par semaine, sans compte inchangé');
})().catch((err) => {
    console.error('verifier-fiche-uid : ÉCHEC', err && err.message ? err.message : err);
    process.exitCode = 1;
});
