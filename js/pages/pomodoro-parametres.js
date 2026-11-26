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

/* Phrases de motivation en français, classées par catégorie.
   Les textes originaux sont indiqués Studyplan ; les rares extraits vérifiés
   et leur contexte sont documentés dans docs/citations-motivation.md. */
var FOCUS_CATEGORIES_CITATIONS = [
    { id: 'toutes', nom: 'Toutes les citations' },
    { id: 'motivation', nom: 'Motivation' },
    { id: 'inspiration', nom: 'Inspiration' },
    { id: 'bien-etre', nom: 'Bien-être' },
    { id: 'personnelle', nom: 'Ma citation' }
];

/* Les textes restent courts pour les petits écrans et le partage en salon. */
var FOCUS_CITATIONS = {
    "motivation": [
        { t: "Ton objectif mérite mieux qu’un « demain » : commence aujourd’hui", a: "Studyplan" },
        { t: "Ouvre ton cours : le premier pas est souvent le plus difficile", a: "Studyplan" },
        { t: "Une page comprise aujourd’hui, c’est une page de moins à craindre", a: "Studyplan" },
        { t: "N’attends pas d’être prêt : commence et progresse en chemin", a: "Studyplan" },
        { t: "La motivation peut venir après le premier exercice, pas avant", a: "Studyplan" },
        { t: "Ce chapitre ne se maîtrisera pas seul : accorde-lui ce moment", a: "Studyplan" },
        { t: "Choisis une question et attaque-la, une ligne à la fois", a: "Studyplan" },
        { t: "Ce que tu répètes aujourd’hui devient plus facile demain", a: "Studyplan" },
        { t: "Tu n’as pas besoin de tout finir : avance sur une chose", a: "Studyplan" },
        { t: "Même cinq minutes de concentration peuvent relancer ta journée", a: "Studyplan" },
        { t: "L’exercice qui résiste est peut-être celui qui te fera progresser", a: "Studyplan" },
        { t: "Ne compte pas seulement les heures : cherche à comprendre", a: "Studyplan" },
        { t: "Un essai imparfait t’apprend plus qu’une page laissée blanche", a: "Studyplan" },
        { t: "Le doute n’a pas besoin de disparaître pour que tu commences", a: "Studyplan" },
        { t: "Reviens à ton objectif : quelle action peux-tu faire maintenant ?", a: "Studyplan" },
        { t: "Chaque notion éclaircie te donne un appui pour la suivante", a: "Studyplan" },
        { t: "Ferme les distractions, ouvre ton cours et donne-toi une chance", a: "Studyplan" },
        { t: "La régularité construit ce que la précipitation ne peut pas", a: "Studyplan" },
        { t: "Révise ce que tu peux aujourd’hui ; demain, tu auras une base", a: "Studyplan" },
        { t: "Une erreur corrigée est un progrès que tu peux emporter", a: "Studyplan" },
        { t: "Quand la tâche paraît immense, commence par la prochaine étape", a: "Studyplan" },
        { t: "Ton futur se prépare aussi dans les minutes que tu choisis d’étudier", a: "Studyplan" },
        { t: "Tu peux recommencer sans avoir à effacer les jours difficiles", a: "Studyplan" },
        { t: "Pose ton téléphone un instant : ce moment appartient à ton projet", a: "Studyplan" },
        { t: "Fais le premier exercice, puis décide de la suite", a: "Studyplan" },
        { t: "Le progrès ne fait pas toujours de bruit : continue à apprendre", a: "Studyplan" },
        { t: "Ne laisse pas une mauvaise note décider de ta prochaine séance", a: "Studyplan" },
        { t: "Cherche une réponse, vérifie-la, puis essaie encore", a: "Studyplan" },
        { t: "Aujourd’hui n’a pas besoin d’être parfait pour être utile", a: "Studyplan" },
        { t: "Le chapitre d’aujourd’hui peut devenir ta force de demain", a: "Studyplan" },
        { t: "Tu as le droit de trouver ça difficile et de continuer quand même", a: "Studyplan" },
        { t: "Une séance commencée vaut mieux qu’un plan sans cesse repoussé", a: "Studyplan" },
        { t: "Le hasard ne favorise que les esprits préparés", a: "Louis Pasteur" },
        { t: "Avance à ton rythme, mais donne à ton objectif un vrai rendez-vous", a: "Studyplan" }
    ],
    "inspiration": [
        { t: "Chaque sujet que tu comprends agrandit le monde que tu peux explorer", a: "Studyplan" },
        { t: "Imagine-toi expliquer demain ce qui te semblait impossible hier", a: "Studyplan" },
        { t: "Étudier, c’est donner plus de chemins à tes rêves", a: "Studyplan" },
        { t: "Derrière chaque compétence que tu admires, il y a un apprentissage", a: "Studyplan" },
        { t: "Le savoir ne te demande pas d’être parfait, seulement de revenir", a: "Studyplan" },
        { t: "Une question bien posée peut ouvrir tout un chapitre", a: "Studyplan" },
        { t: "Chaque page étudiée ajoute une pièce à ce que tu construis", a: "Studyplan" },
        { t: "Tu n’es pas encore au bout : c’est pour cela que tu apprends", a: "Studyplan" },
        { t: "Comprendre une idée, c’est gagner une nouvelle façon de voir", a: "Studyplan" },
        { t: "Ce que tu apprends aujourd’hui peut servir un projet qui te ressemble", a: "Studyplan" },
        { t: "Ta curiosité peut transformer une leçon en découverte", a: "Studyplan" },
        { t: "Une difficulté n’est pas une porte fermée : cherche la clé", a: "Studyplan" },
        { t: "Ce problème a une logique : prends le temps de la découvrir", a: "Studyplan" },
        { t: "Apprendre, c’est rendre possibles des choix que tu n’avais pas encore", a: "Studyplan" },
        { t: "Tes questions sont le début d’une compréhension plus profonde", a: "Studyplan" },
        { t: "Entraîne ton esprit : il peut aller plus loin que tu ne l’imagines", a: "Studyplan" },
        { t: "L’avenir ne se dessine pas d’un coup : trace une ligne aujourd’hui", a: "Studyplan" },
        { t: "Un cours devient une force quand tu peux l’utiliser par toi-même", a: "Studyplan" },
        { t: "Tes efforts d’aujourd’hui nourrissent la personne que tu deviens", a: "Studyplan" },
        { t: "Tu peux transformer « je ne sais pas » en « je vais apprendre »", a: "Studyplan" },
        { t: "Regarde ce que tu sais déjà : appuie-toi dessus pour aller plus loin", a: "Studyplan" },
        { t: "Ce n’est pas seulement une leçon : c’est une capacité en devenir", a: "Studyplan" },
        { t: "La confiance grandit aussi quand tu tiens un engagement envers toi", a: "Studyplan" },
        { t: "Chaque exercice est une occasion de découvrir ce que tu peux améliorer", a: "Studyplan" },
        { t: "Apprendre, c’est ouvrir une porte que personne ne peut franchir pour toi", a: "Studyplan" },
        { t: "Tes progrès ne ressemblent à aucun autre parcours, et c’est normal", a: "Studyplan" },
        { t: "N’aie pas peur de poser la question qui débloquera ta compréhension", a: "Studyplan" },
        { t: "Tu peux faire de cette heure un point de départ", a: "Studyplan" },
        { t: "Ce que tu construis avec patience peut t’emmener loin", a: "Studyplan" },
        { t: "Étudie pour tes possibilités, pas seulement pour une note", a: "Studyplan" },
        { t: "La curiosité te met en route ; la pratique t’aide à avancer", a: "Studyplan" },
        { t: "C’est en regardant qu’on apprend", a: "Alexandre Dumas" },
        { t: "Une idée comprise peut changer ta façon d’aborder tout le reste", a: "Studyplan" },
        { t: "Demande de l’aide si nécessaire : apprendre n’est pas un chemin solitaire", a: "Studyplan" }
    ],
    "bien-etre": [
        { t: "Respire, choisis une seule tâche et avance à ton rythme", a: "Studyplan" },
        { t: "Une pause n’efface pas ton effort : elle peut t’aider à reprendre", a: "Studyplan" },
        { t: "Tu peux prendre soin de toi et avancer vers ton objectif", a: "Studyplan" },
        { t: "Si tout semble trop lourd, réduis la tâche, pas ton ambition", a: "Studyplan" },
        { t: "Repose-toi quand il le faut, puis reviens à ton prochain pas", a: "Studyplan" },
        { t: "Ta valeur ne se mesure pas à la vitesse à laquelle tu comprends", a: "Studyplan" },
        { t: "Bois de l’eau, détends tes épaules, puis reprends une question", a: "Studyplan" },
        { t: "Une journée difficile n’annule pas tous tes progrès", a: "Studyplan" },
        { t: "Travaille avec patience : tu apprends, tu ne te juges pas", a: "Studyplan" },
        { t: "Accorde-toi une pause avant que la fatigue décide pour toi", a: "Studyplan" },
        { t: "Tu peux demander de l’aide et rester fier de ton travail", a: "Studyplan" },
        { t: "Une petite séance attentive est déjà une façon d’avancer", a: "Studyplan" },
        { t: "Quand tu bloques, respire et essaie une autre approche", a: "Studyplan" },
        { t: "Il est permis de ralentir pour mieux comprendre", a: "Studyplan" },
        { t: "Ne te compare pas : concentre-toi sur ta prochaine étape", a: "Studyplan" },
        { t: "Ton cerveau a besoin de repos autant que de pratique", a: "Studyplan" },
        { t: "Sois exigeant avec ta méthode, bienveillant avec toi-même", a: "Studyplan" },
        { t: "Ce soir, prépare une étape simple pour faciliter ton retour demain", a: "Studyplan" },
        { t: "Si tu es fatigué, fais une pause ; ton objectif peut attendre un peu", a: "Studyplan" },
        { t: "Apprendre prend du temps : donne-toi le droit de progresser", a: "Studyplan" },
        { t: "Un résultat difficile est une information, pas une identité", a: "Studyplan" },
        { t: "Rappelle-toi pourquoi tu étudies, puis choisis un pas possible", a: "Studyplan" },
        { t: "Tu n’as pas à tout porter maintenant : traite une chose à la fois", a: "Studyplan" },
        { t: "Après une erreur, corrige-la sans te parler durement", a: "Studyplan" },
        { t: "Fais de la place à ton sommeil : demain aussi compte", a: "Studyplan" },
        { t: "Te reposer fait partie du chemin, pas de son abandon", a: "Studyplan" },
        { t: "Fais une pause sans culpabilité, puis reviens quand tu le peux", a: "Studyplan" },
        { t: "Ton rythme peut changer ; ton envie d’apprendre peut rester", a: "Studyplan" },
        { t: "Un pas calme et régulier vaut mieux qu’une course jusqu’à l’épuisement", a: "Studyplan" },
        { t: "Tu n’as pas besoin de réussir du premier coup pour progresser", a: "Studyplan" },
        { t: "Prends le temps de comprendre ce qui te manque, puis demande de l’aide", a: "Studyplan" },
        { t: "Avant de reprendre, desserre les épaules et respire profondément", a: "Studyplan" },
        { t: "Chaque retour à ton travail compte, même après une interruption", a: "Studyplan" },
        { t: "Avancer sans t’épuiser, c’est aussi prendre ton objectif au sérieux", a: "Studyplan" }
    ]
};

var FOCUS_STYLES_TEMPS = [
    { id: 'defaut', nom: 'Par défaut' },
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

var FOCUS_ONGLETS = ['themes', 'horloge', 'minuteur', 'citations', 'voix', 'salon', 'statistiques'];

var FOCUS_REGLAGES_CLE = 'studyPlanIB_minuteurParametres';
var FOCUS_CERCLE = 2 * Math.PI * 45;
var FOCUS_POINTS = 24;
var focusReglagesVus = null;
var focusOngletCourant = 'horloge';

/* Aperçus en mini-dessins, dans les tuiles de style (contenu fixe). */
var FOCUS_MINI = {
    defaut: '<span class="focus-mini-texte">25:00</span>',
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
        citationPersonnelle: typeof b.citationPersonnelle === 'string' ? b.citationPersonnelle.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 140) : '',
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
    if (typeof syncFocusCourant === 'function') syncFocusCourant();
    focusReglagesVus = focusNormaliserReglages(reglages);
    try { localStorage.setItem(FOCUS_REGLAGES_CLE, JSON.stringify(focusReglagesVus)); } catch (e) {}
    if (typeof syncFocusNotifier === 'function') syncFocusNotifier();
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
    // Alterner les catégories plutôt que proposer un mois entier du même ton.
    var groupes = FOCUS_CATEGORIES_CITATIONS.map(function (c) { return FOCUS_CITATIONS[c.id] || []; });
    var tout = [], taille = Math.max.apply(null, groupes.map(function (g) { return g.length; }));
    for (var i = 0; i < taille; i++) groupes.forEach(function (g) { if (g[i]) tout.push(g[i]); });
    return tout;
}

/* Une citation par jour dans la catégorie choisie : la même toute la journée, une autre le lendemain.
   Affichée entre guillemets courbes, sans point final. */
function focusCitationDuJour(date) {
    var d = date || new Date();
    // Les dates civiles évitent un décalage ou une répétition au passage à l'heure d'été.
    var jour = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);
    var reglages = focusLireReglages();
    var personnelle = reglages.citationPersonnelle.trim();
    if (reglages.citationCategorie === 'personnelle' && personnelle) return '\u201C' + personnelle + '\u201D';
    var liste = focusCitationsDeCategorie(reglages.citationCategorie);
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

/* L'écriture choisit la citation personnelle, sans perturber la saisie
   lors des rafraîchissements du minuteur. Vide : citation du jour. */
function focusSauverCitationPersonnelle(champ) {
    var r = focusLireReglages();
    var copie = {};
    Object.keys(r).forEach(function (cle) { copie[cle] = r[cle]; });
    copie.citationPersonnelle = champ.value;
    copie.citationCategorie = 'personnelle';
    if (champ.value.trim()) copie.citation = true;
    focusEcrireReglages(copie);
    focusPeindreCitation();
    focusPeindreCategorieCitation(focusLireReglages());
    var option = document.getElementById('focusOptCitation');
    if (option) option.checked = focusLireReglages().citation;
}

function focusPeindreCitation() {
    var texte = focusCitationDuJour();
    var visible = focusLireReglages().citation;
    ['focusCitation'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        if (el.textContent !== texte) el.textContent = texte;
        if (el.hidden !== !visible) el.hidden = !visible;
        /* Sur un écran très court la citation peut défiler : la rendre aussi
           accessible au clavier uniquement lorsqu'elle déborde réellement. */
        if (visible && el.scrollHeight > el.clientHeight + 1) el.setAttribute('tabindex', '0');
        else el.removeAttribute('tabindex');
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
    { id: 'fleurs', nom: 'Fleurs' },
    { id: 'urbain', nom: 'Urbain' },
    { id: 'interieur', nom: 'Intérieur' },
    { id: 'sport', nom: 'Sport' },
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
    var anticiper = function () {
        if (typeof focusAmorcageUtile === 'function' && focusAmorcageUtile() && typeof focusDecoderImage === 'function') focusDecoderImage(item.src);
    };
    bouton.addEventListener('pointerenter', anticiper);
    bouton.addEventListener('pointerdown', anticiper);
    bouton.addEventListener('focus', anticiper);
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
    var citationPersonnelle = document.getElementById('focusCitationPersonnelle');
    if (citationPersonnelle && document.activeElement !== citationPersonnelle && citationPersonnelle.value !== r.citationPersonnelle) citationPersonnelle.value = r.citationPersonnelle;
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
    /* Jauge, matrice de points et camembert : le temps passe petit, sous le graphique. */
    var dessous = style === 'jauge' || style === 'matrice' || style === 'camembert';
    temps.classList.toggle('is-dessous', dessous);
    if (dessous && visuel.nextElementSibling !== temps) visuel.after(temps);
    if (!dessous && visuel.nextElementSibling === temps) visuel.before(temps);

    var texte = focusTexte(focusEtat.restant);
    if (style === 'jauge') {
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
    if (style === 'jauge') {
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
