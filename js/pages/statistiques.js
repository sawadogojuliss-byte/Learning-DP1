/* ============================================================
   STATISTIQUES du minuteur — Paramètres > Statistiques

   Les chiffres viennent des minuteurs de révision :
   chaque concentration ou pause qui se termine, chaque lancement,
   chaque tâche cochée est notée dans studyPlanIB_statsFocus.
   Le journal est inclus dans la progression du compte connecté.

   Types d'entrées :
     lance    : une concentration démarrée à zéro
     focus    : une concentration terminée (m = minutes, s = séance liée)
     short    : une pause courte terminée (m = minutes)
     long     : une pause longue terminée (m = minutes)
     tache    : une tâche cochée (id = identifiant de la tâche)
   Ordre des scripts : avant pomodoro-page.js dans js/registre.js.
   ============================================================ */

var STATS_CLE = 'studyPlanIB_statsFocus';
var STATS_MAX = 6000;
var STATS_TYPES = ['lance', 'focus', 'short', 'long', 'tache'];
var STATS_PERIODES = [
    { id: 'jour', nom: "Aujourd'hui" },
    { id: 'semaine', nom: 'Semaine' },
    { id: 'mois', nom: 'Mois' },
    { id: 'trois', nom: '3 mois' },
    { id: 'six', nom: '6 mois' },
    { id: 'annee', nom: '1 an' },
    { id: 'tout', nom: 'Tout' }
];
var STATS_JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
var STATS_MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
var statsPeriodeChoisie = 'jour';

/* Date locale au format AAAA-MM-JJ (comparable par ordre alphabétique). */
function statsCleJour(date) {
    var mois = String(date.getMonth() + 1);
    var jour = String(date.getDate());
    return date.getFullYear() + '-' + (mois.length < 2 ? '0' : '') + mois + '-' + (jour.length < 2 ? '0' : '') + jour;
}

function statsLire() {
    var brut = [];
    try { brut = typeof syncStatsLire === 'function' ? syncStatsLire() : JSON.parse(localStorage.getItem(STATS_CLE) || '[]'); } catch (e) { brut = []; }
    if (!Array.isArray(brut)) return [];
    return brut.filter(function (e) {
        return e && typeof e === 'object' && !e.supprime
            && /^\d{4}-\d{2}-\d{2}$/.test(String(e.d || ''))
            && STATS_TYPES.indexOf(e.k) !== -1;
    });
}

function statsEcrire(liste) {
    try { localStorage.setItem(STATS_CLE, JSON.stringify(liste.slice(-STATS_MAX))); } catch (e) {}
}

function statsEnregistrer(evt) {
    if (!evt || STATS_TYPES.indexOf(evt.k) === -1) return;
    var liste = typeof syncStatsLire === 'function' ? syncStatsLire() : statsLire();
    var entree = { k: evt.k, d: statsCleJour(new Date()) };
    if (typeof syncStatsId === 'function') entree.u = syncStatsId();
    if (evt.m) entree.m = Math.max(1, Math.round(Number(evt.m) || 0));
    if (evt.s) entree.s = String(evt.s).slice(0, 60);
    if (evt.id !== undefined && evt.id !== null) entree.id = String(evt.id).slice(0, 60);
    liste.push(entree);
    statsEcrire(liste);
    if (typeof memoireSauvegarder === 'function') memoireSauvegarder();
}

/* Une tâche décochée n'est plus comptée : on retire sa dernière coche. */
function statsRetirerTache(id) {
    var liste = typeof syncStatsLire === 'function' ? syncStatsLire() : statsLire();
    var texte = String(id);
    for (var i = liste.length - 1; i >= 0; i--) {
        if (liste[i].k === 'tache' && liste[i].id === texte && !liste[i].supprime) {
            if (liste[i].u) liste[i].supprime = true;
            else liste.splice(i, 1);
            statsEcrire(liste);
            if (typeof memoireSauvegarder === 'function') memoireSauvegarder();
            return;
        }
    }
}

/* Premier jour (AAAA-MM-JJ) de la période choisie, '' pour « Tout ». */
function statsDebut(periode, maintenant) {
    var d = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
    if (periode === 'jour') return statsCleJour(d);
    if (periode === 'semaine') {
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return statsCleJour(d);
    }
    if (periode === 'mois') return statsCleJour(new Date(d.getFullYear(), d.getMonth(), 1));
    if (periode === 'trois') d.setMonth(d.getMonth() - 3);
    else if (periode === 'six') d.setMonth(d.getMonth() - 6);
    else if (periode === 'annee') d.setFullYear(d.getFullYear() - 1);
    else return '';
    return statsCleJour(d);
}

/* Totaux de la période. Le score : part des concentrations lancées
   qui ont été menées jusqu'à la fin (100 % au maximum). */
function statsResume(periode, maintenant, liste) {
    var debut = statsDebut(periode, maintenant);
    var fin = statsCleJour(maintenant);
    var r = { minutesFocus: 0, minuteurs: 0, minutesPause: 0, pauses: 0, lances: 0, taches: 0, score: null };
    (liste || []).forEach(function (e) {
        if (e.d < debut || e.d > fin) return;
        if (e.k === 'focus') { r.minuteurs += 1; r.minutesFocus += e.m || 0; }
        else if (e.k === 'short' || e.k === 'long') { r.pauses += 1; r.minutesPause += e.m || 0; }
        else if (e.k === 'lance') r.lances += 1;
        else if (e.k === 'tache') r.taches += 1;
    });
    if (r.lances > 0) r.score = Math.min(100, Math.round(100 * r.minuteurs / r.lances));
    return r;
}

/* Les 7 jours de la semaine en cours (lundi → dimanche). */
function statsSemaine(maintenant, liste) {
    var aujourdhui = statsCleJour(maintenant);
    var lundi = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
    lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
    var jours = [];
    var index = {};
    for (var i = 0; i < 7; i++) {
        var d = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + i);
        var cle = statsCleJour(d);
        index[cle] = i;
        jours.push({ cle: cle, nom: STATS_JOURS[i], numero: d.getDate(), mois: STATS_MOIS[d.getMonth()],
            minutes: 0, minuteurs: 0, aujourdhui: cle === aujourdhui, futur: cle > aujourdhui });
    }
    (liste || []).forEach(function (e) {
        if (e.k !== 'focus' || index[e.d] === undefined) return;
        jours[index[e.d]].minutes += e.m || 0;
        jours[index[e.d]].minuteurs += 1;
    });
    return jours;
}

/* Durée lisible : « 25 min », « 1 h », « 1 h 20 ». */
function statsDuree(minutes) {
    var total = Math.max(0, Math.round(Number(minutes) || 0));
    var h = Math.floor(total / 60);
    var m = total % 60;
    if (h > 0 && m > 0) return h + ' h ' + (m < 10 ? '0' : '') + m;
    if (h > 0) return h + ' h';
    return total + ' min';
}

function statsPeindreCartes(resume, serie) {
    var conteneur = document.getElementById('statsCartes');
    if (!conteneur) return;
    var cartes = [
        { classe: 'stats-carte-serie', titre: 'Série actuelle', icone: 'M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z',
          valeur: serie + (serie > 1 ? ' jours' : ' jour'), detail: "jours d'affilée" },
        { classe: 'stats-carte-focus', titre: 'Temps de concentration', icone: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
          valeur: statsDuree(resume.minutesFocus), detail: resume.minuteurs + (resume.minuteurs > 1 ? ' minuteurs terminés' : ' minuteur terminé') },
        { classe: 'stats-carte-score', titre: 'Score de concentration', icone: 'M12 3a6 6 0 0 0-3 11.2V17h6v-2.8A6 6 0 0 0 12 3zM9 20h6',
          valeur: resume.score === null ? '–' : resume.score + ' %', detail: 'minuteurs menés jusqu’au bout' },
        { classe: 'stats-carte-taches', titre: 'Tâches terminées', icone: 'M5 12l4 4 10-10',
          valeur: String(resume.taches), detail: 'cochées dans Tâches' },
        { classe: 'stats-carte-minuteurs', titre: 'Minuteurs lancés', icone: 'M12 6v6l4 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
          valeur: String(resume.lances), detail: resume.minuteurs + ' terminés' },
        { classe: 'stats-carte-pause', titre: 'Temps de pause', icone: 'M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9zM16 10h2a2 2 0 0 1 0 4h-2',
          valeur: statsDuree(resume.minutesPause), detail: resume.pauses + (resume.pauses > 1 ? ' pauses' : ' pause') }
    ];
    conteneur.textContent = '';
    cartes.forEach(function (c) {
        var carte = document.createElement('div');
        carte.className = 'stats-carte ' + c.classe;

        var haut = document.createElement('div');
        haut.className = 'stats-carte-haut';
        var titre = document.createElement('span');
        titre.textContent = c.titre;
        haut.appendChild(titre);
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('aria-hidden', 'true');
        var chemin = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        chemin.setAttribute('d', c.icone);
        chemin.setAttribute('stroke', 'currentColor');
        chemin.setAttribute('stroke-width', '2');
        chemin.setAttribute('stroke-linecap', 'round');
        chemin.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(chemin);
        haut.appendChild(svg);
        carte.appendChild(haut);

        var valeur = document.createElement('p');
        valeur.className = 'stats-valeur';
        valeur.textContent = c.valeur;
        carte.appendChild(valeur);

        var detail = document.createElement('p');
        detail.className = 'stats-detail';
        detail.textContent = c.detail;
        carte.appendChild(detail);

        conteneur.appendChild(carte);
    });
}

/* Courbe lissée des minuteurs de concentration par jour de la semaine.
   Graphique compact : une zone dégradée sous la ligne, un point par jour passé,
   le jour en cours mis en valeur. Les jours à venir n'ont pas de point. */
var STATS_COURBE = { pas: 100, haut: 14, base: 104, largeur: 700, hauteur: 118 };

function statsCourbeY(y) {
    return Math.min(STATS_COURBE.base, Math.max(STATS_COURBE.haut, y));
}

/* Trajet lissé (Catmull-Rom converti en Bézier), borné entre le haut et la base. */
function statsTrajet(points) {
    var d = 'M' + points[0].x.toFixed(1) + ' ' + points[0].y.toFixed(1);
    for (var i = 0; i < points.length - 1; i++) {
        var p0 = points[i > 0 ? i - 1 : i];
        var p1 = points[i];
        var p2 = points[i + 1];
        var p3 = points[i + 2 < points.length ? i + 2 : i + 1];
        var c1x = p1.x + (p2.x - p0.x) / 6;
        var c1y = statsCourbeY(p1.y + (p2.y - p0.y) / 6);
        var c2x = p2.x - (p3.x - p1.x) / 6;
        var c2y = statsCourbeY(p2.y - (p3.y - p1.y) / 6);
        d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
    }
    return d;
}

function statsSvg(nom, attributs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', nom);
    Object.keys(attributs || {}).forEach(function (cle) { el.setAttribute(cle, String(attributs[cle])); });
    return el;
}

/* Calendrier : 7 colonnes égales. Les valeurs (en haut), la courbe et les jours (en bas)
   utilisent la même grille, donc chaque valeur tombe exactement au-dessus de son jour. */
function statsPeindreSemaine(jours) {
    var conteneur = document.getElementById('statsSemaine');
    if (!conteneur) return;
    var c = STATS_COURBE;
    var maximum = 0;
    jours.forEach(function (j) { if (!j.futur && j.minutes > maximum) maximum = j.minutes; });

    conteneur.textContent = '';
    var titre = document.createElement('p');
    titre.className = 'stats-semaine-titre';
    titre.textContent = 'Calendrier de concentration hebdomadaire';
    conteneur.appendChild(titre);

    var sous = document.createElement('p');
    sous.className = 'stats-semaine-sous';
    var premier = jours[0];
    var dernier = jours[6];
    sous.textContent = 'Cette semaine, du ' + premier.numero + ' ' + premier.mois + ' au ' + dernier.numero + ' ' + dernier.mois;
    conteneur.appendChild(sous);

    var zone = document.createElement('div');
    zone.className = 'stats-courbe-zone';

    /* Ligne des valeurs, en haut de chaque colonne. */
    var lignePlus = document.createElement('div');
    lignePlus.className = 'stats-courbe-valeurs';
    jours.forEach(function (j) {
        var v = document.createElement('span');
        v.className = 'stats-courbe-valeur' + (j.aujourdhui ? ' is-aujourdhui' : '') + (j.futur ? ' is-futur' : '');
        if (!j.futur) v.textContent = statsDuree(j.minutes);
        lignePlus.appendChild(v);
    });
    zone.appendChild(lignePlus);

    /* Centre de la colonne i : pas * i + pas / 2. */
    var points = jours.map(function (j, i) {
        var y = maximum > 0 ? c.base - (j.minutes / maximum) * (c.base - c.haut) : c.base;
        return { x: c.pas * i + c.pas / 2, y: y, j: j };
    });
    var passes = points.filter(function (p) { return !p.j.futur; });
    var resume = jours.map(function (j) { return j.nom + ' ' + statsDuree(j.minutes); }).join(', ');

    var svg = statsSvg('svg', { viewBox: '0 0 ' + c.largeur + ' ' + c.hauteur, class: 'stats-courbe', role: 'img',
        'aria-label': 'Concentration par jour : ' + resume });
    var defs = statsSvg('defs');
    var degrade = statsSvg('linearGradient', { id: 'statsAire', x1: '0', y1: '0', x2: '0', y2: '1' });
    degrade.appendChild(statsSvg('stop', { offset: '0%', 'stop-color': '#6ee7b7', 'stop-opacity': '0.5' }));
    degrade.appendChild(statsSvg('stop', { offset: '100%', 'stop-color': '#6ee7b7', 'stop-opacity': '0' }));
    defs.appendChild(degrade);
    svg.appendChild(defs);

    if (passes.length > 1) {
        var trajet = statsTrajet(passes);
        var dernierX = passes[passes.length - 1].x;
        var premierX = passes[0].x;
        svg.appendChild(statsSvg('path', { d: trajet + ' L' + dernierX + ' ' + c.base + ' L' + premierX + ' ' + c.base + ' Z',
            fill: 'url(#statsAire)' }));
        svg.appendChild(statsSvg('path', { d: trajet, fill: 'none', stroke: '#6ee7b7', 'stroke-width': '2.5',
            'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    }

    passes.forEach(function (p) {
        svg.appendChild(statsSvg('circle', { cx: p.x, cy: p.y, r: p.j.aujourdhui ? '5' : '4', fill: '#6ee7b7' }));
    });

    zone.appendChild(svg);

    /* Jours de la semaine, en bas, une colonne par jour. */
    var ligneJours = document.createElement('div');
    ligneJours.className = 'stats-courbe-jours';
    jours.forEach(function (j) {
        var nom = document.createElement('span');
        nom.className = (j.aujourdhui ? 'is-aujourdhui' : '') + (j.futur ? ' is-futur' : '');
        nom.textContent = j.nom;
        ligneJours.appendChild(nom);
    });
    zone.appendChild(ligneJours);

    conteneur.appendChild(zone);
}

function statsPeindrePeriodes() {
    var conteneur = document.getElementById('statsPeriodes');
    if (!conteneur) return;
    conteneur.textContent = '';
    STATS_PERIODES.forEach(function (p) {
        var bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'focus-filtre' + (p.id === statsPeriodeChoisie ? ' is-on' : '');
        bouton.setAttribute('aria-pressed', p.id === statsPeriodeChoisie ? 'true' : 'false');
        bouton.textContent = p.nom;
        bouton.onclick = function () { statsChoisirPeriode(p.id); };
        conteneur.appendChild(bouton);
    });
}

function statsChoisirPeriode(id) {
    if (!STATS_PERIODES.some(function (p) { return p.id === id; })) return;
    statsPeriodeChoisie = id;
    statsPeindre();
}

/* Peint toute la rubrique. Appelée à l'ouverture de l'onglet et au choix de période. */
function statsPeindre() {
    if (!document.getElementById('statsCartes')) return;
    var maintenant = new Date();
    var liste = statsLire();
    var resume = statsResume(statsPeriodeChoisie, maintenant, liste);
    var serie = 0;
    try { serie = typeof boiteFlammes === 'function' ? boiteFlammes() : parseInt(localStorage.getItem('studyPlanIB_flamme') || '0', 10); } catch (e) { serie = 0; }
    if (!isFinite(serie) || serie < 0) serie = 0;

    statsPeindrePeriodes();
    statsPeindreCartes(resume, serie);
    statsPeindreSemaine(statsSemaine(maintenant, liste));

    var vide = document.getElementById('statsVide');
    if (vide) vide.hidden = resume.minuteurs + resume.lances + resume.taches > 0;
}
