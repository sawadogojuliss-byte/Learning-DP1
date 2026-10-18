/* ============================================================
   MUSIQUE — Playlist (Spotify · YouTube) et Sons des deux pages
   À côté des sons d'ambiance, l'élève colle le lien de sa playlist
   Spotify ou YouTube : elle se joue dans le site, sans le quitter.
   Avec une connexion Spotify (si configurée), ses playlists
   apparaissent directement avec leurs pochettes.
   Vue : pages/pomodoro.html et pages/seances.html
   ============================================================ */

var PLAYLIST_CLE = 'studyPlanIB_playlists';
var SPOTIFY_CLE = 'studyPlanIB_spotify';
var SPOTIFY_PKCE_CLE = 'studyPlanIB_spotifyPkce';

/* ── Le store des playlists ────────────────────────────────────────── */

function playlistLire() {
    try {
        var d = JSON.parse(localStorage.getItem(PLAYLIST_CLE) || 'null');
        if (d && typeof d === 'object' && Array.isArray(d.liste)) {
            var liste = d.liste.filter(function (p) {
                return p && p.id && p.service && p.embed && /^https:\/\//.test(p.embed);
            }).map(function (p) {
                return {
                    id: String(p.id),
                    service: p.service === 'youtube' ? 'youtube' : 'spotify',
                    cle: String(p.cle || '').slice(0, 120),
                    url: String(p.url || '').slice(0, 300),
                    embed: String(p.embed).slice(0, 300),
                    nom: String(p.nom || '').slice(0, 90),
                    vignette: String(p.vignette || '').slice(0, 400),
                    ajouteAt: p.ajouteAt || ''
                };
            });
            return { liste: liste, active: liste.some(function (p) { return p.id === d.active; }) ? d.active : (liste.length ? liste[liste.length - 1].id : '') };
        }
    } catch (e) {}
    return { liste: [], active: '' };
}

function playlistEcrire(donnees) {
    try { localStorage.setItem(PLAYLIST_CLE, JSON.stringify(donnees)); } catch (e) {}
}

function playlistCompact() {
    var d = playlistLire();
    if (!d.liste.length) return null;
    return { liste: d.liste, active: d.active };
}

/* ── Reconnaissance des liens collés ───────────────────────────────── */

/* « https://open.spotify.com/playlist/XXXX?si=… », « spotify:playlist:XXXX »
   → lecteur Spotify intégré. Tout lien YouTube portant une vraie liste
   (« …playlist?list=… », « …watch?v=…&list=… », music.youtube.com) →
   lecteur YouTube intégré. Le reste est refusé avec un message clair. */
function playlistDetecterLien(brut) {
    var s = String(brut || '').trim();
    if (!s) return null;
    /* URI Spotify */
    var m = s.match(/^spotify:playlist:([A-Za-z0-9]+)/);
    if (m) return { service: 'spotify', cle: m[1], embed: 'https://open.spotify.com/embed/playlist/' + m[1] + '?utm_source=generator&theme=0' };
    if (/^spotify:[a-z]+:/i.test(s)) return null;
    /* lien Spotify */
    if (/spotify\.com\//i.test(s)) {
        var ms = s.match(/spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?playlist\/([A-Za-z0-9]+)/i);
        if (ms) return { service: 'spotify', cle: ms[1], embed: 'https://open.spotify.com/embed/playlist/' + ms[1] + '?utm_source=generator&theme=0' };
        return null;
    }
    /* lien YouTube : il faut une liste */
    if (/(^|\.)youtu(\.be|be\.com|be-nocookie\.com)\//i.test(s.replace(/^https?:\/\//, '')) || /youtube-nocookie\.com\//i.test(s)) {
        var q = s.match(/[?&]list=([A-Za-z0-9_-]+)/);
        if (q) return { service: 'youtube', cle: q[1], embed: 'https://www.youtube-nocookie.com/embed/videoseries?list=' + q[1] };
        return null;
    }
    return null;
}

/* ── Ajout, retrait, activation (indépendants de l'écran) ──────────── */

function playlistAjouterLien(brut) {
    var lien = playlistDetecterLien(brut);
    if (!lien) {
        return { ok: false, message: 'Lien non reconnu. Colle le lien d\u2019une playlist Spotify (open.spotify.com/playlist/\u2026) ou d\u2019une playlist YouTube (adresse contenant \u00ab list=\u00bb).' };
    }
    var store = playlistLire();
    var deja = store.liste.filter(function (p) { return p.service === lien.service && p.cle === lien.cle; })[0];
    if (deja) {
        store.active = deja.id;
        playlistEcrire(store);
        playlistVignette(deja);
        return { ok: true, message: 'Cette playlist est d\u00e9j\u00e0 l\u00e0 — elle est affich\u00e9e.', playlist: deja };
    }
    var p = {
        id: 'pl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        service: lien.service,
        cle: lien.cle,
        url: String(brut || '').trim().slice(0, 300),
        embed: lien.embed,
        nom: lien.service === 'spotify' ? 'Playlist Spotify' : 'Playlist YouTube',
        vignette: '',
        ajouteAt: new Date().toISOString()
    };
    if (store.liste.length >= 24) store.liste.shift();
    store.liste.push(p);
    store.active = p.id;
    playlistEcrire(store);
    playlistVignette(p);
    return { ok: true, message: 'Playlist ajout\u00e9e \u2713 Elle se joue ici, sans quitter le site.', playlist: p };
}

function playlistRetirer(id) {
    var store = playlistLire();
    store.liste = store.liste.filter(function (p) { return p.id !== id; });
    if (store.active === id) store.active = store.liste.length ? store.liste[store.liste.length - 1].id : '';
    playlistEcrire(store);
}

function playlistActiver(id) {
    var store = playlistLire();
    if (!store.liste.some(function (p) { return p.id === id; })) return;
    store.active = id;
    playlistEcrire(store);
}

/* Le vrai nom et la pochette, quand le service les partage (oEmbed).
   Si le service refuse, la carte reste belle sans pochette. */
function playlistVignette(p) {
    if (!p || typeof fetch !== 'function') return;
    var url = p.service === 'spotify'
        ? 'https://open.spotify.com/oembed?url=' + encodeURIComponent('https://open.spotify.com/playlist/' + p.cle)
        : 'https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/playlist?list=' + p.cle) + '&format=json';
    fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d) return;
        var store = playlistLire();
        var cible = store.liste.filter(function (x) { return x.id === p.id; })[0];
        if (!cible) return;
        if (d.title) cible.nom = String(d.title).slice(0, 90);
        if (d.thumbnail_url) cible.vignette = String(d.thumbnail_url).slice(0, 400);
        playlistEcrire(store);
        playlistPeindre();
    }).catch(function () {});
}

/* ── La connexion Spotify (PKCE, sans secret partagé) ──────────────── */

function spotifyClientId() {
    var v = '';
    try { if (typeof window !== 'undefined' && window.STUDYPLAN_SPOTIFY_CLIENT_ID) v = window.STUDYPLAN_SPOTIFY_CLIENT_ID; } catch (e) {}
    if (!v && typeof STUDYPLAN_SPOTIFY_CLIENT_ID !== 'undefined' && STUDYPLAN_SPOTIFY_CLIENT_ID) v = STUDYPLAN_SPOTIFY_CLIENT_ID;
    return String(v || '').trim();
}

function spotifyEstConfigure() {
    return !!spotifyClientId();
}

function spotifyRedirectUri() {
    return location.origin + location.pathname;
}

function spotifyAlea(n) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    var s = '';
    for (var i = 0; i < n; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
}

function spotifySeConnecter() {
    if (!spotifyEstConfigure() || typeof crypto === 'undefined' || !crypto.subtle) return;
    var verifier = spotifyAlea(64);
    var etat = spotifyAlea(16);
    try { localStorage.setItem(SPOTIFY_PKCE_CLE, JSON.stringify({ verifier: verifier, state: etat })); } catch (e) {}
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(function (h) {
        var b64 = btoa(String.fromCharCode.apply(null, new Uint8Array(h)));
        var challenge = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        var url = 'https://accounts.spotify.com/authorize?client_id=' + encodeURIComponent(spotifyClientId()) +
            '&response_type=code&redirect_uri=' + encodeURIComponent(spotifyRedirectUri()) +
            '&scope=' + encodeURIComponent('playlist-read-private playlist-read-collaborative') +
            '&code_challenge_method=S256&code_challenge=' + challenge + '&state=' + encodeURIComponent(etat);
        location.href = url;
    }).catch(function () {});
}

/* Au retour de Spotify : l'adresse porte ?code=…&state=… */
function spotifyTerminerConnexion() {
    if (!spotifyEstConfigure() || typeof location === 'undefined' || typeof fetch !== 'function') return;
    var recherche = '';
    try { recherche = location.search || ''; } catch (e) { return; }
    if (recherche.indexOf('code=') === -1) return;
    var code = (recherche.match(/[?&]code=([^&]+)/) || [])[1];
    var etat = (recherche.match(/[?&]state=([^&]+)/) || [])[1];
    if (!code) return;
    var garde = null;
    try { garde = JSON.parse(localStorage.getItem(SPOTIFY_PKCE_CLE) || 'null'); } catch (e) {}
    if (!garde || !garde.verifier || garde.state !== etat) return;
    try { localStorage.removeItem(SPOTIFY_PKCE_CLE); } catch (e) {}
    var corps = 'client_id=' + encodeURIComponent(spotifyClientId()) +
        '&grant_type=authorization_code' +
        '&code=' + encodeURIComponent(code) +
        '&redirect_uri=' + encodeURIComponent(spotifyRedirectUri()) +
        '&code_verifier=' + encodeURIComponent(garde.verifier);
    fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: corps
    }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.access_token) throw new Error('spotify');
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
        spotifyGarderJeton(d);
        playlistPeindre();
    }).catch(function () {});
}

function spotifyGarderJeton(d) {
    var s = {
        access: d.access_token,
        refresh: d.refresh_token || '',
        expire: Date.now() + (Number(d.expires_in) || 3600) * 1000 - 60000,
        nom: ''
    };
    try { localStorage.setItem(SPOTIFY_CLE, JSON.stringify(s)); } catch (e) {}
}

function spotifyAssurer() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(SPOTIFY_CLE) || 'null'); } catch (e) {}
    if (!s || !s.access) return Promise.resolve(null);
    if (!s.expire || Date.now() < s.expire) return Promise.resolve(s);
    if (!s.refresh || !spotifyEstConfigure() || typeof fetch !== 'function') return Promise.resolve(null);
    var corps = 'client_id=' + encodeURIComponent(spotifyClientId()) +
        '&grant_type=refresh_token&refresh_token=' + encodeURIComponent(s.refresh);
    return fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: corps
    }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.access_token) {
            spotifyDeconnecter();
            return null;
        }
        s.access = d.access_token;
        if (d.refresh_token) s.refresh = d.refresh_token;
        s.expire = Date.now() + (Number(d.expires_in) || 3600) * 1000 - 60000;
        try { localStorage.setItem(SPOTIFY_CLE, JSON.stringify(s)); } catch (e) {}
        return s;
    }).catch(function () { return null; });
}

function spotifyDeconnecter() {
    try { localStorage.removeItem(SPOTIFY_CLE); } catch (e) {}
    playlistPeindre();
}

/* Les playlists du compte Spotify connecté. */
function spotifyChargerPlaylists() {
    return spotifyAssurer().then(function (s) {
        if (!s) return [];
        var entetes = { Authorization: 'Bearer ' + s.access };
        return fetch('https://api.spotify.com/v1/me', { headers: entetes }).then(function (r) {
            return r.ok ? r.json() : null;
        }).then(function (moi) {
            if (moi && moi.display_name && s.nom !== moi.display_name) {
                s.nom = String(moi.display_name).slice(0, 60);
                try { localStorage.setItem(SPOTIFY_CLE, JSON.stringify(s)); } catch (e) {}
            }
            return fetch('https://api.spotify.com/v1/me/playlists?limit=50', { headers: entetes });
        }).then(function (r) {
            return r.ok ? r.json() : { items: [] };
        }).then(function (d) {
            return (d && Array.isArray(d.items) ? d.items : []).filter(function (x) { return x && x.id; });
        });
    }).catch(function () { return []; });
}

/* ── Les panneaux flottants (au-dessus des deux pages musique) ─────── */

function musiqueEchap(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

var MUSIQUE_SVG_PAUSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1"/><rect x="13.8" y="5" width="4.2" height="14" rx="1"/></svg>';
var MUSIQUE_SVG_RESET = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 4.5V9h-4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var MUSIQUE_SVG_FERMER = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function musiqueConstruire() {
    var corps = document.body;
    if (!corps || document.getElementById('focusPlaylist')) return;

    /* le panneau Playlist, partagé par le minuteur et la page des séances */
    var playlist = document.createElement('div');
    playlist.id = 'focusPlaylist';
    playlist.className = 'musique-flottant';
    playlist.hidden = true;
    playlist.setAttribute('onclick', 'focusFermerPlaylistSiFond(event)');
    playlist.innerHTML =
        '<div class="focus-sons-carte focus-playlist-carte" role="dialog" aria-label="Playlist">' +
        '<div class="focus-sons-haut">' +
        '<p class="focus-sons-titre">Playlist</p>' +
        '<div class="focus-sons-actions">' +
        '<button type="button" class="focus-sons-mini" onclick="focusFermerMusique()" aria-label="Fermer">' + MUSIQUE_SVG_FERMER + '</button>' +
        '</div></div>' +
        '<div class="focus-playlist-corps">' +
        '<div class="fp-ajout">' +
        '<input id="fpLien" placeholder="Colle ici le lien de ta playlist Spotify ou YouTube" autocomplete="off">' +
        '<button type="button" onclick="playlistAjouterDepuisChamp()">Ajouter</button>' +
        '</div>' +
        '<p id="fpMessage" class="fp-message"></p>' +
        '<div id="fpSpotify"></div>' +
        '<div id="fpListe" class="fp-liste"></div>' +
        '<div id="fpLecteur" class="fp-lecteur"></div>' +
        '</div></div>';
    corps.appendChild(playlist);

    /* le panneau Sons de la page des séances (le minuteur a le sien) */
    var sons = document.createElement('div');
    sons.id = 'accueilSons';
    sons.className = 'musique-flottant';
    sons.hidden = true;
    sons.setAttribute('onclick', 'accueilFermerSonsSiFond(event)');
    sons.innerHTML =
        '<div class="focus-sons-carte" role="dialog" aria-label="Sons">' +
        '<div class="focus-sons-haut">' +
        '<p class="focus-sons-titre">Sons</p>' +
        '<div class="focus-sons-actions">' +
        '<button type="button" class="focus-sons-mini" onclick="accueilPauseSon()" aria-label="Pause du son">' + MUSIQUE_SVG_PAUSE + '</button>' +
        '<button type="button" class="focus-sons-mini" onclick="accueilReinitSon()" aria-label="Réinitialiser le son">' + MUSIQUE_SVG_RESET + '</button>' +
        '<select id="accueilFiltreSon" onchange="accueilFiltrerSons()" aria-label="Filtrer les sons">' +
        '<option value="tous">Tous</option><option value="nature">Nature</option><option value="ville">Ville</option><option value="concentration">Concentration</option>' +
        '</select>' +
        '<button type="button" class="focus-sons-mini" onclick="focusFermerMusique()" aria-label="Fermer">' + MUSIQUE_SVG_FERMER + '</button>' +
        '</div></div>' +
        '<div id="accueilSonsGrille" class="focus-sons-grille"></div>' +
        '</div>';
    corps.appendChild(sons);
}

function focusFermerPlaylistSiFond(event) {
    if (event && event.target && event.target.id === 'focusPlaylist') focusFermerMusique();
}

function accueilFermerSonsSiFond(event) {
    if (event && event.target && event.target.id === 'accueilSons') focusFermerMusique();
}

/* Ferme les panneaux musique : appelé par la navigation et par les
   boutons du minuteur, pour qu'ils ne restent jamais au-dessus d'une
   autre page. */
function focusFermerMusique() {
    ['focusPlaylist', 'accueilSons'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.hidden = true;
    });
    focusPeindreBoutonPlaylist();
    accueilPeindreBoutonSons();
}

function focusBasculerPlaylist() {
    var panneau = document.getElementById('focusPlaylist');
    if (!panneau) return;
    var sons = document.getElementById('accueilSons');
    if (sons) sons.hidden = true;
    accueilPeindreBoutonSons();
    panneau.hidden = !panneau.hidden;
    if (!panneau.hidden) playlistPeindre();
    focusPeindreBoutonPlaylist();
}

function focusPeindreBoutonPlaylist() {
    var panneau = document.getElementById('focusPlaylist');
    var ouvert = panneau && !panneau.hidden;
    ['focusBtnPlaylist', 'accueilBtnPlaylist'].forEach(function (id) {
        var bouton = document.getElementById(id);
        if (bouton) bouton.classList.toggle('is-on', !!ouvert);
    });
}

/* ── Les sons d'ambiance sur la page des séances ───────────────────── */

function focusBasculerSonsAccueil() {
    var panneau = document.getElementById('accueilSons');
    if (!panneau) return;
    var playlist = document.getElementById('focusPlaylist');
    if (playlist) playlist.hidden = true;
    focusPeindreBoutonPlaylist();
    panneau.hidden = !panneau.hidden;
    if (!panneau.hidden) accueilPeindreSons();
    accueilPeindreBoutonSons();
}

function accueilPeindreSons() {
    var grille = document.getElementById('accueilSonsGrille');
    if (!grille) return;
    var filtre = document.getElementById('accueilFiltreSon');
    var groupe = filtre ? filtre.value : 'tous';
    grille.innerHTML = '';
    if (typeof FOCUS_SONS === 'undefined' || !Array.isArray(FOCUS_SONS)) return;
    FOCUS_SONS.forEach(function (son) {
        if (groupe !== 'tous' && son.groupe !== groupe) return;
        var actif = typeof focusSonActif === 'function' && focusSonActif(son.id);
        var boite = document.createElement('div');
        boite.className = 'focus-son-case' + (actif ? ' is-on' : '');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'focus-son' + (actif ? ' is-on' : '');
        btn.setAttribute('aria-label', son.nom);
        var icone = document.createElement('span');
        icone.className = 'focus-son-icone';
        icone.textContent = son.icone;
        var nom = document.createElement('span');
        nom.className = 'focus-son-nom';
        nom.textContent = son.nom;
        btn.appendChild(icone);
        btn.appendChild(nom);
        btn.onclick = function () {
            if (typeof focusChoisirSon === 'function') focusChoisirSon(son.id);
            accueilPeindreSons();
        };
        var volume = document.createElement('input');
        volume.type = 'range';
        volume.className = 'focus-volume';
        volume.min = '0';
        volume.max = '100';
        volume.value = String(Math.round((typeof focusVolume === 'function' ? focusVolume(son.id) : 0.55) * 100));
        volume.setAttribute('aria-label', 'Volume de ' + son.nom);
        if (typeof focusPeindreCurseur === 'function') focusPeindreCurseur(volume);
        volume.addEventListener('click', function (event) { event.stopPropagation(); });
        volume.addEventListener('input', function (event) {
            event.stopPropagation();
            if (typeof focusReglerVolume === 'function') focusReglerVolume(son.id, Number(volume.value) / 100);
            if (typeof focusPeindreCurseur === 'function') focusPeindreCurseur(volume);
        });
        boite.appendChild(btn);
        boite.appendChild(volume);
        grille.appendChild(boite);
    });
    accueilPeindreBoutonSons();
}

function accueilPeindreBoutonSons() {
    var bouton = document.getElementById('accueilBtnSons');
    if (!bouton) return;
    var panneau = document.getElementById('accueilSons');
    var ouvert = panneau && !panneau.hidden;
    var joue = typeof focusLecteurs !== 'undefined' && Object.keys(focusLecteurs).some(function (id) {
        return typeof focusSonActif === 'function' && focusSonActif(id);
    });
    bouton.classList.toggle('is-on', !!(ouvert || joue));
}

function accueilPauseSon() {
    if (typeof focusPauseSon === 'function') focusPauseSon();
    accueilPeindreSons();
}

function accueilReinitSon() {
    if (typeof focusArreterSon === 'function') focusArreterSon();
    var filtre = document.getElementById('accueilFiltreSon');
    if (filtre) filtre.value = 'tous';
    accueilPeindreSons();
}

function accueilFiltrerSons() {
    accueilPeindreSons();
}

/* ── Le rendu du panneau Playlist ──────────────────────────────────── */

function playlistAjouterDepuisChamp() {
    var champ = document.getElementById('fpLien');
    if (!champ) return;
    var resultat = playlistAjouterLien(champ.value);
    var message = document.getElementById('fpMessage');
    if (message) {
        message.textContent = resultat.message;
        message.className = 'fp-message' + (resultat.ok ? ' ok' : '');
    }
    if (resultat.ok) champ.value = '';
    playlistPeindre();
}

function playlistPeindre() {
    var liste = document.getElementById('fpListe');
    if (!liste) return;
    var store = playlistLire();
    var zoneSpotify = document.getElementById('fpSpotify');
    var zoneLecteur = document.getElementById('fpLecteur');

    /* la liste des playlists enregistrées */
    liste.innerHTML = '';
    if (!store.liste.length) {
        var vide = document.createElement('p');
        vide.className = 'fp-vide';
        vide.textContent = 'Aucune playlist pour l\u2019instant. Colle le lien de ta playlist Spotify ou YouTube ci-dessus : elle se joue ici, sans quitter le site.';
        liste.appendChild(vide);
    } else {
        store.liste.forEach(function (p) {
            var carte = document.createElement('div');
            carte.className = 'fp-carte' + (store.active === p.id ? ' is-on' : '');
            carte.setAttribute('role', 'button');
            carte.setAttribute('tabindex', '0');
            carte.setAttribute('aria-label', p.nom + ' (' + (p.service === 'spotify' ? 'Spotify' : 'YouTube') + ')');
            var visuel = p.vignette
                ? '<img src="' + musiqueEchap(p.vignette) + '" alt="" loading="lazy">'
                : '<div class="fp-carte-visuel ' + p.service + '">' + (p.service === 'spotify' ? '\uD83C\uDFA7' : '\u25B6\uFE0F') + '</div>';
            carte.innerHTML = visuel +
                '<div class="fp-carte-texte"><p>' + musiqueEchap(p.nom) + '</p><span>' + (p.service === 'spotify' ? 'Spotify' : 'YouTube') + '</span></div>';
            carte.onclick = function () {
                playlistActiver(p.id);
                playlistPeindre();
            };
            var suppr = document.createElement('button');
            suppr.type = 'button';
            suppr.className = 'fp-carte-suppr';
            suppr.setAttribute('aria-label', 'Retirer ' + p.nom);
            suppr.textContent = '\u2715';
            suppr.onclick = function (event) {
                event.stopPropagation();
                playlistRetirer(p.id);
                playlistPeindre();
            };
            carte.appendChild(suppr);
            liste.appendChild(carte);
        });
    }

    /* le lecteur de la playlist affichée */
    var active = store.liste.filter(function (p) { return p.id === store.active; })[0] || null;
    if (zoneLecteur) {
        if (active) {
            zoneLecteur.className = 'fp-lecteur ' + active.service;
            zoneLecteur.innerHTML = '<iframe src="' + musiqueEchap(active.embed) + '" title="' + musiqueEchap(active.nom) + '" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" allowfullscreen></iframe>';
        } else {
            zoneLecteur.className = 'fp-lecteur';
            zoneLecteur.innerHTML = '';
        }
    }

    /* la connexion Spotify, quand elle est configurée */
    if (zoneSpotify) {
        if (!spotifyEstConfigure()) {
            zoneSpotify.innerHTML = '';
            zoneSpotify.style.display = 'none';
        } else {
            zoneSpotify.style.display = '';
            zoneSpotify.innerHTML = '<p class="fp-spotify-chargement">Connexion Spotify\u2026</p>';
            spotifyAssurer().then(function (s) {
                if (!s) {
                    zoneSpotify.innerHTML =
                        '<button type="button" class="fp-spotify-bouton" onclick="spotifySeConnecter()">Se connecter avec Spotify</button>' +
                        '<p class="fp-spotify-note">Tes playlists Spotify appara\u00eetront ici, pr\u00eates \u00e0 jouer. L\u2019\u00e9coute compl\u00e8te d\u00e9pend de ton compte Spotify.</p>';
                    return;
                }
                zoneSpotify.innerHTML =
                    '<p class="fp-spotify-nom">\uD83C\uDFA7 Playlists de ' + musiqueEchap(s.nom || 'ton compte') + '</p>' +
                    '<button type="button" class="focus-sons-mini" style="width:auto;padding:0 0.8rem;" onclick="spotifyDeconnecter()">Se d\u00e9connecter</button>' +
                    '<div class="fp-spotify-grille" id="fpSpotifyGrille"></div>' +
                    '<p class="fp-spotify-note">Touche une pochette pour l\u2019\u00e9couter ici. L\u2019\u00e9coute compl\u00e8te d\u00e9pend de ton compte Spotify.</p>';
                var grille = document.getElementById('fpSpotifyGrille');
                if (!grille) return;
                spotifyChargerPlaylists().then(function (items) {
                    items.slice(0, 24).forEach(function (item) {
                        var image = (item.images && item.images.length && item.images[0] && item.images[0].url) || '';
                        var lien = (item.external_urls && item.external_urls.spotify) || ('https://open.spotify.com/playlist/' + item.id);
                        var carte = document.createElement('button');
                        carte.type = 'button';
                        carte.className = 'fp-spotify-carte';
                        carte.innerHTML = (image ? '<img src="' + musiqueEchap(image) + '" alt="" loading="lazy">' : '<div class="fp-carte-visuel spotify">\uD83C\uDFA7</div>') +
                            '<p>' + musiqueEchap(item.name || 'Playlist') + '</p>';
                        carte.onclick = function () {
                            var resultat = playlistAjouterLien(lien);
                            var message = document.getElementById('fpMessage');
                            if (message) {
                                message.textContent = resultat.message;
                                message.className = 'fp-message' + (resultat.ok ? ' ok' : '');
                            }
                            playlistPeindre();
                        };
                        grille.appendChild(carte);
                    });
                    if (!grille.children.length) {
                        grille.innerHTML = '<p class="fp-vide">Aucune playlist sur ce compte Spotify.</p>';
                    }
                });
            });
        }
    }
}

/* ── Démarrage ─────────────────────────────────────────────────────── */

try { musiqueConstruire(); } catch (e) {}
try { spotifyTerminerConnexion(); } catch (e) {}
