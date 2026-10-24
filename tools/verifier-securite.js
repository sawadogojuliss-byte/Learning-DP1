/* Vérifie que rien de privé ne revient dans le site ni dans le dépôt.

   Le lot 0 a retiré du site : le canal public ntfy, le coffre kvdb,
   l'archive jsonblob, le secret d'envoi des mails, les adresses des
   quatre admins, les emplois du temps et les profils dans data/.
   Ce contrôle empêche une régression silencieuse : si l'un de ces
   éléments réapparaît, le push passe en rouge. */
const fs = require('fs');
const path = require('path');

let echecs = 0;
function ok(cond, message) {
    if (cond) return;
    echecs += 1;
    console.error('échec:', message);
}

function lire(chemin) {
    try { return fs.readFileSync(chemin, 'utf8'); } catch (e) { return ''; }
}

function fichiers(dossier, ext) {
    let out = [];
    fs.readdirSync(dossier, { withFileTypes: true }).forEach(function (entree) {
        const chemin = path.join(dossier, entree.name);
        if (entree.isDirectory()) out = out.concat(fichiers(chemin, ext));
        else if (chemin.endsWith(ext)) out.push(chemin);
    });
    return out;
}

const site = fichiers('js', '.js').concat(fichiers('pages', '.html'), ['index.html']);

/* — Aucun identifiant privé dans le site — */
['sawadogojuliss@gmail.com', 'faridsere86@gmail.com', 'ashleytamini10@gmail.com', 'rayyanouedraogo87@gmail.com'].forEach(function (mail) {
    site.forEach(function (fichier) {
        ok(lire(fichier).indexOf(mail) === -1, 'adresse admin dans ' + fichier);
    });
});
site.forEach(function (fichier) {
    const texte = lire(fichier);
    ok(texte.indexOf('spib-') === -1, 'secret d’envoi dans ' + fichier);
    ok(texte.indexOf('ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b') === -1, 'canal public dans ' + fichier);
    /* Les vidéos de tutoriel sont publiques par nature : elles seules
       passent par un hébergeur public, sur un fil distinct de la boîte. */
    const videos = fichier === path.join('js', 'pages', 'tutoriel.js');
    if (!videos) ok(texte.indexOf('ntfy.sh') === -1, 'canal public ntfy dans ' + fichier);
    ok(texte.indexOf('kvdb.io') === -1, 'coffre kvdb dans ' + fichier);
    ok(texte.indexOf('jsonblob') === -1, 'archive jsonblob dans ' + fichier);
});

/* — Les données personnelles ne sont plus servies par le site — */
const comptes = JSON.parse(lire('data/comptes.json') || '{"comptes":[]}');
const emplois = JSON.parse(lire('data/emplois.json') || '{"emplois":[]}');
const rappels = JSON.parse(lire('data/rappels.json') || '{"groupes":[]}');
const retours = JSON.parse(lire('data/retours.json') || '{}');
ok(Array.isArray(comptes.comptes) && comptes.comptes.length === 0, 'des profils traînent dans data/comptes.json');
ok(Array.isArray(emplois.emplois) && emplois.emplois.length === 0, 'des emplois du temps traînent dans data/emplois.json');
ok(Array.isArray(rappels.groupes) && rappels.groupes.length === 0, 'des noms traînent dans data/rappels.json');
ok((retours.questions || []).length === 0 && (retours.feedbacks || []).length === 0 && (retours.reponses || []).length === 0, 'des messages traînent dans data/retours.json');
const config = JSON.parse(lire('data/boite-url.json') || '{}');
ok(!config.sujet, 'le nom du canal public est encore dans data/boite-url.json');

/* — Les règles Firestore font la serrure — */
const regles = lire('firestore.rules');
ok(/match \/boite\/\{message\} \{[\s\S]*?allow read: if estAdmin\(\);/.test(regles), 'la boîte privée est lisible par tous');
ok(/match \/boite\/\{message\} \{[\s\S]*?allow create: if messageValide\(\)/.test(regles), 'l’écriture de transition est fermée');
ok(/match \/boite\/\{message\} \{[\s\S]*?allow update, delete: if false;/.test(regles), 'un message peut être modifié ou effacé');
ok(/match \/publie\/\{message\} \{[\s\S]*?allow read: if true;/.test(regles), 'les annonces et tutoriels ne sont plus publics');
ok(/match \/config\/\{doc\} \{[\s\S]*?allow read: if estAdmin\(\);/.test(regles), 'la configuration privée est lisible par tous');
ok(regles.indexOf('request.auth.token.email_verified == true') !== -1, 'un compte non vérifié peut être admin');

['questions', 'feedbacks', 'emplois_du_temps', 'reponses', 'emplois', 'profils', 'connexions'].forEach(function (nom) {
    ok(regles.includes('match /' + nom + '/{message} {'), 'collection absente : ' + nom);
    const bloc = regles.split('match /' + nom + '/{message} {')[1] || '';
    ok(bloc.split('}')[0].includes('allow read: if estAdmin();'), 'collection lisible par tous : ' + nom);
});
ok(regles.includes("'ibstudyplan@gmail.com'"), 'le compte entreprise ne peut pas lire');
['emplois_du_temps', 'emplois'].forEach(function (nom) {
    const bloc = regles.split('match /' + nom + '/{message} {')[1] || '';
    ok(bloc.split('}')[0].includes('allow create: if false;'), 'la pause des emplois est levée pour ' + nom);
});
ok(!regles.split('match /boite/{message} {')[1].split('allow update')[0].includes("'emploi'"), 'l’archive peut recevoir de nouveaux emplois');

/* — Le site trie chaque message — */
const boite = lire('js/pages/boite.js');
ok(boite.indexOf("var BOITE_COLLECTION = 'boite';") !== -1, 'nom de la collection privée inattendu');
ok(boite.indexOf("var BOITE_PUBLIE = 'publie';") !== -1, 'nom de la collection publique inattendu');
ok(boite.indexOf('BOITE_COLLECTIONS[propre.type]') !== -1, 'les messages ne sont pas triés');
ok(boite.includes("emploi: 'emplois_du_temps'"), 'l’emploi du temps part ailleurs');
ok(boite.includes('var BOITE_EMPLOIS_SUSPENDUS = true;'), 'les nouveaux envois d’emplois ne sont pas suspendus');
ok(boite.includes('boiteEmploiAvecCreneaux(record)'), 'les emplois vides ne sont pas filtrés');
ok(!boite.includes('collection(BOITE_COLLECTION).add(propre)'), 'un envoi refusé retombe silencieusement dans l’archive');
ok(boite.indexOf('boiteNettoyerSession') !== -1, 'les copies admin ne sont pas nettoyées');
ok(boite.includes("'01_heure_envoi'") && boite.includes("'04_question'"), 'la fiche question Firebase a perdu son ordre');
ok(boite.indexOf('boiteSecretMail') !== -1, 'le secret d’envoi ne vient plus de la configuration privée');

/* — Les flux qui publiaient les données ont disparu — */
[['tools/sync-emplois.py', 'synchronisation publique des emplois du temps'],
 ['tools/creer-boite.py', 'création du coffre public'],
 ['.github/workflows/boite.yml', 'flux qui republiait les données'],
 ['.github/workflows/diagnostic-boite.yml', 'diagnostic du fil public']].forEach(function (paire) {
    ok(!fs.existsSync(paire[0]), paire[1] + ' est revenu (' + paire[0] + ')');
});

if (echecs) {
    console.error('échecs', echecs);
    process.exit(1);
}
console.log('ok aucun identifiant privé dans le site, données personnelles hors du dépôt, règles Firestore en place');
