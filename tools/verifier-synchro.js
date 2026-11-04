/* Lot 9 — synchronisation : les suppressions ne reviennent pas, la modification
   la plus récente gagne, les devoirs et les cours ajoutés ailleurs ne disparaissent
   pas, les réglages du minuteur suivent l'élève, les anciennes sauvegardes restent lisibles.

   Chaque appareil est un contexte vm séparé avec son propre localStorage, et
   le vrai code des fichiers est chargé. Une horloge contrôlée rend les dates
   déterministes. Le nuage est simulé par les sauvegardes échangées. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const lire = (f) => fs.readFileSync(f, 'utf8');

/* ── 1. Vérifications statiques : les points d'entrée sont branchés ── */
const registre = lire('js/registre.js');
const sw = lire('service-worker.js');
const memoire = lire('js/memoire.js');
const compte = lire('js/compte.js');
const devoirs = lire('js/pages/devoirs.js');
const emploi = lire('js/pages/emploi-temps.js');
const boite = lire('js/pages/boite.js');
assert(registre.indexOf("'js/synchro.js'") !== -1 && registre.indexOf("'js/synchro.js'") < registre.indexOf("'js/memoire.js'"), 'synchro.js doit être chargé avant memoire.js');
assert(sw.indexOf('"js/synchro.js"') !== -1, 'synchro.js absent du cache hors ligne');
assert(!/selectedDay:\s*selectedDay/.test(memoire), 'SY-03 : selectedDay est encore écrit dans le profil');
assert(memoire.includes('suppressions: typeof syncLireRegistre') && memoire.includes('focusReglages: typeof syncFocusCourant'), 'profil : registre ou réglages du minuteur absents');
assert(memoire.includes('if (typeof syncPreparer === \'function\') syncPreparer();\n    if (typeof eeNettoyerSuivi'), 'la sauvegarde doit dater ce qui a changé');
assert(memoire.includes('function memoireAppliquerCorps('), 'application d’une sauvegarde : encadrement absent');
assert(!compte.includes("compteFusionnerObjets(base.devoirsStore") && compte.includes("syncFusionnerStore(base.devoirsStore"), 'DE-25 : devoirs encore écrasés à la fusion');
assert(compte.includes("syncFusionnerEmploi(base.emploiScolaire"), 'ET-16 : emploi du temps encore écrasé à la fusion');
assert(devoirs.includes("syncEstampiller('devoirs'") && devoirs.includes('opts.brut'), 'devoirs : écriture non datée');
assert(emploi.includes("syncEstampiller('cours'") && emploi.includes("opts.brut"), 'emploi : écriture non datée');
assert(boite.includes('syncDebutApplication()') && boite.includes('syncFinApplication()'), 'boîte : simulation non encadrée');
assert(!fs.existsSync('js/pages/pomodoro.js'));

/* ── 2. Appareils simulés ───────────────────────────────────────────── */
const clock = { t: Date.UTC(2026, 9, 29, 8, 0, 0) };
class HorlogeFictive extends Date {
    constructor(...a) { if (a.length) super(...a); else super(clock.t); }
    static now() { return clock.t; }
}
const JOUR = 24 * 60 * 60 * 1000;
const sources = {
    synchro: lire('js/synchro.js'),
    compte: lire('js/compte.js').slice(lire('js/compte.js').indexOf('function compteUtile('), lire('js/compte.js').indexOf('function compteCleArchive(')),
    devoirs: lire('js/pages/devoirs.js').slice(lire('js/pages/devoirs.js').indexOf('var DEVOIRS_CLE'), lire('js/pages/devoirs.js').indexOf('function devoirsId(')),
    emploi: lire('js/pages/emploi-temps.js').slice(lire('js/pages/emploi-temps.js').indexOf('var EMPLOI_CLE'), lire('js/pages/emploi-temps.js').indexOf('function emploiId(')),
};
assert(sources.compte.includes('function compteFusionnerProfils(') && sources.devoirs.includes('function devoirsStoreCompact(') && sources.emploi.includes('function emploiScolaireVider('), 'extraits introuvables');

function appareil(nom) {
    const stock = new Map();
    const ls = {
        getItem: (k) => (stock.has(k) ? stock.get(k) : null),
        setItem: (k, v) => stock.set(k, String(v)),
        removeItem: (k) => stock.delete(k),
        key: (i) => Array.from(stock.keys())[i] || null,
        get length() { return stock.size; }
    };
    const ctx = { localStorage: ls, Date: HorlogeFictive, JSON, Math, Number, String, Object, Array, Set, parseInt, isFinite, console, Promise };
    ctx.window = ctx;
    ctx.customEvents = [];
    ctx.exercices = [];
    ctx.memoirPlan = [];
    vm.createContext(ctx);
    vm.runInContext(sources.synchro + '\n' + sources.compte + '\n' + sources.devoirs + '\n' + sources.emploi, ctx);
    return { nom, ctx, stock };
}
/* Les valeurs sortent du contexte en JSON : les tableaux d'un autre contexte ne sont pas comparables. */
const run = (d, code) => {
    const v = vm.runInContext(code, d.ctx);
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
};

/* Sauvegarde d'un appareil : ce que memoireLireEtat enverrait au nuage. */
function sauvegarder(d) {
    return run(d, `(function () {
        syncPreparer();
        return {
            v: 1, userName: 'Élève', profilComplet: true, etape: 'planning',
            savedAt: new Date().toISOString(),
            customEvents: customEvents, exercices: exercices, memoirPlan: memoirPlan,
            suppressions: syncLireRegistre(),
            devoirsStore: devoirsStoreCompact(),
            emploiScolaire: emploiScolaireCompact(),
            focusReglages: syncFocusCourant()
        };
    })()`);
}
const copie = (x) => JSON.parse(JSON.stringify(x));

/* Application d'une sauvegarde fusionnée : même séquence que memoireAppliquerCorps. */
function appliquer(d, data) {
    run(d, `(function (data) {
        syncDebutApplication();
        try {
            var reg = syncIntegrerRegistre(data.suppressions);
            customEvents = syncFiltrer(data.customEvents, 'customEvents', reg);
            exercices = syncFiltrer(data.exercices, 'exercices', reg);
            memoirPlan = syncFiltrer(data.memoirPlan, 'memoirPlan', reg);
            if (data.emploiScolaire) {
                emploiScolaireEcrire(syncFusionnerEmploi(emploiScolaireLire(), data.emploiScolaire, reg), { brut: true });
                syncRecaler('cours', syncAplatirCours(emploiScolaireLire()));
            }
            if (data.devoirsStore) {
                var f = syncFusionnerStore(devoirsLireStore(), data.devoirsStore, reg);
                devoirsEcrireStore({ bac: f.bac, bacDemande: f.bacDemande, devoirs: f.devoirs, examens: f.examens }, { brut: true });
                syncRecaler('devoirs', f.devoirs);
                syncRecaler('examens', f.examens);
            }
            if (data.focusReglages) syncFocusAppliquer(data.focusReglages);
        } finally { syncFinApplication(); }
    })(${JSON.stringify(data)})`);
}
/* Synchronisation complète : chaque appareil envoie, le nuage fusionne, chacun applique. */
function synchroniser(...appareils) {
    const copies = appareils.map(sauvegarder);
    const fusion = {};
    appareils.forEach((d, i) => {
        const ordre = [copies[i]].concat(copies.filter((_, j) => j !== i));
        fusion[d.nom] = run(d, `compteFusionnerProfils(${JSON.stringify(ordre)})`);
    });
    appareils.forEach((d) => appliquer(d, copie(fusion[d.nom])));
    return fusion;
}
const ids = (liste) => liste.map((x) => x.id).sort();

/* ── 3. Scénarios ───────────────────────────────────────────────────── */

/* S1 — SY-01 : un exercice supprimé sur un appareil ne revient pas. */
{
    const A = appareil('A'), B = appareil('B');
    run(A, `exercices = [{ id: 'e1', done: false, titre: 'Maths' }, { id: 'e2', done: false, titre: 'Physique' }]; syncPreparer();`);
    synchroniser(A, B);
    assert.deepStrictEqual(ids(run(B, 'exercices')), ['e1', 'e2']);
    clock.t += 1000;
    run(A, `exercices = exercices.filter(function (e) { return e.id !== 'e2'; });`);
    synchroniser(A, B);
    synchroniser(B, A);
    assert.deepStrictEqual(ids(run(A, 'exercices')), ['e1'], 'S1 : e2 revenu sur A');
    assert.deepStrictEqual(ids(run(B, 'exercices')), ['e1'], 'S1 : e2 revenu sur B');
    /* Un appareil resté hors ligne avec l'ancienne copie ne le fait pas revenir non plus. */
    const C = appareil('C');
    run(C, `exercices = [{ id: 'e1', done: false, titre: 'Maths' }, { id: 'e2', done: false, titre: 'Physique' }];`);
    synchroniser(A, C);
    assert.deepStrictEqual(ids(run(C, 'exercices')), ['e1'], 'S1 : e2 revenu après une copie hors ligne');
}

/* S2 — SY-02 : la modification la plus récente gagne, dans les deux sens. */
{
    const A = appareil('A'), B = appareil('B');
    run(A, `exercices = [{ id: 'e1', done: false, titre: 'Ancien', modifieAt: 0 }];`);
    synchroniser(A, B);
    clock.t += 1000;
    run(A, `exercices[0].titre = 'Corrigé sur téléphone'; syncPreparer();`);
    clock.t += 1000;
    run(B, `exercices[0].done = true; syncPreparer();`);
    const f1 = copie(run(A, `compteFusionnerProfils(${JSON.stringify([sauvegarder(A), sauvegarder(B)])})`));
    const f2 = copie(run(A, `compteFusionnerProfils(${JSON.stringify([sauvegarder(B), sauvegarder(A)])})`));
    assert.strictEqual(f1.exercices[0].done, true, 'S2 : la version la plus récente (B) doit gagner');
    assert.deepStrictEqual(f1.exercices, f2.exercices, 'S2 : le résultat doit être le même quel que soit l’ordre');
    synchroniser(A, B);
    assert.strictEqual(run(A, 'exercices[0].done'), true, 'S2 : A n’a pas reçu la version la plus récente');
    assert.strictEqual(run(B, 'exercices[0].titre'), 'Corrigé sur téléphone', 'S2 : titre ignoré');
    /* Un objet modifié à l'identique n'est pas redaté. */
    const avant = run(A, 'exercices[0].modifieAt');
    clock.t += 5000;
    run(A, 'syncPreparer();');
    assert.strictEqual(run(A, 'exercices[0].modifieAt'), avant, 'S2 : redatage sans modification');
}

/* S3 — DE-25 : un devoir ajouté hors ligne sur un appareil n'est pas perdu. */
{
    const A = appareil('A'), B = appareil('B');
    run(B, `devoirsEcrireStore({ bac: null, bacDemande: 0, devoirs: [{ id: 'd0', matiere: 'Histoire', date: '2026-11-02' }], examens: [] });`);
    synchroniser(A, B);
    clock.t += 1000;
    run(A, `devoirsEcrireStore({ bac: null, bacDemande: 0, devoirs: [{ id: 'd0', matiere: 'Histoire', date: '2026-11-02' }, { id: 'd1', matiere: 'Biologie', date: '2026-11-05' }], examens: [] });`);
    clock.t += 1000;
    run(B, `var s = devoirsLireStore(); s.devoirs[0].matiere = 'Histoire-géo'; devoirsEcrireStore(s);`);
    synchroniser(B, A);
    const d = run(B, 'devoirsLireStore().devoirs.map(function (x) { return x.id + ":" + x.matiere; }).sort()');
    assert.deepStrictEqual(d, ['d0:Histoire-géo', 'd1:Biologie'], 'DE-25 : devoir ajouté sur A perdu, ou modification de B perdue');
}

/* S4 — DE-25 : un devoir supprimé ne revient pas, mais l'annulation immédiate le garde. */
{
    const A = appareil('A'), B = appareil('B');
    run(A, `devoirsEcrireStore({ bac: null, bacDemande: 0, devoirs: [{ id: 'd1', matiere: 'Maths', date: '2026-11-02' }], examens: [] });`);
    synchroniser(A, B);
    clock.t += 1000;
    run(A, `var s = devoirsLireStore(); var objet = s.devoirs[0]; s.devoirs = []; devoirsEcrireStore(s); /* suppression */ s.devoirs = [objet]; devoirsEcrireStore(s); /* annulation dans les 8 s */`);
    synchroniser(A, B);
    assert.deepStrictEqual(run(B, 'devoirsLireStore().devoirs.map(function (x) { return x.id; })'), ['d1'], 'S4 : annulation dans la fenêtre, le devoir doit rester');
    clock.t += 1000;
    run(A, `devoirsEcrireStore({ bac: null, bacDemande: 0, devoirs: [], examens: [] });`);
    synchroniser(A, B);
    synchroniser(B, A);
    assert.deepStrictEqual(run(A, 'devoirsLireStore().devoirs'), [], 'S4 : devoir supprimé revenu sur A');
    assert.deepStrictEqual(run(B, 'devoirsLireStore().devoirs'), [], 'S4 : devoir supprimé revenu sur B');
}

/* S5 — ET-16 : un cours ajouté sur un appareil ne remplace pas ceux de l'autre. */
{
    const A = appareil('A'), B = appareil('B');
    run(B, `emploiScolaireEcrire({ at: '', jours: [[{ id: 'c0', nom: 'Maths', matiere: 'Maths', debut: '08:00', fin: '09:00' }], [], [], [], [], [], []] });`);
    synchroniser(A, B);
    clock.t += 1000;
    run(A, `emploiScolaireEcrire({ at: '', jours: [[{ id: 'c0', nom: 'Maths', matiere: 'Maths', debut: '08:00', fin: '09:00' }, { id: 'c1', nom: 'Chimie', matiere: 'Chimie', debut: '10:00', fin: '11:00' }], [], [], [], [], [], []] });`);
    synchroniser(B, A);
    const cours = run(B, 'syncAplatirCours(emploiScolaireLire()).map(function (c) { return c.id; }).sort()');
    assert.deepStrictEqual(cours, ['c0', 'c1'], 'ET-16 : le cours ajouté sur A a disparu');
    /* Un cours retiré sur un appareil disparaît partout. */
    clock.t += 1000;
    run(B, `emploiScolaireEcrire({ at: '', jours: [[{ id: 'c1', nom: 'Chimie', matiere: 'Chimie', debut: '10:00', fin: '11:00' }], [], [], [], [], [], []] });`);
    synchroniser(B, A);
    assert.deepStrictEqual(run(A, 'syncAplatirCours(emploiScolaireLire()).map(function (c) { return c.id; })'), ['c1'], 'ET-16 : cours retiré revenu');
}

/* S6 — Annulation d'une suppression de devoir (undo) : l'objet restauré survit à sa pierre tombale. */
{
    const A = appareil('A'), B = appareil('B');
    run(A, `devoirsEcrireStore({ bac: null, bacDemande: 0, devoirs: [{ id: 'd9', matiere: 'Anglais', date: '2026-11-03' }], examens: [] });`);
    synchroniser(A, B);
    clock.t += 1000;
    run(A, `var s = devoirsLireStore(); var objet = s.devoirs[0]; s.devoirs = []; devoirsEcrireStore(s); sauvegarder_tmp = objet;`);
    sauvegarder(A);
    clock.t += 1000;
    run(A, `var s2 = devoirsLireStore(); s2.devoirs = [sauvegarder_tmp]; devoirsEcrireStore(s2);`);
    synchroniser(A, B);
    assert.deepStrictEqual(run(B, 'devoirsLireStore().devoirs.map(function (x) { return x.id; })'), ['d9'], 'S6 : annulation perdue après synchronisation');
}

/* S7 — Réglages du minuteur : suivent l'élève, la version la plus récente gagne. */
{
    const A = appareil('A'), B = appareil('B');
    run(B, `localStorage.setItem('studyPlanIB_focusDurees', JSON.stringify({ focus: 25, short: 5, long: 15 })); syncFocusCourant();`);
    synchroniser(A, B);
    clock.t += 1000;
    run(A, `localStorage.setItem('studyPlanIB_focusDurees', JSON.stringify({ focus: 40, short: 10, long: 20 })); localStorage.setItem('studyPlanIB_focusFond', '3'); syncFocusCourant();`);
    synchroniser(A, B);
    assert.deepStrictEqual(run(B, "JSON.parse(localStorage.getItem('studyPlanIB_focusDurees'))"), { focus: 40, short: 10, long: 20 }, 'S7 : durées non reçues');
    assert.strictEqual(run(B, "localStorage.getItem('studyPlanIB_focusFond')"), '3', 'S7 : fond non reçu');
    assert.strictEqual(run(A, "localStorage.getItem('studyPlanIB_focusReglages') !== null"), true);
}

/* S8 — Sauvegarde ancienne (sans registre, sans dates, avec selectedDay) : lisible et fusionnée. */
{
    const B = appareil('B');
    run(B, `exercices = [{ id: 'e1', done: false, titre: 'Local' }];`);
    const ancienne = { userName: 'Élève', profilComplet: true, etape: 'planning', savedAt: '2026-10-20T10:00:00.000Z', selectedDay: 3,
        exercices: [{ id: 'e1', done: true, titre: 'Ancien nuage' }, { id: 'e7', done: false, titre: 'Ancien seul' }], customEvents: [] };
    const fusion = copie(run(B, `compteFusionnerProfils(${JSON.stringify([ancienne, sauvegarder(B)])})`));
    assert.deepStrictEqual(fusion.exercices.map((e) => e.id).sort(), ['e1', 'e7'], 'S8 : ancienne sauvegarde mal fusionnée');
    assert(fusion.suppressions && typeof fusion.suppressions === 'object', 'S8 : registre absent du profil fusionné');
    appliquer(B, fusion);
    assert.strictEqual(run(B, 'exercices.length'), 2);
}

/* S9 — Application d'une sauvegarde : rien n'est daté ni supprimé pendant l'opération. */
{
    const A = appareil('A');
    run(A, `exercices = [{ id: 'e1', done: false, titre: 'Maths' }]; syncPreparer();`);
    clock.t += 10000;
    appliquer(A, { exercices: [{ id: 'e1', done: false, titre: 'Maths', modifieAt: 42 }, { id: 'e5', done: false, titre: 'Reçu', modifieAt: 43 }], suppressions: {} });
    assert.strictEqual(run(A, 'exercices.find(function (e) { return e.id === "e1"; }).modifieAt'), 42, 'S9 : la date reçue a été écrasée');
    assert.strictEqual(run(A, 'exercices.find(function (e) { return e.id === "e5"; }).modifieAt'), 43, 'S9 : un objet reçu a été redaté');
    assert.deepStrictEqual(run(A, 'syncLireRegistre().exercices || {}'), {}, 'S9 : une suppression fantôme a été notée');
}

/* S10 — Effacer la progression de cet appareil ne crée pas de suppression propagée. */
{
    const A = appareil('A');
    run(A, `exercices = [{ id: 'e1', done: false }]; customEvents = [{ id: 'ev1', titre: 'Cours' }]; syncPreparer();`);
    run(A, `syncPreparer(); syncRemettreAZero(); exercices = []; customEvents = []; syncPreparer();`);
    assert.deepStrictEqual(run(A, 'syncLireRegistre()'), {}, 'S10 : le vidage a été noté comme suppression');
}

/* S11 — Purge : une pierre tombale a une durée de vie de 60 jours. */
{
    const A = appareil('A');
    run(A, `exercices = [{ id: 'e1', done: false }]; syncPreparer(); exercices = []; syncPreparer();`);
    assert.deepStrictEqual(Object.keys(run(A, 'syncLireRegistre().exercices || {}')), ['e1']);
    clock.t += 61 * JOUR;
    assert.deepStrictEqual(Object.keys(run(A, 'syncLireRegistre().exercices || {}')), [], 'S11 : pierre tombale non purgée après 60 jours');
}

/* S12 — Plafond : le registre garde au plus 2000 suppressions par liste. */
{
    const A = appareil('A');
    run(A, `var reg = {}; reg.exercices = {}; for (var i = 0; i < 2100; i++) reg.exercices['x' + i] = Date.now() - i; syncEcrireRegistre(reg);`);
    const n = run(A, 'Object.keys(syncLireRegistre().exercices).length');
    assert(n <= 2000, 'S12 : plus de 2000 pierres tombales : ' + n);
}

/* S13 — Ordre des fusions : un profil fusionné ne dépend pas de l'ordre des copies, et la fusion est stable. */
{
    const A = appareil('A'), B = appareil('B');
    run(A, `exercices = [{ id: 'e1', done: false, titre: 'x' }, { id: 'e2', done: false, titre: 'y' }]; syncPreparer();`);
    synchroniser(A, B);
    clock.t += 1000;
    run(B, `exercices = exercices.filter(function (e) { return e.id !== 'e1'; }); syncPreparer();`);
    clock.t += 1000;
    run(A, `exercices.push({ id: 'e3', done: false, titre: 'z' }); syncPreparer();`);
    const a = copie(run(A, `compteFusionnerProfils(${JSON.stringify([sauvegarder(A), sauvegarder(B)])})`)).exercices.map((e) => e.id).sort();
    const b = copie(run(B, `compteFusionnerProfils(${JSON.stringify([sauvegarder(B), sauvegarder(A)])})`)).exercices.map((e) => e.id).sort();
    assert.deepStrictEqual(a, ['e2', 'e3']);
    assert.deepStrictEqual(a, b, 'S13 : résultat différent selon l’ordre des copies');
}

console.log('ok synchro : suppressions, modification la plus récente, devoirs, emploi du temps, minuteur, anciennes sauvegardes, application, purge, plafond');
