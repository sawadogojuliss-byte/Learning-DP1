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

if (echecs.length) {
    console.error('échecs ' + echecs.length);
    echecs.forEach(function (e) { console.error('- ' + e); });
    process.exit(1);
}
console.log('échecs 0');
