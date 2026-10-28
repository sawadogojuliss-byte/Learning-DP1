/* Lot 5 : état réversible, compteurs, filtres et validation en ligne. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const page = fs.readFileSync('pages/exercices.html', 'utf8');
const code = fs.readFileSync('js/pages/exercices.js', 'utf8');
for (const id of ['exoSubjectErreur', 'exoContenuErreur', 'exoDeadlineErreur']) {
    assert(page.includes('id="' + id + '"') && page.includes('aria-live="polite"'), id + ' accessible');
}
for (const filtre of ['tous', 'afaire', 'faits']) assert(page.includes('data-exo-filtre="' + filtre + '"'));
assert(!/\balert\s*\(/.test(code), 'aucun alert bloquant dans la page Exercices');

const values = {};
const elements = {};
let activeElement = null;
function el(id) {
    if (!elements[id]) elements[id] = {
        id, value: '', textContent: '', innerHTML: '', style: {}, attrs: {},
        replaceChildren() {}, append() {},
        setAttribute(k, v) { this.attrs[k] = v; },
        getAttribute(k) { return this.attrs[k] || null; },
        removeAttribute(k) { delete this.attrs[k]; },
        focus() { activeElement = this; },
        querySelector(sel) { return sel === 'button' ? firstSubject : null; }
    };
    return elements[id];
}
const firstSubject = { focus() { activeElement = firstSubject; } };
const filters = ['tous', 'afaire', 'faits'].map(v => {
    const btn = el('filter-' + v); btn.setAttribute('data-exo-filtre', v); return btn;
});
const document = {
    getElementById: el,
    querySelector(sel) {
        const match = /^\[data-exo-filtre="(.*?)"\]$/.exec(sel);
        return match ? el('filter-' + match[1]) : null;
    },
    querySelectorAll(sel) { return sel === '[data-exo-filtre]' ? filters : []; },
    createElement() { return { style: {}, setAttribute() {}, addEventListener() {}, remove() {} }; },
    body: { appendChild() {} },
    get activeElement() { return activeElement; }
};
const localStorage = {
    getItem(k) { return values[k] || null; },
    setItem(k, v) { values[k] = v; },
    removeItem(k) { delete values[k]; }
};
const context = vm.createContext({ document, localStorage, Date, console, setTimeout: () => {},
    iconeHtml: () => '📚', subjects: [{ name: 'Physique', icon: '📚' }], optionalSubjects: [] });
vm.runInContext(code, context);
vm.runInContext('findAvailableSlots = () => []', context);
function call(js) { return vm.runInContext(js, context); }
const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

call('addExercice()');
assert(el('exoSubjectErreur').textContent && activeElement === firstSubject);
assert.equal(el('exoSubjectGrid').getAttribute('aria-invalid'), 'true');
call('selectExoSubject(0)');
assert.equal(el('exoSubjectErreur').textContent, '');
call('addExercice()');
assert(el('exoContenuErreur').textContent && activeElement === el('exoTextInput'));
el('exoTextInput').value = 'Exercices de mécanique';
call("exoEffacerErreur('contenu')");
call('addExercice()');
assert(el('exoDeadlineErreur').textContent && activeElement === el('exoDeadline'));
el('exoDeadline').value = demain;
call('addExercice()');
let list = JSON.parse(values.studyPlanIB_exercices);
assert.equal(list.length, 1);
const id = list[0].id;
assert.equal(list[0].done, false);
assert(el('exoCountBadge').textContent.includes('1 exercice'));
call("showUploadedFile({ name: 'essai.pdf', size: 1024 })");
call('clearUpload()');
assert.equal(el('uploadedFileName').getAttribute('data-filename'), null, 'fichier retiré ne valide pas un exercice');
assert(el('exoListContainer').innerHTML.includes('✓ Fait'));
call("switchExoTab('planifier')");
assert(el('planifierContent').innerHTML.includes('Exercices de mécanique'));
call('basculerExoFait(' + JSON.stringify(id) + ')');
list = JSON.parse(values.studyPlanIB_exercices);
assert.equal(list[0].done, true, 'fait écrit dans le stockage');
assert(el('exoCountBadge').textContent.includes('0 exercice'), 'badge à faire');
assert(el('planifierContent').innerHTML.includes('0min'));
assert(!el('planifierContent').innerHTML.includes('Exercices de mécanique'), 'fait exclu de la planification');
assert(el('exoListContainer').innerHTML.includes('↩ À faire'), 'carte faite conservée');
call("filtrerExos('afaire')");
assert(el('exoListContainer').innerHTML.includes('Aucun exercice à faire'));
call("filtrerExos('faits')");
assert(el('exoListContainer').innerHTML.includes('↩ À faire'));
// Comme un rechargement : la liste relit le stockage avant le rendu.
call('exercices = []; renderExoList()');
assert.equal(call('exercices[0].done'), true, 'fait survit au rechargement');
call('basculerExoFait(' + JSON.stringify(id) + ')');
assert.equal(JSON.parse(values.studyPlanIB_exercices)[0].done, false);
call("filtrerExos('afaire')");
assert(el('exoListContainer').innerHTML.includes('✓ Fait'), 'inverse et filtre à faire');
assert(el('planifierContent').innerHTML.includes('Exercices de mécanique'), 'à replanifier');
assert(el('exoCountBadge').textContent.includes('1 exercice'));
console.log('ok exercices : validation accessible, fait réversible, compteurs, filtres, stockage');
