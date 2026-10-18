/* ============================================================
   PAGE Devoirs & Examens
   Deux parties :
   - Devoirs : composition à une date précise + heures de révision
     insérées dans les moments où l'élève n'est pas en cours.
   - Examens : le planning des épreuves lu une semaine à l'avance
     déclenche un programme de révisions (semaine avant : révisions et
     exercices sur les matières à examiner, sans CAS, mémoire ni éval
     interne ; semaine des examens : les épreuves + quelques révisions,
     et une matière composée n'est plus jamais révisée).
   La lecture automatique (OCR) propose, l'élève confirme : chaque ligne
   détectée est vérifiable et corrigeable avant d'entrer dans le planning.
   Vue : pages/devoirs.html
   ============================================================ */

var DEVOIRS_CLE = 'studyPlanIB_devoirs';
var devoirsOngletActif = 'devoirs';
var devoirsOcrEnCours = false;
var devoirsFileCourant = null;
var devoirsPropositions = [];

/* ── Stockage ──────────────────────────────────────────────────────── */

function devoirsLireStore() {
    try {
        var d = JSON.parse(localStorage.getItem(DEVOIRS_CLE) || 'null');
        if (d && typeof d === 'object') {
            return {
                bac: (d.bac === true || d.bac === false) ? d.bac : null,
                bacDemande: d.bacDemande === 2 ? 2 : 0,
                devoirs: Array.isArray(d.devoirs) ? d.devoirs.filter(function (x) { return x && x.id; }) : [],
                examens: Array.isArray(d.examens) ? d.examens.filter(function (x) { return x && x.id; }) : []
            };
        }
    } catch (e) {}
    return { bac: null, bacDemande: 0, devoirs: [], examens: [] };
}

function devoirsEcrireStore(store) {
    try { localStorage.setItem(DEVOIRS_CLE, JSON.stringify(store)); } catch (e) {}
}

function devoirsFaitBac() {
    return devoirsLireStore().bac === true;
}

function devoirsStoreCompact() {
    var s = devoirsLireStore();
    return { bac: s.bac, bacDemande: s.bacDemande, devoirs: s.devoirs, examens: s.examens };
}

function devoirsId(prefixe) {
    return prefixe + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ── La question du bac national ───────────────────────────────────── */
/* Posée aux DP2 : à l'inscription juste après les matières, et par un
   popup aux élèves déjà inscrits qui n'ont pas encore répondu. */

/* Le popup doit atteindre tous les DP2 déjà connectés : ceux qui n'ont
   jamais répondu, et une fois de plus ceux qui avaient répondu avant
   que la réponse ne s'applique vraiment au planning (version 1). */
function devoirsBacADemander() {
    var s = devoirsLireStore();
    if (s.bac === true || s.bac === false) return s.bacDemande !== 2;
    return true;
}

function devoirsPoserQuestionBac(apres) {
    var store = devoirsLireStore();
    /* Déjà répondu sous la version actuelle : plus jamais de popup.
       Une réponse plus ancienne (avant que « Oui » n'applique vraiment
       les créneaux du bac) mérite une nouvelle demande. */
    if (store.bacDemande === 2 && (store.bac === true || store.bac === false)) {
        if (typeof apres === 'function') apres();
        return;
    }
    var ancien = document.getElementById('bacQuestionModal');
    if (ancien) ancien.remove();
    var voile = document.createElement('div');
    voile.id = 'bacQuestionModal';
    voile.style.cssText = 'position:fixed;inset:0;background:rgba(17,24,39,0.55);z-index:320;display:flex;align-items:center;justify-content:center;padding:1rem;';
    voile.innerHTML =
        '<div style="background:white;border-radius:1.25rem;max-width:26rem;width:100%;padding:1.5rem;box-shadow:0 20px 50px rgba(0,0,0,0.25);text-align:center;">' +
        '<div style="font-size:2.2rem;line-height:1;">🎓</div>' +
        '<h3 style="margin:0.6rem 0 0.35rem;font-size:1.15rem;font-weight:800;color:#111827;">Fais-tu le bac national ?</h3>' +
        '<p style="margin:0 0 1.1rem;font-size:0.88rem;color:#6b7280;line-height:1.5;">Si oui, les créneaux réservés au bac entrent dans ton emploi du temps : le vendredi de 14h55 à 16h25 et le samedi de 8h00 à 13h00.</p>' +
        '<div style="display:flex;gap:0.6rem;">' +
        '<button id="bacQuestionNon" style="flex:1;padding:0.8rem;border:1.5px solid #e5e7eb;border-radius:0.8rem;background:#f9fafb;color:#374151;font:inherit;font-weight:700;cursor:pointer;">Non</button>' +
        '<button id="bacQuestionOui" style="flex:1;padding:0.8rem;border:none;border-radius:0.8rem;background:linear-gradient(135deg,#059669,#10b981);color:white;font:inherit;font-weight:800;cursor:pointer;">Oui, je fais le bac</button>' +
        '</div></div>';
    document.body.appendChild(voile);
    function repondre(oui) {
        var s = devoirsLireStore();
        s.bac = oui;
        s.bacDemande = 2; /* la réponse s'applique vraiment au planning */
        devoirsEcrireStore(s);
        voile.remove();
        if (typeof apres === 'function') apres();
        else if (typeof generatePlanning === 'function') { try { generatePlanning(); } catch (e) {} }
        if (typeof devoirsRendreSiVisible === 'function') { try { devoirsRendreSiVisible(); } catch (e) {} }
    }
    voile.querySelector('#bacQuestionOui').onclick = function () { repondre(true); };
    voile.querySelector('#bacQuestionNon').onclick = function () { repondre(false); };
}

/* ── Matières connues ──────────────────────────────────────────────── */

var DEVOIRS_MATIERES_DICO = [
    'Mathématiques', 'Physique', 'Chimie', 'Biologie', 'SVT',
    'Français', 'Philosophie', 'Histoire', 'Géographie',
    'Anglais', 'Espagnol', 'Allemand', 'Économie', 'Informatique',
    'ESS', 'Bac national'
];

function devoirsNormaliser(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function devoirsMatieresConnues() {
    var liste = [];
    if (typeof subjects !== 'undefined' && Array.isArray(subjects)) {
        subjects.forEach(function (s) { if (s && s.name) liste.push(s.name); });
    }
    if (typeof optionalSubjects !== 'undefined' && Array.isArray(optionalSubjects)) {
        optionalSubjects.forEach(function (s) { if (s && s.name && liste.indexOf(s.name) === -1) liste.push(s.name); });
    }
    DEVOIRS_MATIERES_DICO.forEach(function (m) { if (liste.indexOf(m) === -1) liste.push(m); });
    return liste;
}

/* ── Les matières de l'élève ───────────────────────────────────────── */
/* Le document ne peut proposer que ce que l'élève suit vraiment. Ses
   matières viennent de son inscription ; une même matière s'écrit de
   plusieurs façons (Maths, Mathematics, Mathématiques AA…), d'où les
   familles. Une famille n'est proposée que si l'élève la suit. */
function devoirsMatieresEleve() {
    var liste = [];
    if (typeof subjects !== 'undefined' && Array.isArray(subjects)) {
        subjects.forEach(function (s) { if (s && s.name && liste.indexOf(s.name) === -1) liste.push(s.name); });
    }
    if (typeof optionalSubjects !== 'undefined' && Array.isArray(optionalSubjects)) {
        optionalSubjects.forEach(function (s) { if (s && s.name && liste.indexOf(s.name) === -1) liste.push(s.name); });
    }
    return liste;
}

var DEVOIRS_FAMILLES = [
    { cles: ['math', 'maths', 'mathematiques', 'mathematics'], canon: 'Mathématiques' },
    { cles: ['phys', 'physics'], canon: 'Physique' },
    { cles: ['chim', 'chem', 'chemistry'], canon: 'Chimie' },
    { cles: ['bio', 'biolog', 'biology'], canon: 'Biologie' },
    { cles: ['svt'], canon: 'SVT' },
    { cles: ['ess'], canon: 'ESS' },
    { cles: ['philo'], canon: 'Philosophie' },
    { cles: ['fr', 'fren', 'french', 'francais'], canon: 'Français' },
    { cles: ['hist', 'history'], canon: 'Histoire' },
    { cles: ['geo', 'geog', 'geography'], canon: 'Géographie' },
    { cles: ['angl', 'engl', 'english'], canon: 'Anglais' },
    { cles: ['espag', 'spanish'], canon: 'Espagnol' },
    { cles: ['allemand', 'german'], canon: 'Allemand' },
    { cles: ['econ', 'economics'], canon: 'Économie' },
    { cles: ['info', 'informatique', 'computer'], canon: 'Informatique' },
    { cles: ['bac'], canon: 'Bac national' }
];

function devoirsMots(norm) {
    return String(norm || '').split(' ').filter(Boolean);
}

/* Les familles que suit l'élève, avec ses propres noms de matières.
   Une matière hors famille (théâtre, arts…) devient sa propre famille. */
function devoirsFamillesEleve() {
    var familles = [];
    devoirsMatieresEleve().forEach(function (nom) {
        var n = devoirsNormaliser(nom);
        if (!n) return;
        var mots = devoirsMots(n);
        var trouve = null;
        DEVOIRS_FAMILLES.forEach(function (f) {
            if (trouve) return;
            for (var i = 0; i < mots.length; i++) {
                for (var j = 0; j < f.cles.length; j++) {
                    if (mots[i].indexOf(f.cles[j]) === 0) { trouve = f; return; }
                }
            }
        });
        if (trouve) {
            var existante = null;
            familles.forEach(function (e) { if (!existante && e.famille === trouve) existante = e; });
            if (existante) existante.noms.push(nom);
            else familles.push({ famille: trouve, noms: [nom] });
        } else if (mots[0] && mots[0].length >= 3) {
            familles.push({ famille: { cles: [mots[0]], canon: nom }, noms: [nom] });
        }
    });
    return familles;
}

/* La matière d'une ligne, parmi celles de l'élève uniquement : le nom
   complet d'abord, puis la famille la plus précise (math → Maths AA). */
function devoirsMatiereLigne(norm, familles) {
    var mots = devoirsMots(norm);
    var meilleure = null, longueur = 0;
    familles.forEach(function (e) {
        for (var i = 0; i < e.noms.length; i++) {
            if (norm.indexOf(devoirsNormaliser(e.noms[i])) !== -1) {
                if (!meilleure || devoirsNormaliser(e.noms[i]).length > longueur) {
                    meilleure = { nom: e.noms[i] };
                    longueur = devoirsNormaliser(e.noms[i]).length;
                }
            }
        }
        e.famille.cles.forEach(function (c) {
            for (var j = 0; j < mots.length; j++) {
                if (mots[j].indexOf(c) === 0 && c.length > longueur) {
                    meilleure = { nom: e.noms[0] };
                    longueur = c.length;
                }
            }
        });
    });
    return meilleure;
}

/* Une matière d'école que l'élève ne suit pas : la ligne ne doit pas
   lui être proposée, même avec ses heures. */
function devoirsSujetNonSuivi(norm) {
    var mots = devoirsMots(norm);
    for (var i = 0; i < DEVOIRS_FAMILLES.length; i++) {
        var f = DEVOIRS_FAMILLES[i];
        if (f.canon === 'Bac national') continue;
        for (var j = 0; j < mots.length; j++) {
            for (var k = 0; k < f.cles.length; k++) {
                if (mots[j].indexOf(f.cles[k]) === 0) return true;
            }
        }
    }
    return false;
}

/* Retrouve une matière dans un bout de texte : le nom complet d'abord,
   puis un fragment significatif (math → Mathématiques). */
function devoirsTrouverMatiere(texteNormalise, connues) {
    if (!texteNormalise) return '';
    var meilleure = '';
    var longueur = 0;
    (connues || devoirsMatieresConnues()).forEach(function (nom) {
        var n = devoirsNormaliser(nom);
        if (!n) return;
        if (texteNormalise.indexOf(n) !== -1 && n.length > longueur) { meilleure = nom; longueur = n.length; }
    });
    if (meilleure) return meilleure;
    var fragments = { math: 'Mathématiques', phys: 'Physique', chim: 'Chimie', chem: 'Chimie', bio: 'Biologie', svt: 'SVT', ess: 'ESS', philo: 'Philosophie', fran: 'Français', fren: 'Français', hist: 'Histoire', geo: 'Géographie', geog: 'Géographie', angl: 'Anglais', engl: 'Anglais', espag: 'Espagnol', econ: 'Économie', info: 'Informatique', bac: 'Bac national' };
    var cles = Object.keys(fragments);
    var mots = String(texteNormalise || '').split(' ');
    for (var i = 0; i < cles.length; i++) {
        for (var j = 0; j < mots.length; j++) {
            if (mots[j] && mots[j].indexOf(cles[i]) === 0) return fragments[cles[i]];
        }
    }
    return '';
}

/* ── Analyse d'un texte (OCR ou collé) ─────────────────────────────── */

var DEVOIRS_JOURS = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0 };
var DEVOIRS_MOIS = { janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6, aout: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11 };

function devoirsCle(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function devoirsAnneePour(mois) {
    var maintenant = new Date();
    if (mois < maintenant.getMonth() - 6) return maintenant.getFullYear() + 1;
    return maintenant.getFullYear();
}

function devoirsNormaliserGarde(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u2013\u2014]/g, '-') /* tirets longs des documents scolaires */
        .replace(/[^a-z0-9 \/:.\-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function devoirsParserTexte(texte, connues) {
    var lignes = String(texte || '').split(/[\n\r]+/);
    var propositions = [];
    var dateCourante = ''; /* dernière date rencontrée : elle vaut pour les lignes suivantes */
    var i, j;
    /* Un planning d'épreuves se présente souvent en tableau : une date,
       puis plusieurs créneaux horaires, puis les matières, puis les
       « Paper … », les durées et les surveillants. On regroupe par bloc
       de date et on apparie heures et matières dans l'ordre. */
    var blocHeures = [];
    var blocMatieres = [];
    var enPapiers = false;
    var blocRefuse = false; /* le bloc ne parle que de matières non suivies */
    var connuesListe = connues || devoirsMatieresConnues();
    /* les matières de l'élève dirigent la lecture : sans profil connu
       (pas encore inscrit), toutes les matières restent proposables */
    var famillesEleve = devoirsFamillesEleve();
    var profilConnu = famillesEleve.length > 0;

    function devoirsH2Mvalide(h) {
        return h && devoirsH2M(h.fin) > devoirsH2M(h.debut);
    }
    function viderBloc() {
        var n = Math.min(blocHeures.length, blocMatieres.length);
        var k;
        for (k = 0; k < n; k++) {
            if (devoirsH2Mvalide(blocHeures[k])) {
                propositions.push({ matiere: blocMatieres[k], date: dateCourante, debut: blocHeures[k].debut, fin: blocHeures[k].fin, ligne: '' });
            }
        }
        /* des heures sans matière ne sont proposées à compléter que si
           le bloc ne parle pas d'une matière que l'élève ne suit pas */
        if (blocHeures.length && !blocMatieres.length && dateCourante && !blocRefuse) {
            for (k = 0; k < blocHeures.length; k++) {
                if (devoirsH2Mvalide(blocHeures[k])) {
                    propositions.push({ matiere: '', date: dateCourante, debut: blocHeures[k].debut, fin: blocHeures[k].fin, ligne: '' });
                }
            }
        }
        blocHeures = [];
        blocMatieres = [];
        blocRefuse = false;
        enPapiers = false;
    }

    for (i = 0; i < lignes.length; i++) {
        var ligne = lignes[i];
        if (!ligne || !ligne.trim()) continue;
        var norm = devoirsNormaliserGarde(ligne);
        if (!norm) continue;

        /* l'après-midi à l'anglaise : « 1:25 pm » devient « 13:25 » */
        norm = norm.replace(/(\d{1,2})(:\d{2})\s*pm\b/g, function (x, h, mn) { return ((Number(h) % 12) + 12) + mn; });
        norm = norm.replace(/(\d{1,2})\s*pm\b/g, function (x, h) { return ((Number(h) % 12) + 12) + ':00'; });
        norm = norm.replace(/(\d{1,2})(:\d{2})?\s*am\b/g, function (x, h, mn) { return ('0' + Number(h)).slice(-2) + (mn || ':00'); });

        /* une durée (« 01h 30 min ») n'est pas une heure de composition */
        var estDuree = /(^|\s)\d{1,2}\s*(h|:)\s*\d{0,2}\s*(min|mn)/.test(norm) && norm.indexOf('paper') === -1;

        /* heures : 8h-13h, 8h00 - 13h00, de 8h à 13h, 8:30/13:45, 14h55 a 16h25 */
        var heures = null;
        var m = norm.match(/(\d{1,2})\s*(?:h|:|\.)\s*(\d{2})?\s*(?:-|–|—|a|jusqu a|\/)\s*(\d{1,2})\s*(?:h|:|\.)\s*(\d{2})?/);
        if (m) {
            heures = {
                debut: ('0' + m[1]).slice(-2) + ':' + (m[2] || '00'),
                fin: ('0' + m[3]).slice(-2) + ':' + (m[4] || '00')
            };
        }
        if (!heures) {
            var isoles = norm.match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/g);
            if (isoles && isoles.length >= 2) {
                var h1 = isoles[0].match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/);
                var h2 = isoles[isoles.length - 1].match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/);
                heures = { debut: ('0' + h1[1]).slice(-2) + ':' + (h1[2] || '00'), fin: ('0' + h2[1]).slice(-2) + ':' + (h2[2] || '00') };
            }
        }

        /* date : 23/10, 23-10-2026, lundi 23, 23 octobre */
        var dateTrouvee = '';
        var dm = norm.match(/\b(\d{1,2})\s*[\/\-.]\s*(\d{1,2})(?:\s*[\/\-.]\s*(\d{2,4}))?\b/);
        if (dm) {
            var an = dm[3] ? (dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3])) : devoirsAnneePour(Number(dm[2]) - 1);
            var dObj = new Date(an, Number(dm[2]) - 1, Number(dm[1]));
            if (!isNaN(dObj.getTime()) && Number(dm[1]) >= 1 && Number(dm[1]) <= 31 && Number(dm[2]) >= 1 && Number(dm[2]) <= 12) {
                dateTrouvee = devoirsCle(dObj);
            }
        }
        if (!dateTrouvee) {
            var jm = norm.match(/\b(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/);
            if (jm) dateTrouvee = devoirsCle(new Date(devoirsAnneePour(DEVOIRS_MOIS[jm[2]]), DEVOIRS_MOIS[jm[2]], Number(jm[1])));
        }
        if (!dateTrouvee) {
            var clesJours = Object.keys(DEVOIRS_JOURS);
            for (j = 0; j < clesJours.length; j++) {
                if (norm.indexOf(clesJours[j]) !== -1) {
                    var avecJour = norm.match(new RegExp(clesJours[j] + '\\s+(\\d{1,2})'));
                    if (avecJour) {
                        /* lundi 23 du mois en cours ou du suivant */
                        var essai = new Date();
                        for (var k = 0; k < 60; k++) {
                            if (essai.getDate() === Number(avecJour[1]) && essai.getDay() === DEVOIRS_JOURS[clesJours[j]]) break;
                            essai.setDate(essai.getDate() + 1);
                        }
                        dateTrouvee = devoirsCle(essai);
                    }
                    break;
                }
            }
        }

        var matiereObjet = profilConnu ? devoirsMatiereLigne(norm, famillesEleve) : null;
        var matiere = matiereObjet ? matiereObjet.nom : (profilConnu ? '' : devoirsTrouverMatiere(norm, connuesListe));

        /* une matière d'école que l'élève ne suit pas : la ligne ne lui
           est pas proposée — ni ses heures dans un bloc */
        if (profilConnu && !matiere && devoirsSujetNonSuivi(norm)) {
            if (!heures && !dateTrouvee) blocRefuse = true;
            continue;
        }

        /* « Paper 1 - SL » : la colonne des papiers commence, les
           matières du bloc sont déjà toutes lues. */
        if (/paper|papier/.test(norm) && !heures && !dateTrouvee && !matiere) { enPapiers = true; continue; }
        if (estDuree && !matiere && !dateTrouvee) continue;
        if (enPapiers && !heures && !dateTrouvee) continue;
        if (heures && !devoirsH2Mvalide(heures)) heures = null;

        /* 1) une ligne complète : matière, date et heures ensemble */
        if (heures && matiere) {
            viderBloc();
            propositions.push({
                matiere: matiere,
                date: dateTrouvee || dateCourante,
                debut: heures.debut,
                fin: heures.fin,
                ligne: String(ligne).trim().slice(0, 90)
            });
            if (dateTrouvee) dateCourante = dateTrouvee;
            continue;
        }
        /* 2) une date seule : un nouveau bloc commence */
        if (dateTrouvee && !heures && !matiere) {
            viderBloc();
            dateCourante = dateTrouvee;
            continue;
        }
        /* 3) des heures seules : elles s'empilent pour le bloc */
        if (heures && !matiere && !dateTrouvee) {
            blocHeures.push(heures);
            continue;
        }
        /* 4) une matière seule : elle rejoint le bloc en cours */
        if (matiere && !heures && !dateTrouvee) {
            if (!enPapiers) blocMatieres.push(matiere);
            continue;
        }
        /* 5) des heures et une date sans matière */
        if (heures && dateTrouvee && !matiere) {
            viderBloc();
            propositions.push({ matiere: '', date: dateTrouvee, debut: heures.debut, fin: heures.fin, ligne: String(ligne).trim().slice(0, 90) });
            dateCourante = dateTrouvee;
            continue;
        }
    }
    viderBloc();
    return propositions;
}

function devoirsH2M(h) {
    var p = String(h || '').split(':');
    var v = (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
    if (String(h || '').indexOf('h') !== -1) {
        var q = String(h || '').split('h');
        v = (parseInt(q[0], 10) || 0) * 60 + (parseInt(q[1], 10) || 0);
    }
    return ((v % 1440) + 1440) % 1440;
}

/* ── Lecture automatique du document (OCR embarqué) ────────────────── */

function devoirsChargerTesseract() {
    if (window.Tesseract) return Promise.resolve();
    return new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = 'lib/ocr/tesseract.min.js?v=' + (typeof version !== 'undefined' ? version : '1');
        s.onload = function () { res(); };
        s.onerror = function () { rej(new Error('Impossible de charger la lecture automatique. Vérifie ta connexion puis réessaie.')); };
        document.body.appendChild(s);
    });
}

function devoirsOcrOptions() {
    return {
        workerPath: 'lib/ocr/worker.min.js',
        corePath: 'lib/ocr',
        langPath: 'lib/ocr/langs',
        workerBlobURL: false
    };
}

function devoirsEstPdf(fichier) {
    if (!fichier) return false;
    if (fichier.type === 'application/pdf') return true;
    return /\.pdf$/i.test(String(fichier.name || ''));
}

function devoirsChargerPdfJs() {
    if (window.pdfjsLib) return Promise.resolve();
    return new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = 'lib/pdf/pdf.min.js?v=' + (typeof version !== 'undefined' ? version : '1');
        s.onload = function () {
            try {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf/pdf.worker.min.js?v=' + (typeof version !== 'undefined' ? version : '1');
                res();
            } catch (e) { rej(e); }
        };
        s.onerror = function () { rej(new Error('Impossible de charger le lecteur de PDF. Vérifie ta connexion puis réessaie.')); };
        document.body.appendChild(s);
    });
}

/* Les pages d'un PDF : celles qui ont du texte le donnent directement,
   les autres (photos et scans) sont rendues en image puis lues. */
function devoirsPdfEnTexte(fichier, dire) {
    return devoirsChargerPdfJs().then(function () {
        return fichier.arrayBuffer();
    }).then(function (tampon) {
        return window.pdfjsLib.getDocument({ data: tampon }).promise;
    }).then(function (doc) {
        var pages = Math.min(doc.numPages, 8);
        var morceaux = [];
        function pageSuivante(n) {
            if (n > pages) return morceaux.join('\n');
            if (dire) dire('Lecture du document (page ' + n + ' sur ' + pages + ')…');
            return doc.getPage(n).then(function (page) {
                return page.getTextContent().then(function (tc) {
                    var extrait = (tc.items || []).map(function (it) { return (it.str || '') + (it.hasEOL ? '\n' : ' '); }).join('').trim();
                    if (extrait.length >= 40) {
                        morceaux.push(extrait);
                        return pageSuivante(n + 1);
                    }
                    /* page scannée : rendu en image puis lecture automatique */
                    var brut = page.getViewport({ scale: 1 });
                    var echelle = Math.min(2.5, 2200 / Math.max(1, brut.width));
                    var viewport = page.getViewport({ scale: echelle });
                    var canvas = document.createElement('canvas');
                    canvas.width = Math.floor(viewport.width);
                    canvas.height = Math.floor(viewport.height);
                    return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise.then(function () {
                        return window.Tesseract.recognize(canvas.toDataURL('image/png'), 'fra', devoirsOcrOptions());
                    }).then(function (res) {
                        morceaux.push((res && res.data && res.data.text) || '');
                        return pageSuivante(n + 1);
                    });
                });
            });
        }
        return pageSuivante(1);
    });
}

function devoirsOcrImage(fichier, dire) {
    return devoirsChargerTesseract().then(function () {
        /* les PDF téléchargés s'ouvrent aussi : chaque page est lue */
        if (devoirsEstPdf(fichier)) return devoirsPdfEnTexte(fichier, dire);
        return window.Tesseract.recognize(fichier, 'fra', devoirsOcrOptions()).then(function (res) {
            return (res && res.data && res.data.text) || '';
        });
    });
}

function devoirsDire(id, texte, erreur) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = texte;
    el.style.color = erreur ? '#b45309' : '#047857';
}

function devoirsLireDocument() {
    var genre = devoirsOngletActif;
    var suffixe = genre === 'devoirs' ? '' : 'Exam';
    var input = document.getElementById('devoirsFichier' + suffixe);
    var fichier = input && input.files && input.files[0];
    var zoneTexte = document.getElementById('devoirsTexteColle' + suffixe);
    var colle = zoneTexte ? zoneTexte.value.trim() : '';
    if (fichier) {
        if (devoirsOcrEnCours) return;
        devoirsOcrEnCours = true;
        var zoneStatut = devoirsOngletActif === 'devoirs' ? 'devoirsOcrStatut' : 'exaOcrStatut';
        devoirsDire(zoneStatut, 'Lecture du document… Premier usage : le lecteur se télécharge une fois, puis reste dans le navigateur.', false);
        devoirsOcrImage(fichier, function (message) { devoirsDire(zoneStatut, message, false); }).then(function (texte) {
            devoirsOcrEnCours = false;
            devoirsMontrerPropositions(texte, genre, true);
        }).catch(function (e) {
            devoirsOcrEnCours = false;
            devoirsDire(devoirsOngletActif === 'devoirs' ? 'devoirsOcrStatut' : 'exaOcrStatut', (e && e.message) || 'La lecture a échoué. Ajoute les créneaux à la main ci-dessous.', true);
        });
    } else if (colle) {
        devoirsMontrerPropositions(colle, genre, false);
    } else {
        devoirsDire(devoirsOngletActif === 'devoirs' ? 'devoirsOcrStatut' : 'exaOcrStatut', 'Choisis une photo du document, ou colle son texte dans la zone.', true);
    }
}

function devoirsMontrerPropositions(texte, genre, estOcr) {
    var propositions = devoirsParserTexte(texte);
    devoirsPropositions = propositions.map(function (p, i) {
        p.cle = 'prop' + i;
        return p;
    });
    var zone = document.getElementById('devoirsConfirmation');
    if (!zone) return;
    if (!devoirsPropositions.length) {
        zone.innerHTML = '<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:1rem;padding:0.9rem 1rem;font-size:0.85rem;color:#92400e;">' +
            (estOcr ? "La lecture n'a rien reconnu de sûr dans ce document." : "Aucun créneau décodé dans ce texte.") +
            ' Vérifie la photo (lumière, netteté) ou ajoute les créneaux à la main ci-dessous.</div>';
        return;
    }
    var connues = devoirsMatieresConnues();
    var lignes = devoirsPropositions.map(function (p) {
        var passe = devoirsEstPasse(p.date, p.fin);
        return '<div data-prop="' + p.cle + '" style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:0.8rem;padding:0.6rem;' + (passe ? 'opacity:0.55;' : '') + '">' +
            (passe ? '<span style="font-size:0.7rem;font-weight:800;color:#9ca3af;border:1px solid #e5e7eb;border-radius:0.5rem;padding:0.15rem 0.4rem;white-space:nowrap;">Passé</span>' : '') +
            '<input class="prop-matiere" list="devoirsMatiereListe" value="' + devoirsEchap(p.matiere) + '" placeholder="Matière" style="flex:2 1 9rem;border:1px solid #e5e7eb;border-radius:0.55rem;padding:0.45rem 0.55rem;font:inherit;font-size:0.85rem;">' +
            '<input class="prop-date" type="date" value="' + devoirsEchap(p.date) + '" style="flex:1 1 8rem;border:1px solid #e5e7eb;border-radius:0.55rem;padding:0.45rem 0.55rem;font:inherit;font-size:0.85rem;">' +
            '<input class="prop-debut" type="time" value="' + devoirsEchap(p.debut) + '" style="flex:1 1 6rem;border:1px solid #e5e7eb;border-radius:0.55rem;padding:0.45rem 0.55rem;font:inherit;font-size:0.85rem;">' +
            '<span style="color:#9ca3af;">→</span>' +
            '<input class="prop-fin" type="time" value="' + devoirsEchap(p.fin) + '" style="flex:1 1 6rem;border:1px solid #e5e7eb;border-radius:0.55rem;padding:0.45rem 0.55rem;font:inherit;font-size:0.85rem;">' +
            '<button type="button" onclick="devoirsRetirerProposition(\'' + p.cle + '\')" style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:1rem;">✕</button>' +
            '</div>';
    }).join('');
    zone.innerHTML =
        '<div style="background:#f0fdf4;border:1.5px solid #a7f3d0;border-radius:1rem;padding:0.9rem 1rem;">' +
        '<p style="margin:0 0 0.6rem;font-size:0.85rem;font-weight:700;color:#065f46;">' + devoirsPropositions.length + ' créneau' + (devoirsPropositions.length > 1 ? 'x' : '') + ' détecté' + (devoirsPropositions.length > 1 ? 's' : '') + ' — vérifie chaque ligne avant d\'ajouter. Les créneaux marqués « Passé » resteront hors du planning :</p>' +
        '<div style="display:flex;flex-direction:column;gap:0.5rem;">' + lignes + '</div>' +
        '<div style="display:flex;gap:0.6rem;margin-top:0.75rem;">' +
        '<button type="button" onclick="devoirsViderPropositions()" style="flex:1;padding:0.7rem;border:1.5px solid #e5e7eb;border-radius:0.75rem;background:white;color:#374151;font:inherit;font-weight:700;cursor:pointer;">Tout effacer</button>' +
        '<button type="button" onclick="devoirsConfirmerPropositions(\'' + genre + '\')" style="flex:2;padding:0.7rem;border:none;border-radius:0.75rem;background:linear-gradient(135deg,#059669,#10b981);color:white;font:inherit;font-weight:800;cursor:pointer;">Ajouter au planning</button>' +
        '</div></div>';
    devoirsDire('devoirsOcrStatut', '', false);
}

function devoirsRetirerProposition(cle) {
    devoirsPropositions = devoirsPropositions.filter(function (p) { return p.cle !== cle; });
    var el = document.querySelector('[data-prop="' + cle + '"]');
    if (el) el.remove();
    if (!devoirsPropositions.length) devoirsViderPropositions();
}

function devoirsViderPropositions() {
    devoirsPropositions = [];
    var zone = document.getElementById('devoirsConfirmation');
    if (zone) zone.innerHTML = '';
    ['devoirsFichier', 'devoirsFichierExam', 'devoirsTexteColle', 'devoirsTexteColleExam'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function devoirsConfirmerPropositions(genre) {
    var ajoutes = 0;
    var refuse = '';
    var passes = 0;
    var idsDevoirs = [];
    devoirsPropositions.forEach(function (p) {
        var el = document.querySelector('[data-prop="' + p.cle + '"]');
        var matiere = p.matiere, date = p.date, debut = p.debut, fin = p.fin;
        if (el) {
            matiere = (el.querySelector('.prop-matiere') || {}).value || matiere;
            date = (el.querySelector('.prop-date') || {}).value || date;
            debut = (el.querySelector('.prop-debut') || {}).value || debut;
            fin = (el.querySelector('.prop-fin') || {}).value || fin;
        }
        if (!matiere || !date || !debut || !fin) { refuse = 'Certaines lignes incomplètes n\'ont pas été ajoutées.'; return; }
        if (devoirsEstPasse(date, fin)) { passes++; return; }
        var idAjoute = devoirsAjouter(genre, { matiere: matiere, date: date, debut: debut, fin: fin });
        ajoutes++;
        if (genre === 'devoirs' && idAjoute) idsDevoirs.push(idAjoute);
    });
    devoirsViderPropositions();
    devoirsRendre();
    if (idsDevoirs.length) devoirsDemanderSeances(idsDevoirs);
    devoirsDire(devoirsOngletActif === 'devoirs' ? 'devoirsOcrStatut' : 'exaOcrStatut',
        ajoutes + ' créneau' + (ajoutes > 1 ? 'x' : '') + ' ajouté' + (ajoutes > 1 ? 's' : '') + ' au planning.' +
        (passes ? ' ' + passes + ' créneau' + (passes > 1 ? 'x' : '') + ' déjà passé' + (passes > 1 ? 's' : '') + ' ignoré' + (passes > 1 ? 's' : '') + '.' : '') +
        (refuse ? ' ' + refuse : ''), false);
}

function devoirsEchap(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Ajout, suppression, rendu ─────────────────────────────────────── */

/* Un créneau déjà passé n'entre jamais dans le planning : la date (et
   l'heure de fin, quand on la connaît) est comparée à maintenant. */
function devoirsEstPasse(date, fin) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return false;
    var n = new Date();
    var cle = n.getFullYear() + '-' + ('0' + (n.getMonth() + 1)).slice(-2) + '-' + ('0' + n.getDate()).slice(-2);
    if (String(date) < cle) return true;
    if (String(date) > cle) return false;
    if (!/^\d{2}:\d{2}$/.test(String(fin || ''))) return false;
    return devoirsInstant(date, fin).getTime() <= n.getTime();
}

function devoirsAjouter(genre, champs) {
    var store = devoirsLireStore();
    var entree = {
        id: devoirsId(genre === 'devoirs' ? 'd' : 'x'),
        matiere: String(champs.matiere || '').slice(0, 60),
        date: String(champs.date || '').slice(0, 10),
        debut: String(champs.debut || '').slice(0, 5),
        fin: String(champs.fin || '').slice(0, 5),
        seances: (Number(champs.seances) >= 1 && Number(champs.seances) <= 10) ? Math.round(Number(champs.seances)) : undefined,
        ajouteAt: new Date().toISOString()
    };
    if (!entree.matiere || !/^\d{4}-\d{2}-\d{2}$/.test(entree.date) || !/^\d{2}:\d{2}$/.test(entree.debut) || !/^\d{2}:\d{2}$/.test(entree.fin)) return false;
    if (devoirsH2M(entree.fin) <= devoirsH2M(entree.debut)) return false;
    if (devoirsEstPasse(entree.date, entree.fin)) return false;
    if (entree.seances == null) delete entree.seances;
    store[genre === 'devoirs' ? 'devoirs' : 'examens'].push(entree);
    devoirsEcrireStore(store);
    return entree.id;
}

/* ── Combien de séances avant de composer ? ────────────────────────── */
/* Après l'analyse du document, pour chaque devoir ajouté, l'élève
   choisit son nombre de séances de révision — ou laisse le site
   proposer le planning (la rampe automatique par deadline). */
function devoirsDemanderSeances(ids) {
    if (!Array.isArray(ids) || !ids.length) return;
    var store = devoirsLireStore();
    var restants = ids.map(function (id) {
        return (store.devoirs || []).filter(function (d) { return d.id === id; })[0];
    }).filter(Boolean).filter(function (d) { return !(Number(d.seances) >= 1) && d.seances !== 'auto'; });
    if (!restants.length) {
        if (typeof generatePlanning === 'function') { try { generatePlanning(); } catch (e) {} }
        return;
    }
    var d = restants[0];
    var ancien = document.getElementById('seancesQuestionModal');
    if (ancien) ancien.remove();
    var voile = document.createElement('div');
    voile.id = 'seancesQuestionModal';
    voile.style.cssText = 'position:fixed;inset:0;background:rgba(17,24,39,0.55);z-index:320;display:flex;align-items:center;justify-content:center;padding:1rem;';
    var boutons = '';
    for (var n = 1; n <= 6; n++) {
        boutons += '<button data-n="' + n + '" style="flex:1;padding:0.8rem 0;border:1.5px solid #e5e7eb;border-radius:0.8rem;background:#f9fafb;color:#374151;font:inherit;font-weight:800;cursor:pointer;font-size:1.05rem;">' + n + '</button>';
    }
    voile.innerHTML =
        '<div style="background:white;border-radius:1.25rem;max-width:28rem;width:100%;padding:1.5rem;box-shadow:0 20px 50px rgba(0,0,0,0.25);text-align:center;">' +
        '<div style="font-size:2.2rem;line-height:1;">📚</div>' +
        '<h3 style="margin:0.6rem 0 0.35rem;font-size:1.1rem;font-weight:800;color:#111827;">' + devoirsEchap(d.matiere) + ' — ' + devoirsDateCourte(d.date) + '</h3>' +
        '<p style="margin:0 0 1.1rem;font-size:0.88rem;color:#6b7280;line-height:1.5;">Combien de séances de révision veux-tu avant de composer ce devoir ?</p>' +
        '<div style="display:flex;gap:0.5rem;margin-bottom:0.7rem;">' + boutons + '</div>' +
        '<button id="seancesQuestionAuto" style="width:100%;padding:0.8rem;border:none;border-radius:0.8rem;background:linear-gradient(135deg,#059669,#10b981);color:white;font:inherit;font-weight:800;cursor:pointer;">✨ Propose-moi un planning pour les devoirs et examens</button></div>';
    document.body.appendChild(voile);
    function choisir(valeur) {
        var st = devoirsLireStore();
        st.devoirs.forEach(function (x) {
            if (x.id === d.id) {
                if (valeur === 'auto') x.seances = 'auto';
                else x.seances = valeur;
            }
        });
        devoirsEcrireStore(st);
        voile.remove();
        devoirsDemanderSeances(ids);
        devoirsRendre();
    }
    voile.querySelectorAll('[data-n]').forEach(function (b) {
        b.onclick = function () { choisir(Number(b.getAttribute('data-n'))); };
    });
    voile.querySelector('#seancesQuestionAuto').onclick = function () { choisir('auto'); };
}

function devoirsAjouterManuel() {
    var genre = devoirsOngletActif;
    var prefixe = genre === 'devoirs' ? 'devManuel' : 'exaManuel';
    var matiere = (document.getElementById(prefixe + 'Matiere') || {}).value || '';
    var autre = (document.getElementById(prefixe + 'Autre') || {}).value || '';
    var date = (document.getElementById(prefixe + 'Date') || {}).value || '';
    var debut = (document.getElementById(prefixe + 'Debut') || {}).value || '';
    var fin = (document.getElementById(prefixe + 'Fin') || {}).value || '';
    if (!matiere && autre) matiere = autre;
    var zone = genre === 'devoirs' ? 'devoirsAjoutStatut' : 'exaAjoutStatut';
    if (!matiere || !date || !debut || !fin) {
        devoirsDire(zone, 'Matière, date et heures sont nécessaires.', true);
        return;
    }
    if (devoirsEstPasse(date, fin)) {
        devoirsDire(zone, 'Ce créneau est déjà passé : il n\'entre pas dans le planning.', true);
        return;
    }
    var nouvelId = devoirsAjouter(genre, { matiere: matiere, date: date, debut: debut, fin: fin });
    if (nouvelId) {
        ['Matiere', 'Autre', 'Date', 'Debut', 'Fin'].forEach(function (suf) {
            var el = document.getElementById(prefixe + suf);
            if (el) el.value = '';
        });
        devoirsDire(zone, 'Ajouté au planning ✓', false);
        devoirsRendre();
        if (genre === 'devoirs') devoirsDemanderSeances([nouvelId]);
    } else {
        devoirsDire(zone, 'Ces informations sont incomplètes (la fin doit suivre le début).', true);
    }
}

function devoirsSupprimer(genre, id) {
    var store = devoirsLireStore();
    var cle = genre === 'devoirs' ? 'devoirs' : 'examens';
    store[cle] = store[cle].filter(function (x) { return x.id !== id; });
    devoirsEcrireStore(store);
    devoirsRendre();
}

function devoirsDateCourte(cle) {
    try {
        var d = new Date(cle + 'T12:00:00');
        return ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][d.getDay()] + ' ' + d.getDate() + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
    } catch (e) { return cle; }
}

function devoirsRendre() {
    var store = devoirsLireStore();
    var listeM = document.getElementById('devoirsMatiereListe');
    if (listeM) {
        /* la saisie ne propose que les matières de l'élève (toutes
           seulement s'il n'a pas encore de profil) */
        var matieresProposees = devoirsMatieresEleve();
        if (!matieresProposees.length) matieresProposees = devoirsMatieresConnues();
        listeM.innerHTML = matieresProposees.map(function (m) {
            return '<option value="' + devoirsEchap(m) + '"></option>';
        }).join('');
    }
    ['devoirs', 'examens'].forEach(function (genre) {
        var zone = document.getElementById(genre === 'devoirs' ? 'devoirsListe' : 'examensListe');
        if (!zone) return;
        var liste = store[genre].slice().sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; });
        if (!liste.length) {
            zone.innerHTML = '<p style="margin:0;font-size:0.85rem;color:#9ca3af;">Aucun créneau pour l\'instant.</p>';
        } else {
            zone.innerHTML = liste.map(function (x) {
                return '<div style="display:flex;align-items:center;gap:0.6rem;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:0.8rem;padding:0.55rem 0.75rem;">' +
                    '<span style="font-size:1.1rem;">' + (genre === 'devoirs' ? '📝' : '🎓') + '</span>' +
                    '<div style="flex:1;min-width:0;"><p style="margin:0;font-weight:700;color:#111827;font-size:0.88rem;">' + devoirsEchap(x.matiere) + '</p>' +
                    '<p style="margin:0;font-size:0.75rem;color:#6b7280;">' + devoirsDateCourte(x.date) + ' · ' + devoirsEchap(x.debut) + ' → ' + devoirsEchap(x.fin) + '</p></div>' +
                    '<button type="button" onclick="devoirsSupprimer(\'' + genre + '\',\'' + x.id + '\')" style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:0.95rem;">🗑️</button></div>';
            }).join('');
        }
    });
    /* Le réglage du bac n'est plus sur cette page : la question est
       posée par le popup, une seule fois, à tous les DP2. */
}

function devoirsRendreSiVisible() {
    var panel = document.getElementById('panelDevoirs');
    if (panel && panel.classList.contains('active')) devoirsRendre();
}

function devoirsBasculerOnglet(genre) {
    devoirsOngletActif = genre;
    ['devoirs', 'examens'].forEach(function (g) {
        var zone = document.getElementById('onglet-' + g);
        if (zone) zone.style.display = g === genre ? 'block' : 'none';
        var bouton = document.getElementById('ongletBtn-' + g);
        if (bouton) {
            bouton.style.background = g === genre ? 'linear-gradient(135deg,#059669,#10b981)' : '#f3f4f6';
            bouton.style.color = g === genre ? 'white' : '#374151';
        }
    });
    devoirsDire('devoirsOcrStatut', '', false);
    devoirsDire('exaOcrStatut', '', false);
}

function initDevoirs() {
    devoirsRendre();
    devoirsBasculerOnglet(devoirsOngletActif);
}
