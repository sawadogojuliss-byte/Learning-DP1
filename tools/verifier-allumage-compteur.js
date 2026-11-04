/* Test : le compteur de séances s'allume dès que la séance de concentration démarre.
   Lancer : node tools/verifier-allumage-compteur.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const racine = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(racine, 'js/pages/minuteur-compteurs.js'), 'utf8');

function pleins(etat) {
    const ctx = {
        focusEtat: Object.assign({ mode: 'focus', restant: 1500, total: 1500, running: false, cycles: 0 }, etat),
        focusDurees: () => ({ seances: 4 }),
    };
    vm.createContext(ctx);
    vm.runInContext(code + '\n;this.resultat = focusCompteurEtat();', ctx);
    return ctx.resultat.plein;
}

const cas = [
    ['avant démarrage, aucune séance faite', {}, 0],
    ['séance démarrée, aucune faite : le 1er s\'allume', { running: true, restant: 1400 }, 1],
    ['séance en pause en cours : le 1er reste allumé', { running: false, restant: 1400 }, 1],
    ['séance recommencée (pas démarrée) : rien d\'allumé', { running: false, restant: 1500 }, 0],
    ['2 faites, 3e démarrée : 3 allumés', { running: true, restant: 900, cycles: 2 }, 3],
    ['pause courte après 1 faite : 1 allumé', { mode: 'short', running: true, restant: 200, cycles: 1 }, 1],
    ['cycle complet en pause longue : tout allumé', { mode: 'long', running: true, restant: 200, cycles: 4 }, 4],
];

let echecs = 0;
cas.forEach(function (c) {
    const obtenu = pleins(c[1]);
    if (obtenu !== c[2]) {
        echecs += 1;
        console.log('ÉCHEC : ' + c[0] + ' (obtenu ' + obtenu + ', attendu ' + c[2] + ')');
    }
});

console.log(echecs ? echecs + ' échec(s) sur ' + cas.length : 'Allumage du compteur : 0 échec (' + cas.length + ' cas)');
process.exit(echecs ? 1 : 0);
