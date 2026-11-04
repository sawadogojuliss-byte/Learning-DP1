/* Régression de la copie privée des emplois. Tout est simulé en mémoire :
   aucun profil ni document de test n'est écrit dans Firestore réel. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/pages/boite.js', 'utf8');
assert.match(fs.readFileSync('js/pages/emploi-temps.js', 'utf8'), /function emploiScolaireEcrire[\s\S]*?boiteApresMemoire/, 'édition des cours non publiée');
assert.match(fs.readFileSync('js/pages/planning-moteur.js', 'utf8'), /function v3Save[\s\S]*?boiteApresMemoire/, 'édition du planning non publiée');
assert.match(fs.readFileSync('js/pages/emploi-temps.js', 'utf8'), /function showEmploiPage\([\s\S]*?boiteVerifierReceptionEmploi\(\)/, 'la page ne vérifie pas sa réception backend');
const donnees = {};
const documents = [];
let bloque = false;
let utilisateur = null;
let gardeEnCours = null;
let lectureEmploisRefusee = false;
let reglesReceptionActives = true;
let heure = Date.parse('2026-10-24T09:00:00.000Z');
class Horloge extends Date { constructor(...args) { super(...(args.length ? args : [heure])); } static now() { return heure; } }
const storage = {
    getItem(cle) { return Object.hasOwn(donnees, cle) ? donnees[cle] : null; },
    setItem(cle, value) { donnees[cle] = String(value); },
    removeItem(cle) { delete donnees[cle]; }
};
const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
function semaine(titre) {
    return jours.map((j, i) => ({ j, s: i === 0 ? [{ d: '08:00', f: '09:00', t: titre }] : [] }));
}
function fiche(nom, appareil, at, titre) {
    return { type: 'emploi', id: 'e_' + appareil, appareil, at, nom, classe: 'DP1',
        jours: semaine(titre), schema: 2, complet: 1, google: '', googleSub: '', email: '', matieres: ['Mathématiques'] };
}
const receptions = new Map();
let docNumero = 0;
const collections = { emplois_du_temps: documents };
const firebase = {
    auth() { return { currentUser: utilisateur, onAuthStateChanged(fn) { fn(utilisateur); } }; },
    firestore() { return {
        batch() {
            const ecritures = [];
            return { set(ref, data) { ecritures.push({ ref, data }); },
                commit() {
                    if (bloque) return Promise.reject(new Error('permission-denied'));
                    if (!reglesReceptionActives) return Promise.reject({ code: 'permission-denied' });
                    const terminer = () => {
                        for (const { ref, data } of ecritures) {
                            if (ref.nom === 'receptions_emplois') receptions.set(ref.id, JSON.parse(JSON.stringify(data)));
                            else (collections[ref.nom] || (collections[ref.nom] = [])).push(JSON.parse(JSON.stringify(data)));
                        }
                    };
                    if (gardeEnCours) return gardeEnCours().then(terminer);
                    terminer();
                    return Promise.resolve();
                } };
        },
        collection(nom) {
            const liste = collections[nom] || (collections[nom] = []);
            let champ = 'at', depuis = '', limite = 400, direction = 'desc', apres = null;
            return {
                doc(id) {
                    const ref = { nom, id: id || 'aleatoire' + (++docNumero) };
                    /* Sous-collection (historique de synchronisation) : écriture acceptée, non relue ici. */
                    ref.collection = () => ({ doc: () => ({ nom: nom + '/historique', id: 'h' + (++docNumero) }) });
                    ref.get = () => {
                        if (bloque || (nom === 'receptions_emplois' && lectureEmploisRefusee)) return Promise.reject({ code: 'permission-denied' });
                        return Promise.resolve({ exists: receptions.has(ref.id), data: () => receptions.get(ref.id) });
                    };
                    return ref;
                },
                add(doc) {
                    if (bloque) return Promise.reject(new Error('permission-denied'));
                    if (gardeEnCours) return gardeEnCours().then(() => { liste.push(JSON.parse(JSON.stringify(doc))); });
                    liste.push(JSON.parse(JSON.stringify(doc)));
                    return Promise.resolve({ id: 'doc' + liste.length });
                },
                where(key, op, value) { champ = key; depuis = value; return this; },
                orderBy(key, ordre) { champ = key; direction = ordre; return this; },
                limit(n) { limite = n; return this; },
                startAfter(doc) { apres = doc; return this; },
                get() {
                    if (nom === 'emplois_du_temps' && lectureEmploisRefusee) return Promise.reject({ code: 'permission-denied' });
                    if (nom === 'emplois_du_temps' && champ === 'z_donnees_techniques.firebaseUid' &&
                        (!utilisateur || utilisateur.uid !== depuis || limite !== 1)) return Promise.reject({ code: 'permission-denied' });
                    function date(doc) {
                        if (champ === 'z_donnees_techniques.firebaseUid') return doc.z_donnees_techniques && doc.z_donnees_techniques.firebaseUid;
                        return champ === 'at' ? doc.at : doc.z_donnees_techniques && doc.z_donnees_techniques.at;
                    }
                    let docs = liste.map((data, i) => ({ id: nom + i, data() { return data; } }))
                        .filter((doc) => date(doc.data()) && (!depuis || (champ === 'z_donnees_techniques.firebaseUid'
                            ? date(doc.data()) === depuis : date(doc.data()) > depuis)))
                        .sort((a, b) => direction === 'asc'
                            ? date(a.data()).localeCompare(date(b.data())) : date(b.data()).localeCompare(date(a.data())));
                    if (apres) docs = docs.slice(docs.findIndex((doc) => doc.id === apres.id) + 1);
                    docs = docs.slice(0, limite);
                    return Promise.resolve({ docs, empty: docs.length === 0, forEach(fn) { docs.forEach(fn); } });
                }
            };
        }
    }; }
};
firebase.firestore.FieldValue = { serverTimestamp: () => "horodatage" };
const context = { console, Promise, Date: Horloge, JSON, Math, Object, Array, String, Number,
    setTimeout, clearTimeout, setInterval() { return 0; }, localStorage: storage, firebase,
    compteChargerFirebase() { return Promise.resolve(firebase); },
    document: { getElementById() { return null; }, addEventListener() {} } };
context.window = context;
vm.createContext(context);
vm.runInContext(source, context);

(async () => {
    context.userName = 'Camille';
    context.generateDayEvents = (i) => i === 3 ? (() => { throw new Error('jour indisponible'); })() : [{ title: 'Maths', startTime: '08:00', endTime: '09:00' }];
    assert.equal(context.boiteSnapshotEmploi(), null, 'une journée en erreur devient silencieusement vide');
    context.generateDayEvents = () => [{ title: 'Maths', startTime: '08:00', endTime: '09:00' }];
    assert.equal(context.boiteSnapshotEmploi().jours.length, 7, 'la semaine générée est incomplète');
    const a = fiche('Camille', 'a', '2026-10-24T08:00:00.000Z', 'Ancien cours');
    const b = fiche('Camille', 'b', '2026-10-24T08:01:00.000Z', 'Cours différent');
    assert.equal(context.boiteFusionnerPersonnes([a, b]).length, 2, 'les homonymes sont distincts');
    const partiel = { ...a, at: '2026-10-24T09:00:00.000Z', jours: [a.jours[0]], complet: 1 };
    assert.equal(context.boiteFusionnerPersonnes([a, partiel])[0].jours.length, 7, 'une fiche partielle efface la semaine');
    const change = fiche('Camille', 'a', '2026-10-24T10:00:00.000Z', 'Nouveau cours');
    assert.equal(context.boiteFusionnerPersonnes([a, change])[0].jours[0].s[0].t, 'Nouveau cours', 'édition ignorée');
    const efface = { ...change, at: '2026-10-24T10:01:00.000Z', jours: semaine('') };
    efface.jours[0].s = [];
    assert.equal(context.boiteFusionnerPersonnes([a, efface])[0].jours[0].s.length, 0, 'un retrait volontaire réapparaît');
    const messages = Array.from({ length: 121 }, (_, n) => ({ type: 'question', id: 'q' + n,
        at: `2026-10-24T09:${String(n % 60).padStart(2, '0')}:00Z`, nom: 'Élève ' + n,
        email: 'eleve' + n + '@example.org' }));
    assert.equal(context.boitePersonnes(context.boiteFusionner(messages)).length, 121, 'les anciens profils sans emploi expirent à 120 questions');
    // Un échec de règle ne vide pas la file et ne simule jamais une réception.
    bloque = true;
    await assert.rejects(context.boiteEnvoyer(a));
    assert.equal(documents.length, 0);
    assert.equal(receptions.size, 0, 'un reçu a été créé malgré le refus du document privé');
    assert.equal(Object.keys(JSON.parse(donnees[context.BOITE_EMPLOI_FILE])).length, 1);
    bloque = false;
    await context.boiteReessayer();
    assert.equal(documents.length, 1);
    assert.equal(Object.keys(JSON.parse(donnees[context.BOITE_EMPLOI_FILE])).length, 0);
    assert.equal(documents[0].z_donnees_techniques.googleSub, '', 'le visiteur usurpe un identifiant Google');
    utilisateur = { uid: 'uid-prouve', email: 'compte@example.org', displayName: 'Compte Google',
        providerData: [{ providerId: 'google.com', uid: 'sub-prouve' }] };
    const declareFaux = { ...b, googleSub: 'sub-usurpe', google: 'autre@example.org', email: 'autre@example.org' };
    assert.equal(await context.boiteEnvoyer(declareFaux), true);
    const prouve = documents.at(-1).z_donnees_techniques;
    assert.equal(prouve.firebaseUid, 'uid-prouve');
    assert.equal(prouve.googleSub, 'sub-prouve');
    assert.equal(prouve.email, 'compte@example.org', 'l’adresse vient des champs locaux et non de Firebase Auth');
    utilisateur = null;
    // L'ACK d'une semaine antérieure autorise à vider volontairement TOUT le planning.
    donnees[context.BOITE_EMPLOI_HASH] = JSON.stringify({ cle: 'app:a|camille', hash: 'avant', at: heure });
    const vide = { ...a, at: '2026-10-24T09:01:00.000Z', jours: jours.map((j) => ({ j, s: [] })) };
    assert.equal(await context.boiteEnvoyer(vide), true, 'la suppression de tous les créneaux ne met pas à jour la fiche');
    assert.equal(context.boiteFusionner(documents).emplois[0].jours[0].s.length, 0, 'une semaine vidée réaffiche des cours');
    context.boiteNettoyerSession();
    assert.equal(JSON.parse(donnees[context.BOITE_FILE] || '[]').some((item) => item.type === 'emploi'), false,
        'la déconnexion réintroduit les emplois dans la file plafonnée');
    // Même si la réponse à A arrive APRÈS que B a été mis en attente,
    // l'acquittement de A ne supprime ni ne remplace B.
    let ouvrir;
    gardeEnCours = () => new Promise((res) => { ouvrir = res; });
    const envoiA = context.boiteEnvoyer(change);
    await new Promise((res) => setTimeout(res, 0));
    const dernier = fiche('Camille', 'a', '2026-10-24T10:02:00.000Z', 'Dernière édition');
    const envoiB = context.boiteEnvoyer(dernier);
    assert.equal(JSON.parse(donnees[context.BOITE_EMPLOI_FILE])['app:a|camille'].at, dernier.at);
    ouvrir();
    gardeEnCours = null;
    await Promise.all([envoiA, envoiB]);
    assert.equal(Object.keys(JSON.parse(donnees[context.BOITE_EMPLOI_FILE])).length, 0, 'la dernière version reste en attente après ACK');
    assert.equal(context.boiteFusionner(documents).emplois[0].jours[0].s[0].t, 'Dernière édition');
    assert.ok(documents.length >= 2, 'les versions confirmées ne sont pas conservées');
    // Un document hors ligne peut arriver avec un ancien at. Le premier
    // incrémental ne le voit pas ; le balayage complet à 5 min le récupère.
    context.boiteEstAdmin = () => true;
    await context.boiteLireBoite();
    const retard = context.boiteEmploiPourFirestore(fiche('Fatou', 'retard', '2026-10-23T01:00:00.000Z', 'Histoire'));
    /* Élève connecté : sa fiche est visible dans l'administration. */
    retard.z_donnees_techniques = Object.assign({}, retard.z_donnees_techniques, { firebaseUid: 'uid-fatou' });
    documents.push(retard);
    assert.equal((await context.boiteLireBoite()).filter((d) => d.appareil === 'retard').length, 0,
        'le test de lecture incrémentale ne teste pas un envoi tardif');
    heure += 301000;
    const apres = await context.boiteLireBoite();
    assert.equal(context.boiteFusionner(apres).emplois.some((p) => p.nom === 'Fatou'), true,
        'un ancien at arrivé plus tard est perdu');
    // Un refus de lecture de la collection cible n'est pas pris pour « aucun reçu ».
    lectureEmploisRefusee = true;
    const refus = await context.boiteChargerListes(true);
    assert.equal(refus.erreurEmplois, 'permission-denied');
    assert.equal(refus.partiel, true);
    lectureEmploisRefusee = false;
    await context.boiteChargerListes(true);

    // Ni la flamme ni une génération différente 7 h plus tard ne modifient
    // une semaine déjà reçue ; une vraie édition crée une version append-only.
    documents.length = 0;
    delete donnees[context.BOITE_EMPLOI_HASH];
    delete donnees[context.BOITE_EMPLOI_HASH + ':app%3Aa%7Ccamille'];
    context.boiteAppareil = () => 'a';
    context.__profilComplet = true;
    let choix = 'Maths';
    let rendu = 'Cours reçu';
    context.memoireLireEtat = () => ({ userName: 'Camille', emploiScolaire: { at: heure, jours: [choix] }, savedAt: heure });
    context.generateDayEvents = () => [{ title: rendu, startTime: '08:00', endTime: '09:00' }];
    context.boitePublierEmploi(true);
    await new Promise((res) => setTimeout(res, 10));
    assert.equal(documents.length, 1, 'premier emploi valide non reçu');
    const premiere = JSON.stringify(documents[0]);
    heure += 7 * 3600000;
    rendu = 'Calcul automatique';
    donnees.studyPlanIB_flamme = '12';
    context.boitePublierEmploi(true);
    await new Promise((res) => setTimeout(res, 10));
    assert.equal(documents.length, 1, 'flamme, délai ou recalcul écrase la semaine');
    choix = 'Physique';
    rendu = 'Cours édité';
    context.boitePublierEmploi(true);
    await new Promise((res) => setTimeout(res, 10));
    assert.equal(documents.length, 2, 'une édition explicite n’est pas archivée');
    assert.equal(JSON.stringify(documents[0]), premiere, 'une ancienne version a changé');
    const actuel = context.boiteFusionner(documents);
    assert.equal(actuel.emplois[0].jours[0].s[0].t, 'Cours édité');
    assert.equal(actuel.emploisVersions.length, 2);
    const contact = { ...fiche('Camille', 'a', new Date(heure + 5000).toISOString(), 'Faux jour'),
        jours: [{ j: 'Lundi', s: [{ d: '08:00', t: 'Faux jour' }] }], complet: 0 };
    assert.equal(context.boiteFusionnerPersonnes([actuel.emplois[0], contact])[0].jours[0].s[0].t,
        'Cours édité', 'une fiche partielle remplace le dernier emploi reçu');
    // Écriture refusée puis réessai dans le même navigateur : l'ACK
    // persiste, et le passage suivant ne redépose pas la même semaine.
    documents.length = 0;
    delete donnees[context.BOITE_EMPLOI_HASH];
    delete donnees[context.BOITE_EMPLOI_HASH + ':app%3Aa%7Ccamille'];
    choix = 'Anglais';
    rendu = 'Anglais réel';
    bloque = true;
    context.boitePublierEmploi(true);
    await new Promise((res) => setTimeout(res, 10));
    assert.equal(documents.length, 0);
    assert.equal(Object.keys(JSON.parse(donnees[context.BOITE_EMPLOI_FILE])).length, 1);
    bloque = false;
    await context.boiteReessayer();
    assert.equal(documents.length, 1);
    assert.equal(context.boiteLireAckEmploi(context.boiteSnapshotEmploi()).cle, 'app:a|camille');
    context.boitePublierEmploi(true);
    await new Promise((res) => setTimeout(res, 10));
    assert.equal(documents.length, 1, 'le réessai après refus est renvoyé sans édition');

    // Deux profils utilisant le même navigateur gardent chacun leur ACK.
    const ackA = context.boiteLireAckEmploi(context.boiteSnapshotEmploi());
    const ficheB = fiche('Fatou', 'autre', new Date(heure).toISOString(), 'Histoire');
    context.boiteEcrireAckEmploi(ficheB, { cle: 'app:autre|fatou', hash: 'B' });
    assert.equal(context.boiteLireAckEmploi(context.boiteSnapshotEmploi()).hash, ackA.hash);

    // Contrôle sur la page : le reçu serveur, et non l'ACK du navigateur,
    // décide si une semaine déjà envoyée doit être renvoyée.
    const ackRecu = context.boiteLireAckEmploi(context.boiteSnapshotEmploi());
    assert.ok(ackRecu.receptionId && receptions.has(ackRecu.receptionId));
    const avantControle = documents.length;
    assert.equal(await context.boiteVerifierReceptionEmploi(), 'recu');
    assert.equal(documents.length, avantControle, 'la vérification du reçu crée un doublon');
    receptions.delete(ackRecu.receptionId);
    assert.equal(await context.boiteVerifierReceptionEmploi(), 'renvoi');
    await new Promise((res) => setTimeout(res, 10));
    assert.equal(documents.length, avantControle + 1, 'la réception manquante ne relance pas l’envoi');
    assert.ok(receptions.has(context.boiteLireAckEmploi(context.boiteSnapshotEmploi()).receptionId));
    choix = 'Philosophie';
    rendu = 'Cours édité en page Emploi';
    assert.equal(await context.boiteVerifierReceptionEmploi(), 'edition');
    await new Promise((res) => setTimeout(res, 10));
    assert.equal(documents.length, avantControle + 2, 'le reçu précédent masque une nouvelle édition');
    assert.equal(context.boiteFusionner(documents).emplois[0].jours[0].s[0].t,
        'Cours édité en page Emploi');
    lectureEmploisRefusee = true;
    const avantRefus = documents.length;
    assert.equal(await context.boiteVerifierReceptionEmploi(), 'indisponible');
    assert.equal(documents.length, avantRefus, 'un refus du backend est pris pour une absence');
    lectureEmploisRefusee = false;
    context.boiteEcrireAckEmploi(context.boiteSnapshotEmploi(), { cle: 'app:a|camille', hash: 'ancien' });
    assert.equal(await context.boiteVerifierReceptionEmploi(), 'ancien_indeterminable');
    assert.equal(documents.length, avantRefus, 'une archive anonyme non vérifiable est dupliquée');

    // Identité Google : lire seulement les fiches de son propre UID ; ne
    // jamais confondre un homonyme ou une ancienne fiche anonyme avec elle.
    const archivePropre = context.boiteEmploiPourFirestore(fiche('Camille', 'b', new Date(heure).toISOString(), 'Ancien cours authentifié'));
    archivePropre.z_donnees_techniques.firebaseUid = 'uid-prouve';
    documents.push(archivePropre);
    utilisateur = { uid: 'uid-prouve', email: 'compte@example.org',
        providerData: [{ providerId: 'google.com', uid: 'sub-prouve' }] };
    context.compteSession = { sub: 'sub-prouve', email: 'compte@example.org' };
    assert.equal(await context.boiteVerifierReceptionEmploi(), 'recu_ancien');
    assert.equal(documents.length, avantRefus + 1, 'une archive prouvée est republiée');
    context.boitePublierEmploi(true);
    await new Promise((res) => setTimeout(res, 10));
    assert.equal(documents.length, avantRefus + 1, 'une lecture prouvée est écrasée sans édition');
    choix = 'Biologie';
    rendu = 'Cours modifié par Camille';
    context.boitePublierEmploi(true);
    await new Promise((res) => setTimeout(res, 10));
    assert.equal(documents.length, avantRefus + 2, 'une modification explicite ne crée pas de version');
    utilisateur = { uid: 'uid-autre', email: 'autre@example.org',
        providerData: [{ providerId: 'google.com', uid: 'sub-autre' }] };
    context.compteSession = { sub: 'sub-autre', email: 'autre@example.org' };
    assert.equal(await context.boiteVerifierReceptionEmploi(), 'renvoi');
    await new Promise((res) => setTimeout(res, 10));
    assert.equal(documents.at(-1).z_donnees_techniques.firebaseUid, 'uid-autre');
    assert.ok(receptions.has(context.boiteLireAckEmploi(context.boiteSnapshotEmploi()).receptionId));
    const dernierCompte = documents.length;
    context.compteSession = { sub: 'sub-fausse-session' };
    assert.equal(await context.boiteVerifierReceptionEmploi(), 'session',
        'une session locale différente du compte Firebase récupère le planning d’autrui');
    assert.equal(documents.length, dernierCompte);
    utilisateur = null;
    context.compteSession = null;

    // Deux jours manqués sont tolérés ; trois journées manquées ramènent
    // la flamme à zéro, y compris pour les vues Planning, Soutien et Focus.
    heure = Date.parse('2026-10-26T12:00:00.000Z');
    donnees.studyPlanIB_flamme = '4';
    donnees.studyPlanIB_flammeJour = '2026-10-23';
    assert.equal(context.boiteFlammes(), 5, 'deux jours manqués ne doivent pas casser la série');
    donnees.studyPlanIB_flamme = '4';
    donnees.studyPlanIB_flammeJour = '2026-10-22';
    assert.equal(context.boiteFlammes(), 0, 'trois jours manqués doivent mettre la flamme à zéro');
    assert.equal(context.boiteFlammes(), 0, 'le retour reste à zéro pendant toute la journée');
    heure += 86400000;
    assert.equal(context.boiteFlammes(), 1, 'le lendemain du retour recommence à un');
    // Le badge 🔥 affiche la série, et non le cumul de connexions.
    heure = Date.parse('2026-10-30T12:00:00.000Z');
    donnees.studyPlanIB_flamme = '4';
    donnees.studyPlanIB_flammeJour = '2026-10-26';
    donnees.studyPlanIB_joursConnectes = '17';
    donnees.studyPlanIB_dernierJour = 'Thu Oct 29 2026';
    const compteurs = {};
    const vue = { Date: Horloge, parseInt, isFinite, String, localStorage: storage,
        boiteFlammes: context.boiteFlammes, document: { getElementById(id) {
            return compteurs[id] || (compteurs[id] = { style: {}, textContent: '' });
        } } };
    vm.createContext(vue);
    const planning = fs.readFileSync('js/pages/planning-base.js', 'utf8');
    const debut = planning.indexOf('function compterJourConnecte()');
    const fin = planning.indexOf('\nfunction initPlanning()', debut);
    vm.runInContext(planning.slice(debut, fin), vue);
    assert.equal(vue.compterJourConnecte(), 18);
    assert.equal(compteurs.joursCompte.textContent, '0');
    assert.equal(compteurs.streakCount.textContent, '0 jour');
    const pomodoro = fs.readFileSync('js/pages/pomodoro-page.js', 'utf8');
    vm.runInContext(pomodoro.slice(pomodoro.indexOf('function focusPeindreFlamme()'),
        pomodoro.indexOf('\nfunction focusBasculerTaches()')), vue);
    vue.focusPeindreFlamme();
    assert.equal(compteurs.focusFlamme.textContent, '0');
    assert.match(fs.readFileSync('js/pages/soutien.js', 'utf8'),
        /function updateStreak\([\s\S]*?var n = typeof boiteFlammes/);

    // Compatibilité pendant le déploiement séparé des règles : ancien
    // create privé autorisé mais nouvel accusé refusé. Ne pas créer de faux
    // reçu ; ne pas bloquer les semaines qui pouvaient déjà être reçues.
    reglesReceptionActives = false;
    const anciensDocs = documents.length;
    const anciensRecus = receptions.size;
    assert.equal(await context.boiteEnvoyer(fiche('Salomé', 'ancien', new Date(heure).toISOString(), 'Histoire')), true);
    assert.equal(documents.length, anciensDocs + 1);
    assert.equal(receptions.size, anciensRecus, 'un accusé a été inventé malgré les anciennes règles');
    reglesReceptionActives = true;
    context.__STUDYPLAN_E2E = true;
    assert.equal(await context.boiteEnvoyer(b), false, 'le navigateur E2E écrit en production');
    console.log('ok emplois privés : identité, semaine, file, ACK, lecture tardive et tests sans envoi');
})().catch((err) => { console.error(err); process.exitCode = 1; });
