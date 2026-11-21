#!/usr/bin/env node
/* Régressions de fusion : anciennes sauvegardes, tombes et égalité d'horloge. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const compte = fs.readFileSync('js/compte.js', 'utf8');
const extrait = compte.slice(compte.indexOf('function compteChampRempli('), compte.indexOf('/* Série de flammes')) +
    compte.slice(compte.indexOf('function compteFusionnerFeries('), compte.indexOf('function compteFusionnerProfils('));
const c = {}; vm.createContext(c); vm.runInContext(extrait, c);
const jour = '2026-12-12', autre = '2026-12-13';
const version = (at, mode, dropped = []) => ({at, mode, dropped});
const ancienne = {holidayDates: {[jour]: 'light', [autre]: 'keep'}, holidayDroppedDates: {[jour]: ['x']}};
const retiree = {holidayVersions: {[jour]: version(20, null)}};
function fusion(copies) {
    const base = {holidayDates: {}, holidayDroppedDates: {}};
    for (const p of copies) {
        base.holidayDates = c.compteFusionnerObjets(base.holidayDates, p.holidayDates || {});
        base.holidayDroppedDates = c.compteFusionnerObjets(base.holidayDroppedDates, p.holidayDroppedDates || {});
    }
    c.compteFusionnerFeries(copies, base);
    return JSON.parse(JSON.stringify(base));
}
for (const ordre of [[ancienne, retiree], [retiree, ancienne]]) {
    const f = fusion(ordre);
    assert.equal(Object.hasOwn(f.holidayDates, jour), false);
    assert.equal(Object.hasOwn(f.holidayDroppedDates, jour), false);
    assert.equal(f.holidayDates[autre], 'keep');
    assert.equal(f.holidayVersions[jour].mode, null);
}
const recochage = {holidayVersions: {[jour]: version(21, 'free')}};
assert.equal(fusion([ancienne, retiree, recochage]).holidayDates[jour], 'free');
const modification = {holidayVersions: {[jour]: version(22, 'light', ['y'])}};
assert.deepEqual(fusion([recochage, modification, ancienne]).holidayDroppedDates[jour], ['y']);
const egalA = {holidayVersions: {[jour]: version(30, null)}};
const egalB = {holidayVersions: {[jour]: version(30, 'keep')}};
assert.deepEqual(fusion([egalA, egalB]), fusion([egalB, egalA]));
assert.equal(fusion([ancienne]).holidayDates[jour], 'light', 'anciens profils préservés');
console.log('ok fériés : anciennes copies, suppression, recochage, activités et ordre de fusion');
