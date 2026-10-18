/* ============================================================
   MUSIQUE — Playlist (YouTube) et Sons des deux pages
   À côté des sons d'ambiance, l'élève colle le lien de sa playlist
   YouTube : elle se joue dans le site, sans le quitter. Le vrai nom
   et la pochette arrivent tout seuls quand YouTube les partage.
   Spotify n'est plus pris en charge : son API est devenue payante
   et fermée (février 2026), et son lecteur intégré refuse de jouer
   les playlists des autres.
   Vue : pages/pomodoro.html et pages/seances.html
   ============================================================ */

var PLAYLIST_CLE = 'studyPlanIB_playlists';

/* ── Le store des playlists ────────────────────────────────────────── */

function playlistLire() {
    try {
        var d = JSON.parse(localStorage.getItem(PLAYLIST_CLE) || 'null');
        if (d && typeof d === 'object' && Array.isArray(d.liste)) {
            var liste = d.liste.filter(function (p) {
                return p && p.id && p.service === 'youtube' &&
                    /^https:\/\/www\.youtube-nocookie\.com\/embed\/(?:videoseries|[A-Za-z0-9_-]{5,})\?list=[A-Za-z0-9_-]+$/.test(p.embed);
            }).map(function (p) {
                return {
                    id: String(p.id),
                    service: 'youtube',
                    cle: String(p.cle || '').slice(0, 120),
                    video: String(p.video || '').slice(0, 20),
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

/* ── Reconnaissance des liens YouTube ──────────────────────────────── */

/* Tout lien YouTube qui porte une vraie liste de lecture :
   « youtube.com/playlist?list=… », « youtu.be/…?list=… », « watch?v=…&list=… »,
   music.youtube.com, m.youtube.com, avec ou sans https://, avec ou
   sans www. Les Mix automatiques (RD…) sont refusés : YouTube ne les
   donne jamais aux lecteurs intégrés (« Vidéo indisponible ») — sauf
   les charts curatés RDCLB, qui sont de vraies playlists publiques.
   Quand le lien porte une vidéo (v=… ou youtu.be/…), le lecteur
   démarre sur elle : plus robuste que de laisser YouTube choisir. */
function playlistDetecterLien(brut) {
    var s = String(brut || '').replace(/\s+/g, '');
    if (!s) return null;
    var domaine = s.replace(/^https?:\/\//i, '');
    if (!/^(www\.|m\.|music\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(domaine)) return null;
    var q = s.match(/[?&]list=([A-Za-z0-9_-]+)/);
    if (!q) return null;
    if (/^RD(?!CLB)/.test(q[1])) return { service: 'youtube', cle: q[1], mix: true, embed: '' };
    var video = '';
    var mv = s.match(/[?&]v=([A-Za-z0-9_-]{5,})/);
    if (mv) video = mv[1];
    else {
        var mb = s.match(/youtu\.be\/([A-Za-z0-9_-]{5,})/);
        if (mb) video = mb[1];
    }
    var embed = video
        ? 'https://www.youtube-nocookie.com/embed/' + video + '?list=' + q[1]
        : 'https://www.youtube-nocookie.com/embed/videoseries?list=' + q[1];
    return { service: 'youtube', cle: q[1], video: video, embed: embed };
}

function playlistEstLienSpotify(s) {
    var t = String(s || '').replace(/\s+/g, '');
    return /spotify\.(com|co)\//i.test(t) || /^spotify:/i.test(t);
}

/* ── Ajout, retrait, activation ────────────────────────────────────── */

function playlistAjouterLien(brut) {
    if (playlistEstLienSpotify(brut)) {
        return { ok: false, message: 'Les playlists Spotify ne sont plus prises en charge. Colle plut\u00f4t le lien d\u2019une playlist YouTube \u2014 il contient \u00ab list= \u00bb.' };
    }
    var lien = playlistDetecterLien(brut);
    if (lien && lien.mix) {
        return { ok: false, message: 'Les Mix automatiques de YouTube ne peuvent pas \u00eatre lus dans un site. Enregistre ces musiques dans une vraie playlist : sous une vid\u00e9o, touche Enregistrer \u2192 Nouvelle playlist, puis colle son lien ici.' };
    }
    if (!lien) {
        return { ok: false, message: 'Lien non reconnu. Colle le lien d\u2019une playlist YouTube : sur YouTube, ouvre ta playlist, touche Partager, puis Copier le lien.' };
    }
    var store = playlistLire();
    var deja = store.liste.filter(function (p) { return p.cle === lien.cle; })[0];
    if (deja) {
        store.active = deja.id;
        playlistEcrire(store);
        playlistVignette(deja);
        return { ok: true, message: 'Cette playlist est d\u00e9j\u00e0 l\u00e0 \u2014 elle est affich\u00e9e.', playlist: deja };
    }
    var p = {
        id: 'pl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        service: 'youtube',
        cle: lien.cle,
        video: lien.video || '',
        url: String(brut || '').trim().slice(0, 300),
        embed: lien.embed,
        nom: 'Playlist YouTube',
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

/* Le vrai nom et la pochette, quand YouTube les partage (oEmbed).
   Si YouTube ne confirme pas la playlist, on le dit : le lecteur
   affichera « Vidéo indisponible » tant qu'elle est privée. */
function playlistVignette(p) {
    if (!p || typeof fetch !== 'function') return;
    var url = 'https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/playlist?list=' + p.cle) + '&format=json';
    fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        var store = playlistLire();
        var cible = store.liste.filter(function (x) { return x.id === p.id; })[0];
        if (!cible) return;
        if (d && d.title) cible.nom = String(d.title).slice(0, 90);
        if (d && d.thumbnail_url) cible.vignette = String(d.thumbnail_url).slice(0, 400);
        playlistEcrire(store);
        if (!d) {
            var message = document.getElementById('fpMessage');
            if (message) {
                message.textContent = 'Playlist ajout\u00e9e, mais YouTube ne la confirme pas : si le lecteur affiche \u00ab Vid\u00e9o indisponible \u00bb, ouvre ta playlist sur YouTube et mets sa visibilit\u00e9 sur \u00ab Non r\u00e9pertori\u00e9e \u00bb ou \u00ab Publique \u00bb, puis rev\u00e9rifie ici.';
                message.className = 'fp-message';
            }
        }
        playlistPeindre();
    }).catch(function () {});
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
        '<input id="fpLien" placeholder="Colle ici le lien de ta playlist YouTube" autocomplete="off">' +
        '<button type="button" onclick="playlistAjouterDepuisChamp()">Ajouter</button>' +
        '</div>' +
        '<p id="fpMessage" class="fp-message"></p>' +
        '<p class="fp-aide">Sur YouTube : ouvre ta playlist \u2192 Partager \u2192 Copier le lien, puis colle-le ici.</p>' +
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
    var zoneLecteur = document.getElementById('fpLecteur');

    /* la liste des playlists enregistrées */
    liste.innerHTML = '';
    if (!store.liste.length) {
        var vide = document.createElement('p');
        vide.className = 'fp-vide';
        vide.textContent = 'Aucune playlist pour l\u2019instant. Colle le lien de ta playlist YouTube ci-dessus : elle se joue ici, sans quitter le site.';
        liste.appendChild(vide);
    } else {
        store.liste.forEach(function (p) {
            var carte = document.createElement('div');
            carte.className = 'fp-carte' + (store.active === p.id ? ' is-on' : '');
            carte.setAttribute('role', 'button');
            carte.setAttribute('tabindex', '0');
            carte.setAttribute('aria-label', p.nom + ' (YouTube)');
            var visuel = p.vignette
                ? '<img src="' + musiqueEchap(p.vignette) + '" alt="" loading="lazy">'
                : '<div class="fp-carte-visuel youtube">\u25B6\uFE0F</div>';
            carte.innerHTML = visuel +
                '<div class="fp-carte-texte"><p>' + musiqueEchap(p.nom) + '</p><span>YouTube</span></div>';
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

    /* le lecteur de la playlist affichée — avec une porte de secours
       vers YouTube si le lecteur refuse de jouer */
    var active = store.liste.filter(function (p) { return p.id === store.active; })[0] || null;
    if (zoneLecteur) {
        if (active) {
            zoneLecteur.className = 'fp-lecteur';
            var href = active.url && /^https?:\/\//.test(active.url) ? active.url : 'https://www.youtube.com/playlist?list=' + active.cle;
            zoneLecteur.innerHTML = '<iframe src="' + musiqueEchap(active.embed) + '" title="' + musiqueEchap(active.nom) + '" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" allowfullscreen></iframe>' +
                '<a class="fp-secours" href="' + musiqueEchap(href) + '" target="_blank" rel="noopener">Ne s\u2019affiche pas ici ? Ouvrir sur YouTube \u2197</a>';
        } else {
            zoneLecteur.className = 'fp-lecteur';
            zoneLecteur.innerHTML = '';
        }
    }
}

/* ── Démarrage ─────────────────────────────────────────────────────── */

try { musiqueConstruire(); } catch (e) {}
