/* ============================================================
   Aide, Feedback, et les trois sections des quatre comptes.

   Les messages sont privés. Ils sont écrits dans Firestore et
   lisibles seulement par les quatre comptes Google admins : la
   décision est prise par les règles Firebase, côté serveur, pas
   par cette page. Rien ici ne contient d'adresse, de nom d'admin,
   de mot de passe ni de nom de canal public.
   ============================================================ */

var BOITE_COLLECTION = 'boite';
var BOITE_PUBLIE = 'publie';
/* Identifiants Google opaques (sub) des quatre comptes admins.
   Ils servent uniquement à afficher les sections réservées ; la
   vraie serrure est dans firestore.rules. */
var BOITE_ADMINS_SUB = [
    '116965022060639990571',
    '110718856042093635641',
    '107483800962626598897',
    '108029295239679260667'
];
/* Le nom gardé de chaque compte admin : il ne sert qu'à signer les
   messages, jamais à décider d'un accès. */
var BOITE_ADMINS_NOM = {
    '116965022060639990571': 'Sawadogo Juliss Bill Owen',
    '110718856042093635641': 'Sere Farid Abdourrahman',
    '107483800962626598897': 'Tamini Ashley Kania Harisoa',
    '108029295239679260667': 'Ouedraogo Wendsom Rayyan'
};
var BOITE_EXPEDITEUR = 'ibstudyplan@gmail.com';
var BOITE_FILE = 'studyPlanIB_boiteFile';
var BOITE_VUS = 'studyPlanIB_boiteVus';
var BOITE_EMPLOI_HASH = 'studyPlanIB_boiteEmploiHash';
var BOITE_FICHE_ENVOI = 'studyPlanIB_boiteFicheEnvoi';
var BOITE_COMPLET = 'studyPlanIB_boiteComplet';
var BOITE_COMPLET_VERSION = '20261008b';
var boiteListesCache = null;
var boiteEnvoiEnCours = false;
var boiteFirebasePromesse = null;
var aideBranchee = false;
var feedbackBranche = false;
var boiteAdminBranche = false;

function boiteNormaliser(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function boiteMots(s) {
    return boiteNormaliser(s).split(' ').filter(Boolean);
}

/* Les sections réservées s'affichent pour les quatre comptes Google
   admins, reconnus par leur identifiant opaque. Un visiteur peut
   toujours fabriquer une session locale : il verra alors des sections
   vides, car les règles Firestore refusent la lecture. */
function boiteEstAdmin() {
    var session = boiteSession();
    return !!(session && session.sub && BOITE_ADMINS_SUB.indexOf(String(session.sub)) !== -1);
}

function boiteEchap(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function boiteDate(iso) {
    try {
        return new Date(iso).toLocaleString('fr-FR', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    } catch (e) {
        return '';
    }
}

function boiteId(prefix) {
    return prefix + Date.now().toString(16) + Math.random().toString(16).slice(2, 10);
}

function boiteAppareil() {
    var cle = 'studyPlanIB_appareil';
    try {
        var id = localStorage.getItem(cle);
        if (id) return id;
        id = 'a' + Date.now().toString(16) + Math.random().toString(16).slice(2, 10);
        localStorage.setItem(cle, id);
        return id;
    } catch (e) {
        return 'a-session';
    }
}

function boiteEmailValide(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

function boiteFetch(url, options, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var opts = Object.assign({}, options || {});
    if (ctrl) opts.signal = ctrl.signal;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 12000);
    return fetch(url, opts).then(function (res) {
        clearTimeout(timer);
        return res;
    }, function (err) {
        clearTimeout(timer);
        throw err;
    });
}

/* ---------- Firestore : la seule serrure des messages ----------

   Écrire ne demande aucun compte : la règle Firestore autorise la
   création d'un message par n'importe qui. Lire exige un compte Google
   dont l'adresse est dans la liste des admins — vérifié par Firebase,
   pas par la page. Un visiteur qui bricole le code ne peut donc pas
   lire les messages des autres. */

function boiteFirebase() {
    if (typeof compteChargerFirebase !== 'function') return Promise.reject(new Error('firebase'));
    return compteChargerFirebase();
}

function boiteFirebasePret() {
    if (!boiteFirebasePromesse) {
        boiteFirebasePromesse = boiteFirebase().then(function () {
            return new Promise(function (resolve) {
                var fini = false;
                var timer = setTimeout(function () {
                    if (fini) return;
                    fini = true;
                    resolve();
                }, 6000);
                firebase.auth().onAuthStateChanged(function () {
                    if (fini) return;
                    fini = true;
                    clearTimeout(timer);
                    resolve();
                });
            });
        }).catch(function (err) {
            boiteFirebasePromesse = null;
            throw err;
        });
    }
    return boiteFirebasePromesse.then(function () {
        return (window.firebase && firebase.auth() ? firebase.auth().currentUser : null) || null;
    });
}

function boiteSansVides(record) {
    try { return JSON.parse(JSON.stringify(record)); } catch (e) { return null; }
}

/* Lecture incrémentale : la première lecture prend tout, les suivantes
   ne demandent que ce qui est arrivé depuis. Sans cela, la surveillance
   de la boîte coûterait des milliers de lectures par heure. */
var boiteBruts = [];
var boiteDernierAt = '';

function boiteLireCollection(nom, depuis, max) {
    var base = firebase.firestore().collection(nom);
    var requete = depuis ? base.where('at', '>', depuis) : base;
    return requete.orderBy('at', 'asc').limit(max || 400).get()
        .then(function (snap) {
            var out = [];
            snap.forEach(function (doc) {
                var data = doc.data();
                if (data && data.type) out.push(data);
            });
            return out;
        });
}

function boiteAjouterBruts(items) {
    (items || []).forEach(function (item) {
        if (!item) return;
        var cle = String(item.id || '') + '|' + String(item.at || '');
        if (boiteBruts.some(function (deja) {
            return String(deja.id || '') + '|' + String(deja.at || '') === cle;
        })) return;
        boiteBruts.push(item);
        if (String(item.at || '') > boiteDernierAt) boiteDernierAt = String(item.at || '');
    });
    if (boiteBruts.length > 2500) boiteBruts = boiteBruts.slice(-2000);
}

/* Écrit un message. Les annonces et les tutoriels sont publics par
   nature : ils vont dans « publie ». Tout le reste — questions,
   suggestions, emplois du temps, profils, réponses — va dans « boite »,
   que seuls les admins peuvent lire. */
function boiteEcrireBoite(record) {
    var propre = boiteSansVides(record);
    if (!propre || !propre.type || propre.type === 'coffre') return Promise.reject(new Error('record'));
    var publique = propre.type === 'annonce' || propre.type === 'tutoriel';
    return boiteFirebasePret().then(function () {
        return firebase.firestore().collection(publique ? BOITE_PUBLIE : BOITE_COLLECTION).add(propre);
    }).then(function () { return true; });
}

/* Relit les messages. Un visiteur non admin ne reçoit que la partie
   publique : la lecture de « boite » lui est refusée par les règles. */
function boiteLireBoite() {
    return boiteFirebasePret().then(function () {
        var publique = boiteLireCollection(BOITE_PUBLIE, '', 200).catch(function () { return []; });
        if (!boiteEstAdmin()) return publique;
        var depuis = boiteBruts.length ? boiteDernierAt : '';
        var privee = boiteLireCollection(BOITE_COLLECTION, depuis, depuis ? 300 : 1200).catch(function (err) {
            boiteErreurLecture = (err && (err.code || err.message)) || 'refus';
            return [];
        });
        return Promise.all([privee, publique]).then(function (deux) {
            boiteAjouterBruts(deux[0]);
            return boiteBruts.concat(deux[1]);
        });
    });
}

var boiteErreurLecture = '';

function boiteLireJson(cle) {
    try { return JSON.parse(localStorage.getItem(cle) || 'null'); } catch (e) { return null; }
}

function boiteEcrireJson(cle, valeur) {
    try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch (e) {}
}

function boiteLireFile() {
    var file = boiteLireJson(BOITE_FILE);
    return Array.isArray(file) ? file : [];
}

function boiteGarderFile(record) {
    var file = boiteLireFile().filter(function (item) { return item && item.id !== record.id; });
    file.push(record);
    boiteEcrireJson(BOITE_FILE, file.slice(-40));
}

function boiteRetirerFile(id) {
    boiteEcrireJson(BOITE_FILE, boiteLireFile().filter(function (item) { return item && item.id !== id; }));
}

function boiteMajMenu() {
    var admin = boiteEstAdmin();
    if (admin && typeof boiteSignalerOuverture === 'function') boiteSignalerOuverture();
    ['menuRetours', 'menuQuestions', 'menuEmplois'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = admin ? 'flex' : 'none';
    });
    if (typeof tutorielMajMenu === 'function') tutorielMajMenu();
    if (typeof focusAfficherEntree === 'function') focusAfficherEntree();
    var champ = document.getElementById('menuNom');
    if (!champ) return;
    if (document.activeElement !== champ && champ.value !== boiteNom()) champ.value = boiteNom();
    if (champ.__boite) return;
    champ.__boite = true;
    champ.addEventListener('change', function () {
        var nom = champ.value.trim();
        if (!nom) {
            champ.value = boiteNom();
            return;
        }
        if (typeof userName !== 'undefined') userName = nom;
        if (window.compteSession && window.compteSession.sub && typeof compteLierNom === 'function') {
            compteLierNom(window.compteSession.sub, nom, window.compteSession.email || '');
        }
        var origine = document.getElementById('nameInput');
        if (origine) origine.value = nom;
        if (typeof memoireSauvegarder === 'function') memoireSauvegarder();
        boiteMajMenu();
    });
}

/* Plus de coffre externe : la configuration distante a disparu avec le
   canal public. La fonction reste pour les appelants qui la consultent
   (tutoriels), et renvoie une configuration vide. */
function boiteLireConfig() {
    return Promise.resolve({});
}

function boiteJoursCompacts(jours, maxSlots) {
    return (jours || []).slice(0, 7).map(function (jour) {
        return {
            j: jour.j,
            s: (jour.s || []).slice(0, maxSlots || 12).map(function (slot) {
                return { d: slot.d, f: slot.f, t: String(slot.t || '').slice(0, 28) };
            })
        };
    });
}

function boiteEnvoyerDistant(record) {
    /* Un seul endroit écrit : Firestore. Le message est retiré de la
       file locale quand le serveur l'a accepté. */
    return boiteEcrireBoite(record).then(function (ok) {
        boiteRetirerFile(record.id);
        return ok;
    });
}

function boiteLireVus() {
    var vus = boiteLireJson(BOITE_VUS);
    if (!vus || typeof vus !== 'object') return [];
    return [].concat(vus.questions || [], vus.feedbacks || [], vus.emplois || [], vus.reponses || [], vus.profils || [], vus.connexions || [], vus.annonces || []);
}

function boiteMemoriserVus(fusion) {
    boiteEcrireJson(BOITE_VUS, {
        questions: (fusion.questions || []).slice(0, 80),
        feedbacks: (fusion.feedbacks || []).slice(0, 80),
        emplois: (fusion.emplois || []).slice(0, 200),
        reponses: (fusion.reponses || []).slice(0, 80),
        profils: (fusion.profils || []).slice(0, 40),
        connexions: (fusion.connexions || []).slice(0, 4),
        annonces: (fusion.annonces || []).slice(0, 40)
    });
}

function boiteGarderVu(record) {
    var fusion = boiteFusionner(boiteLireVus().concat([record]));
    boiteMemoriserVus(fusion);
}

function boiteSlotsJour(jour) {
    return (jour && jour.s && jour.s.length) || 0;
}

function boiteEstReveil(slot) {
    return boiteNormaliser(slot && (slot.t || slot.title) || '').indexOf('reveil') === 0;
}

function boiteEstCoucher(slot) {
    return boiteNormaliser(slot && (slot.t || slot.title) || '').indexOf('coucher') === 0;
}

function boiteCorrigerCours(slot) {
    if (!slot || String(slot.t || '') !== 'Cours') return slot;
    var debut = String(slot.d || '');
    var fin = String(slot.f || '');
    if (fin === '16:35') {
        var apres = Object.assign({}, slot);
        apres.f = '16:25';
        return apres;
    }
    if (!debut || debut >= '12:00' || fin !== '12:30' || debut === '07:50') return slot;
    var copie = Object.assign({}, slot);
    copie.d = '07:50';
    return copie;
}

function boiteOrdonnerCreneaux(slots) {
    var corriges = (slots || []).map(boiteCorrigerCours);
    if (typeof planningGarantirJour === 'function') return planningGarantirJour(corriges);
    var reveils = [];
    var couchers = [];
    var milieu = [];
    corriges.forEach(function (slot) {
        if (boiteEstReveil(slot)) reveils.push(slot);
        else if (boiteEstCoucher(slot)) couchers.push(slot);
        else milieu.push(slot);
    });
    return reveils.concat(milieu, couchers);
}

function boiteJourIncomplet(slots) {
    var fin = '';
    (slots || []).forEach(function (slot) {
        if (!slot || boiteEstCoucher(slot) || boiteEstReveil(slot)) return;
        var debut = String(slot.d || '');
        var heureFin = String(slot.f || '');
        if (debut > fin) fin = debut;
        if (heureFin > fin) fin = heureFin;
    });
    return !!(fin && fin <= '12:30');
}

function boiteJoursOrdonnes(jours) {
    var map = {};
    (jours || []).forEach(function (jour) {
        if (jour && jour.j) map[jour.j] = jour;
    });
    return ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].filter(function (nom) {
        return map[nom];
    }).map(function (nom) { return map[nom]; });
}

function boiteJoindreJours(anciens, nouveaux, nouveauComplet) {
    if (nouveauComplet && nouveaux && nouveaux.length) return boiteJoursOrdonnes(nouveaux);
    var map = {};
    (anciens || []).forEach(function (jour) {
        if (jour && jour.j) map[jour.j] = jour;
    });
    (nouveaux || []).forEach(function (jour) {
        if (!jour || !jour.j) return;
        var deja = map[jour.j];
        if (!deja || boiteSlotsJour(jour) > boiteSlotsJour(deja)) map[jour.j] = jour;
    });
    return boiteJoursOrdonnes(Object.keys(map).map(function (nom) { return map[nom]; }));
}

function boiteSignatureJours(item) {
    return JSON.stringify(boiteJoursOrdonnes(item && item.jours).map(function (jour) {
        return {
            j: jour.j,
            s: (jour.s || []).map(function (slot) {
                return { d: slot.d || '', f: slot.f || '', t: slot.t || '' };
            })
        };
    }));
}

function boiteEstComplet(item) {
    return !!(item && Number(item.complet) && !item.partie && (item.jours || []).length);
}

var BOITE_EMPLOIS_RETIRES = {
    a1a112dcf4ed266ce751: 1,
    a1a112dd6ac2adcf6166: 1,
    a1a11c0ee01878c1524f: 1
};

function boiteEmploiRetire(item) {
    if (!item) return true;
    var appareil = String(item.appareil || '');
    var id = String(item.id || '').replace(/^e_/, '');
    if (BOITE_EMPLOIS_RETIRES[appareil] || BOITE_EMPLOIS_RETIRES[id]) return true;
    var nom = boiteNormaliser(item.nom || '');
    return nom === 'julia' || nom === 'u';
}

function boiteCleEmploi(item) {
    if (!item || boiteEmploiRetire(item)) return '';
    var sub = String(item.googleSub || '').trim();
    if (sub) return 'sub:' + sub;
    var mail = boiteNormaliser(item.google || item.email || '');
    if (mail) return 'mail:' + mail;
    return 'app:' + String(item.appareil || item.id || item.nom || '');
}

function boiteDecouperEmploi(record) {
    if (!record || record.type !== 'emploi') return [record];
    var jours = record.jours || [];
    if (!jours.length || JSON.stringify(record).length <= 3200) return [record];
    return jours.map(function (jour, index) {
        var morceau = {
            type: 'emploi',
            id: record.id,
            appareil: record.appareil,
            at: record.at,
            nom: record.nom,
            classe: record.classe || '',
            email: record.email || '',
            google: record.google || '',
            googleNom: record.googleNom || '',
            googleSub: record.googleSub || '',
            flammes: Number(record.flammes || 0),
            matieres: record.matieres || [],
            jours: [jour],
            complet: 0,
            partie: index + 1,
            total: jours.length
        };
        if (JSON.stringify(morceau).length > 3600) morceau.coupee = 1;
        return morceau;
    });
}

function boiteReassemblerEmplois(items) {
    var groupes = {};
    var autres = [];
    (items || []).forEach(function (item) {
        var total = Number(item && item.total || 0);
        var partie = Number(item && item.partie || 0);
        if (!item || item.type !== 'emploi' || !partie || !total) {
            autres.push(item);
            return;
        }
        var cle = String(item.appareil || item.id || '') + '|' + String(item.at || '') + '|' + total;
        if (!groupes[cle]) groupes[cle] = { total: total, parts: {}, base: item, coupee: false };
        if (item.coupee) groupes[cle].coupee = true;
        groupes[cle].parts[partie] = item;
    });
    Object.keys(groupes).forEach(function (cle) {
        var g = groupes[cle];
        var i;
        var jours = [];
        var complet = !g.coupee && g.total > 0;
        for (i = 1; i <= g.total; i++) {
            if (!g.parts[i]) { complet = false; break; }
            jours = jours.concat(g.parts[i].jours || []);
        }
        if (!complet) {
            for (i = 1; i <= g.total; i++) if (g.parts[i]) autres.push(g.parts[i]);
            return;
        }
        var plein = {};
        Object.keys(g.base).forEach(function (k) { plein[k] = g.base[k]; });
        plein.jours = jours;
        plein.complet = 1;
        delete plein.partie;
        delete plein.total;
        delete plein.coupee;
        autres.push(plein);
    });
    return autres;
}

function boiteEnvoyer(record) {
    var morceaux = boiteDecouperEmploi(record);
    morceaux.forEach(boiteGarderFile);
    var envoi = morceaux.reduce(function (chaine, morceau) {
        return chaine.then(function () { return boiteEnvoyerDistant(morceau); });
    }, Promise.resolve(true));
    return envoi.then(function (ok) {
        boiteGarderVu(record);
        return ok;
    });
}

function boiteReessayer() {
    var file = boiteLireFile();
    if (!file.length) return Promise.resolve();
    return file.reduce(function (chaine, record) {
        return chaine.then(function () { return boiteEnvoyerDistant(record).catch(function () {}); });
    }, Promise.resolve());
}

function boiteMailPersonne(item) {
    return String((item && (item.google || item.email)) || '').trim().toLowerCase();
}

function boiteChoisirNom(recent, ancien) {
    var nr = boiteNomUtile(recent) || String(recent && recent.googleNom || '').trim();
    var na = boiteNomUtile(ancien) || String(ancien && ancien.googleNom || '').trim();
    if (!nr) return na;
    if (!na) return nr;
    var r = boiteNormaliser(nr);
    var a = boiteNormaliser(na);
    if (r.length < 3 && a.length >= 3) return na;
    if (a.length < 3 && r.length >= 3) return nr;
    if (a.indexOf(r) === 0 && a.length > r.length) return na;
    if (r.indexOf(a) === 0 && r.length > a.length) return nr;
    return String(recent && recent.at || '') >= String(ancien && ancien.at || '') ? nr : na;
}

function boiteNomInterdit(nom) {
    var n = boiteNormaliser(nom);
    if (!n) return true;
    return n.indexOf('acces bloque') !== -1
        || n.indexOf('na pas termine') !== -1
        || n.indexOf('procedure de validation') !== -1
        || n.indexOf('access blocked') !== -1
        || n.indexOf('has not completed') !== -1
        || n.indexOf('verification process') !== -1;
}

function boiteNomUtile(item) {
    var nom = String(item && item.nom || '').trim();
    var n = boiteNormaliser(nom);
    if (!n || n === 'u' || n === 'julia' || n === 'sans nom' || boiteNomInterdit(nom)) return '';
    return nom;
}

function boiteMemePersonne(a, b) {
    if (!a || !b) return false;
    var subA = String(a.googleSub || '').trim();
    var subB = String(b.googleSub || '').trim();
    if (subA && subA === subB) return true;
    var mailA = boiteMailPersonne(a);
    var mailB = boiteMailPersonne(b);
    if (mailA && mailB && mailA === mailB) return true;
    var nomA = boiteNormaliser(boiteNomUtile(a));
    var nomB = boiteNormaliser(boiteNomUtile(b));
    if (nomA && nomB && nomA === nomB) return true;
    var appA = String(a.appareil || '').trim();
    var appB = String(b.appareil || '').trim();
    if (appA && appA === appB) {
        if (!nomA || !nomB || nomA === nomB) return true;
        if (nomA.length >= 3 && nomB.length >= 3 && (nomA.indexOf(nomB) !== -1 || nomB.indexOf(nomA) !== -1)) return true;
    }
    return false;
}

function boiteRichesseEmploi(item) {
    var n = 0;
    (item && item.jours || []).forEach(function (jour) { n += (jour && jour.s ? jour.s.length : 0); });
    return n;
}

function boiteJoindrePersonne(a, b) {
    if (!a) return b;
    if (!b) return a;
    var recent = String(b.at || '') >= String(a.at || '') ? b : a;
    var ancien = recent === b ? a : b;
    var nom = boiteChoisirNom(recent, ancien);
    var complet = boiteEstComplet(recent);
    return {
        type: 'emploi',
        id: recent.id || ancien.id || '',
        appareil: recent.appareil || ancien.appareil || '',
        at: recent.at || ancien.at || '',
        nom: nom,
        classe: recent.classe || ancien.classe || '',
        email: recent.email || ancien.email || recent.google || ancien.google || '',
        google: recent.google || ancien.google || recent.email || ancien.email || '',
        googleNom: recent.googleNom || ancien.googleNom || '',
        googleSub: recent.googleSub || ancien.googleSub || '',
        flammes: recent.flammes != null ? Number(recent.flammes || 0) : Number(ancien.flammes || 0),
        matieres: (recent.matieres && recent.matieres.length) ? recent.matieres : (ancien.matieres || []),
        jours: boiteJoindreJours(ancien.jours, recent.jours, complet),
        complet: complet ? 1 : 0
    };
}

function boiteFusionnerPersonnes(liste) {
    var groupes = [];
    (liste || []).forEach(function (item) {
        if (!item || boiteEmploiRetire(item)) return;
        var trouve = -1;
        var i;
        for (i = 0; i < groupes.length; i++) {
            if (boiteMemePersonne(groupes[i], item)) { trouve = i; break; }
        }
        if (trouve === -1) groupes.push(item);
        else groupes[trouve] = boiteJoindrePersonne(groupes[trouve], item);
    });
    var stable = false;
    while (!stable) {
        stable = true;
        var i;
        for (i = 0; i < groupes.length; i++) {
            var j;
            for (j = i + 1; j < groupes.length; j++) {
                if (!boiteMemePersonne(groupes[i], groupes[j])) continue;
                groupes[i] = boiteJoindrePersonne(groupes[i], groupes[j]);
                groupes.splice(j, 1);
                stable = false;
                break;
            }
            if (!stable) break;
        }
    }
    return groupes;
}

function boitePersonneDepuisMessage(item) {
    if (!item || (item.type !== 'question' && item.type !== 'feedback')) return null;
    if (boiteEmploiRetire(item)) return null;
    if (!boiteNomUtile(item) && !boiteMailPersonne(item) && !item.googleSub) return null;
    return {
        type: 'emploi',
        id: 'msg_' + (item.id || ''),
        appareil: item.appareil || '',
        at: item.at || '',
        nom: item.nom || '',
        classe: item.classe || '',
        email: item.email || '',
        google: item.google || item.email || '',
        googleNom: item.googleNom || '',
        googleSub: item.googleSub || '',
        matieres: item.matieres || [],
        jours: item.jours || []
    };
}

function boitePersonnes(fusion) {
    var liste = (fusion && fusion.emplois || []).slice();
    (fusion && fusion.questions || []).concat(fusion && fusion.feedbacks || []).forEach(function (item) {
        var personne = boitePersonneDepuisMessage(item);
        if (personne) liste.push(personne);
    });
    return boiteFusionnerPersonnes(liste);
}

function boiteCompleterIdentite(record) {
    var session = boiteSession() || {};
    var snap = null;
    try { snap = boiteSnapshotEmploi(); } catch (e) { snap = null; }
    record.appareil = record.appareil || boiteAppareil();
    if (!record.nom) record.nom = boiteNom();
    if (!record.classe && typeof ibYear !== 'undefined') record.classe = ibYear || '';
    if (!record.googleSub && session.sub) record.googleSub = session.sub;
    if (!record.googleNom && (session.name || session.given_name)) record.googleNom = session.name || session.given_name;
    if (!record.google && session.email) record.google = session.email;
    if (snap) {
        if (!(record.matieres && record.matieres.length)) record.matieres = snap.matieres || [];
        if (!(record.jours && record.jours.length)) record.jours = snap.jours || [];
        if (!record.nom) record.nom = snap.nom || '';
        if (!record.classe) record.classe = snap.classe || '';
    }
    return record;
}

function boiteFusionner(items) {
    var questions = [];
    var feedbacks = [];
    var reponses = [];
    var profils = [];
    var connexions = [];
    var tutoriels = [];
    var annonces = [];
    var brutsEmplois = [];
    var vusQ = {};
    var vusF = {};
    var vusR = {};
    var vusP = {};
    var vusC = {};
    var vusT = {};
    (items || []).forEach(function (item) {
        if (!item || !item.type || item.type === 'coffre') return;
        /* Les envois de test de la vérification navigatrice ne doivent
           jamais s'afficher chez les admins. */
        if (typeof item.id === 'string' && (item.id.indexOf('qtest') === 0 || item.id.indexOf('ftest') === 0)) return;
        if (item.type === 'question' && item.id && !vusQ[item.id]) {
            vusQ[item.id] = 1;
            questions.push(item);
        } else if (item.type === 'feedback' && item.id && !vusF[item.id]) {
            vusF[item.id] = 1;
            feedbacks.push(item);
        } else if (item.type === 'reponse' && item.id) {
            if (!vusR[item.id]) {
                vusR[item.id] = 1;
                reponses.push(item);
            } else if (boiteMailConfirme(item)) {
                reponses.forEach(function (deja, index) {
                    if (deja.id === item.id && !boiteMailConfirme(deja)) reponses[index] = item;
                });
            }
        } else if (item.type === 'profil' && item.id) {
            if (!vusP[item.id]) {
                vusP[item.id] = 1;
                profils.push(item);
            } else if (item.data) {
                profils.forEach(function (deja, index) {
                    if (deja.id === item.id && !deja.data) profils[index] = item;
                });
            }
        } else if (item.type === 'connexion' && item.id) {
            if (!vusC[item.id]) {
                vusC[item.id] = 1;
                connexions.push(item);
            } else if (item.partage) {
                connexions.forEach(function (deja, index) {
                    if (deja.id === item.id && !deja.partage) connexions[index] = item;
                });
            }
        } else if (item.type === 'tutoriel' && item.id) {
            if (!vusT[item.id] || String(item.at || '') >= String(vusT[item.id].at || '')) vusT[item.id] = item;
        } else if (item.type === 'annonce' && item.id) {
            annonces.push(item);
        } else if (item.type === 'emploi') {
            if (!boiteEmploiRetire(item)) brutsEmplois.push(item);
        }
    });
    brutsEmplois = boiteReassemblerEmplois(brutsEmplois);
    var listeEmplois = boiteFusionnerPersonnes(brutsEmplois);
    questions.sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    feedbacks.sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    reponses.sort(function (a, b) { return String(a.at || '').localeCompare(String(b.at || '')); });
    listeEmplois.sort(function (a, b) { return boiteNormaliser(a.nom).localeCompare(boiteNormaliser(b.nom), 'fr'); });
    connexions.sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    Object.keys(vusT).forEach(function (id) { tutoriels.push(vusT[id]); });
    tutoriels.sort(function (a, b) { return String(a.at || '').localeCompare(String(b.at || '')); });
    if (typeof annonceFusionner === 'function') annonces = annonceFusionner(annonces);
    return {
        questions: questions.slice(0, 120),
        feedbacks: feedbacks.slice(0, 120),
        reponses: reponses.slice(0, 120),
        profils: profils.slice(0, 80),
        connexions: connexions.slice(0, 8),
        emplois: listeEmplois.slice(0, 300),
        tutoriels: tutoriels.slice(0, 40),
        annonces: annonces.slice(0, 40)
    };
}

/* Relit la boîte : Firestore pour tout le monde (partie publique), et
   la partie privée pour les quatre admins seulement. Le fichier local
   ne sert plus qu'à garder les envois pas encore partis. */
function boiteChargerListes(force) {
    if (boiteListesCache && !force) return Promise.resolve(boiteListesCache);
    return boiteLireBoite().then(function (items) {
        return { ok: !(boiteEstAdmin() && boiteErreurLecture), items: items };
    }, function () {
        return { ok: false, items: [] };
    }).then(function (source) {
        var items = boiteLireFile().concat(boiteLireVus(), source.items || []);
        var fusion = boiteFusionner(items);
        fusion.partiel = !source.ok;
        /* Un admin dont la session Firebase a expiré doit le savoir :
           sinon la boîte paraît vide sans raison. */
        fusion.reconnecter = !!(boiteEstAdmin() && boiteErreurLecture);
        boiteListesCache = fusion;
        boiteMemoriserVus(fusion);
        return fusion;
    });
}

function boiteCarte(titre, meta, corps) {
    return '<article style="background:white;border:1.5px solid #e5e7eb;border-radius:1rem;padding:0.9rem 1rem;margin-bottom:0.75rem;">'
        + '<p style="font-weight:800;color:#111827;">' + titre + '</p>'
        + '<p style="font-size:0.78rem;color:#6b7280;margin:0.2rem 0 0.55rem;">' + meta + '</p>'
        + '<p style="font-size:0.92rem;color:#1f2937;line-height:1.45;white-space:pre-wrap;">' + corps + '</p>'
        + '</article>';
}

function boiteRendreRetours(fusion) {
    var liste = document.getElementById('retoursListe');
    var statut = document.getElementById('retoursStatut');
    if (!liste) return;
    var cartes = [];
    fusion.feedbacks.forEach(function (item) {
        var qui = boiteNomExpediteur(item);
        var meta = boiteEchap(boiteDate(item.at)) + ' · ' + (item.email ? boiteEchap(item.email) : 'E-mail non renseigné');
        if (item.googleNom && item.nom && boiteNormaliser(item.nom) !== boiteNormaliser(item.googleNom)) {
            meta += ' · compte Google : ' + boiteEchap(item.googleNom);
        }
        cartes.push({
            at: item.at || '',
            html: boiteCarte(
                'Suggestion · ' + boiteEchap(qui.nom),
                meta,
                boiteEchap(item.texte || '')
            )
        });
    });
    fusion.questions.forEach(function (item) {
        cartes.push({
            at: item.at || '',
            html: boiteCarteQuestion(item, boiteReponsesLiees(fusion, item.id))
        });
    });
    cartes.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    if (!cartes.length) {
        liste.innerHTML = '<p style="color:#6b7280;">' + (fusion.reconnecter ? 'Connecte-toi avec ton compte Google, puis clique sur Actualiser.' : (fusion.partiel ? 'Les retours ne sont pas accessibles pour le moment. Réessaie.' : 'Aucun retour pour le moment.')) + '</p>';
    } else {
        liste.innerHTML = cartes.map(function (carte) { return carte.html; }).join('');
    }
    if (statut) {
        statut.textContent = fusion.partiel
            ? 'Une partie des messages n\'a pas pu être rechargée.'
            : (cartes.length + ' message' + (cartes.length > 1 ? 's' : ''));
    }
    boiteMajConnexion(fusion);
}

function boiteEmailQuestion(item) {
    return String((item && (item.email || item.google)) || '').trim();
}

function boiteEmailsDe(item) {
    var brut = [].concat(item && item.email, item && item.google, item && item.destinataire, item && item.destinataires);
    var out = [];
    brut.forEach(function (email) {
        var v = String(email || '').trim().toLowerCase();
        if (v && out.indexOf(v) === -1) out.push(v);
    });
    return out;
}

function boiteMemeDestinataire(rep, question) {
    var dest = boiteEmailsDe(rep);
    var src = boiteEmailsDe(question);
    if (!dest.length || !src.length) return false;
    return src.some(function (email) { return dest.indexOf(email) !== -1;});
}

function boiteMailConfirme(rep) {
    if (!rep) return false;
    if (rep.repondu) return true;
    if (rep.gmailId && String(rep.gmailId).length >= 16) return true;
    if (rep.mail === true && (rep.questionId || rep.destinataire || (rep.destinataires && rep.destinataires.length))) return true;
    return false;
}

function boiteIndexQuestions(fusion) {
    var ids = {};
    (fusion && fusion.questions || []).forEach(function (item) {
        if (item && item.id) ids[item.id] = 1;
    });
    return ids;
}

function boiteReponseLiee(rep, question, questions) {
    if (!rep || !question) return false;
    if (rep.questionId && rep.questionId === question.id) return true;
    if (rep.questionId && questions && questions[rep.questionId]) return false;
    if (!boiteMailConfirme(rep)) return false;
    /* Anciens envois, d'avant le numéro de question : on ne les rattache
       qu'à une question posée avant l'envoi et portant la même adresse.
       Avant, un simple prénom suffisait (« Kenza » ≈ « Kenzah ») : la
       réponse partie pour une autre question s'affichait sur celle de
       Kenzah, cochée comme répondue par Farid alors que non. */
    if (String(rep.at || '') < String(question.at || '')) return false;
    return boiteMemeDestinataire(rep, question);
}

function boiteReponsesPour(fusion, question) {
    var ids = boiteIndexQuestions(fusion);
    return (fusion && fusion.reponses || []).filter(function (rep) {
        return boiteReponseLiee(rep, question, ids);
    });
}

function boiteReponsesLiees(fusion, questionId) {
    var question = null;
    (fusion && fusion.questions || []).some(function (item) {
        if (item && item.id === questionId) { question = item; return true; }
        return false;
    });
    if (!question) {
        return (fusion && fusion.reponses || []).filter(function (rep) {
            return rep && rep.questionId === questionId;
        });
    }
    return boiteReponsesPour(fusion, question);
}

function boiteReponsesDe(fusion, questionId) {
    return boiteReponsesLiees(fusion, questionId).filter(boiteMailConfirme);
}

function boiteCase(cochee) {
    return '<input type="checkbox" disabled ' + (cochee ? 'checked' : '') + ' style="width:1.15rem;height:1.15rem;accent-color:#059669;flex:none;">';
}

function boiteCarteQuestion(item, reponses) {
    var compte = item.google ? boiteEchap(item.google) : 'Sans compte Google';
    if (item.googleNom) compte += ' · ' + boiteEchap(item.googleNom);
    var email = boiteEmailQuestion(item);
    var cochee = reponses.some(boiteMailConfirme);
    var html = '<article style="background:white;border:1.5px solid ' + (cochee ? '#a7f3d0' : '#e5e7eb') + ';border-radius:1rem;padding:0.9rem 1rem;margin-bottom:0.75rem;">'
        + '<div style="display:flex;align-items:flex-start;gap:0.65rem;">'
        + boiteCase(cochee)
        + '<div style="flex:1;min-width:0;">'
        + '<p style="font-weight:800;color:#111827;">' + boiteEchap(item.nom || 'Sans nom') + '</p>'
        + '<p style="font-size:0.78rem;color:#6b7280;margin:0.2rem 0 0.55rem;">' + boiteEchap(boiteDate(item.at)) + ' · Compte Google : ' + compte + '</p>'
        + '<p style="font-size:0.92rem;color:#1f2937;line-height:1.45;white-space:pre-wrap;">' + boiteEchap(item.texte || '') + '</p>';
    reponses.forEach(function (rep) {
        if (!String(rep.texte || '').trim()) return;
        var ok = boiteMailConfirme(rep) || cochee;
        html += '<div style="margin-top:0.75rem;background:#f0fdf4;border-radius:0.75rem;padding:0.7rem 0.8rem;">'
            + '<p style="font-size:0.75rem;font-weight:800;color:#047857;">' + (ok ? 'Message envoyé' : 'Envoi non confirmé') + ' · ' + boiteEchap(boiteDate(rep.at)) + (rep.nom ? ' · ' + boiteEchap(rep.nom) : '') + '</p>'
            + (rep.salutation ? '<p style="font-size:0.92rem;font-weight:800;color:#111827;white-space:nowrap;margin-top:0.25rem;">' + boiteEchap(rep.salutation) + '</p>' : '')
            + '<p style="font-size:0.88rem;color:#1f2937;white-space:pre-wrap;margin-top:0.25rem;">' + boiteEchap(rep.texte || '') + '</p>'
            + '<p style="font-size:0.75rem;color:#6b7280;margin-top:0.3rem;">' + (ok ? 'Mail confirmé à ' + boiteEchap(rep.destinataire || email) + ' par l\'équipe Study Plan IB' : 'Gmail n\'a pas confirmé cet envoi.') + '</p>'
            + '</div>';
    });
    if (!cochee) {
        if (!boiteEmailValide(email)) {
            html += '<p style="margin-top:0.75rem;font-size:0.84rem;color:#b45309;">Cette personne n\'a pas laissé d\'e-mail. Le mail ne peut pas partir.</p>';
        } else {
            var ligneMail = boiteSalutation(boiteNomPourMail(item), new Date());
            html += '<label style="display:block;margin-top:0.85rem;font-size:0.8rem;font-weight:700;color:#374151;">Message pour ' + boiteEchap(email) + '</label>'
                + '<p style="margin:0.35rem 0 0;font-size:0.95rem;font-weight:800;color:#111827;white-space:nowrap;">Le mail commencera par : ' + boiteEchap(ligneMail) + '</p>'
                + '<textarea data-reponse-texte="' + boiteEchap(item.id) + '" maxlength="800" rows="4" placeholder="Écris le message…" style="width:100%;box-sizing:border-box;margin-top:0.35rem;border:1.5px solid #e5e7eb;border-radius:0.8rem;padding:0.7rem 0.8rem;font:inherit;font-size:0.9rem;resize:vertical;outline:none;"></textarea>'
                + '<p style="font-size:0.75rem;color:#6b7280;margin-top:0.35rem;">Avant l\'envoi, le message est relu : orthographe, grammaire et conjugaison.</p>'
                + '<div data-reponse-analyse="' + boiteEchap(item.id) + '"></div>'
                + '<button type="button" data-repondre="' + boiteEchap(item.id) + '" style="width:100%;margin-top:0.55rem;padding:0.75rem 1rem;border:none;border-radius:0.8rem;background:#059669;color:white;font-weight:800;cursor:pointer;">Envoyer le mail et le message</button>'
                + '<p data-reponse-statut="' + boiteEchap(item.id) + '" style="min-height:1.1rem;margin-top:0.4rem;font-size:0.8rem;color:#047857;"></p>';
        }
    }
    html += '</div></div></article>';
    return html;
}

function boiteRendreQuestions(fusion) {
    var liste = document.getElementById('questionsListe');
    var statut = document.getElementById('questionsStatut');
    if (!liste) return;
    var attente = [];
    var repondues = [];
    (fusion.questions || []).forEach(function (item) {
        var reps = boiteReponsesLiees(fusion, item.id);
        var carte = boiteCarteQuestion(item, reps);
        if (boiteReponsesDe(fusion, item.id).length) repondues.push(carte);
        else attente.push(carte);
    });
    function bloc(titre, cartes, vide) {
        return '<section style="margin-bottom:1.25rem;">'
            + '<h3 style="font-size:0.95rem;font-weight:800;color:#111827;margin-bottom:0.65rem;">' + titre + '</h3>'
            + (cartes.length ? cartes.join('') : '<p style="color:#6b7280;margin-bottom:0.5rem;">' + vide + '</p>')
            + '</section>';
    }
    if (!fusion.questions.length && fusion.partiel) {
        liste.innerHTML = '<p style="color:#6b7280;">' + (fusion.reconnecter ? 'Connecte-toi avec ton compte Google, puis clique sur Actualiser.' : 'Les questions ne sont pas accessibles pour le moment. Réessaie.') + '</p>';
    } else {
        liste.innerHTML = '<section style="margin-bottom:1.25rem;">'
            + '<h3 style="font-size:0.95rem;font-weight:800;color:#111827;margin-bottom:0.35rem;">Questions en attente</h3>'
            + '<p style="font-size:0.78rem;color:#6b7280;margin-bottom:0.65rem;">Le mail part au nom de l\'équipe Study Plan IB. La première fois, Gmail peut le classer en indésirable.</p>'
            + (attente.length ? attente.join('') : '<p style="color:#6b7280;">Aucune question en attente.</p>')
            + '</section>'
            + bloc('Questions répondues', repondues, 'Aucune question répondue.');
    }
    if (statut) {
        statut.textContent = fusion.partiel
            ? 'Une partie des questions n\'a pas pu être rechargée.'
            : (attente.length + ' en attente · ' + repondues.length + ' répondue' + (repondues.length > 1 ? 's' : ''));
    }
}

function boiteOctets(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(String(str));
    var utf8 = unescape(encodeURIComponent(String(str)));
    var out = new Uint8Array(utf8.length);
    var i;
    for (i = 0; i < utf8.length; i++) out[i] = utf8.charCodeAt(i);
    return out;
}

function boiteBase64(str) {
    var bytes = boiteOctets(str);
    var bin = '';
    var i;
    for (i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

function boiteBase64Url(str) {
    return boiteBase64(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function boiteLignes(s) {
    return String(s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function boiteEchapHtml(s) {
    return boiteEchap(s).replace(/\n/g, '<br>');
}

function boitePrenom(nom) {
    var mot = String(nom || '').trim().split(/\s+/)[0] || '';
    if (mot.length < 2 || mot.length > 40) return '';
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'\u2019-]+$/.test(mot)) return '';
    return mot.charAt(0).toUpperCase() + mot.slice(1);
}

function boiteSujetMail(question) {
    var extrait = String(question || '').replace(/\s+/g, ' ').trim();
    if (extrait.length > 48) extrait = extrait.slice(0, 48).trim();
    if (!extrait) return 'Réponse à ta question — Study Plan IB';
    return ('Re: ' + extrait + ' — Study Plan IB').slice(0, 180);
}

function boitePeriodeSalutation(quand) {
    var date = quand instanceof Date ? quand : new Date();
    var heure = date.getHours();
    return (heure >= 5 && heure < 18) ? 'Bonjour' : 'Bonsoir';
}

function boiteNomCourrier(nom) {
    var propre = String(nom || '').replace(/\s+/g, ' ').trim();
    if (!propre) return '';
    if (propre.indexOf('@') !== -1) propre = propre.split('@')[0].replace(/[._+-]+/g, ' ');
    propre = propre.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'’.\- ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (propre.length < 2) return '';
    if (propre.length > 48) propre = propre.slice(0, 48).trim();
    if (propre !== propre.toLowerCase()) return propre;
    return propre.split(' ').map(function (mot) {
        return mot ? mot.charAt(0).toUpperCase() + mot.slice(1) : '';
    }).join(' ');
}

function boiteNomPourMail(question) {
    var candidats = [];
    var email = String(question && (question.email || question.google) || '').trim().toLowerCase();
    if (question) candidats.push(question.nom, question.googleNom);
    var fusion = typeof boiteListesCache !== 'undefined' ? boiteListesCache : null;
    ['emplois', 'profils', 'questions', 'feedbacks'].forEach(function (cle) {
        ((fusion && fusion[cle]) || []).forEach(function (item) {
            if (!item) return;
            var mail = String(item.google || item.email || '').trim().toLowerCase();
            if (!email || mail !== email) return;
            candidats.push(item.nom, item.googleNom);
        });
    });
    if (email) candidats.push(email.split('@')[0].replace(/[._+-]+/g, ' '));
    var i, nom;
    for (i = 0; i < candidats.length; i++) {
        nom = boiteNomCourrier(candidats[i]);
        if (nom && nom.toLowerCase() !== 'sans nom') return nom;
    }
    return '';
}

function boiteSalutation(nom, quand) {
    var mot = boitePeriodeSalutation(quand);
    var qui = boiteNomCourrier(nom);
    return qui ? (mot + ' ' + qui + ',') : (mot + ',');
}

function boiteTexteMail(message, question, nom, quand) {
    var texte = boiteSalutation(nom, quand) + '\n\n' + boiteLignes(message);
    if (boiteLignes(question)) texte += '\n\nTa question :\n' + boiteLignes(question);
    texte += '\n\nÀ bientôt,\nL\'équipe Study Plan IB';
    return texte.slice(0, 4000);
}

function boiteHtmlMail(message, question, nom, quand) {
    var ligne = boiteSalutation(nom, quand);
    var questionHtml = '';
    if (boiteLignes(question)) {
        questionHtml = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;background:#f7f8f7;border-radius:12px;">'
            + '<tr><td style="padding:16px 18px;border-left:3px solid #34d399;">'
            + '<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#047857;">Ta question</p>'
            + '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#4b5563;">' + boiteEchapHtml(boiteLignes(question)) + '</p>'
            + '</td></tr></table>';
    }
    return '<div style="display:none;max-height:0;overflow:hidden;">' + boiteEchap(ligne) + ' — Study Plan IB</div>'
        + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">'
        + '<tr><td align="center" style="padding:24px 12px;">'
        + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">'
        + '<tr><td style="background:#059669;padding:22px 28px;">'
        + '<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
        + '<td style="padding-right:14px;vertical-align:middle;"><img src="https://sawadogojuliss-byte.github.io/Learning-DP1/images/logo.png" width="46" height="46" alt="" style="display:block;border:0;border-radius:12px;background:#ecfdf5;"></td>'
        + '<td style="vertical-align:middle;">'
        + '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#d1fae5;">Study Plan IB</p>'
        + '<p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.15;font-weight:700;color:#ffffff;white-space:nowrap;">' + boiteEchap(ligne) + '</p>'
        + '<p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.3;color:#d1fae5;">Réponse à ta question</p>'
        + '</td></tr></table></td></tr>'
        + '<tr><td style="padding:32px 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1f2937;">'
        + '<p style="margin:0 0 18px;font-size:18px;font-weight:700;color:#111827;white-space:nowrap;">' + boiteEchap(ligne) + '</p>'
        + '<p style="margin:0;">' + boiteEchapHtml(boiteLignes(message)) + '</p>'
        + questionHtml
        + '<p style="margin:28px 0 0;">À bientôt,</p>'
        + '<p style="margin:4px 0 0;font-weight:700;color:#047857;">L\'équipe Study Plan IB</p>'
        + '</td></tr></table></td></tr></table>';
}

function boiteMessageEchecMail(err, data) {
    var type = err && (err.type || err.message) || '';
    var api = data && data.error ? String(data.error.message || data.error.status || '') : '';
    if (type === 'salutation') return 'Le mail doit commencer par Bonjour ou Bonsoir, avec le nom sur la même ligne. Il n\'est pas parti.';
    if (type === 'script') return 'L\'envoi au nom de l\'équipe Study Plan IB n\'est pas encore activé. La question reste en attente.';
    if (type === 'compte') return 'Le mail doit partir de ibstudyplan@gmail.com. La question reste en attente.';
    if (type === 'popup_failed_to_open') return 'Autorise la fenêtre Google, puis réessaie. La question reste en attente.';
    if (type === 'popup_closed') return 'La fenêtre Google a été fermée. La question reste en attente.';
    if (/SERVICE_DISABLED|accessNotConfigured|has not been used/i.test(api)) {
        return 'Le service Gmail n\'est pas activé. La question reste en attente.';
    }
    return 'Gmail n\'a pas confirmé l\'envoi. La question reste en attente.';
}

function boiteConnexionPartagee(fusion) {
    var liste = (fusion && fusion.connexions) || [];
    var i;
    for (i = 0; i < liste.length; i++) {
        if (liste[i] && liste[i].partage && compteEmailCleSafe(liste[i].email) === compteEmailCleSafe(BOITE_EXPEDITEUR)) return liste[i];
    }
    return null;
}

function compteEmailCleSafe(email) {
    return String(email || '').trim().toLowerCase();
}

function boiteConnecterPartage() {
    var record = {
        type: 'connexion',
        id: 'connexion-admins',
        at: new Date().toISOString(),
        email: BOITE_EXPEDITEUR,
        partage: true,
        nom: boiteNom()
    };
    return boiteEnvoyer(record).then(function () {
        if (boiteListesCache) {
            boiteListesCache.connexions = [record].concat(boiteListesCache.connexions || []);
        }
        boiteMajConnexion(boiteListesCache || { connexions: [record] });
        return record;
    });
}

function boiteMajConnexion() {
    var texte = document.getElementById('retoursPartageTexte');
    if (texte) texte.textContent = 'Les réponses partent au nom de l\'équipe Study Plan IB.';
}

function boiteNonce() {
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var s = '';
    var i;
    for (i = 0; i < 24; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
}

function boiteMailAccepte(data, nonce) {
    return !!(data && nonce && String(data.id || '') === String(nonce));
}

function boiteUrlScript() {
    return boiteFetch('data/mail-script.json?t=' + Date.now(), { cache: 'no-store' }, 8000).then(function (res) {
        return res.ok ? res.json() : {};
    }).catch(function () {
        return {};
    }).then(function (data) {
        var url = String((data && data.url) || '').trim();
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) {
            throw new Error('script');
        }
        return url;
    });
}

/* Le secret d'envoi n'est plus écrit dans la page : il vit dans le
   document Firestore « config/mail », que seuls les admins peuvent
   lire. Un élève qui ouvre le code ne le voit donc jamais. */
var boiteSecretCache = '';

function boiteSecretMail() {
    if (boiteSecretCache) return Promise.resolve(boiteSecretCache);
    return boiteFirebasePret().then(function (user) {
        if (!user || !boiteEstAdmin()) throw new Error('script');
        return firebase.firestore().collection('config').doc('mail').get();
    }).then(function (snap) {
        var data = snap && snap.exists ? snap.data() : null;
        var secret = data && data.secret ? String(data.secret) : '';
        if (!secret) throw new Error('script');
        boiteSecretCache = secret;
        return secret;
    }).catch(function () {
        throw new Error('script');
    });
}

function boitePayloadMail(email, message, question, nonce, nom, quand, secret) {
    var moment = quand instanceof Date ? quand : new Date();
    var destinataire = boiteNomCourrier(nom) || boiteNomPourMail({ email: email, nom: nom });
    var ligne = boiteSalutation(destinataire, moment);
    return {
        secret: secret || '',
        nonce: nonce,
        to: email,
        replyTo: BOITE_EXPEDITEUR,
        nom: destinataire,
        salutation: ligne,
        subject: 'Réponse à ta question — Study Plan IB',
        text: boiteTexteMail(message, question, destinataire, moment),
        html: boiteHtmlMail(message, question, destinataire, moment)
    };
}

function boiteMailCommenceBien(payload) {
    var ligne = String(payload && payload.salutation || '');
    var texte = String(payload && payload.text || '');
    var html = String(payload && payload.html || '');
    if (!/^(Bonjour|Bonsoir) [^,\n]+,$/.test(ligne)) return false;
    if (texte.indexOf(ligne + '\n') !== 0) return false;
    if (html.indexOf('>' + ligne + '<') === -1) return false;
    return true;
}

function boitePosterFormulaire(url, payload) {
    var nom = 'boiteMail' + Date.now();
    var cadre = document.createElement('iframe');
    cadre.name = nom;
    cadre.title = '';
    cadre.setAttribute('style', 'position:absolute;width:1px;height:1px;left:-9999px;border:0;');
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    form.target = nom;
    form.acceptCharset = 'UTF-8';
    var champ = document.createElement('input');
    champ.type = 'hidden';
    champ.name = 'payload';
    champ.value = JSON.stringify(payload);
    form.appendChild(champ);
    document.body.appendChild(cadre);
    document.body.appendChild(form);
    form.submit();
    return new Promise(function (resolve) { setTimeout(resolve, 400); });
}

function boitePosterChamps(url, payload) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
        xhr.onload = function () {
            var data = {};
            try { data = JSON.parse(xhr.responseText); } catch (e) {}
            if (xhr.status === 200 && boiteMailAccepte(data, payload.nonce)) resolve(data);
            else reject(new Error('mail'));
        };
        xhr.onerror = function () { reject(new Error('mail')); };
        xhr.send(Object.keys(payload).map(function (cle) {
            return encodeURIComponent(cle) + '=' + encodeURIComponent(payload[cle]);
        }).join('&'));
    });
}

function boiteEnvoyerMail(destinataire, message, question, nom, quand) {
    var email = String(destinataire || '').trim();
    if (!boiteEmailValide(email)) return Promise.reject(new Error('email'));
    var nonce = boiteNonce();
    var moment = quand instanceof Date ? quand : new Date();
    return Promise.all([boiteUrlScript(), boiteSecretMail()]).then(function (prets) {
        var url = prets[0];
        var payload = boitePayloadMail(email, message, question, nonce, nom, moment, prets[1]);
        if (!boiteMailCommenceBien(payload)) return Promise.reject(new Error('salutation'));
        return fetch(url, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (res.ok && boiteMailAccepte(data, nonce)) return data;
                return boitePosterChamps(url, payload);
            });
        }).catch(function () {
            return boitePosterChamps(url, payload);
        });
    });
}

function boiteDireDans(el, texte, erreur) {
    if (!el) return;
    el.textContent = texte;
    el.style.color = erreur ? '#b45309' : '#047857';
}

function boiteMontrerAnalyse(questionId, article, texte, erreurs) {
    var zone = article ? article.querySelector('[data-reponse-analyse]') : document.querySelector('[data-reponse-analyse="' + questionId + '"]');
    if (!zone) return;
    if (!erreurs || !erreurs.length) {
        zone.innerHTML = '';
        return;
    }
    var lignes = erreurs.map(function (err) {
        var extrait = texte.slice(err.debut, err.fin);
        var suggestion = err.suggestions && err.suggestions.length ? ' Suggestion : « ' + err.suggestions[0] + ' ».' : '';
        var etiquette = typeof langueEtiquette === 'function' ? langueEtiquette(err.type) : 'À corriger';
        return '<li style="margin:0.35rem 0;"><strong>' + boiteEchap(etiquette) + '.</strong> « ' + boiteEchap(extrait) + ' » — ' + boiteEchap(err.message) + boiteEchap(suggestion) + '</li>';
    }).join('');
    var apercu = typeof langueMarquer === 'function' ? langueMarquer(texte, erreurs) : boiteEchap(texte);
    zone.innerHTML = '<div style="margin-top:0.7rem;background:#fffbeb;border:1.5px solid #fcd34d;border-radius:0.8rem;padding:0.75rem 0.8rem;">'
        + '<p style="font-weight:800;color:#92400e;margin:0;">Corrige ces points avant l\'envoi. Le mail n\'est pas parti.</p>'
        + '<p style="font-size:0.9rem;line-height:1.45;white-space:pre-wrap;margin:0.55rem 0 0;color:#1f2937;">' + apercu + '</p>'
        + '<ul style="margin:0.55rem 0 0;padding-left:1.1rem;color:#78350f;font-size:0.84rem;">' + lignes + '</ul>'
        + '<button type="button" data-repondre-quand-meme="' + boiteEchap(questionId) + '" style="width:100%;margin-top:0.7rem;padding:0.7rem 1rem;border:1.5px solid #d97706;border-radius:0.8rem;background:white;color:#92400e;font-weight:800;cursor:pointer;">Envoyer malgré ces remarques</button>'
        + '</div>';
    if (zone.scrollIntoView) zone.scrollIntoView({ block: 'nearest' });
}

function boiteRepondre(questionId, origine, forcer) {
    if (!boiteEstAdmin() || !boiteListesCache) return;
    var question = null;
    (boiteListesCache.questions || []).some(function (item) {
        if (item.id === questionId) { question = item; return true; }
        return false;
    });
    var article = origine && origine.closest ? origine.closest('article') : null;
    var zone = article ? article.querySelector('[data-reponse-statut]') : document.querySelector('[data-reponse-statut="' + questionId + '"]');
    var champ = article ? article.querySelector('[data-reponse-texte]') : document.querySelector('[data-reponse-texte="' + questionId + '"]');
    var bouton = article ? article.querySelector('[data-repondre]') : document.querySelector('[data-repondre="' + questionId + '"]');
    if (!question) return;
    var email = boiteEmailQuestion(question);
    var texte = champ ? champ.value.trim() : '';
    if (!boiteEmailValide(email)) {
        boiteDireDans(zone, 'Cette personne n\'a pas laissé d\'e-mail.', true);
        return;
    }
    if (texte.length < 2) {
        boiteDireDans(zone, 'Écris le message avant de l\'envoyer.', true);
        return;
    }
    if (bouton && bouton.disabled) return;
    if (bouton) bouton.disabled = true;
    function envoyer() {
        boiteMontrerAnalyse(questionId, article, texte, []);
        var nomMail = boiteNomPourMail(question);
        var quand = new Date();
        var ligneMail = boiteSalutation(nomMail, quand);
        boiteDireDans(zone, 'Envoi vers ' + email + ' — ' + ligneMail, false);
        boiteEnvoyerMail(email, texte.slice(0, 800), question.texte || '', nomMail, quand).then(function (data) {
            var gmailId = String(data && data.id || '');
            var record = {
                type: 'reponse',
                id: boiteId('r'),
                questionId: question.id,
                at: new Date().toISOString(),
                nom: boiteNom(),
                email: BOITE_EXPEDITEUR,
                destinataire: email,
                texte: texte.slice(0, 800),
                salutation: ligneMail,
                mail: true,
                repondu: true,
                gmailId: gmailId.length >= 16 ? gmailId : '',
                partage: true
            };
            boiteGarderVu(record);
            boiteListesCache.reponses = (boiteListesCache.reponses || []).concat([record]);
            boiteRendreQuestions(boiteListesCache);
            boiteRendreRetours(boiteListesCache);
            boiteEnvoyer(record).catch(function () {});
        }).catch(function (err) {
            if (bouton) bouton.disabled = false;
            boiteDireDans(zone, boiteMessageEchecMail(err, err && err.api), true);
        });
    }
    if (forcer || typeof langueAnalyser !== 'function') {
        envoyer();
        return;
    }
    boiteDireDans(zone, 'Vérification de l\'orthographe, de la grammaire et de la conjugaison…', false);
    langueAnalyser(texte.slice(0, 800)).then(function (erreurs) {
        if (erreurs && erreurs.length) {
            if (bouton) bouton.disabled = false;
            boiteDireDans(zone, 'Le message n\'a pas été envoyé. Les erreurs sont indiquées ci-dessus.', true);
            boiteMontrerAnalyse(questionId, article, texte.slice(0, 800), erreurs);
            return;
        }
        envoyer();
    }).catch(function () {
        envoyer();
    });
}

function boiteRendreEmplois(fusion) {
    var liste = document.getElementById('emploisListe');
    var statut = document.getElementById('emploisStatut');
    var filtre = document.getElementById('emploisFiltre');
    if (!liste) return;
    var mot = boiteNormaliser(filtre ? filtre.value : '');
    var personnes = boitePersonnes(fusion);
    var doublons = {};
    personnes.forEach(function (item) {
        var g = boiteNormaliser(item.google || item.email || '');
        if (g) doublons[g] = (doublons[g] || 0) + 1;
    });
    function boiteJourAffiche(jour) {
    var slots = (jour && jour.s ? jour.s : []).slice();
    if (boiteNormaliser(jour && jour.j).indexOf('samedi') !== -1) {
        slots = slots.filter(function (slot) {
            return boiteNormaliser(slot && slot.t).indexOf('cours d economie') === -1;
        });
    }
    var incomplet = boiteJourIncomplet(slots);
    if (incomplet) {
        [{ d: '12:30', f: '13:30', t: 'Déjeuner' }, { d: '13:30', f: '16:25', t: 'Cours' }].forEach(function (slot) {
            if (!slots.some(function (s) { return s.d === slot.d; })) slots.push(Object.assign({ ajoute: true }, slot));
        });
    }
    return { slots: boiteOrdonnerCreneaux(slots), incomplet: incomplet };
}
    var rows = personnes.filter(function (item) {
        if (!item || boiteEmploiRetire(item)) return false;
        if (!mot) return true;
        return boiteNormaliser((item.nom || '') + ' ' + (item.classe || '') + ' ' + (item.google || '') + ' ' + (item.email || '')).indexOf(mot) !== -1;
    });
    if (!rows.length) {
        var vide = personnes.length ? 'Aucun nom ne correspond.'
            : (fusion.reconnecter ? 'Connecte-toi avec ton compte Google, puis clique sur Actualiser.'
                : (fusion.partiel ? 'Les emplois du temps ne sont pas accessibles pour le moment. Réessaie.'
                    : 'Aucune inscription reçue pour le moment. Chaque personne apparaît ici une seule fois, dès qu\'elle génère son planning ou envoie une question.'));
        liste.innerHTML = '<p style="color:#6b7280;">' + vide + '</p>';
    } else {
        liste.innerHTML = rows.map(function (item) {
            var incomplet = false;
            var jours = (item.jours || []).map(function (jour) {
                var affiche = boiteJourAffiche(jour);
                if (affiche.incomplet) incomplet = true;
                var slots = affiche.slots.map(function (slot) {
                    var ajoute = !!(slot && slot.ajoute);
                    return '<p style="font-size:0.84rem;color:' + (ajoute ? '#6b7280' : '#1f2937') + ';margin:0.15rem 0;">' + boiteEchap(slot.d || '') + '–' + boiteEchap(slot.f || '') + '  ' + boiteEchap(slot.t || '') + (ajoute ? ' · cours fixe' : '') + '</p>';
                }).join('');
                return '<div style="margin-top:0.55rem;"><p style="font-size:0.75rem;font-weight:800;color:#047857;text-transform:uppercase;">' + boiteEchap(jour.j || '') + '</p>' + slots + '</div>';
            }).join('');
            if (incomplet) jours += '<p style="font-size:0.78rem;color:#b45309;margin-top:0.55rem;">La fin de journée n\'avait pas été reçue. Elle s\'ajoute dès que cet appareil rouvre le site.</p>';
            if (!jours) jours = '<p style="color:#6b7280;margin-top:0.45rem;">Le planning n\'est pas encore arrivé. Il s\'affiche ici dès que cette personne rouvre Study Plan IB.</p>';
            var nomAffiche = item.nom || item.googleNom || 'Sans nom';
            var google = item.google || item.email || '';
            var googleLigne = google
                ? 'Compte Google : ' + boiteEchap(google) + (item.googleNom ? ' · ' + boiteEchap(item.googleNom) : '')
                : 'Compte Google : pas encore connecté';
            var flammes = Number(item.flammes || 0);
            var flammeTexte = flammes ? (flammes + ' jour' + (flammes > 1 ? 's' : '') + " d'affilée") : 'pas encore de série';
            var meta = 'Classe : ' + boiteEchap(item.classe || 'non indiquée') + ' · Nom : ' + boiteEchap(nomAffiche) + ' · ' + googleLigne;
            var matieres = (item.matieres || []).length
                ? '<p style="font-size:0.8rem;color:#374151;margin-top:0.35rem;">Matières : ' + boiteEchap(item.matieres.join(', ')) + '</p>'
                : '';
            return '<details open style="background:white;border:1.5px solid #e5e7eb;border-radius:1rem;padding:0.85rem 1rem;margin-bottom:0.7rem;">'
                + '<summary style="cursor:pointer;font-weight:800;color:#111827;">' + boiteEchap(nomAffiche) + ' <span style="font-weight:600;color:#6b7280;">· ' + boiteEchap(item.classe || 'Classe non indiquée') + '</span> <span style="font-weight:800;color:#c2410c;">· 🔥 ' + boiteEchap(flammeTexte) + '</span></summary>'
                + '<p style="font-size:0.78rem;color:#6b7280;margin-top:0.35rem;">' + meta + '</p>'
                + '<p style="font-size:0.84rem;font-weight:800;color:#c2410c;margin-top:0.25rem;">🔥 ' + boiteEchap(flammeTexte) + '</p>'
                + matieres
                + jours
                + '</details>';
        }).join('');
    }
    if (statut) {
        var n = personnes.length;
        statut.textContent = (fusion.partiel ? 'Une partie des plannings n\'a pas pu être rechargée. ' : '') + n + ' personne' + (n > 1 ? 's' : '');
    }
    boiteEmploisSignature = boiteSignatureEmplois(fusion);
}

function boiteSignatureEmplois(fusion) {
    return JSON.stringify(boitePersonnes(fusion).map(function (item) {
        return [item.nom || '', item.classe || '', item.google || item.email || '', item.flammes || 0, item.jours || []];
    }));
}

var boiteEmploisTimer = null;
var boiteEmploisSignature = '';
function boiteSurveillerEmplois() {
    if (boiteEmploisTimer) return;
    boiteEmploisTimer = setInterval(function () {
        var panneau = document.getElementById('panelEmplois');
        if (!panneau || !panneau.classList.contains('active') || !boiteEstAdmin()) return;
        boiteChargerListes(true).then(function (fusion) {
            if (!document.getElementById('panelEmplois') || !document.getElementById('panelEmplois').classList.contains('active')) return;
            var sig = boiteSignatureEmplois(fusion);
            if (sig === boiteEmploisSignature) return;
            boiteRendreEmplois(fusion);
        }).catch(function () {});
    }, 10000);
}

function boiteOuvrirAdmin(page) {
    if (!boiteEstAdmin()) {
        navigateTo('planning');
        return;
    }
    boiteMajMenu();
    var id = page === 'retours' ? 'panelRetours' : (page === 'questions' ? 'panelQuestions' : 'panelEmplois');
    var panneau = document.getElementById(id);
    if (panneau) panneau.classList.add('active');
    boiteBrancherAdmin();
    var statut = document.getElementById(page === 'retours' ? 'retoursStatut' : (page === 'questions' ? 'questionsStatut' : 'emploisStatut'));
    if (statut && !boiteListesCache) statut.textContent = 'Chargement…';
    boiteChargerListes(false).then(function (fusion) {
        if (page === 'retours') boiteRendreRetours(fusion);
        else if (page === 'questions') boiteRendreQuestions(fusion);
        else boiteRendreEmplois(fusion);
    });
    if (page !== 'retours' && page !== 'questions') boiteSurveillerEmplois();
}

function boiteRafraichirAdmin() {
    ['retoursStatut', 'questionsStatut', 'emploisStatut'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.textContent = 'Chargement…';
    });
    boiteListesCache = null;
    boiteChargerListes(true).then(function (fusion) {
        boiteRendreRetours(fusion);
        boiteRendreQuestions(fusion);
        boiteRendreEmplois(fusion);
    });
}

function boiteBrancherAdmin() {
    if (boiteAdminBranche) return;
    boiteAdminBranche = true;
    ['retoursRafraichir', 'questionsRafraichir', 'emploisRafraichir'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.onclick = boiteRafraichirAdmin;
    });
    var partager = document.getElementById('retoursConnecter');
    if (partager) partager.onclick = function () {
        partager.disabled = true;
        boiteConnecterPartage().then(function () {
            partager.disabled = false;
            if (boiteListesCache) boiteRendreRetours(boiteListesCache);
        }).catch(function () {
            partager.disabled = false;
            var texte = document.getElementById('retoursPartageTexte');
            if (texte) texte.textContent = 'La boîte n’a pas pu être connectée. Réessaie.';
        });
    };
    var filtre = document.getElementById('emploisFiltre');
    if (filtre) filtre.oninput = function () {
        if (boiteListesCache) boiteRendreEmplois(boiteListesCache);
    };
    ['questionsListe', 'retoursListe'].forEach(function (id) {
        var liste = document.getElementById(id);
        if (!liste || liste.__boite) return;
        liste.__boite = true;
        liste.addEventListener('click', function (e) {
            var force = e.target && e.target.closest ? e.target.closest('[data-repondre-quand-meme]') : null;
            var btn = force || (e.target && e.target.closest ? e.target.closest('[data-repondre]') : null);
            if (!btn) return;
            boiteRepondre(btn.getAttribute('data-repondre') || btn.getAttribute('data-repondre-quand-meme'), btn, !!force);
        });
    });
}

function boiteNom() {
    /* Un admin connecté avec son compte Google signe toujours du nom
       gardé : un seul compte, une seule fiche, quel que soit l'appareil. */
    var session = (typeof boiteSession === 'function') ? boiteSession() : null;
    var garde = session && session.sub ? BOITE_ADMINS_NOM[String(session.sub)] : '';
    if (garde) return garde;
    return (typeof userName !== 'undefined' && userName) ? String(userName).trim() : '';
}

function boiteDire(id, texte, erreur) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = texte;
    el.style.color = erreur ? '#b45309' : '#047857';
}

function boiteSession() {
    var session = window.compteSession;
    if (!session || !session.sub) {
        try {
            var cle = typeof COMPTE_SESSION_KEY !== 'undefined' ? COMPTE_SESSION_KEY : 'studyPlanIB_googleSession';
            session = JSON.parse(localStorage.getItem(cle) || 'null');
            if (session && session.sub) window.compteSession = session;
        } catch (e) {
            session = null;
        }
    }
    return (session && session.sub) ? session : null;
}

function boiteLierGoogle() {
    return Promise.resolve(boiteSession());
}

function boiteQuestion(session) {
    var texte = document.getElementById('aideTexte');
    var valeur = texte ? texte.value.trim() : '';
    if (valeur.length < 3) {
        boiteDire('aideStatut', 'Écris ta question avant de l\'envoyer.', true);
        return;
    }
    if (boiteEnvoiEnCours) return;
    boiteEnvoiEnCours = true;
    boiteDire('aideStatut', 'Envoi…', false);
    var champMail = document.getElementById('aideEmail');
    var emailSaisi = champMail ? String(champMail.value || '').trim() : '';
    var email = boiteEmailValide(emailSaisi) ? emailSaisi : (session && session.email ? session.email : '');
    if (!boiteEmailValide(email)) {
        boiteEnvoiEnCours = false;
        boiteDire('aideStatut', 'Indique ton e-mail pour recevoir la réponse.', true);
        return;
    }
    var record;
    try {
        record = boiteCompleterIdentite({
            type: 'question',
            id: boiteId('q'),
            at: new Date().toISOString(),
            nom: boiteNom(),
            texte: valeur.slice(0, 800),
            email: email,
            google: email,
            googleNom: session && session.name ? session.name : '',
            googleSub: session && session.sub ? session.sub : ''
        });
        /* L'emploi du temps part à part : s'il échoue, la question part quand même. */
        try { boitePublierEmploi(true); } catch (e) {}
    } catch (e) {
        boiteEnvoiEnCours = false;
        boiteDire('aideStatut', 'L\'envoi n\'a pas abouti. Ta question est encore là : réessaie.', true);
        return;
    }
    boiteEnvoyer(record).then(function () {
        if (texte) texte.value = '';
        var choix = document.getElementById('aideChoix');
        if (choix) choix.style.display = 'none';
        boiteDire('aideStatut', 'Question envoyée.', false);
    }).catch(function () {
        boiteDire('aideStatut', 'L\'envoi n\'a pas abouti. Ta question est encore là : réessaie.', true);
    }).then(function () {
        boiteEnvoiEnCours = false;
    });
}

function initAide() {
    boiteMajMenu();
    boiteReessayerUneFois();
    var nom = document.getElementById('aideNom');
    if (nom) nom.textContent = boiteNom() || 'Ton prénom';
    var mailAide = document.getElementById('aideEmail');
    var sessionAide = boiteSession();
    if (mailAide && !mailAide.value && sessionAide && sessionAide.email) mailAide.value = sessionAide.email;
    var choix = document.getElementById('aideChoix');
    if (choix) choix.style.display = 'none';
    if (aideBranchee) return;
    aideBranchee = true;
    var envoi = document.getElementById('aideEnvoi');
    var avec = document.getElementById('aideAvecGoogle');
    if (envoi) envoi.onclick = function () {
        var texte = document.getElementById('aideTexte');
        if (!texte || texte.value.trim().length < 3) {
            boiteDire('aideStatut', 'Écris ta question avant de l\'envoyer.', true);
            return;
        }
        if (choix) choix.style.display = 'none';
        boiteQuestion(boiteSession());
    };
    if (avec) avec.onclick = function () {
        if (choix) choix.style.display = 'none';
        boiteQuestion(boiteSession());
    };
}

function initFeedback() {
    boiteMajMenu();
    var nom = document.getElementById('feedbackNom');
    if (nom) nom.textContent = boiteNom() || 'toi';
    var email = document.getElementById('feedbackEmail');
    var session = boiteSession();
    if (email && !email.value && session && session.email) email.value = session.email;
    if (feedbackBranche) return;
    feedbackBranche = true;
    var envoi = document.getElementById('feedbackEnvoi');
    if (!envoi) return;
    envoi.onclick = function () {
        var champ = document.getElementById('feedbackTexte');
        var mail = document.getElementById('feedbackEmail');
        var texte = champ ? champ.value.trim() : '';
        var adresse = mail ? mail.value.trim() : '';
        if (!boiteEmailValide(adresse)) {
            boiteDire('feedbackStatut', 'Indique un e-mail valide pour que la réponse puisse te revenir.', true);
            return;
        }
        if (texte.length < 3) {
            boiteDire('feedbackStatut', 'Écris ta suggestion avant de l\'envoyer.', true);
            return;
        }
        if (boiteEnvoiEnCours) return;
        boiteEnvoiEnCours = true;
        boiteDire('feedbackStatut', 'Envoi…', false);
        var sessionEnvoi = boiteSession();
        var record;
        try {
            record = boiteCompleterIdentite({
                type: 'feedback',
                id: boiteId('f'),
                at: new Date().toISOString(),
                nom: boiteNom(),
                texte: texte.slice(0, 800),
                email: adresse.slice(0, 120),
                google: sessionEnvoi && sessionEnvoi.email ? sessionEnvoi.email : adresse.slice(0, 120),
                googleNom: sessionEnvoi && sessionEnvoi.name ? sessionEnvoi.name : '',
                googleSub: sessionEnvoi && sessionEnvoi.sub ? sessionEnvoi.sub : ''
            });
            try { boitePublierEmploi(true); } catch (e) {}
        } catch (e) {
            boiteEnvoiEnCours = false;
            boiteDire('feedbackStatut', 'L\'envoi n\'a pas abouti. Ta suggestion est encore là : réessaie.', true);
            return;
        }
        boiteEnvoyer(record).then(function () {
            if (champ) champ.value = '';
            boiteDire('feedbackStatut', 'Suggestion envoyée.', false);
        }).catch(function () {
            boiteDire('feedbackStatut', 'L\'envoi n\'a pas abouti. Ta suggestion est encore là : réessaie.', true);
        }).then(function () {
            boiteEnvoiEnCours = false;
        });
    };
}

function boiteSnapshotEmploi() {
    if (typeof generateDayEvents !== 'function') return null;
    if (!boiteNom()) return null;
    var noms = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    var jours = [];
    var i;
    for (i = 0; i < 7; i++) {
        var evs = [];
        try { evs = generateDayEvents(i) || []; } catch (e) { evs = []; }
        var slots = [];
        var k;
        for (k = 0; k < evs.length && slots.length < 40; k++) {
            var ev = evs[k];
            if (!ev || !ev.title || !ev.startTime) continue;
            if (i === 5 && (ev.id === 'eco' || boiteNormaliser(ev.title).indexOf('cours d economie') !== -1)) continue;
            slots.push({ d: ev.startTime, f: ev.endTime || '', t: String(ev.title).slice(0, 42) });
        }
        if (slots.length) jours.push({ j: noms[i], s: slots });
    }
    var session = (typeof boiteSession === 'function' ? boiteSession() : null) || window.compteSession || {};
    var matieres = [];
    var liste = [];
    if (typeof subjects !== 'undefined' && Array.isArray(subjects)) liste = liste.concat(subjects);
    if (typeof optionalSubjects !== 'undefined' && Array.isArray(optionalSubjects)) liste = liste.concat(optionalSubjects);
    liste.forEach(function (s) {
        if (!s || !s.name || matieres.length >= 6) return;
        matieres.push((s.name + (s.level ? ' ' + s.level : '')).trim());
    });
    if (!jours.length && !matieres.length && !window.__profilComplet) return null;
    return {
        type: 'emploi',
        id: 'e_' + boiteAppareil(),
        appareil: boiteAppareil(),
        at: new Date().toISOString(),
        nom: boiteNom(),
        classe: typeof ibYear !== 'undefined' ? (ibYear || '') : '',
        email: session.email || '',
        google: session.email || '',
        googleNom: session.name || session.given_name || '',
        googleSub: session.sub || '',
        matieres: matieres,
        jours: jours,
        flammes: boiteFlammes(),
        complet: 0
    };
}

var boiteStabiliseTimer = null;
function boiteStabiliserComplet(record) {
    if (!record) return record;
    if (!(record.jours || []).length) {
        record.complet = 0;
        return record;
    }
    var sig = boiteSignatureJours(record);
    var deja = boiteLireJson('studyPlanIB_boiteEmploiStable') || {};
    record.complet = (typeof emploiEstFige === 'function' && emploiEstFige()) || deja.sig === sig ? 1 : 0;
    record.fige = record.complet ? 1 : 0;
    if (!record.complet) {
        boiteEcrireJson('studyPlanIB_boiteEmploiStable', { sig: sig, at: Date.now() });
        clearTimeout(boiteStabiliseTimer);
        boiteStabiliseTimer = setTimeout(function () { boiteVerifierFiche(); }, 1500);
    }
    return record;
}

function boiteInscrit() {
    if (window.__profilComplet) return true;
    if (typeof subjects !== 'undefined' && Array.isArray(subjects) && subjects.length > 0) return true;
    var planning = document.getElementById('planningModal');
    return !!(planning && planning.classList.contains('active') && boiteNom());
}

function boitePublierEmploi(force) {
    if (!boiteNom()) return;
    if (!force && !boiteInscrit()) return;
    var record = boiteStabiliserComplet(boiteSnapshotEmploi());
    if (!record) return;
    var empreinte = JSON.stringify({
        nom: record.nom,
        classe: record.classe,
        jours: record.jours,
        matieres: record.matieres,
        google: record.google,
        googleSub: record.googleSub,
        flammes: record.flammes
    });
    var deja = boiteLireJson(BOITE_EMPLOI_HASH);
    var dejaComplet = '';
    try { dejaComplet = localStorage.getItem(BOITE_COMPLET) || ''; } catch (e) {}
    if (!force && dejaComplet === BOITE_COMPLET_VERSION && deja && deja.hash === empreinte && Date.now() - (deja.at || 0) < 6 * 60 * 60 * 1000) return;
    boiteEnvoyer(record).then(function () {
        boiteEcrireJson(BOITE_EMPLOI_HASH, { hash: empreinte, at: Date.now() });
        try { localStorage.setItem(BOITE_COMPLET, BOITE_COMPLET_VERSION); } catch (e) {}
    }).catch(function () {});
}

var boiteEmploiTimer = null;
var boiteReessaiFait = false;
function boiteReessayerUneFois() {
    if (boiteReessaiFait) return;
    boiteReessaiFait = true;
    boiteReessayer();
}
function boiteHeurePlus(heure, minutes) {
    var parts = String(heure || '00:00').split(':');
    var total = Number(parts[0]) * 60 + Number(parts[1] || 0) + minutes;
    total = ((total % 1440) + 1440) % 1440;
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

function boiteCopierEtat() {
    if (typeof memoireLireEtat === 'function') {
        try { return memoireLireEtat(); } catch (e) {}
    }
    return null;
}

function boitePoserEtat(data) {
    if (!data) return;
    if (typeof data.userName === 'string' && typeof userName !== 'undefined') userName = data.userName;
    if (typeof weekdayWakeup !== 'undefined') weekdayWakeup = data.weekdayWakeup || '06:00';
    if (typeof saturdayWakeup !== 'undefined') saturdayWakeup = data.saturdayWakeup || '07:00';
    if (typeof sundayWakeup !== 'undefined') sundayWakeup = data.sundayWakeup || '08:00';
    if (typeof subjects !== 'undefined') subjects = Array.isArray(data.subjects) ? data.subjects : [];
    if (typeof optionalSubjects !== 'undefined') optionalSubjects = Array.isArray(data.optionalSubjects) ? data.optionalSubjects : [];
    if (typeof emploiFige !== 'undefined') emploiFige = data.emploiFige && data.emploiFige.jours ? data.emploiFige : null;
    if (typeof selectedActivities !== 'undefined') selectedActivities = Array.isArray(data.selectedActivities) ? data.selectedActivities : [];
    if (typeof customEvents !== 'undefined') customEvents = Array.isArray(data.customEvents) ? data.customEvents.slice() : [];
    if (typeof ibYear !== 'undefined' && (data.ibYear === 'DP1' || data.ibYear === 'DP2' || data.ibYear === '')) ibYear = data.ibYear || '';
    if (typeof carToSchool !== 'undefined') carToSchool = data.carToSchool || 30;
    if (typeof carFromSchool !== 'undefined') carFromSchool = data.carFromSchool || 40;
    if (typeof motoToSchool !== 'undefined') motoToSchool = data.motoToSchool || 25;
    if (typeof motoFromSchool !== 'undefined') motoFromSchool = data.motoFromSchool || 40;
    if (typeof phoneDays !== 'undefined') phoneDays = Array.isArray(data.phoneDays) ? data.phoneDays : [];
    if (typeof samePhoneDuration !== 'undefined' && typeof data.samePhoneDuration === 'boolean') samePhoneDuration = data.samePhoneDuration;
    if (data.phoneDuration && typeof phoneDuration !== 'undefined') phoneDuration = data.phoneDuration;
    if (data.phoneDayDurations && typeof phoneDayDurations !== 'undefined') phoneDayDurations = data.phoneDayDurations;
    if (typeof setSleepHours === 'function') {
        if (data.weekdaySleepHours != null) setSleepHours('weekday', data.weekdaySleepHours);
        if (data.saturdaySleepHours != null) setSleepHours('saturday', data.saturdaySleepHours);
        if (data.sundaySleepHours != null) setSleepHours('sunday', data.sundaySleepHours);
    }
}

function boiteEmploiDepuisProfil(data, appareil) {
    if (!data || typeof generateDayEvents !== 'function') return null;
    var backup = boiteCopierEtat();
    var record = null;
    var ancienBrut = window.__emploiCalculBrut;
    window.__emploiCalculBrut = true;
    if (typeof emploiNePasSauver !== 'undefined') emploiNePasSauver++;
    try {
        boitePoserEtat(data);
        record = boiteSnapshotEmploi();
    } catch (e) {
        record = null;
    }
    window.__emploiCalculBrut = ancienBrut;
    if (typeof emploiNePasSauver !== 'undefined') emploiNePasSauver = Math.max(0, emploiNePasSauver - 1);
    if (backup) {
        try { boitePoserEtat(backup); } catch (e2) {}
    }
    if (!record || !record.jours || !record.jours.length) return null;
    record.appareil = appareil;
    record.id = 'e_' + appareil;
    if (data.google && data.google.email && !record.google) {
        record.google = data.google.email;
        record.email = data.google.email;
        record.googleNom = data.google.name || '';
        record.googleSub = data.google.sub || '';
    }
    record.flammes = Number(data.flammes || 0);
    return record;
}

function boiteCleStable(texte) {
    var h = 0;
    var s = String(texte || '');
    var i;
    for (i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return 'p' + Math.abs(h).toString(16);
}

function boiteProfilsLocaux() {
    var out = [];
    var vus = {};
    function ajouter(cle, data) {
        if (!data || typeof data !== 'object' || data.efface) return;
        if (!data.userName && !(Array.isArray(data.subjects) && data.subjects.length)) return;
        var id = cle + '|' + (data.userName || '') + '|' + (data.savedAt || '');
        if (vus[id]) return;
        vus[id] = 1;
        out.push({ cle: String(cle), data: data });
    }
    try {
        var i;
        for (i = 0; i < localStorage.length; i++) {
            var cle = localStorage.key(i);
            if (!cle) continue;
            if (cle !== 'studyPlanIB_profil' && cle.indexOf('studyPlanIB_profil:') !== 0 && cle.indexOf('studyPlanIB_sauvegarde:') !== 0) continue;
            ajouter(cle, boiteLireJson(cle));
        }
    } catch (e) {}
    return out;
}

function boiteIdbProfils() {
    return new Promise(function (resolve) {
        if (!window.indexedDB) return resolve([]);
        var req = indexedDB.open('studyPlanIB', 1);
        req.onerror = function () { resolve([]); };
        req.onsuccess = function () {
            var db = req.result;
            if (!db.objectStoreNames.contains('sauvegardes')) return resolve([]);
            var tx = db.transaction('sauvegardes', 'readonly');
            var out = [];
            var cur = tx.objectStore('sauvegardes').openCursor();
            cur.onsuccess = function () {
                var row = cur.result;
                if (!row) return resolve(out);
                out.push({ cle: 'idb:' + row.key, data: row.value });
                row.continue();
            };
            cur.onerror = function () { resolve(out); };
        };
    });
}

var boiteRejeuFait = false;
function boiteRejouerPasses() {
    if (boiteRejeuFait || typeof generateDayEvents !== 'function') return;
    boiteRejeuFait = true;
    var courant = boiteNormaliser(boiteNom());
    function publier(liste) {
        liste.forEach(function (item) {
            var data = item.data;
            if (!data || typeof data !== 'object') return;
            var nom = boiteNormaliser(data.userName || '');
            if (!nom || nom === courant) return;
            var appareil = boiteCleStable(item.cle + '|' + nom);
            var record = boiteEmploiDepuisProfil(data, appareil);
            if (record) boiteEnvoyer(record).catch(function () {});
        });
    }
    publier(boiteProfilsLocaux());
    boiteIdbProfils().then(publier).catch(function () {});
}

function boiteJourCle(date) {
    var d = date || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function boiteJourAvant(cle) {
    var parts = String(cle || '').split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() - 1);
    return boiteJourCle(d);
}

function boiteFlammes() {
    var aujourd = boiteJourCle(new Date());
    var hier = boiteJourAvant(aujourd);
    var n = 1;
    try {
        n = parseInt(localStorage.getItem('studyPlanIB_flamme') || '0', 10);
        if (!isFinite(n) || n < 0) n = 0;
        var dernier = localStorage.getItem('studyPlanIB_flammeJour') || '';
        if (!dernier) {
            var ancien = localStorage.getItem('studyPlanIB_dernierJour') || '';
            var parsed = ancien ? new Date(ancien) : null;
            if (parsed && !isNaN(parsed.getTime())) dernier = boiteJourCle(parsed);
        }
        if (dernier === aujourd) {
            if (!n) n = 1;
        } else if (dernier === hier) {
            n = (n || 0) + 1;
        } else {
            n = 1;
        }
        localStorage.setItem('studyPlanIB_flamme', String(n));
        localStorage.setItem('studyPlanIB_flammeJour', aujourd);
    } catch (e) {
        n = 1;
    }
    return n;
}

function boiteFicheCourante() {
    var record = null;
    try { record = boiteSnapshotEmploi(); } catch (e) { record = null; }
    var session = (typeof boiteSession === 'function' ? boiteSession() : null) || window.compteSession || {};
    if (!record) {
        if (!boiteNom()) return null;
        record = {
            type: 'emploi',
            id: 'e_' + boiteAppareil(),
            appareil: boiteAppareil(),
            at: new Date().toISOString(),
            nom: boiteNom(),
            classe: typeof ibYear !== 'undefined' ? (ibYear || '') : '',
            email: session.email || '',
            google: session.email || '',
            googleNom: session.name || session.given_name || '',
            googleSub: session.sub || '',
            matieres: [],
            jours: [],
            complet: 0
        };
    }
    record.flammes = boiteFlammes();
    boiteStabiliserComplet(record);
    record.at = new Date().toISOString();
    if (!record.classe && typeof ibYear !== 'undefined') record.classe = ibYear || '';
    if (!record.google && session.email) {
        record.google = session.email;
        record.email = record.email || session.email;
        record.googleNom = record.googleNom || session.name || session.given_name || '';
        record.googleSub = record.googleSub || session.sub || '';
    }
    return record;
}

function boiteFicheIncomplete(fusion, record) {
    var trouve = null;
    boitePersonnes(fusion || {}).some(function (item) {
        if (boiteMemePersonne(item, record)) { trouve = item; return true; }
        return false;
    });
    if (!trouve) return true;
    if (boiteEstComplet(record) && boiteSignatureJours(record) !== boiteSignatureJours(trouve)) return true;
    if ((record.jours || []).length && boiteRichesseEmploi(trouve) < boiteRichesseEmploi(record)) return true;
    if (record.classe && !trouve.classe) return true;
    if ((record.google || record.email) && !(trouve.google || trouve.email)) return true;
    if (record.nom && !boiteNomUtile(trouve)) return true;
    if (Number(record.flammes || 0) > 0 && Number(trouve.flammes || 0) !== Number(record.flammes)) return true;
    return false;
}

var boiteVerifEnCours = false;
var boiteVerifCle = '';
function boiteVerifierFiche() {
    if (!boiteNom() || boiteVerifEnCours) return;
    var record = boiteFicheCourante();
    if (!record) return;
    var cle = boiteNormaliser(record.nom) + '|' + String(record.google || record.email || '') + '|' + String(record.classe || '') + '|' + String(record.flammes || 0) + '|' + boiteSignatureJours(record);
    if (cle === boiteVerifCle) return;
    /* Ce qui est déjà parti ne repart pas : la trace est gardée sur
       l'appareil, sans relire la boîte (que seuls les admins peuvent
       lire). Une fiche modifiée change la clé et repart. */
    var deja = boiteLireJson(BOITE_FICHE_ENVOI);
    if (deja && deja.cle === cle && Date.now() - Number(deja.at || 0) < 12 * 60 * 60 * 1000) {
        boiteVerifCle = cle;
        return;
    }
    boiteVerifEnCours = true;
    var envoi;
    if (boiteEstAdmin()) {
        envoi = boiteChargerListes(false).then(function (fusion) {
            if (!boiteFicheIncomplete(fusion, record)) return null;
            return boiteEnvoyer(record);
        }).catch(function () {
            return boiteEnvoyer(record);
        });
    } else {
        envoi = boiteEnvoyer(record);
    }
    envoi.then(function () {
        boiteVerifCle = cle;
        boiteEcrireJson(BOITE_FICHE_ENVOI, { cle: cle, at: Date.now() });
        boiteVerifEnCours = false;
    }, function () {
        boiteVerifEnCours = false;
    });
}

function boiteApresMemoire() {
    boiteMajMenu();
    boiteReessayerUneFois();
    clearTimeout(boiteEmploiTimer);
    boiteEmploiTimer = setTimeout(function () {
        boiteVerifierFiche();
        boiteRejouerPasses();
    }, 1500);
}

var boiteVisiteAlertee = false;
var boiteAlerteEnCours = false;
var boiteAlerteApres = 0;

function boiteCleAlertes() {
    return 'studyPlanIB_alertesVues:' + boiteNormaliser(boiteNom());
}

function boiteAlertesVues() {
    var doc = boiteLireJson(boiteCleAlertes());
    if (!doc || typeof doc !== 'object' || !doc.ids) return {};
    return doc.ids;
}

function boiteMarquerAlertes(ids) {
    var vus = boiteAlertesVues();
    (ids || []).forEach(function (id) { if (id) vus[id] = 1; });
    var cles = Object.keys(vus);
    if (cles.length > 400) {
        var garde = {};
        cles.slice(-300).forEach(function (cle) { garde[cle] = 1; });
        vus = garde;
    }
    boiteEcrireJson(boiteCleAlertes(), { ids: vus });
}

function boitePhraseAlerte(groupe) {
    var nom = groupe.nom;
    var f = groupe.feedbacks;
    var q = groupe.questions;
    var feedback = f > 1 ? 'a fait des feedbacks' : 'a fait un feedback';
    var question = q > 1 ? 'a des questions' : 'a une question';
    var qui = nom + (groupe.email ? ' (' + groupe.email + ')' : '');
    if (f && q) return qui + ' ' + feedback + ' et ' + question + '.';
    if (f) return qui + ' ' + feedback + '.';
    return qui + ' ' + question + '.';
}

/* Qui a vraiment envoyé un message. Le prénom tapé à l'accueil peut être
   celui d'un autre sur un téléphone partagé : quand il ne cadre pas avec
   le nom du compte Google connecté, c'est le compte Google qui fait foi.
   L'adresse est rappelée pour vérification. */
function boiteNomExpediteur(item) {
    var nom = String(item && item.nom || '').trim();
    var google = String(item && item.googleNom || '').trim();
    var email = boiteMailPersonne(item);
    var affiche = nom;
    if (nom && google) {
        var motsNom = boiteMots(nom);
        var motsGoogle = boiteMots(google);
        var commun = motsNom.some(function (mot) {
            return mot.length >= 3 && motsGoogle.indexOf(mot) !== -1;
        });
        if (!commun) affiche = google;
    } else if (!nom) {
        affiche = google;
    }
    if (!affiche) affiche = email ? email.split('@')[0] : 'Un utilisateur';
    return { nom: affiche, email: email };
}

function boiteNouveauxRetours(fusion) {
    var vus = boiteAlertesVues();
    var moi = boiteNormaliser(boiteNom());
    var groupes = {};
    var ordre = [];
    var ids = [];
    function ajouter(item, genre) {
        if (!item || !item.id || vus[item.id]) return;
        var qui = boiteNomExpediteur(item);
        if (moi && boiteNormaliser(qui.nom) === moi) return;
        ids.push(item.id);
        var cle = (boiteNormaliser(qui.nom) || qui.nom) + '|' + qui.email;
        if (!groupes[cle]) {
            groupes[cle] = { nom: qui.nom, email: qui.email, feedbacks: 0, questions: 0 };
            ordre.push(cle);
        }
        groupes[cle][genre] += 1;
    }
    (fusion && fusion.feedbacks || []).forEach(function (item) { ajouter(item, 'feedbacks'); });
    (fusion && fusion.questions || []).forEach(function (item) { ajouter(item, 'questions'); });
    return {
        ids: ids,
        lignes: ordre.map(function (cle) { return boitePhraseAlerte(groupes[cle]); }),
        questions: ordre.some(function (cle) { return groupes[cle].questions > 0; }),
        feedbacks: ordre.some(function (cle) { return groupes[cle].feedbacks > 0; })
    };
}

function boiteFermerAlerte(ids) {
    boiteMarquerAlertes(ids || []);
    var el = document.getElementById('boiteAlerteRetours');
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

function boiteOuvrirAlerte(neuf) {
    if (!neuf || !neuf.lignes.length || !boiteEstAdmin()) return;
    if (document.getElementById('boiteAlerteRetours')) return;
    var page = neuf.feedbacks ? 'retours' : 'questions';
    var el = document.createElement('div');
    el.id = 'boiteAlerteRetours';
    el.style.cssText = 'position:fixed;inset:0;z-index:220;background:rgba(17,24,39,0.55);display:flex;align-items:center;justify-content:center;padding:1rem;';
    var lignes = neuf.lignes.slice(0, 8).map(function (ligne) {
        return '<p style="margin:0.35rem 0;color:#1c1917;font-size:1rem;line-height:1.4;">' + boiteEchap(ligne) + '</p>';
    }).join('');
    if (neuf.lignes.length > 8) {
        lignes += '<p style="margin:0.45rem 0 0;color:#78716c;font-size:0.88rem;">Et ' + (neuf.lignes.length - 8) + ' autre' + (neuf.lignes.length - 8 > 1 ? 's' : '') + '.</p>';
    }
    el.innerHTML = '<div style="max-width:26rem;width:100%;background:white;border-radius:1.25rem;padding:1.35rem 1.2rem;box-shadow:0 24px 60px rgba(0,0,0,0.18);">'
        + '<p style="margin:0 0 0.35rem;font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;font-weight:800;color:#059669;">Study Plan IB</p>'
        + '<h3 style="margin:0 0 0.7rem;font-size:1.22rem;color:#1c1917;">Nouveaux messages</h3>'
        + lignes
        + '<div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:1.1rem;">'
        + '<button type="button" id="boiteAlerteVoir" style="width:100%;border:none;background:#059669;color:white;border-radius:0.85rem;padding:0.8rem 1rem;font-weight:800;cursor:pointer;">Voir</button>'
        + '<button type="button" id="boiteAlerteFermer" style="width:100%;border:1.5px solid #e7e5e4;background:white;color:#44403c;border-radius:0.85rem;padding:0.75rem 1rem;font-weight:700;cursor:pointer;">Fermer</button>'
        + '</div></div>';
    document.body.appendChild(el);
    boiteMarquerAlertes(neuf.ids);
    document.getElementById('boiteAlerteFermer').onclick = function () { boiteFermerAlerte(); };
    document.getElementById('boiteAlerteVoir').onclick = function () {
        boiteFermerAlerte();
        if (typeof navigateTo === 'function') navigateTo(page);
    };
}

function boiteSignalerOuverture(force) {
    if ((boiteVisiteAlertee && !force) || boiteAlerteEnCours || Date.now() < boiteAlerteApres) return;
    if (!boiteEstAdmin() || typeof document === 'undefined') return;
    if (document.getElementById('boiteAlerteRetours')) return;
    boiteAlerteEnCours = true;
    boiteChargerListes(true).then(function (fusion) {
        boiteAlerteEnCours = false;
        boiteVisiteAlertee = true;
        if (!boiteEstAdmin()) return;
        boiteOuvrirAlerte(boiteNouveauxRetours(fusion));
    }).catch(function () {
        boiteAlerteEnCours = false;
        boiteAlerteApres = Date.now() + 30000;
    });
}

if (typeof document !== 'undefined') {
    boiteMajMenu();
    /* Un envoi raté reste dans la file : on le retente tant que la page
       est ouverte, pas seulement à son ouverture. */
    setInterval(function () {
        try { boiteReessayer(); } catch (e) {}
    }, 45000);
    /* Pour un admin, la page surveille la boîte : une question ou une
       suggestion qui arrive pendant que le site est ouvert fait surgir
       le popup, sans attendre un rechargement. */
    setInterval(function () {
        try {
            if (document.visibilityState === 'visible' && boiteEstAdmin()) boiteSignalerOuverture(true);
        } catch (e) {}
    }, 90000);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            boiteVisiteAlertee = false;
            return;
        }
        boiteSignalerOuverture();
        boiteVerifierFiche();
        var panneau = document.getElementById('panelEmplois');
        if (panneau && panneau.classList.contains('active') && boiteEstAdmin()) {
            boiteChargerListes(true).then(function (fusion) { boiteRendreEmplois(fusion); }).catch(function () {});
        }
    });
}
