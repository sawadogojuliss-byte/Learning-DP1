/* Vérifie les compteurs de minuterie :
   1. le nombre d'icônes = nombre de séances choisies, dans tous les cas ;
   2. le remplissage suit la série de révision (une icône par séance terminée) ;
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
    focusEtat: { mode: 'focus', cycles: 0, serie: 0, run: false },
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

/* ── 2. Remplissage selon la série de révision, en séances de 4 ────── */
function etat(f, seancesChoisies) {
    contexte.seances = seancesChoisies || 4;
    contexte.focusEtat = Object.assign({ mode: 'focus', cycles: 0, serie: 0, run: false, running: false, restant: 1500, total: 1500 }, f);
    return contexte.focusCompteurEtat();
}
const attendu = [
    // [réglages de l'état, plein attendu] avec 4 séances
    [{ run: true, running: true, restant: 1400 }, 1],                       // 1re concentration lancée : 1 allumé
    [{ run: true, mode: 'short', running: true, restant: 200, serie: 1 }, 1], // pause courte après la 1re
    [{ run: true, running: true, restant: 1400, serie: 1 }, 2],             // 2e lancée
    [{ run: true, mode: 'short', running: true, restant: 200, serie: 2 }, 2],
    [{ run: true, running: true, restant: 1400, serie: 2 }, 3],             // 3e lancée
    [{ run: true, mode: 'long', running: true, restant: 900, serie: 3 }, 3], // pause longue après la 3e
    [{ run: true, running: true, restant: 1400, serie: 3 }, 4],            // 4e lancée
    [{ run: false, running: false, restant: 1500, serie: 4 }, 4],          // série terminée : tout allumé
    [{ run: true, running: false, restant: 1400, serie: 2 }, 3],           // 3e en pause manuelle : reste allumée
    [{ run: true, running: false, restant: 1500, serie: 2 }, 2],           // 3e pas encore démarrée
    [{ run: false, running: true, restant: 1400, serie: 0, cycles: 9 }, 0], // hors série : rien, même avec le cumul
    [{ run: false, running: false, restant: 1500, serie: 0 }, 0],
];
attendu.forEach(([f, p]) => {
    const r = etat(f, 4);
    ok(r.n === 4 && r.plein === p, 'série ' + JSON.stringify(f) + ' : ' + p + ' allumé(s) attendu(s), reçu ' + r.plein + ' sur ' + r.n);
});
const un = etat({ run: true, running: true, restant: 1400, serie: 0 }, 1);
ok(un.n === 1 && un.plein === 1, 'une seule séance : la 1re s\'allume au lancement');
const douze = etat({ run: false, running: false, restant: 1500, serie: 12 }, 12);
ok(douze.n === 12 && douze.plein === 12, '12 séances : série terminée tout allumée');
const plafond = etat({ run: true, running: true, restant: 900, serie: 9 }, 4);
ok(plafond.plein === 4, 'jamais plus d’icônes allumées que de séances choisies');

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
