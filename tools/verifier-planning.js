/* Vérifie le planning : déplacement des activités (clic droit → poignée)
   et popup de chevauchement (toute activité voisine, explication claire).
   Pour le déplacement, la durée ne change jamais : seules les heures de
   début et de fin. Aucun message n'est affiché pour un déplacement refusé. */
var fs = require('fs');
var path = require('path');
var echecs = [];

function lire(rel) {
    return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}
function ok(cond, message) {
    if (!cond) echecs.push(message);
}
function entre(texte, debut, fin) {
    var i = texte.indexOf(debut);
    if (i === -1) return '';
    var j = fin ? texte.indexOf(fin, i) : -1;
    return j === -1 ? texte.slice(i) : texte.slice(i, j);
}

var interfaceJs = lire('js/pages/planning-interface.js');
var css = lire('css/pages/planning-panels.css');

// ── Déplacement d'une activité ────────────────────────────────────────
ok(interfaceJs.indexOf("data-v3-idx=\"' + idx + '\"") !== -1, 'chaque carte du planning doit être repérable');
ok(interfaceJs.indexOf("addEventListener('contextmenu'") !== -1, 'le clic droit doit préparer le déplacement');
ok(interfaceJs.indexOf("closest('#eventsContainer [data-v3-idx]')") !== -1, 'le clic droit doit viser la carte de l\'activité');
ok(interfaceJs.indexOf('function v3CarteDeplacable') !== -1, 'seules les activités modifiables se déplacent');
ok(interfaceJs.indexOf('function v3PoserPoignee') !== -1, 'la poignée de déplacement manque');
ok(interfaceJs.indexOf("pouce.textContent = '👍'") !== -1, 'la poignée doit être un pouce');
ok(interfaceJs.indexOf("addEventListener('pointerdown', v3DemarrerDeplacement)") !== -1, 'la poignée doit se saisir');
ok(interfaceJs.indexOf('function v3PendantDeplacement') !== -1, 'le glisser doit être suivi');
ok(interfaceJs.indexOf('function v3TerminerDeplacement') !== -1, 'le dépôt doit être traité');
ok(interfaceJs.indexOf('function v3DonnerHoraireCible') !== -1, 'le dépôt ne change pas l\'horaire');

var sectionDeplacement = entre(interfaceJs, 'function v3DonnerHoraireCible');
ok(sectionDeplacement.indexOf('var duree = timeToMinutes(voulu.endTime) - timeToMinutes(voulu.startTime);') !== -1,
    'la durée doit être mesurée avant le déplacement');
ok(sectionDeplacement.indexOf('var debut = cible.startTime;') !== -1,
    'la nouvelle heure de début doit être celle de l\'activité visée');
ok(sectionDeplacement.indexOf("var fin = addMinutes('00:00', finMins);") !== -1,
    'l\'heure de fin doit suivre la même durée');
ok(sectionDeplacement.indexOf('validateNewEventTime(debut, fin, selectedDay)') !== -1,
    'un dépôt pendant les cours doit être refusé');
['v3Toast(', 'alert(', 'confirm(', 'chevauchementPopup', 'toast.textContent'].forEach(function (interdit) {
    ok(sectionDeplacement.indexOf(interdit) === -1, 'aucun message ne doit prévenir l\'utilisateur : ' + interdit);
});

ok(css.indexOf('.v3-pouce {') !== -1, 'le style de la poignée manque');
ok(css.indexOf('.v3-carte-cible {') !== -1, 'le style de la carte visée manque');
ok(css.indexOf('body.v3-deplacement') !== -1, 'le curseur de déplacement manque');
ok(css.indexOf('#eventsContainer [data-v3-idx] { position: relative; }') !== -1, 'les cartes doivent servir de repère');
ok(css.indexOf('!important') !== -1, 'les cartes ont un style en ligne : le repère doit primer');

// ── Popup de chevauchement ────────────────────────────────────────────
var popup = entre(interfaceJs, 'function v3OuvrirChoixChevauchement', 'function v3SignalerChevauchementJour');
ok(popup.length > 500, 'le popup de chevauchement est introuvable');
ok(interfaceJs.indexOf('function v3ConflitsCreneau') !== -1, 'la détection des activités voisines manque');
ok(interfaceJs.indexOf('var voisines = v3ConflitsCreneau(day, newStart, newEnd, [editingEvent.id]);') !== -1,
    'la modification doit prévenir dès qu\'une activité voisine se chevauche');
ok(interfaceJs.indexOf('var voisinesAjout = v3ConflitsCreneau(selectedDay, startTime, endTime, []);') !== -1,
    'l\'ajout doit prévenir dès qu\'une activité voisine se chevauche');
ok(interfaceJs.indexOf('v3EstActivite(editingEvent) || activites.some(v3EstActivite)') === -1,
    'le popup ne doit plus se limiter aux activités');
ok(interfaceJs.indexOf('function v3ConflitsCreneau(day, start, end, excludeIds) {') !== -1, 'la liste des voisines est mal nommée');
var conflits = entre(interfaceJs, 'function v3ConflitsCreneau', 'function v3CreneauModifie');
ok(conflits.indexOf("ev.id === 'wakeup' || ev.id === 'sleep'") !== -1, 'le réveil et le coucher ne comptent pas');
ok(conflits.indexOf('v3IntervallesSeCroisent') !== -1, 'les voisines doivent être comparées aux vraies heures');
ok(popup.indexOf('Ta modification') !== -1, 'le popup doit rappeler la modification');
ok(popup.indexOf('Ce qui est déjà à ce moment') !== -1, 'le popup doit lister ce qui occupe le créneau');
ok(popup.indexOf('Prendre son créneau') !== -1, 'le popup doit proposer de prendre le créneau');
ok(popup.indexOf('Choisir un autre horaire') !== -1, 'le popup doit proposer un autre horaire');
ok(popup.indexOf('Elle commence avant la tienne') !== -1, 'l\'activité qui précède doit être expliquée');
ok(popup.indexOf('Elle commence après la tienne') !== -1, 'l\'activité qui suit doit être expliquée');
ok(popup.indexOf('Cette activité se chevauche') !== -1 && popup.indexOf('Ces activités se chevauchent') !== -1,
    'le titre doit s\'accorder au nombre de conflits');
ok(popup.indexOf('minutesCourt') !== -1, 'la durée doit être lisible dans le popup');
ok(popup.indexOf('data-propositions') !== -1 && popup.indexOf('data-placer') !== -1 && popup.indexOf('data-annuler') !== -1,
    'les actions du popup manquent');

/* ── Page retour des feedbacks, habillage Pomodoro ───────────────────── */
var html = lire('pages/boite.html');
var cssRetours = lire('css/pages/retours.css');
ok(html.indexOf('class="retours-boite"') !== -1, 'la page des retours doit avoir sa carte');
ok(html.indexOf('Retour des feedbacks') !== -1 && html.indexOf('id="retoursListe"') !== -1, 'la liste des retours manque');
ok(html.indexOf('id="retoursRafraichir"') !== -1, 'le bouton Actualiser manque');
ok(cssRetours.indexOf('#panelRetours.app-panel') !== -1 && cssRetours.indexOf('images/pomodoro/lumiere.webp') !== -1,
    'le fond doit reprendre celui de Pomodoro');
ok(cssRetours.indexOf('font-family: Inter') !== -1, 'la typographie doit être celle du site');
ok(cssRetours.indexOf('#retoursListe article') !== -1, 'les cartes reçues doivent être rhabillées');
ok(cssRetours.indexOf('border-radius: 1.25rem !important') !== -1, 'les cartes doivent être arrondies');
ok(lire('index.html').indexOf('css/pages/retours.css') !== -1, 'la feuille des retours doit être chargée');
ok(lire('tools/bundle-site.py').indexOf('css/pages/retours.css') !== -1, 'la feuille doit entrer dans le bundle');

/* ── L'assistant a quitté l'application pour de bon ─────────────────── */
var planning = lire('pages/planning.html');
['menuAssistant', 'btnAssistant', 'panelAssistant'].forEach(function (id) {
    ok(planning.indexOf(id) === -1, 'le bouton ' + id + ' ne doit plus exister');
    ok(interfaceJs.indexOf(id) === -1 && css.indexOf(id) === -1, id + ' traîne encore dans le style ou l\'interface');
});
ok(!fs.existsSync(path.join(__dirname, '..', 'js/pages/assistant.js')), 'le script de l\'assistant doit disparaître');
/* Il reste une page vide à cet ancien emplacement : les navigateurs qui
   gardent une version d'avant en mémoire ne doivent pas afficher d'erreur. */
var vide = fs.readFileSync(path.join(__dirname, '..', 'pages/assistant.html'), 'utf8');
ok(vide.indexOf('app-panel') === -1 && vide.indexOf('<script') === -1 && vide.indexOf('menuAssistant') === -1,
    'la page laissée à cet emplacement doit être vide');
ok(lire('js/registre.js').indexOf('assistant') === -1, 'le registre ne doit plus charger l\'assistant');
ok(lire('js/pages/navigation.js').indexOf('assistant') === -1, 'la navigation ne doit plus ouvrir l\'assistant');
ok(lire('js/memoire.js').indexOf('assistant') === -1, 'la mémoire ne doit plus connaître l\'assistant');
ok(lire('js/pages/boite.js').indexOf('menuAssistant') === -1, 'la boîte ne doit plus toucher ce menu');
ok(css.indexOf('.ia-') === -1, 'aucun style de l\'assistant ne doit rester');

/* ── Le dîner et l'icône des activités ─────────────────────────────── */
ok(lire('js/pages/planning-base.js').indexOf("chain('dinner', 'Dîner', '', getDuration('dinner', 45), 'meal', '🍽️', true)") !== -1,
    'le dîner doit porter l\'assiette avec couteau et fourchette');
ok(lire('js/pages/planning-moteur.js').indexOf("repasSelonHabitude('dinner', 'Dîner', '🍽️'") !== -1,
    'le dîner doit porter l\'assiette avec couteau et fourchette dans les deux moteurs');
ok(lire('pages/onboarding-habitudes.html').indexOf('🍽️') !== -1, 'la page des habitudes doit montrer la même assiette');
['js/pages/planning-base.js', 'pages/onboarding-habitudes.html', 'pages/planning.html'].forEach(function (rel) {
    ok(lire(rel).indexOf('🍝') === -1, 'l\'assiette de pâtes doit disparaître de ' + rel);
});
/* Dans le moteur, l'ancienne assiette de pâtes ne subsiste que le temps d'être
   remplacée : un planning déjà enregistré avec elle doit montrer la bonne. */
ok(lire('js/pages/planning-moteur.js').indexOf('const v3IconeRepas = (icone) => (icone === \'🍝\' ? \'🍽️\' : icone);') !== -1,
    'les plannings enregistrés avec l\'assiette de pâtes doivent être corrigés');
ok((lire('js/pages/planning-moteur.js').match(/v3IconeRepas\(ov\.icon\)/g) || []).length === 3,
    'chaque icône enregistrée doit passer par la correction');
/* La règle finale, celle qui s'affiche : croissant au petit-déjeuner et
   assiette couteau-fourchette au déjeuner comme au dîner, même dans un emploi
   déjà enregistré. */
ok(lire('js/pages/planning-base.js').indexOf("var V3_ICONES_REPAS = { breakfast: '🥐', lunch: '🍽️', dinner: '🍽️' };") !== -1,
    'la règle des trois repas doit être écrite une seule fois');
ok(lire('js/pages/planning-base.js').indexOf('function v3IconesRepas(jour)') !== -1,
    'les icônes des repas doivent être garanties à chaque génération');
ok((lire('js/pages/planning-base.js').match(/v3IconesRepas\(/g) || []).length >= 3,
    'la génération doit passer par la règle des repas');
ok(lire('js/pages/planning-moteur.js').indexOf('function v3Repas(jour)') !== -1,
    'un emploi figé doit aussi passer par la règle des repas');
ok((lire('js/pages/planning-moteur.js').match(/v3Repas\(/g) || []).length >= 4,
    'chaque sortie du moteur doit passer par la règle des repas');
/* L'icône des activités change chaque semaine, dans l'ordre, pour tout le monde. */
ok(planning.indexOf('id="statActivitiesIcone"') !== -1, 'la carte des activités doit avoir son icône de la semaine');
ok(interfaceJs.indexOf("var V3_ICONES_ACTIVITES = ['🏃', '🎯', '🏆'];") !== -1,
    'les trois icônes de la semaine doivent être déclarées');
ok(interfaceJs.indexOf('function v3IconeActivitesSemaine()') !== -1, 'la semaine doit choisir l\'icône');
ok(interfaceJs.indexOf('function v3PeindreIconeActivites()') !== -1, 'l\'icône de la semaine doit être peinte');
ok((interfaceJs.match(/v3PeindreIconeActivites\(\);/g) || []).length >= 3,
    'l\'icône doit être peinte au chargement et à chaque affichage du planning');
ok(interfaceJs.indexOf("lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7))") !== -1,
    'la semaine doit commencer le lundi');


/* ── Les textes de la première page et de l'accueil du profil ───────── */
var accueil = lire('pages/accueil.html');
ok(accueil.indexOf('Créer mon planning gratuitement') === -1, 'le bouton du haut ne dit plus « gratuitement »');
ok(accueil.indexOf('>🚀 Créer mon planning</button>') !== -1, 'le bouton du haut doit rester « Créer mon planning »');
ok(accueil.indexOf("Rejoignez des milliers d'étudiants") === -1, 'la phrase « Rejoignez des milliers… » doit disparaître');
ok(accueil.indexOf('Prêt à transformer vos révisions ?') !== -1, 'la question du bas doit rester');
ok(accueil.indexOf("Commencer maintenant — C'est gratuit !") !== -1, 'le bouton du bas doit rester');
ok(lire('pages/onboarding-prenom.html').indexOf('Commençons par faire connaissance') === -1,
    'la page du prénom ne garde que la question');
ok(lire('pages/onboarding-prenom.html').indexOf("Comment t'appelles-tu ?") !== -1, 'la question du prénom doit rester');
ok(lire('pages/onboarding-sommeil.html').indexOf('inférieure à 5 h') === -1,
    'la limite de 5 h ne doit plus être répétée en haut de la page');
var sommeil = lire('pages/onboarding-sommeil.html');
ok(sommeil.indexOf('Choisis ton réveil et ta durée de sommeil.') !== -1, 'la description du sommeil doit rester');
ok(sommeil.indexOf('au moins 5 h') !== -1, 'la limite de 5 h doit rester dans le rectangle vert');


if (echecs.length) {
    console.error('échecs ' + echecs.length);
    echecs.forEach(function (e) { console.error('- ' + e); });
    process.exit(1);
}
console.log('échecs 0');
