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
    /* Le sommeil ne descend jamais sous 5 h. */
    var lit = debutCoucher <= debutReveil ? debutCoucher + 1440 : debutCoucher;
    var finJour = debutReveil + 1440;
    var sommeil = finJour - lit;
    if (sommeil < 299) erreurs.push('sommeil sous 5 h : ' + Math.floor(sommeil / 60) + ' h ' + (sommeil % 60) + ' (coucher ' + debut(out[out.length - 1]) + ')');
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

/* Régression : une révision ajoutée à 00 h 35 ne doit plus repousser le
   coucher après elle (l'emploi de Mathis était resté à 4 h 25 de sommeil,
   et Kenzah a signalé 3 h). */
var nuit = context.planningGarantirJour([
    { startTime: '06:00', endTime: '06:10', title: 'Réveil', id: 'wakeup', type: 'wakeup' },
    { startTime: '19:00', endTime: '19:45', title: 'Dîner', id: 'dinner' },
    { startTime: '21:30', endTime: '23:10', title: 'Révisions Physique' },
    { startTime: '00:35', endTime: '01:35', title: 'Révision Mathématiques AA', source: 'custom' },
    { startTime: '01:35', endTime: '06:00', title: 'Coucher', id: 'sleep', type: 'sleep' }
]);
var nuitCoucher = nuit[nuit.length - 1];
if (minute(debut(nuitCoucher)) !== 60) {
    echecs += 1;
    console.log('ECHEC sommeil', 'le coucher devait revenir à 01:00, il est à ' + debut(nuitCoucher));
}
var nuitRev = nuit.filter(function (ev) { return titre(ev).indexOf('revision math') === 0; })[0];
if (!nuitRev || minute(fin(nuitRev)) > 60) {
    echecs += 1;
    console.log('ECHEC sommeil', 'la révision tardive devait finir au plus tard à 01:00');
}
var nuit2 = context.planningGarantirJour(nuit);
if (JSON.stringify(nuit2.map(function (ev) { return [titre(ev), debut(ev), fin(ev)]; })) !== JSON.stringify(nuit.map(function (ev) { return [titre(ev), debut(ev), fin(ev)]; }))) {
    echecs += 1;
    console.log('ECHEC sommeil', 'la protection du sommeil n’est pas stable');
}

/* Régression : un créneau entièrement dans la nuit (02:00→03:00) reste
   à sa place — c'est un choix de l'élève (prière de l'aube, sieste) —
   mais le coucher garde ses 5 h. */
var creux = context.planningGarantirJour([
    { startTime: '06:00', endTime: '06:10', title: 'Réveil', id: 'wakeup', type: 'wakeup' },
    { startTime: '20:00', endTime: '21:00', title: 'Révisions' },
    { startTime: '02:00', endTime: '03:00', title: 'Lecture', source: 'custom' },
    { startTime: '01:00', endTime: '06:00', title: 'Coucher', id: 'sleep', type: 'sleep' }
]);
var creuxLecture = creux.filter(function (ev) { return titre(ev) === 'lecture'; })[0];
var creuxCoucher = creux[creux.length - 1];
if (!creuxLecture || debut(creuxLecture) !== '02:00' || fin(creuxLecture) !== '03:00') {
    echecs += 1;
    console.log('ECHEC nuit', 'le créneau nocturne doit rester 02:00→03:00, pas ' + (creuxLecture ? debut(creuxLecture) + '→' + fin(creuxLecture) : 'absent'));
}
if (debut(creuxCoucher) !== '01:00') {
    echecs += 1;
    console.log('ECHEC nuit', 'le coucher doit rester 01:00');
}

/* Régression : une journée déjà à 5 h de sommeil ne bouge pas. */
var calme = context.planningGarantirJour([
    { startTime: '05:00', endTime: '05:10', title: 'Réveil', id: 'wakeup', type: 'wakeup' },
    { startTime: '07:50', endTime: '12:30', title: 'Cours', id: 'school1', type: 'school' },
    { startTime: '13:30', endTime: '16:25', title: 'Cours', id: 'school2', type: 'school' },
    { startTime: '21:00', endTime: '22:00', title: 'Téléphone', id: 'phone' },
    { startTime: '00:00', endTime: '05:00', title: 'Coucher', id: 'sleep', type: 'sleep' }
]);
var calmeCoucher = calme[calme.length - 1];
if (debut(calmeCoucher) !== '00:00' || minute(fin(calme[0])) !== 310) {
    echecs += 1;
    console.log('ECHEC calme', 'une journée à 5 h de sommeil ne doit pas changer');
}

console.log('jours vérifiés', jours, 'échecs', echecs);
if (echecs) process.exit(1);
