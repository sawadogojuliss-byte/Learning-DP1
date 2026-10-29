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
var DEVOIRS_MAX_SEANCES = 6;
var devoirsOngletActif = 'devoirs';
var devoirsOcrEnCours = false;
var devoirsFileCourant = null;
var devoirsPropositions = [];
var devoirsPropositionsGenre = 'devoirs';

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

/* Toutes les matières de l'élève présentes dans une ligne : un
   programme peut annoncer plusieurs compositions le même jour
   (« Maths AA, Physique »). Chaque matière suivie compte, dans son
   ordre d'apparition dans la ligne. */
function devoirsMatieresLigneToutes(norm, familles) {
    var mots = devoirsMots(norm);
    var prises = {};
    var trouvees = [];
    familles.forEach(function (e) {
        if (prises[e.famille.canon]) return;
        var nomTrouve = null;
        for (var i = 0; i < e.noms.length && !nomTrouve; i++) {
            if (norm.indexOf(devoirsNormaliser(e.noms[i])) !== -1) nomTrouve = e.noms[i];
        }
        if (!nomTrouve) {
            e.famille.cles.forEach(function (c) {
                for (var j = 0; j < mots.length && !nomTrouve; j++) {
                    if (mots[j].indexOf(c) === 0) nomTrouve = e.noms[0];
                }
            });
        }
        if (nomTrouve) { prises[e.famille.canon] = 1; trouvees.push(nomTrouve); }
    });
    return trouvees.sort(function (a, b) {
        return norm.indexOf(devoirsNormaliser(a)) - norm.indexOf(devoirsNormaliser(b));
    });
}

/* Sans profil connu (élève pas encore inscrit), toutes les matières
   reconnues dans la ligne restent proposables. */
function devoirsMatieresDicoToutes(norm, connues) {
    var prises = {};
    var trouvees = [];
    (connues || devoirsMatieresConnues()).forEach(function (nom) {
        var n = devoirsNormaliser(nom);
        if (n && norm.indexOf(n) !== -1 && !prises[n]) { prises[n] = 1; trouvees.push(nom); }
    });
    return trouvees;
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

/* l'après-midi à l'anglaise : « 1:25 pm » devient « 13:25 » */
function devoirsNormaliserApresMidi(norm) {
    norm = norm.replace(/(\d{1,2})(:\d{2})\s*pm\b/g, function (x, h, mn) { return ((Number(h) % 12) + 12) + mn; });
    norm = norm.replace(/(\d{1,2})\s*pm\b/g, function (x, h) { return ((Number(h) % 12) + 12) + ':00'; });
    norm = norm.replace(/(\d{1,2})(:\d{2})?\s*am\b/g, function (x, h, mn) { return ('0' + (Number(h) % 12)).slice(-2) + (mn || ':00'); });
    return norm;
}

/* une durée (« 01h 30 min ») n'est pas une heure de composition */
function devoirsEstDuree(norm) {
    return /(^|\s)\d{1,2}\s*(h|:)\s*\d{0,2}\s*(min|mn)/.test(norm) && norm.indexOf('paper') === -1;
}

/* Les heures d'un texte : 8h-13h, 8h00 - 13h00, de 8h à 13h,
   8:30/13:45, 14h55 a 16h25 — puis deux heures isolées. */
function devoirsHeuresDansTexte(norm) {
    var m = norm.match(/(\d{1,2})\s*(?:h|:|\.)\s*(\d{2})?\s*(?:-|–|—|a|jusqu a|\/)\s*(\d{1,2})\s*(?:h|:|\.)\s*(\d{2})?/);
    if (m) {
        return {
            debut: ('0' + m[1]).slice(-2) + ':' + (m[2] || '00'),
            fin: ('0' + m[3]).slice(-2) + ':' + (m[4] || '00')
        };
    }
    var isoles = norm.match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/g);
    if (isoles && isoles.length >= 2) {
        var h1 = isoles[0].match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/);
        var h2 = isoles[isoles.length - 1].match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/);
        return { debut: ('0' + h1[1]).slice(-2) + ':' + (h1[2] || '00'), fin: ('0' + h2[1]).slice(-2) + ':' + (h2[2] || '00') };
    }
    return null;
}

function devoirsParserTexte(texte, connues) {
    var lignes = String(texte || '').split(/[\n\r]+/);
    var propositions = [];
    var dateCourante = ''; /* dernière date rencontrée : elle vaut pour les lignes suivantes */
    var dateCouranteIncertaine = false; /* le document mentionne une date, mais elle est illisible */
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
    function viderBloc(dernier) {
        var n = Math.min(blocHeures.length, blocMatieres.length);
        var k;
        for (k = 0; k < n; k++) {
            if (devoirsH2Mvalide(blocHeures[k])) {
                propositions.push({ matiere: blocMatieres[k], date: dateCourante, debut: blocHeures[k].debut, fin: blocHeures[k].fin, ligne: '' });
            }
        }
        /* des matières sans heures pour ce jour-là : le créneau du jour
           les recevra — les heures se complètent à la confirmation */
        if (!blocHeures.length && blocMatieres.length && (dateCourante || dateCouranteIncertaine || (dernier && !propositions.length))) {
            blocMatieres.forEach(function (mm) {
                propositions.push({ matiere: mm, date: dateCourante, debut: '', fin: '', ligne: '' });
            });
        }
        /* des heures sans matière ne sont proposées à compléter que si
           le bloc ne parle pas d'une matière que l'élève ne suit pas */
        if (blocHeures.length && !blocMatieres.length && (dateCourante || dateCouranteIncertaine || (dernier && !propositions.length)) && !blocRefuse) {
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

        norm = devoirsNormaliserApresMidi(norm);

        var estDuree = devoirsEstDuree(norm);
        var heures = devoirsHeuresDansTexte(norm);

        /* date : 23/10, 23-10-2026, lundi 23, 23 octobre */
        var dateTrouvee = '';
        var dateIllisible = false;
        var dm = norm.match(/\b(\d{1,2})\s*[\/\-.]\s*(\d{1,2})(?:\s*[\/\-.]\s*(\d{2,4}))?\b/);
        /* « 13:00 - 15:00 » contient « 00 - 15 » : ce n'est pas
           une date erronée, mais une plage d'heures à conserver. */
        if (dm && /\d[:h.]$/.test(norm.slice(0, dm.index).trim())) dm = null;
        if (dm) {
            var an = dm[3] ? (dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3])) : devoirsAnneePour(Number(dm[2]) - 1);
            var dObj = new Date(an, Number(dm[2]) - 1, Number(dm[1]));
            /* Date() corrige silencieusement « 31/02 » en mars :
               ne jamais inventer un autre jour pour une date illisible. */
            if (Number(dm[1]) >= 1 && Number(dm[2]) >= 1 && Number(dm[2]) <= 12 &&
                dObj.getFullYear() === an && dObj.getMonth() === Number(dm[2]) - 1 &&
                dObj.getDate() === Number(dm[1])) dateTrouvee = devoirsCle(dObj);
            else dateIllisible = true;
        }
        if (!dateTrouvee) {
            var jm = norm.match(/\b(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/);
            if (jm) {
                var moisLu = DEVOIRS_MOIS[jm[2]];
                var anneeLue = devoirsAnneePour(moisLu);
                var dateNomme = new Date(anneeLue, moisLu, Number(jm[1]));
                if (dateNomme.getMonth() === moisLu && dateNomme.getDate() === Number(jm[1]))
                    dateTrouvee = devoirsCle(dateNomme);
                else dateIllisible = true;
            }
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
                            if (essai.getDate() === Number(avecJour[1]) && essai.getDay() === DEVOIRS_JOURS[clesJours[j]]) {
                                dateTrouvee = devoirsCle(essai);
                                break;
                            }
                            essai.setDate(essai.getDate() + 1);
                        }
                        if (!dateTrouvee) dateIllisible = true;
                    }
                    break;
                }
            }
        }

        if (dateTrouvee) dateIllisible = false;
        if (dateIllisible) {
            /* Une date fausse ne doit pas hériter de la date du bloc
               précédent. Conserver les matières et heures à corriger. */
            viderBloc();
            dateCourante = '';
            dateCouranteIncertaine = true;
        }

        var matieres = profilConnu ? devoirsMatieresLigneToutes(norm, famillesEleve) : devoirsMatieresDicoToutes(norm, connuesListe);
        var matiere = matieres.length ? matieres[0] : '';

        /* une matière d'école que l'élève ne suit pas : la ligne ne lui
           est pas proposée — ni ses heures dans un bloc */
        if (profilConnu && !matieres.length && devoirsSujetNonSuivi(norm)) {
            if (!heures && !dateTrouvee) blocRefuse = true;
            continue;
        }

        /* « Paper 1 - SL » : la colonne des papiers commence, les
           matières du bloc sont déjà toutes lues. */
        if (/paper|papier/.test(norm) && !heures && !dateTrouvee && !matieres.length) { enPapiers = true; continue; }
        if (estDuree && !matieres.length && !dateTrouvee) continue;
        if (enPapiers && !heures && !dateTrouvee) continue;
        if (heures && !devoirsH2Mvalide(heures)) heures = null;

        /* 1) une ligne complète : matière(s), date et heures ensemble.
           Plusieurs matières avec chacune ses heures : chaque morceau de
           la ligne (séparé par une virgule) donne sa proposition. Une
           seule plage d'heures pour toutes : les heures restent à
           remplir — le créneau du jour les donnera. */
        if (heures && matieres.length) {
            viderBloc();
            if (matieres.length === 1) {
                propositions.push({
                    matiere: matieres[0],
                    date: dateTrouvee || dateCourante,
                    debut: heures.debut,
                    fin: heures.fin,
                    ligne: String(ligne).trim().slice(0, 90)
                });
            } else {
                var poseesSeg = 0;
                String(ligne).split(/[,;]/).forEach(function (seg) {
                    var segNorm = devoirsNormaliserApresMidi(devoirsNormaliserGarde(seg));
                    if (!segNorm) return;
                    var segMat = profilConnu ? devoirsMatieresLigneToutes(segNorm, famillesEleve) : devoirsMatieresDicoToutes(segNorm, connuesListe);
                    if (segMat.length !== 1) return;
                    var segHeures = devoirsEstDuree(segNorm) ? null : devoirsHeuresDansTexte(segNorm);
                    if (segHeures && !devoirsH2Mvalide(segHeures)) segHeures = null;
                    propositions.push({
                        matiere: segMat[0],
                        date: dateTrouvee || dateCourante,
                        debut: segHeures ? segHeures.debut : '',
                        fin: segHeures ? segHeures.fin : '',
                        ligne: String(seg).trim().slice(0, 90)
                    });
                    poseesSeg++;
                });
                if (!poseesSeg) {
                    matieres.forEach(function (mm) {
                        propositions.push({ matiere: mm, date: dateTrouvee || dateCourante, debut: '', fin: '', ligne: String(ligne).trim().slice(0, 90) });
                    });
                }
            }
            if (dateTrouvee) { dateCourante = dateTrouvee; dateCouranteIncertaine = false; }
            continue;
        }
        /* 1bis) un jour et ses matières, sans heures : chaque matière
           de l'élève est proposée pour ce jour-là */
        if (dateTrouvee && !heures && matieres.length) {
            viderBloc();
            matieres.forEach(function (mm) {
                propositions.push({ matiere: mm, date: dateTrouvee, debut: '', fin: '', ligne: String(ligne).trim().slice(0, 90) });
            });
            dateCourante = dateTrouvee;
            dateCouranteIncertaine = false;
            continue;
        }
        /* 2) une date seule : un nouveau bloc commence */
        if (dateTrouvee && !heures && !matieres.length) {
            viderBloc();
            dateCourante = dateTrouvee;
            dateCouranteIncertaine = false;
            continue;
        }
        /* 3) des heures seules : elles s'empilent pour le bloc */
        if (heures && !matieres.length && !dateTrouvee) {
            blocHeures.push(heures);
            continue;
        }
        /* 4) des matières seules : elles rejoignent le bloc en cours */
        if (matieres.length && !heures && !dateTrouvee) {
            if (!enPapiers) matieres.forEach(function (mm) { blocMatieres.push(mm); });
            continue;
        }
        /* 5) des heures et une date sans matière */
        if (heures && dateTrouvee && !matieres.length) {
            viderBloc();
            propositions.push({ matiere: '', date: dateTrouvee, debut: heures.debut, fin: heures.fin, ligne: String(ligne).trim().slice(0, 90) });
            dateCourante = dateTrouvee;
            dateCouranteIncertaine = false;
            continue;
        }
    }
    viderBloc(true);
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

/* Toutes les annonces OCR suivent le genre du document, même si
   l'utilisateur change d'onglet pendant la lecture. */
function devoirsDireOcr(genre, texte, erreur) {
    devoirsDire(genre === 'examens' ? 'exaOcrStatut' : 'devoirsOcrStatut', texte, erreur);
}

function devoirsLireDocument(genreChoisi) {
    var genre = genreChoisi === 'examens' || genreChoisi === 'devoirs' ? genreChoisi : devoirsOngletActif;
    var suffixe = genre === 'devoirs' ? '' : 'Exam';
    var input = document.getElementById('devoirsFichier' + suffixe);
    var fichier = input && input.files && input.files[0];
    var zoneTexte = document.getElementById('devoirsTexteColle' + suffixe);
    var colle = zoneTexte ? zoneTexte.value.trim() : '';
    if (fichier) {
        if (devoirsOcrEnCours) return;
        devoirsOcrEnCours = true;
        devoirsDireOcr(genre, 'Lecture du document… Premier usage : le lecteur se télécharge une fois, puis reste dans le navigateur.', false);
        devoirsOcrImage(fichier, function (message) { devoirsDireOcr(genre, message, false); }).then(function (texte) {
            devoirsOcrEnCours = false;
            devoirsMontrerPropositions(texte, genre, true);
        }).catch(function (e) {
            devoirsOcrEnCours = false;
            devoirsDireOcr(genre, (e && e.message) || 'La lecture a échoué. Ajoute les créneaux à la main ci-dessous.', true);
        });
    } else if (colle) {
        devoirsMontrerPropositions(colle, genre, false);
    } else {
        devoirsDireOcr(genre, 'Choisis une photo du document, ou colle son texte dans la zone.', true);
    }
}

/* Le créneau des devoirs d'un jour dans l'emploi du temps scolaire de
   l'élève (l'entrée « DEVOIR DE NIVEAU »), s'il est chargé. */
function devoirsCreneauDunJour(dateCle) {
    if (typeof emploiScolaireLire !== 'function') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateCle || ''))) return null;
    var d = new Date(dateCle + 'T12:00:00');
    var jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    var idx = (d.getDay() + 6) % 7;
    var entrees;
    try { entrees = emploiScolaireLire().jours[idx] || []; } catch (e) { return null; }
    var creneau = null;
    entrees.forEach(function (c) {
        if (!c || !c.debut || !c.fin) return;
        var t = String(c.nom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!creneau && t.indexOf('devoir') !== -1) creneau = c;
    });
    return creneau;
}

function devoirsMH(m) {
    m = ((Math.round(Number(m) || 0) % 1440) + 1440) % 1440;
    return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
}

/* Les propositions sans heures reçoivent celles du créneau du jour :
   une matière prend le créneau entier, plusieurs se le partagent avec
   une pause entre deux. L'élève peut tout corriger avant de confirmer. */
function devoirsRemplirCreneaux(propositions) {
    var parDate = {};
    (propositions || []).forEach(function (p) {
        if (p && !p.debut && !p.fin && p.date) (parDate[p.date] = parDate[p.date] || []).push(p);
    });
    Object.keys(parDate).forEach(function (dateCle) {
        var creneau = devoirsCreneauDunJour(dateCle);
        if (!creneau) return;
        var s = devoirsH2M(creneau.debut), e = devoirsH2M(creneau.fin);
        if (!(e > s)) return;
        var liste = parDate[dateCle];
        var part = Math.max(40, Math.floor((e - s - 15 * (liste.length - 1)) / liste.length));
        var cur = s;
        liste.forEach(function (p) {
            p.debut = devoirsMH(cur);
            p.fin = devoirsMH(Math.min(e, cur + part));
            cur = Math.min(e, cur + part) + 15;
        });
    });
    return propositions;
}

function devoirsMontrerPropositions(texte, genre, estOcr) {
    genre = genre === 'examens' ? 'examens' : 'devoirs';
    devoirsPropositionsGenre = genre;
    var propositions = devoirsParserTexte(texte);
    var rienReconnu = estOcr && !propositions.length;
    /* Même si la photo n'a rien donné, l'élève peut remplir la ligne
       sous le document : l'OCR ne crée jamais une date ou un cours. */
    if (rienReconnu) propositions = [{ matiere: '', date: '', debut: '', fin: '', ligne: '' }];
    if (genre === 'devoirs') devoirsRemplirCreneaux(propositions);
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
        devoirsDireOcr(genre, 'Aucun créneau détecté. Vérifie le document ou ajoute-le à la main.', true);
        return;
    }
    var sansDate = devoirsPropositions.filter(function (p) { return !p.date; }).length;
    var sansMatiere = devoirsPropositions.filter(function (p) { return !p.matiere; }).length;
    var sansHeures = genre === 'examens' ? devoirsPropositions.filter(function (p) { return !p.debut || !p.fin; }).length : 0;
    var lignes = devoirsPropositions.map(function (p) {
        var passe = p.date && devoirsEstPasse(p.date, p.fin);
        var doublon = p.matiere && p.date && devoirsChercherDoublon(devoirsLireStore(), genre, p);
        return '<div data-prop="' + p.cle + '" style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:0.8rem;padding:0.6rem;' + (passe ? 'opacity:0.55;' : '') + '">' +
            (passe ? '<span style="font-size:0.7rem;font-weight:800;color:#56665e;border:1px solid #e5e7eb;border-radius:0.5rem;padding:0.15rem 0.4rem;white-space:nowrap;">Passé</span>' : '') +
            (doublon ? '<span style="font-size:0.72rem;font-weight:800;color:#065f46;">Mettre à jour le créneau existant</span>' : '') +
            (!p.date ? '<span style="font-size:0.72rem;font-weight:800;color:#92400e;">Date à préciser</span>' : '') +
            (!p.matiere ? '<span style="font-size:0.72rem;font-weight:800;color:#92400e;">Matière à préciser</span>' : '') +
            (genre === 'examens' && (!p.debut || !p.fin) ? '<span style="font-size:0.72rem;font-weight:800;color:#92400e;">Heures à préciser</span>' : '') +
            '<input class="prop-matiere" aria-label="Matière du créneau" list="devoirsMatiereListe" value="' + devoirsEchap(p.matiere) + '" placeholder="Matière" style="flex:2 1 9rem;border:1px solid #e5e7eb;border-radius:0.55rem;padding:0.45rem 0.55rem;font:inherit;font-size:0.85rem;">' +
            '<input class="prop-date" type="date" aria-label="Date à préciser ou à vérifier" value="' + devoirsEchap(p.date) + '" style="flex:1 1 8rem;border:1px solid #e5e7eb;border-radius:0.55rem;padding:0.45rem 0.55rem;font:inherit;font-size:0.85rem;">' +
            '<input class="prop-debut" aria-label="Heure de début" type="time" value="' + devoirsEchap(p.debut) + '" style="flex:1 1 6rem;border:1px solid #e5e7eb;border-radius:0.55rem;padding:0.45rem 0.55rem;font:inherit;font-size:0.85rem;">' +
            '<span style="color:#56665e;">→</span>' +
            '<input class="prop-fin" aria-label="Heure de fin" type="time" value="' + devoirsEchap(p.fin) + '" style="flex:1 1 6rem;border:1px solid #e5e7eb;border-radius:0.55rem;padding:0.45rem 0.55rem;font:inherit;font-size:0.85rem;">' +
            '<button type="button" onclick="devoirsRetirerProposition(\'' + p.cle + '\')" style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:1rem;">✕</button>' +
            '</div>';
    }).join('');
    zone.innerHTML =
        '<div style="background:#f0fdf4;border:1.5px solid #a7f3d0;border-radius:1rem;padding:0.9rem 1rem;">' +
        '<p style="margin:0 0 0.6rem;font-size:0.85rem;font-weight:700;color:#065f46;">' +
        (genre === 'examens' ? 'Examens à vérifier : ' : 'Devoirs à vérifier : ') + devoirsPropositions.length + ' créneau' + (devoirsPropositions.length > 1 ? 'x' : '') + ' détecté' + (devoirsPropositions.length > 1 ? 's' : '') + ' — vérifie chaque ligne avant d\'ajouter. Les créneaux marqués « Passé » resteront hors du planning :</p>' +
        '<div style="display:flex;flex-direction:column;gap:0.5rem;">' + lignes + '</div>' +
        '<div style="display:flex;gap:0.6rem;margin-top:0.75rem;">' +
        '<button type="button" onclick="devoirsViderPropositions()" style="flex:1;padding:0.7rem;border:1.5px solid #e5e7eb;border-radius:0.75rem;background:white;color:#374151;font:inherit;font-weight:700;cursor:pointer;">Tout effacer</button>' +
        '<button type="button" onclick="devoirsConfirmerPropositions(\'' + genre + '\')" style="flex:2;padding:0.7rem;border:none;border-radius:0.75rem;background:linear-gradient(135deg,#059669,#10b981);color:white;font:inherit;font-weight:800;cursor:pointer;">Ajouter au planning</button>' +
        '</div></div>';
    devoirsDireOcr(genre,
        (rienReconnu ? 'Aucun créneau reconnu avec certitude. Complète la ligne ci-dessous : matière, date' +
            (genre === 'examens' ? ' et heures.' : ', et heures si tu ne connais pas de créneau scolaire.') :
            devoirsPropositions.length + ' créneau' + (devoirsPropositions.length > 1 ? 'x' : '') +
            ' détecté' + (devoirsPropositions.length > 1 ? 's' : '') + '.' +
            (sansDate ? ' Date à préciser pour ' + sansDate + ' ligne' + (sansDate > 1 ? 's' : '') + '.' : '') +
            (sansMatiere ? ' Matière à préciser.' : '') +
            (sansHeures ? ' Heures à préciser.' : '')),
        !!(rienReconnu || sansDate || sansMatiere || sansHeures));
    /* L'aperçu commun se trouve après les onglets : l'afficher vraiment
       sous les yeux de l'élève, puis l'amener au premier champ manquant. */
    if (typeof zone.scrollIntoView === 'function') zone.scrollIntoView({ block: 'start', behavior: 'auto' });
    var selecteurManquant = sansMatiere ? '.prop-matiere' : sansDate ? '.prop-date' : sansHeures ? '.prop-debut' : '';
    var premierChamp = selecteurManquant && zone.querySelector ? zone.querySelector(selecteurManquant) : null;
    if (premierChamp && typeof premierChamp.focus === 'function') premierChamp.focus();
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
    /* La confirmation est commune, mais n'efface pas un brouillon
       encore saisi dans l'autre onglet. */
    var suffixe = devoirsPropositionsGenre === 'examens' ? 'Exam' : '';
    ['devoirsFichier' + suffixe, 'devoirsTexteColle' + suffixe].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function devoirsConfirmerPropositions(genre) {
    genre = devoirsPropositionsGenre || genre;
    /* On vérifie toutes les informations indispensables avant la moindre
       écriture : une erreur OCR reste corrigible dans l'aperçu commun. */
    var manque = null;
    devoirsPropositions.some(function (p) {
        var el = document.querySelector('[data-prop="' + p.cle + '"]');
        function champ(classe, repli) {
            var input = el && el.querySelector(classe);
            return { input: input, valeur: input ? String(input.value || '').trim() : String(repli || '').trim() };
        }
        var matiere = champ('.prop-matiere', p.matiere);
        var date = champ('.prop-date', p.date);
        var debut = champ('.prop-debut', p.debut);
        var fin = champ('.prop-fin', p.fin);
        if (!matiere.valeur) manque = { texte: 'Matière à préciser avant l’ajout.', champ: matiere.input };
        else if (!date.valeur) manque = { texte: 'Date à préciser avant l’ajout au planning.', champ: date.input };
        else if (!!debut.valeur !== !!fin.valeur || (genre === 'examens' && !debut.valeur && !fin.valeur)) {
            manque = { texte: 'Heures de début et de fin à préciser pour planifier ce créneau.', champ: debut.input };
        }
        if (!manque) {
            var valide = devoirsValider({ matiere: matiere.valeur, date: date.valeur, debut: debut.valeur, fin: fin.valeur }, genre);
            if (valide.erreur) manque = { texte: valide.erreur, champ: fin.input || date.input };
        }
        return !!manque;
    });
    if (manque) {
        devoirsDireOcr(genre, manque.texte + ' Complète la ligne ci-dessous.', true);
        if (manque.champ && typeof manque.champ.focus === 'function') manque.champ.focus();
        return;
    }
    var ajoutes = 0;
    var misAJour = 0;
    var refuse = '';
    var passes = 0;
    var idsDevoirs = [];
    var propositions = devoirsPropositions.slice();
    function traiter(index) {
        if (index >= propositions.length) { finir(); return; }
        var p = propositions[index];
        var el = document.querySelector('[data-prop="' + p.cle + '"]');
        var matiere = p.matiere, date = p.date, debut = p.debut, fin = p.fin;
        if (el) {
            matiere = (el.querySelector('.prop-matiere') || {}).value || matiere;
            date = (el.querySelector('.prop-date') || {}).value || date;
            debut = (el.querySelector('.prop-debut') || {}).value || debut;
            fin = (el.querySelector('.prop-fin') || {}).value || fin;
        }
        var champs = devoirsValider({ matiere: matiere, date: date, debut: debut, fin: fin }, genre);
        if (champs.erreur) { refuse = champs.erreur; traiter(index + 1); return; }
        if (devoirsEstPasse(champs.date, champs.fin)) { passes++; traiter(index + 1); return; }
        var existant = devoirsChercherDoublon(devoirsLireStore(), genre, champs);
        devoirsProposerConflit(champs, existant && existant.id, function () {
        if (existant) {
            var erreur = devoirsModifier(genre, existant.id, champs);
            if (erreur) { refuse = erreur; traiter(index + 1); return; }
            misAJour++;
            traiter(index + 1); return;
        }
        var idAjoute = devoirsAjouter(genre, champs);
        if (!idAjoute) { refuse = 'Ce créneau n’a pas été ajouté.'; traiter(index + 1); return; }
        ajoutes++;
        if (genre === 'devoirs' && idAjoute) idsDevoirs.push(idAjoute);
        traiter(index + 1);
        }, function () { /* la proposition reste affichée pour corriger */ });
    }
    function finir() {
    devoirsViderPropositions();
    devoirsRendre();
    if (idsDevoirs.length) devoirsDemanderSeances(idsDevoirs);
    devoirsDireOcr(genre,
        ajoutes + ' créneau' + (ajoutes > 1 ? 'x' : '') + ' ajouté' + (ajoutes > 1 ? 's' : '') + ' au planning.' +
        (passes ? ' ' + passes + ' créneau' + (passes > 1 ? 'x' : '') + ' déjà passé' + (passes > 1 ? 's' : '') + ' ignoré' + (passes > 1 ? 's' : '') + '.' : '') +
        (misAJour ? ' ' + misAJour + ' créneau' + (misAJour > 1 ? 'x' : '') + ' mis à jour.' : '') +
        (refuse ? ' ' + refuse : ''), !!refuse);
    }
    traiter(0);
}

function devoirsEchap(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Une validation commune à l'import, à l'ajout manuel et à l'édition.
   Les anciens devoirs sans heure restent compatibles et modifiables. */
function devoirsValider(champs, genre) {
    var matiere = String(champs.matiere || '').trim().slice(0, 60);
    var date = String(champs.date || '').trim();
    var debut = String(champs.debut || '').trim();
    var fin = String(champs.fin || '').trim();
    if (!matiere) return { erreur: 'Indique la matière.' };
    var jour = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(date);
    var valide = jour && new Date(Number(jour[1]), Number(jour[2]) - 1, Number(jour[3]));
    if (!valide || valide.getFullYear() !== Number(jour[1]) || valide.getMonth() !== Number(jour[2]) - 1 || valide.getDate() !== Number(jour[3]))
        return { erreur: 'Indique une date valide.' };
    if (!!debut !== !!fin || (genre === 'examens' && !debut))
        return { erreur: 'Précise les deux heures de l’épreuve.' };
    if (debut) {
        var heure = /^([0-9]{2}):([0-9]{2})$/;
        var a = heure.exec(debut), b = heure.exec(fin);
        if (!a || !b || Number(a[1]) > 23 || Number(b[1]) > 23 || Number(a[2]) > 59 || Number(b[2]) > 59 ||
            devoirsH2M(fin) <= devoirsH2M(debut)) return { erreur: 'La fin doit être après le début.' };
    }
    return { matiere: matiere, date: date, debut: debut, fin: fin };
}

/* Le planning est construit à la demande : le rafraîchir ne doit pas
   faire quitter la page Devoirs ni ouvrir une autre fenêtre. */
/* Recalcule les révisions après une suppression (DE-06), sans ouvrir la
   fenêtre du planning. Appelé aussi après l'annulation. */
function devoirsRecalculerPlanning() {
    if (typeof planningDepuisProgression !== 'function') return;
    try { planningDepuisProgression(); } catch (e) { console.error('Recalcul du planning', e); }
}

function devoirsActualiserPlanning() {
    if (typeof renderPlanning === 'function' && document.getElementById('eventsContainer')) {
        try { renderPlanning(); } catch (e) { console.error('Planning des devoirs', e); }
    }
    if (typeof focusPeindreAccueil === 'function' && document.getElementById('panelSeances')?.classList.contains('active')) focusPeindreAccueil();
}

function devoirsChercherDoublon(store, genre, champs) {
    var matiere = devoirsNormaliser(champs.matiere);
    return (store[genre] || []).find(function (d) {
        return d.date === champs.date && devoirsNormaliser(d.matiere) === matiere;
    }) || null;
}

function devoirsConflits(champs, saufId) {
    if (!champs.debut || !champs.fin) return [];
    var store = devoirsLireStore();
    return (store.devoirs || []).concat(store.examens || []).filter(function (d) {
        return d.id !== saufId && d.date === champs.date && d.debut && d.fin &&
            devoirsH2M(d.debut) < devoirsH2M(champs.fin) && devoirsH2M(d.fin) > devoirsH2M(champs.debut);
    });
}
function devoirsProposerConflit(champs, saufId, continuer, corriger) {
    var conflits = devoirsConflits(champs, saufId);
    if (!conflits.length) { continuer(); return; }
    confirmerAction({
        titre: 'Chevauchement avec ' + conflits.map(function (x) { return x.matiere; }).join(', '),
        detail: 'Ce créneau recouvre une autre épreuve le ' + devoirsDateCourte(champs.date) +
            '. Tu peux corriger les heures ou garder volontairement les deux.',
        action: 'Garder les deux', annulerTexte: 'Corriger les heures', annuler: corriger,
        confirmer: continuer
    });
}

function devoirsNettoyerRevisions(id) {
    if (typeof customEvents === 'undefined') return;
    var prefixe = 'devrev-' + id + '-';
    var avant = customEvents.length;
    customEvents = customEvents.filter(function (e) {
        return !e || (String(e.id || '').indexOf(prefixe) !== 0 && String(e.replacesId || '').indexOf(prefixe) !== 0);
    });
    if (customEvents.length !== avant && typeof v3Save === 'function') v3Save();
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
    var cle = genre === 'examens' ? 'examens' : 'devoirs';
    var valide = devoirsValider(champs, cle);
    if (valide.erreur || devoirsEstPasse(valide.date, valide.fin)) return false;
    var store = devoirsLireStore();
    var entree = Object.assign({ id: devoirsId(cle === 'devoirs' ? 'd' : 'x'), ajouteAt: new Date().toISOString() }, valide);
    if (champs.seances === 'auto' || (Number(champs.seances) >= 0 && Number(champs.seances) <= DEVOIRS_MAX_SEANCES && champs.seances !== '' && champs.seances != null))
        entree.seances = champs.seances === 'auto' ? 'auto' : Math.round(Number(champs.seances));
    store[cle].push(entree);
    devoirsEcrireStore(store);
    devoirsActualiserPlanning();
    return entree.id;
}

function devoirsModifier(genre, id, champs) {
    var cle = genre === 'examens' ? 'examens' : 'devoirs';
    var valide = devoirsValider(champs, cle);
    if (valide.erreur) return valide.erreur;
    var store = devoirsLireStore();
    var cible = store[cle].find(function (d) { return d.id === id; });
    if (!cible) return 'Ce créneau n’existe plus.';
    Object.assign(cible, valide);
    if (cle === 'devoirs' && champs.seances !== undefined) {
        cible.seances = champs.seances === 'auto' ? 'auto' : Math.max(0, Math.min(DEVOIRS_MAX_SEANCES, Math.round(Number(champs.seances) || 0)));
    }
    devoirsEcrireStore(store);
    devoirsNettoyerRevisions(id);
    if (typeof memoireSauvegarder === 'function') memoireSauvegarder();
    devoirsRendre();
    devoirsActualiserPlanning();
    return '';
}


/* ── Combien de séances avant de composer ? ────────────────────────── */
/* Après l'analyse du document, l'élève choisit son nombre de séances
   de révision — une seule question pour toute la fournée, le même
   nombre pour tous les devoirs ajoutés, modifiable un par un ensuite
   depuis la liste. « Propose-moi un planning » laisse le site décider
   (la rampe automatique par deadline). */
function devoirsAppliquerSeances(ids, valeur) {
    if (!Array.isArray(ids) || !ids.length) return;
    if (valeur !== 'auto' && (valeur == null || valeur === '' || !(Number(valeur) >= 0 && Number(valeur) <= DEVOIRS_MAX_SEANCES))) return;
    var st = devoirsLireStore();
    st.devoirs.forEach(function (x) {
        if (ids.indexOf(x.id) !== -1) {
            x.seances = valeur === 'auto' ? 'auto' : Math.round(Number(valeur));
        }
    });
    devoirsEcrireStore(st);
}

/* Le site vient de programmer les devoirs : il annonce tout de suite
   ce qu'il a posé dans l'emploi du temps, pour que l'élève le voie. */
function devoirsAnnoncerAuto(ids) {
    if (typeof v3Toast !== 'function') return;
    try {
        var st = devoirsLireStore();
        var total = 0;
        (ids || []).forEach(function (id) {
            var d = (st.devoirs || []).filter(function (x) { return x.id === id; })[0];
            if (d && d.seances === 'auto' && typeof devoirsSeancesPrevues === 'function') total += devoirsSeancesPrevues(d);
        });
        if (total) v3Toast('✨ Le site a programmé ' + total + ' séance' + (total > 1 ? 's' : '') + ' de révision dans ton emploi du temps', 'success');
    } catch (e) {}
}

function devoirsDemanderSeances(ids) {
    if (!Array.isArray(ids) || !ids.length) return;
    var store = devoirsLireStore();
    var restants = ids.map(function (id) {
        return (store.devoirs || []).filter(function (d) { return d.id === id; })[0];
    }).filter(Boolean).filter(function (d) { return d.seances == null; });
    if (!restants.length) {
        if (typeof generatePlanning === 'function') { try { generatePlanning(); } catch (e) {} }
        return;
    }
    var plusieurs = restants.length > 1;
    var ancien = document.getElementById('seancesQuestionModal');
    if (ancien) ancien.remove();
    var voile = document.createElement('div');
    voile.id = 'seancesQuestionModal';
    voile.setAttribute('role', 'dialog');
    voile.setAttribute('aria-modal', 'true');
    voile.style.cssText = 'position:fixed;inset:0;background:rgba(17,24,39,0.55);z-index:320;display:flex;align-items:center;justify-content:center;padding:1rem;';
    var boutons = '';
    for (var n = 1; n <= DEVOIRS_MAX_SEANCES; n++) {
        boutons += '<button data-n="' + n + '" style="flex:1;padding:0.8rem 0;border:1.5px solid #e5e7eb;border-radius:0.8rem;background:#f9fafb;color:#374151;font:inherit;font-weight:800;cursor:pointer;font-size:1.05rem;">' + n + '</button>';
    }
    var titre = plusieurs
        ? restants.length + ' devoirs ajoutés'
        : devoirsEchap(restants[0].matiere) + ' — ' + devoirsDateCourte(restants[0].date);
    var question = plusieurs
        ? 'Combien de séances de révision avant chaque devoir ?'
        : 'Combien de séances de révision veux-tu avant de composer ce devoir ?';
    voile.innerHTML =
        '<div style="background:white;border-radius:1.25rem;max-width:28rem;width:100%;padding:1.5rem;box-shadow:0 20px 50px rgba(0,0,0,0.25);text-align:center;">' +
        '<div style="font-size:2.2rem;line-height:1;">📚</div>' +
        '<h3 style="margin:0.6rem 0 0.35rem;font-size:1.1rem;font-weight:800;color:#111827;">' + titre + '</h3>' +
        '<p style="margin:0 0 1.1rem;font-size:0.88rem;color:#6b7280;line-height:1.5;">' + question + '</p>' +
        '<div style="display:flex;gap:0.5rem;margin-bottom:0.7rem;">' + boutons + '</div>' +
        '<div class="devoirs-edit-actions"><button type="button" id="seancesQuestionAnnuler">Annuler</button><button type="button" id="seancesQuestionAucune">Aucune séance</button></div>' +
        '<button id="seancesQuestionAuto" style="width:100%;padding:0.8rem;border:none;border-radius:0.8rem;background:linear-gradient(135deg,#059669,#10b981);color:white;font:inherit;font-weight:800;cursor:pointer;">✨ Propose-moi un planning pour les devoirs et examens</button>' +
        '<p style="margin:0.55rem 0 0;font-size:0.75rem;color:#6b7280;line-height:1.4;">Le site choisit le nombre selon l\'urgence et pose les séances dans ton emploi du temps ; tu peux les changer à tout moment.</p></div>';
    document.body.appendChild(voile);
    var idsRestants = restants.map(function (d) { return d.id; });
    function choisir(valeur) {
        devoirsAppliquerSeances(idsRestants, valeur);
        voile.remove();
        if (typeof generatePlanning === 'function') { try { generatePlanning(); } catch (e) {} }
        devoirsRendre();
        if (valeur === 'auto') devoirsAnnoncerAuto(idsRestants);
    }
    voile.querySelectorAll('[data-n]').forEach(function (b) {
        b.onclick = function () { choisir(Number(b.getAttribute('data-n'))); };
    });
    voile.querySelector('#seancesQuestionAuto').onclick = function () { choisir('auto'); };
    voile.querySelector('#seancesQuestionAucune').onclick = function () { choisir(0); };
    voile.querySelector('#seancesQuestionAnnuler').onclick = function () { voile.remove(); devoirsActualiserPlanning(); };
    devoirsModalClavier(voile, function () { voile.remove(); devoirsActualiserPlanning(); });
    voile.querySelector('#seancesQuestionAnnuler').focus();
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
    if (!matiere || !date || (genre !== 'devoirs' && (!debut || !fin)) || (!debut !== !fin)) {
        devoirsDire(zone, genre === 'devoirs' ? 'Matière et date sont nécessaires.' : 'Matière, date et heures sont nécessaires.', true);
        return;
    }
    if (devoirsEstPasse(date, fin)) {
        devoirsDire(zone, 'Ce créneau est déjà passé : il n\'entre pas dans le planning.', true);
        return;
    }
    var champs = devoirsValider({ matiere: matiere, date: date, debut: debut, fin: fin }, genre);
    if (champs.erreur) { devoirsDire(zone, champs.erreur, true); return; }
    devoirsProposerConflit(champs, null, function () { devoirsAjouterManuelConfirme(genre, prefixe, zone, champs); }, function () {
        document.getElementById(prefixe + 'Debut').focus();
    });
}
function devoirsAjouterManuelConfirme(genre, prefixe, zone, champs) {
    var nouvelId = devoirsAjouter(genre, champs);
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
    var cle = genre === 'devoirs' ? 'devoirs' : 'examens';
    var liste = devoirsLireStore()[cle];
    var index = liste.findIndex(function (x) { return x.id === id; });
    if (index < 0) return;
    var objet = liste[index];
    var prefix = 'devrev-' + id + '-';
    var lies = typeof customEvents !== 'undefined' ? customEvents.filter(function (e) {
        return e && (String(e.replacesId || '').indexOf(prefix) === 0 || String(e.id || '').indexOf(prefix) === 0);
    }) : [];
    function actualiser() {
        devoirsRendre();
        devoirsRecalculerPlanning();
        devoirsActualiserPlanning();
    }
    function supprimer() {
        suppressionAvecAnnulation({
            message: (cle === 'examens' ? 'Examen' : 'Devoir') + ' « ' + objet.matiere + ' » supprimé · Annuler',
            retirer: function () {
                var courant = devoirsLireStore();
                courant[cle] = courant[cle].filter(function (x) { return x.id !== id; });
                devoirsEcrireStore(courant);
                if (lies.length && typeof customEvents !== 'undefined') {
                    customEvents = customEvents.filter(function (e) { return lies.indexOf(e) === -1; });
                    if (typeof v3Save === 'function') v3Save();
                }
            },
            restaurer: function () {
                var courant = devoirsLireStore();
                if (!courant[cle].some(function (x) { return x.id === id; })) {
                    courant[cle].splice(Math.min(index, courant[cle].length), 0, objet);
                    devoirsEcrireStore(courant);
                }
                if (lies.length && typeof customEvents !== 'undefined') {
                    lies.forEach(function (e) { if (!customEvents.some(function (x) { return x.id === e.id; })) customEvents.push(e); });
                    if (typeof v3Save === 'function') v3Save();
                }
            },
            actualiser: actualiser
        });
    }
    if (cle === 'examens') {
        confirmerAction({
            titre: 'Supprimer l’examen de ' + objet.matiere + ' ?',
            detail: 'Les révisions de ' + objet.matiere + ' disparaîtront aussi. Tu pourras annuler la suppression pendant 8 secondes.',
            action: 'Supprimer cet examen', confirmer: supprimer
        });
    } else supprimer();
}

/* La même fenêtre corrige un devoir ou un examen, sans changer son id ni
   perdre son choix de révisions. Pas de confirmation native bloquante. */
function devoirsEditer(genre, id) {
    var cle = genre === 'examens' ? 'examens' : 'devoirs';
    var item = devoirsLireStore()[cle].find(function (x) { return x.id === id; });
    if (!item) return;
    var ancien = document.getElementById('devoirsEditionModal');
    if (ancien) ancien.remove();
    var voile = document.createElement('div');
    voile.id = 'devoirsEditionModal';
    voile.className = 'devoirs-voile';
    voile.innerHTML = '<div class="devoirs-dialogue" role="dialog" aria-modal="true" aria-labelledby="devoirsEditTitre">' +
        '<h3 id="devoirsEditTitre">Modifier ' + (cle === 'examens' ? 'l’examen' : 'le devoir') + '</h3>' +
        '<label for="devoirsEditMatiere">Matière</label><input id="devoirsEditMatiere" maxlength="60" list="devoirsMatiereListe" value="' + devoirsEchap(item.matiere) + '">' +
        '<label for="devoirsEditDate">Date</label><input id="devoirsEditDate" type="date" value="' + devoirsEchap(item.date) + '">' +
        '<div class="devoirs-edit-heures"><div><label for="devoirsEditDebut">Début</label><input id="devoirsEditDebut" type="time" value="' + devoirsEchap(item.debut) + '"></div>' +
        '<div><label for="devoirsEditFin">Fin</label><input id="devoirsEditFin" type="time" value="' + devoirsEchap(item.fin) + '"></div></div>' +
        (cle === 'devoirs' ? '<label for="devoirsEditNombre">Séances de révision</label><select id="devoirsEditNombre"><option value="auto">Le site propose</option>' +
            Array.from({length: DEVOIRS_MAX_SEANCES + 1}, function (_, n) { return '<option value="' + n + '"' + (String(item.seances) === String(n) ? ' selected' : '') + '>' + n + (n ? ' séance' + (n > 1 ? 's' : '') : ' — aucune séance') + '</option>'; }).join('') +
            '</select>' : '') +
        '<p id="devoirsEditErreur" role="alert" aria-live="polite"></p>' +
        '<div class="devoirs-edit-actions"><button type="button" id="devoirsEditAnnuler">Annuler</button><button type="button" id="devoirsEditSauver">Enregistrer</button></div></div>';
    document.body.appendChild(voile);
    var retour = document.activeElement;
    function fermer() { voile.remove(); if (retour && typeof retour.focus === 'function') retour.focus(); }
    voile.querySelector('#devoirsEditAnnuler').onclick = fermer;
    voile.querySelector('#devoirsEditSauver').onclick = function () {
        var champs = {
            matiere: voile.querySelector('#devoirsEditMatiere').value,
            date: voile.querySelector('#devoirsEditDate').value,
            debut: voile.querySelector('#devoirsEditDebut').value,
            fin: voile.querySelector('#devoirsEditFin').value
        };
        if (cle === 'devoirs') champs.seances = voile.querySelector('#devoirsEditNombre').value;
        var valide = devoirsValider(champs, cle);
        if (valide.erreur) { voile.querySelector('#devoirsEditErreur').textContent = valide.erreur; return; }
        devoirsProposerConflit(champs, id, function () {
            var erreur = devoirsModifier(cle, id, champs);
            if (erreur) { voile.querySelector('#devoirsEditErreur').textContent = erreur; return; }
            fermer();
        }, function () { voile.querySelector('#devoirsEditDebut').focus(); });
    };
    devoirsModalClavier(voile, fermer);
    voile.querySelector('#devoirsEditMatiere').focus();
}

function devoirsModalClavier(voile, fermer) {
    voile.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); fermer(); return; }
        if (e.key !== 'Tab') return;
        var els = [...voile.querySelectorAll('button, input, select')].filter(function (x) { return !x.disabled; });
        if (!els.length) return;
        if (e.shiftKey && document.activeElement === els[0]) { e.preventDefault(); els[els.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === els[els.length - 1]) { e.preventDefault(); els[0].focus(); }
    });
}

/* ── Modifier les séances d'un devoir, à tout moment ───────────────── */
/* Depuis la liste des devoirs : le nombre de séances se change quand
   l'élève veut, et un devoir sans heures se complète ici. */
function devoirsEditerSeances(id) {
    var store = devoirsLireStore();
    var d = (store.devoirs || []).filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    var ancien = document.getElementById('seancesEditModal');
    if (ancien) ancien.remove();
    var voile = document.createElement('div');
    voile.id = 'seancesEditModal';
    voile.setAttribute('role', 'dialog');
    voile.setAttribute('aria-modal', 'true');
    voile.style.cssText = 'position:fixed;inset:0;background:rgba(17,24,39,0.55);z-index:320;display:flex;align-items:center;justify-content:center;padding:1rem;';
    var boutons = '';
    for (var n = 0; n <= DEVOIRS_MAX_SEANCES; n++) {
        var actif = d.seances != null && d.seances !== 'auto' && Number(d.seances) === n;
        boutons += '<button data-n="' + n + '" style="flex:1;padding:0.8rem 0;border:1.5px solid ' + (actif ? '#059669' : '#e5e7eb') + ';border-radius:0.8rem;background:' + (actif ? '#ecfdf5' : '#f9fafb') + ';color:' + (actif ? '#065f46' : '#374151') + ';font:inherit;font-weight:800;cursor:pointer;font-size:1.05rem;">' + n + '</button>';
    }
    var champsHeures = '';
    if (!d.debut || !d.fin) {
        champsHeures =
            '<div style="display:flex;gap:0.5rem;align-items:center;margin:0 0 0.8rem;">' +
            '<input id="seancesEditDebut" type="time" value="' + devoirsEchap(d.debut) + '" style="flex:1;border:1px solid #e5e7eb;border-radius:0.55rem;padding:0.5rem;font:inherit;font-size:0.85rem;">' +
            '<span style="color:#56665e;">→</span>' +
            '<input id="seancesEditFin" type="time" value="' + devoirsEchap(d.fin) + '" style="flex:1;border:1px solid #e5e7eb;border-radius:0.55rem;padding:0.5rem;font:inherit;font-size:0.85rem;">' +
            '</div>';
    }
    var autoActif = d.seances === 'auto';
    /* ce que le site propose aujourd'hui pour ce devoir */
    var nbAuto = typeof devoirsSeancesPrevues === 'function' ? devoirsSeancesPrevues(d) : 0;
    voile.innerHTML =
        '<div style="background:white;border-radius:1.25rem;max-width:28rem;width:100%;padding:1.5rem;box-shadow:0 20px 50px rgba(0,0,0,0.25);text-align:center;">' +
        '<div style="font-size:2.2rem;line-height:1;">📚</div>' +
        '<h3 style="margin:0.6rem 0 0.35rem;font-size:1.1rem;font-weight:800;color:#111827;">' + devoirsEchap(d.matiere) + ' — ' + devoirsDateCourte(d.date) + '</h3>' +
        '<p style="margin:0 0 1.1rem;font-size:0.88rem;color:#6b7280;line-height:1.5;">Combien de séances de révision avant ce devoir ?' +
        (autoActif ? '<br><span style="color:#b45309;font-weight:700;">Le site en propose ' + nbAuto + ' aujourd\'hui.</span>' : '') + '</p>' +
        champsHeures +
        '<div style="display:flex;gap:0.5rem;margin-bottom:0.7rem;">' + boutons + '</div>' +
        '<button id="seancesEditAuto" style="width:100%;padding:0.8rem;border:1.5px solid ' + (autoActif ? '#f59e0b' : '#e5e7eb') + ';border-radius:0.8rem;background:' + (autoActif ? '#fffbeb' : '#f9fafb') + ';color:' + (autoActif ? '#92400e' : '#374151') + ';font:inherit;font-weight:800;cursor:pointer;">✨ Laisse le site proposer</button></div>';
    document.body.appendChild(voile);
    function choisir(valeur) {
        var st = devoirsLireStore();
        var zoneDebut = document.getElementById('seancesEditDebut');
        var zoneFin = document.getElementById('seancesEditFin');
        st.devoirs.forEach(function (x) {
            if (x.id !== d.id) return;
            x.seances = valeur === 'auto' ? 'auto' : Math.round(Number(valeur));
            var nd = zoneDebut ? zoneDebut.value : '';
            var nf = zoneFin ? zoneFin.value : '';
            if (nd && nf && devoirsH2M(nf) > devoirsH2M(nd) && !devoirsEstPasse(x.date, nf)) {
                x.debut = nd;
                x.fin = nf;
            }
        });
        devoirsEcrireStore(st);
        voile.remove();
        if (typeof generatePlanning === 'function') { try { generatePlanning(); } catch (e) {} }
        devoirsRendre();
        if (valeur === 'auto') devoirsAnnoncerAuto([d.id]);
    }
    voile.querySelectorAll('[data-n]').forEach(function (b) {
        b.onclick = function () { choisir(Number(b.getAttribute('data-n'))); };
    });
    voile.querySelector('#seancesEditAuto').onclick = function () { choisir('auto'); };
    devoirsModalClavier(voile, function () { voile.remove(); });
    voile.querySelector('[data-n]').focus();
}

function devoirsDateCourte(cle) {
    try {
        var d = new Date(cle + 'T12:00:00');
        return ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][d.getDay()] + ' ' + d.getDate() + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
    } catch (e) { return cle; }
}

function devoirsDelai(date) {
    var n = new Date(), cible = new Date(date + 'T12:00:00');
    var jours = Math.round((new Date(cible.getFullYear(), cible.getMonth(), cible.getDate()) -
        new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000);
    return jours === 0 ? 'Aujourd’hui' : jours > 0 ? 'J−' + jours : 'Il y a ' + (-jours) + ' j';
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
        var filtre = (document.getElementById(genre + 'Filtre') || {}).value || 'tous';
        var recherche = devoirsNormaliser((document.getElementById(genre + 'Recherche') || {}).value || '');
        liste = liste.filter(function (x) { return !recherche || devoirsNormaliser(x.matiere).indexOf(recherche) !== -1; });
        var aVenir = liste.filter(function (x) { return !devoirsEstPasse(x.date, x.fin); });
        var passes = liste.filter(function (x) { return devoirsEstPasse(x.date, x.fin); });
        function rendreLignes(lignes) {
            return lignes.map(function (x) {
                var horaire = (x.debut && x.fin) ? devoirsDateCourte(x.date) + ' · ' + devoirsEchap(x.debut) + ' → ' + devoirsEchap(x.fin) : devoirsDateCourte(x.date);
                /* le nombre de séances que le devoir porte : le chiffre
                   choisi, ou celui que le site programme selon l'urgence */
                var nbSeances = typeof devoirsSeancesPrevues === 'function'
                    ? devoirsSeancesPrevues(x)
                    : (Number(x.seances) >= 1 ? Math.round(Number(x.seances)) : 0);
                var autoSeances = x.seances === 'auto';
                var ligneSeances = (genre === 'devoirs')
                    ? '<p style="margin:0;font-size:0.72rem;color:' + (autoSeances ? '#b45309' : '#047857') + ';">' + nbSeances + ' séance' + (nbSeances > 1 ? 's' : '') + ' de révision' + (autoSeances ? ' · choisie' + (nbSeances > 1 ? 's' : '') + ' par le site' : '') + '</p>'
                    : '';
                var boutonSeances = genre === 'devoirs'
                    ? '<button type="button" onclick="devoirsEditerSeances(\'' + x.id + '\')" title="Séances de révision' + (autoSeances ? ' (par le site)' : '') + '" style="border:none;background:none;cursor:pointer;font-size:0.8rem;font-weight:800;color:' + (autoSeances ? '#b45309' : (nbSeances ? '#059669' : '#9ca3af')) + ';white-space:nowrap;">' + (autoSeances ? (nbSeances ? '✨ ' + nbSeances : '✨') : (nbSeances ? '📚 ' + nbSeances : '📚 +')) + '</button>'
                    : '';
                return '<div style="display:flex;align-items:center;gap:0.6rem;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:0.8rem;padding:0.55rem 0.75rem;">' +
                    '<span style="font-size:1.1rem;">' + (genre === 'devoirs' ? '📝' : '🎓') + '</span>' +
                    '<div style="flex:1;min-width:0;"><p style="margin:0;font-weight:700;color:#111827;font-size:0.88rem;">' + devoirsEchap(x.matiere) + '</p>' +
                    '<p style="margin:0;font-size:0.75rem;color:#6b7280;">' + horaire +
                    (!x.debut ? ' · heure à confirmer' : '') + ' · ' + devoirsDelai(x.date) + '</p>' + ligneSeances + '</div>' +
                    '<button type="button" onclick="devoirsEditer(\'' + genre + '\',\'' + x.id + '\')" aria-label="Modifier ' + (genre === 'examens' ? 'l’examen' : 'le devoir') + ' de ' + devoirsEchap(x.matiere) + '" title="Modifier" style="border:none;background:none;cursor:pointer;font-size:0.95rem;">✏️</button>' +
                    boutonSeances +
                    '<button type="button" onclick="devoirsSupprimer(\'' + genre + '\',\'' + x.id + '\')" style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:0.95rem;">🗑️</button></div>';
            }).join('');
        }
        zone.innerHTML = (filtre === 'passes' ? '' : '<h3 class="devoirs-groupe">À venir (' + aVenir.length + ')</h3>' +
            (aVenir.length ? rendreLignes(aVenir) : '<p>Aucun créneau à venir.</p>')) +
            (filtre === 'avenir' || !passes.length ? '' : '<details class="devoirs-passes"' + (filtre === 'passes' ? ' open' : '') + '><summary>Passés (' + passes.length + ')</summary>' + rendreLignes(passes) + '</details>');
        if (!zone.innerHTML) zone.innerHTML = '<p>Aucun créneau trouvé.</p>';
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
