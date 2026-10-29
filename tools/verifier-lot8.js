#!/usr/bin/env node
/* Régressions : édition des cours, conflits, cache et archive admin. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const root = path.join(__dirname, '..');
const source = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const data = new Map();
const elements = {};
const el = (id) => elements[id] || (elements[id] = { value: '', textContent: '', hidden: true, style: {}, innerHTML: '', focus() { this.focused = true; } });
const ctx = {
    localStorage: { getItem(k) { return data.has(k) ? data.get(k) : null; }, setItem(k, v) { data.set(k, String(v)); }, removeItem(k) { data.delete(k); } },
    document: { getElementById: el },
    console, Date, Math, setTimeout,
    subjects: [], optionalSubjects: [], ibYear: 'DP2',
    generatePlanning() { ctx.plannings++; }, plannings: 0,
    suppressionAvecAnnulation(action) { action.retirer(); action.actualiser(); ctx.suppression = action; },
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(source('js/pages/emploi-temps.js'), ctx);
function formulaire(jour, nom, debut, fin) {
    Object.assign(el('emploiManuelJour'), { value: String(jour) });
    Object.assign(el('emploiManuelNom'), { value: nom });
    Object.assign(el('emploiManuelDebut'), { value: debut });
    Object.assign(el('emploiManuelFin'), { value: fin });
}
formulaire(0, 'Maths', '08:00', '09:00');
ctx.emploiAjouterManuel();
let cours = ctx.emploiScolaireJour(0);
assert.equal(cours.length, 1);
const id = cours[0].id;
assert(el('emploiListe').innerHTML.includes('emploiEditer('), 'crayon dans la liste');
assert(el('emploiListe').innerHTML.includes('emploiSupprimer('), 'suppression par id');
formulaire(0, 'Sciences', '08:30', '09:30');
ctx.emploiAjouterManuel();
assert(el('emploiConflitTexte').textContent.includes('Maths'), 'conflit nommé');
el('emploiConflitAnnuler').onclick();
assert.equal(ctx.emploiScolaireJour(0).length, 1, 'annuler laisse les cours intacts');
ctx.emploiAjouterManuel();
el('emploiConflitGarder').onclick();
cours = ctx.emploiScolaireJour(0);
assert.equal(cours.length, 2, 'garder les deux');
assert(cours.every((c) => c.parallele), 'deux cours volontaires sont parallèles');
const idSciences = cours.find((c) => c.nom === 'Sciences').id;
ctx.emploiEditer(id);
assert.equal(el('emploiManuelNom').value, 'Maths');
assert(el('emploiManuelNom').focused);
assert.equal(el('emploiAjouterBouton').textContent, 'Enregistrer le cours');
formulaire(2, 'Maths AA', '10:00', '11:00');
ctx.emploiAjouterManuel();
assert.equal(ctx.emploiScolaireJour(2)[0].id, id, 'édition garde le même id, y compris après changement de jour');
assert.equal(ctx.emploiScolaireJour(0).length, 1, 'ancien jour corrigé');
assert.equal(el('emploiAjouterBouton').textContent, 'Ajouter le cours');
ctx.emploiSupprimer(id);
assert.equal(ctx.emploiScolaireJour(2).length, 0, 'recherche sur les sept jours');
ctx.suppression.restaurer();
assert.equal(ctx.emploiScolaireJour(2)[0].id, id, 'annulation restaure cours et identité');
ctx.emploiSupprimer(id);
formulaire(0, 'Français', '08:35', '09:15');
ctx.emploiAjouterManuel();
el('emploiConflitRemplacer').onclick();
assert.equal(ctx.emploiScolaireJour(0).length, 1, 'remplacer retire le cours conflictuel');
assert(!ctx.emploiScolaireJour(0).some((c) => c.id === idSciences));
const avant = ctx.plannings;
formulaire(0, '', '10:00', '09:00');
ctx.emploiAjouterManuel();
assert.equal(ctx.plannings, avant, 'formulaire invalide ne régénère rien');
const copie = ctx.emploiScolaireJour(0);
copie[0].nom = 'Altéré';
assert.notEqual(ctx.emploiScolaireJour(0)[0].nom, 'Altéré', 'cache non mutable depuis les appelants');
data.set('studyPlanIB_emploiScolaire', JSON.stringify({ at: '', jours: [[{ id: 'externe', nom: 'Depuis un autre onglet', debut: '09:00', fin: '10:00' }], [], [], [], [], [], []] }));
assert.equal(ctx.emploiScolaireJour(0)[0].id, 'externe', 'cache invalidé après modification dans un autre onglet');
vm.runInContext(source('js/pages/emploi-temps-moteur.js'), ctx);
const trousParallel = ctx.emploiScolaireTrous([
    { debut: '08:00', fin: '11:00' }, { debut: '09:00', fin: '10:00' },
    { debut: '11:30', fin: '12:00' }
], 20);
assert.equal(trousParallel.length, 1, 'pas de temps libre fictif au milieu des cours parallèles');
assert.equal(trousParallel[0].debut, 660, 'le trou commence après le cours le plus long');

const html = source('pages/emploi-temps.html');
for (const field of ['Jour', 'Nom', 'Debut', 'Fin']) assert(html.includes('for="emploiManuel' + field + '"'), 'label ' + field);
assert(html.includes('id="emploiZoneDepot" role="button" tabindex="0"') && html.includes("event.key === 'Enter'"), 'dépôt au clavier');
assert(html.includes('id="emploiAjoutStatut" role="status" aria-live="polite"'));
assert(html.includes('Voir mon planning') && html.includes('Ajouter le cours'));
const moteur = source('js/pages/planning-moteur.js');
assert(moteur.includes("'cours-reel-' + (c.id || i)"), 'ID stable et repli index historique');
assert(!moteur.includes('for (i = 0; i < 7; i++) jours.push(genererJourBrut(i)'), 'calcul paresseux du jour');
assert(!source('js/memoire.js').includes('else if (data.profilComplet) {\n            try { emploiScolaireVider()'), 'profil ancien sans emploi ne le vide pas');
const morceau = moteur.slice(moteur.indexOf('function emploiReconstruire(dayIndex)'), moteur.indexOf('function planningEstReveil('));
const construits = [];
const gel = { emploiGelSuspendu: 0, emploiFige: null, emploiNePasSauver: 0, version: 'A',
    emploiFaitsSignature() { return gel.version; },
    genererJourBrut(i) { construits.push(i); return [{ id: 'jour-' + i }]; },
    emploiCloner(x) { return JSON.parse(JSON.stringify(x)); },
    emploiJourAReparer() { return false; }, Date };
vm.createContext(gel);
vm.runInContext(morceau, gel);
gel.emploiReconstruire(3);
assert.deepEqual(construits, [3], 'un seul jour recalculé');
gel.emploiReconstruire(3);
assert.deepEqual(construits, [3], 'jour mis en cache');
gel.emploiReconstruire(5);
assert.deepEqual(construits, [3, 5], 'autre jour reconstruit sans détruire le premier');
gel.version = 'B';
gel.emploiReconstruire(3);
assert.deepEqual(construits, [3, 5, 3], 'changement de signature reconstruit à la demande');
const balai = moteur.slice(moteur.indexOf('function planningBalayer(events)'), moteur.indexOf('function slotWasRemoved(', moteur.indexOf('function planningBalayer(events)')));
const conflitsMoteur = { planningMinutes(h) { const [a, b] = h.split(':').map(Number); return 60 * a + b; },
    planningInamovible(ev) { return ev.kind === 'fixed' || ev.type === 'school'; },
    planningDuree(ev) { return 60; }, v3M2T(n) { return ('0' + Math.floor(n / 60)).slice(-2) + ':' + ('0' + n % 60).slice(-2); } };
vm.createContext(conflitsMoteur);
vm.runInContext(balai, conflitsMoteur);
const paralleles = [{id: 'cours-reel-a', type: 'school', kind: 'fixed', parallele: true, startTime: '08:00', endTime: '09:00'},
    {id: 'cours-reel-b', type: 'school', kind: 'fixed', parallele: true, startTime: '08:30', endTime: '09:30'}];
assert.equal(conflitsMoteur.planningBalayer(paralleles).length, 2, 'deux cours parallèles survivent au balayage');
assert.equal(conflitsMoteur.planningBalayer(paralleles.map(c => Object.assign({}, c, { parallele: false }))).length, 2,
    'deux cours en conflit restent visibles au lieu d’en supprimer un en secret');

// Pagination Firestore : un compte situé au-delà de la première page doit rester affiché.
const admin = { console, window: {}, localStorage: ctx.localStorage };
vm.createContext(admin);
vm.runInContext(source('js/pages/boite.js'), admin);
const docs = Array.from({length: 825}, (_, i) => ({
    id: 'doc' + i,
    data() { return { type: 'emploi', id: 'e_' + i, at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(), nom: 'Personne ' + i,
        appareil: 'device' + i, jours: [{ j: 'Lundi', s: [{ d: '08:00', f: '09:00', t: 'Maths' }] }] }; }
}));
admin.firebase = { firestore() { return { collection() { return {
    orderBy() { return this; }, startAfter(doc) { this.offset = docs.indexOf(doc) + 1; return this; },
    limit(n) { this.n = n; return this; },
    get() { const tranche = docs.slice(this.offset || 0, (this.offset || 0) + this.n); return Promise.resolve({ docs: tranche, forEach(fn) { tranche.forEach(fn); } }); }
}; } }; } };
admin.boiteMessageDepuisFirestore = (nom, item) => item;
assert.equal(admin.boiteNormaliser('E2E Preparation'), 'e2e preparation', 'les chiffres du nom sont conservés');
assert.equal(admin.boiteNormaliser('DP2'), 'dp2', 'les chiffres de la classe sont conservés');
const ficheE2 = { type: 'emploi', id: 'e_essai', nom: 'E2E Preparation', classe: 'DP2',
    jours: [{ j: 'Lundi', s: [{ d: '08:00', f: '09:00', t: 'Maths' }] }] };
assert(!admin.boiteEmploiRetire(ficheE2), 'une fiche sans retrait par nom reste affichée (fiches de test supprimées)');
assert(!admin.boiteEmploiRetire({ ...ficheE2, nom: 'julia' }), 'un nom « julia » n\'est plus retiré');
assert(!admin.boiteEmploiRetire({ ...ficheE2, nom: 'u' }), 'un nom « u » n\'est plus retiré');
assert.equal(admin.boitePersonnes({ emplois: [ficheE2, { ...ficheE2, id: 'autre', nom: 'Autre élève' }] }).length,
    2, 'la vue administrateur présente chaque fiche sans filtre par nom');
assert.equal(admin.boiteFusionnerPersonnes([ficheE2, { ...ficheE2, id: 'e3', nom: 'E3E Preparation' }]).length,
    2, 'E2E et E3E restent deux personnes distinctes');
// Même parcours que le panneau admin, y compris la lecture d'un document
// Firestore au format lisible et le rendu du HTML de la capture signalée.
const elementsAdmin = {
    emploisListe: { innerHTML: '' }, emploisStatut: { textContent: '' }, emploisFiltre: { value: '' }
};
admin.document = { getElementById(id) { return elementsAdmin[id] || null; } };
const ficheFirestore = { type: 'emploi', id: 'e_e2', at: '2026-10-24T08:00:00Z',
    '01_nom_utilisateur': 'E2E Preparation', '02_matieres': ['Mathématiques AA HL'],
    '03_emploi_du_temps': { '01_Lundi': ['07h50 – 12h30  ·  Cours'] },
    z_donnees_techniques: { classe: 'DP2', jours: ficheE2.jours } };
const voisin = { ...ficheE2, id: 'e_e3', nom: 'E3E Preparation' };
const fusionAdmin = admin.boiteFusionner([ficheFirestore, voisin]);
admin.boiteRendreEmplois(fusionAdmin);
assert(elementsAdmin.emploisListe.innerHTML.includes('E2E Preparation'), 'la fiche sans adresse reste affichée dans le HTML');
assert(elementsAdmin.emploisListe.innerHTML.includes('E3E Preparation'), 'le compte voisin doit rester visible');
assert.equal(elementsAdmin.emploisStatut.textContent, '2 personnes · 2 plannings reçus', 'le compteur admin compte chaque fiche');
(async () => {
    const records = await admin.boiteLireCollectionHistorique('emplois_du_temps');
    assert.equal(records.length, 825, 'pagination au-delà des 1200 entrées');
    admin.boiteAjouterBruts(records);
    const fusion = admin.boiteFusionner(records);
    assert.equal(fusion.emplois.length, 825, 'plus de coupure à 300 personnes');
    assert(fusion.emplois.some((e) => e.nom === 'Personne 824'), 'ancien compte visible');
    assert.equal(admin.boiteFusionnerPersonnes([
        { nom: 'Camille', googleSub: 'sub1', email: 'a@example.org', jours: [] },
        { nom: 'Camille', googleSub: 'sub2', email: 'b@example.org', jours: [] }
    ]).length, 2, 'deux comptes homonymes ne sont pas fusionnés');
    console.log('ok lot 8 : édition, conflits, IDs, cache, clavier et archive admin paginée');
})().catch((err) => { console.error(err); process.exitCode = 1; });
