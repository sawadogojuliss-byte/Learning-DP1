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

if (echecs) {
    console.error(echecs + ' échec(s)');
    process.exit(1);
}
console.log('assistant: questions analysées, français corrigé');
