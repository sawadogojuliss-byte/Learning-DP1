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

/* — Dans le site : les quatre adresses admins, et aucun nom admin — */
const ADMINS = ['sawadogojuliss@gmail.com', 'faridsere86@gmail.com', 'ashleytamini10@gmail.com', 'rayyanouedraogo87@gmail.com'];
const NOMS = ['Sawadogo Juliss Bill Owen', 'Sere Farid Abdourrahman', 'Sere Farid Abdourraham', 'Tamini Ashley Kania Harisoa', 'Ouedraogo Wendsom Rayyan', 'Ouedraogo Wendsom Ryyan'];
ADMINS.forEach(function (mail) {
    ok(lire('js/pages/boite.js').indexOf(mail) !== -1, 'adresse admin absente de la liste admin : ' + mail);
    site.forEach(function (fichier) {
        if (fichier === path.join('js', 'pages', 'boite.js') || fichier === path.join('js', 'pages', 'annonce.js')) return;
        ok(lire(fichier).indexOf(mail) === -1, 'adresse admin dans ' + fichier);
    });
});
site.forEach(function (fichier) {
    const bas = lire(fichier).toLowerCase();
    NOMS.forEach(function (nom) {
        ok(bas.indexOf(nom.toLowerCase()) === -1, 'nom admin écrit dans ' + fichier);
    });
});
const boiteSrc = lire('js/pages/boite.js');
ok(boiteSrc.indexOf('BOITE_ADMINS_NOM') === -1 && boiteSrc.indexOf('BOITE_ADMINS_SUB') === -1, 'ancienne liste admin par nom ou identifiant encore présente');
site.forEach(function (fichier) {
    const texte = lire(fichier);
    ok(texte.indexOf('spib-') === -1, 'secret d’envoi dans ' + fichier);
    ok(texte.indexOf('ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b') === -1, 'canal public dans ' + fichier);
    ok(texte.indexOf('ntfy.sh') === -1, 'canal public ntfy dans ' + fichier);
    ok(texte.indexOf('ibx-') === -1, 'fil public de vidéos dans ' + fichier);
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
const stockage = lire('storage.rules');
ok(stockage.indexOf('match /tutoriels/{fichier}') !== -1 && stockage.indexOf('allow update, delete: if false;') !== -1, 'les vidéos de tutoriel peuvent être écrasées ou effacées');
ok(ADMINS.every(function (mail) { return stockage.indexOf(mail) !== -1; }), 'storage.rules ne liste pas les quatre admins');
ok(/allow create: if request\.auth != null[\s\S]*email_verified == true[\s\S]*token\.email in/.test(stockage), 'l’envoi de vidéo ne vérifie pas le compte');
ok(lire('js/compte.js').indexOf('firebase-storage-compat.js') !== -1, 'le SDK Storage n’est pas chargé');
ok(lire('js/pages/tutoriel.js').indexOf('firebase.storage().ref(') !== -1, 'les vidéos ne partent pas vers Firebase Storage');

['questions', 'feedbacks', 'reponses', 'emplois', 'profils', 'connexions'].forEach(function (nom) {
    ok(regles.includes('match /' + nom + '/{message} {'), 'collection absente : ' + nom);
    const bloc = regles.split('match /' + nom + '/{message} {')[1] || '';
    ok(bloc.split('}')[0].includes('allow read: if estAdmin();'), 'collection lisible par tous : ' + nom);
});
ok(regles.includes("'ibstudyplan@gmail.com'"), 'le compte entreprise ne peut pas lire');
ok(regles.includes("ficheValide('question', '04_question')") && regles.includes("ficheValide('feedback', '04_feedback')"), 'le nouveau format des messages est refusé');
['questions', 'feedbacks'].forEach(function (nom) {
    const creation = regles.split('match /' + nom + '/{message} {')[1].split('allow update')[0];
    ok(creation.includes('allow create: if ficheValide(') && !creation.includes('messageValide()'),
        'un ancien onglet peut encore envoyer un ' + nom + ' à plat');
});
const archiveCreation = regles.split('match /boite/{message} {')[1].split('allow update')[0];
ok(!archiveCreation.includes("'question'") && !archiveCreation.includes("'feedback'"),
    'un ancien onglet peut encore archiver des questions/feedbacks à plat');
const emploiCreation = regles.split('match /emplois_du_temps/{message} {')[1] || '';
ok(emploiCreation.includes('allow get: if estAdmin() || (request.auth != null') &&
    emploiCreation.includes('allow list: if estAdmin() || (request.auth != null') &&
    emploiCreation.includes('request.query.limit <= 1') &&
    emploiCreation.includes('resource.data.z_donnees_techniques.firebaseUid == request.auth.uid') &&
    emploiCreation.includes('allow create: if emploiValide()') &&
    emploiCreation.includes('suppressions_emplois/$(message)'),
    'les emplois valides ne sont pas reçus uniquement par les admins');
ok(regles.includes('request.resource.data.z_donnees_techniques.firebaseUid == request.auth.uid') &&
    regles.includes('request.resource.data.z_donnees_techniques.jours.size() == 7'), 'identité ou semaine non vérifiée');
const reception = regles.split('match /receptions_emplois/{message} {')[1] || '';
ok(reception.includes('allow get: if true;') && reception.includes('allow list: if false;') &&
    reception.includes('!exists(') && reception.includes('existsAfter(') &&
    reception.includes('getAfter(') && reception.includes('allow update, delete: if false;'),
    'les accusés dévoilent des plannings ou peuvent être forgés sans écriture atomique');
ok((regles.split('match /emplois/{message} {')[1] || '').includes('allow create: if false;'), 'écriture dans l’ancienne collection rétablie');
ok(!regles.split('match /boite/{message} {')[1].split('allow update')[0].includes("'emploi'"), 'l’archive peut recevoir de nouveaux emplois');

/* — Le site trie chaque message — */
const boite = lire('js/pages/boite.js');
ok(boite.indexOf("var BOITE_COLLECTION = 'boite';") !== -1, 'nom de la collection privée inattendu');
ok(boite.indexOf("var BOITE_PUBLIE = 'publie';") !== -1, 'nom de la collection publique inattendu');
ok(boite.indexOf('BOITE_COLLECTIONS[propre.type]') !== -1, 'les messages ne sont pas triés');
ok(boite.includes("emploi: 'emplois_du_temps'"), 'l’emploi du temps part ailleurs');
ok(boite.includes('var BOITE_EMPLOIS_SUSPENDUS = false;'), 'la publication des emplois est suspendue');
ok(boite.includes('BOITE_EMPLOI_FILE') && boite.includes('boiteRetirerFile(record)'), 'une édition hors ligne peut se perdre');
ok(boite.includes('boiteEmploiAvecCreneaux(record)'), 'les emplois vides ne sont pas filtrés');
ok(!boite.includes('collection(BOITE_COLLECTION).add(propre)'), 'un envoi refusé retombe silencieusement dans l’archive');
ok(boite.indexOf('boiteNettoyerSession') !== -1, 'les copies admin ne sont pas nettoyées');
ok(boite.includes("'01_heure_envoi'") && boite.includes("'04_question'") && boite.includes("'04_feedback'"), 'les fiches Firebase ont perdu leur ordre');
ok(boite.includes("'z_donnees_techniques.at'"), 'les nouveaux messages ne sont plus relus');
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
