/* Lots 3–4 : primitive d'annulation (8 s), confirmation sans confirm() et garde de séance. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync('js/pages/suppressions.js', 'utf8');
const seances = fs.readFileSync('pages/seances.html', 'utf8');
const chrono = fs.readFileSync('js/pages/pomodoro-page.js', 'utf8');
const registre = fs.readFileSync('js/registre.js', 'utf8');
assert(!seances.includes('Minuteur libre') && !seances.includes('focusEntrerPiece(true)'));
assert(chrono.includes("localStorage.getItem('studyPlanIB_focusFond')"));
assert(!chrono.includes("focusPoserFond(focusIndexParId('lumiere'), true)"));
assert(!chrono.includes("typeof selectedDay === 'number'"));
assert(chrono.includes("bouton.disabled = etat.cle !== 'encours'"));
assert(chrono.includes("focusSeanceMinuteur.date !== new Date().toDateString()"));
assert(!registre.includes("'js/pages/pomodoro.js'"));
assert(!fs.existsSync('js/pages/pomodoro.js'));
for (const fichier of ['js/memoire.js', 'js/pages/planning-interface.js', 'js/pages/exercices.js', 'js/pages/devoirs.js', 'js/pages/emploi-temps.js']) {
    assert(!/\bconfirm\s*\(/.test(fs.readFileSync(fichier, 'utf8')), fichier + ' a encore une confirmation native');
}
/* Lot 4 (DE-06) : supprimer ou annuler un devoir ou un exercice recalcule
   les révisions, sans ouvrir la fenêtre du planning. */
const devoirsSrc = fs.readFileSync('js/pages/devoirs.js', 'utf8');
const exercicesSrc = fs.readFileSync('js/pages/exercices.js', 'utf8');
const apresChangement = /function devoirsApresChangement\(\) \{([\s\S]*?)\n\}/.exec(devoirsSrc);
assert(devoirsSrc.includes('function devoirsRecalculerPlanning()') && apresChangement && apresChangement[1].includes('devoirsRecalculerPlanning();') && apresChangement[1].includes('devoirsActualiserPlanning();') && /function devoirsSupprimer[\s\S]*?devoirsApresChangement\(\)/.test(devoirsSrc), 'devoirs : suppression sans recalcul du planning');
assert(/function deleteExo[\s\S]*?function actualiser\(\) \{[\s\S]*?planningDepuisProgression\(\)/.test(exercicesSrc), 'exercices : suppression sans recalcul du planning');
const timers = [];
const nodes = [];
const document = {
    activeElement: { focus() {} },
    createElement(tag) {
        return { tag, style: {}, children: [], attrs: {}, remove() { nodes.splice(nodes.indexOf(this), 1); },
            appendChild(el) { this.children.push(el); }, setAttribute(k, v) { this.attrs[k] = v; },
            focus() { document.activeElement = this; }, querySelectorAll() { return this.children; } };
    },
    querySelectorAll(sel) { return sel === '.suppression-toast' ? nodes.filter(n => n.className === 'suppression-toast') : []; },
    getElementById(id) { return nodes.find(n => n.id === id) || null; },
    body: { appendChild(el) { nodes.push(el); } }
};
const context = vm.createContext({ document, setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; }, clearTimeout() {} });
vm.runInContext(source, context);
let valeur = 1;
let recalculs = 0;
const action = context.suppressionAvecAnnulation({ message: 'Cours supprimé',
    retirer() { valeur = 0; }, restaurer() { valeur = 1; }, actualiser() { recalculs++; } });
assert.equal(valeur, 0);
assert.equal(recalculs, 1);
assert.equal(timers[0].ms, 8000, 'la fenêtre d’annulation dure huit secondes');
assert.equal(nodes[0].attrs.role, 'status');
action.annuler();
assert.equal(valeur, 1);
assert.equal(recalculs, 2);
assert.equal(nodes.length, 0);
// Une deuxième suppression n'efface pas l'annulation de la première.
context.suppressionAvecAnnulation({ retirer() { valeur = 2; }, restaurer() { valeur = 1; } });
const autre = context.suppressionAvecAnnulation({ retirer() { valeur = 3; }, restaurer() { valeur = 2; } });
assert.equal(nodes.length, 2);
autre.annuler();
assert.equal(valeur, 2);
timers.at(-2).fn();
assert.equal(nodes.length, 0);
let confirme = false;
context.confirmerAction({ titre: 'Effacer ?', detail: 'Deux cours', confirmer() { confirme = true; } });
assert(!confirme, 'ouvrir la modale ne supprime rien');
assert.equal(nodes[0].attrs.role, 'dialog');
const actions = nodes[0].children[0].children.at(-1).children;
assert.equal(actions.length, 2);
actions[0].onclick();
assert(!confirme, 'Annuler ferme sans supprimer');
context.confirmerAction({ titre: 'Effacer ?', confirmer() { confirme = true; } });
nodes[0].children[0].children.at(-1).children.at(-1).onclick();
assert(confirme);
console.log('ok suppressions : annulation 8 secondes, actions indépendantes, modale non destructive');
