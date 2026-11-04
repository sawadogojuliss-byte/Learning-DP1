/* ============================================================
   COMPTEURS DE MINUTERIE — Paramètres > Minuteur > Compteurs

   Une icône par séance choisie (Durées > « Combien de séances »).
   Une icône pleine = une concentration terminée dans le cycle en cours.
   Le cycle recommence après la pause longue.

   Deux familles :
     statique  : la même icône se répète pour chaque minuteur
     dynamique : chaque minuteur a sa propre icône (en boucle si besoin)
   Aucune donnée n'est envoyée : le choix est un réglage local.
   Ordre des scripts : après statistiques.js, avant pomodoro-page.js.
   ============================================================ */

var FOCUS_COMPTEURS = [
    { id: 'points', nom: 'Points', groupe: 'statique', svg: 'points' },
    { id: 'coeurs', nom: 'Cœurs', groupe: 'statique', svg: 'coeurs' },
    { id: 'etoiles', nom: 'Étoiles', groupe: 'statique', icone: '⭐' },
    { id: 'tomates', nom: 'Tomates', groupe: 'statique', icone: '🍅' },
    { id: 'boulons', nom: 'Boulons', groupe: 'statique', icone: '🔩' },
    { id: 'diplomes', nom: 'Remise des diplômes', groupe: 'statique', icone: '🎓' },
    { id: 'flocon', nom: 'Flocon de neige', groupe: 'statique', icone: '❄️' },
    { id: 'bonhomme', nom: 'Bonhomme de neige', groupe: 'statique', icone: '⛄' },
    { id: 'sapin', nom: 'Sapin de Noël', groupe: 'statique', icone: '🎄' },
    { id: 'medical', nom: 'Médical', groupe: 'dynamique', icones: ['🥼', '🧠', '🩺', '📈'] },
    { id: 'loi', nom: 'Loi', groupe: 'dynamique', icones: ['📚', '⚖️', '🏛️', '📜'] },
    { id: 'art', nom: 'Art', groupe: 'dynamique', icones: ['🎧', '🎨', '✏️', '🌸'] },
    { id: 'vacances', nom: 'Vacances à la plage', groupe: 'dynamique', icones: ['💼', '✈️', '🏊', '🏖️'] },
    { id: 'montagne', nom: 'Ascension de montagne', groupe: 'dynamique', icones: ['🥾', '⛺', '🧗', '⛰️'] },
    { id: 'bienetre', nom: 'Soirée de bien-être', groupe: 'dynamique', icones: ['🛁', '🕯️', '🍵', '🧘'] },
    { id: 'repas', nom: 'Préparation des repas', groupe: 'dynamique', icones: ['🥕', '🍣', '🍚', '🍱'] },
    { id: 'pluie-arc', nom: "De la pluie à l'arc-en-ciel", groupe: 'dynamique', icones: ['☁️', '🌧️', '☀️', '🌈'] },
    { id: 'tige', nom: 'TIGE', groupe: 'dynamique', icones: ['🧬', '💻', '⚙️', '📐'] }
];

var focusCompteurOuvert = true;

function focusCompteurChoisi(id) {
    for (var i = 0; i < FOCUS_COMPTEURS.length; i++) {
        if (FOCUS_COMPTEURS[i].id === id) return FOCUS_COMPTEURS[i];
    }
    return FOCUS_COMPTEURS[0];
}

/* Contenu d'une icône : un point, un cœur, une icône répétée, ou une icône du cycle. */
function focusCompteurContenu(choix, i) {
    if (choix.svg === 'points') {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>';
    }
    if (choix.svg === 'coeurs') {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 20.6s-7.4-4.5-9.4-9.1C1.2 8.2 3.3 4.8 6.6 4.8c2.1 0 3.6 1.2 4.4 2.5.8-1.3 2.3-2.5 4.4-2.5 3.3 0 5.4 3.4 4 6.7-2 4.6-9.4 9.1-9.4 9.1z"/></svg>';
    }
    if (choix.icones) return choix.icones[i % choix.icones.length];
    return choix.icone;
}

/* n icônes exactement ; les « plein » premières sont allumées. */
function focusCompteurHtml(id, n, plein) {
    var choix = focusCompteurChoisi(id);
    var html = '';
    for (var i = 0; i < n; i++) {
        html += '<span class="focus-compteur-item ' + (i < plein ? 'is-plein' : 'is-vide') + '" aria-hidden="true">'
            + focusCompteurContenu(choix, i) + '</span>';
    }
    return html;
}

/* Combien d'icônes sont allumées dans le cycle en cours.
   Concentration : les concentrations terminées depuis la dernière pause longue.
   Après le dernier minuteur du cycle, la pause longue garde tout allumé. */
function focusCompteurEtat() {
    var n = typeof focusDurees === 'function' ? focusDurees().seances : 4;
    var c = Math.max(0, Math.floor(Number(focusEtat.cycles) || 0));
    var reste = c % n;
    /* Dès qu'une séance de concentration démarre, son compteur s'allume (même avant la fin). */
    var seanceCommencee = focusEtat.mode === 'focus' && (focusEtat.running || focusEtat.restant < focusEtat.total);
    var plein = reste + (seanceCommencee ? 1 : 0);
    if (focusEtat.mode === 'long' && c > 0 && reste === 0) plein = n;
    return { n: n, plein: Math.min(n, plein) };
}

/* Le compteur du minuteur, sous le temps. Ne repeint que si quelque chose change. */
function focusPeindreCompteur() {
    var conteneur = document.getElementById('focusCompteur');
    if (!conteneur || typeof focusEtat === 'undefined') return;
    var reglages = typeof focusLireReglages === 'function' ? focusLireReglages() : { compteur: 'points' };
    var etat = focusCompteurEtat();
    var html = focusCompteurHtml(reglages.compteur, etat.n, etat.plein);
    if (conteneur.getAttribute('data-rendu') !== html) {
        conteneur.innerHTML = html;
        conteneur.setAttribute('data-rendu', html);
    }
    conteneur.setAttribute('aria-label', etat.plein + ' minuteur(s) terminé(s) sur ' + etat.n + ' dans ce cycle');
}

/* Vignette de choix : 4 icônes, 2 allumées, sur fond vert du site. */
function focusCompteurTuile(item) {
    return '<span class="focus-tuile-image focus-tuile-compteur"><span class="focus-compteur focus-compteur-apercu">'
        + focusCompteurHtml(item.id, 4, 2) + '</span></span>'
        + '<span class="focus-tuile-nom">' + item.nom + '</span>';
}

function focusBasculerCompteurs() {
    focusCompteurOuvert = !focusCompteurOuvert;
    focusMarquerCompteurs();
}

/* Met à jour le nom choisi, la liste repliée ou dépliée et la sélection. */
function focusMarquerCompteurs() {
    var reglages = typeof focusLireReglages === 'function' ? focusLireReglages() : { compteur: 'points' };
    var nom = document.getElementById('focusCompteurNom');
    if (nom) nom.textContent = focusCompteurChoisi(reglages.compteur).nom;
    var liste = document.getElementById('focusCompteurListe');
    if (liste) liste.hidden = !focusCompteurOuvert;
    var bouton = document.getElementById('focusCompteurBouton');
    if (bouton) {
        bouton.textContent = focusCompteurOuvert ? 'Fait' : 'Modifier';
        bouton.setAttribute('aria-expanded', String(focusCompteurOuvert));
    }
    if (typeof focusMarquerChoix === 'function') {
        focusMarquerChoix('focusCompteurStatique', 'compteur', reglages.compteur);
        focusMarquerChoix('focusCompteurDynamique', 'compteur', reglages.compteur);
    }
}
