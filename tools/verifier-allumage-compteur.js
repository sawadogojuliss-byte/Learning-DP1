/* Test : les compteurs de la série de révision.
   - au lancement d'une série, le 1er compteur s'allume dès que la concentration démarre ;
   - chaque séance terminée allume le suivant ;
   - le cumul de la journée (cycles) ne compte plus ;
   - après la 3e séance : pause longue ; sinon pause courte.
   Lancer : node tools/verifier-allumage-compteur.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const racine = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(racine, 'js/pages/minuteur-compteurs.js'), 'utf8');

function contexte(etat, seances) {
    const ctx = {
        focusEtat: Object.assign({ mode: 'focus', restant: 1500, total: 1500, running: false, cycles: 0, serie: 0, run: false }, etat),
        focusDurees: () => ({ seances: seances || 4 }),
    };
    vm.createContext(ctx);
    vm.runInContext(code + '\n;this.focusPauseApres = focusPauseApres; this.resultat = focusCompteurEtat();', ctx);
    return ctx;
}

function pleins(etat, seances) {
    return contexte(etat, seances).resultat.plein;
}

const cas = [
    ['hors série : rien d\'allumé, même avec un cumul de la journée', { cycles: 3 }, 0],
    ['série lancée, concentration démarrée : le 1er s\'allume', { run: true, running: true, restant: 1400 }, 1],
    ['série lancée, concentration en pause manuelle : le 1er reste allumé', { run: true, running: false, restant: 1400 }, 1],
    ['série lancée, concentration pas encore démarrée : rien d\'allumé', { run: true, running: false, restant: 1500 }, 0],
    ['1 séance faite, pause courte : 1 allumé', { run: true, mode: 'short', running: true, restant: 200, serie: 1 }, 1],
    ['2e séance démarrée : 2 allumés', { run: true, running: true, restant: 900, serie: 1 }, 2],
    ['2 faites, 3e démarrée : 3 allumés', { run: true, running: true, restant: 900, serie: 2 }, 3],
    ['série terminée (4 faites sur 4) : tout allumé', { run: false, mode: 'focus', running: false, restant: 1500, serie: 4 }, 4],
    ['nouvelle série : le cumul de la journée ne compte pas', { run: true, running: true, restant: 1400, serie: 0, cycles: 7 }, 1],
    ['plafond : jamais plus de séances que choisi', { run: true, running: true, restant: 900, serie: 9 }, 4],
];

const reglesPause = [
    [1, 'short'], [2, 'short'], [3, 'long'], [4, 'short'], [5, 'short'], [6, 'long'],
];

let echecs = 0;
cas.forEach(function (c) {
    const obtenu = pleins(c[1]);
    if (obtenu !== c[2]) {
        echecs += 1;
        console.log('ÉCHEC : ' + c[0] + ' (obtenu ' + obtenu + ', attendu ' + c[2] + ')');
    }
});

const ctx = contexte({});
reglesPause.forEach(function (r) {
    const obtenu = ctx.focusPauseApres(r[0]);
    if (obtenu !== r[1]) {
        echecs += 1;
        console.log('ÉCHEC : pause après la séance ' + r[0] + ' (obtenu ' + obtenu + ', attendu ' + r[1] + ')');
    }
});

const total = cas.length + reglesPause.length;
console.log(echecs ? echecs + ' échec(s) sur ' + total : 'Compteurs de série : 0 échec (' + total + ' cas)');
process.exit(echecs ? 1 : 0);
