/* ============================================================
   Aide, Feedback, et les trois sections des quatre comptes.
   Le nom saisi à l'accueil décide de l'accès, pas le nom Google.
   ============================================================ */

var BOITE_SUJET = 'ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b';
var BOITE_ADMINS = [
    'sawadogo juliss bill owen',
    'sere farid abdourrahman',
    'sere farid abdourraham',
    'tamini ashley kania harisoa',
    'ouedraogo wendsom rayyan',
    'ouedraogo wendsom ryyan'
];
var BOITE_EXPEDITEUR = 'studyplanib@gmail.com';
var BOITE_GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send email';
var boiteJetonMail = '';
var boiteJetonMailFin = 0;
var BOITE_FILE = 'studyPlanIB_boiteFile';
var BOITE_VUS = 'studyPlanIB_boiteVus';
var BOITE_URL_LOCALE = 'studyPlanIB_boiteUrl';
var BOITE_EMPLOI_HASH = 'studyPlanIB_boiteEmploiHash';
var BOITE_COMPLET = 'studyPlanIB_boiteComplet';
var BOITE_COMPLET_VERSION = '20261008b';
var boiteConfigCache = null;
var boiteConfigPromise = null;
var boiteListesCache = null;
var boiteEnvoiEnCours = false;
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

function boiteEstAdmin(nom) {
    var mots = boiteMots(nom == null ? (typeof userName !== 'undefined' ? userName : '') : nom);
    if (mots.length < 3) return false;
    return BOITE_ADMINS.some(function (admin) {
        var attendus = boiteMots(admin);
        return attendus.every(function (mot) { return mots.indexOf(mot) !== -1; });
    });
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
    ['menuRetours', 'menuQuestions', 'menuEmplois'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = admin ? 'flex' : 'none';
    });
    if (typeof iaAfficherEntree === 'function') iaAfficherEntree();
    else {
        var assistant = document.getElementById('menuAssistant');
        if (assistant) assistant.style.display = 'none';
    }
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

function boiteLireConfig() {
    if (boiteConfigCache && (boiteConfigCache.kvdb || boiteConfigCache.archive)) {
        return Promise.resolve(boiteConfigCache);
    }
    if (boiteConfigPromise) return boiteConfigPromise;
    boiteConfigPromise = boiteFetch('data/boite-url.json?t=' + Date.now(), { cache: 'no-store' }, 8000)
        .then(function (res) { return res.ok ? res.json() : {}; })
        .catch(function () { return {}; })
        .then(function (data) {
            data = data || {};
            if (data.sujet) BOITE_SUJET = String(data.sujet);
            var local = boiteLireJson(BOITE_URL_LOCALE) || {};
            boiteConfigCache = {
                sujet: BOITE_SUJET,
                kvdb: data.kvdb || local.kvdb || '',
                archive: data.archive || local.archive || ''
            };
            return boiteConfigCache;
        });
    return boiteConfigPromise;
}

function boiteMemoriserCoffre(cfg) {
    if (!cfg) return;
    var local = boiteLireJson(BOITE_URL_LOCALE) || {};
    if (cfg.kvdb) local.kvdb = cfg.kvdb;
    if (cfg.archive) local.archive = cfg.archive;
    boiteEcrireJson(BOITE_URL_LOCALE, local);
    boiteConfigCache = {
        sujet: BOITE_SUJET,
        kvdb: (boiteConfigCache && boiteConfigCache.kvdb) || local.kvdb || '',
        archive: (boiteConfigCache && boiteConfigCache.archive) || local.archive || ''
    };
}

function boiteCreerKvdb() {
    var body = 'email=' + encodeURIComponent('234701558+sawadogojuliss-byte@users.noreply.github.com') + '&default_ttl=31536000';
    return boiteFetch('https://kvdb.io', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
    }, 12000).then(function (res) {
        if (!res.ok) throw new Error('kvdb');
        return res.text();
    }).then(function (bucket) {
        bucket = String(bucket || '').trim();
        if (!/^[A-Za-z0-9_-]{8,80}$/.test(bucket)) throw new Error('kvdb');
        var url = 'https://kvdb.io/' + bucket;
        boiteMemoriserCoffre({ kvdb: url });
        boiteFetch('https://ntfy.sh/' + encodeURIComponent(BOITE_SUJET), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain', Title: 'coffre', Priority: 'min' },
            body: JSON.stringify({ type: 'coffre', kvdb: url })
        }, 8000).catch(function () {});
        return url;
    });
}

function boiteResoudreKvdb(cfg) {
    if (cfg && cfg.kvdb) return Promise.resolve(cfg.kvdb);
    var local = boiteLireJson(BOITE_URL_LOCALE);
    if (local && local.kvdb) return Promise.resolve(local.kvdb);
    if (window.__boiteKvdbPromesse) return window.__boiteKvdbPromesse;
    window.__boiteKvdbPromesse = boiteCreerKvdb().catch(function () { return ''; });
    return window.__boiteKvdbPromesse;
}

function boiteCleKvdb(record) {
    if (record.type === 'emploi') return 'e_' + String(record.appareil || record.id || 'x').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
    var prefix = record.type === 'feedback' ? 'f_' : 'q_';
    return prefix + String(record.id || boiteId(prefix)).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
}

function boiteEcrireKvdb(url, record) {
    var cle = boiteCleKvdb(record);
    function envoyer(ttl) {
        return boiteFetch(url.replace(/\/$/, '') + '/' + encodeURIComponent(cle) + '?ttl=' + ttl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        }, 12000).then(function (res) {
            if (!res.ok) throw new Error('kvdb');
        });
    }
    return envoyer(31536000).catch(function () { return envoyer(604800); });
}

function boiteCorpsNtfy(record) {
    var json = JSON.stringify(record);
    if (json.length <= 3800) return json;
    if (record.type !== 'emploi') {
        return JSON.stringify({
            type: record.type, id: record.id, at: record.at, nom: record.nom,
            texte: String(record.texte || '').slice(0, 700),
            email: record.email || '', google: record.google || '', googleNom: record.googleNom || ''
        });
    }
    var jours = (record.jours || []).slice(0, 6);
    var copie = record;
    while (jours.length && JSON.stringify(copie).length > 3800) {
        jours = jours.slice(0, -1);
        copie = {
            type: 'emploi', id: record.id, appareil: record.appareil, at: record.at,
            nom: record.nom, classe: record.classe || '', email: record.email || '',
            google: record.google || '', googleNom: record.googleNom || '', googleSub: record.googleSub || '',
            matieres: record.matieres || [],
            jours: jours.map(function (jour) {
                return {
                    j: jour.j,
                    s: (jour.s || []).slice(0, 6).map(function (slot) {
                        return { d: slot.d, f: slot.f, t: String(slot.t || '').slice(0, 24) };
                    })
                };
            })
        };
    }
    return JSON.stringify(copie);
}

function boiteEcrireNtfy(record) {
    return boiteFetch('https://ntfy.sh/' + encodeURIComponent(BOITE_SUJET), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', Title: record.type || 'message', Priority: 'min' },
        body: boiteCorpsNtfy(record)
    }, 12000).then(function (res) {
        if (!res.ok) throw new Error('ntfy');
    });
}

function boiteEnvoyerDistant(record) {
    return boiteLireConfig().then(function (cfg) {
        return boiteResoudreKvdb(cfg).then(function (kvdb) {
            var essais = [boiteEcrireNtfy(record).then(function () { return true; }).catch(function () { return false; })];
            if (kvdb) essais.push(boiteEcrireKvdb(kvdb, record).then(function () { return true; }).catch(function () { return false; }));
            return Promise.all(essais);
        });
    }).then(function (resultats) {
        if (!resultats.some(Boolean)) throw new Error('envoi');
        boiteRetirerFile(record.id);
        return true;
    });
}

function boiteLireVus() {
    var vus = boiteLireJson(BOITE_VUS);
    if (!vus || typeof vus !== 'object') return [];
    return [].concat(vus.questions || [], vus.feedbacks || [], vus.emplois || [], vus.reponses || []);
}

function boiteMemoriserVus(fusion) {
    boiteEcrireJson(BOITE_VUS, {
        questions: (fusion.questions || []).slice(0, 80),
        feedbacks: (fusion.feedbacks || []).slice(0, 80),
        emplois: (fusion.emplois || []).slice(0, 200),
        reponses: (fusion.reponses || []).slice(0, 80)
    });
}

function boiteGarderVu(record) {
    var fusion = boiteFusionner(boiteLireVus().concat([record]));
    boiteMemoriserVus(fusion);
}

function boiteJoindreJours(anciens, nouveaux) {
    var map = {};
    (anciens || []).forEach(function (jour) { if (jour && jour.j) map[jour.j] = jour; });
    (nouveaux || []).forEach(function (jour) { if (jour && jour.j) map[jour.j] = jour; });
    return ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].filter(function (nom) {
        return map[nom];
    }).map(function (nom) { return map[nom]; });
}

function boiteDecouperEmploi(record) {
    if (!record || record.type !== 'emploi') return [record];
    var jours = record.jours || [];
    if (!jours.length || JSON.stringify(record).length <= 3200) return [record];
    return jours.map(function (jour, index) {
        return {
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
            matieres: record.matieres || [],
            jours: [jour],
            partie: index
        };
    });
}

function boiteEnvoyer(record) {
    var morceaux = boiteDecouperEmploi(record);
    morceaux.forEach(boiteGarderFile);
    return morceaux.reduce(function (chaine, morceau) {
        return chaine.then(function () { return boiteEnvoyerDistant(morceau); });
    }, Promise.resolve(true)).then(function (ok) {
        boiteGarderVu(record);
        if (record.type === 'emploi') boiteAjouterArchive(record);
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

function boiteParserMessage(texte) {
    try {
        var data = JSON.parse(texte);
        if (data && data.type) return data;
    } catch (e) {}
    return null;
}

function boiteLireNtfy() {
    return boiteFetch('https://ntfy.sh/' + encodeURIComponent(BOITE_SUJET) + '/json?poll=1&since=all', { cache: 'no-store' }, 20000)
        .then(function (res) {
            if (!res.ok) throw new Error('ntfy');
            return res.text();
        })
        .then(function (texte) {
            var out = [];
            String(texte || '').split('\n').forEach(function (ligne) {
                if (!ligne.trim()) return;
                var enveloppe = null;
                try { enveloppe = JSON.parse(ligne); } catch (e) { return; }
                if (!enveloppe || enveloppe.event && enveloppe.event !== 'message') return;
                var data = boiteParserMessage(enveloppe.message || '');
                if (data) out.push(data);
            });
            return out;
        });
}

function boiteLireKvdb(url) {
    if (!url) return Promise.resolve([]);
    return boiteFetch(url.replace(/\/$/, '') + '/?values=true&format=json&limit=2000', { cache: 'no-store' }, 12000)
        .then(function (res) {
            if (!res.ok) throw new Error('kvdb');
            return res.json();
        })
        .then(function (lignes) {
            var out = [];
            (Array.isArray(lignes) ? lignes : []).forEach(function (ligne) {
                var valeur = Array.isArray(ligne) ? ligne[1] : ligne;
                if (typeof valeur === 'string') valeur = boiteParserMessage(valeur);
                if (valeur && valeur.type) out.push(valeur);
            });
            return out;
        });
}

function boiteLireArchive(url) {
    if (!url) return Promise.resolve([]);
    return boiteFetch(url + (url.indexOf('?') === -1 ? '?' : '&') + 't=' + Date.now(), { cache: 'no-store' }, 12000)
        .then(function (res) {
            if (!res.ok) throw new Error('archive');
            return res.json();
        })
        .then(function (doc) {
            doc = doc || {};
            return [].concat(doc.questions || [], doc.feedbacks || [], doc.emplois || [], doc.reponses || []);
        });
}

function boiteFusionner(items) {
    var questions = [];
    var feedbacks = [];
    var reponses = [];
    var emplois = {};
    var vusQ = {};
    var vusF = {};
    var vusR = {};
    (items || []).forEach(function (item) {
        if (!item || !item.type || item.type === 'coffre') return;
        if (item.type === 'question' && item.id && !vusQ[item.id]) {
            vusQ[item.id] = 1;
            questions.push(item);
        } else if (item.type === 'feedback' && item.id && !vusF[item.id]) {
            vusF[item.id] = 1;
            feedbacks.push(item);
        } else if (item.type === 'reponse' && item.id && !vusR[item.id]) {
            vusR[item.id] = 1;
            reponses.push(item);
        } else if (item.type === 'emploi') {
            var cle = item.appareil || item.id;
            if (!cle) return;
            var deja = emplois[cle];
            if (!deja) {
                emplois[cle] = item;
                return;
            }
            var recent = String(item.at || '') >= String(deja.at || '');
            var garde = recent ? item : deja;
            var autre = recent ? deja : item;
            if (!garde.google && autre.google) garde.google = autre.google;
            if (!garde.googleSub && autre.googleSub) garde.googleSub = autre.googleSub;
            if (!garde.googleNom && autre.googleNom) garde.googleNom = autre.googleNom;
            if (!garde.email && autre.email) garde.email = autre.email;
            if (!(garde.matieres && garde.matieres.length) && autre.matieres) garde.matieres = autre.matieres;
            if (!garde.classe && autre.classe) garde.classe = autre.classe;
            garde.jours = boiteJoindreJours(autre.jours, garde.jours);
            emplois[cle] = garde;
        }
    });
    var listeEmplois = Object.keys(emplois).map(function (cle) { return emplois[cle]; });
    questions.sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    feedbacks.sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    reponses.sort(function (a, b) { return String(a.at || '').localeCompare(String(b.at || '')); });
    listeEmplois.sort(function (a, b) { return boiteNormaliser(a.nom).localeCompare(boiteNormaliser(b.nom), 'fr'); });
    return {
        questions: questions.slice(0, 120),
        feedbacks: feedbacks.slice(0, 120),
        reponses: reponses.slice(0, 120),
        emplois: listeEmplois.slice(0, 300)
    };
}

function boiteDocument(fusion) {
    function leger(item) {
        return {
            type: item.type,
            id: item.id,
            appareil: item.appareil || '',
            at: item.at || '',
            nom: item.nom || '',
            classe: item.classe || '',
            texte: item.texte || '',
            email: item.email || '',
            google: item.google || '',
            googleNom: item.googleNom || '',
            googleSub: item.googleSub || '',
            matieres: item.matieres || [],
            jours: item.jours || [],
            questionId: item.questionId || '',
            destinataire: item.destinataire || '',
            mail: !!item.mail
        };
    }
    var doc = {
        questions: fusion.questions.slice(0, 60).map(leger),
        feedbacks: fusion.feedbacks.slice(0, 60).map(leger),
        reponses: (fusion.reponses || []).slice(0, 60).map(leger),
        emplois: fusion.emplois.slice(0, 30).map(leger)
    };
    if (JSON.stringify(doc).length > 60000) {
        doc.emplois = doc.emplois.slice(0, 12);
        doc.questions = doc.questions.slice(0, 30);
        doc.feedbacks = doc.feedbacks.slice(0, 30);
    }
    return doc;
}

function boiteArchiver(cfg, fusion) {
    if (!cfg || !cfg.archive) return Promise.resolve();
    return boiteFetch(cfg.archive, { cache: 'no-store' }, 12000).then(function (res) {
        if (!res.ok) throw new Error('archive');
        return res.json();
    }).then(function (doc) {
        doc = doc && typeof doc === 'object' ? doc : {};
        var mix = boiteFusionner([].concat(
            doc.questions || [], doc.feedbacks || [], doc.emplois || [], doc.reponses || [],
            fusion.questions || [], fusion.feedbacks || [], fusion.emplois || [], fusion.reponses || []
        ));
        return boiteFetch(cfg.archive, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(boiteDocument(mix))
        }, 12000);
    }).then(function () {}, function () {});
}

function boiteAjouterArchive(record) {
    if (!record) return Promise.resolve();
    return boiteLireConfig().then(function (cfg) {
        var fusion = { questions: [], feedbacks: [], reponses: [], emplois: [] };
        if (record.type === 'feedback') fusion.feedbacks = [record];
        else if (record.type === 'reponse') fusion.reponses = [record];
        else if (record.type === 'question') fusion.questions = [record];
        else fusion.emplois = [record];
        return boiteArchiver(cfg, fusion);
    });
}

function boiteUrlsKvdb(cfg, messages) {
    var urls = [];
    function ajouter(url) {
        if (url && urls.indexOf(url) === -1) urls.push(url);
    }
    ajouter(cfg && cfg.kvdb);
    var local = boiteLireJson(BOITE_URL_LOCALE);
    if (local) ajouter(local.kvdb);
    (messages || []).forEach(function (item) {
        if (item && item.type === 'coffre') ajouter(item.kvdb);
    });
    return urls.slice(0, 6);
}

function boiteLireEmploisFichier() {
    return boiteFetch('data/emplois.json?t=' + Date.now(), { cache: 'no-store' }, 12000)
        .then(function (res) {
            if (!res.ok) throw new Error('emplois');
            return res.json();
        })
        .then(function (doc) {
            doc = doc || {};
            return [].concat(doc.emplois || []);
        })
        .catch(function () { return []; });
}

function boiteChargerListes(force) {
    if (boiteListesCache && !force) return Promise.resolve(boiteListesCache);
    return boiteLireConfig().then(function (cfg) {
        var archiveP = cfg.archive
            ? boiteLireArchive(cfg.archive).then(function (items) { return { ok: true, items: items }; }).catch(function () { return { ok: false, items: [] }; })
            : Promise.resolve({ ok: false, items: [] });
        var archiveOk = false;
        return Promise.all([
            archiveP,
            boiteLireNtfy().then(function (items) { return { ok: true, items: items }; }).catch(function () { return { ok: false, items: [] }; }),
            boiteLireEmploisFichier().then(function (items) { return { ok: true, items: items }; })
        ]).then(function (premiers) {
            archiveOk = premiers[0].ok;
            var messages = premiers[1].items || [];
            messages.forEach(function (item) {
                if (item && item.type === 'coffre' && item.kvdb) boiteMemoriserCoffre({ kvdb: item.kvdb });
            });
            var lectures = boiteUrlsKvdb(cfg, messages).map(function (url) {
                return boiteLireKvdb(url).then(function (items) { return { ok: true, items: items }; }).catch(function () { return { ok: false, items: [] }; });
            });
            return Promise.all(lectures).then(function (coffres) {
                return premiers.concat(coffres);
            });
        }).then(function (sources) {
            var items = boiteLireFile().concat(boiteLireVus());
            var ok = false;
            sources.forEach(function (source) {
                if (source.ok) ok = true;
                items = items.concat(source.items || []);
            });
            var fusion = boiteFusionner(items);
            fusion.partiel = !ok;
            boiteListesCache = fusion;
            if (archiveOk && cfg.archive) boiteArchiver(cfg, fusion);
            boiteMemoriserVus(fusion);
            boiteProlongerNtfy(fusion);
            return fusion;
        });
    });
}

function boiteProlongerNtfy(fusion) {
    var limite = Date.now() - 6 * 60 * 60 * 1000;
    var vieux = fusion.questions.concat(fusion.feedbacks, fusion.emplois, fusion.reponses || []).filter(function (item) {
        var quand = new Date(item.at || 0).getTime();
        return quand && quand < limite;
    }).slice(0, 8);
    vieux.reduce(function (chaine, item) {
        return chaine.then(function () { return boiteEcrireNtfy(item).catch(function () {}); });
    }, Promise.resolve());
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
        cartes.push({
            at: item.at || '',
            html: boiteCarte(
                'Suggestion · ' + boiteEchap(item.nom || 'Sans nom'),
                boiteEchap(boiteDate(item.at)) + ' · ' + (item.email ? boiteEchap(item.email) : 'E-mail non renseigné'),
                boiteEchap(item.texte || '')
            )
        });
    });
    fusion.questions.forEach(function (item) {
        var email = item.email || item.google || '';
        cartes.push({
            at: item.at || '',
            html: boiteCarte(
                'Question · ' + boiteEchap(item.nom || 'Sans nom'),
                boiteEchap(boiteDate(item.at)) + ' · ' + (email ? boiteEchap(email) : 'E-mail non renseigné'),
                boiteEchap(item.texte || '')
            )
        });
    });
    cartes.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    if (!cartes.length) {
        liste.innerHTML = '<p style="color:#6b7280;">' + (fusion.partiel ? 'Les retours ne sont pas accessibles pour le moment. Réessaie.' : 'Aucun retour pour le moment.') + '</p>';
    } else {
        liste.innerHTML = cartes.map(function (carte) { return carte.html; }).join('');
    }
    if (statut) {
        statut.textContent = fusion.partiel
            ? 'Une partie des messages n\'a pas pu être rechargée.'
            : (cartes.length + ' message' + (cartes.length > 1 ? 's' : ''));
    }
}

function boiteEmailQuestion(item) {
    return String((item && (item.email || item.google)) || '').trim();
}

function boiteReponsesDe(fusion, questionId) {
    return (fusion.reponses || []).filter(function (rep) {
        return rep && rep.questionId === questionId && rep.mail;
    });
}

function boiteCase(cochee) {
    return '<input type="checkbox" disabled ' + (cochee ? 'checked' : '') + ' style="width:1.15rem;height:1.15rem;accent-color:#059669;flex:none;">';
}

function boiteCarteQuestion(item, reponses) {
    var compte = item.google ? boiteEchap(item.google) : 'Sans compte Google';
    if (item.googleNom) compte += ' · ' + boiteEchap(item.googleNom);
    var email = boiteEmailQuestion(item);
    var cochee = reponses.length > 0;
    var html = '<article style="background:white;border:1.5px solid ' + (cochee ? '#a7f3d0' : '#e5e7eb') + ';border-radius:1rem;padding:0.9rem 1rem;margin-bottom:0.75rem;">'
        + '<div style="display:flex;align-items:flex-start;gap:0.65rem;">'
        + boiteCase(cochee)
        + '<div style="flex:1;min-width:0;">'
        + '<p style="font-weight:800;color:#111827;">' + boiteEchap(item.nom || 'Sans nom') + '</p>'
        + '<p style="font-size:0.78rem;color:#6b7280;margin:0.2rem 0 0.55rem;">' + boiteEchap(boiteDate(item.at)) + ' · Compte Google : ' + compte + '</p>'
        + '<p style="font-size:0.92rem;color:#1f2937;line-height:1.45;white-space:pre-wrap;">' + boiteEchap(item.texte || '') + '</p>';
    reponses.forEach(function (rep) {
        html += '<div style="margin-top:0.75rem;background:#f0fdf4;border-radius:0.75rem;padding:0.7rem 0.8rem;">'
            + '<p style="font-size:0.75rem;font-weight:800;color:#047857;">Message envoyé · ' + boiteEchap(boiteDate(rep.at)) + '</p>'
            + '<p style="font-size:0.88rem;color:#1f2937;white-space:pre-wrap;margin-top:0.25rem;">' + boiteEchap(rep.texte || '') + '</p>'
            + '<p style="font-size:0.75rem;color:#6b7280;margin-top:0.3rem;">Mail envoyé depuis ' + boiteEchap(BOITE_EXPEDITEUR) + ' à ' + boiteEchap(rep.destinataire || email) + '</p>'
            + '</div>';
    });
    if (!cochee) {
        if (!boiteEmailValide(email)) {
            html += '<p style="margin-top:0.75rem;font-size:0.84rem;color:#b45309;">Cette personne n\'a pas laissé d\'e-mail. Le mail ne peut pas partir.</p>';
        } else {
            html += '<label style="display:block;margin-top:0.85rem;font-size:0.8rem;font-weight:700;color:#374151;">Message pour ' + boiteEchap(email) + '</label>'
                + '<textarea data-reponse-texte="' + boiteEchap(item.id) + '" maxlength="800" rows="4" placeholder="Écris le message…" style="width:100%;box-sizing:border-box;margin-top:0.35rem;border:1.5px solid #e5e7eb;border-radius:0.8rem;padding:0.7rem 0.8rem;font:inherit;font-size:0.9rem;resize:vertical;outline:none;"></textarea>'
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
        var reps = boiteReponsesDe(fusion, item.id);
        if (reps.length) repondues.push(boiteCarteQuestion(item, reps));
        else attente.push(boiteCarteQuestion(item, []));
    });
    function bloc(titre, cartes, vide) {
        return '<section style="margin-bottom:1.25rem;">'
            + '<h3 style="font-size:0.95rem;font-weight:800;color:#111827;margin-bottom:0.65rem;">' + titre + '</h3>'
            + (cartes.length ? cartes.join('') : '<p style="color:#6b7280;margin-bottom:0.5rem;">' + vide + '</p>')
            + '</section>';
    }
    if (!fusion.questions.length && fusion.partiel) {
        liste.innerHTML = '<p style="color:#6b7280;">Les questions ne sont pas accessibles pour le moment. Réessaie.</p>';
    } else {
        liste.innerHTML = '<section style="margin-bottom:1.25rem;">'
            + '<h3 style="font-size:0.95rem;font-weight:800;color:#111827;margin-bottom:0.35rem;">Questions en attente</h3>'
            + '<p style="font-size:0.78rem;color:#6b7280;margin-bottom:0.65rem;">Le mail part de ' + boiteEchap(BOITE_EXPEDITEUR) + '.</p>'
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

function boiteLettre(destinataire, message, question) {
    var sujet = 'Réponse à ta question — Study Plan IB';
    var corps = String(message || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (question) corps += '\n\n—\nTa question :\n' + String(question).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    corps += '\n\n— Study Plan IB';
    return [
        'From: Study Plan IB <' + BOITE_EXPEDITEUR + '>',
        'To: ' + destinataire,
        'Reply-To: ' + BOITE_EXPEDITEUR,
        'Subject: =?UTF-8?B?' + boiteBase64(sujet) + '?=',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        boiteBase64(corps).replace(/(.{76})/g, '$1\r\n')
    ].join('\r\n');
}

function boiteOublierJetonMail() {
    boiteJetonMail = '';
    boiteJetonMailFin = 0;
}

function boiteDemanderJetonMail() {
    if (boiteJetonMail && Date.now() < boiteJetonMailFin - 60000) return Promise.resolve(boiteJetonMail);
    if (!window.google || !google.accounts || !google.accounts.oauth2 || typeof compteClientId !== 'function' || !compteClientId()) {
        return Promise.reject(new Error('google'));
    }
    return new Promise(function (resolve, reject) {
        var fini = false;
        function ok(token) { if (!fini) { fini = true; resolve(token); } }
        function ko(err) { if (!fini) { fini = true; reject(err || new Error('jeton')); } }
        var client = google.accounts.oauth2.initTokenClient({
            client_id: compteClientId(),
            scope: BOITE_GMAIL_SCOPE,
            hint: BOITE_EXPEDITEUR,
            include_granted_scopes: false,
            callback: function (resp) {
                if (resp && resp.access_token) {
                    boiteJetonMail = resp.access_token;
                    boiteJetonMailFin = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
                    ok(boiteJetonMail);
                } else ko(resp || new Error('jeton'));
            },
            error_callback: function (err) { ko(err || new Error('jeton')); }
        });
        try { client.requestAccessToken({ prompt: 'select_account', hint: BOITE_EXPEDITEUR }); }
        catch (e) { ko(e); }
    });
}

function boiteCompteExpediteur(token) {
    return boiteFetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: 'Bearer ' + token }
    }, 12000).then(function (res) {
        if (!res.ok) {
            boiteOublierJetonMail();
            throw new Error('profil');
        }
        return res.json();
    }).then(function (profil) {
        if (String(profil.email || '').toLowerCase() !== BOITE_EXPEDITEUR) {
            boiteOublierJetonMail();
            throw new Error('compte');
        }
        return token;
    });
}

function boiteMessageEchecMail(err, data) {
    var type = err && (err.type || err.message) || '';
    var api = data && data.error ? String(data.error.message || data.error.status || '') : '';
    if (type === 'compte') return 'Choisis studyplanib@gmail.com. La question reste en attente.';
    if (type === 'popup_failed_to_open') return 'Autorise la fenêtre Google, puis réessaie. La question reste en attente.';
    if (type === 'popup_closed') return 'La fenêtre Google a été fermée. La question reste en attente.';
    if (/SERVICE_DISABLED|accessNotConfigured|has not been used/i.test(api)) {
        return 'Le service Gmail n\'est pas activé. La question reste en attente.';
    }
    return 'Le mail n\'a pas pu partir. La question reste en attente.';
}

function boiteEnvoyerMail(destinataire, message, question) {
    return boiteDemanderJetonMail().then(boiteCompteExpediteur).then(function (token) {
        return boiteFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ raw: boiteBase64Url(boiteLettre(destinataire, message, question)) })
        }, 20000).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (!res.ok || !data || !data.id) {
                    if (res.status === 401 || res.status === 403) boiteOublierJetonMail();
                    var err = new Error('mail');
                    err.api = data;
                    throw err;
                }
                return data;
            });
        });
    });
}

function boiteDireDans(el, texte, erreur) {
    if (!el) return;
    el.textContent = texte;
    el.style.color = erreur ? '#b45309' : '#047857';
}

function boiteRepondre(questionId) {
    if (!boiteEstAdmin() || !boiteListesCache) return;
    var question = null;
    (boiteListesCache.questions || []).some(function (item) {
        if (item.id === questionId) { question = item; return true; }
        return false;
    });
    var zone = document.querySelector('[data-reponse-statut="' + questionId + '"]');
    var champ = document.querySelector('[data-reponse-texte="' + questionId + '"]');
    var bouton = document.querySelector('[data-repondre="' + questionId + '"]');
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
    boiteDireDans(zone, 'Envoi depuis studyplanib@gmail.com…', false);
    boiteEnvoyerMail(email, texte.slice(0, 800), question.texte || '').then(function () {
        var record = {
            type: 'reponse',
            id: boiteId('r'),
            questionId: question.id,
            at: new Date().toISOString(),
            nom: boiteNom(),
            email: BOITE_EXPEDITEUR,
            destinataire: email,
            texte: texte.slice(0, 800),
            mail: true
        };
        boiteGarderVu(record);
        boiteListesCache.reponses = (boiteListesCache.reponses || []).concat([record]);
        boiteRendreQuestions(boiteListesCache);
        boiteEnvoyer(record).catch(function () {});
    }).catch(function (err) {
        if (bouton) bouton.disabled = false;
        boiteDireDans(zone, boiteMessageEchecMail(err, err && err.api), true);
    });
}

function boiteRendreEmplois(fusion) {
    var liste = document.getElementById('emploisListe');
    var statut = document.getElementById('emploisStatut');
    var filtre = document.getElementById('emploisFiltre');
    if (!liste) return;
    var mot = boiteNormaliser(filtre ? filtre.value : '');
    var doublons = {};
    (fusion.emplois || []).forEach(function (item) {
        var g = boiteNormaliser(item.google || item.email || '');
        if (g) doublons[g] = (doublons[g] || 0) + 1;
    });
    function boiteJourAffiche(jour) {
    var slots = (jour && jour.s ? jour.s : []).slice();
    var fin = slots.length ? String(slots[slots.length - 1].f || '') : '';
    var incomplet = fin && fin <= '12:30';
    if (incomplet) {
        [{ d: '12:30', f: '13:30', t: 'Déjeuner' }, { d: '13:30', f: '16:35', t: 'Cours' }].forEach(function (slot) {
            if (!slots.some(function (s) { return s.d === slot.d; })) slots.push(slot);
        });
    }
    return { slots: slots, incomplet: incomplet };
}
    var rows = fusion.emplois.filter(function (item) {
        if (!mot) return true;
        return boiteNormaliser((item.nom || '') + ' ' + (item.classe || '') + ' ' + (item.google || '') + ' ' + (item.email || '')).indexOf(mot) !== -1;
    });
    if (!rows.length) {
        liste.innerHTML = '<p style="color:#6b7280;">' + (fusion.emplois.length ? 'Aucun nom ne correspond.' : (fusion.partiel ? 'Les emplois du temps ne sont pas accessibles pour le moment. Réessaie.' : 'Aucune inscription reçue pour le moment. Chaque personne apparaît ici dès qu\'elle rouvre le site, même sans Google.')) + '</p>';
    } else {
        liste.innerHTML = rows.map(function (item) {
            var incomplet = false;
            var jours = (item.jours || []).map(function (jour) {
                var affiche = boiteJourAffiche(jour);
                if (affiche.incomplet) incomplet = true;
                var recus = (jour.s || []).length;
                var slots = affiche.slots.map(function (slot, index) {
                    var ajoute = index >= recus;
                    return '<p style="font-size:0.84rem;color:' + (ajoute ? '#6b7280' : '#1f2937') + ';margin:0.15rem 0;">' + boiteEchap(slot.d || '') + '–' + boiteEchap(slot.f || '') + '  ' + boiteEchap(slot.t || '') + (ajoute ? ' · cours fixe' : '') + '</p>';
                }).join('');
                return '<div style="margin-top:0.55rem;"><p style="font-size:0.75rem;font-weight:800;color:#047857;text-transform:uppercase;">' + boiteEchap(jour.j || '') + '</p>' + slots + '</div>';
            }).join('');
            if (incomplet) jours += '<p style="font-size:0.78rem;color:#b45309;margin-top:0.55rem;">La fin de journée n\'avait pas été reçue. Elle s\'ajoute dès que cet appareil rouvre le site.</p>';
            if (!jours) jours = '<p style="color:#6b7280;margin-top:0.45rem;">Inscrit. Le planning n\'a pas encore été généré sur son appareil.</p>';
            var google = item.google || item.email || '';
            var googleLigne = google
                ? 'Compte Google : ' + boiteEchap(google) + (item.googleNom ? ' · ' + boiteEchap(item.googleNom) : '')
                : 'Compte Google : pas encore connecté';
            if (google && doublons[boiteNormaliser(google)] > 1) googleLigne += ' · ce Gmail apparaît sur un autre planning';
            var meta = boiteEchap(item.classe || 'Classe non indiquée') + ' · ' + googleLigne + ' · ' + boiteEchap(boiteDate(item.at));
            var matieres = (item.matieres || []).length
                ? '<p style="font-size:0.8rem;color:#374151;margin-top:0.35rem;">Matières : ' + boiteEchap(item.matieres.join(', ')) + '</p>'
                : '';
            return '<details style="background:white;border:1.5px solid #e5e7eb;border-radius:1rem;padding:0.85rem 1rem;margin-bottom:0.7rem;">'
                + '<summary style="cursor:pointer;font-weight:800;color:#111827;">' + boiteEchap(item.nom || 'Sans nom') + ' <span style="font-weight:600;color:#6b7280;">· ' + boiteEchap(item.classe || '') + '</span></summary>'
                + '<p style="font-size:0.78rem;color:#6b7280;margin-top:0.35rem;">' + meta + '</p>'
                + matieres
                + jours
                + '</details>';
        }).join('');
    }
    if (statut) {
        var n = fusion.emplois.length;
        statut.textContent = (fusion.partiel ? 'Une partie des plannings n\'a pas pu être rechargée. ' : '') + n + ' personne' + (n > 1 ? 's' : '');
    }
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
    if (typeof compteChargerGIS === 'function') compteChargerGIS().catch(function () {});
    if (boiteAdminBranche) return;
    boiteAdminBranche = true;
    ['retoursRafraichir', 'questionsRafraichir', 'emploisRafraichir'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.onclick = boiteRafraichirAdmin;
    });
    var filtre = document.getElementById('emploisFiltre');
    if (filtre) filtre.oninput = function () {
        if (boiteListesCache) boiteRendreEmplois(boiteListesCache);
    };
    var questions = document.getElementById('questionsListe');
    if (questions && !questions.__boite) {
        questions.__boite = true;
        questions.addEventListener('click', function (e) {
            var btn = e.target && e.target.closest ? e.target.closest('[data-repondre]') : null;
            if (!btn) return;
            boiteRepondre(btn.getAttribute('data-repondre'));
        });
    }
}

function boiteNom() {
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
    var deja = boiteSession();
    if (deja) return Promise.resolve(deja);
    if (typeof compteChargerGIS !== 'function' || typeof compteDemanderJeton !== 'function') {
        return Promise.reject(new Error('google'));
    }
    var scope = typeof COMPTE_IDENTITE_SCOPE !== 'undefined' ? COMPTE_IDENTITE_SCOPE : 'openid email profile';
    return compteChargerGIS().then(function () {
        return compteDemanderJeton('select_account', scope);
    }).then(function (token) {
        return boiteFetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: 'Bearer ' + token }
        }, 12000).then(function (res) {
            if (!res.ok) throw new Error('profil');
            return res.json();
        });
    }).then(function (profil) {
        var session = typeof compteSessionDepuis === 'function' ? compteSessionDepuis(profil) : {
            sub: profil.sub || '',
            email: profil.email || '',
            name: profil.name || '',
            picture: profil.picture || ''
        };
        window.compteSession = session;
        var cle = typeof COMPTE_SESSION_KEY !== 'undefined' ? COMPTE_SESSION_KEY : 'studyPlanIB_googleSession';
        boiteEcrireJson(cle, session);
        if (typeof compteRafraichir === 'function') {
            try { compteRafraichir(); } catch (e) {}
        }
        setTimeout(function () { boitePublierEmploi(true); }, 600);
        return session;
    });
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
    var record = {
        type: 'question',
        id: boiteId('q'),
        at: new Date().toISOString(),
        nom: boiteNom(),
        texte: valeur.slice(0, 800),
        email: session && session.email ? session.email : '',
        google: session && session.email ? session.email : '',
        googleNom: session && session.name ? session.name : ''
    };
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
        var session = boiteSession();
        if (session) {
            if (choix) choix.style.display = 'none';
            boiteQuestion(session);
            return;
        }
        if (choix) choix.style.display = 'block';
        boiteDire('aideStatut', '', false);
    };
    if (avec) avec.onclick = function () {
        boiteDire('aideStatut', 'Connexion Google…', false);
        boiteLierGoogle().then(function (session) {
            boiteQuestion(session);
        }).catch(function () {
            boiteDire('aideStatut', 'La connexion Google n\'a pas abouti.', true);
        });
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
        var record = {
            type: 'feedback',
            id: boiteId('f'),
            at: new Date().toISOString(),
            nom: boiteNom(),
            texte: texte.slice(0, 800),
            email: adresse.slice(0, 120),
            google: sessionEnvoi && sessionEnvoi.email ? sessionEnvoi.email : '',
            googleNom: sessionEnvoi && sessionEnvoi.name ? sessionEnvoi.name : ''
        };
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
        for (k = 0; k < evs.length && slots.length < 24; k++) {
            var ev = evs[k];
            if (!ev || !ev.title || !ev.startTime) continue;
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
        if (!s || !s.name || matieres.length >= 12) return;
        matieres.push((s.name + (s.level ? ' ' + s.level : '')).trim());
    });
    if (!jours.length && !matieres.length && !session.email && !window.__profilComplet) return null;
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
        jours: jours
    };
}

function boiteInscrit() {
    if (window.__profilComplet) return true;
    return (typeof subjects !== 'undefined' && Array.isArray(subjects) && subjects.length > 0);
}

function boitePublierEmploi(force) {
    if (!boiteNom()) return;
    if (!force && !boiteInscrit()) return;
    var record = boiteSnapshotEmploi();
    if (!record) return;
    var empreinte = JSON.stringify({
        nom: record.nom,
        classe: record.classe,
        jours: record.jours,
        matieres: record.matieres,
        google: record.google,
        googleSub: record.googleSub
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
    try {
        boitePoserEtat(data);
        if (typeof customEvents !== 'undefined' && !customEvents.length) {
            customEvents.push({ id: 'boite-garde', day: -1, title: '', startTime: '00:00', endTime: '00:00' });
        }
        record = boiteSnapshotEmploi();
    } catch (e) {
        record = null;
    }
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

function boiteApresMemoire() {
    boiteMajMenu();
    boiteReessayerUneFois();
    if (!boiteInscrit() && !boiteSession()) return;
    clearTimeout(boiteEmploiTimer);
    boiteEmploiTimer = setTimeout(function () {
        boitePublierEmploi(false);
        boiteRejouerPasses();
    }, 2000);
}

if (typeof document !== 'undefined') boiteMajMenu();
