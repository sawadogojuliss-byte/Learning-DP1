/* ============================================================
   Compte — mémoire visible et connexion Google
   La progression est déjà sauvée sans compte. Google l'associe
   à l'identité de l'élève sur ce navigateur (ID client OAuth).
   ============================================================ */

var COMPTE_SESSION_KEY = 'studyPlanIB_googleSession';
var COMPTE_CLIENT_KEY = 'studyPlanIB_googleClientId';
var compteGisPret = false;

function compteClientId() {
    var stocke = '';
    try { stocke = localStorage.getItem(COMPTE_CLIENT_KEY) || ''; } catch (e) {}
    return String(window.STUDYPLAN_GOOGLE_CLIENT_ID || stocke || '').trim();
}

function compteDecoderJwt(token) {
    var part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    var pad = part + '='.repeat((4 - part.length % 4) % 4);
    var json = decodeURIComponent(Array.prototype.map.call(atob(pad), function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(json);
}

function compteMessage(texte) {
    var el = document.getElementById('compteMessage');
    if (!el) return;
    el.hidden = !texte;
    el.textContent = texte || '';
}

function compteChargerGIS() {
    if (window.google && google.accounts && google.accounts.id) return Promise.resolve();
    if (window.__gisPromise) return window.__gisPromise;
    window.__gisPromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = function () { resolve(); };
        s.onerror = function () { reject(new Error('Impossible de joindre Google. Réessaie dans un onglet.')); };
        document.head.appendChild(s);
    });
    return window.__gisPromise;
}

function compteOnCredential(resp) {
    if (!resp || !resp.credential) return;
    var payload;
    try {
        payload = compteDecoderJwt(resp.credential);
    } catch (e) {
        compteMessage('Réponse Google illisible.');
        return;
    }
    var session = {
        sub: payload.sub,
        name: payload.name || '',
        email: payload.email || '',
        picture: payload.picture || '',
        given_name: payload.given_name || payload.name || ''
    };
    localStorage.setItem(COMPTE_SESSION_KEY, JSON.stringify(session));
    window.compteSession = session;
    if (!userName && session.given_name) {
        userName = session.given_name;
        if (typeof memoireSet === 'function') memoireSet('nameInput', userName);
    }
    var lie = typeof memoireJson === 'function' ? memoireJson(MEMOIRE_KEY + ':' + session.sub) : null;
    if (lie && lie.userName && !userName) {
        memoireAppliquer(lie);
        memoireAller(lie.profilComplet ? (lie.etape && lie.etape !== 'accueil' ? lie.etape : 'planning') : (lie.etape || 'accueil'));
    }
    if (typeof memoireSauvegarder === 'function') memoireSauvegarder();
    compteRafraichir();
    fermerCompte();
    if (typeof v3Toast === 'function') v3Toast('Connecté avec Google : ' + (session.email || session.name), 'success');
}

function comptePreparerGoogle() {
    var id = compteClientId();
    if (!id) return Promise.resolve(false);
    return compteChargerGIS().then(function () {
        if (!compteGisPret) {
            google.accounts.id.initialize({
                client_id: id,
                callback: compteOnCredential,
                auto_select: false,
                cancel_on_tap_outside: true,
                ux_mode: 'popup',
                context: 'signin'
            });
            compteGisPret = true;
        }
        var host = document.getElementById('googleBtnSlot');
        if (host) {
            host.innerHTML = '';
            google.accounts.id.renderButton(host, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'continue_with',
                shape: 'pill',
                logo_alignment: 'left',
                width: 280,
                locale: 'fr'
            });
        }
        return true;
    });
}

function compteRafraichir() {
    var session = window.compteSession || null;
    var btn = document.getElementById('navCompteBtn');
    if (btn) {
        btn.textContent = '';
        if (session && session.picture) {
            var img = document.createElement('img');
            img.alt = '';
            img.referrerPolicy = 'no-referrer';
            img.src = session.picture;
            btn.appendChild(img);
        }
        btn.appendChild(document.createTextNode(session ? (session.given_name || 'Compte') : 'Se connecter'));
    }
    var profil = document.getElementById('compteProfil');
    var invite = document.getElementById('compteInvite');
    var deconnect = document.getElementById('compteDeconnectBtn');
    if (profil) profil.hidden = !session;
    if (invite) invite.hidden = !!session;
    if (deconnect) deconnect.hidden = !session;
    if (session) {
        var nom = document.getElementById('compteNom');
        var email = document.getElementById('compteEmail');
        var avatar = document.getElementById('compteAvatar');
        if (nom) nom.textContent = session.name || session.given_name || 'Compte Google';
        if (email) email.textContent = session.email || '';
        if (avatar) {
            avatar.hidden = !session.picture;
            if (session.picture) {
                avatar.referrerPolicy = 'no-referrer';
                avatar.src = session.picture;
            }
        }
    }
    var origine = document.getElementById('compteOrigine');
    if (origine) origine.textContent = location.origin;
    var input = document.getElementById('compteClientIdInput');
    if (input && !input.value) input.value = compteClientId();
    var menuNom = document.getElementById('menuCompteNom');
    var menuDetail = document.getElementById('menuCompteDetail');
    if (menuNom) menuNom.textContent = session ? (session.given_name || 'Mon compte') : 'Mon compte';
    if (menuDetail) menuDetail.textContent = session ? (session.email || 'Connecté avec Google') : 'Mémoire active · Google en option';
    var setup = document.getElementById('compteSetup');
    if (setup && !compteClientId()) setup.open = true;
}

function ouvrirCompte() {
    var modal = document.getElementById('compteModal');
    if (!modal) return;
    modal.classList.add('active');
    compteMessage('');
    compteRafraichir();
    comptePreparerGoogle().catch(function (e) {
        compteMessage(e.message || 'Connexion Google indisponible pour le moment.');
    });
}

function fermerCompte() {
    var modal = document.getElementById('compteModal');
    if (modal) modal.classList.remove('active');
}

function compteEnregistrerClientId() {
    var input = document.getElementById('compteClientIdInput');
    var id = (input && input.value || '').trim();
    if (!id || id.indexOf('.apps.googleusercontent.com') === -1) {
        compteMessage('L’ID doit se terminer par .apps.googleusercontent.com.');
        return;
    }
    localStorage.setItem(COMPTE_CLIENT_KEY, id);
    window.STUDYPLAN_GOOGLE_CLIENT_ID = id;
    compteGisPret = false;
    compteMessage('Client ID enregistré. Choisis ton compte Google.');
    comptePreparerGoogle().then(function (ok) {
        if (ok && window.google && google.accounts && google.accounts.id.prompt) {
            google.accounts.id.prompt();
        }
    }).catch(function (e) {
        compteMessage(e.message || 'Google n’a pas pu s’ouvrir.');
    });
}

function compteDeconnecter() {
    window.compteSession = null;
    localStorage.removeItem(COMPTE_SESSION_KEY);
    if (window.google && google.accounts && google.accounts.id) {
        try { google.accounts.id.disableAutoSelect(); } catch (e) {}
    }
    compteRafraichir();
    if (typeof v3Toast === 'function') v3Toast('Compte Google déconnecté. Ta progression reste sur cet appareil.', 'info');
}

function compteExporter() {
    if (typeof memoireSauvegarder === 'function') memoireSauvegarder();
    var brut = localStorage.getItem(MEMOIRE_KEY) || '{}';
    var blob = new Blob([brut], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'study-plan-ib-progression.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function compteImporterFichier(input) {
    var fichier = input.files && input.files[0];
    input.value = '';
    if (!fichier) return;
    var lecteur = new FileReader();
    lecteur.onload = function () {
        try {
            var data = JSON.parse(String(lecteur.result || ''));
            if (!data || typeof data !== 'object') throw new Error('fichier vide');
            localStorage.setItem(MEMOIRE_KEY, JSON.stringify(data));
            if (Array.isArray(data.customEvents)) {
                localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(data.customEvents));
            }
            if (Array.isArray(data.exercices)) {
                localStorage.setItem('studyPlanIB_exercices', JSON.stringify(data.exercices));
            }
            location.reload();
        } catch (e) {
            compteMessage('Ce fichier n’est pas une progression Study Plan IB.');
        }
    };
    lecteur.readAsText(fichier);
}

function compteOuvrirOnglet() {
    window.open(location.href, '_blank', 'noopener');
}

(function () {
    try {
        var sauve = JSON.parse(localStorage.getItem(COMPTE_SESSION_KEY) || 'null');
        if (sauve && sauve.sub) window.compteSession = sauve;
    } catch (e) {}
    var stocke = '';
    try { stocke = localStorage.getItem(COMPTE_CLIENT_KEY) || ''; } catch (e) {}
    if (stocke && !window.STUDYPLAN_GOOGLE_CLIENT_ID) window.STUDYPLAN_GOOGLE_CLIENT_ID = stocke;
    compteRafraichir();
    if (typeof openSideMenu === 'function' && !openSideMenu.__compte) {
        var original = openSideMenu;
        var wrapped = function () {
            compteRafraichir();
            return original.apply(this, arguments);
        };
        wrapped.__compte = true;
        window.openSideMenu = wrapped;
    }
})();
