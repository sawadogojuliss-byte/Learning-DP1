/* Vérifie les compteurs de minuterie :
   1. le nombre d'icônes = nombre de séances choisies, dans tous les cas ;
   2. le remplissage suit le cycle (concentrations, pause courte, pause longue) ;
   3. les 18 compteurs sont là, statiques et dynamiques, sans badge PLUS ;
   4. le câblage (carte entre Style et Affichage, minuteur, registre, cache).
   Lancer : node tools/verifier-compteurs.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const racine = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');
const echecs = [];
const ok = (condition, message) => { if (!condition) echecs.push(message); };

const codeModule = lire('js/pages/minuteur-compteurs.js');
const parametres = lire('js/pages/pomodoro-parametres.js');
const minuteur = lire('js/pages/pomodoro-page.js');
const html = lire('pages/pomodoro.html');
const css = lire('css/pages/focus-parametres.css');
const registre = lire('js/registre.js');
const sw = lire('service-worker.js');

/* ── 1 et 3 : contexte isolé ───────────────────────────────────────── */
const contexte = {
    console, Math, Number, String, Array, Object,
    focusDurees: () => ({ focus: 25, short: 5, long: 15, seances: contexte.seances }),
    focusEtat: { mode: 'focus', cycles: 0 },
    seances: 4,
    document: { getElementById: () => null }
};
contexte.window = contexte;
vm.createContext(contexte);
vm.runInContext(codeModule, contexte);

const liste = contexte.FOCUS_COMPTEURS;
ok(liste.length === 18, 'il faut 18 compteurs (9 statiques + 9 dynamiques), reçu ' + liste.length);
ok(new Set(liste.map((c) => c.id)).size === liste.length, 'les identifiants de compteurs doivent être uniques');
ok(liste.filter((c) => c.groupe === 'statique').length === 9, '9 compteurs statiques attendus');
ok(liste.filter((c) => c.groupe === 'dynamique').length === 9, '9 compteurs dynamiques attendus');
const noms = liste.map((c) => c.nom);
['Points', 'Cœurs', 'Étoiles', 'Tomates', 'Boulons', 'Remise des diplômes', 'Flocon de neige', 'Bonhomme de neige', 'Sapin de Noël',
 'Médical', 'Loi', 'Art', 'Vacances à la plage', 'Ascension de montagne', 'Soirée de bien-être', 'Préparation des repas', "De la pluie à l'arc-en-ciel", 'TIGE']
    .forEach((nom) => ok(noms.indexOf(nom) !== -1, 'compteur manquant : ' + nom));
liste.filter((c) => c.groupe === 'dynamique').forEach((c) => {
    ok(Array.isArray(c.icones) && c.icones.length >= 4, 'compteur dynamique sans 4 icônes : ' + c.nom);
});
ok(!/PLUS/.test(codeModule) && !/badge/i.test(codeModule), 'aucun badge PLUS ni verrou dans les compteurs');
const violet = /#(7c3aed|8b5cf6|a855f7|9333ea|6d28d9|7e22ce|c084fc|a78bfa|ddd6fe|6366f1|4f46e5)\b|\bpurple\b|\bviolet\b|rgba?\(\s*(139|168|124|147|109)\s*,\s*(92|85|58|51|40|34)/i;
ok(!violet.test(codeModule), 'minuteur-compteurs.js ne doit pas contenir de violet');

/* Le nombre d'icônes correspond exactement au nombre de séances, pour chaque compteur et chaque valeur. */
let mauvais = [];
liste.forEach((c) => {
    for (let n = 1; n <= 12; n++) {
        for (let plein = 0; plein <= n; plein++) {
            const html = contexte.focusCompteurHtml(c.id, n, plein);
            const total = (html.match(/focus-compteur-item/g) || []).length;
            const allumees = (html.match(/is-plein/g) || []).length;
            if (total !== n || allumees !== plein) mauvais.push(c.id + ' n=' + n + ' plein=' + plein + ' → ' + total + '/' + allumees);
        }
    }
});
ok(mauvais.length === 0, 'nombre d’icônes incorrect : ' + mauvais.slice(0, 3).join(' ; '));

/* Icônes dynamiques : chacune a son icône, en boucle au-delà de 4. */
const dyn = liste.filter((c) => c.id === 'medical')[0];
const sixIcones = contexte.focusCompteurHtml('medical', 6, 6);
ok(sixIcones.indexOf('🥼') !== -1 && sixIcones.indexOf('🧠') !== -1 && sixIcones.indexOf('📈') !== -1, 'un compteur dynamique doit montrer ses icônes');
ok(dyn && sixIcones.split('🥼').length - 1 === 2, 'au-delà de 4 minuteurs, le compteur dynamique reprend ses icônes en boucle');
ok(contexte.focusCompteurHtml('points', 4, 1).indexOf('<svg') !== -1, 'le compteur Points doit être dessiné (point)');
ok(contexte.focusCompteurHtml('coeurs', 4, 1).indexOf('<svg') !== -1, 'le compteur Cœurs doit être dessiné (cœur)');

/* ── 2. Remplissage selon le cycle, en séances de 4 ─────────────────── */
function etat(cycles, mode, seancesChoisies) {
    contexte.seances = seancesChoisies || 4;
    contexte.focusEtat.cycles = cycles;
    contexte.focusEtat.mode = mode;
    return contexte.focusCompteurEtat();
}
const attendu = [
    // [cycles, mode, plein attendu] avec 4 séances
    [0, 'focus', 0],   // début : tout éteint
    [1, 'short', 1],   // 1re concentration finie → pause courte, 1 allumé
    [1, 'focus', 1],   // concentration suivante, toujours 1
    [2, 'short', 2],
    [3, 'short', 3],
    [4, 'long', 4],    // 4e concentration finie → pause longue, tout allumé
    [4, 'focus', 0],   // après la pause longue : nouveau cycle, tout éteint
    [5, 'short', 1]
];
attendu.forEach(([c, m, p]) => {
    const r = etat(c, m, 4);
    ok(r.n === 4 && r.plein === p, 'cycle ' + c + ' (' + m + ') : ' + p + ' allumé(s) attendu(s), reçu ' + r.plein + ' sur ' + r.n);
});
const un = etat(1, 'long', 1);
ok(un.n === 1 && un.plein === 1, 'une seule séance : la pause longue arrive après chaque concentration');
const un2 = etat(1, 'focus', 1);
ok(un2.plein === 0, 'une seule séance : la concentration suivante repart à zéro');
const douze = etat(12, 'long', 12);
ok(douze.n === 12 && douze.plein === 12, '12 séances : cycle complet allumé');
const manuel = etat(2, 'long', 4);
ok(manuel.plein === 2, 'une pause longue lancée à la main en plein cycle n’allume pas tout');

/* Réglage : valeur inconnue → Points. */
ok(parametres.indexOf("compteur: dans(FOCUS_COMPTEURS, b.compteur, 'points')") !== -1, 'le réglage compteur doit revenir à Points si la valeur est inconnue');

/* ── 4. Câblage ────────────────────────────────────────────────────── */
const iStyle = html.indexOf('Style du minuteur');
const iCompteurs = html.indexOf('Compteurs de minuterie');
const iAffichage = html.indexOf('<summary><h3>Affichage');
ok(iStyle !== -1 && iCompteurs > iStyle && iAffichage > iCompteurs, 'la carte Compteurs doit être entre « Style du minuteur » et « Affichage »');
['focusCompteur', 'focusCompteurNom', 'focusCompteurBouton', 'focusCompteurListe', 'focusCompteurStatique', 'focusCompteurDynamique'].forEach((id) => {
    ok(html.indexOf('id="' + id + '"') !== -1, 'élément manquant : ' + id);
});
ok(html.indexOf('class="focus-modes"') < html.indexOf('id="focusCompteur"') && html.indexOf('id="focusCompteur"') < html.indexOf('id="focusTime"'), 'le compteur doit être juste sous la rangée CONCENTRATION / PAUSE, au-dessus du temps');
ok(parametres.indexOf('focusCompteurTuile') !== -1 && parametres.indexOf('focusMarquerCompteurs') !== -1, 'les grilles et la sélection des compteurs doivent être branchées');
ok(minuteur.indexOf('focusPeindreCompteur()') !== -1, 'le minuteur doit peindre son compteur');
ok(registre.indexOf("'js/pages/minuteur-compteurs.js'") !== -1, 'minuteur-compteurs.js doit être dans le registre');
ok(registre.indexOf("'js/pages/minuteur-compteurs.js'") < registre.indexOf("'js/pages/pomodoro-page.js'"), 'minuteur-compteurs.js doit se charger avant le minuteur');
ok(sw.indexOf('"js/pages/minuteur-compteurs.js"') !== -1, 'minuteur-compteurs.js doit être dans le cache hors ligne');
ok(css.indexOf('.focus-compteur-item.is-vide') !== -1 && css.indexOf('.focus-tuile-compteur') !== -1, 'les styles des compteurs doivent exister');
ok(!/focus-compteur[^{]*\{[^}]*(#7c3aed|#8b5cf6|#a855f7|#6d28d9)/i.test(css), 'les compteurs ne doivent pas être en violet');

/* ── Bilan ─────────────────────────────────────────────────────────── */
if (echecs.length) {
    console.error('Compteurs : ' + echecs.length + ' échec(s)');
    echecs.forEach((e) => console.error(' - ' + e));
    process.exit(1);
}
console.log('Compteurs : 0 échec (18 compteurs, icônes = séances, cycle, câblage)');
