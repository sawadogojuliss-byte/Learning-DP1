/* ============================================================
   Paramètres du minuteur et de la séance de révision — Studyplan
   Pages : pages/pomodoro.html et pages/seances.html
   Un bouton-roue ouvre un menu latéral : Thèmes, Horloge, Minuteur,
   Citations, Voix. Chaque rubrique a sa page, avec des tuiles qui
   montrent le résultat (photo d'aperçu : images/pomodoro/lumiere.webp).
   Réglages gardés sur cet appareil : localStorage « studyPlanIB_minuteurParametres »
   (la clé « studyPlanIB_focusReglages » appartient à js/synchro.js).
   Chargé après js/pages/pomodoro-page.js.
   ============================================================ */

/* Citations en français, classées par catégorie. Aucun point final.
   Les auteurs viennent de recueils de citations ; certaines attributions sont anonymes. */
var FOCUS_CATEGORIES_CITATIONS = [
    { id: 'toutes', nom: 'Toutes les citations' },
    { id: 'motivation', nom: 'Motivation' },
    { id: 'inspiration', nom: 'Inspiration' },
    { id: 'bien-etre', nom: 'Bien-être' }
];

/* Citations courtes, simples, sans point final. « a » = auteur (non affiché). */
var FOCUS_CITATIONS = {
    'motivation': [
        { t: "Le succès, c’est de petits efforts répétés chaque jour", a: "Robert Collier" },
        { t: "Un voyage de mille lieues commence par un premier pas", a: "Lao Tseu" },
        { t: "Le secret pour avancer, c’est de commencer", a: "Mark Twain" },
        { t: "Le hasard ne favorise que les esprits préparés", a: "Louis Pasteur" },
        { t: "Le travail éloigne l’ennui, le vice et le besoin", a: "Voltaire" },
        { t: "Un jour après l’autre, tu avances", a: "Anonyme" },
        { t: "Fais-le maintenant, tu te remercieras plus tard", a: "Anonyme" }
    ],
    'inspiration': [
        { t: "L’essentiel est invisible pour les yeux", a: "Antoine de Saint-Exupéry" },
        { t: "Tous nos rêves peuvent devenir réalité", a: "Walt Disney" },
        { t: "La meilleure façon de prédire l’avenir, c’est de le créer", a: "Peter Drucker" },
        { t: "Ce sont nos choix qui révèlent qui nous sommes", a: "J. K. Rowling" },
        { t: "Au milieu de l’hiver, j’apprenais qu’il y avait en moi un été invincible", a: "Albert Camus" },
        { t: "Chaque petit pas te rapproche de ton but", a: "Anonyme" }
    ],
    'bien-etre': [
        { t: "Prendre soin de soi n’est pas de l’égoïsme", a: "Audre Lorde" },
        { t: "Le bien-être est un chemin, pas une destination", a: "Wayne Dyer" },
        { t: "Un esprit sain dans un corps sain", a: "Juvénal" },
        { t: "Se connaître soi-même est le début de la sagesse", a: "Aristote" },
        { t: "Repose-toi, tu en as besoin", a: "Anonyme" },
        { t: "Respire, tu fais de ton mieux", a: "Anonyme" }
    ]
};

var FOCUS_STYLES_TEMPS = [
    { id: 'defaut', nom: 'Par défaut' },
    { id: 'horloge', nom: 'Horloge à palettes' },
    { id: 'barre', nom: 'Barre de progression' },
    { id: 'jauge', nom: 'Jauge' },
    { id: 'matrice', nom: 'Matrice de points' },
    { id: 'camembert', nom: 'Camembert' }
];

/* Chaque police : Degular (poids, italique, espacement) ou, à défaut,
   une police du système. Voir css/pages/focus-parametres.css. */
var FOCUS_POLICES = [
    { id: 'gras', nom: 'Gras par défaut' },
    { id: 'leger', nom: 'Léger par défaut' },
    { id: 'doux', nom: 'Doux' },
    { id: 'bulle', nom: 'Bulle' },
    { id: 'minimal-leger', nom: 'Minimal léger' },
    { id: 'minimal', nom: 'Minimal' },
    { id: 'serif', nom: 'Serif' },
    { id: 'serif-condense', nom: 'Serif condensé' },
    { id: 'sportif', nom: 'Sportif' },
    { id: 'large', nom: 'Très large' },
    { id: 'digital', nom: 'Digital' },
    { id: 'manuscrite', nom: 'Manuscrite' }
];

var FOCUS_TAILLES = [
    { id: 'petite', nom: 'Petite' },
    { id: 'normale', nom: 'Normale' },
    { id: 'grande', nom: 'Grande' }
];

var FOCUS_ONGLETS = ['themes', 'horloge', 'minuteur', 'citations', 'voix', 'statistiques'];

var FOCUS_REGLAGES_CLE = 'studyPlanIB_minuteurParametres';
var FOCUS_CERCLE = 2 * Math.PI * 45;
var FOCUS_POINTS = 24;
var focusReglagesVus = null;
var focusOngletCourant = 'horloge';

/* Aperçus en mini-dessins, dans les tuiles de style (contenu fixe). */
var FOCUS_MINI = {
    defaut: '<span class="focus-mini-texte">25:00</span>',
    horloge: '<span class="focus-mini-flip"><b>2</b><b>5</b><b>0</b><b>0</b></span>',
    barre: '<span class="focus-mini-texte">25:00</span><span class="focus-mini-barre"><i></i></span>',
    jauge: '<svg class="focus-mini-jauge" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" class="focus-mini-anneau-fond"/><circle cx="20" cy="20" r="16" class="focus-mini-anneau" transform="rotate(-90 20 20)" stroke-dasharray="100.5" stroke-dashoffset="20"/></svg>',
    matrice: '<span class="focus-mini-matrice">' + new Array(FOCUS_POINTS).join('<i></i>') + '<i></i></span>',
    camembert: '<svg class="focus-mini-camembert" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" class="focus-camembert-fond"/><path d="' + focusSecteur(0.62) + '" class="focus-mini-secteur"/></svg>'
};

function focusNormaliserReglages(brut) {
    var b = brut || {};
    function dans(liste, valeur, defaut) {
        for (var i = 0; i < liste.length; i++) if (liste[i].id === valeur) return valeur;
        return defaut;
    }
    return {
        style: dans(FOCUS_STYLES_TEMPS, b.style, 'defaut'),
        barre: b.barre === true,
        notif: b.notif === true,
        auto: b.auto === true,
        citation: b.citation !== false,
        citationCategorie: dans(FOCUS_CATEGORIES_CITATIONS, b.citationCategorie, 'toutes'),
        police: dans(FOCUS_POLICES, b.police, 'gras'),
        taille: dans(FOCUS_TAILLES, b.taille, 'normale'),
        compteur: dans(FOCUS_COMPTEURS, b.compteur, 'points')
    };
}

function focusLireReglages() {
    if (focusReglagesVus) return focusReglagesVus;
    var brut = null;
    try { brut = JSON.parse(localStorage.getItem(FOCUS_REGLAGES_CLE) || 'null'); } catch (e) { brut = null; }
    focusReglagesVus = focusNormaliserReglages(brut);
    return focusReglagesVus;
}

function focusEcrireReglages(reglages) {
    focusReglagesVus = focusNormaliserReglages(reglages);
    try { localStorage.setItem(FOCUS_REGLAGES_CLE, JSON.stringify(focusReglagesVus)); } catch (e) {}
}

/* Change un seul réglage et garde les autres. */
function focusMajReglage(cle, valeur) {
    var copie = {};
    var r = focusLireReglages();
    Object.keys(r).forEach(function (k) { copie[k] = r[k]; });
    copie[cle] = valeur;
    focusEcrireReglages(copie);
}

/* Citations d'une catégorie (« toutes » = toutes les catégories réunies). */
function focusCitationsDeCategorie(categorie) {
    if (categorie !== 'toutes' && FOCUS_CITATIONS[categorie]) return FOCUS_CITATIONS[categorie];
    var tout = [];
    FOCUS_CATEGORIES_CITATIONS.forEach(function (c) {
        if (c.id !== 'toutes' && FOCUS_CITATIONS[c.id]) tout = tout.concat(FOCUS_CITATIONS[c.id]);
    });
    return tout;
}

/* Une citation par jour dans la catégorie choisie : la même toute la journée, une autre le lendemain.
   Affichée entre guillemets courbes, sans point final. */
function focusCitationDuJour(date) {
    var d = date || new Date();
    var debut = new Date(d.getFullYear(), 0, 0);
    var jour = Math.floor((d - debut) / 86400000);
    var liste = focusCitationsDeCategorie(focusLireReglages().citationCategorie);
    var citation = liste[jour % liste.length];
    return '\u201C' + citation.t.replace(/\.\s*$/, '') + '\u201D';
}

/* Remplit la liste déroulante des catégories et affiche le choix courant. */
function focusPeindreCategorieCitation(r) {
    var sel = document.getElementById('focusCategorieCitation');
    if (!sel) return;
    if (!sel.options.length) {
        FOCUS_CATEGORIES_CITATIONS.forEach(function (c) {
            var o = document.createElement('option');
            o.value = c.id;
            o.textContent = c.nom;
            sel.appendChild(o);
        });
    }
    if (sel.value !== r.citationCategorie) sel.value = r.citationCategorie;
}

/* Choix de la catégorie depuis la liste déroulante. */
function focusChoisirCategorieCitation(categorie) {
    focusMajReglage('citationCategorie', categorie);
    focusPeindre();
}

function focusPeindreCitation() {
    var texte = focusCitationDuJour();
    var visible = focusLireReglages().citation;
    ['focusCitation'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        if (el.textContent !== texte) el.textContent = texte;
        if (el.hidden !== !visible) el.hidden = !visible;
    });
}

/* Construit une fois les tuiles de chaque rubrique. contenu(item, i) renvoie
   du HTML fixe (jamais de texte saisi par l'élève). */
function focusRemplirGrille(id, liste, cle, classeItem, contenu, surClic) {
    var conteneur = document.getElementById(id);
    if (!conteneur || conteneur.getAttribute('data-pret') === '1') return;
    conteneur.setAttribute('data-pret', '1');
    liste.forEach(function (item, i) {
        var bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'focus-tuile' + (classeItem ? ' ' + classeItem(item) : '');
        bouton.setAttribute('data-' + cle, String(item.id !== undefined ? item.id : i));
        bouton.setAttribute('aria-pressed', 'false');
        bouton.innerHTML = contenu(item, i);
        bouton.onclick = function () {
            if (surClic) surClic(item, i);
            else focusChoisirReglage(cle, item.id);
        };
        conteneur.appendChild(bouton);
    });
}

function focusTuileNom(nom) {
    return '<span class="focus-tuile-nom">' + nom + '</span>';
}

/* ── Thèmes : catégories ─────────────────────────────────────────
   « Tout » affiche une rangée par catégorie, à faire défiler à la main.
   Une catégorie affiche sa grille. Une catégorie sans photo n'apparaît pas. */
var FOCUS_CATEGORIES_FONDS = [
    { id: 'tout', nom: 'Tout' },
    { id: 'degrades', nom: 'Dégradés et couleurs' },
    { id: 'abstrait', nom: 'Abstrait' },
    { id: 'paysages', nom: 'Paysages' },
    { id: 'nature', nom: 'Nature' },
    { id: 'urbain', nom: 'Urbain' },
    { id: 'interieur', nom: 'Intérieur' },
    { id: 'anime', nom: 'Animé' }
];
var focusCategorieFonds = 'tout';

function focusCategoriesFondsPresentes() {
    return FOCUS_CATEGORIES_FONDS.filter(function (c) {
        return c.id === 'tout' || FOCUS_FONDS.some(function (f) { return f.cat === c.id; });
    });
}

function focusNomCategorieFonds(id) {
    for (var i = 0; i < FOCUS_CATEGORIES_FONDS.length; i++) {
        if (FOCUS_CATEGORIES_FONDS[i].id === id) return FOCUS_CATEGORIES_FONDS[i].nom;
    }
    return '';
}

function focusTuileTheme(item, index) {
    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'focus-tuile focus-tuile-theme';
    bouton.setAttribute('data-index', String(index));
    bouton.setAttribute('aria-pressed', 'false');
    bouton.innerHTML = '<span class="focus-tuile-image focus-tuile-photo" style="background-image:url(\'' + item.mini + '\')"></span>' + focusTuileNom(item.nom);
    bouton.onclick = function () {
        if (typeof focusPoserFond === 'function') focusPoserFond(index);
        focusPeindreParametres();
    };
    return bouton;
}

function focusChoisirCategorieFonds(id) {
    focusCategorieFonds = id;
    focusConstruireThemes();
    var haut = document.getElementById('focusFiltresFonds');
    if (haut && haut.scrollIntoView) haut.scrollIntoView({ block: 'nearest' });
}

function focusConstruireThemes() {
    var filtres = document.getElementById('focusFiltresFonds');
    var corps = document.getElementById('focusThemesCorps');
    if (!filtres || !corps) return;

    if (filtres.getAttribute('data-pret') !== '1') {
        filtres.setAttribute('data-pret', '1');
        focusCategoriesFondsPresentes().forEach(function (c) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'focus-filtre';
            b.setAttribute('data-cat', c.id);
            b.setAttribute('aria-pressed', 'false');
            b.textContent = c.nom;
            b.onclick = function () { focusChoisirCategorieFonds(c.id); };
            filtres.appendChild(b);
        });
    }

    /* on ne reconstruit la zone que si la catégorie change : le défilement reste en place */
    if (corps.getAttribute('data-vue') !== focusCategorieFonds) {
        corps.setAttribute('data-vue', focusCategorieFonds);
        corps.innerHTML = '';
        if (focusCategorieFonds === 'tout') {
            focusCategoriesFondsPresentes().forEach(function (c) {
                if (c.id === 'tout') return;
                var photos = [];
                FOCUS_FONDS.forEach(function (f, i) { if (f.cat === c.id) photos.push({ f: f, i: i }); });
                if (!photos.length) return;
                var section = document.createElement('section');
                section.className = 'focus-rangee';
                var tete = document.createElement('div');
                tete.className = 'focus-rangee-tete';
                var titre = document.createElement('h4');
                titre.textContent = c.nom;
                var voir = document.createElement('button');
                voir.type = 'button';
                voir.className = 'focus-voirtout';
                voir.textContent = 'Voir tout (' + photos.length + ')';
                voir.onclick = (function (id) { return function () { focusChoisirCategorieFonds(id); }; })(c.id);
                tete.appendChild(titre);
                tete.appendChild(voir);
                var defile = document.createElement('div');
                defile.className = 'focus-rangee-defile';
                photos.forEach(function (p) { defile.appendChild(focusTuileTheme(p.f, p.i)); });
                section.appendChild(tete);
                section.appendChild(defile);
                corps.appendChild(section);
            });
        } else {
            var titre2 = document.createElement('h4');
            titre2.className = 'focus-rangee-titre';
            titre2.textContent = focusNomCategorieFonds(focusCategorieFonds);
            var grille = document.createElement('div');
            grille.className = 'focus-grille-tuiles focus-grille-fonds';
            FOCUS_FONDS.forEach(function (f, i) { if (f.cat === focusCategorieFonds) grille.appendChild(focusTuileTheme(f, i)); });
            corps.appendChild(titre2);
            corps.appendChild(grille);
        }
    }
    focusMarquerThemes();
}

/* Met en évidence la catégorie choisie et le thème actif. */
function focusMarquerThemes() {
    var filtres = document.querySelectorAll('#focusFiltresFonds .focus-filtre');
    for (var k = 0; k < filtres.length; k++) {
        var actif = filtres[k].getAttribute('data-cat') === focusCategorieFonds;
        filtres[k].classList.toggle('is-on', actif);
        filtres[k].setAttribute('aria-pressed', String(actif));
    }
    if (typeof focusEtat === 'undefined') return;
    var tuiles = document.querySelectorAll('#focusThemesCorps [data-index]');
    for (var t = 0; t < tuiles.length; t++) {
        var on = Number(tuiles[t].getAttribute('data-index')) === focusEtat.fond;
        tuiles[t].classList.toggle('is-on', on);
        tuiles[t].setAttribute('aria-pressed', String(on));
    }
}

function focusConstruireChoix() {
    focusRemplirGrille('focusChoixTaille', FOCUS_TAILLES, 'taille', null, function (item) {
        return '<span class="focus-tuile-image"><span class="focus-tuile-texte focus-tuile-taille-' + item.id + '">2:24</span></span>' + focusTuileNom(item.nom);
    });
    focusRemplirGrille('focusChoixPolice', FOCUS_POLICES, 'police', function (p) { return 'focus-police-' + p.id; }, function (item) {
        return '<span class="focus-tuile-image"><span class="focus-tuile-texte">12:24</span></span>' + focusTuileNom(item.nom);
    });
    if (typeof FOCUS_COMPTEURS !== 'undefined' && typeof focusCompteurTuile === 'function') {
        focusRemplirGrille('focusCompteurStatique', FOCUS_COMPTEURS.filter(function (c) { return c.groupe === 'statique'; }), 'compteur', null, focusCompteurTuile);
        focusRemplirGrille('focusCompteurDynamique', FOCUS_COMPTEURS.filter(function (c) { return c.groupe === 'dynamique'; }), 'compteur', null, focusCompteurTuile);
    }
    focusRemplirGrille('focusChoixStyle', FOCUS_STYLES_TEMPS, 'style', null, function (item) {
        return '<span class="focus-tuile-image focus-tuile-miniature">' + FOCUS_MINI[item.id] + '</span>' + focusTuileNom(item.nom);
    });
    if (typeof FOCUS_FONDS !== 'undefined') focusConstruireThemes();
}

function focusMarquerChoix(id, cle, valeur) {
    var conteneur = document.getElementById(id);
    if (!conteneur) return;
    var boutons = conteneur.querySelectorAll('button');
    for (var i = 0; i < boutons.length; i++) {
        var actif = boutons[i].getAttribute('data-' + cle) === valeur;
        boutons[i].classList.toggle('is-on', actif);
        boutons[i].setAttribute('aria-pressed', String(actif));
    }
}

/* Affiche la rubrique choisie dans le menu latéral. */
function focusChoisirOnglet(id) {
    if (FOCUS_ONGLETS.indexOf(id) === -1) return;
    focusOngletCourant = id;
    focusAfficherOnglet();
}

function focusAfficherOnglet() {
    if (focusOngletCourant === 'statistiques' && typeof statsPeindre === 'function') statsPeindre();
    FOCUS_ONGLETS.forEach(function (id) {
        var page = document.querySelector('#focusReglages [data-page="' + id + '"]');
        if (page && page.hidden !== (id !== focusOngletCourant)) page.hidden = id !== focusOngletCourant;
        var item = document.querySelector('#focusReglages [data-onglet="' + id + '"]');
        if (item) {
            var actif = id === focusOngletCourant;
            item.classList.toggle('is-on', actif);
            if (actif) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
        }
    });
}

/* Peint tout ce qui dépend des réglages. Appelé à chaque affichage du minuteur. */
function focusPeindreParametres() {
    focusConstruireChoix();
    var r = focusLireReglages();

    ['focusPage', 'focusAccueil'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        FOCUS_POLICES.forEach(function (p) { el.classList.toggle('focus-police-' + p.id, p.id === r.police); });
        FOCUS_TAILLES.forEach(function (t) { el.classList.toggle('focus-taille-' + t.id, t.id === r.taille); });
    });

    focusPeindreCategorieCitation(r);
    focusPeindreCitation();
    focusPeindreStyleTemps(r);
    focusAfficherOnglet();

    focusMarquerChoix('focusChoixStyle', 'style', r.style);
    focusMarquerChoix('focusChoixPolice', 'police', r.police);
    focusMarquerChoix('focusChoixTaille', 'taille', r.taille);
    if (typeof focusMarquerCompteurs === 'function') focusMarquerCompteurs();

    focusMarquerThemes();

    var cochees = { focusOptBarre: r.barre, focusOptNotif: r.notif, focusOptAuto: r.auto, focusOptCitation: r.citation };
    Object.keys(cochees).forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.checked !== cochees[id]) el.checked = cochees[id];
    });
}

/* Affichage du minuteur selon le style choisi. « Ce qui reste » diminue. */
function focusPeindreStyleTemps(r) {
    var temps = document.getElementById('focusTime');
    var visuel = document.getElementById('focusVisuel');
    var barre = document.getElementById('focusBarre');
    var fill = document.getElementById('focusBarreRemplie');
    if (!temps || !visuel || !barre) return;
    var total = focusEtat.total > 0 ? focusEtat.total : 1;
    var fraction = Math.max(0, Math.min(1, focusEtat.restant / total));
    var style = r.style;

    if (visuel.getAttribute('data-style') !== style) {
        visuel.setAttribute('data-style', style);
        visuel.innerHTML = focusHtmlStyle(style);
    }
    visuel.hidden = style === 'defaut' || style === 'barre';
    temps.hidden = style === 'horloge';
    /* Jauge, matrice de points et camembert : le temps passe petit, sous le graphique. */
    var dessous = style === 'jauge' || style === 'matrice' || style === 'camembert';
    temps.classList.toggle('is-dessous', dessous);
    if (dessous && visuel.nextElementSibling !== temps) visuel.after(temps);
    if (!dessous && visuel.nextElementSibling === temps) visuel.before(temps);

    var texte = focusTexte(focusEtat.restant);
    if (style === 'horloge') {
        var cases = visuel.querySelectorAll('.focus-flip-case b');
        var chiffres = texte.replace(':', '').split('');
        for (var k = 0; k < cases.length && k < chiffres.length; k++) {
            if (cases[k].textContent !== chiffres[k]) cases[k].textContent = chiffres[k];
        }
    } else if (style === 'jauge') {
        var arc = visuel.querySelector('.focus-jauge-arc');
        if (arc) arc.setAttribute('stroke-dashoffset', (FOCUS_CERCLE * (1 - fraction)).toFixed(2));
    } else if (style === 'matrice') {
        var points = visuel.querySelectorAll('.focus-point');
        var allumes = Math.ceil(fraction * points.length);
        for (var p = 0; p < points.length; p++) points[p].classList.toggle('is-allume', p < allumes);
    } else if (style === 'camembert') {
        var part = visuel.querySelector('.focus-camembert-part');
        if (part) part.setAttribute('d', focusSecteur(fraction));
    }

    barre.hidden = !(r.barre || style === 'barre');
    if (fill) fill.style.width = (fraction * 100).toFixed(2) + '%';
}

/* Tracé d'un secteur de disque de rayon 44 (viewBox 100), à partir de 12 h, sens horaire. */
function focusSecteur(fraction) {
    var f = Math.max(0, Math.min(1, fraction));
    if (f <= 0.0005) return '';
    if (f >= 0.9995) return 'M50 6 A44 44 0 1 1 49.99 6 Z';
    var a = f * 2 * Math.PI;
    var x = 50 + 44 * Math.sin(a);
    var y = 50 - 44 * Math.cos(a);
    return 'M50 50 L50 6 A44 44 0 ' + (f > 0.5 ? 1 : 0) + ' 1 ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' Z';
}

/* Contenu d'un affichage du minuteur (créé quand le style change). */
function focusHtmlStyle(style) {
    var i, html = '';
    if (style === 'horloge') {
        html = '<div class="focus-flip">' +
            '<span class="focus-flip-case"><b>0</b></span><span class="focus-flip-case"><b>0</b></span>' +
            '<span class="focus-flip-sep">:</span>' +
            '<span class="focus-flip-case"><b>0</b></span><span class="focus-flip-case"><b>0</b></span>' +
            '</div>';
    } else if (style === 'jauge') {
        html = '<svg class="focus-jauge" viewBox="0 0 100 100" aria-hidden="true">' +
            '<circle class="focus-jauge-fond" cx="50" cy="50" r="45"></circle>' +
            '<circle class="focus-jauge-arc" cx="50" cy="50" r="45" transform="rotate(-90 50 50)" ' +
            'stroke-dasharray="' + FOCUS_CERCLE.toFixed(2) + '" stroke-dashoffset="0"></circle></svg>';
    } else if (style === 'matrice') {
        html = '<div class="focus-matrice" aria-hidden="true">';
        for (i = 0; i < FOCUS_POINTS; i++) html += '<span class="focus-point"></span>';
        html += '</div>';
    } else if (style === 'camembert') {
        html = '<svg class="focus-camembert" viewBox="0 0 100 100" aria-hidden="true">' +
            '<defs><linearGradient id="focusCamGrad" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="#a7f3d0"/><stop offset="1" stop-color="#10b981"/></linearGradient></defs>' +
            '<circle cx="50" cy="50" r="44" class="focus-camembert-fond"/>' +
            '<path class="focus-camembert-part" d="' + focusSecteur(1) + '" fill="url(#focusCamGrad)"/></svg>';
    }
    return html;
}

function focusMessageReglage(texte) {
    var statut = document.getElementById('focusStatutReglage');
    if (statut) statut.textContent = texte || '';
}

/* Un choix de style, de police, de format ou de taille. */
function focusChoisirReglage(cle, valeur) {
    focusMajReglage(cle, valeur);
    focusPeindre();
}

/* Les interrupteurs. La notification demande l'autorisation du navigateur. */
function focusChoisirOption(cle, actif) {
    if (cle === 'notif' && actif) {
        if (typeof Notification === 'undefined') {
            focusMessageReglage('Les notifications ne sont pas disponibles dans ce navigateur.');
            focusMajReglage('notif', false);
            focusPeindre();
            return;
        }
        if (Notification.permission === 'denied') {
            focusMessageReglage('Notifications bloquées : autorise-les dans les réglages du navigateur.');
            focusMajReglage('notif', false);
            focusPeindre();
            return;
        }
        if (Notification.permission === 'default') {
            focusMessageReglage('Demande d\'autorisation en cours…');
            Promise.resolve(Notification.requestPermission()).then(function (reponse) {
                focusMajReglage('notif', reponse === 'granted');
                focusMessageReglage(reponse === 'granted' ? 'Notifications activées.' : 'Notifications non autorisées.');
                focusPeindre();
            }, function () {
                focusMajReglage('notif', false);
                focusMessageReglage('Notifications non autorisées.');
                focusPeindre();
            });
            return;
        }
        focusMajReglage('notif', true);
        focusMessageReglage('Notifications activées.');
        focusPeindre();
        return;
    }
    focusMajReglage(cle, !!actif);
    if (cle !== 'notif') focusMessageReglage('');
    focusPeindre();
}

/* Notification de fin de phase, seulement si l'élève l'a demandée et autorisée. */
function focusNotifierFin(fini) {
    var r = focusLireReglages();
    if (!r.notif || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    var corps = fini === 'focus'
        ? 'Concentration terminée : place-toi en pause.'
        : 'Pause terminée : prêt pour une nouvelle concentration ?';
    try { new Notification('Studyplan · minuteur', { body: corps, tag: 'studyplan-minuteur' }); } catch (e) {}
}

/* Enchaînement automatique : la phase suivante démarre seule, avec sa durée. */
function focusDemarrerEnchainement() {
    if (typeof focusCompterLancement === 'function') focusCompterLancement();
    focusEtat.running = true;
    focusEtat.fin = Date.now() + focusEtat.restant * 1000;
    focusLancerIntervalle();
    if (typeof focusInitAudio === 'function') { try { focusInitAudio(); } catch (e) {} }
    if (focusEtat.mode === 'focus' && typeof chronoRendreMusique === 'function') {
        try { chronoRendreMusique(); } catch (e) {}
    }
    focusPeindre();
}


focusConstruireChoix();
if (!window.__focusEchap) {
    window.__focusEchap = true;
    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        var panneau = document.getElementById('focusReglages');
        if (panneau && !panneau.hidden && typeof focusFermer === 'function') focusFermer('focusReglages');
    });
}
