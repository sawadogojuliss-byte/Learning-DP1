/* ============================================================
   MOTEUR Devoirs & Examens — adaptation du planning
   Le planning est un modèle de semaine ; les devoirs et les examens
   ont des dates. Chaque jour affiché reçoit la date réelle de sa
   semaine, puis :
   - un devoir devient un bloc fixe « Devoir · matière » à ses heures de
     composition, avec des heures de révision posées dans les moments où
     l'élève n'est pas en cours ;
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

function devoirsPlacerDansTrou(blocs, trous) {
    var poses = [];
    var i = 0;
    trous.forEach(function (trou) {
        var cur = trou.s;
        while (i < blocs.length && trou.e - cur >= blocs[i].duree) {
            var b = blocs[i];
            poses.push({
                id: b.id,
                titre: b.titre,
                sous: b.sous,
                debut: cur,
                fin: cur + b.duree,
                icone: b.icone,
                type: b.type
            });
            cur += b.duree + 10;
            i++;
        }
    });
    return poses;
}

function devoirsBlocsRevisions(epreuves, mode) {
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
            var duree = genre === 'Révision' ? (mode === 'examens' ? 60 : (mode === 'preparation' ? 45 : 75)) : 45;
            file.push({
                id: 'devrev-' + ep.id + '-' + c + '-' + k,
                titre: genre + ' · ' + ep.matiere,
                sous: (mode === 'examens' ? 'Épreuve le ' : 'Devoir le ') + devoirsJourCourt(ep.date) + ' à ' + ep.debut,
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

/* Le cours d'économie du samedi : pour les élèves qui préparent le bac
   national, le samedi matin appartient au bac et ce cours disparaît. */
function devoirsEstCoursEconomie(ev) {
    if (!ev) return false;
    if (ev.id === 'eco' || ev.replacesId === 'eco') return true;
    var titre = String(ev.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['\u2019]/g, ' ');
    return titre.indexOf('cours d economie') !== -1;
}

function devoirsAdapterJour(events, dayIndex) {
    if (!Array.isArray(events)) return events;
    var store = typeof devoirsLireStore === 'function' ? devoirsLireStore() : { devoirs: [], examens: [] };
    var bac = typeof devoirsFaitBac === 'function' && devoirsFaitBac();
    var maintenant = new Date();
    var date = devoirsDateDuJour(dayIndex);
    var cle = date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);

    /* Samedi du bac national : le cours d'économie du samedi cède sa
       place, même s'il n'y a ni devoir ni examen d'enregistré. */
    if (bac && Number(dayIndex) === 5) {
        events = events.filter(function (ev) { return !devoirsEstCoursEconomie(ev); });
    }

    var devoirsJour = (store.devoirs || []).filter(function (d) { return d.date === cle; });
    var avenir = (store.examens || [])
        .map(function (e) { return { e: e, debut: devoirsInstant(e.date, e.debut), fin: devoirsInstant(e.date, e.fin) }; })
        .filter(function (x) { return x.fin.getTime() >= maintenant.getTime(); })
        .sort(function (a, b) { return a.debut - b.debut; });

    if (!devoirsJour.length && !avenir.length && !(store.devoirs || []).length) return events;
    var jour = events.slice();

    /* 1) Les devoirs du jour : composition à ses heures. */
    devoirsJour.forEach(function (d) {
        jour = devoirsPoserBloc(jour, {
            id: 'devoir-' + d.id,
            titre: 'Devoir · ' + d.matiere,
            sous: 'Composition',
            debut: d.debut,
            fin: d.fin,
            icone: '📝',
            type: 'school'
        });
    });

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
            var restantes = avenir.filter(function (x) { return x.fin.getTime() > maintenant.getTime() && x.e.date !== cle; }).map(function (x) { return x.e; });
            jour = jour.filter(function (ev) { return !devoirsBlocARetirer(ev); });
            if (restantes.length) {
                var blocs = devoirsBlocsRevisions(restantes, enRevision ? 'revision' : 'examens');
                var trous = devoirsTrous(jour, devoirsReveilJour(dayIndex) + 45, devoirsCoucherJour(dayIndex) - 30);
                devoirsPlacerDansTrou(blocs, trous).forEach(function (pose) {
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
            return jour.sort(function (a, b) { return devoirsH2M(a.startTime) - devoirsH2M(b.startTime); });
        }

        /* 2bis) L'épreuve est encore loin : la préparation commence
           dès maintenant, quel que soit le jour où le planning a été
           chargé. On ne touche à rien du reste de l'emploi du temps —
           seuls deux blocs de révision se posent dans les moments
           libres, pour les épreuves les plus proches. */
        var preparables = avenir.filter(function (x) { return x.fin.getTime() > maintenant.getTime() && x.e.date !== cle; }).map(function (x) { return x.e; });
        if (preparables.length && !enSemaineExamens) {
            var blocsPrep = devoirsBlocsRevisions(preparables, 'preparation');
            var trousPrep = devoirsTrous(jour, devoirsReveilJour(dayIndex) + 45, devoirsCoucherJour(dayIndex) - 30);
            devoirsPlacerDansTrou(blocsPrep, trousPrep).slice(0, 2).forEach(function (pose) {
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
       dans les moments libres (plus seulement la veille). */
    var prochains = (store.devoirs || []).filter(function (d) {
        var t = devoirsInstant(d.date, d.fin).getTime();
        return t >= maintenant.getTime() && d.date !== cle;
    }).sort(function (a, b) { return devoirsInstant(a.date, a.debut) - devoirsInstant(b.date, b.debut); });
    if (prochains.length) {
        var vues = {};
        var epreuvesUniques = [];
        prochains.forEach(function (d) {
            if (vues[d.matiere]) return;
            vues[d.matiere] = 1;
            epreuvesUniques.push(d);
        });
        var blocsDV = devoirsBlocsRevisions(epreuvesUniques, 'devoirs');
        var trousDV = devoirsTrous(jour, devoirsReveilJour(dayIndex) + 45, devoirsCoucherJour(dayIndex) - 30);
        var posesDV = devoirsPlacerDansTrou(blocsDV, trousDV).slice(0, 2);
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
        jour.sort(function (a, b) { return devoirsH2M(a.startTime) - devoirsH2M(b.startTime); });
    }

    return jour;
}
