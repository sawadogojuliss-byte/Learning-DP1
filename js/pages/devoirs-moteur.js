/* ============================================================
   MOTEUR Devoirs & Examens — adaptation du planning
   Le planning est un modèle de semaine ; les devoirs et les examens
   ont des dates. Chaque jour affiché reçoit la date réelle de sa
   semaine, puis :
   - un devoir devient un bloc fixe « Devoir · matière » : aux heures
     du document quand il en donne, sinon dans le créneau « DEVOIR DE
     NIVEAU » de l'emploi du temps de l'élève — ce créneau générique
     disparaît ce jour-là, remplacé par le(s) devoir(s) réel(s) ;
   - les séances de révision choisies par l'élève sont garanties :
     ce que les moments libres n'ont pas pu accueillir prend la place
     des blocs d'étude habituels du jour (jamais les cours, les
     repas, le sommeil ou les trajets) ;
   - les examens déclarent deux semaines : la semaine avant (uniquement
     des révisions et des exercices sur les matières à examiner — plus de
     CAS, ni mémoire, ni évaluation interne) et la semaine des épreuves
     (les examens à leurs heures, quelques révisions pour ce qui reste à
     composer — une matière composée n'est plus jamais révisée).
   Priorité aux épreuves les plus proches : elles reçoivent le plus de
   temps de révision.
   ============================================================ */

function devoirsM2H(m) {
    m = ((Number(m) % 1440) + 1440) % 1440;
    return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
}

function devoirsDateDuJour(dayIndex) {
    var today = new Date();
    var idx = typeof indexJourCourant === 'function' ? indexJourCourant(today) : ((today.getDay() + 6) % 7);
    var lundi = new Date(today.getFullYear(), today.getMonth(), today.getDate() - idx);
    return new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + Number(dayIndex));
}

function devoirsInstant(cle, heure) {
    var h = /^\d{2}:\d{2}$/.test(String(heure || '')) ? heure : '00:00';
    return new Date(cle + 'T' + h + ':00');
}

/* Le bloc d'un devoir ou d'un examen : posé à ses heures, et ce qui le
   chevauche (cours, activités, repas…) est retiré ou raccourci. */
function devoirsPoserBloc(jour, bloc) {
    var debut = devoirsH2M(bloc.debut);
    var fin = devoirsH2M(bloc.fin);
    if (fin <= debut) return jour;
    var out = [];
    (jour || []).forEach(function (ev) {
        if (!ev || !ev.startTime || !ev.endTime) { out.push(ev); return; }
        var id = String(ev.id || '');
        if (id.indexOf(bloc.id) === 0 || ev.devoirsBloc) { out.push(ev); return; }
        var s = devoirsH2M(ev.startTime);
        var e = devoirsH2M(ev.endTime);
        if (e <= debut || s >= fin) { out.push(ev); return; }
        if (s < debut && debut - s >= 15) {
            var avant = Object.assign({}, ev, { endTime: devoirsM2H(debut) });
            out.push(avant);
        }
        if (e > fin && e - fin >= 15) {
            var apres = Object.assign({}, ev, { startTime: devoirsM2H(fin) });
            out.push(apres);
        }
    });
    out.push({
        id: bloc.id,
        title: bloc.titre,
        subtitle: bloc.sous || '',
        startTime: devoirsM2H(debut),
        endTime: devoirsM2H(fin),
        type: bloc.type || 'school',
        icon: bloc.icone || '📝',
        editable: false,
        kind: 'fixed',
        devoirsBloc: true
    });
    return out;
}

/* Ce qui disparaît pendant les semaines de révisions et d'examens :
   CAS (activités), mémoire, évaluations internes, et les blocs d'étude
   habituels — remplacés par les révisions ciblées. */
function devoirsBlocARetirer(ev) {
    if (!ev) return false;
    var id = String(ev.id || '');
    var type = String(ev.type || '');
    if (type === 'activity') return true;
    if (type === 'ia' || type === 'memoir') return true;
    if (id === 'study1' || id === 'study2' || id === 'exercises') return true;
    /* Travail généré dans les trous de l'emploi du temps scolaire :
       ne pas laisser une ancienne matière hors sujet pendant les examens.
       On ne retire pas tout type=study : l'élève peut avoir posé lui-même
       un événement de ce type. */
    if (type === 'study' && (id.indexOf('emploi-rev-') === 0 ||
        id.indexOf('emploi-exo-') === 0 || id.indexOf('revgap-') === 0)) return true;
    if (id.indexOf('study-page') === 0 || id.indexOf('ia-page') === 0 || id.indexOf('memoir-page') === 0) return true;
    return false;
}

function devoirsReveilJour(dayIndex) {
    var bacSamedi = typeof devoirsFaitBac === 'function' && devoirsFaitBac() && Number(dayIndex) === 5;
    var base = '05:30';
    if (Number(dayIndex) === 5) base = (typeof saturdayWakeup !== 'undefined' && saturdayWakeup) || '08:00';
    else if (Number(dayIndex) === 6) base = (typeof sundayWakeup !== 'undefined' && sundayWakeup) || '08:30';
    else base = (typeof weekdayWakeup !== 'undefined' && weekdayWakeup) || '05:30';
    var m = devoirsH2M(base);
    if (bacSamedi) m = Math.min(m, 7 * 60);
    return m;
}

function devoirsCoucherJour(dayIndex) {
    if (typeof bedtimeForDay === 'function') {
        try { return devoirsH2M(bedtimeForDay(dayIndex)); } catch (e) {}
    }
    return 22 * 60;
}

/* Les trous du jour : les espaces entre deux créneaux, dans la fenêtre
   éveillée, assez grands pour travailler. */
function devoirsTrous(jour, apresMin, avantMin) {
    var evs = (jour || []).filter(function (ev) { return ev && ev.startTime && ev.endTime; })
        .map(function (ev) { return { s: devoirsH2M(ev.startTime), e: devoirsH2M(ev.endTime) }; })
        .filter(function (x) { return x.e > x.s; })
        .sort(function (a, b) { return a.s - b.s; });
    var trous = [];
    var cur = apresMin;
    evs.forEach(function (x) {
        if (x.s > cur + 39) trous.push({ s: cur, e: x.s });
        if (x.e > cur) cur = x.e;
    });
    if (avantMin > cur + 39) trous.push({ s: cur, e: avantMin });
    return trous.filter(function (t) { return t.e - t.s >= 40; });
}

/* Pose équilibrée d'un jour : les trous les plus petits reçoivent
   d'abord les séances choisies par l'élève (rétrécies s'il le faut :
   60, puis la place disponible, jamais moins de 40 min), et les grands
   créneaux restent aux longues révisions. Rien ne se pose sur autre
   chose qu'un moment libre. */
function devoirsPoserEquilibre(seances, autos, trous) {
    var poses = [];
    var restantesSeances = (seances || []).slice();
    var restantsAuto = (autos || []).slice();
    var ordonnes = (trous || []).slice().sort(function (a, b) { return (a.e - a.s) - (b.e - b.s); });
    ordonnes.forEach(function (trou) {
        var cur = trou.s;
        while (trou.e - cur >= 40) {
            if (restantesSeances.length) {
                var seance = restantesSeances.shift();
                var dureeS = Math.min(seance.duree || 60, trou.e - cur);
                poses.push({ id: seance.id, titre: seance.titre, sous: seance.sous, debut: cur, fin: cur + dureeS, icone: seance.icone, type: seance.type });
                cur += dureeS + 10;
                continue;
            }
            /* les révisions automatiques se posent dans leur ordre de
               priorité (la plus proche épreuve d'abord, révision puis
               exercices) ; si la place manque, la première se rétrécit
               à ce qui reste — jamais moins de 40 minutes — plutôt que
               de perdre sa séance. Un examen sans révision parce que
               les créneaux font 55 minutes serait un défaut. */
            if (!restantsAuto.length || (trou.e - cur) < 40) break;
            var meilleur = restantsAuto.shift();
            var dureeA = Math.min(meilleur.duree, trou.e - cur);
            poses.push({ id: meilleur.id, titre: meilleur.titre, sous: meilleur.sous, debut: cur, fin: cur + dureeA, icone: meilleur.icone, type: meilleur.type });
            cur += dureeA + 10;
        }
    });
    return poses;
}

function devoirsPlacerDansTrou(blocs, trous) {
    var poses = [];
    var i = 0;
    trous.forEach(function (trou) {
        var cur = trou.s;
        while (i < blocs.length && trou.e - cur >= 40) {
            var b = blocs[i];
            /* même règle qu'en semaine : la révision se rétrécit à la
               place disponible au lieu de disparaître */
            var duree = Math.min(b.duree, trou.e - cur);
            poses.push({
                id: b.id,
                titre: b.titre,
                sous: b.sous,
                debut: cur,
                fin: cur + duree,
                icone: b.icone,
                type: b.type
            });
            cur += duree + 10;
            i++;
        }
    });
    return poses;
}

/* Répartition des séances choisies par l'élève : n séances sur les
   jours restants, de plus en plus rapprochées à mesure que l'échéance
   approche (la veille porte toujours une séance). Renvoie { offset ->
   nombre de séances ce jour-là }. */
function devoirsRepartitionSeances(n, jours) {
    var rep = {};
    n = Math.max(1, Math.round(Number(n) || 1));
    if (!(jours >= 1)) { rep[0] = n; return rep; }
    var i, off;
    if (n <= jours) {
        for (i = 0; i < n; i++) {
            off = n === 1 ? jours - 1 : Math.round((jours - 1) * (1 - i / (n - 1)));
            off = Math.min(jours - 1, Math.max(0, off));
            rep[off] = (rep[off] || 0) + 1;
        }
    } else {
        var base = Math.floor(n / jours), reste = n % jours;
        for (i = 0; i < jours; i++) rep[i] = base + (i >= jours - reste ? 1 : 0);
    }
    return rep;
}

/* Les jours qui séparent aujourd'hui du devoir, de date à date — le
   jour du devoir lui-même ne porte jamais de séance, la veille en
   porte toujours. */
function devoirsJoursRestants(d) {
    var maintenant = new Date();
    var debut = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()).getTime();
    var cible = devoirsInstant(d && d.date, '00:00').getTime();
    if (!isFinite(cible)) return 1;
    return Math.max(1, Math.round((cible - debut) / 86400000));
}

/* Le nombre de séances qu'un devoir doit porter.
   - Le chiffre choisi par l'élève est tenu exactement.
   - « auto » : c'est le site qui programme, et le nombre suit l'urgence
     du moment — une séance quand le devoir est loin (plus de 10 jours),
     deux à cinq-dix jours, trois à deux-quatre jours, jamais moins
     d'une, et la veille en porte toujours une.
   - Pendant les semaines d'examens, un devoir que le site programme se
     réduit à sa séance de la veille : le temps de l'épreuve reste à
     l'épreuve.
   - Sans choix, rien : la rampe automatique d'avant s'en occupe. */
function devoirsNombreSeances(d, opts) {
    if (!d) return 0;
    if (d.seances === 0) return 0;
    if (Number(d.seances) >= 1) return Math.min(DEVOIRS_MAX_SEANCES, Math.round(Number(d.seances)));
    if (d.seances !== 'auto') return 0;
    if (opts && opts.reduites) return 1;
    /* le jour du devoir et les jours passés ne portent aucune séance */
    var maintenant = new Date();
    var debut = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()).getTime();
    var cible = devoirsInstant(d.date, '00:00').getTime();
    if (!isFinite(cible) || cible <= debut) return 0;
    var jours = devoirsJoursRestants(d);
    if (jours >= 11) return 1;
    if (jours >= 5) return 2;
    if (jours >= 2) return 3;
    return 1;
}

/* Ce que la page affiche pour un devoir programmé par le site : le même
   nombre que le planning, réduction pour l'examen comprise. Un devoir
   qui tombe avant la première épreuve garde son plan normal. */
function devoirsSeancesPrevues(d) {
    var n = devoirsNombreSeances(d);
    if (!n || !d || d.seances !== 'auto') return n;
    try {
        var store = typeof devoirsLireStore === 'function' ? devoirsLireStore() : null;
        var maintenant = new Date().getTime();
        var premier = null;
        (store && store.examens || []).forEach(function (x) {
            var s = devoirsInstant(x.date, x.debut).getTime();
            if (s >= maintenant && (premier == null || s < premier)) premier = s;
        });
        if (premier != null && premier - maintenant <= 7 * 86400000 &&
            devoirsInstant(d.date, '00:00').getTime() > premier) return 1;
    } catch (e) {}
    return n;
}

/* Chaque examen ouvre sa propre fenêtre J-14. Seule la date du
   jour affiché compte : une épreuve lointaine n'est pas préparée dans
   les semaines proches, même si une autre épreuve a déjà commencé. */
function devoirsExamenEnPreparation(epreuve, date) {
    if (!epreuve || !epreuve.date || !date) return false;
    var cible = devoirsInstant(epreuve.date, '00:00');
    if (!isFinite(cible.getTime())) return false;
    var debut = new Date(cible.getFullYear(), cible.getMonth(), cible.getDate() - 14);
    return date.getTime() >= debut.getTime() && date.getTime() < cible.getTime();
}

/* Le temps de préparation grandit à mesure que l'échéance approche :
   à J-14, deux blocs ; la dernière semaine, le rythme intensif.
   Les devoirs gardent leur budget actuel hors de cette règle d'examen. */
function devoirsBudgetPreparation(jours) {
    if (jours <= 3) return { blocs: 3, duree: 75 };
    if (jours <= 7) return { blocs: 2, duree: 75 };
    if (jours <= 14) return { blocs: 2, duree: 45 };
    return { blocs: 1, duree: 45 };
}

/* Le compte à rebours affiché sous chaque bloc : « dans 3 j », « demain »… */
function devoirsDansXJours(ep) {
    var n = new Date();
    var cleJour = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
    var cible = String(ep.date || '');
    if (cible === cleJour(n)) return "aujourd'hui";
    var demain = new Date(n.getTime() + 86400000);
    if (cible === cleJour(demain)) return 'demain';
    var t = devoirsInstant(ep.date, ep.debut).getTime() - n.getTime();
    if (t <= 0) return "c'est maintenant";
    return 'dans ' + Math.ceil(t / 86400000) + ' j';
}

function devoirsBlocsRevisions(epreuves, mode, opts) {
    /* Épreuves triées de la plus proche à la plus lointaine : les plus
       proches reçoivent le plus de temps (un tour de plus à chaque
       cycle). */
    var ordre = epreuves.slice().sort(function (a, b) {
        return devoirsInstant(a.date, a.debut) - devoirsInstant(b.date, b.debut);
    });
    var file = [];
    /* En préparation (épreuve encore loin), on commence doucement : un
       bloc de révision par matière, en priorité aux plus proches. */
    var cycles = mode === 'preparation' ? ['Révision'] : (mode === 'examens' ? ['Révision', 'Exercices'] : ['Révision', 'Exercices', 'Révision', 'Exercices']);
    cycles.forEach(function (genre, c) {
        var garde = Math.max(1, Math.ceil(ordre.length - (c * ordre.length) / Math.max(1, cycles.length)));
        for (var k = 0; k < garde && k < ordre.length; k++) {
            var ep = ordre[k];
            var duree = genre === 'Révision' ? ((opts && opts.dureeRevision) || (mode === 'examens' ? 60 : (mode === 'preparation' ? 45 : 75))) : 45;
            file.push({
                id: 'devrev-' + ep.id + '-' + c + '-' + k,
                titre: genre + ' · ' + ep.matiere,
                sous: (mode === 'examens' ? 'Épreuve le ' : 'Devoir le ') + devoirsJourCourt(ep.date) + ' à ' + ep.debut + ' · ' + devoirsDansXJours(ep),
                duree: duree,
                icone: genre === 'Révision' ? '📚' : '✏️',
                type: 'study'
            });
        }
    });
    return file;
}

function devoirsJourCourt(cle) {
    try {
        var d = new Date(cle + 'T12:00:00');
        return ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][d.getDay()] + ' ' + d.getDate() + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
    } catch (e) { return cle; }
}

/* Le cours d'économie du samedi n'existe plus : il disparaît pour
   tous les élèves, pour toujours — bac ou pas. */
function devoirsEstCoursEconomie(ev) {
    if (!ev) return false;
    if (ev.id === 'eco' || ev.replacesId === 'eco') return true;
    var titre = String(ev.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['\u2019]/g, ' ');
    return titre.indexOf('cours d economie') !== -1;
}

/* ── Le créneau des devoirs de niveau ──────────────────────────────── */
/* Dans l'emploi du temps scolaire, l'entrée « DEVOIR DE NIVEAU » est
   le moment où les compositions ont lieu. Quand l'élève a un devoir
   ce jour-là, ce créneau générique disparaît : sa place va au(x)
   devoir(s) réel(s) de l'élève. */
function devoirsEstCreneauDevoir(ev) {
    if (!ev || ev.devoirsBloc) return false;
    if (String(ev.type || '') !== 'school') return false;
    var titre = String(ev.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    return titre.indexOf('devoir') !== -1;
}

/* Sans heures de composition, les devoirs d'un même jour se partagent
   le créneau : chacun sa part, dans l'ordre du document, une pause de
   15 minutes entre deux. Les plages déjà prises par les devoirs aux
   heures connues ne se redistribuent pas. */
function devoirsDecouperCreneau(creneaux, poses, devoirs) {
    var plages = [];
    (creneaux || []).forEach(function (c) {
        var s = devoirsH2M(c.startTime), e = devoirsH2M(c.endTime);
        if (!(e > s)) return;
        var morceaux = [{ s: s, e: e }];
        (poses || []).forEach(function (p) {
            var ps = devoirsH2M(p.debut), pe = devoirsH2M(p.fin);
            var apres = [];
            morceaux.forEach(function (m) {
                if (pe <= m.s || ps >= m.e) { apres.push(m); return; }
                if (ps - m.s >= 15) apres.push({ s: m.s, e: Math.min(ps, m.e) });
                if (m.e - Math.max(pe, m.s) >= 15) apres.push({ s: Math.max(pe, m.s), e: m.e });
            });
            morceaux = apres;
        });
        plages = plages.concat(morceaux);
    });
    plages.sort(function (a, b) { return a.s - b.s; });
    var total = 0;
    plages.forEach(function (p) { total += p.e - p.s; });
    var n = (devoirs || []).length;
    if (!n || total < 40) return [];
    var part = Math.max(40, Math.floor((total - 15 * (n - 1)) / n));
    var parts = [];
    var curseur = null;
    devoirs.forEach(function (d) {
        var cible = null;
        plages.forEach(function (p) {
            if (cible) return;
            var debut = p.s;
            if (curseur != null && curseur > p.s) {
                if (curseur >= p.e - 39) return;
                debut = curseur;
            }
            var fin = Math.min(p.e, debut + part);
            if (fin - debut >= 40) cible = { d: d, debut: debut, fin: fin };
        });
        if (cible) { parts.push(cible); curseur = cible.fin + 15; }
    });
    return parts;
}

/* ── La garantie des séances choisies ──────────────────────────────── */
/* Un bloc d'étude que le site a lui-même posé (révisions, exercices,
   mémoire, évaluation interne) peut céder sa place à une séance de
   révision de devoir. Jamais les cours, les repas, le sommeil, les
   trajets, le réveil, ni les créneaux que l'élève a posés lui-même. */
function devoirsBlocConvertible(ev) {
    if (!ev || ev.devoirsBloc) return false;
    var id = String(ev.id || '');
    var type = String(ev.type || '');
    if (type === 'ia' || type === 'memoir') return true;
    if (id === 'study1' || id === 'study2' || id === 'exercises') return true;
    if (id.indexOf('emploi-rev-') === 0 || id.indexOf('emploi-exo-') === 0 ||
        id.indexOf('emploi-memoir-') === 0 || id.indexOf('emploi-ia-') === 0 ||
        id.indexOf('revgap-') === 0 || id.indexOf('memoir-') === 0 || id.indexOf('ia-') === 0 ||
        id.indexOf('study-page') === 0 || id.indexOf('ia-page') === 0 || id.indexOf('memoir-page') === 0) return true;
    return false;
}

/* Le titre d'un bloc parle-t-il de cette matière ? « Révisions
   Mathématiques AA SL », « Exercices Maths AA »… On compare les mots
   du nom de la matière, sans les niveaux (HL, SL). */
function devoirsBlocParleDe(ev, matiere) {
    if (!ev || !matiere) return false;
    var norm = function (x) {
        return String(x == null ? '' : x).toLowerCase().normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ')
            .replace(/\s+/g, ' ').trim();
    };
    var titre = norm(ev.title);
    var nom = norm(matiere).replace(/\b(hl|sl)\b/g, '').replace(/\s+/g, ' ').trim();
    if (!titre || !nom) return false;
    if (titre.indexOf(nom) !== -1) return true;
    var mots = nom.split(' ').filter(function (m) { return m.length >= 4; });
    return mots.length > 0 && mots.every(function (m) { return titre.indexOf(m) !== -1; });
}

/* Le bloc à céder pour une séance : d'abord un bloc d'étude de la MÊME
   matière (le temps de révision existait déjà — la séance du devoir
   prend sa place, le planning reste cohérent), puis n'importe quel bloc
   d'étude du site. Un bloc de 40 minutes minimum, puis 25 : une séance
   plus courte vaut mieux qu'un devoir sans révision. */
function devoirsChoisirBlocAJeter(jour, matiere, deja) {
    var essais = [
        { memeSujet: true, minimum: 40 },
        { memeSujet: false, minimum: 40 },
        { memeSujet: true, minimum: 25 },
        { memeSujet: false, minimum: 25 }
    ];
    for (var i = 0; i < essais.length; i++) {
        var essai = essais[i];
        var cible = null, taille = 0;
        jour.forEach(function (ev) {
            if (!ev || deja.indexOf(ev) !== -1) return;
            if (!devoirsBlocConvertible(ev) || !ev.startTime || !ev.endTime) return;
            if (essai.memeSujet && !devoirsBlocParleDe(ev, matiere)) return;
            var t = devoirsH2M(ev.endTime) - devoirsH2M(ev.startTime);
            if (t >= essai.minimum && t > taille) { cible = ev; taille = t; }
        });
        if (cible) return cible;
    }
    return null;
}

/* Chaque promesse {prefix, promis, titre, sous, icone, matiere} :
   promis blocs doivent exister dans la journée sous ce prefix. Ce qui
   manque prend la place d'un bloc d'étude : même créneau, la séance du
   devoir à la place. La matière du devoir dirige le choix du bloc cédé
   pour que le temps de révision coïncide avec le planning. */
function devoirsGarantirSeances(jour, promesses) {
    var deja = [];
    (promesses || []).forEach(function (p) {
        if (!p || !(p.promis >= 1)) return;
        var matiereP = p.matiere || p.titre;
        var manque = p.promis - jour.filter(function (ev) {
            return ev && ev.devoirsBloc && String(ev.id || '').indexOf(p.prefix) === 0;
        }).length;
        for (var k = 0; k < manque; k++) {
            var cible = devoirsChoisirBlocAJeter(jour, p.matiere || p.titre, deja);
            if (!cible) break;
            deja.push(cible);
            cible.id = p.prefix + 'g' + k;
            cible.title = p.titre;
            cible.subtitle = p.sous || '';
            cible.type = 'study';
            cible.icon = p.icone || '📚';
            cible.devoirsBloc = true;
            cible.kind = 'pinned';
            cible.editable = true;
        }
    });
}

/* Les séances de plusieurs devoirs, une par devoir à tour de rôle :
   aucune matière ne prend toute la place du jour en laissant l'autre
   sans révision. */
function devoirsEnTourDeRole(parDevoir) {
    var files = (parDevoir || []).map(function (liste) { return (liste || []).slice(); })
        .filter(function (liste) { return liste.length; });
    var out = [];
    var reste = true;
    while (reste) {
        reste = false;
        files.forEach(function (liste) {
            if (liste.length) { out.push(liste.shift()); reste = true; }
        });
    }
    return out;
}

function devoirsTrouverHeureLibre(jour) {
    /* Aucune heure n'est affirmée comme certaine : le bloc est marqué à
       confirmer et ne prend jamais la place d'un cours/repas/trajet. */
    for (var debut = 16 * 60 + 30; debut <= 21 * 60; debut += 15) {
        if (!(jour || []).some(function (e) {
            if (!e || !e.startTime || !e.endTime) return false;
            var a = devoirsH2M(e.startTime), b = devoirsH2M(e.endTime);
            return a < debut + 45 && b > debut;
        })) return debut;
    }
    return null;
}

function devoirsAdapterJour(events, dayIndex, dateApercue) {
    if (!Array.isArray(events)) return events;
    var store = typeof devoirsLireStore === 'function' ? devoirsLireStore() : { devoirs: [], examens: [] };
    var maintenant = new Date();
    var date = dateApercue instanceof Date && !isNaN(dateApercue.getTime()) &&
        (dateApercue.getDay() + 6) % 7 === Number(dayIndex)
        ? dateApercue : devoirsDateDuJour(dayIndex);
    var cle = date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);

    /* Samedi : le cours d'économie n'existe plus, pour tous les élèves
       — même s'il n'y a ni devoir ni examen d'enregistré. */
    if (Number(dayIndex) === 5) {
        events = events.filter(function (ev) { return !devoirsEstCoursEconomie(ev); });
    }

    var devoirsJour = (store.devoirs || []).filter(function (d) { return d.date === cle; });
    var avenir = (store.examens || [])
        .map(function (e) { return { e: e, debut: devoirsInstant(e.date, e.debut), fin: devoirsInstant(e.date, e.fin) }; })
        .filter(function (x) { return x.fin.getTime() >= maintenant.getTime(); })
        .sort(function (a, b) { return a.debut - b.debut; });

    if (!devoirsJour.length && !avenir.length && !(store.devoirs || []).length) return events;
    var jour = events.slice();

    /* 1) Les devoirs du jour : la composition prend la place du créneau
       générique de l'emploi du temps — aux heures du document quand il
       en donne, sinon le créneau entier se partage entre les devoirs
       sans heures. */
    if (devoirsJour.length) {
        var creneaux = jour.filter(devoirsEstCreneauDevoir);
        if (creneaux.length) {
            jour = jour.filter(function (ev) { return !devoirsEstCreneauDevoir(ev); });
        }
        var posesDoc = [];
        devoirsJour.forEach(function (d) {
            if (!d.debut || !d.fin) return;
            jour = devoirsPoserBloc(jour, {
                id: 'devoir-' + d.id,
                titre: 'Devoir · ' + d.matiere,
                sous: 'Composition',
                debut: d.debut,
                fin: d.fin,
                icone: '📝',
                type: 'school'
            });
            posesDoc.push({ debut: d.debut, fin: d.fin });
        });
        var sansHeures = devoirsJour.filter(function (d) { return !d.debut || !d.fin; });
        var places = {};
        if (sansHeures.length && creneaux.length) {
            devoirsDecouperCreneau(creneaux, posesDoc, sansHeures).forEach(function (part) {
                places[part.d.id] = true;
                jour = devoirsPoserBloc(jour, {
                    id: 'devoir-' + part.d.id,
                    titre: 'Devoir · ' + part.d.matiere,
                    sous: 'Composition',
                    debut: devoirsM2H(part.debut),
                    fin: devoirsM2H(part.fin),
                    icone: '📝',
                    type: 'school'
                });
            });
        }
        /* Ce que le créneau de composition n'accueille pas (absent, ou trop
           court pour les devoirs qui s'y partagent) prend un moment réellement
           libre, marqué « heure à confirmer » : un devoir sans heure reste
           visible, sans recouvrir un cours. */
        sansHeures.filter(function (d) { return !places[d.id]; }).forEach(function (d) {
            var debut = devoirsTrouverHeureLibre(jour);
            if (debut == null) return;
            jour = devoirsPoserBloc(jour, {
                id: 'devoir-' + d.id, titre: 'Devoir · ' + d.matiere,
                sous: 'Heure à confirmer', debut: devoirsM2H(debut),
                fin: devoirsM2H(debut + 45), icone: '📝', type: 'school'
            });
        });

    }

    /* Le planning est recalculé pour toute la semaine, même lundi et mardi
       lorsqu'on est mercredi. Les compositions datées restent visibles
       ci-dessus, mais on n'ajoute jamais de révisions dans un jour passé. */
    var aujourdHui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
    if (date.getTime() < aujourdHui.getTime()) {
        return jour.sort(function (a, b) { return devoirsH2M(a.startTime) - devoirsH2M(b.startTime); });
    }

    if (avenir.length) {
        var premier = avenir[0].debut;
        var dernier = avenir[avenir.length - 1].fin;
        var unJour = 86400000;
        var enRevision = date.getTime() < premier.getTime() && (premier.getTime() - date.getTime()) <= 7 * unJour;
        var enSemaineExamens = date.getTime() >= new Date(premier.getFullYear(), premier.getMonth(), premier.getDate()).getTime() &&
            date.getTime() <= new Date(dernier.getFullYear(), dernier.getMonth(), dernier.getDate()).getTime();

        /* 2) Les examens du jour, à leurs heures. */
        avenir.filter(function (x) { return x.e.date === cle; }).forEach(function (x) {
            jour = devoirsPoserBloc(jour, {
                id: 'exam-' + x.e.id,
                titre: 'Examen · ' + x.e.matiere,
                sous: 'Épreuve',
                debut: x.e.debut,
                fin: x.e.fin,
                icone: '🎓',
                type: 'school'
            });
        });

        if (enRevision || enSemaineExamens) {
            /* 3) Une matière composée n'est plus révisée : ne restent que
               les épreuves dont la fin est encore devant nous. */
            var restantes = avenir.filter(function (x) {
                return x.fin.getTime() > maintenant.getTime() && devoirsExamenEnPreparation(x.e, date);
            }).map(function (x) { return x.e; });
            jour = jour.filter(function (ev) { return !devoirsBlocARetirer(ev); });
            /* Les séances de devoirs passent d'abord : celles que l'élève
               a fixées comme celles que le site programme pour lui.
               Elles se posent dans les moments libres, de plus en plus
               rapprochées vers l'échéance. */
            var seancesSemaine = [];
            var filesSemaine = [];
            var promessesSemaine = [];
            (store.devoirs || []).forEach(function (d) {
                if (d.date === cle) return;
                if (devoirsInstant(d.date, d.fin).getTime() < maintenant.getTime()) return;
                /* Pendant les semaines d'examens, le devoir que le site
                   programme se réduit à sa séance de la veille : l'épreuve
                   garde son temps. Un devoir qui tombe avant la première
                   épreuve garde son plan normal. */
                var reduit = devoirsInstant(d.date, '00:00').getTime() > premier.getTime();
                var nbChoisiS = devoirsNombreSeances(d, { reduites: reduit });
                if (!nbChoisiS) return;
                /* les séances se répartissent sur les jours AVANT le
                   devoir, de date à date : le jour du devoir lui-même
                   n'en porte pas, la veille en porte toujours */
                var joursRestantsS = devoirsJoursRestants(d);
                var repS = devoirsRepartitionSeances(nbChoisiS, joursRestantsS);
                var offS = Math.round((date.getTime() - new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()).getTime()) / 86400000);
                var nbS = repS[offS] || 0;
                var siennes = [];
                for (var sS = 0; sS < nbS; sS++) {
                    siennes.push({
                        id: 'devrev-' + d.id + '-w' + offS + '-' + sS,
                        titre: 'Révision · ' + d.matiere,
                        sous: 'Devoir le ' + devoirsJourCourt(d.date) + (d.debut ? ' à ' + d.debut : '') + ' · ' + devoirsDansXJours(d) + (nbS > 1 ? ' · séance ' + (sS + 1) + '/' + nbS : ''),
                        duree: 60,
                        icone: '📚',
                        type: 'study'
                    });
                }
                if (siennes.length) filesSemaine.push(siennes);
                if (nbS > 0) {
                    promessesSemaine.push({
                        prefix: 'devrev-' + d.id + '-w',
                        promis: nbS,
                        titre: 'Révision · ' + d.matiere,
                        matiere: d.matiere,
                        sous: 'Devoir le ' + devoirsJourCourt(d.date) + (d.debut ? ' à ' + d.debut : '') + ' · ' + devoirsDansXJours(d)
                    });
                }
            });
            /* une séance par devoir à tour de rôle : aucune matière ne
               prend tout le jour en laissant l'autre sans révision */
            seancesSemaine = devoirsEnTourDeRole(filesSemaine);
            var blocsSemaine = restantes.length ? devoirsBlocsRevisions(restantes, enRevision ? 'revision' : 'examens') : [];
            var trousSemaine = devoirsTrous(jour, devoirsReveilJour(dayIndex) + 45, devoirsCoucherJour(dayIndex) - 30);
            var posesSemaine = devoirsPoserEquilibre(seancesSemaine, blocsSemaine, trousSemaine);
            posesSemaine.forEach(function (pose) {
                jour.push({
                    id: pose.id,
                    title: pose.titre,
                    subtitle: pose.sous,
                    startTime: devoirsM2H(pose.debut),
                    endTime: devoirsM2H(pose.fin),
                    type: pose.type,
                    icon: pose.icone,
                    editable: true,
                    kind: 'pinned',
                    devoirsBloc: true
                });
            });
            devoirsGarantirSeances(jour, promessesSemaine);
            return jour.sort(function (a, b) { return devoirsH2M(a.startTime) - devoirsH2M(b.startTime); });
        }

        /* 2bis) Avant la semaine de révision intensive, seules les
           épreuves dont la fenêtre J-14 a commencé se préparent.
           L'emploi du temps habituel reste intact hors de ces fenêtres. */
        var preparables = avenir.filter(function (x) {
            return x.fin.getTime() > maintenant.getTime() && devoirsExamenEnPreparation(x.e, date);
        }).map(function (x) { return x.e; });
        if (preparables.length && !enSemaineExamens) {
            var premierPreparable = devoirsInstant(preparables[0].date, '00:00');
            var joursEcheance = Math.max(1, Math.round((premierPreparable.getTime() - date.getTime()) / 86400000));
            var budgetPrep = devoirsBudgetPreparation(joursEcheance);
            var blocsPrep = devoirsBlocsRevisions(preparables, 'preparation', { dureeRevision: budgetPrep.duree }).slice(0, budgetPrep.blocs);
            var trousPrep = devoirsTrous(jour, devoirsReveilJour(dayIndex) + 45, devoirsCoucherJour(dayIndex) - 30);
            devoirsPlacerDansTrou(blocsPrep, trousPrep).forEach(function (pose) {
                jour.push({
                    id: pose.id,
                    title: pose.titre,
                    subtitle: pose.sous,
                    startTime: devoirsM2H(pose.debut),
                    endTime: devoirsM2H(pose.fin),
                    type: pose.type,
                    icon: pose.icone,
                    editable: true,
                    kind: 'pinned',
                    devoirsBloc: true
                });
            });
        }
    }

    /* 4) Les devoirs à venir : dès l'ajout, des révisions se posent
       dans les moments libres. L'élève peut avoir choisi son nombre de
       séances : elles sont réparties jusqu'à l'échéance, la veille en
       porte toujours une. Sinon, la rampe automatique par deadline. */
    var prochains = (store.devoirs || []).filter(function (d) {
        var t = devoirsInstant(d.date, d.fin).getTime();
        return t >= maintenant.getTime() && d.date !== cle;
    }).sort(function (a, b) { return devoirsInstant(a.date, a.debut) - devoirsInstant(b.date, b.debut); });
    if (prochains.length) {
        var blocsDV = [];
        var filesDV = [];
        var matieresChoisies = {};
        var promessesDV = [];
        var offJourDV = Math.round((date.getTime() - new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()).getTime()) / 86400000);

        /* a) les séances du devoir : le chiffre choisi par l'élève, ou
           celui que le site programme pour lui (il suit l'urgence) */
        prochains.forEach(function (d) {
            var nbChoisi = devoirsNombreSeances(d);
            if (!nbChoisi) return;
            matieresChoisies[d.matiere] = 1;
            /* de date à date : le jour du devoir ne porte pas de
               séances, la veille en porte toujours — quelle que soit
               l'heure du jour où le planning se dessine */
            var joursRestants = devoirsJoursRestants(d);
            var rep = devoirsRepartitionSeances(nbChoisi, joursRestants);
            var nb = rep[offJourDV] || 0;
            var siennesDV = [];
            for (var s = 0; s < nb; s++) {
                siennesDV.push({
                    id: 'devrev-' + d.id + '-s' + offJourDV + '-' + s,
                    titre: 'Révision · ' + d.matiere,
                    sous: 'Devoir le ' + devoirsJourCourt(d.date) + (d.debut ? ' à ' + d.debut : '') + ' · ' + devoirsDansXJours(d) + (nb > 1 ? ' · séance ' + (s + 1) + '/' + nb : ''),
                    duree: 60,
                    elastique: true,
                    icone: '📚',
                    type: 'study'
                });
            }
            if (siennesDV.length) filesDV.push(siennesDV);
            if (nb > 0) {
                promessesDV.push({
                    prefix: 'devrev-' + d.id + '-',
                    promis: nb,
                    titre: 'Révision · ' + d.matiere,
                    matiere: d.matiere,
                    sous: 'Devoir le ' + devoirsJourCourt(d.date) + (d.debut ? ' à ' + d.debut : '') + ' · ' + devoirsDansXJours(d)
                });
            }
        });

        /* b) la rampe automatique pour les devoirs encore sans choix
           (l'élève n'a pas répondu à la question des séances) */
        var autoEntries = prochains.filter(function (d) { return !devoirsNombreSeances(d) && !matieresChoisies[d.matiere]; });
        var vues = {};
        var epreuvesUniques = [];
        autoEntries.forEach(function (d) {
            if (vues[d.matiere]) return;
            vues[d.matiere] = 1;
            epreuvesUniques.push(d);
        });
        if (epreuvesUniques.length) {
            var joursDevoir = Math.max(1, Math.ceil((devoirsInstant(epreuvesUniques[0].date, epreuvesUniques[0].debut).getTime() - maintenant.getTime()) / 86400000));
            var budgetDV = devoirsBudgetPreparation(joursDevoir);
            devoirsBlocsRevisions(epreuvesUniques, 'devoirs', { dureeRevision: budgetDV.duree }).slice(0, budgetDV.blocs).forEach(function (b) {
                blocsDV.push(b);
            });
        }

        /* les séances du devoir d'abord (rétrécies s'il le faut), une
           par devoir à tour de rôle, puis la rampe automatique : pose
           équilibrée sur les moments libres */
        var seancesChoisies = devoirsEnTourDeRole(filesDV).concat(blocsDV.filter(function (b) { return b.elastique; }));
        var blocsAuto = blocsDV.filter(function (b) { return !b.elastique; }).slice(0, Math.max(0, 5 - seancesChoisies.length));
        var trousDV = devoirsTrous(jour, devoirsReveilJour(dayIndex) + 45, devoirsCoucherJour(dayIndex) - 30);
        var posesDV = devoirsPoserEquilibre(seancesChoisies, blocsAuto, trousDV);
        posesDV.forEach(function (pose) {
            jour.push({
                id: pose.id,
                title: pose.titre,
                subtitle: pose.sous,
                startTime: devoirsM2H(pose.debut),
                endTime: devoirsM2H(pose.fin),
                type: pose.type,
                icon: pose.icone,
                editable: true,
                kind: 'pinned',
                devoirsBloc: true
            });
        });
        /* la rampe automatique aussi doit se poser : un bloc qui n'a pas
           tenu dans un moment libre devient une promesse */
        blocsAuto.forEach(function (b) {
            if (posesDV.some(function (p) { return p.id === b.id; })) return;
            promessesDV.push({ prefix: b.id, promis: 1, titre: b.titre, sous: b.sous, icone: b.icone });
        });
        /* ce que les moments libres n'ont pas pu accueillir prend la
           place des blocs d'étude du jour : la promesse de l'élève est
           tenue jusqu'au bout */
        devoirsGarantirSeances(jour, promessesDV);
    }

    /* la journée se lit dans l'ordre des heures : les devoirs du jour
       se posent à leur place, pas à la fin de la liste */
    jour.sort(function (a, b) { return devoirsH2M(a.startTime) - devoirsH2M(b.startTime); });
    return jour;
}
