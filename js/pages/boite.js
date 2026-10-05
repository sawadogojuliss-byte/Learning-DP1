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
var BOITE_FILE = 'studyPlanIB_boiteFile';
var BOITE_VUS = 'studyPlanIB_boiteVus';
var BOITE_URL_LOCALE = 'studyPlanIB_boiteUrl';
var BOITE_EMPLOI_HASH = 'studyPlanIB_boiteEmploiHash';
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
    var body = 'email=' + encodeURIComponent('234701558+sawadogojuliss-byte@users.noreply.github.com') + '&default_ttl=604800';
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
    return Promise.resolve('');
}

function boiteCleKvdb(record) {
    if (record.type === 'emploi') return 'e_' + String(record.appareil || record.id || 'x').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
    var prefix = record.type === 'feedback' ? 'f_' : 'q_';
    return prefix + String(record.id || boiteId(prefix)).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
}

function boiteEcrireKvdb(url, record) {
    var cle = boiteCleKvdb(record);
    return boiteFetch(url.replace(/\/$/, '') + '/' + encodeURIComponent(cle) + '?ttl=604800', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    }, 12000).then(function (res) {
        if (!res.ok) throw new Error('kvdb');
    });
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
            google: record.google || '', googleNom: record.googleNom || '',
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
        emplois: (fusion.emplois || []).slice(0, 40),
        reponses: (fusion.reponses || []).slice(0, 80)
    });
}

function boiteGarderVu(record) {
    var fusion = boiteFusionner(boiteLireVus().concat([record]));
    boiteMemoriserVus(fusion);
}

function boiteEnvoyer(record) {
    boiteGarderFile(record);
    return boiteEnvoyerDistant(record).then(function (ok) {
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

function boiteParserMessage(texte) {
    try {
        var data = JSON.parse(texte);
        if (data && data.type) return data;
    } catch (e) {}
    return null;
}

function boiteLireNtfy() {
    return boiteFetch('https://ntfy.sh/' + encodeURIComponent(BOITE_SUJET) + '/json?poll=1&since=24h', { cache: 'no-store' }, 12000)
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
            if (!emplois[cle] || String(item.at || '') > String(emplois[cle].at || '')) emplois[cle] = item;
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
        emplois: listeEmplois.slice(0, 80)
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
    return boiteFetch(cfg.archive, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(boiteDocument(fusion))
    }, 12000).then(function () {}, function () {});
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

function boiteChargerListes(force) {
    if (boiteListesCache && !force) return Promise.resolve(boiteListesCache);
    return boiteLireConfig().then(function (cfg) {
        var archiveP = cfg.archive
            ? boiteLireArchive(cfg.archive).then(function (items) { return { ok: true, items: items }; }).catch(function () { return { ok: false, items: [] }; })
            : Promise.resolve({ ok: false, items: [] });
        var archiveOk = false;
        return Promise.all([
            archiveP,
            boiteLireNtfy().then(function (items) { return { ok: true, items: items }; }).catch(function () { return { ok: false, items: [] }; })
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
            + '<p style="font-size:0.75rem;color:#6b7280;margin-top:0.3rem;">Mail envoyé à ' + boiteEchap(rep.destinataire || email) + '</p>'
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
            + '<p style="font-size:0.78rem;color:#6b7280;margin-bottom:0.65rem;">Le message part dans l\'application et dans sa boîte mail. Le premier mail peut demander une confirmation.</p>'
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

function boiteEnvoyerMail(destinataire, message, question, adminEmail) {
    return boiteFetch('https://formsubmit.co/ajax/' + encodeURIComponent(destinataire), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            _subject: 'Réponse à ta question — Study Plan IB',
            _template: 'box',
            _captcha: 'false',
            _replyto: adminEmail || undefined,
            message: message,
            question: question || '',
            de: boiteNom()
        })
    }, 15000).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
            var ok = data && (data.success === true || data.success === 'true' || String(data.success).toLowerCase() === 'true');
            if (!res.ok || (data && data.success != null && !ok)) throw new Error('mail');
            if (!res.ok) throw new Error('mail');
            return data;
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
    boiteDireDans(zone, 'Envoi du mail…', false);
    var session = boiteSession();
    boiteEnvoyerMail(email, texte.slice(0, 800), question.texte || '', session && session.email ? session.email : '').then(function () {
        var record = {
            type: 'reponse',
            id: boiteId('r'),
            questionId: question.id,
            at: new Date().toISOString(),
            nom: boiteNom(),
            email: session && session.email ? session.email : '',
            destinataire: email,
            texte: texte.slice(0, 800),
            mail: true
        };
        boiteGarderVu(record);
        boiteListesCache.reponses = (boiteListesCache.reponses || []).concat([record]);
        boiteRendreQuestions(boiteListesCache);
        boiteEnvoyer(record).catch(function () {});
    }).catch(function () {
        if (bouton) bouton.disabled = false;
        boiteDireDans(zone, 'Le mail n\'a pas pu partir. La question reste en attente.', true);
    });
}

function boiteRendreEmplois(fusion) {
    var liste = document.getElementById('emploisListe');
    var statut = document.getElementById('emploisStatut');
    var filtre = document.getElementById('emploisFiltre');
    if (!liste) return;
    var mot = boiteNormaliser(filtre ? filtre.value : '');
    var rows = fusion.emplois.filter(function (item) {
        if (!mot) return true;
        return boiteNormaliser((item.nom || '') + ' ' + (item.classe || '')).indexOf(mot) !== -1;
    });
    if (!rows.length) {
        liste.innerHTML = '<p style="color:#6b7280;">' + (fusion.emplois.length ? 'Aucun nom ne correspond.' : (fusion.partiel ? 'Les emplois du temps ne sont pas accessibles pour le moment. Réessaie.' : 'Aucun emploi du temps reçu pour le moment.')) + '</p>';
    } else {
        liste.innerHTML = rows.map(function (item) {
            var jours = (item.jours || []).map(function (jour) {
                var slots = (jour.s || []).map(function (slot) {
                    return '<p style="font-size:0.84rem;color:#1f2937;margin:0.15rem 0;">' + boiteEchap(slot.d || '') + '–' + boiteEchap(slot.f || '') + '  ' + boiteEchap(slot.t || '') + '</p>';
                }).join('');
                return '<div style="margin-top:0.55rem;"><p style="font-size:0.75rem;font-weight:800;color:#047857;text-transform:uppercase;">' + boiteEchap(jour.j || '') + '</p>' + slots + '</div>';
            }).join('');
            if (!jours) jours = '<p style="color:#6b7280;margin-top:0.45rem;">Aucun créneau enregistré.</p>';
            var meta = boiteEchap(item.classe || 'Classe non indiquée');
            if (item.email || item.google) meta += ' · ' + boiteEchap(item.email || item.google);
            meta += ' · ' + boiteEchap(boiteDate(item.at));
            return '<details style="background:white;border:1.5px solid #e5e7eb;border-radius:1rem;padding:0.85rem 1rem;margin-bottom:0.7rem;">'
                + '<summary style="cursor:pointer;font-weight:800;color:#111827;">' + boiteEchap(item.nom || 'Sans nom') + ' <span style="font-weight:600;color:#6b7280;">· ' + boiteEchap(item.classe || '') + '</span></summary>'
                + '<p style="font-size:0.78rem;color:#6b7280;margin-top:0.35rem;">' + meta + '</p>'
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
        for (k = 0; k < evs.length && slots.length < 16; k++) {
            var ev = evs[k];
            if (!ev || !ev.title || !ev.startTime) continue;
            slots.push({ d: ev.startTime, f: ev.endTime || '', t: String(ev.title).slice(0, 42) });
        }
        if (slots.length) jours.push({ j: noms[i], s: slots });
    }
    if (!jours.length) return null;
    var session = window.compteSession || {};
    return {
        type: 'emploi',
        id: 'e_' + boiteAppareil(),
        appareil: boiteAppareil(),
        at: new Date().toISOString(),
        nom: boiteNom(),
        classe: typeof ibYear !== 'undefined' ? (ibYear || '') : '',
        email: session.email || '',
        google: session.email || '',
        googleNom: session.name || '',
        jours: jours
    };
}

function boitePublierEmploi() {
    if (!window.__profilComplet) return;
    var record = boiteSnapshotEmploi();
    if (!record) return;
    var empreinte = JSON.stringify({ nom: record.nom, classe: record.classe, jours: record.jours });
    var deja = boiteLireJson(BOITE_EMPLOI_HASH);
    if (deja && deja.hash === empreinte && Date.now() - (deja.at || 0) < 6 * 60 * 60 * 1000) return;
    boiteEnvoyer(record).then(function () {
        boiteEcrireJson(BOITE_EMPLOI_HASH, { hash: empreinte, at: Date.now() });
    }).catch(function () {});
}

var boiteEmploiTimer = null;
var boiteReessaiFait = false;
function boiteReessayerUneFois() {
    if (boiteReessaiFait) return;
    boiteReessaiFait = true;
    boiteReessayer();
}
function boiteApresMemoire() {
    boiteMajMenu();
    boiteReessayerUneFois();
    if (!window.__profilComplet) return;
    clearTimeout(boiteEmploiTimer);
    boiteEmploiTimer = setTimeout(boitePublierEmploi, 8000);
}

if (typeof document !== 'undefined') boiteMajMenu();
