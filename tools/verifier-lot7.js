/* Import photo : jours explicites, samedi, conservation des anciens cours,
   validation atomique, conflit et annulation (sans vrai fichier personnel). */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const base = require('path').join(__dirname, '..');
const data = {};
const zone = { textContent: '', style: {} };
const elements = { emploiOcrStatut: zone, emploiErreurImport: { textContent: '' },
    emploiConflitsAccord: { checked: false }, emploiAnnulerLecture: { hidden: true } };
let selection = [];
let ecrits = 0;
const doc = { getElementById: id => elements[id] || null,
    querySelector: () => null, querySelectorAll: sel => sel === '.ep-remplacer:checked' ? selection : [],
    createElement: () => ({ style: {} }) };
const ctx = { console, document: doc, localStorage: {
    getItem: k => Object.hasOwn(data, k) ? data[k] : null,
    setItem: (k, v) => { data[k] = String(v); ecrits++; },
    removeItem: k => { delete data[k]; }
}, Math, Date };
ctx.window = ctx;
ctx.devoirsFamillesEleve = () => [{ nom: 'Maths AA' }, { nom: 'Physics' }, { nom: 'English B' }];
ctx.devoirsMatiereLigne = (t, fs) => fs.find(f => t.includes(f.nom.toLowerCase())) || null;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').join(base, 'js/pages/emploi-temps.js'), 'utf8'), ctx);
const texte = 'Lundi\nMaths AA\n08:00 - 09:00\nMardi 14\nPhysics\n10:00 - 11:00\nVendredi\nEnglish B\n11:00 - 12:00\nSamedi\nMaths AA\n08:00 - 09:00\nDimanche\nEnglish B\n09:00 - 10:00';
const res = ctx.emploiParseTexte(texte);
assert.deepStrictEqual(Array.from(res.jours, j => j.length), [1,1,0,0,1,1,1]);
assert.equal(res.jours[5][0].nom, 'Maths AA');
assert.equal(ctx.emploiParseTexte('Maths AA\n09:00 - 10:00\nMaths AA\n08:00 - 09:00\nMaths AA\n07:00 - 08:00\nMaths AA\n06:00 - 07:00\nMaths AA\n05:00 - 06:00\nMaths AA\n04:00 - 05:00\nMaths AA\n03:00 - 04:00').jours.flat().length, 0, 'sans en-têtes de jour, ne pas inventer le lundi ou le dimanche');
ctx.emploiScolaireEcrire({at:'ancien',jours:[[{id:'old',nom:'Maths AA',debut:'08:00',fin:'09:00',src:'doc'},
    {id:'man',nom:'Sport',debut:'14:00',fin:'15:00',src:'manuel'}],[],[],[],[],[],[]]});
ctx.emploiImportBrut = ctx.localStorage.getItem(ctx.EMPLOI_CLE);
ctx.emploiPropositions = [{cle:'ep0',jour:1,nom:'Physics',debut:'10:00',fin:'11:00'}];
ctx.emploiConfirmerPropositions();
assert.equal(ctx.emploiScolaireJour(0).length, 2, 'ancien import et cours manuel préservés');
const nouveau = ctx.emploiScolaireJour(1)[0];
assert.match(nouveau.importId, /^doc:/);
assert.equal(nouveau.src,'doc');
ctx.emploiImportBrut = ctx.localStorage.getItem(ctx.EMPLOI_CLE);
ctx.emploiPropositions = [{cle:'ep0',jour:0,nom:'English B',debut:'08:30',fin:'09:30'}];
const avant = ecrits;
ctx.emploiConfirmerPropositions();
assert.equal(ecrits, avant, 'conflit non accepté : aucune écriture');
assert.match(elements.emploiErreurImport.textContent,/conflit/i);
elements.emploiConflitsAccord.checked = true;
ctx.emploiConfirmerPropositions();
assert.equal(ctx.emploiScolaireJour(0).length,3,'un conflit choisi conserve aussi les anciens cours');
assert.equal(ctx.emploiScolaireJour(0)[1].parallele,true);
ctx.emploiImportBrut = ctx.localStorage.getItem(ctx.EMPLOI_CLE);
ctx.emploiPropositions = [{cle:'ep0',jour:5,nom:'Maths AA',debut:'09:00',fin:'10:00'}];
selection = [{value:'old'}];
elements.emploiConflitsAccord.checked = false;
ctx.emploiConfirmerPropositions();
assert(!ctx.emploiScolaireJour(0).some(c=>c.id==='old'), 'seul le cours explicitement coché est retiré');
assert(ctx.emploiScolaireJour(0).some(c=>c.id==='man'), 'le cours manuel ne peut pas être effacé par import');
const avantInvalide=ecrits;
ctx.emploiImportBrut = ctx.localStorage.getItem(ctx.EMPLOI_CLE);
ctx.emploiPropositions = [{cle:'ep0',jour:5,nom:'Maths AA',debut:'10:00',fin:'08:00'}];
ctx.emploiConfirmerPropositions();
assert.equal(ecrits,avantInvalide,'horaire invalide : pas de sauvegarde');
ctx.emploiOcrEnCours=true;const num=ctx.emploiLectureNumero;
ctx.emploiAnnulerLecture();
assert(ctx.emploiLectureNumero>num && !ctx.emploiOcrEnCours && elements.emploiAnnulerLecture.hidden);
console.log('ok lot 7 : jours explicites et dimanche, jours absents refusés, anciens préservés, remplacement choisi, conflit et annulation');
