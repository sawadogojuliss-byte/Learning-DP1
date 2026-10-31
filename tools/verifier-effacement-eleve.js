/* Effacement de la progression par l'élève : ses fiches d'emploi du temps
   sont marquées (effaceParEleve), jamais supprimées, et la vue admin les
   retire. Test avec une fausse base Firestore, sans réseau. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const compte = fs.readFileSync('js/compte.js', 'utf8');
const boite = fs.readFileSync('js/pages/boite.js', 'utf8');
const memoire = fs.readFileSync('js/memoire.js', 'utf8');
const regles = fs.readFileSync('firestore.rules', 'utf8');

/* Extrait une fonction de haut niveau : du mot-clé jusqu'à la fermeture en colonne 0. */
function extraire(source, nom) {
    const debut = source.indexOf('function ' + nom + '(');
    assert(debut !== -1, 'fonction absente : ' + nom);
    const fin = source.indexOf('\n}', debut);
    return source.slice(debut, fin + 2);
}

/* ── Fausse base ────────────────────────────────────────────────────── */
const stock = new Map([
    ['A1', { z_donnees_techniques: { firebaseUid: 'U1', jours: [] } }],
    ['B2', { z_donnees_techniques: { firebaseUid: 'U1', effaceParEleve: true } }],
    ['C3', { z_donnees_techniques: { firebaseUid: 'U2' } }],
    ['D4', { z_donnees_techniques: { firebaseUid: 'U1' } }]
]);
const refuses = new Set(['A1']);
let suppressions = 0;
let ecritures = 0;

function lire(obj, chemin) {
    return chemin.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}
function poser(obj, chemin, valeur) {
    const cles = chemin.split('.');
    let o = obj;
    cles.slice(0, -1).forEach(k => { if (!o[k]) o[k] = {}; o = o[k]; });
    o[cles[cles.length - 1]] = valeur;
}
function copie(v) { return JSON.parse(JSON.stringify(v)); }

function requete(etat) {
    return {
        where(champ, op, val) { return requete(Object.assign({}, etat, { champ, val })); },
        orderBy() { return requete(etat); },
        limit(n) { return requete(Object.assign({}, etat, { limite: n })); },
        startAfter(d) { return requete(Object.assign({}, etat, { apres: d && d.id !== undefined ? d.id : d })); },
        get() {
            let ids = [...stock.keys()].filter(id => lire(stock.get(id), etat.champ) === etat.val).sort();
            if (etat.apres !== undefined) ids = ids.filter(id => id > etat.apres);
            ids = ids.slice(0, etat.limite || 1000);
            const docs = ids.map(id => ({
                id,
                data() { return copie(stock.get(id)); },
                ref: {
                    id,
                    update(patch) {
                        if (refuses.has(id)) return Promise.reject(new Error('refus'));
                        ecritures++;
                        Object.keys(patch).forEach(c => poser(stock.get(id), c, patch[c]));
                        return Promise.resolve();
                    },
                    delete() { suppressions++; return Promise.resolve(); }
                }
            }));
            return Promise.resolve({ empty: docs.length === 0, docs });
        }
    };
}

const firestore = function () { return { collection() { return requete({}); } }; };
firestore.FieldPath = { documentId() { return '__name__'; } };

const firebase = {
    firestore,
    auth() {
        return {
            currentUser: { uid: 'U1' },
            onAuthStateChanged(cb) { cb(this.currentUser); return () => {}; }
        };
    }
};

const context = vm.createContext({
    window: { compteSession: { sub: 'sub-1' } },
    firebase,
    console,
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout: (t) => clearTimeout(t),
    compteChargerFirebase: () => Promise.resolve(firebase),
    Date
});
vm.runInContext(extraire(compte, 'compteMasquerFichesEleve'), context);
vm.runInContext(extraire(compte, 'compteMasquerFiche'), context);
vm.runInContext('var COMPTE_FICHES_MAX = 60;', context);

(async function () {
    /* 1. Le bouton d'effacement marque les fiches de l'élève, sans supprimer. */
    await context.compteMasquerFichesEleve();
    assert.equal(stock.size, 4, 'aucun document ne doit disparaître');
    assert.equal(suppressions, 0, 'aucune suppression');
    assert.equal(lire(stock.get('D4'), 'z_donnees_techniques.effaceParEleve'), true, 'fiche D4 marquée');
    assert.equal(typeof lire(stock.get('D4'), 'z_donnees_techniques.effaceLe'), 'string', 'date d\'effacement');
    assert.equal(lire(stock.get('B2'), 'z_donnees_techniques.effaceParEleve'), true, 'fiche B2 toujours marquée');
    assert.equal(lire(stock.get('C3'), 'z_donnees_techniques.effaceParEleve'), undefined, 'fiche d\'un autre élève intacte');
    /* Une fiche refusée ne bloque pas les suivantes. */
    assert.equal(lire(stock.get('A1'), 'z_donnees_techniques.effaceParEleve'), undefined, 'A1 refusée, non marquée');
    assert.equal(ecritures, 1, 'une seule écriture réussie (D4)');

    /* 2. La vue admin retire les fiches marquées, pas les autres. */
    const ctxBoite = vm.createContext({ BOITE_DOCS_MASQUES: { JN4wP5IN9cIr6wSjiO4q: 1 } });
    vm.runInContext(extraire(boite, 'boiteDocMasque'), ctxBoite);
    assert.equal(ctxBoite.boiteDocMasque('emplois_du_temps', 'B2', stock.get('B2')), true, 'fiche effacée masquée');
    assert.equal(ctxBoite.boiteDocMasque('emplois_du_temps', 'C3', stock.get('C3')), false, 'fiche normale visible');
    assert.equal(ctxBoite.boiteDocMasque('emplois_du_temps', 'JN4wP5IN9cIr6wSjiO4q', {}), true, 'liste de masquage conservée');
    assert.equal(ctxBoite.boiteDocMasque('questions', 'B2', stock.get('B2')), false, 'autres collections non touchées');

    /* 3. Câblage : les deux lectures admin passent les données, l'effacement est appelé avant le rechargement. */
    assert.equal((boite.match(/boiteDocMasque\(nom, doc\.id, doc\.data\(\)\)/g) || []).length, 2, 'les deux lectures admin');
    assert(/var fiches = typeof compteMasquerFichesEleve === 'function'/.test(memoire), 'appel dans l\'effacement');
    assert(/Promise\.all\(\[local\.catch[^\]]*fiches\.catch/.test(memoire), 'attente avant rechargement');
    /* 4. Garde-fous : aucune suppression Firestore dans le masquage, règles inchangées pour la fiche. */
    assert(!extraire(compte, 'compteMasquerFiche').includes('delete'), 'pas de suppression');
    const debutEmplois = regles.indexOf('match /emplois_du_temps/{message}');
    const finEmplois = regles.indexOf('match /receptions_emplois', debutEmplois);
    assert(debutEmplois !== -1 && finEmplois > debutEmplois, 'bloc emplois_du_temps introuvable');
    const debutValide = regles.indexOf('function emploiValide()');
    assert(debutValide !== -1 && debutValide < debutEmplois, 'fonction emploiValide introuvable');
    assert(!/z_donnees_techniques\.keys\(\)/.test(regles.slice(debutValide, finEmplois)), 'emploiValide et le bloc emplois ne ferment pas z_donnees_techniques');

    console.log('verifier-effacement-eleve : OK');
})().catch(function (err) {
    console.error('verifier-effacement-eleve : ÉCHEC', err && err.message);
    process.exit(1);
});
