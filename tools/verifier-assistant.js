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
// L'option visible a disparu : la relecture est silencieuse.
ok(htmlAssistant.indexOf('Relire aussi la conjugaison') === -1, 'l\'option visible doit disparaître');
ok(htmlAssistant.indexOf('iaConjugaison') === -1, 'la case conjugaison doit disparaître');
ok(htmlAssistant.indexOf('iaRelecture') === -1, 'le panneau de relecture doit disparaître');
var sourceAssistant = fs.readFileSync('js/pages/assistant.js', 'utf8');
ok(sourceAssistant.indexOf('Corrige la conjugaison avant l\'envoi') === -1, 'aucun message ne doit prévenir l\'utilisateur');
ok(sourceAssistant.indexOf('Envoyer quand même') === -1, 'plus de bouton de relecture');
ok(sourceAssistant.indexOf('function iaQuestionPropre') !== -1, 'la question n\'est plus corrigée en silence');
ok(sourceAssistant.indexOf('var questionPropre = iaQuestionPropre(texte);') !== -1, 'la correction silencieuse n\'est pas branchée');
ok(sourceAssistant.indexOf('iaMontrerRelecture') === -1, 'plus aucun panneau de relecture dans le code');
ok(sourceAssistant.indexOf('var lecture = iaLireQuestion(questionPropre);') !== -1, 'l\'analyse doit utiliser la question corrigée');
ok(sourceAssistant.indexOf('return iaCorrigerFrancais(corps);') !== -1, 'les réponses doivent toujours être relues');
ok(sandbox.iaConjugaisonActive() === true, 'la relecture doit être active sans le dire');
var questionCorrigee = sandbox.iaQuestionPropre('tu va a l ecole demain');
ok(questionCorrigee.indexOf('vas') !== -1, 'la conjugaison de la question doit être corrigée en silence : ' + questionCorrigee);
var participe = sandbox.iaQuestionPropre('nous avons manger hier');
ok(participe.indexOf('mangé') !== -1, 'le participe passé doit être corrigé en silence : ' + participe);
var reponseRelue = sandbox.iaCorrigerFrancais('tu va a l ecole');
ok(reponseRelue.indexOf('vas') !== -1, 'la réponse doit être relue : ' + reponseRelue);
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
ok(fautes.some(function (err) { return err.type === 'conjugaison'; }), 'la conjugaison doit rester vérifiée en interne');
ok(!sandbox.iaErreursConjugaison('tu vas à l\'école').some(function (err) { return err.type === 'conjugaison'; }), 'une conjugaison juste passe');


/* ── Analyse réelle des documents ─────────────────────────────────── */
var docEssai = {
    nom: 'semaine-12.pdf',
    quand: '2026-10-15',
    texte: [
        '— page 1 —',
        'Lundi | 16h25-17h25 | Révisions Mathématiques | Chapitre 4 : suites',
        'Consigne du professeur : apporter la blouse et le carnet pour le TP.',
        'À rendre : DM de Mathématiques pour le 20/10/2026 (exercices 12 à 18)',
        '— page 2 —',
        'Évaluation d Anglais prévue le 27/10/2026 : commentaire de texte.',
        'La bibliothèque du campus ferme à 18h00 le vendredi.'
    ].join('\n')
};
sandbox.__doc = docEssai;
sandbox.iaDocs = function () { return [sandbox.__doc]; };
vm.runInContext('iaDocs = function () { return [__doc]; };', sandbox);

ok(typeof sandbox.iaIndexDoc === 'function', 'l\'index du document manque');
var index = sandbox.iaIndexDoc(docEssai);
ok(index && index.passages.length >= 5, 'le document doit être découpé en passages');
ok(index.dates.indexOf('20/10/2026') !== -1 && index.dates.indexOf('27/10/2026') !== -1, 'les dates du document doivent être repérées');
ok(index.heures.indexOf('18h00') !== -1, 'les heures du document doivent être repérées');
ok(index.heures.indexOf('4:') === -1, 'un numéro de chapitre ne doit pas passer pour une heure');
ok(index.jours.indexOf('lundi') !== -1, 'les jours écrits doivent être repérés');

var rendu = sandbox.iaReponseDoc('Qu\'est-ce que je dois rendre en maths ?', docEssai);
ok(rendu.force === 'fort' && /20\/10\/2026/.test(rendu.reponse), 'la question « rendre en maths » doit trouver la ligne du DM : ' + rendu.reponse);
var anglais = sandbox.iaReponseDoc('Quand est l\'évaluation d\'anglais ?', docEssai);
ok(/27\/10\/2026/.test(anglais.reponse), '« évaluation » doit être relié au mot du document : ' + anglais.reponse);
var biblio = sandbox.iaReponseDoc('À quelle heure ferme la bibliothèque ?', docEssai);
ok(/18h00/.test(biblio.reponse) && /page 2/.test(biblio.reponse), 'la page doit être citée : ' + biblio.reponse);
var absent = sandbox.iaReponseDoc('Parle-moi de la biologie cellulaire', docEssai);
ok(absent.force !== 'fort', 'une question hors document doit passer au modèle, pas un refus sec');
ok(!/je ne trouve rien/i.test(absent.reponse), 'plus de « je ne trouve rien » automatique');
var repli = sandbox.iaRepliDoc('Combien de pages ?', docEssai);
ok(/20\/10\/2026/.test(repli) && /Le document contient/.test(repli), 'le repli doit citer le document : ' + repli);
ok(typeof sandbox.iaBlocDocQuestion === 'function' && typeof sandbox.iaConsigneDoc === 'function', 'le document doit être transmis au modèle');
ok(typeof sandbox.iaSyntheseDoc === 'function' && typeof sandbox.iaResumeDocLie === 'function', 'la synthèse du document manque');

/* ── Toute question est analysée avant la réponse ─────────────────── */
ok(sourceAssistant.indexOf("lecture.analyse.prioritaire && lecture.analyse.reponse && lecture.intention") === -1,
    'plus de réponse locale servie à la place du modèle');
ok(sourceAssistant.indexOf("if (analyseDoc.force === 'fort' && analyseDoc.reponse) {") === -1,
    'le document doit être analysé puis confié au modèle, pas répondre à sa place');
ok(sourceAssistant.indexOf('else if (analyse && analyse.prioritaire && sure) corps = sure;') === -1,
    'la réponse du modèle ne doit plus être écrasée par la réponse sûre');
ok(sourceAssistant.indexOf('if (window.__iaDocQuestion) iaRetirerInvitation();') !== -1,
    'l\'invitation doit disparaître quand la réponse arrive');
ok(sourceAssistant.indexOf("if (analyseDoc.force === 'fort' && analyseDoc.reponse) return analyseDoc.reponse;") !== -1,
    'la meilleure analyse locale doit rester le repli');

/* Le modèle répond avec ses mots quand sa réponse tient debout… */
var libre = sandbox.iaReponseFinale(
    "C'est quoi le TOK ?",
    lecture("C'est quoi le TOK ?"),
    "Le TOK, c'est la théorie de la connaissance : on y réfléchit à comment on sait ce qu'on sait. Tu le suis cette année ?",
    ''
);
ok(/comment on sait ce qu'on sait/.test(libre), 'la réponse du modèle doit être gardée : ' + libre);
/* …et la réponse sûre reprend la main quand il esquive ou déballe un horaire. */
var esquive2 = sandbox.iaReponseFinale(
    "C'est quoi le CAS ?",
    lecture("C'est quoi le CAS ?"),
    "Je n'ai pas cette réponse dans tes données.",
    ''
);
ok(/Créativité/.test(esquive2), 'une esquive reste remplacée par la réponse sûre : ' + esquive2);

/* Le ton : un ami du même âge, jamais un professeur. */
ok(sourceAssistant.indexOf("importe quelle question") !== -1, 'toute question doit être prise en compte');
ok(sourceAssistant.indexOf("Tu n\\'es pas un professeur") !== -1, 'le ton ne doit pas etre celui d un professeur');
ok(sourceAssistant.indexOf("sans jugement") !== -1, 'le ton amical doit rester');
ok(sourceAssistant.indexOf("montres jamais que tu en sais plus") !== -1, 'l\'assistant ne doit pas paraître plus savant');

/* ── Assistant intelligent : jamais de phrase de robot ─────────────── */
ok(sourceAssistant.indexOf('Pose la question en une phrase') === -1, 'plus de demande de reformuler');
ok(sourceAssistant.indexOf('avec le mot précis') === -1, 'plus de demande de mot précis');
ok(typeof sandbox.iaReponseIntelligente === 'function', 'le repli intelligent manque');
ok(typeof sandbox.iaSuiteUtile === 'function', 'la question de suite manque');
ok(typeof sandbox.iaMessagesCourts === 'function', 'le prompt court de secours manque');
ok(sandbox.IA_DESTINATIONS.length >= 3 && sandbox.IA_DESTINATIONS.some(function (d) {
    return /pollinations/.test(d.url) && /openai/.test(d.nom);
}), 'il faut plusieurs services réellement différents');
ok(sandbox.IA_DESTINATIONS.some(function (d) { return /llm7/.test(d.url); }), 'le second service doit rester en secours');
ok(sourceAssistant.indexOf('iaMessagesCourts(messages)') !== -1, 'le second essai avec prompt court manque');

var intelligentes = [
    'Comment je révise les maths ?',
    'Combien de points je peux avoir au maximum ?',
    'Explique-moi le CAS',
    'Comment mieux me concentrer ?',
    'Je n’arrive pas à mémoriser mes leçons',
    'Je comprends rien au cours de physique',
    'Tu penses quoi des évaluations internes ?',
    'Aide-moi'
];
intelligentes.forEach(function (q) {
    var r = sandbox.iaRepondreLocal(q) || '';
    ok(r.length >= 45, 'réponse trop courte pour « ' + q + ' » : ' + r);
    ok(!/reformule|pose la question en une phrase|dis-le autrement/i.test(r), 'phrase de robot : ' + r);
    ok((r.match(/\?/g) || []).length <= 1, 'une seule question de suite maximum : ' + r);
});

/* La question du soir ne se colle jamais à une réponse de repli. */
var soir = sandbox.iaReponseFinale('Aide-moi', sandbox.iaLireQuestion('Aide-moi'), '', '');
ok(!/comment s.est passee ta journee/i.test(sandbox.iaNormaliser(soir)),
    'pas de question du soir après un repli : ' + soir);

/* Ponctuation française : espace avant ? ! ; et deux-points, heures et liens intacts. */
var ponct = sandbox.iaCorrigerFrancais('Tu vas bien? Oui: très bien. Cours à 16:25, site https://studyplanib.com');
ok(ponct.indexOf('bien ?') !== -1 && ponct.indexOf('Oui :') !== -1, 'espace avant ? et : : ' + ponct);
ok(ponct.indexOf('16:25') !== -1 && ponct.indexOf('https://studyplanib.com') !== -1,
    'les heures et les liens doivent rester intacts : ' + ponct);
ok(sandbox.iaCorrigerFrancais('Alors voilà !! Pourquoi ?').indexOf('voilà ! Pourquoi ?') !== -1,
    'les ! répétés doivent être ramenés à un seul');

/* Le prompt court doit vraiment raccourcir la demande. */
var longSysteme = 'Tu es l ami proche de quelqu un.' + String.fromCharCode(10) + Array(201).join('Regle interne tres longue.' + String.fromCharCode(10));
var courts = sandbox.iaMessagesCourts([
    { role: 'system', content: longSysteme },
    { role: 'user', content: 'Ma question' }
]);
ok(JSON.stringify(courts).length < JSON.stringify([{ role: 'system', content: longSysteme }]).length / 2,
    'le prompt court doit être au moins deux fois plus court');
ok(JSON.stringify(courts).indexOf('Ma question') !== -1, 'la question doit rester');

/* Le programme et la méthode sont connus sans le modèle. */
[['le TOK', /théorie de la connaissance/], ['le CAS', /Créativité/], ['les évaluations internes', /aucune ne passe avant une autre/i],
 ['le mémoire', /3 points/], ['le maximum de points', /45/]].forEach(function (paire) {
    var r = sandbox.iaRepondreLocal("C'est quoi " + paire[0] + ' ?');
    ok(paire[1].test(r), 'réponse locale manquante pour ' + paire[0] + ' : ' + r);
});

/* ── Trajet réel d'une question vers la réponse ────────────────────── */
/* Chaque destination a son propre budget : un service lent ne mange plus le
   temps des autres, et le minuteur est libéré quand la requête se termine. */
ok(typeof sandbox.iaDemander === 'function', 'la demande par destination manque');
ok(typeof sandbox.iaFermerBudget === 'function', 'la libération du budget manque');
ok(sourceAssistant.indexOf('iaFermerBudget(ctrl)') !== -1, 'le budget doit être libéré après la requête');
ok(sandbox.IA_DESTINATIONS.every(function (d) { return d.delai >= 3000 && d.delai <= 12000; }),
    'chaque destination doit avoir son délai propre');
ok(sourceAssistant.indexOf('Date.now() + 20000') !== -1, 'il faut un délai global : ' + 'au-delà, on répond');
ok(sourceAssistant.indexOf('reste() < 2000') !== -1, 'on ne doit plus lancer un essai sans temps restant');
/* Le secours par URL simple passe tôt : c'est une lecture, sans contrôle CORS. */
ok(sourceAssistant.indexOf('IA_DESTINATIONS[0], stream: true') !== -1 && sourceAssistant.indexOf('IA_SECOURS, stream: false') !== -1,
    'la lecture simple doit être tentée tôt');
/* Sans clé, aucun en-tête Authorization : la requête reste simple. */
ok(sourceAssistant.indexOf("if (cle) headers.Authorization") !== -1, 'en-tête Authorization seulement s\'il y a une clé');

/* Le secours ne met plus 7 000 caractères dans une adresse. */
var grosSysteme = Array(400).join('Phrase de regle interne tres longue a envoyer au modele.' + String.fromCharCode(10));
var promptSecours = sandbox.iaPromptSecours([
    { role: 'system', content: grosSysteme + 'Emploi du temps de cette personne seulement : lundi rien.' },
    { role: 'user', content: 'Comment je révise les maths ?' }
]);
ok(promptSecours.length <= 1100, 'le secours doit rester court : ' + promptSecours.length);
ok(promptSecours.indexOf('Comment je révise les maths ?') !== -1, 'la question doit rester dans le secours');
ok(sourceAssistant.indexOf("encodeURIComponent(prompt)") !== -1, 'le secours doit encoder son adresse');

/* Une réponse du modèle qui donne des horaires n'est plus jetée. */
var horaires = "Commence par bloquer ton sommeil. Ensuite place tes révisions en séances de 45 minutes : une avant les cours de 7h50, une après le trajet vers 17h05, et une dernière à 19h00. Garde le dimanche après-midi libre.";
var gardee = sandbox.iaReponseFinale('comment je m organise pour les revisions ?', lecture('comment je m organise pour les revisions ?'), horaires, '');
ok(/7h50/.test(gardee) || /17h05/.test(gardee), 'une réponse utile avec horaires doit être gardée : ' + gardee);
ok(sandbox.iaSansDeversement('lundi : 7h50 cours, 8h45 maths, 10h00 physique, 12h00 repas, 13h00 anglais\nRévise le soir.') .indexOf('Révise le soir.') !== -1,
    'l\'emploi du temps recopié doit sortir, le reste rester');
ok(sandbox.iaSansDeversement('lundi : 7h50 cours, 8h45 maths, 10h00 physique, 12h00 repas, 13h00 anglais').indexOf('7h50') === -1,
    'une ligne d\'emploi du temps recopié doit être retirée');

/* Aucun balisage Markdown dans les bulles. */
ok(sandbox.iaNettoyer('**Semaine type**\n- Lundi : maths\n## À retenir\nDu texte.').indexOf('**') === -1,
    'le gras Markdown doit disparaître');
ok(sandbox.iaNettoyer('**Semaine type**\n- Lundi : maths').indexOf('Semaine type') !== -1, 'le texte doit rester');
ok(sandbox.iaNettoyer('## À retenir').indexOf('##') === -1, 'les titres Markdown doivent disparaître');

/* Une question courte peut recevoir trois phrases utiles. */
var troisPhrases = 'Première phrase utile. Deuxième phrase utile. Troisième phrase utile.';
ok(sandbox.iaAjusterLongueur(troisPhrases, lecture('je comprends rien au cours de physique')) === troisPhrases,
    'une réponse de trois phrases ne doit plus être coupée');

/* Les variables des autres fichiers ne font plus échouer la demande. */
ok(typeof sandbox.iaGlobal === 'function', 'la lecture prudente des globales manque');
ok(sandbox.iaGlobal('ibYear', 'non précisée') === 'non précisée', 'une globale absente doit donner le défaut');
sandbox.ibYear = 'DP2';
ok(sandbox.iaGlobal('ibYear', 'non précisée') === 'DP2', 'une globale présente doit être lue');
delete sandbox.ibYear;
var dossier = '';
try { dossier = sandbox.iaDossier(); } catch (e) { dossier = 'erreur : ' + e.message; }
ok(dossier && dossier.indexOf('erreur') !== 0, 'le dossier doit se construire sans les autres fichiers : ' + dossier.slice(0, 60));
var messagesOk = '';
try {
    messagesOk = JSON.stringify(sandbox.iaMessages('Comment je révise les maths ?', '', null));
} catch (e2) { messagesOk = 'erreur : ' + e2.message; }
ok(messagesOk.indexOf('erreur') !== 0, 'le message au modèle doit se construire même sans les autres fichiers');

/* ── Une vraie question de cours reçoit une vraie réponse ──────────── */
[
    ['explique moi le cycle de l eau', /evapore|condense|pluie/],
    ['c est quoi la photosynthese', /chlorophylle|glucose/],
    ['explique moi la mitose', /chromosomes|cellules filles/],
    ['comment on calcule une derivee', /pente|taux/],
    ['c est quoi le pH', /acide|base/],
    ['explique moi la loi de Newton', /force|action/],
    ['c est quoi la relativite', /lumiere|espace.temps/],
    ['explique moi le theoreme de Pythagore', /hypoténuse|hypotenuse/],
    ['c est quoi une probabilite', /0 et 1|favorables/],
    ['c est quoi l inflation', /prix/],
    ['explique moi la guerre froide', /URSS/]
].forEach(function (paire) {
    var r = sandbox.iaRepondreLocal(paire[0]) || '';
    ok(paire[1].test(r), 'réponse de cours manquante pour « ' + paire[0] + ' » : ' + r);
    ok(!/pas encore ce fait|en dire un peu plus/i.test(r), 'aucune dérobade attendue pour « ' + paire[0] + ' » : ' + r);
});

/* Une méthode demandée n'est pas remplacée par la définition de la matière. */
var anglais = sandbox.iaRepondreLocal('comment ameliorer mon anglais ?') || '';
ok(/regul|quinze minutes|oral/i.test(anglais), 'méthode attendue pour l\'anglais : ' + anglais);
ok(!/langue vivante du diplome/i.test(sandbox.iaNormaliser(anglais)), 'la définition de l\'anglais ne doit pas répondre ici');

/* ── Les matières et les notes viennent du vrai dossier ────────────── */
sandbox.subjects = [{ name: 'Mathématiques AA', level: 'HL', grade: 5 }, { name: 'Physique', level: 'HL', grade: 4 }];
ok(sandbox.iaMatieres().length === 2, 'les matières du site doivent être lues : ' + sandbox.iaMatieres().length);
ok(sandbox.iaNotesMatieres().length === 2, 'les notes sur 7 doivent être lues');
var moy = sandbox.iaRepondreLocal('quelle est ma moyenne ?') || '';
ok(/4,5\/7/.test(moy), 'la moyenne doit être calculée : ' + moy);
ok(!/pas encore ce fait/i.test(moy), 'jamais de dérobade sur la moyenne : ' + moy);
var matiere = sandbox.iaRepondreLocal("C'est quoi la physique ?") || '';
ok(/Mathématiques AA|dossier/i.test(matiere) || /physique étudie/.test(matiere), 'la matière du dossier doit ressortir : ' + matiere);
delete sandbox.subjects;

/* ── Un travail à rendre : on demande le document, on ne parle pas du planning ── */
var devoir = sandbox.iaRepondreLocal('je dois rendre un devoir de maths') || '';
ok(/document/i.test(devoir), 'il faut demander le document : ' + devoir);
ok(!/pas encore ce fait|aucun evenement|rien de prevu/i.test(sandbox.iaNormaliser(devoir)), 'pas de réponse sur le planning ici : ' + devoir);

/* ── La relecture ne casse plus le français : « à » reste une préposition ── */
var infinitifs = sandbox.iaCorrigerFrancais('Il te reste à écrire deux phrases, puis à réviser ton chapitre.');
ok(/à écrire/.test(infinitifs) && /à réviser/.test(infinitifs), 'un infinitif après « à » doit rester un infinitif : ' + infinitifs);
ok(/a mangé/.test(sandbox.iaCorrigerFrancais('Elle a mangé ce matin.')), 'le vrai auxiliaire doit rester un auxiliaire');
if (typeof sandbox.langueLocale === 'function') {
    var fausses = sandbox.langueLocale('Prends le temps à réviser chaque chapitre.').filter(function (e) { return e.type === 'conjugaison'; });
    ok(fausses.length === 0, 'la relecture signale une faute qui n\'en est pas une : ' + JSON.stringify(fausses));
}

if (echecs) {
    console.error(echecs + ' échec(s)');
    process.exit(1);
}
console.log('assistant: questions analysées, français corrigé (' + echecs + ' échec)');
