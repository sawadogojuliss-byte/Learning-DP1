/* Vérifie la rubrique Statistiques des Paramètres du minuteur :
   1. les calculs (périodes, totaux, score, semaine) sur des dates fixes ;
   2. le stockage local (données abîmées, plafond, retrait d'une tâche) ;
   3. le câblage : menu, page, scripts, points d'accroche du minuteur ;
   4. aucun envoi réseau ni écriture Firestore dans le module.
   Lancer : node tools/verifier-statistiques.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const racine = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');
let echecs = [];
const ok = (condition, message) => { if (!condition) echecs.push(message); };

const stats = lire('js/pages/statistiques.js');
const minuteurJs = lire('js/pages/pomodoro-page.js');
const parametresJs = lire('js/pages/pomodoro-parametres.js');
const html = lire('pages/pomodoro.html');
const css = lire('css/pages/focus-parametres.css');
const registre = lire('js/registre.js');
const sw = lire('service-worker.js');

/* ── 1. Calculs sur des dates fixes ───────────────────────────────── */
function nouveauContexte(contenuStockage) {
    const store = {};
    if (contenuStockage !== undefined) store['studyPlanIB_statsFocus'] = contenuStockage;
    const contexte = {
        console, Date, JSON, Math, Number, String, Array, Object, parseInt, isFinite, isNaN,
        document: { getElementById: () => null, createElement: () => ({}), createElementNS: () => ({}) },
        localStorage: {
            getItem: (k) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; }
        },
        store
    };
    contexte.window = contexte;
    vm.createContext(contexte);
    vm.runInContext(stats, contexte);
    return contexte;
}

const mercredi = new Date(2026, 10, 4, 10, 0, 0); // mercredi 4 novembre 2026
const dans = (d, k, extra) => Object.assign({ k: k, d: d }, extra || {});
const entrees = [
    dans('2026-11-04', 'focus', { m: 25, s: 'seance-1' }),
    dans('2026-11-03', 'focus', { m: 25 }),
    dans('2026-11-01', 'focus', { m: 25 }),
    dans('2026-11-04', 'short', { m: 5 }),
    dans('2026-11-04', 'lance'), dans('2026-11-04', 'lance'), dans('2026-11-04', 'lance'), dans('2026-11-04', 'lance'),
    dans('2026-11-03', 'lance'),
    dans('2026-11-03', 'tache', { id: 'a' })
];
const c = nouveauContexte(JSON.stringify(entrees));

const jour = c.statsResume('jour', mercredi, entrees);
ok(jour.minutesFocus === 25 && jour.minuteurs === 1, 'aujourd’hui : 1 minuteur de 25 min attendu, reçu ' + jour.minutesFocus + ' / ' + jour.minuteurs);
ok(jour.lances === 4 && jour.score === 25, 'aujourd’hui : score 1 sur 4 lancés = 25 %, reçu ' + jour.score);
ok(jour.minutesPause === 5 && jour.pauses === 1, 'aujourd’hui : une pause de 5 min attendue');
ok(jour.taches === 0, 'aujourd’hui : la tâche du 3 ne doit pas compter');

const semaine = c.statsResume('semaine', mercredi, entrees);
ok(c.statsDebut('semaine', mercredi) === '2026-11-02', 'la semaine doit commencer le lundi 2 novembre');
ok(semaine.minuteurs === 2 && semaine.minutesFocus === 50, 'semaine : 2 minuteurs, 50 min attendus, reçu ' + semaine.minuteurs + ' / ' + semaine.minutesFocus);
ok(semaine.score === 40 && semaine.lances === 5, 'semaine : score 2 sur 5 = 40 %, reçu ' + semaine.score);
ok(semaine.taches === 1, 'semaine : la tâche du 3 novembre doit compter');

const mois = c.statsResume('mois', mercredi, entrees);
ok(mois.minuteurs === 3 && mois.minutesFocus === 75, 'mois : 3 minuteurs (dont le 1er) attendus, reçu ' + mois.minuteurs);
ok(c.statsResume('tout', mercredi, entrees).minuteurs === 3, 'tout : même total que le mois ici');

ok(c.statsDebut('trois', mercredi) === '2026-08-04', '3 mois : départ le 4 août 2026');
ok(c.statsDebut('six', mercredi) === '2026-05-04', '6 mois : départ le 4 mai 2026');
ok(c.statsDebut('annee', mercredi) === '2025-11-04', '1 an : départ le 4 novembre 2025');
ok(c.statsDebut('tout', mercredi) === '', '« Tout » : aucune borne de départ');

const sansLance = c.statsResume('tout', mercredi, [dans('2026-11-04', 'focus', { m: 25 })]);
ok(sansLance.score === null, 'sans minuteur lancé, le score doit être vide (null)');
const trop = c.statsResume('tout', mercredi, [dans('2026-11-04', 'lance'), dans('2026-11-04', 'focus', { m: 25 }), dans('2026-11-04', 'focus', { m: 25 })]);
ok(trop.score === 100, 'le score ne dépasse jamais 100 %');

const jours = c.statsSemaine(mercredi, entrees);
ok(jours.length === 7 && jours[0].cle === '2026-11-02' && jours[6].cle === '2026-11-08', 'la semaine doit aller du lundi 2 au dimanche 8 novembre');
ok(jours[1].minutes === 25 && jours[2].minutes === 25 && jours[2].aujourdhui === true, 'semaine : 25 min le mardi 3 et le mercredi 4 (aujourd’hui)');
ok(jours[3].futur === true && jours[2].futur === false, 'les jours après aujourd’hui doivent être marqués « à venir »');
ok(jours[0].minutes === 0, 'le 1er novembre (semaine précédente) ne doit pas figurer dans la semaine');

ok(c.statsDuree(0) === '0 min' && c.statsDuree(25) === '25 min' && c.statsDuree(60) === '1 h' && c.statsDuree(80) === '1 h 20', 'format des durées');

/* ── 2. Stockage local ─────────────────────────────────────────────── */
const abime = nouveauContexte('{pas du json');
ok(abime.statsLire().length === 0, 'des données abîmées ne doivent pas planter la lecture');
const pasTableau = nouveauContexte('{"a":1}');
ok(pasTableau.statsLire().length === 0, 'un contenu qui n’est pas une liste doit être ignoré');
const melange = nouveauContexte(JSON.stringify([{ k: 'focus', d: '2026-11-04', m: 25 }, { k: 'inconnu', d: '2026-11-04' }, { k: 'focus', d: 'n’importe quoi' }, null]));
ok(melange.statsLire().length === 1, 'seules les entrées valides doivent être gardées');

const vide = nouveauContexte();
vide.statsEnregistrer({ k: 'focus', m: 25, s: 'seance-9' });
vide.statsEnregistrer({ k: 'lance' });
vide.statsEnregistrer({ k: 'pas-un-type', m: 3 });
const relu = vide.statsLire();
ok(relu.length === 2, 'un type inconnu ne doit pas être enregistré');
ok(relu[0].k === 'focus' && relu[0].m === 25 && relu[0].s === 'seance-9', 'la concentration doit garder sa durée et sa séance');
ok(/^\d{4}-\d{2}-\d{2}$/.test(relu[0].d), 'la date doit être au format AAAA-MM-JJ');

vide.statsEnregistrer({ k: 'tache', id: 7 });
vide.statsEnregistrer({ k: 'tache', id: 8 });
vide.statsRetirerTache(7);
const apres = vide.statsLire().filter((e) => e.k === 'tache');
ok(apres.length === 1 && apres[0].id === '8', 'décocher une tâche doit retirer sa coche, pas les autres');

const plein = [];
for (let i = 0; i < 6005; i++) plein.push({ k: 'lance', d: '2026-11-04' });
const trim = nouveauContexte(JSON.stringify(plein));
trim.statsEnregistrer({ k: 'lance' });
ok(trim.statsLire().length === 6000, 'le journal doit être limité à 6 000 entrées');

/* ── 3. Câblage ─────────────────────────────────────────────────────── */
ok(/data-onglet="statistiques"/.test(html) && /data-page="statistiques"/.test(html), 'le menu et la page Statistiques doivent exister');
ok(/<h2>Statistiques<\/h2>/.test(html), 'le titre de la page doit être « Statistiques »');
['statsPeriodes', 'statsCartes', 'statsSemaine', 'statsVide'].forEach((id) => {
    ok(html.indexOf('id="' + id + '"') !== -1, 'élément manquant dans la page : ' + id);
});
ok(registre.indexOf("'js/pages/statistiques.js'") !== -1, 'statistiques.js doit être dans le registre des scripts');
ok(registre.indexOf("'js/pages/statistiques.js'") < registre.indexOf("'js/pages/pomodoro-page.js'"), 'statistiques.js doit se charger avant le minuteur');
ok(sw.indexOf('"js/pages/statistiques.js"') !== -1, 'statistiques.js doit être dans le cache hors ligne');
ok(parametresJs.indexOf("'statistiques'") !== -1 && parametresJs.indexOf("statsPeindre()") !== -1, 'l’onglet doit peindre les statistiques à l’ouverture');
ok(minuteurJs.indexOf('statsEnregistrer({ k: fini') !== -1, 'la fin d’une phase doit être enregistrée');
ok(minuteurJs.indexOf('focusCompterLancement();') !== -1 && parametresJs.indexOf('focusCompterLancement()') !== -1, 'les lancements doivent être comptés, à la main et en enchaînement');
ok(minuteurJs.indexOf('statsRetirerTache(tache.id)') !== -1, 'décocher une tâche doit la retirer des statistiques');
ok(css.indexOf('.stats-carte-serie') !== -1 && css.indexOf('.stats-jours') !== -1, 'les styles des cartes et du calendrier doivent exister');
ok(css.indexOf('.stats-jour') !== -1 && /stats-carte-pause[^}]*#052e22/.test(css), 'la carte pause doit avoir un texte sombre lisible');

/* ── 4. Pas de réseau ni d’écriture Firestore ───────────────────────── */
const codeSeul = stats.replace(/\/\*[\s\S]*?\*\//g, '');
['fetch(', 'XMLHttpRequest', 'firebase', 'Firestore', 'firestore', 'compteFlammesPousser', 'synchro', 'sendBeacon', 'WebSocket'].forEach((mot) => {
    ok(codeSeul.indexOf(mot) === -1, 'statistiques.js ne doit pas contenir « ' + mot + ' »');
});

/* ── Bilan ─────────────────────────────────────────────────────────── */
if (echecs.length) {
    console.error('Statistiques : ' + echecs.length + ' échec(s)');
    echecs.forEach((e) => console.error(' - ' + e));
    process.exit(1);
}
console.log('Statistiques : 0 échec (calculs par période, score, semaine, stockage, câblage, pas de réseau)');
