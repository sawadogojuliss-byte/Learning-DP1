/* ============================================================
   Paramètres du minuteur et de la séance de révision — Studyplan
   Pages : pages/pomodoro.html et pages/seances.html
   Ce fichier ajoute : les citations (en haut à droite), l'heure,
   le style d'affichage du minuteur, la police, le format de l'heure,
   la taille, les options (barre, notification, enchaînement).
   Les réglages sont gardés sur cet appareil :
   localStorage « studyPlanIB_focusReglages ».
   Il se charge après js/pages/pomodoro-page.js.
   ============================================================ */

var FOCUS_CITATIONS = [
    "Chaque minute de travail compte, même les petites.",
    "Commence petit, mais commence aujourd'hui.",
    "La régularité vaut mieux que la perfection.",
    "Un pas après l'autre, et la route se fait.",
    "Concentre-toi sur le prochain pas, pas sur la montagne.",
    "Ce que tu répètes aujourd'hui devient facile demain.",
    "Une pause bien placée rend la concentration plus forte.",
    "La difficulté d'aujourd'hui est la compétence de demain.",
    "Ne cherche pas à être parfait, cherche à être constant.",
    "Le plus dur, c'est de s'asseoir. Ensuite, ça avance.",
    "Tu n'as pas besoin d'être prêt, il suffit de commencer.",
    "Chaque séance terminée est une petite victoire."
];

var FOCUS_STYLES_TEMPS = [
    { id: 'defaut', nom: 'Par défaut' },
    { id: 'horloge', nom: 'Horloge à palettes' },
    { id: 'barre', nom: 'Barre de progression' },
    { id: 'jauge', nom: 'Jauge' },
    { id: 'matrice', nom: 'Matrice de points' },
    { id: 'camembert', nom: 'Camembert' }
];

/* Chaque police est une combinaison de la police Degular (poids, italique,
   espacement) ou, à défaut, d'une police présente sur l'appareil. */
var FOCUS_POLICES = [
    { id: 'gras', nom: 'Gras par défaut' },
    { id: 'leger', nom: 'Léger par défaut' },
    { id: 'doux', nom: 'Doux' },
    { id: 'bulle', nom: 'Bulle' },
    { id: 'minimal-leger', nom: 'Minimal léger' },
    { id: 'minimal', nom: 'Minimal' },
    { id: 'serif', nom: 'Serif' },
    { id: 'serif-condense', nom: 'Serif condensé' },
    { id: 'sportif', nom: 'Sportif' },
    { id: 'large', nom: 'Très large' },
    { id: 'digital', nom: 'Digital' },
    { id: 'manuscrite', nom: 'Manuscrite' }
];

var FOCUS_FORMATS = [
    { id: '12', nom: '12 heures' },
    { id: '24', nom: '24 heures' }
];

var FOCUS_TAILLES = [
    { id: 'petite', nom: 'Petite' },
    { id: 'normale', nom: 'Normale' },
    { id: 'grande', nom: 'Grande' }
];

/* Clé propre : « studyPlanIB_focusReglages » appartient à la synchronisation du minuteur (js/synchro.js). */
var FOCUS_REGLAGES_CLE = 'studyPlanIB_minuteurParametres';
var FOCUS_CERCLE = 2 * Math.PI * 45;
var FOCUS_POINTS = 24;
var focusReglagesVus = null;

function focusNormaliserReglages(brut) {
    var b = brut || {};
    function dans(liste, valeur, defaut) {
        for (var i = 0; i < liste.length; i++) if (liste[i].id === valeur) return valeur;
        return defaut;
    }
    return {
        style: dans(FOCUS_STYLES_TEMPS, b.style, 'defaut'),
        barre: b.barre === true,
        notif: b.notif === true,
        auto: b.auto === true,
        police: dans(FOCUS_POLICES, b.police, 'gras'),
        format: dans(FOCUS_FORMATS, b.format, '24'),
        taille: dans(FOCUS_TAILLES, b.taille, 'normale')
    };
}

function focusLireReglages() {
    if (focusReglagesVus) return focusReglagesVus;
    var brut = null;
    try { brut = JSON.parse(localStorage.getItem(FOCUS_REGLAGES_CLE) || 'null'); } catch (e) { brut = null; }
    focusReglagesVus = focusNormaliserReglages(brut);
    return focusReglagesVus;
}

function focusEcrireReglages(reglages) {
    focusReglagesVus = focusNormaliserReglages(reglages);
    try { localStorage.setItem(FOCUS_REGLAGES_CLE, JSON.stringify(focusReglagesVus)); } catch (e) {}
}

/* Heure affichée : 12 h sans « AM/PM » comme sur la capture, ou 24 h. */
function focusTexteHeure(date, format) {
    var h = date.getHours();
    var m = date.getMinutes();
    var mm = (m < 10 ? '0' : '') + m;
    if (format === '12') {
        h = h % 12;
        if (h === 0) h = 12;
        return h + ':' + mm;
    }
    return (h < 10 ? '0' : '') + h + ':' + mm;
}

function focusPeindreHeure() {
    var texte = focusTexteHeure(new Date(), focusLireReglages().format);
    ['focusHeure', 'focusAccueilHeure'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.textContent !== texte) el.textContent = texte;
    });
}

/* Une citation par jour : la même toute la journée, une autre le lendemain. */
function focusCitationDuJour(date) {
    var d = date || new Date();
    var debut = new Date(d.getFullYear(), 0, 0);
    var jour = Math.floor((d - debut) / 86400000);
    return FOCUS_CITATIONS[jour % FOCUS_CITATIONS.length];
}

function focusPeindreCitation() {
    var texte = focusCitationDuJour();
    ['focusCitation', 'focusAccueilCitation'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.textContent !== texte) el.textContent = texte;
    });
}

/* Construit une fois les boutons de choix (style, police, format, taille). */
function focusRemplirGrille(id, liste, cle, classeItem) {
    var conteneur = document.getElementById(id);
    if (!conteneur || conteneur.getAttribute('data-pret') === '1') return;
    conteneur.setAttribute('data-pret', '1');
    liste.forEach(function (item) {
        var bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'focus-choix' + (classeItem ? ' ' + classeItem(item) : '');
        bouton.setAttribute('data-' + cle, item.id);
        bouton.setAttribute('aria-pressed', 'false');
        if (cle === 'police') {
            var apercu = document.createElement('span');
            apercu.className = 'focus-choix-apercu';
            apercu.textContent = '12:24';
            bouton.appendChild(apercu);
        }
        var libelle = document.createElement('span');
        libelle.className = 'focus-choix-libelle';
        libelle.textContent = item.nom;
        bouton.appendChild(libelle);
        bouton.onclick = function () { focusChoisirReglage(cle, item.id); };
        conteneur.appendChild(bouton);
    });
}

function focusConstruireChoix() {
    focusRemplirGrille('focusChoixStyle', FOCUS_STYLES_TEMPS, 'style');
    focusRemplirGrille('focusChoixPolice', FOCUS_POLICES, 'police', function (p) { return 'focus-choix-police focus-police-' + p.id; });
    focusRemplirGrille('focusChoixFormat', FOCUS_FORMATS, 'format');
    focusRemplirGrille('focusChoixTaille', FOCUS_TAILLES, 'taille');
}

function focusMarquerChoix(id, cle, valeur) {
    var conteneur = document.getElementById(id);
    if (!conteneur) return;
    var boutons = conteneur.querySelectorAll('button');
    for (var i = 0; i < boutons.length; i++) {
        var actif = boutons[i].getAttribute('data-' + cle) === valeur;
        boutons[i].classList.toggle('is-on', actif);
        boutons[i].setAttribute('aria-pressed', String(actif));
    }
}

/* Contenu d'un affichage du minuteur (créé quand le style change). */
function focusHtmlStyle(style) {
    var i, html = '';
    if (style === 'horloge') {
        html = '<div class="focus-flip">' +
            '<span class="focus-flip-case"><b>0</b></span><span class="focus-flip-case"><b>0</b></span>' +
            '<span class="focus-flip-sep">:</span>' +
            '<span class="focus-flip-case"><b>0</b></span><span class="focus-flip-case"><b>0</b></span>' +
            '</div>';
    } else if (style === 'jauge') {
        html = '<svg class="focus-jauge" viewBox="0 0 100 100" aria-hidden="true">' +
            '<circle class="focus-jauge-fond" cx="50" cy="50" r="45"></circle>' +
            '<circle class="focus-jauge-arc" cx="50" cy="50" r="45" transform="rotate(-90 50 50)" ' +
            'stroke-dasharray="' + FOCUS_CERCLE.toFixed(2) + '" stroke-dashoffset="0"></circle></svg>';
    } else if (style === 'matrice') {
        html = '<div class="focus-matrice" aria-hidden="true">';
        for (i = 0; i < FOCUS_POINTS; i++) html += '<span class="focus-point"></span>';
        html += '</div>';
    } else if (style === 'camembert') {
        html = '<div class="focus-camembert" aria-hidden="true"></div>';
    }
    return html;
}

/* Affiche le temps restant selon le style choisi. « Ce qui reste » diminue. */
function focusPeindreStyleTemps(r) {
    var temps = document.getElementById('focusTime');
    var visuel = document.getElementById('focusVisuel');
    var barre = document.getElementById('focusBarre');
    var fill = document.getElementById('focusBarreRemplie');
    if (!temps || !visuel || !barre) return;
    var total = focusEtat.total > 0 ? focusEtat.total : 1;
    var fraction = Math.max(0, Math.min(1, focusEtat.restant / total));
    var style = r.style;

    if (visuel.getAttribute('data-style') !== style) {
        visuel.setAttribute('data-style', style);
        visuel.innerHTML = focusHtmlStyle(style);
    }
    visuel.hidden = style === 'defaut' || style === 'barre';
    temps.hidden = style === 'horloge';
    temps.classList.toggle('is-petit', style === 'jauge' || style === 'matrice' || style === 'camembert');

    var texte = focusTexte(focusEtat.restant);
    if (style === 'horloge') {
        var cases = visuel.querySelectorAll('.focus-flip-case b');
        var chiffres = texte.replace(':', '').split('');
        for (var k = 0; k < cases.length && k < chiffres.length; k++) {
            if (cases[k].textContent !== chiffres[k]) cases[k].textContent = chiffres[k];
        }
    } else if (style === 'jauge') {
        var arc = visuel.querySelector('.focus-jauge-arc');
        if (arc) arc.setAttribute('stroke-dashoffset', (FOCUS_CERCLE * (1 - fraction)).toFixed(2));
    } else if (style === 'matrice') {
        var points = visuel.querySelectorAll('.focus-point');
        var allumes = Math.ceil(fraction * points.length);
        for (var p = 0; p < points.length; p++) points[p].classList.toggle('is-allume', p < allumes);
    } else if (style === 'camembert') {
        var pion = visuel.querySelector('.focus-camembert');
        var pct = (fraction * 100).toFixed(2);
        if (pion) pion.style.background = 'conic-gradient(#fff 0 ' + pct + '%, rgba(255,255,255,0.14) ' + pct + '% 100%)';
    }

    barre.hidden = !(r.barre || style === 'barre');
    if (fill) fill.style.width = (fraction * 100).toFixed(2) + '%';
}

/* Peint tout ce qui dépend des réglages. Appelé à chaque affichage du minuteur. */
function focusPeindreParametres() {
    focusConstruireChoix();
    var r = focusLireReglages();

    ['focusPage', 'focusAccueil'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        FOCUS_POLICES.forEach(function (p) { el.classList.toggle('focus-police-' + p.id, p.id === r.police); });
        FOCUS_TAILLES.forEach(function (t) { el.classList.toggle('focus-taille-' + t.id, t.id === r.taille); });
    });

    focusPeindreHeure();
    focusPeindreCitation();
    focusPeindreStyleTemps(r);

    focusMarquerChoix('focusChoixStyle', 'style', r.style);
    focusMarquerChoix('focusChoixPolice', 'police', r.police);
    focusMarquerChoix('focusChoixFormat', 'format', r.format);
    focusMarquerChoix('focusChoixTaille', 'taille', r.taille);

    var cochees = { focusOptBarre: r.barre, focusOptNotif: r.notif, focusOptAuto: r.auto };
    Object.keys(cochees).forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.checked !== cochees[id]) el.checked = cochees[id];
    });
}

function focusMessageReglage(texte) {
    var statut = document.getElementById('focusStatutReglage');
    if (statut) statut.textContent = texte || '';
}

/* Un choix de style, de police, de format ou de taille. */
function focusChoisirReglage(cle, valeur) {
    var r = focusLireReglages();
    var nouveau = {
        style: r.style, barre: r.barre, notif: r.notif, auto: r.auto,
        police: r.police, format: r.format, taille: r.taille
    };
    nouveau[cle] = valeur;
    focusEcrireReglages(nouveau);
    focusPeindre();
}

/* Les trois interrupteurs. La notification demande l'autorisation du navigateur. */
function focusChoisirOption(cle, actif) {
    var r = focusLireReglages();
    var nouveau = {
        style: r.style, barre: r.barre, notif: r.notif, auto: r.auto,
        police: r.police, format: r.format, taille: r.taille
    };
    if (cle === 'notif' && actif) {
        if (typeof Notification === 'undefined') {
            focusMessageReglage('Les notifications ne sont pas disponibles dans ce navigateur.');
            nouveau.notif = false;
            focusEcrireReglages(nouveau);
            focusPeindre();
            return;
        }
        if (Notification.permission === 'denied') {
            focusMessageReglage('Notifications bloquées : autorise-les dans les réglages du navigateur.');
            nouveau.notif = false;
            focusEcrireReglages(nouveau);
            focusPeindre();
            return;
        }
        if (Notification.permission === 'default') {
            focusMessageReglage('Demande d\'autorisation en cours…');
            Promise.resolve(Notification.requestPermission()).then(function (reponse) {
                var suite = focusLireReglages();
                var fin = {
                    style: suite.style, barre: suite.barre, notif: reponse === 'granted', auto: suite.auto,
                    police: suite.police, format: suite.format, taille: suite.taille
                };
                focusEcrireReglages(fin);
                focusMessageReglage(reponse === 'granted' ? 'Notifications activées.' : 'Notifications non autorisées.');
                focusPeindre();
            }, function () {
                focusMessageReglage('Notifications non autorisées.');
                focusPeindre();
            });
            return;
        }
        nouveau.notif = true;
        focusMessageReglage('Notifications activées.');
    } else {
        nouveau[cle] = !!actif;
        focusMessageReglage('');
    }
    focusEcrireReglages(nouveau);
    focusPeindre();
}

/* Notification de fin de phase, seulement si l'élève l'a demandée et autorisée. */
function focusNotifierFin(fini) {
    var r = focusLireReglages();
    if (!r.notif || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    var corps = fini === 'focus'
        ? 'Concentration terminée : place-toi en pause.'
        : 'Pause terminée : prêt pour une nouvelle concentration ?';
    try { new Notification('Studyplan · minuteur', { body: corps, tag: 'studyplan-minuteur' }); } catch (e) {}
}

/* Enchaînement automatique : la phase suivante démarre seule, avec sa durée. */
function focusDemarrerEnchainement() {
    focusEtat.running = true;
    focusEtat.fin = Date.now() + focusEtat.restant * 1000;
    focusLancerIntervalle();
    if (typeof focusInitAudio === 'function') { try { focusInitAudio(); } catch (e) {} }
    if (focusEtat.mode === 'focus' && typeof chronoRendreMusique === 'function') {
        try { chronoRendreMusique(); } catch (e) {}
    }
    focusPeindre();
}

/* Le bouton Paramètres de la séance : ouvre le minuteur avec le panneau. */
function accueilOuvrirParametres() {
    if (typeof memoireAller === 'function') memoireAller('pomodoro');
    else if (typeof navigateTo === 'function') navigateTo('pomodoro');
    setTimeout(function () {
        var panneau = document.getElementById('focusReglages');
        if (panneau && panneau.hidden && typeof focusBasculerReglages === 'function') focusBasculerReglages();
    }, 0);
}

focusConstruireChoix();
if (!window.__focusHorloge) window.__focusHorloge = setInterval(focusPeindreHeure, 15000);
