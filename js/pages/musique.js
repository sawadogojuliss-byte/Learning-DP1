/* ============================================================
   MUSIQUE — Sons d'ambiance de la page Séance de révision
   Le minuteur Pomodoro a déjà son panneau Sons ; ce module ajoute
   le même panneau à la page « Séance de révision du jour », avec
   la même grille, les mêmes volumes et les mêmes filtres. Les deux
   boutons du minuteur et la navigation ferment ce panneau.
   Vue : pages/seances.html
   ============================================================ */

function musiqueEchap(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

var MUSIQUE_SVG_PAUSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1"/><rect x="13.8" y="5" width="4.2" height="14" rx="1"/></svg>';
var MUSIQUE_SVG_RESET = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 4.5V9h-4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var MUSIQUE_SVG_FERMER = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function musiqueConstruire() {
    var corps = document.body;
    if (!corps || document.getElementById('accueilSons')) return;

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

function accueilFermerSonsSiFond(event) {
    if (event && event.target && event.target.id === 'accueilSons') focusFermerMusique();
}

/* Ferme le panneau des sons de la page des séances : appelé par la
   navigation et par les boutons du minuteur, pour qu'il ne reste
   jamais au-dessus d'une autre page. */
function focusFermerMusique() {
    var el = document.getElementById('accueilSons');
    if (el) el.hidden = true;
    if (typeof accueilFermerFonds === 'function') accueilFermerFonds();
    accueilPeindreBoutonSons();
}

function focusBasculerSonsAccueil() {
    var panneau = document.getElementById('accueilSons');
    if (!panneau) return;
    /* un seul panneau ouvert à la fois : la galerie des décors se ferme */
    if (panneau.hidden && typeof accueilFermerFonds === 'function') accueilFermerFonds();
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

/* ── Démarrage ─────────────────────────────────────────────────────── */

try { musiqueConstruire(); } catch (e) {}

/* ── La galerie des décors de la page Séance de révision ───────────── */
/* Le Pomodoro a sa bande de vignettes ; la page des séances reçoit la
   même, alimentée par les fonds communs (FOCUS_FONDS). Choisir ici
   change le décor des deux pages : le choix est enregistré au même
   endroit. */

function accueilVignettesFonds() {
    var galerie = document.getElementById('accueilFonds');
    if (!galerie || galerie.childNodes.length) return;
    if (typeof FOCUS_FONDS === 'undefined' || !Array.isArray(FOCUS_FONDS)) return;
    FOCUS_FONDS.forEach(function (fond, i) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'focus-vignette';
        btn.setAttribute('aria-label', fond.nom);
        btn.title = fond.nom;
        btn.style.backgroundImage = 'url("' + (fond.mini || fond.src) + '")';
        btn.style.backgroundPosition = 'center center';
        btn.style.backgroundSize = 'cover';
        btn.style.backgroundRepeat = 'no-repeat';
        btn.onclick = function () { accueilChoisirFond(i); };
        galerie.appendChild(btn);
    });
}

function accueilChoisirFond(index) {
    if (typeof focusPoserFond === 'function') focusPoserFond(index);
    accueilPeindreFonds();
}

function accueilPeindreFonds() {
    var galerie = document.getElementById('accueilFonds');
    if (!galerie) return;
    var actif = (typeof focusEtat !== 'undefined' && focusEtat && Number(focusEtat.fond)) || 0;
    var vignettes = galerie.querySelectorAll('.focus-vignette');
    for (var i = 0; i < vignettes.length; i++) {
        if (i === actif) vignettes[i].classList.add('is-on');
        else vignettes[i].classList.remove('is-on');
    }
    var bouton = document.getElementById('accueilBtnFonds');
    if (bouton) bouton.classList.toggle('is-on', !galerie.hidden);
}

function accueilBasculerFonds() {
    var galerie = document.getElementById('accueilFonds');
    if (!galerie) return;
    /* un seul panneau ouvert à la fois : les sons se ferment */
    var sons = document.getElementById('accueilSons');
    if (sons && !sons.hidden) sons.hidden = true;
    if (typeof accueilPeindreBoutonSons === 'function') accueilPeindreBoutonSons();
    accueilVignettesFonds();
    galerie.hidden = !galerie.hidden;
    accueilPeindreFonds();
}

/* Ferme la galerie des décors : appelée par la navigation et à
   l'ouverture du panneau Sons, pour qu'elle ne reste jamais ouverte
   par-dessus une autre page. */
function accueilFermerFonds() {
    var galerie = document.getElementById('accueilFonds');
    if (galerie) galerie.hidden = true;
    var bouton = document.getElementById('accueilBtnFonds');
    if (bouton) bouton.classList.remove('is-on');
}
