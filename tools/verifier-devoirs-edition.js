/* Lots 10–11 : corriger sans recréer, zéro séance, doublons et heures. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const src = fs.readFileSync('js/pages/devoirs.js', 'utf8');
const moteur = fs.readFileSync('js/pages/devoirs-moteur.js', 'utf8');
const vue = fs.readFileSync('pages/devoirs.html', 'utf8');
const data = {};
let renders = 0;
let values = {};
const context = vm.createContext({
    console, Date, Promise, setTimeout: () => {},
    window: {}, document: { getElementById: () => null },
    localStorage: { getItem: k => data[k] || null, setItem(k, v) { data[k] = String(v); } },
    renderPlanning: () => { renders++; }
});
vm.runInContext(src, context);
vm.runInContext(moteur, context);
function js(expr) { return vm.runInContext(expr, context); }
const when = '2027-11-20';
assert.equal(js("devoirsValider({matiere:'',date:'2027-11-20'},'devoirs').erreur"), 'Indique la matière.');
assert(js("devoirsValider({matiere:'Maths',date:'2027-02-30'},'devoirs').erreur"));
assert(js("devoirsValider({matiere:'Maths',date:'2027-11-20',debut:'13:00',fin:'12:00'},'devoirs').erreur"));
assert(js("devoirsValider({matiere:'Maths',date:'2027-11-20'},'examens').erreur"));
assert.equal(js("devoirsNormaliserApresMidi('12:00 am - 12:00 pm')"), '00:00 - 12:00');
assert.equal(js("devoirsNormaliserApresMidi('1:15 pm')"), '13:15');
const id = js("devoirsAjouter('devoirs',{matiere:'Maths',date:'2027-11-20',debut:'10:00',fin:'11:00',seances:3})");
assert(id, 'devoir créé');
assert.equal(js("devoirsChercherDoublon(devoirsLireStore(),'devoirs',{matiere:'maths',date:'2027-11-20'}).id"), id);
assert.equal(js(`devoirsModifier('devoirs',${JSON.stringify(id)},{matiere:'Mathématiques',date:'2027-11-21',debut:'12:00',fin:'13:00',seances:0})`), '');
const x = JSON.parse(data.studyPlanIB_devoirs).devoirs[0];
assert.equal(x.id, id, 'identifiant stable');
assert.equal(x.seances, 0, 'aucune séance explicite');
assert.equal(x.date, '2027-11-21');
assert.equal(js(`devoirsNombreSeances(devoirsLireStore().devoirs[0])`), 0);
assert.equal(js(`devoirsModifier('devoirs',${JSON.stringify(id)},{matiere:'',date:'2027-11-21'})`), 'Indique la matière.');
assert.equal(JSON.parse(data.studyPlanIB_devoirs).devoirs[0].matiere, 'Mathématiques');
const autre = js("devoirsAjouter('examens',{matiere:'Physique',date:'2027-11-21',debut:'12:30',fin:'13:30'})");
assert(autre);
assert.equal(js("devoirsConflits({date:'2027-11-21',debut:'12:45',fin:'13:00'}).length"), 2);
assert.equal(js(`devoirsConflits({date:'2027-11-21',debut:'12:45',fin:'13:00'},${JSON.stringify(id)}).length`), 1);
assert.equal(js("devoirsConflits({date:'2027-11-21',debut:'13:30',fin:'14:00'}).length"), 0);
assert(vue.includes('devoirsRecherche') && vue.includes('examensFiltre'));
assert(src.includes('devoirsEditer(genre, id)') && src.includes('devoirsModalClavier'));
assert(moteur.includes('Heure à confirmer'));
console.log('ok devoirs édition : identité et séances préservées, validation, doublons, conflits, dates et filtres');
