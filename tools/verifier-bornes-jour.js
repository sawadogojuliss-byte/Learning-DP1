'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/pages/planning-moteur.js'), 'utf8');
const context = {
    console: console,
    Set: Set,
    Map: Map,
    Object: Object,
    Array: Array,
    String: String,
    Number: Number,
    Math: Math,
    Date: Date,
    JSON: JSON,
    isFinite: isFinite,
    localStorage: { getItem: function () { return null; }, setItem: function () {} }
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'planning-moteur.js' });

function titre(ev) {
    return String(ev.title || ev.t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function minute(valeur) {
    var parts = String(valeur || '').split(':');
    return Number(parts[0]) * 60 + Number(parts[1]);
}
function debut(ev) { return ev.startTime || ev.d || ''; }
function fin(ev) { return ev.endTime || ev.f || ''; }

function verifier(nom, jour, events) {
    var out = context.planningGarantirJour(events);
    var erreurs = [];
    if (!out.length) {
        erreurs.push('jour vide');
        return erreurs;
    }
    if (titre(out[0]).indexOf('reveil') !== 0) erreurs.push('ne commence pas par Réveil: ' + titre(out[0]));
    if (titre(out[out.length - 1]).indexOf('coucher') !== 0) erreurs.push('ne finit pas par Coucher: ' + titre(out[out.length - 1]));
    var debutReveil = minute(debut(out[0]));
    var debutCoucher = minute(debut(out[out.length - 1]));
    var finCoucher = minute(fin(out[out.length - 1]));
    var finAbs = finCoucher <= debutCoucher ? finCoucher + 1440 : finCoucher;
    var reveilAbs = debutReveil <= debutCoucher ? debutReveil + 1440 : debutReveil;
    if (finAbs > reveilAbs) erreurs.push('Réveil commence avant la fin du coucher: ' + debut(out[0]) + ' / ' + fin(out[out.length - 1]));
    var prep = -1;
    var trajet = -1;
    out.forEach(function (ev, i) {
        if (prep < 0 && (ev.id === 'prep' || titre(ev).indexOf('preparation') === 0)) prep = i;
        if (trajet < 0 && (ev.id === 'commute1' || titre(ev).indexOf('trajet ecole') === 0)) trajet = i;
    });
    if (trajet >= 0) {
        if (prep < 0) erreurs.push('Trajet école sans Préparation');
        else if (prep > trajet) erreurs.push('Préparation après Trajet école');
        else if (minute(fin(out[prep])) > minute(debut(out[trajet]))) erreurs.push('Préparation se termine après le départ école');
    }
    var encore = context.planningGarantirJour(out);
    if (JSON.stringify(encore.map(function (ev) { return [titre(ev), debut(ev), fin(ev)]; })) !== JSON.stringify(out.map(function (ev) { return [titre(ev), debut(ev), fin(ev)]; }))) {
        erreurs.push('la correction n’est pas stable');
    }
    return erreurs;
}

var echecs = 0;
var jours = 0;
var doc = JSON.parse(fs.readFileSync(path.join(root, 'data/emplois.json'), 'utf8'));
(doc.emplois || []).forEach(function (emploi) {
    var nom = emploi.nom || emploi.googleNom || emploi.id;
    (emploi.jours || []).forEach(function (jour) {
        jours += 1;
        var erreurs = verifier(nom, jour.j, jour.s || []);
        if (erreurs.length) {
            echecs += 1;
            console.log('ECHEC', nom, jour.j, erreurs.join(' | '));
        }
    });
});

var cas = verifier('synthèse', 'Lundi', [
    { d: '00:30', f: '05:30', t: 'Coucher' },
    { d: '06:45', f: '07:40', t: 'Trajet école' },
    { d: '05:30', f: '05:40', t: 'Réveil' },
    { d: '07:00', f: '07:30', t: 'Préparation' },
    { d: '07:50', f: '12:30', t: 'Cours' }
]);
if (cas.length) {
    echecs += 1;
    console.log('ECHEC synthèse', cas.join(' | '));
}
var sans = verifier('manquant', 'Mardi', [
    { startTime: '08:00', endTime: '09:00', title: 'Trajet école', id: 'commute1' },
    { startTime: '18:00', endTime: '19:00', title: 'Révisions' }
]);
if (sans.length) {
    echecs += 1;
    console.log('ECHEC manquant', sans.join(' | '));
}

console.log('jours vérifiés', jours, 'échecs', echecs);
if (echecs) process.exit(1);
