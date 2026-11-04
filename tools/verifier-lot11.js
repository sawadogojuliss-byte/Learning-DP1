/* Lot 11 — Finitions de la page Devoirs (DE-08 à DE-13, DE-17, DE-18, DE-20, DE-23, DE-24, DE-26).
   Comportement : moteur et enregistrement des séances, dans un vrai contexte vm.
   Interface : vérifications sur le code, comme les autres tests du dépôt. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const racine = path.join(__dirname, '..');
const lire = f => fs.readFileSync(path.join(racine, f), 'utf8');
const devoirsSrc = lire('js/pages/devoirs.js');
const moteurSrc = lire('js/pages/devoirs-moteur.js');
const html = lire('pages/devoirs.html');

/* ── Contexte d'exécution ───────────────────────────────────────────── */
const data = {};
const context = vm.createContext({
    console, Date, Promise, setTimeout: () => {},
    window: {}, document: { getElementById: () => null, activeElement: null },
    localStorage: {
        getItem: k => (k in data ? data[k] : null),
        setItem(k, v) { data[k] = String(v); },
        removeItem(k) { delete data[k]; },
        key: i => Object.keys(data)[i] || null,
        get length() { return Object.keys(data).length; }
    },
    planningDepuisProgression: () => {},
    renderPlanning: () => {}
});
vm.runInContext(devoirsSrc, context);
vm.runInContext(moteurSrc, context);
const js = e => vm.runInContext(e, context);

/* Dates relatives à aujourd'hui, pour que les créneaux restent à venir. */
const J = new Date(); J.setDate(J.getDate() + 3);
const cle = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dateJ = cle(J);
const jourJ = (J.getDay() + 6) % 7;
const apercu = 'new Date(' + J.getTime() + ')';
const cours = (s, e, t) => ({ id: 'cours-' + s + '-' + e, title: t || 'Cours', startTime: s, endTime: e, type: 'school' });
function enregistrer(devoirs, examens) {
    data.studyPlanIB_devoirs = JSON.stringify({ bac: null, bacDemande: 0, devoirs: devoirs || [], examens: examens || [] });
}
function adapter(events, jour) {
    return js('devoirsAdapterJour(' + JSON.stringify(events || []) + ', ' + (jour == null ? jourJ : jour) + ', ' + apercu + ')');
}
const blocsDevoirs = evts => evts.filter(e => /^(devoir|exam)-/.test(String(e.id)));

const echecs = [];
function verifier(nom, fn) {
    try { fn(); } catch (e) { echecs.push(nom + ' — ' + e.message); }
}

/* ── DE-20 : heures anglo-saxonnes ─────────────────────────────────── */
verifier('DE-20 : 12 am = 00:00, 12 pm = 12:00, 1 am = 01:00, 1 pm = 13:00', () => {
    assert.deepStrictEqual(['12:00 am', '12:00 pm', '1 am', '1 pm'].map(t => js(`devoirsNormaliserApresMidi('${t}')`)),
        ['00:00', '12:00', '01:00', '13:00']);
});

/* ── DE-12 : un seul plafond ───────────────────────────────────────── */
verifier('DE-12 : une seule constante de séances', () => {
    assert.strictEqual((devoirsSrc.match(/var DEVOIRS_MAX_SEANCES\s*=/g) || []).length, 1);
    assert.strictEqual((moteurSrc.match(/DEVOIRS_MAX_SEANCES\s*=/g) || []).length, 0);
    const autres = /Math\.min\(\s*(6|10)\s*,|<=\s*(6|10)\b/.test(devoirsSrc + moteurSrc);
    assert(!autres, 'un plafond en dur (6 ou 10) subsiste');
    assert.strictEqual(js('DEVOIRS_MAX_SEANCES'), 6);
});

/* ── DE-11 : zéro séance, et « pas encore choisi » distinct ────────── */
verifier('DE-11 : zéro séance est accepté et distingué', () => {
    assert.strictEqual(js("devoirsNombreSeances({ seances: 0 })"), 0);
    enregistrer([{ id: 'z1', matiere: 'Maths', date: dateJ, debut: '10:00', fin: '11:00' }]);
    assert.strictEqual(js("devoirsAppliquerSeances(['z1'], 0)"), undefined);
    assert.strictEqual(js("devoirsLireStore().devoirs[0].seances"), 0);
    assert.strictEqual(js("devoirsAppliquerSeances(['z1'], 7)"), undefined);
    assert.strictEqual(js("devoirsLireStore().devoirs[0].seances"), 0, 'une valeur au-delà du plafond a été écrite');
    assert(devoirsSrc.includes('Sans révisions') && devoirsSrc.includes('Séances à choisir'));
});

/* ── DE-17 : deux devoirs à la même heure restent visibles, chacun à ses heures ── */
verifier('DE-17 : un chevauchement ne raccourcit ni ne masque un devoir', () => {
    enregistrer([
        { id: 'dA', matiere: 'Maths', date: dateJ, debut: '10:00', fin: '11:00' },
        { id: 'dB', matiere: 'Physique', date: dateJ, debut: '10:30', fin: '11:30' }
    ]);
    const blocs = blocsDevoirs(adapter([cours('08:00', '09:00')]));
    const a = blocs.find(e => e.id === 'devoir-dA');
    const b = blocs.find(e => e.id === 'devoir-dB');
    assert(a && b, 'un des deux devoirs manque dans le planning');
    assert.strictEqual(a.startTime + '-' + a.endTime, '10:00-11:00', 'le premier devoir a été raccourci');
    assert.strictEqual(b.startTime + '-' + b.endTime, '10:30-11:30');
});

/* ── DE-18 : un devoir sans heure reste visible ────────────────────── */
verifier('DE-18 : sans heure et créneau trop court, le devoir reste visible', () => {
    enregistrer([{ id: 'dC', matiere: 'Histoire', date: dateJ, debut: '', fin: '' }]);
    const evts = [{ id: 'dv', title: 'DEVOIR DE NIVEAU', startTime: '08:00', endTime: '08:30', type: 'school' }];
    const blocs = blocsDevoirs(adapter(evts));
    assert(blocs.some(e => e.id === 'devoir-dC' && e.subtitle === 'Heure à confirmer'), 'devoir sans heure invisible');
});
verifier('DE-18 : sans heure et journée libre, le devoir est posé à une heure à confirmer', () => {
    enregistrer([{ id: 'dD', matiere: 'Anglais', date: dateJ, debut: '', fin: '' }]);
    const blocs = blocsDevoirs(adapter([]));
    assert(blocs.some(e => e.id === 'devoir-dD' && e.subtitle === 'Heure à confirmer'));
});

/* ── DE-08 / DE-09 : les examens passés ne génèrent plus de révisions ── */
verifier('DE-09 : un examen passé ne génère aucune révision', () => {
    const hier = new Date(); hier.setDate(hier.getDate() - 3);
    enregistrer([], [{ id: 'xp', matiere: 'Physique', date: cle(hier), debut: '10:00', fin: '11:00' }]);
    const evts = adapter([]);
    assert(!evts.some(e => /^(exam|devrev)-/.test(String(e.id))), 'un examen passé est encore affiché ou révisé');
});

/* ── Interface : listes, étiquettes, fenêtres ──────────────────────── */
verifier('DE-08 / DE-24 : listes séparées à venir / passés, recherche et filtres', () => {
    assert(devoirsSrc.includes("'<h3 class=\"devoirs-groupe\">À venir ('") || devoirsSrc.includes('À venir ('), 'groupe « À venir » absent');
    assert(devoirsSrc.includes('<details class="devoirs-passes"'), 'les passés ne sont pas repliés');
    assert(html.includes('id="devoirsRecherche"') && html.includes('id="examensRecherche"'), 'recherche absente');
    assert(html.includes('id="devoirsFiltre"') && html.includes('id="examensFiltre"'), 'filtres absents');
});
verifier('DE-23 : champs étiquetés, y compris les heures d’édition des séances', () => {
    ['devManuelMatiere', 'devManuelDate', 'devManuelDebut', 'devManuelFin', 'exaManuelMatiere', 'exaManuelDate', 'exaManuelDebut', 'exaManuelFin',
     'devoirsRecherche', 'devoirsFiltre', 'examensRecherche', 'examensFiltre'].forEach(id => {
        assert(html.includes('for="' + id + '"'), 'champ sans étiquette : ' + id);
    });
    assert(devoirsSrc.includes('aria-label="Heure de début"') && devoirsSrc.includes('aria-label="Heure de fin"'), 'heures de séances sans étiquette');
});
verifier('DE-13 : fenêtres de la page en dialogue, Échap et focus rendu', () => {
    ['seancesQuestionModal', 'seancesEditModal', 'devoirsEditionModal'].forEach(id => {
        const i = devoirsSrc.indexOf("'" + id + "'");
        assert(i !== -1, 'fenêtre absente : ' + id);
        const bloc = devoirsSrc.slice(i, i + 900);
        assert(bloc.includes("'role', 'dialog'") || bloc.includes('role="dialog"'), 'pas de role dialog : ' + id);
    });
    assert((devoirsSrc.match(/devoirsModalClavier\(voile/g) || []).length >= 3, 'une fenêtre n’a pas le piège de focus / Échap');
    assert(devoirsSrc.includes('devoirsRendreFocus(retourSeances)') && devoirsSrc.includes('devoirsRendreFocus(retourQuestion)'), 'le focus n’est pas rendu à la fermeture');
});

if (echecs.length) {
    console.error('Lot 11 : ' + echecs.length + ' échec(s)');
    echecs.forEach(e => console.error(' - ' + e));
    process.exit(1);
}
console.log('ok lot 11 : plafond unique, zéro séance, chevauchement, heure à confirmer, examens passés, listes, étiquettes, fenêtres');
