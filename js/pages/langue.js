/* Relecture du message admin avant l'envoi : orthographe, grammaire, conjugaison. */

function langueNu(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/[’]/g, "'")
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function langueMots(texte) {
    var re = /[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿ0-9]+)*/g;
    var mots = [];
    var m;
    while ((m = re.exec(texte))) {
        mots.push({ mot: m[0], debut: m.index, fin: m.index + m[0].length });
    }
    return mots;
}

function langueErreur(debut, fin, message, suggestions, type) {
    return {
        debut: debut,
        fin: fin,
        message: message,
        suggestions: (suggestions || []).filter(Boolean).slice(0, 3),
        type: type || 'orthographe'
    };
}

var LANGUE_IGNORER = {
    ib: 1, tok: 1, ee: 1, ia: 1, cas: 1, hl: 1, sl: 1, enko: 1, dp: 1, dp1: 1,
    maths: 1, math: 1, ok: 1, pdf: 1, url: 1, gmail: 1
};

var LANGUE_FAUTES = {
    aparament: 'apparemment',
    apparament: 'apparemment',
    apelle: 'appelle',
    apeller: 'appeler',
    appeller: 'appeler',
    address: 'adresse',
    addresse: 'adresse',
    connection: 'connexion',
    developper: 'développer',
    developement: 'développement',
    evenement: 'événement',
    evenements: 'événements',
    reponse: 'réponse',
    reponses: 'réponses',
    repondre: 'répondre',
    reponds: 'réponds',
    repond: 'répond',
    repondu: 'répondu',
    repondue: 'répondue',
    repondus: 'répondus',
    repondues: 'répondues',
    regle: 'règle',
    regles: 'règles',
    reglé: 'réglé',
    reglee: 'réglée',
    reglees: 'réglées',
    regles: 'règles',
    probleme: 'problème',
    problemes: 'problèmes',
    eleve: 'élève',
    eleves: 'élèves',
    ecole: 'école',
    etre: 'être',
    etais: 'étais',
    etait: 'était',
    etaient: 'étaient',
    deja: 'déjà',
    tres: 'très',
    meme: 'même',
    memes: 'mêmes',
    plutot: 'plutôt',
    bientot: 'bientôt',
    apres: 'après',
    aupres: 'auprès',
    desole: 'désolé',
    desolee: 'désolée',
    desoles: 'désolés',
    desolees: 'désolées',
    voila: 'voilà',
    ca: 'ça',
    grace: 'grâce',
    francais: 'français',
    francaise: 'française',
    mathematiques: 'mathématiques',
    mathematique: 'mathématique',
    independant: 'indépendant',
    independante: 'indépendante',
    interressant: 'intéressant',
    interessant: 'intéressant',
    interressante: 'intéressante',
    language: 'langage',
    messsage: 'message',
    envoyee: 'envoyée',
    envoyees: 'envoyées',
    envoyes: 'envoyés',
    recu: 'reçu',
    recue: 'reçue',
    recus: 'reçus',
    recues: 'reçues',
    aujourdhui: "aujourd'hui",
    parceque: 'parce que',
    quelquechose: 'quelque chose',
    cest: "c'est",
    nest: "n'est",
    jai: "j'ai",
    quil: "qu'il",
    daccord: "d'accord",
    sil: "s'il",
    bonjours: 'bonjour',
    bonjoure: 'bonjour',
    creneau: 'créneau',
    creneaux: 'créneaux',
    seance: 'séance',
    seances: 'séances',
    revision: 'révision',
    revisions: 'révisions',
    reviser: 'réviser',
    controle: 'contrôle',
    controles: 'contrôles',
    matiere: 'matière',
    matieres: 'matières',
    geographie: 'géographie',
    economie: 'économie',
    litterature: 'littérature',
    theatre: 'théâtre',
    reveil: 'réveil',
    dejeuner: 'déjeuner',
    diner: 'dîner',
    gouter: 'goûter',
    bibliotheque: 'bibliothèque',
    peutetre: 'peut-être',
    verifie: 'vérifié',
    verifiee: 'vérifiée',
    verifier: 'vérifier',
    etat: 'état',
    eleve: 'élève'
};

var LANGUE_IRREG = {
    etre: { inf: 'être', je: 'suis', tu: 'es', il: 'est', nous: 'sommes', vous: 'êtes', ils: 'sont', pp: 'été' },
    avoir: { inf: 'avoir', je: 'ai', tu: 'as', il: 'a', nous: 'avons', vous: 'avez', ils: 'ont', pp: 'eu' },
    aller: { inf: 'aller', je: 'vais', tu: 'vas', il: 'va', nous: 'allons', vous: 'allez', ils: 'vont', pp: 'allé' },
    faire: { inf: 'faire', je: 'fais', tu: 'fais', il: 'fait', nous: 'faisons', vous: 'faites', ils: 'font', pp: 'fait' },
    pouvoir: { inf: 'pouvoir', je: 'peux', tu: 'peux', il: 'peut', nous: 'pouvons', vous: 'pouvez', ils: 'peuvent', pp: 'pu' },
    vouloir: { inf: 'vouloir', je: 'veux', tu: 'veux', il: 'veut', nous: 'voulons', vous: 'voulez', ils: 'veulent', pp: 'voulu' },
    devoir: { inf: 'devoir', je: 'dois', tu: 'dois', il: 'doit', nous: 'devons', vous: 'devez', ils: 'doivent', pp: 'dû' },
    savoir: { inf: 'savoir', je: 'sais', tu: 'sais', il: 'sait', nous: 'savons', vous: 'savez', ils: 'savent', pp: 'su' },
    venir: { inf: 'venir', je: 'viens', tu: 'viens', il: 'vient', nous: 'venons', vous: 'venez', ils: 'viennent', pp: 'venu' },
    prendre: { inf: 'prendre', je: 'prends', tu: 'prends', il: 'prend', nous: 'prenons', vous: 'prenez', ils: 'prennent', pp: 'pris' },
    dire: { inf: 'dire', je: 'dis', tu: 'dis', il: 'dit', nous: 'disons', vous: 'dites', ils: 'disent', pp: 'dit' },
    voir: { inf: 'voir', je: 'vois', tu: 'vois', il: 'voit', nous: 'voyons', vous: 'voyez', ils: 'voient', pp: 'vu' },
    partir: { inf: 'partir', je: 'pars', tu: 'pars', il: 'part', nous: 'partons', vous: 'partez', ils: 'partent', pp: 'parti' },
    finir: { inf: 'finir', je: 'finis', tu: 'finis', il: 'finit', nous: 'finissons', vous: 'finissez', ils: 'finissent', pp: 'fini' },
    ecrire: { inf: 'écrire', je: 'écris', tu: 'écris', il: 'écrit', nous: 'écrivons', vous: 'écrivez', ils: 'écrivent', pp: 'écrit' },
    repondre: { inf: 'répondre', je: 'réponds', tu: 'réponds', il: 'répond', nous: 'répondons', vous: 'répondez', ils: 'répondent', pp: 'répondu' },
    envoyer: { inf: 'envoyer', je: 'envoie', tu: 'envoies', il: 'envoie', nous: 'envoyons', vous: 'envoyez', ils: 'envoient', pp: 'envoyé' },
    essayer: { inf: 'essayer', je: 'essaie', tu: 'essaies', il: 'essaie', nous: 'essayons', vous: 'essayez', ils: 'essaient', pp: 'essayé' },
    etudier: { inf: 'étudier', je: 'étudie', tu: 'étudies', il: 'étudie', nous: 'étudions', vous: 'étudiez', ils: 'étudient', pp: 'étudié' }
};

var LANGUE_ER = [
    'manger', 'parler', 'regarder', 'aimer', 'travailler', 'chercher', 'trouver', 'demander',
    'penser', 'arriver', 'rester', 'passer', 'donner', 'montrer', 'expliquer', 'verifier',
    'utiliser', 'commencer', 'continuer', 'terminer', 'preparer', 'reviser', 'aider',
    'corriger', 'jouer', 'ecouter', 'oublier'
];

function langueFormeER(infinitif, pronom) {
    var nu = langueNu(infinitif);
    var stem = nu.slice(0, -2);
    var forme = {
        je: stem + 'e',
        tu: stem + 'es',
        il: stem + 'e',
        nous: stem + 'ons',
        vous: stem + 'ez',
        ils: stem + 'ent'
    }[pronom] || infinitif;
    if (nu === 'manger' && pronom === 'nous') forme = 'mangeons';
    if (nu === 'commencer' && pronom === 'nous') forme = 'commençons';
    if (nu === 'verifier') forme = forme.replace('verifier', 'vérifie').replace('verifi', 'vérifi');
    if (nu === 'reviser') forme = forme.replace('revis', 'révis');
    if (nu === 'preparer') forme = forme.replace('prepar', 'prépar');
    if (nu === 'ecouter') forme = forme.replace('ecout', 'écout');
    if (nu === 'expliquer') forme = forme;
    var accents = {
        verifier: 'vérifier', reviser: 'réviser', preparer: 'préparer', ecouter: 'écouter'
    };
    if (pronom === 'inf') return accents[nu] || infinitif;
    return forme;
}

function langueVerbes() {
    var table = {};
    function ajouter(cle, info) {
        ['je', 'tu', 'il', 'nous', 'vous', 'ils'].forEach(function (pronom) {
            var forme = info[pronom];
            var nu = langueNu(forme);
            if (!table[nu]) table[nu] = [];
            table[nu].push({ verbe: cle, pronom: pronom, forme: forme, inf: info.inf, pp: info.pp });
        });
        var infNu = langueNu(info.inf);
        if (!table[infNu]) table[infNu] = [];
        table[infNu].push({ verbe: cle, pronom: 'inf', forme: info.inf, inf: info.inf, pp: info.pp });
    }
    Object.keys(LANGUE_IRREG).forEach(function (cle) { ajouter(cle, LANGUE_IRREG[cle]); });
    LANGUE_ER.forEach(function (inf) {
        var info = { inf: langueFormeER(inf, 'inf'), pp: langueFormeER(inf, 'je').replace(/e$/, 'é') };
        if (langueNu(inf) === 'verifier') info.pp = 'vérifié';
        if (langueNu(inf) === 'reviser') info.pp = 'révisé';
        if (langueNu(inf) === 'preparer') info.pp = 'préparé';
        if (langueNu(inf) === 'ecouter') info.pp = 'écouté';
        ['je', 'tu', 'il', 'nous', 'vous', 'ils'].forEach(function (pronom) {
            info[pronom] = langueFormeER(inf, pronom);
        });
        ajouter(langueNu(inf), info);
    });
    return table;
}

var LANGUE_TABLE = null;
function langueTable() {
    if (!LANGUE_TABLE) LANGUE_TABLE = langueVerbes();
    return LANGUE_TABLE;
}

function languePronom(mot) {
    var nu = langueNu(mot).replace(/'/g, '');
    if (nu === 'je' || nu === 'j') return 'je';
    if (nu === 'tu') return 'tu';
    if (nu === 'il' || nu === 'elle' || nu === 'on') return 'il';
    if (nu === 'nous') return 'nous';
    if (nu === 'vous') return 'vous';
    if (nu === 'ils' || nu === 'elles') return 'ils';
    return '';
}

function langueAuxiliaire(mot) {
    var nu = langueNu(mot);
    if (nu === "j'ai" || nu === 'jai') return 'avoir';
    if (nu === 'ai' || nu === 'as' || nu === 'a' || nu === 'avons' || nu === 'avez' || nu === 'ont') return 'avoir';
    if (nu === 'suis' || nu === 'es' || nu === 'est' || nu === 'sommes' || nu === 'etes' || nu === 'sont') return 'etre';
    return '';
}

function langueFaute(mot) {
    var bas = String(mot || '').toLowerCase().replace(/’/g, "'");
    if (LANGUE_FAUTES[bas]) return LANGUE_FAUTES[bas];
    var nu = langueNu(bas);
    if (nu === bas && LANGUE_FAUTES[nu]) return LANGUE_FAUTES[nu];
    return '';
}

function langueAvecPronom(pronom, forme) {
    if (pronom === 'je' && /^[aeiouyhàâäéèêëîïôùûœ]/i.test(forme)) return "j'" + forme;
    var etiquette = { je: 'je', tu: 'tu', il: 'il', nous: 'nous', vous: 'vous', ils: 'ils' }[pronom] || pronom;
    return etiquette + ' ' + forme;
}

function langueLocale(texte) {
    var mots = langueMots(texte);
    var erreurs = [];
    var pris = {};
    function poser(mot, message, suggestions, type) {
        if (!mot || pris[mot.debut]) return;
        pris[mot.debut] = 1;
        erreurs.push(langueErreur(mot.debut, mot.fin, message, suggestions, type));
    }
    var i;
    for (i = 0; i < mots.length; i++) {
        var mot = mots[i];
        var nu = langueNu(mot.mot);
        var cloture = mot.mot.split(/['’]/);
        var pronomAttache = '';
        var suite = mot.mot;
        if (cloture.length === 2 && langueNu(cloture[0]) === 'j') {
            pronomAttache = 'je';
            suite = cloture[1];
            nu = langueNu(suite);
        }
        if (LANGUE_IGNORER[nu] || /[0-9@]/.test(mot.mot)) continue;
        var suivant = mots[i + 1];
        var pronom = pronomAttache || (suivant ? languePronom(mot.mot) : '');
        if (!pronomAttache && pronom && suivant) {
            var formeSuivante = langueTable()[langueNu(suivant.mot)] || [];
            var connu = formeSuivante.length > 0;
            if (connu) {
                var inf = formeSuivante.some(function (f) { return f.pronom === 'inf'; });
                var bon = formeSuivante.some(function (f) { return f.pronom === pronom; });
                if (!bon) {
                    var modele = formeSuivante[0];
                    var attendu = inf ? modele : (formeSuivante.filter(function (f) { return f.pronom !== 'inf'; })[0] || modele);
                    var info = null;
                    Object.keys(LANGUE_IRREG).some(function (cle) {
                        if (cle === attendu.verbe || langueNu(LANGUE_IRREG[cle].inf) === langueNu(attendu.inf)) {
                            info = LANGUE_IRREG[cle];
                            return true;
                        }
                        return false;
                    });
                    var correction = info ? info[pronom] : langueFormeER(attendu.inf, pronom);
                    poser({ debut: mot.debut, fin: suivant.fin }, 'La conjugaison ne va pas avec « ' + mot.mot + ' ».', [langueAvecPronom(pronom, correction)], 'conjugaison');
                    i += 1;
                    continue;
                }
                if (pronom === 'je' && /^[aeiouyhàâäéèêëîïôùûœ]/i.test(suivant.mot)) {
                    poser({ debut: mot.debut, fin: suivant.fin }, '« je » s’élide devant une voyelle.', ["j'" + suivant.mot], 'grammaire');
                    i += 1;
                    continue;
                }
            } else if (pronom === 'je' && (langueNu(suivant.mot) === 'y' || langueNu(suivant.mot) === 'en')) {
                poser({ debut: mot.debut, fin: suivant.fin }, '« je » s’élide devant « ' + suivant.mot + ' ».', ["j'" + suivant.mot], 'grammaire');
                i += 1;
                continue;
            }
        }
        if (pronomAttache) {
            var formes = langueTable()[nu] || [];
            if (formes.length && !formes.some(function (f) { return f.pronom === 'je'; })) {
                var base = formes[0];
                var infoJ = LANGUE_IRREG[base.verbe];
                var corr = infoJ ? infoJ.je : langueFormeER(base.inf, 'je');
                poser(mot, 'La conjugaison après « j’ » n’est pas celle de « je ».', [langueAvecPronom('je', corr)], 'conjugaison');
                continue;
            }
        }
        if (i > 0 && langueAuxiliaire(mots[i - 1].mot)) {
            var commeInf = (langueTable()[nu] || []).filter(function (f) { return f.pronom === 'inf'; })[0];
            if (commeInf && commeInf.pp) {
                poser(mot, 'Après l’auxiliaire, le verbe se met au participe passé.', [commeInf.pp], 'conjugaison');
                continue;
            }
        }
        var faute = langueFaute(pronomAttache ? suite : mot.mot);
        if (faute && String(pronomAttache ? suite : mot.mot).toLowerCase().replace(/’/g, "'") !== faute.toLowerCase()) {
            var propose = faute;
            if (mot.mot.charAt(0) === mot.mot.charAt(0).toUpperCase() && propose.charAt(0) !== "'") {
                propose = propose.charAt(0).toUpperCase() + propose.slice(1);
            }
            poser(mot, 'Orthographe à corriger.', [propose], 'orthographe');
            continue;
        }
        if (suivant && langueNu(mot.mot) === 'ce' && (langueNu(suivant.mot) === 'est' || langueNu(suivant.mot) === 'etait')) {
            poser({ debut: mot.debut, fin: suivant.fin }, '« ce » s’élide devant « est ».', ["c'est"], 'grammaire');
            pris[suivant.debut] = 1;
            i += 1;
            continue;
        }
        if (suivant && langueNu(mot.mot) === 'ne' && (langueTable()[langueNu(suivant.mot)] || langueNu(suivant.mot) === 'y' || langueNu(suivant.mot) === 'en')) {
            poser({ debut: mot.debut, fin: suivant.fin }, '« ne » s’élide devant une voyelle.', ["n'" + suivant.mot], 'grammaire');
            pris[suivant.debut] = 1;
            i += 1;
            continue;
        }
        if (suivant && langueNu(mot.mot) === 'si' && (langueNu(suivant.mot) === 'il' || langueNu(suivant.mot) === 'ils')) {
            poser({ debut: mot.debut, fin: suivant.fin }, '« si » s’élide devant « il ».', [langueNu(suivant.mot) === 'ils' ? "s'ils" : "s'il"], 'grammaire');
            pris[suivant.debut] = 1;
            i += 1;
        }
    }
    return erreurs.sort(function (a, b) { return a.debut - b.debut; });
}

function langueEtiquette(type) {
    if (type === 'conjugaison') return 'Conjugaison';
    if (type === 'grammaire') return 'Grammaire';
    return 'Orthographe';
}

function langueCategorie(match) {
    var rule = match && match.rule || {};
    var cat = rule.category || {};
    var id = String(cat.id || '').toUpperCase();
    var nom = String(cat.name || '').toLowerCase();
    var msg = String(match.message || '').toLowerCase();
    var rid = String(rule.id || '').toLowerCase();
    if (id === 'TYPOS' || nom.indexOf('orthographe') !== -1 || nom.indexOf('faute de frappe') !== -1 || nom.indexOf('typo') !== -1) return 'orthographe';
    if (msg.indexOf('conjugu') !== -1 || rid.indexOf('conjugu') !== -1 || nom.indexOf('conjugu') !== -1) return 'conjugaison';
    if (id === 'GRAMMAR' || id === 'CONFUSED_WORDS' || id === 'SEMANTICS' || nom.indexOf('grammaire') !== -1 || nom.indexOf('confusion') !== -1) return 'grammaire';
    return '';
}

function langueDansEmail(texte, debut, fin) {
    var re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
    var m;
    while ((m = re.exec(texte))) {
        if (debut < m.index + m[0].length && fin > m.index) return true;
    }
    return false;
}

function langueFiltrerOutil(texte, matches) {
    var erreurs = [];
    (matches || []).forEach(function (match) {
        var type = langueCategorie(match);
        if (!type) return;
        var debut = Number(match.offset || 0);
        var fin = debut + Number(match.length || 0);
        if (fin <= debut || fin > texte.length) return;
        var extrait = texte.slice(debut, fin);
        if (LANGUE_IGNORER[langueNu(extrait)] || langueDansEmail(texte, debut, fin)) return;
        var suggestions = (match.replacements || []).map(function (item) { return item && item.value; }).filter(Boolean);
        erreurs.push(langueErreur(debut, fin, String(match.message || 'À corriger.'), suggestions, type));
    });
    return erreurs.sort(function (a, b) { return a.debut - b.debut; });
}

function langueOutil(texte) {
    if (typeof fetch !== 'function') return Promise.resolve(null);
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 7000);
    return fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: 'language=fr&enabledOnly=false&text=' + encodeURIComponent(texte),
        signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('langue');
        return res.json();
    }).then(function (data) {
        return langueFiltrerOutil(texte, data && data.matches);
    }).catch(function () {
        clearTimeout(timer);
        return null;
    });
}

function langueAnalyser(texte) {
    var brut = String(texte || '');
    return langueOutil(brut).then(function (erreurs) {
        var locales = langueLocale(brut);
        if (!erreurs) return locales;
        locales.forEach(function (err) {
            var couvert = erreurs.some(function (autre) {
                return err.debut < autre.fin && err.fin > autre.debut;
            });
            if (!couvert) erreurs.push(err);
        });
        return erreurs.sort(function (a, b) { return a.debut - b.debut; });
    });
}

function langueMarquer(texte, erreurs) {
    var html = '';
    var curseur = 0;
    (erreurs || []).forEach(function (err) {
        if (err.debut < curseur || err.fin <= err.debut) return;
        html += langueEchap(texte.slice(curseur, err.debut));
        html += '<mark style="background:#fde68a;color:#78350f;border-radius:0.25rem;padding:0 0.15rem;">' + langueEchap(texte.slice(err.debut, err.fin)) + '</mark>';
        curseur = err.fin;
    });
    html += langueEchap(texte.slice(curseur));
    return html;
}

function langueEchap(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
