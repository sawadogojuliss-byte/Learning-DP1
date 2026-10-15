/* Vérifie que la liste d'une journée suit l'ordre chronologique :
   chaque créneau apparaît à sa place, Préparation puis Trajet école avant les
   cours, Trajet maison juste après les cours, Réveil au début, Coucher à la fin. */
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

const echecs = [];
function ok(cond, message) {
    if (!cond) echecs.push(message);
}
function titre(ev) {
    return String(ev.title || ev.t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function minute(valeur) {
    const parts = String(valeur || '').split(':');
    return Number(parts[0]) * 60 + Number(parts[1]);
}
function debut(ev) { return ev.startTime || ev.d || ''; }
function fin(ev) { return ev.endTime || ev.f || ''; }

/* La journée de la photo : réveil, préparation, trajet école, petit-déjeuner,
   exercices, puis les cours. La préparation et le trajet doivent rester avant
   le petit-déjeuner, même s'ils sont calculés à rebours depuis les cours. */
const jour = [
    { id: 'wakeup', title: 'Réveil', startTime: '05:50', endTime: '06:00', type: 'wakeup' },
    { id: 'prep', title: 'Préparation', startTime: '06:00', endTime: '06:30', type: 'prep' },
    { id: 'commute1', title: 'Trajet école', startTime: '06:30', endTime: '06:45', type: 'transport' },
    { id: 'breakfast', title: 'Petit-déjeuner', startTime: '06:45', endTime: '07:00', type: 'meal' },
    { id: 'exercises', title: 'Exercices Physique', startTime: '07:00', endTime: '07:50', type: 'study' },
    { id: 'school1', title: 'Cours', startTime: '07:50', endTime: '12:30', type: 'school' },
    { id: 'lunch', title: 'Déjeuner', startTime: '12:30', endTime: '13:30', type: 'meal' },
    { id: 'school2', title: 'Cours', startTime: '13:30', endTime: '16:25', type: 'school' },
    { id: 'commute2', title: 'Trajet maison', startTime: '16:25', endTime: '17:05', type: 'transport' },
    { id: 'sleep', title: 'Coucher', startTime: '22:00', endTime: '05:50', type: 'sleep' }
];

const out = context.planningGarantirJour(jour);
const ordre = out.map(function (ev) { return titre(ev) + ' ' + debut(ev); });
console.log('ordre obtenu :\n  ' + ordre.join('\n  '));

function position(motif) {
    return out.findIndex(function (ev) { return titre(ev).indexOf(motif) === 0; });
}

ok(titre(out[0]).indexOf('reveil') === 0, 'le jour doit commencer par Réveil');
ok(titre(out[out.length - 1]).indexOf('coucher') === 0, 'le jour doit finir par Coucher');
ok(position('preparation') !== -1, 'Préparation absente');
ok(position('preparation') < position('trajet ecole'), 'Préparation doit passer avant Trajet école');
ok(position('trajet ecole') < position('petit') , 'Trajet école doit passer avant le petit-déjeuner');
ok(position('petit') < position('exercices'), 'le petit-déjeuner doit passer avant les exercices');
ok(position('exercices') < position('cours'), 'les exercices doivent passer avant les cours');

/* Contrôle général : plus aucun créneau n'est affiché après un créneau plus tardif.
   Une heure plus petite que le Réveil appartient à la fin de la journée (nuit),
   comme dans le moteur : 00:35 se place après 23:10, pas avant. */
function minuteJour(ev, minuteReveil) {
    const m = minute(debut(ev));
    const fixe = !!(ev && ev.habitudeFixe);
    if (m < minuteReveil && !fixe) return m + 1440;
    return m;
}
function compterDesordre(liste) {
    const reveil = liste[0] ? minute(debut(liste[0])) : 0;
    let desordre = 0;
    let dernier = -1;
    liste.forEach(function (ev, i) {
        if (i === 0 || i === liste.length - 1) return;
        const m = minuteJour(ev, reveil);
        if (m < dernier) desordre += 1;
        dernier = m;
    });
    return desordre;
}
ok(compterDesordre(out) === 0, compterDesordre(out) + ' créneau(x) hors de l ordre chronologique');

/* Le résultat doit rester stable si on le repasse dans le moteur. */
const encore = context.planningGarantirJour(out);
ok(JSON.stringify(encore.map(function (ev) { return [titre(ev), debut(ev), fin(ev)]; })) ===
   JSON.stringify(out.map(function (ev) { return [titre(ev), debut(ev), fin(ev)]; })),
   'le rangement doit être stable');

/* Les emplois enregistrés reçus doivent eux aussi être chronologiques. */
let jours = 0;
let desordres = 0;
const doc = JSON.parse(fs.readFileSync(path.join(root, 'data/emplois.json'), 'utf8'));
(doc.emplois || []).forEach(function (emploi) {
    (emploi.jours || []).forEach(function (j) {
        if (!j.s || !j.s.length) return;
        jours += 1;
        const corrige = context.planningGarantirJour(j.s);
        desordres += compterDesordre(corrige);
    });
});
ok(desordres === 0, desordres + ' désordre(s) dans les emplois reçus (' + jours + ' jours)');

if (echecs.length) {
    console.error('échecs ' + echecs.length);
    echecs.forEach(function (e) { console.error('- ' + e); });
    process.exit(1);
}
console.log('ordre du jour chronologique : échecs 0 (' + jours + ' jours vérifiés)');
