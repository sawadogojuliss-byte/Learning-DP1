#!/usr/bin/env node
/* ============================================================
   Vérificateur — Musique (Playlist Spotify · YouTube, Sons)
   1. La tomate remplace le minuteur dans le menu Pomodoro.
   2. La section Playlist existe à côté des Sons sur les DEUX pages
      (minuteur Pomodoro et Séance de révision du jour).
   3. Les liens collés sont reconnus (Spotify, YouTube), le store garde
      les playlists, elles suivent le compte, la connexion Spotify
      n'apparaît que si elle est configurée.
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
ok(configJs.indexOf('STUDYPLAN_SPOTIFY_CLIENT_ID') !== -1, 'la clé de configuration Spotify manque');
ok(css.indexOf('.musique-flottant') !== -1, 'les panneaux flottants musique ne sont pas stylés');
ok(css.indexOf('.focus-accueil-musique') !== -1, 'la barre musique de la page Séance n\u2019est pas stylée');
ok(css.indexOf('.fp-carte') !== -1 && css.indexOf('.fp-lecteur') !== -1, 'le rendu des playlists manque de styles');
ok(musiqueJs.indexOf('function playlistDetecterLien') !== -1, 'la reconnaissance des liens manque');
ok(musiqueJs.indexOf('code_challenge_method=S256') !== -1, 'la connexion Spotify doit utiliser PKCE (sans secret)');
ok(musiqueJs.indexOf('youtube-nocookie.com/embed/videoseries') !== -1, 'le lecteur YouTube intégré manque');
ok(musiqueJs.indexOf('open.spotify.com/embed/playlist/') !== -1, 'le lecteur Spotify intégré manque');
ok(navJs.indexOf('focusFermerMusique') !== -1, 'la navigation doit fermer les panneaux musique');
ok(pomodoroPageJs.indexOf('focusFermerMusique') !== -1, 'les boutons du minuteur doivent fermer les panneaux musique');

/* ── 2. La reconnaissance des liens ────────────────────────────────── */
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
    return r ? r.service + ':' + r.cle : null;
}
ok(detecte('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123') === 'spotify:37i9dQZF1DXcBWIGoYBM5M',
    'lien Spotify avec paramètre si : ' + detecte('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123'));
ok(detecte('https://open.spotify.com/intl-fr/playlist/1x2y3z4w') === 'spotify:1x2y3z4w', 'lien Spotify intl-fr');
ok(detecte('spotify:playlist:abcDEF123') === 'spotify:abcDEF123', 'URI Spotify');
ok(detecte('https://open.spotify.com/track/xyz') === null, 'un titre seul Spotify doit être refusé');
ok(detecte('https://www.youtube.com/playlist?list=PLabc123def') === 'youtube:PLabc123def', 'lien playlist YouTube');
ok(detecte('https://music.youtube.com/playlist?list=RDCLB-xyz') === 'youtube:RDCLB-xyz', 'lien YouTube Music');
ok(detecte('https://youtu.be/video?list=PLxyz') === 'youtube:PLxyz', 'lien youtu.be avec liste');
ok(detecte('https://www.youtube.com/watch?v=abc&list=PLdef') === 'youtube:PLdef', 'lien watch YouTube avec liste');
ok(detecte('https://www.youtube.com/watch?v=abc') === null, 'une vidéo YouTube sans liste doit être refusée');
ok(detecte('bonjour') === null, 'un texte quelconque doit être refusé');

/* l'embed porte le bon lecteur */
const lienSpotify = context.playlistDetecterLien('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
ok(lienSpotify.embed.indexOf('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M') === 0, 'embed Spotify : ' + lienSpotify.embed);
const lienYoutube = context.playlistDetecterLien('https://www.youtube.com/playlist?list=PLabc');
ok(lienYoutube.embed.indexOf('https://www.youtube-nocookie.com/embed/videoseries?list=PLabc') === 0, 'embed YouTube : ' + lienYoutube.embed);

/* ── 3. Le store et le compte ──────────────────────────────────────── */
const res1 = context.playlistAjouterLien('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=x');
ok(res1.ok === true, 'un lien Spotify valide doit être accepté');
const lu = context.playlistLire();
ok(lu.liste.length === 1 && lu.liste[0].service === 'spotify' && lu.active === lu.liste[0].id, 'la playlist ajoutée doit être enregistrée et affichée');
const res2 = context.playlistAjouterLien('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=autre');
ok(res2.ok === true && context.playlistLire().liste.length === 1, 'recoler le même lien ne doit pas dupliquer la playlist');
const res3 = context.playlistAjouterLien('https://www.youtube.com/watch?v=abc');
ok(res3.ok === false && res3.message, 'un lien sans playlist doit être refusé avec un message');
const res4 = context.playlistAjouterLien('https://www.youtube.com/playlist?list=PLtest');
ok(res4.ok === true && context.playlistLire().liste.length === 2, 'une playlist YouTube doit pouvoir s\u2019ajouter');
context.playlistActiver(lu.liste[0].id);
ok(context.playlistLire().active === lu.liste[0].id, 'l\u2019activation d\u2019une playlist');
context.playlistRetirer(lu.liste[0].id);
const apres = context.playlistLire();
ok(apres.liste.length === 1 && apres.liste[0].service === 'youtube', 'le retrait d\u2019une playlist');
const compact = context.playlistCompact();
ok(compact && Array.isArray(compact.liste) && compact.liste.length === 1, 'le compact pour le compte');
context.playlistEcrire({ liste: [], active: '' });
ok(context.playlistCompact() === null, 'sans playlist, le compact est vide');

/* la connexion Spotify reste masquée tant qu'elle n'est pas configurée */
ok(context.spotifyEstConfigure() === false, 'sans ID client, la connexion Spotify doit être considérée absente');

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
console.log('ok musique : tomate 🍅 au menu Pomodoro, section Playlist à côté des Sons sur le minuteur et la page Séance du jour, liens Spotify et YouTube reconnus et joués dans le site, playlists gardées et emportées par le compte, connexion Spotify masquée tant qu\u2019elle n\u2019est pas configurée');
