#!/usr/bin/env node
/* ============================================================
   Vérificateur — Musique (Sons d'ambiance de la page Séance)
   1. La tomate remplace le minuteur dans le menu Pomodoro.
   2. Le panneau Sons existe sur la page Séance de révision du jour,
      comme dans le minuteur.
   3. La section Playlist est totalement retirée (Spotify puis YouTube
      ont été abandonnés : leurs lecteurs intégrés refusaient trop
      souvent de jouer) : plus de bouton, plus de panneau, plus de
      stockage, plus de styles.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const echecs = [];
function ok(cond, message) { if (!cond) echecs.push(message); }

/* ── 1. Statique ───────────────────────────────────────────────────── */
const planningHtml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'planning.html'), 'utf8');
const pomodoroHtml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'pomodoro.html'), 'utf8');
const seancesHtml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'seances.html'), 'utf8');
const musiqueJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'musique.js'), 'utf8');
const registreJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'registre.js'), 'utf8');
const memoireJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'memoire.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'pages', 'planning-panels.css'), 'utf8');
const navJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'navigation.js'), 'utf8');
const pomodoroPageJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'pomodoro-page.js'), 'utf8');

const blocPomodoro = planningHtml.slice(planningHtml.indexOf('id="menuMinuteur"'), planningHtml.indexOf('</button>', planningHtml.indexOf('id="menuMinuteur"')));
ok(blocPomodoro.indexOf('🍅') !== -1, 'le menu Pomodoro doit montrer une tomate 🍅');
ok(blocPomodoro.indexOf('⏱') === -1, 'le menu Pomodoro ne doit plus montrer le minuteur ⏱️');

ok(pomodoroHtml.indexOf('id="focusBtnSon"') !== -1, 'le minuteur Pomodoro doit garder son bouton Sons');
ok(seancesHtml.indexOf('id="accueilBtnSons"') !== -1 && seancesHtml.indexOf('focusBasculerSonsAccueil()') !== -1,
    'la page Séance du jour doit avoir le bouton Sons');
ok(musiqueJs.indexOf('accueilSonsGrille') !== -1, 'le panneau Sons de la page Séance manque');
ok(musiqueJs.indexOf('focusFermerMusique') !== -1, 'la fermeture des panneaux musique manque');
ok(registreJs.indexOf('js/pages/musique.js') !== -1, 'le script musique.js manque au registre');
ok(css.indexOf('.musique-flottant') !== -1, 'le panneau flottant des sons n\u2019est pas stylé');
ok(css.indexOf('.focus-accueil-musique') !== -1, 'la barre sons de la page Séance n\u2019est pas stylée');
ok(navJs.indexOf('focusFermerMusique') !== -1, 'la navigation doit fermer le panneau des sons');
ok(pomodoroPageJs.indexOf('focusFermerMusique') !== -1, 'les boutons du minuteur doivent fermer le panneau des sons');

/* ── 2. La Playlist totalement retirée ─────────────────────────────── */
[pomodoroHtml, seancesHtml, musiqueJs, memoireJs, css].forEach(function (texte, i) {
    var nom = ['pages/pomodoro.html', 'pages/seances.html', 'js/pages/musique.js', 'js/memoire.js', 'css/pages/planning-panels.css'][i];
    ok(texte.toLowerCase().indexOf('playlist') === -1, 'la Playlist doit disparaître de ' + nom);
    ok(texte.toLowerCase().indexOf('youtube') === -1, 'YouTube doit disparaître de ' + nom);
    ok(texte.toLowerCase().indexOf('spotify') === -1, 'Spotify doit disparaître de ' + nom);
});
ok(css.indexOf('.fp-') === -1, 'les styles de la Playlist (.fp-) doivent disparaître');
ok(pomodoroHtml.indexOf('focusBtnPlaylist') === -1, 'le bouton Playlist doit disparaître du minuteur');
ok(seancesHtml.indexOf('accueilBtnPlaylist') === -1, 'le bouton Playlist doit disparaître de la page Séance');

/* ── 3. Le module ne plante jamais sans page ───────────────────────── */
const store = {};
const context = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    setTimeout: setTimeout,
    localStorage: {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
    },
    document: {
        getElementById: function () { return null; },
        createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; },
        body: { appendChild: function () {} },
        addEventListener: function () {}
    }
};
context.window = context;
vm.createContext(context);
vm.runInContext(musiqueJs, context);
ok(typeof context.playlistLire === 'undefined', 'aucune fonction playlist ne doit exister');
try {
    context.focusBasculerSonsAccueil();
    context.focusFermerMusique();
    context.accueilPeindreSons();
    context.accueilPauseSon();
    context.accueilReinitSon();
    context.accueilFiltrerSons();
} catch (e) {
    ok(false, 'les fonctions des sons ne doivent pas planter sans panneau : ' + e.message);
}

/* ── Bilan ─────────────────────────────────────────────────────────── */
if (echecs.length) {
    console.error('Musique : échecs ' + echecs.length);
    echecs.forEach(function (e) { console.error(' - ' + e); });
    process.exit(1);
}
console.log('ok musique : tomate 🍅 au menu Pomodoro, panneau Sons sur la page Séance de révision du jour, la section Playlist (Spotify puis YouTube) totalement retirée des deux pages, du stockage, du compte et des styles');
