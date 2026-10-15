'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function charger(fichier) {
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
    vm.runInContext(fs.readFileSync(path.join(root, fichier), 'utf8'), context, { filename: fichier });
    return context;
}

const planning = charger('js/pages/planning-moteur.js');
const boite = charger('js/pages/boite.js');

function titre(ev) {
    return String(ev.title || ev.t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function minute(valeur) {
    var parts = String(valeur || '').split(':');
    return Number(parts[0]) * 60 + Number(parts[1]);
}
function debut(ev) { return ev.startTime || ev.d || ''; }
function fin(ev) { return ev.endTime || ev.f || ''; }

function verifierJour(nom, jour, events) {
    var out = planning.planningGarantirJour(events);
    var erreurs = [];
    var cours = [];
    var ecole = -1;
    var maison = -1;
    out.forEach(function (ev, i) {
        if (titre(ev) === 'cours' || ev.id === 'school1' || ev.id === 'school2' || ev.type === 'school') cours.push(i);
        if (ecole < 0 && (ev.id === 'commute1' || titre(ev).indexOf('trajet ecole') === 0)) ecole = i;
        if (maison < 0 && (ev.id === 'commute2' || titre(ev).indexOf('trajet maison') === 0)) maison = i;
    });
    if (!cours.length) return erreurs;
    var premier = cours[0];
    var dernier = cours[cours.length - 1];
    if (ecole < 0) erreurs.push('Trajet école absent');
    else if (ecole >= premier) erreurs.push('Trajet école n’est pas avant les cours');
    else if (minute(fin(out[ecole])) > minute(debut(out[premier]))) erreurs.push('Trajet école empiète sur les cours');
    if (maison < 0) erreurs.push('Trajet maison absent');
    else {
        var ancre = dernier;
        if (maison !== ancre + 1) erreurs.push('Trajet maison pas juste après les cours (index ' + maison + ' attendu ' + (ancre + 1) + ')');
        var finAncre = minute(fin(out[ancre]));
        if (minute(debut(out[maison])) !== finAncre) erreurs.push('Trajet maison ne commence pas à ' + fin(out[ancre]) + ' mais à ' + debut(out[maison]));
    }
    var encore = planning.planningGarantirJour(out);
    if (JSON.stringify(encore.map(function (ev) { return [titre(ev), debut(ev), fin(ev)]; })) !== JSON.stringify(out.map(function (ev) { return [titre(ev), debut(ev), fin(ev)]; }))) {
        erreurs.push('correction instable');
    }
    return erreurs;
}

var echecs = 0;
var jours = 0;
var doc = JSON.parse(fs.readFileSync(path.join(root, 'data/emplois.json'), 'utf8'));
(doc.emplois || []).forEach(function (emploi) {
    var nom = emploi.nom || emploi.googleNom || emploi.id;
    (emploi.jours || []).forEach(function (jour) {
        if (['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'].indexOf(jour.j) === -1) return;
        jours += 1;
        var erreurs = verifierJour(nom, jour.j, jour.s || []);
        if (erreurs.length) {
            echecs += 1;
            console.log('ECHEC', nom, jour.j, erreurs.join(' | '));
        }
    });
});

var sejour = verifierJour('synthèse', 'Lundi', [
    { d: '06:00', f: '06:10', t: 'Réveil' },
    { d: '07:30', f: '08:00', t: 'Trajet école' },
    { d: '07:50', f: '12:30', t: 'Cours' },
    { d: '13:30', f: '16:35', t: 'Cours' },
    { d: '18:00', f: '19:00', t: 'Révisions Physique', resteEcole: true },
    { d: '22:00', f: '22:40', t: 'Trajet maison' },
    { d: '23:00', f: '06:00', t: 'Coucher' }
]);
if (sejour.length) {
    echecs += 1;
    console.log('ECHEC séjour', sejour.join(' | '));
} else {
    var corrige = planning.planningGarantirJour([
        { d: '06:00', f: '06:10', t: 'Réveil' },
        { d: '07:50', f: '12:30', t: 'Cours' },
        { d: '13:30', f: '16:35', t: 'Cours' },
        { d: '18:00', f: '19:00', t: 'Révisions Physique', resteEcole: true },
        { d: '22:00', f: '22:40', t: 'Trajet maison' }
    ]);
    var maison = corrige.filter(function (ev) { return titre(ev).indexOf('trajet maison') === 0; })[0];
    if (!maison || debut(maison) !== '16:35') {
        echecs += 1;
        console.log('ECHEC horaire séjour', maison && debut(maison));
    }
}
var finOfficielle = planning.planningGarantirJour(planning.planningCorrigerCours([
    { d: '06:00', f: '06:10', t: 'Réveil' },
    { d: '13:30', f: '16:35', t: 'Cours' },
    { d: '16:35', f: '17:15', t: 'Trajet maison' },
    { d: '22:00', f: '06:00', t: 'Coucher' }
]));
var coursApres = finOfficielle.filter(function (ev) { return titre(ev) === 'cours'; })[0];
var maisonApres = finOfficielle.filter(function (ev) { return titre(ev).indexOf('trajet maison') === 0; })[0];
if (!coursApres || fin(coursApres) !== '16:25' || !maisonApres || debut(maisonApres) !== '16:25') {
    echecs += 1;
    console.log('ECHEC fin de cours', coursApres && fin(coursApres), maisonApres && debut(maisonApres));
}

function attendre(texte, motif) {
    if (texte.indexOf(motif) !== 0) {
        echecs += 1;
        console.log('ECHEC mail', JSON.stringify(texte.slice(0, 80)));
    }
}
var matin = new Date(2026, 9, 12, 9, 15);
var soir = new Date(2026, 9, 12, 19, 40);
var nuit = new Date(2026, 9, 12, 2, 5);
attendre(boite.boiteTexteMail('Voici la réponse.', 'Ma question', 'Farid SERE', matin), 'Bonjour Farid SERE,');
attendre(boite.boiteTexteMail('Voici la réponse.', 'Ma question', 'Kenzah', soir), 'Bonsoir Kenzah,');
attendre(boite.boiteHtmlMail('Voici la réponse.', '', 'Nassika', soir), '');
var htmlSoir = boite.boiteHtmlMail('Voici la réponse.', '', 'Nassika', soir);
if (htmlSoir.indexOf('Bonsoir Nassika,') === -1) {
    echecs += 1;
    console.log('ECHEC html bonsoir');
}
var htmlMatin = boite.boiteHtmlMail('Voici la réponse.', '', 'Mathis', matin);
if (htmlMatin.indexOf('Bonjour Mathis,') === -1 || htmlMatin.indexOf('>Bonjour,<') !== -1) {
    echecs += 1;
    console.log('ECHEC html bonjour');
}
if (boite.boiteSalutation('RYAN', nuit) !== 'Bonsoir RYAN,') {
    echecs += 1;
    console.log('ECHEC nuit', boite.boiteSalutation('RYAN', nuit));
}
if (boite.boitePeriodeSalutation(new Date(2026, 9, 12, 17, 59)) !== 'Bonjour') echecs += 1;
if (boite.boitePeriodeSalutation(new Date(2026, 9, 12, 18, 0)) !== 'Bonsoir') echecs += 1;
if (boite.boiteNomCourrier('Farid SERE') !== 'Farid SERE') {
    echecs += 1;
    console.log('ECHEC casse', boite.boiteNomCourrier('Farid SERE'));
}
boite.boiteListesCache = {
    emplois: [{ google: 'mathis.kafando@enkoschools.com', nom: 'Mathis', googleNom: 'Aimery Mathis D. S Kafando' }],
    profils: [],
    questions: [],
    feedbacks: []
};
var soirMathis = new Date(2026, 9, 12, 20, 58);
var nomMathis = boite.boiteNomPourMail({ email: 'mathis.kafando@enkoschools.com' });
if (nomMathis !== 'Mathis' || boite.boiteSalutation(nomMathis, soirMathis) !== 'Bonsoir Mathis,') {
    echecs += 1;
    console.log('ECHEC nom Mathis', nomMathis);
}
var payload = boite.boitePayloadMail('mathis.kafando@enkoschools.com', 'Merci pour le retour.', 'Assistant', 'nonce', '', soirMathis);
if (!boite.boiteMailCommenceBien(payload) || payload.text.indexOf('Bonsoir Mathis,\n') !== 0 || payload.html.indexOf('white-space:nowrap') === -1) {
    echecs += 1;
    console.log('ECHEC payload', payload && payload.salutation, payload && payload.text.slice(0, 40));
}

console.log('jours scolaires vérifiés', jours, 'échecs', echecs);
if (echecs) process.exit(1);
