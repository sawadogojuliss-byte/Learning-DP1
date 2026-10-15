/* Vérifie le déplacement des activités du planning (clic droit → poignée).
   La durée ne doit jamais changer : seules les heures de début et de fin.
   Aucun message ne doit être affiché à l'utilisateur pour ce déplacement. */
var fs = require('fs');
var path = require('path');
var echecs = [];

function lire(rel) {
    return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}
function ok(cond, message) {
    if (!cond) echecs.push(message);
}

var interfaceJs = lire('js/pages/planning-interface.js');
var css = lire('css/pages/planning-panels.css');

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

var sectionDeplacement = interfaceJs.slice(interfaceJs.indexOf("function v3DonnerHoraireCible"));
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

if (echecs.length) {
    console.error('échecs ' + echecs.length);
    echecs.forEach(function (e) { console.error('- ' + e); });
    process.exit(1);
}
console.log('échecs 0');
