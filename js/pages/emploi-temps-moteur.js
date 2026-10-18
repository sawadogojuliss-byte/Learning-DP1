/* ============================================================
   MOTEUR DE L'EMPLOI DU TEMPS SCOLAIRE
   Les heures creuses de la journée d'école (trous entre deux cours)
   reçoivent du travail, par priorité : révisions et exercices de la
   prochaine matière, puis mémoire, puis évaluation interne, puis CAS.
   ============================================================ */

/* Les trous entre deux cours d'une journée : assez grands pour
   travailler (au moins 40 minutes, avec la marge de respiration). */
function emploiScolaireTrous(cours, margeMin) {
    var marge = typeof margeMin === 'number' ? margeMin : 40;
    var triee = (cours || []).slice().filter(function (c) { return c && c.debut && c.fin; })
        .sort(function (a, b) { return a.debut < b.debut ? -1 : 1; });
    var trous = [];
    for (var i = 1; i < triee.length; i++) {
        var debut = emploiH2M(triee[i - 1].fin);
        var fin = emploiH2M(triee[i].debut);
        if (fin - debut >= marge) {
            trous.push({ debut: debut, fin: fin, avant: triee[i] });
        }
    }
    return trous;
}

/* Le creux du midi : le trou qui chevauche 12h00-13h30, sinon le plus
   grand trou de la mi-journée. Renvoie null s'il n'y en a pas. */
function emploiScolaireTrouMidi(cours) {
    var trous = emploiScolaireTrous(cours, 25).filter(function (t) {
        return t.debut < 13 * 60 + 30 && t.fin > 12 * 60;
    });
    if (!trous.length) return null;
    return trous.sort(function (a, b) { return (b.fin - b.debut) - (a.fin - a.debut); })[0];
}

/* Le travail d'un trou, par priorité :
   1. révisions de la prochaine matière (celle du cours qui suit le
      trou), puis ses exercices ;
   2. mémoire (EE) ;
   3. évaluation interne (IA) ;
   4. CAS.
   Chaque bloc est limité par la place du trou ; ce qui ne rentre pas
   attend un autre trou. Renvoie une liste de blocs {id, titre, sous,
   duree, couleur, icone, type}. */
function emploiScolaireBlocsTravail(trou, opts) {
    var o = opts || {};
    var place = trou.fin - trou.debut - 10; /* 10 min de respiration */
    var blocs = [];
    var matiereSuivante = trou.avant && trou.avant.matiere ? trou.avant.matiere : '';
    function pousser(id, titre, sous, duree, couleur, icone, type) {
        if (blocs.length >= 3 || duree < 20) return;
        var d = Math.min(duree, place);
        if (d < 20) return;
        blocs.push({ id: id, titre: titre, sous: sous, duree: d, couleur: couleur, icone: icone, type: type });
        place -= d + 10;
    }
    /* 1) la matière du prochain cours */
    if (matiereSuivante) {
        var sujet = null;
        (o.sujets || []).forEach(function (s) { if (s && s.name === matiereSuivante) sujet = s; });
        var dureeRev = sujet && typeof dureeEtude === 'function' ? dureeEtude(sujet, 60, 45) : 45;
        pousser('emploi-rev-' + trou.debut, 'Révisions ' + matiereSuivante,
            sujet && typeof sousTitreMatiere === 'function' ? sousTitreMatiere(sujet) : 'Prochain cours',
            dureeRev,
            sujet && typeof couleurMatiere === 'function' ? couleurMatiere(sujet) : '#10b981',
            sujet && sujet.icon ? sujet.icon : '📚', 'study');
        var sciences = ['Mathématiques', 'Physique', 'Chimie', 'Biologie'];
        if (sciences.some(function (n) { return matiereSuivante.indexOf(n) !== -1; })) {
            pousser('emploi-exo-' + trou.debut, 'Exercices ' + matiereSuivante, 'Avant le prochain cours', 40,
                sujet && typeof couleurMatiere === 'function' ? couleurMatiere(sujet) : '#0ea5e9', '✏️', 'study');
        }
    }
    /* 2) le mémoire */
    if (o.memoire && place >= 20) {
        pousser('emploi-memoir-' + trou.debut, 'Mémoire', 'Avancer pendant le creux', 45, '#f59e0b', '📖', 'memoir');
    }
    /* 3) l'évaluation interne */
    if (o.ia && place >= 20) {
        pousser('emploi-ia-' + trou.debut, 'Évaluation interne', 'Avancer pendant le creux', 40, '#8b5cf6', '🧪', 'ia');
    }
    /* 4) le CAS */
    if (place >= 20) {
        pousser('emploi-cas-' + trou.debut, 'CAS', 'Créativité · Action · Service', 40, '#06b6d4', '🤝', 'activity');
    }
    return blocs;
}

/* Les options du jour : ce que l'élève a à faire (mémoire, IA) et ses
   matières, pour choisir le travail des trous. */
function emploiScolaireOptionsJour() {
    var o = { sujets: [], memoire: false, ia: false };
    try {
        if (typeof subjects !== 'undefined' && Array.isArray(subjects)) o.sujets = o.sujets.concat(subjects);
        if (typeof optionalSubjects !== 'undefined' && Array.isArray(optionalSubjects)) o.sujets = o.sujets.concat(optionalSubjects);
    } catch (e) {}
    try {
        o.memoire = (typeof eeMemoirActif === 'function') ? eeMemoirActif() : !!(typeof memoirLevel !== 'undefined' && memoirLevel);
    } catch (e) { o.memoire = false; }
    try {
        o.ia = (typeof iaLevel !== 'undefined' && iaLevel) ||
            (typeof iaLevels !== 'undefined' && iaLevels && Object.keys(iaLevels).some(function (k) { return iaLevels[k]; }));
    } catch (e) { o.ia = false; }
    return o;
}

/* Les matières de l'élève présentes dans l'emploi du temps chargé :
   chaque cours est rattaché à une matière suivie (au nom de l'élève,
   recalculé à chaque lecture — si l'élève change ses matières, le
   rattachement suit). Avec un numéro de jour (0-6) : les matières des
   cours de ce jour-là, dans l'ordre de la journée. Sans numéro : toutes
   les matières de la semaine, dans l'ordre de leur premier cours. Les
   cours qui ne correspondent à aucune matière suivie (Sport, K4C…) ne
   comptent pas. Sans emploi du temps chargé, la liste est vide. */
function emploiScolaireSujets(dayIndex) {
    var parNom = {};
    try {
        if (typeof subjects !== 'undefined' && Array.isArray(subjects)) {
            subjects.forEach(function (s) { if (s && s.name) parNom[s.name] = s; });
        }
        if (typeof optionalSubjects !== 'undefined' && Array.isArray(optionalSubjects)) {
            optionalSubjects.forEach(function (s) { if (s && s.name && !parNom[s.name]) parNom[s.name] = s; });
        }
    } catch (e) {}
    if (!Object.keys(parNom).length) return [];
    var jours;
    if (dayIndex == null) {
        jours = emploiScolaireLire().jours;
    } else {
        var j = Number(dayIndex);
        if (!(j >= 0 && j <= 6)) return [];
        jours = [emploiScolaireJour(j)];
    }
    var vus = {};
    var out = [];
    jours.forEach(function (liste) {
        (liste || []).forEach(function (c) {
            if (!c || !c.nom) return;
            var nom = (typeof emploiMatiereDe === 'function' ? emploiMatiereDe(c.nom) : '') || c.matiere || '';
            var sujet = nom ? parNom[nom] : null;
            if (sujet && !vus[sujet.name]) { vus[sujet.name] = 1; out.push(sujet); }
        });
    });
    return out;
}
