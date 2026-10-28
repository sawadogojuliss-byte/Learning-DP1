/* Scénarios isolés : aucune requête, aucun profil élève et aucune notification. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const code = fs.readFileSync('js/pages/exercices.js', 'utf8');
const planning = fs.readFileSync('js/pages/planning-moteur.js', 'utf8');
const values = {};
const elements = {};
function el(id) {
    return elements[id] ||= {
        id, value: '', textContent: '', innerHTML: '', style: {}, attrs: {}, dataset: {},
        getAttribute(k) { return this.attrs[k] || null; }, setAttribute(k, v) { this.attrs[k] = v; },
        removeAttribute(k) { delete this.attrs[k]; }, focus() {}, querySelector() { return null; },
        replaceChildren() {}, append() {}, addEventListener() {}, contains() { return true; }
    };
}
const document = {
    getElementById: el, querySelectorAll() { return []; }, querySelector() { return null; },
    createElement() { return { style: {}, setAttribute() {}, addEventListener() {}, remove() {}, append() {} }; },
    body: { appendChild() {} }
};
const localStorage = {
    getItem(k) { return values[k] || null; }, setItem(k, v) { values[k] = v; }, removeItem(k) { delete values[k]; }
};
const context = vm.createContext({ console, Date, localStorage, document, window: {},
    subjects: [{ name: 'Physique', icon: '📚' }], optionalSubjects: [], ibYear: 'DP2',
    devoirsFaitBac: () => false, iconeHtml: () => '📚',
    timeToMinutes: t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)),
    addMinutes: (t, n) => {
        const m = Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) + n;
        return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    },
    holidayMode: (day, date) => { assert(date instanceof Date, 'jour férié vérifié à la date cible'); return null; },
    setTimeout() {}, memoireSauvegarder: () => { context.syncs++; }, syncs: 0,
    v3Save: () => { values.studyPlanIB_customEvents_juliss = JSON.stringify(vm.runInContext('customEvents', context)); },
    renderPlanning() {}, v3Toast: (msg, type, opts) => { context.undo = opts.undo; }
});
vm.runInContext('let customEvents = []; let selectedDay = 0; let planningDecalageSemaine = 0;', context);
vm.runInContext(code, context);
const call = script => vm.runInContext(script, context);
const today = new Date();
const local = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 12);
const after = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4, 12);
const key = local(tomorrow);
// Deux plages de 45 min fictives, même date : une tâche de 90 min doit être couverte entièrement.
context.mode = 'twoGaps';
context.datesSeen = [];
context.generateDayEvents = (day, date) => {
    assert(date instanceof Date, 'le moteur reçoit la date réelle, et pas seulement le jour de semaine');
    context.datesSeen.push(local(date));
    const blocks = context.mode === 'twoGaps'
        ? [['06:00', '07:00'], ['07:45', '08:00'], ['08:45', '22:30']]
        : [['06:00', '07:00'], ['08:30', '22:30']];
    return blocks.map(([startTime, endTime], i) => ({ id: 'fictif-' + i, startTime, endTime }))
        .concat(call('customEvents').filter(e => e.date === local(date) && !e.deleted));
};
const exo = { id: 'a\"<b>', subject: 'Phy <b> & \"', subjectIcon: '📚',
    text: 'Fiche <img src=x onerror=bad()>', filename: 'Nom <b>.pdf',
    duration: 90, deadline: local(after), done: false, scheduledSlot: null };
call('exercices.push(' + JSON.stringify(exo) + ')');
values.studyPlanIB_exercices = JSON.stringify([exo]);
call('renderExoList()');
assert(!el('exoListContainer').innerHTML.includes('Fiche <img'), 'texte de l’élève échappé');
assert(!el('exoListContainer').innerHTML.includes('Nom <b>'), 'nom de fichier échappé');
assert(el('exoListContainer').innerHTML.includes('Phy &lt;b&gt;'), 'matière échappée');
assert(!el('exoListContainer').innerHTML.includes('onclick="basculerExoFait'), 'aucun id injecté dans un onclick');
assert(!call('exoSujets()').some(s => s.name === 'Bac national'), 'bac absent sans réponse positive');
context.devoirsFaitBac = () => true;
assert(call('exoSujets()').some(s => s.name === 'Bac national'), 'bac visible en DP2 si oui');
call("ibYear='DP1'");
assert(!call('exoSujets()').some(s => s.name === 'Bac national'), 'bac absent en DP1');
call("ibYear='DP2'");
assert(context.datesSeen.length === 0);
let options = call('findAvailableSlots(exercices[0])');
assert(options.length && options[0].parts.length === 2);
assert.equal(options[0].parts.reduce((sum, p) => sum + p.duration, 0), 90);
assert(context.datesSeen.includes(key));
assert(options.every(o => o.parts.every(p => p.dateKey < exo.deadline)), 'aucune séance le jour de la deadline');
call('scheduleExo(' + JSON.stringify(exo.id) + ', 0)');
let records = call('customEvents');
assert.equal(records.length, 2);
assert(records.every(e => e.date && e.exoId === exo.id), 'séances datées, aucune répétition hebdomadaire');
assert.equal(JSON.parse(values.studyPlanIB_exercices)[0].scheduledSlot !== null, true);
const ancienneVersion = records[0];
context.mode = 'oneGap';
call('scheduleExo(' + JSON.stringify(exo.id) + ', 0)');
records = call('customEvents');
assert.equal(records.length, 1, 'replanifier remplace seulement ses créneaux');
assert.equal(records[0].date, key);
const filtre = planning.slice(planning.indexOf('function planningExercicePlanActif('), planning.indexOf('function v3FindOverride('));
vm.runInContext(filtre, context);
context.ancienneVersion = ancienneVersion;
assert.equal(call('planningExercicePlanActif(ancienneVersion)'), false, 'ancien plan distant masqué sans effacer son archive');
assert.equal(call('planningExercicePlanActif(customEvents[0])'), true);
context.undo();
assert.equal(call('planningExercicePlanActif(customEvents[0])'), true, 'Annuler réactive la version précédente');
assert.equal(call('customEvents').length, 2, 'Annuler restaure le plan précédent');
call('basculerExoFait(' + JSON.stringify(exo.id) + ')');
assert.equal(JSON.parse(values.studyPlanIB_exercices)[0].done, true);
assert(context.syncs > 0, 'la sauvegarde du compte est déclenchée par Fait');
call('exercices = []; renderExoList()');
assert.equal(call('exercices[0].done'), true, 'fait conservé après relecture du stockage');
assert(el('exoListContainer').innerHTML.includes('↩ À faire'));
// 90 min demandées, seulement 30 disponibles sur la plage de recherche : ne rien planifier.
context.mode = 'twoGaps';
call('exercices[0].done = false; exercices[0].duration = 180');
context.generateDayEvents = (day, date) => [{ id: 'fictif', startTime: '06:15', endTime: '22:30' }];
const shortDeadline = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
call('exercices[0].deadline = ' + JSON.stringify(local(shortDeadline)));
assert.equal(call('findAvailableSlots(exercices[0])').length, 0, 'aucune fausse planification partielle');

// Fusion de compte : un ancien profil distant ne rétablit pas « À faire ».
const compte = fs.readFileSync('js/compte.js', 'utf8');
vm.runInContext(compte.slice(compte.indexOf('function compteChampRempli('), compte.indexOf('function compteFusionnerObjets(')), context);
const ancien = [{ id: 'exo-1', done: false, scheduledSlot: 'Ancien créneau', etatAt: '2026-10-27T10:00:00.000Z' }];
const nouveau = [{ id: 'exo-1', done: true, scheduledSlot: null, etatAt: '2026-10-28T10:00:00.000Z' }];
context.copies = [ancien, nouveau];
assert.equal(call('compteUnionParId(copies, "id", false, true)[0].done'), true);
assert.equal(call('compteUnionParId(copies, "id", false, true)[0].scheduledSlot'), null);
context.copies = [nouveau, ancien];
assert.equal(call('compteUnionParId(copies, "id", false, true)[0].done'), true);
assert.equal(call('compteUnionParId(copies, "id", false, true)[0].scheduledSlot'), null);

console.log('ok audit exercices : contenu sûr, Bac national, dates, durée, replanification, Annuler, Fait et compte');
