/* Vérifie l'analyse des questions de l'assistant, sans appel réseau. */
var fs = require('fs');
var vm = require('vm');

var echecs = 0;
function ok(cond, message) {
    if (cond) return;
    echecs += 1;
    console.error('échec:', message);
}

var memoire = {};
function stockage() {
    return {
        getItem: function (cle) { return Object.prototype.hasOwnProperty.call(memoire, cle) ? memoire[cle] : null; },
        setItem: function (cle, valeur) { memoire[cle] = String(valeur); },
        removeItem: function (cle) { delete memoire[cle]; }
    };
}
var sandbox = {
    console: console,
    Date: Date,
    Math: Math,
    JSON: JSON,
    Promise: Promise,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    localStorage: stockage(),
    sessionStorage: stockage(),
    document: {
        getElementById: function () { return null; },
        querySelector: function () { return null; },
        body: { appendChild: function () {} }
    },
    window: {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('js/pages/langue.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('js/pages/assistant.js', 'utf8'), sandbox);

function reponse(question) {
    return sandbox.iaRepondreLocal(question);
}
function lecture(question) {
    return sandbox.iaLireQuestion(question);
}

var tok = reponse("C'est quoi le TOK ?");
ok(tok.indexOf('théorie de la connaissance') !== -1, 'TOK défini : ' + tok);
ok(!/fabrique|pas cette réponse|je n'ai pas encore/i.test(tok), 'TOK sans refus : ' + tok);
ok(lecture("C'est quoi le TOK ?").intention === 'programme', 'TOK classé programme');
ok(lecture("C'est quoi le TOK ?").analyse.prioritaire, 'TOK analysé avant la réponse');

var cas = reponse('Est-ce que le CAS donne des points ?');
ok(/ne donne pas de points/.test(cas) && /Créativité/.test(cas), 'CAS expliqué : ' + cas);

var planning = reponse('Comment fonctionne le planning ?');
ok(/réveil/.test(planning) && /coucher/.test(planning), 'le planning est expliqué : ' + planning);
ok(planning.indexOf('Je ne vois rien de prévu') === -1, 'pas un emploi du temps vide : ' + planning);
ok(lecture('Comment fonctionne le planning ?').intention === 'question', 'expliquer le planning n\'est pas un dump');
ok(!sandbox.iaSlotOuvert(planning), 'l\'explication ne rouvre pas un créneau');

var ajout = reponse('Comment ajouter une activité ?');
ok(/17h00/.test(ajout) && /nom/.test(ajout), 'ajout expliqué : ' + ajout);
ok(lecture('Comment ajouter une activité ?').intention !== 'creneau', 'une question n\'ajoute pas une activité');
ok(lecture('Ajoute sport le mardi de 17h00 à 18h00').intention === 'creneau', 'un ajout réel reste une action');

var hl = reponse('Pourquoi commencer par les HL ?');
ok(/HL/.test(hl) && /révision/.test(hl), 'priorité HL expliquée : ' + hl);

var emploi = lecture("Qu'est-ce que j'ai aujourd'hui ?");
ok(emploi.intention === 'planning' && emploi.analyse.porteSurEmploi, 'la question d\'emploi reste un emploi');

var esquive = sandbox.iaReponseFinale(
    "C'est quoi le TOK ?",
    lecture("C'est quoi le TOK ?"),
    "Je n'ai pas cette réponse dans tes données, et je n'en fabrique pas une.",
    ''
);
ok(esquive.indexOf('théorie de la connaissance') !== -1, 'une esquive est remplacée : ' + esquive);

var corrige = sandbox.iaCorrigerFrancais("Tu n'as pas à le porter seul(e). C'est deja un probleme, malgré que tu avances.");
ok(corrige.indexOf('seul(e)') === -1, 'seul(e) corrigé');
ok(/déjà/.test(corrige) && /problème/.test(corrige), 'accents corrigés : ' + corrige);
ok(/bien que/.test(corrige), 'malgré que corrigé : ' + corrige);

var physique = reponse("C'est quoi la physique ?");
ok(/physique étudie/.test(physique), 'définition de physique : ' + physique);
ok(!/fabrique|pas cette réponse/i.test(physique), 'physique sans refus');

var dump = sandbox.iaReponseFinale(
    'Comment fonctionne le planning ?',
    lecture('Comment fonctionne le planning ?'),
    'Lundi 8h00 cours. Mardi 9h00 cours. Mercredi 10h00 cours.',
    ''
);
ok(/réveil/.test(dump), 'un dump d\'horaire ne remplace pas l\'explication : ' + dump);

var htmlAssistant = fs.readFileSync('pages/assistant.html', 'utf8');
ok(htmlAssistant.indexOf('id="iaJoindre"') !== -1 && htmlAssistant.indexOf('iaChoisirPdf()') !== -1, 'bouton PDF');
ok(htmlAssistant.indexOf('id="iaFichier"') !== -1, 'sélecteur de fichier');
ok(htmlAssistant.indexOf('Relire aussi la conjugaison avant d\'envoyer un message') !== -1, 'option conjugaison');
ok(sandbox.iaChoisirPdf.toString().indexOf('iaFichier') !== -1, 'le bouton ouvre le sélecteur');

var emploiPdf = 'Lundi\nMathématiques 08:00-09:00\nPhysique 09:00-10:00\nDevoir de chimie à rendre le 20 octobre';
var compris = sandbox.iaComprendrePdf('emploi.pdf', emploiPdf);
ok(compris.type === 'emploi' && compris.creneaux.length >= 1, 'le PDF est compris comme un emploi');
var lecturePdf = sandbox.iaMessageComprehension(compris);
ok(/Je comprends/.test(lecturePdf) && /ne place rien/.test(lecturePdf), 'la lecture attend les instructions : ' + lecturePdf);
ok(!/C'est placé|ajouté/.test(lecturePdf), 'aucune action avant l\'instruction');

sandbox.localStorage.setItem('ia-docs-toi', JSON.stringify([{ nom: 'emploi.pdf', texte: emploiPdf, quand: '2026-10-15' }]));
sandbox.window.__iaPdfAttente = { nom: 'emploi.pdf', question: '' };
var vague = sandbox.iaSuivreInstructionPdf('fais quelque chose avec ce pdf');
ok(/\?/.test(vague) && !/C'est placé/.test(vague), 'instruction vague : une question : ' + vague);
var clair = sandbox.iaLireInstructionPdf('place les cours du pdf', compris);
ok(clair.action === 'placer-creneaux', 'instruction claire : placer les cours');
var absent = sandbox.iaSuivreInstructionPdf('place le latin du pdf');
ok(/ne vois pas/.test(absent) && /latin/.test(absent), 'matière absente : une question : ' + absent);

var fautes = sandbox.iaErreursConjugaison('tu va a l ecole');
ok(fautes.some(function (err) { return err.type === 'conjugaison'; }), 'conjugaison signalée avant l\'envoi');
ok(!sandbox.iaErreursConjugaison('tu vas à l\'école').some(function (err) { return err.type === 'conjugaison'; }), 'une conjugaison juste passe');

if (echecs) {
    console.error(echecs + ' échec(s)');
    process.exit(1);
}
console.log('assistant: questions analysées, français corrigé');
