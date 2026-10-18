#!/usr/bin/env node
/* ============================================================
   Vérificateur — Musique (Playlist YouTube, Sons)
   1. La tomate remplace le minuteur dans le menu Pomodoro.
   2. La section Playlist existe à côté des Sons sur les DEUX pages
      (minuteur Pomodoro et Séance de révision du jour).
   3. Spotify est totalement retiré (son API est devenue payante et
      fermée) : plus de connexion, plus de liens Spotify acceptés —
      un message clair guide vers YouTube.
   4. Les liens YouTube sont reconnus sous toutes leurs formes, le
      store garde les playlists, elles suivent le compte.
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
const configJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'config.js'), 'utf8');
const registreJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'registre.js'), 'utf8');
const memoireJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'memoire.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'pages', 'planning-panels.css'), 'utf8');
const navJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'navigation.js'), 'utf8');
const pomodoroPageJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages', 'pomodoro-page.js'), 'utf8');

const blocPomodoro = planningHtml.slice(planningHtml.indexOf('id="menuMinuteur"'), planningHtml.indexOf('</button>', planningHtml.indexOf('id="menuMinuteur"')));
ok(blocPomodoro.indexOf('🍅') !== -1, 'le menu Pomodoro doit montrer une tomate 🍅');
ok(blocPomodoro.indexOf('⏱') === -1, 'le menu Pomodoro ne doit plus montrer le minuteur ⏱️');

ok(pomodoroHtml.indexOf('id="focusBtnPlaylist"') !== -1 && pomodoroHtml.indexOf('focusBasculerPlaylist()') !== -1,
    'le minuteur Pomodoro doit avoir le bouton Playlist à côté du bouton Sons');
ok(pomodoroHtml.indexOf('id="focusBtnPlaylist"') > pomodoroHtml.indexOf('id="focusBtnSon"'),
    'le bouton Playlist doit venir juste après le bouton Sons');
ok(seancesHtml.indexOf('id="accueilBtnSons"') !== -1 && seancesHtml.indexOf('focusBasculerSonsAccueil()') !== -1,
    'la page Séance du jour doit avoir le bouton Sons');
ok(seancesHtml.indexOf('id="accueilBtnPlaylist"') !== -1 && seancesHtml.indexOf('focusBasculerPlaylist()') !== -1,
    'la page Séance du jour doit avoir le bouton Playlist');
ok(registreJs.indexOf('js/pages/musique.js') !== -1, 'le script musique.js manque au registre');
ok(registreJs.indexOf('js/pages/musique.js') < registreJs.indexOf('js/memoire.js'),
    'musique.js doit se charger avant memoire.js (les playlists suivent le compte dès la restauration)');
ok(memoireJs.indexOf('playlistCompact') !== -1, 'les playlists ne voyagent pas avec le compte');
ok(memoireJs.indexOf('playlistEcrire') !== -1, 'les playlists du compte ne sont pas restaurées');
ok(css.indexOf('.musique-flottant') !== -1, 'les panneaux flottants musique ne sont pas stylés');
ok(css.indexOf('.focus-accueil-musique') !== -1, 'la barre musique de la page Séance n\u2019est pas stylée');
ok(css.indexOf('.fp-carte') !== -1 && css.indexOf('.fp-lecteur') !== -1, 'le rendu des playlists manque de styles');
ok(musiqueJs.indexOf('function playlistDetecterLien') !== -1, 'la reconnaissance des liens manque');
ok(musiqueJs.indexOf('youtube-nocookie.com/embed/videoseries') !== -1, 'le lecteur YouTube intégré manque');
ok(musiqueJs.indexOf('Partager') !== -1, 'l\u2019aide pour copier le lien YouTube manque');
ok(musiqueJs.indexOf('RD(?!CLB)') !== -1, 'les Mix automatiques (RD…) doivent être refusés, pas les charts RDCLB');
ok(musiqueJs.indexOf('Ouvrir sur YouTube') !== -1, 'la porte de secours vers YouTube manque');
ok(css.indexOf('.fp-secours') !== -1, 'le style de la porte de secours manque');
ok(navJs.indexOf('focusFermerMusique') !== -1, 'la navigation doit fermer les panneaux musique');
ok(pomodoroPageJs.indexOf('focusFermerMusique') !== -1, 'les boutons du minuteur doivent fermer les panneaux musique');

/* ── 2. Spotify totalement retiré ──────────────────────────────────── */
ok(configJs.indexOf('SPOTIFY') === -1, 'la configuration Spotify doit disparaître');
ok(musiqueJs.indexOf('accounts.spotify.com') === -1, 'la connexion Spotify doit disparaître');
ok(musiqueJs.indexOf('api.spotify.com') === -1, 'l\u2019API Spotify doit disparaître');
ok(musiqueJs.indexOf('open.spotify.com/embed') === -1, 'le lecteur Spotify intégré doit disparaître');
ok(musiqueJs.indexOf('function spotifySeConnecter') === -1, 'le bouton de connexion Spotify doit disparaître');
ok(css.toLowerCase().indexOf('spotify') === -1, 'les styles Spotify doivent disparaître');

/* ── 3. La reconnaissance des liens YouTube ────────────────────────── */
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
vm.runInContext(configJs, context);
vm.runInContext(musiqueJs, context);

function detecte(lien) {
    var r = context.playlistDetecterLien(lien);
    if (!r) return null;
    if (r.mix) return 'mix:' + r.cle;
    return r.service + ':' + r.cle + (r.video ? '@' + r.video : '');
}
ok(detecte('https://www.youtube.com/playlist?list=PLabc123def') === 'youtube:PLabc123def', 'lien playlist YouTube');
ok(detecte('youtube.com/playlist?list=PLabc123def') === 'youtube:PLabc123def', 'lien sans https://');
ok(detecte('https://m.youtube.com/playlist?list=PLm123') === 'youtube:PLm123', 'lien mobile m.youtube.com');
ok(detecte('https://music.youtube.com/playlist?list=RDCLB-xyz') === 'youtube:RDCLB-xyz', 'lien YouTube Music (chart RDCLB, vraie playlist)');
ok(detecte('https://youtu.be/video12345?list=PLxyz') === 'youtube:PLxyz@video12345', 'lien youtu.be avec liste : le lecteur démarre sur la vidéo');
ok(detecte('https://www.youtube.com/watch?v=abc12345&list=PLdef&si=xyz') === 'youtube:PLdef@abc12345', 'lien watch YouTube avec liste et vidéo');
ok(detecte('https://www.youtube-nocookie.com/embed/videoseries?list=PLnoc') === 'youtube:PLnoc', 'lien lecteur intégré YouTube');
ok(detecte('  https://www.youtube.com/playlist?list=PLesp  ') === 'youtube:PLesp', 'lien avec espaces autour');
ok(detecte('https://www.youtube.com/watch?v=abcdefgh&list=RDGMEMxyz') === 'mix:RDGMEMxyz', 'un lien de Mix (RD…) doit être reconnu comme Mix');
ok(detecte('https://www.youtube.com/watch?v=abcdefgh&list=RDMMperso') === 'mix:RDMMperso', 'un lien de Mix personnel (RDMM) doit être reconnu comme Mix');
ok(detecte('https://www.youtube.com/watch?v=abc') === null, 'une vidéo YouTube sans liste doit être refusée');
ok(detecte('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=x') === null, 'un lien Spotify doit être refusé');
ok(detecte('spotify:playlist:abcDEF123') === null, 'une URI Spotify doit être refusée');
ok(detecte('bonjour') === null, 'un texte quelconque doit être refusé');

/* l'embed porte le bon lecteur, avec ou sans vidéo de départ */
const lienPlaylist = context.playlistDetecterLien('https://www.youtube.com/playlist?list=PLabc');
ok(lienPlaylist.embed.indexOf('https://www.youtube-nocookie.com/embed/videoseries?list=PLabc') === 0, 'embed YouTube : ' + lienPlaylist.embed);
const lienWatch = context.playlistDetecterLien('https://www.youtube.com/watch?v=abc12345&list=PLdef');
ok(lienWatch.embed === 'https://www.youtube-nocookie.com/embed/abc12345?list=PLdef', 'embed démarrant sur la vidéo du lien : ' + lienWatch.embed);

/* ── 4. Le store, les refus clairs et le compte ────────────────────── */
const resSpotify = context.playlistAjouterLien('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=x');
ok(resSpotify.ok === false && resSpotify.message.indexOf('Spotify') !== -1 && resSpotify.message.indexOf('YouTube') !== -1,
    'un lien Spotify doit être refusé avec un message qui guide vers YouTube');
const res1 = context.playlistAjouterLien('https://www.youtube.com/playlist?list=PLabc123def');
ok(res1.ok === true, 'un lien de playlist YouTube doit être accepté');
const lu = context.playlistLire();
ok(lu.liste.length === 1 && lu.liste[0].service === 'youtube' && lu.active === lu.liste[0].id, 'la playlist ajoutée doit être enregistrée et affichée');
const res2 = context.playlistAjouterLien('https://www.youtube.com/watch?v=z&list=PLabc123def');
ok(res2.ok === true && context.playlistLire().liste.length === 1, 'recoller le même lien ne doit pas dupliquer la playlist');
const resMix = context.playlistAjouterLien('https://www.youtube.com/watch?v=abcdefghijk&list=RDGMEMcibPTYxyz');
ok(resMix.ok === false && resMix.message.indexOf('Mix') !== -1,
    'un lien de Mix doit être refusé avec le message des Mix : ' + (resMix.message || ''));
const resChart = context.playlistAjouterLien('https://music.youtube.com/playlist?list=RDCLB5test_ok');
ok(resChart.ok === true, 'une playlist chart RDCLB est une vraie playlist : elle doit être acceptée');
const res3 = context.playlistAjouterLien('https://www.youtube.com/watch?v=abc');
ok(res3.ok === false && res3.message, 'un lien sans playlist doit être refusé avec un message');

/* les anciennes playlists Spotify enregistrées disparaissent proprement */
context.playlistEcrire({ liste: [
    { id: 's1', service: 'spotify', cle: 'x', url: 'u', embed: 'https://open.spotify.com/embed/playlist/x', nom: 'Spotify', vignette: '', ajouteAt: '' },
    { id: 'y1', service: 'youtube', cle: 'PLgarde', url: 'u', embed: 'https://www.youtube-nocookie.com/embed/videoseries?list=PLgarde', nom: 'Gardée', vignette: '', ajouteAt: '' }
], active: 's1' });
const apres = context.playlistLire();
ok(apres.liste.length === 1 && apres.liste[0].id === 'y1' && apres.active === 'y1',
    'une ancienne playlist Spotify doit être ignorée et la playlist YouTube rester affichée');
context.playlistActiver('y1');
ok(context.playlistLire().active === 'y1', 'l\u2019activation d\u2019une playlist');
context.playlistRetirer('y1');
ok(context.playlistLire().liste.length === 0, 'le retrait d\u2019une playlist');
ok(context.playlistCompact() === null, 'sans playlist, le compact est vide');
context.playlistEcrire({ liste: [], active: '' });
const compact = context.playlistAjouterLien('https://music.youtube.com/playlist?list=RDCLB-xyz');
ok(compact.ok === true && context.playlistCompact() && context.playlistCompact().liste.length === 1, 'le compact pour le compte');

/* les fonctions d'écran ne plantent jamais sans panneau */
try {
    context.focusBasculerPlaylist();
    context.focusBasculerSonsAccueil();
    context.focusFermerMusique();
    context.playlistPeindre();
    context.accueilPeindreSons();
    context.playlistAjouterDepuisChamp();
} catch (e) {
    ok(false, 'les fonctions musique ne doivent pas planter sans panneau : ' + e.message);
}

/* ── Bilan ─────────────────────────────────────────────────────────── */
if (echecs.length) {
    console.error('Musique : échecs ' + echecs.length);
    echecs.forEach(function (e) { console.error(' - ' + e); });
    process.exit(1);
}
console.log('ok musique : tomate 🍅 au menu Pomodoro, section Playlist à côté des Sons sur le minuteur et la page Séance du jour, liens YouTube reconnus sous toutes leurs formes (lecteur démarrant sur la vidéo du lien), Mix refusés avec la marche à suivre, Spotify retiré, porte de secours vers YouTube sous le lecteur, playlists gardées et emportées par le compte');
