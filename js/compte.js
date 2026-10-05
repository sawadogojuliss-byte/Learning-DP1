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

function compteUtile(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.profilComplet) return true;
    if (data.userName) return true;
    if (data.etape && data.etape !== 'accueil') return true;
    if (Array.isArray(data.subjects) && data.subjects.length) return true;
    return false;
}

function compteRichesse(data) {
    if (!compteUtile(data)) return 0;
    var n = data.profilComplet ? 40 : 0;
    if (data.userName) n += 4;
    if (data.ibYear) n += 2;
    if (Array.isArray(data.subjects)) n += data.subjects.length * 3;
    if (Array.isArray(data.optionalSubjects)) n += data.optionalSubjects.length * 2;
    if (Array.isArray(data.selectedActivities)) n += data.selectedActivities.length;
    if (Array.isArray(data.customEvents)) n += Math.min(data.customEvents.length, 12);
    if (Array.isArray(data.exercices)) n += Math.min(data.exercices.length, 8);
    if (Array.isArray(data.memoirPlan) && data.memoirPlan.length) n += 2;
    return n;
}

function compteChoisirProfil(a, b) {
    var ua = compteUtile(a);
    var ub = compteUtile(b);
    if (ua && !ub) return a;
    if (ub && !ua) return b;
    if (!ua && !ub) return null;
    var ca = !!(a && a.profilComplet);
    var cb = !!(b && b.profilComplet);
    if (ca && !cb) return a;
    if (cb && !ca) return b;
    var ta = Date.parse(a && a.savedAt) || 0;
    var tb = Date.parse(b && b.savedAt) || 0;
    if (ta !== tb) return ta > tb ? a : b;
    return compteRichesse(a) >= compteRichesse(b) ? a : b;
}

function compteAfficherProfil(data) {
    if (!data || typeof memoireAppliquer !== 'function') return;
    memoireAppliquer(data, { compte: true });
    if (data.profilComplet) window.__profilComplet = true;
    var etape = data.profilComplet ? 'planning' : (data.etape || 'accueil');
    if (typeof memoireAller === 'function') memoireAller(etape);
    if (data.profilComplet && typeof renderPlanning === 'function') {
        try { renderPlanning(); } catch (e) {}
    }
    if (typeof majClasseAffichage === 'function') {
        try { majClasseAffichage(); } catch (e) {}
    }
    if (typeof memoireMajIndicateur === 'function') memoireMajIndicateur();
    if (typeof memoireSauvegarder === 'function') memoireSauvegarder();
}

function compteEquivalent(a, b) {
    if (!a || !b) return false;
    function norm(d) {
        var c = JSON.parse(JSON.stringify(d));
        delete c.savedAt;
        delete c.google;
        delete c.etape;
        return JSON.stringify(c);
    }
    try { return norm(a) === norm(b); } catch (e) { return false; }
}

function compteDoitGarderLie(ancien, courant) {
    if (!compteUtile(ancien)) return false;
    if (!compteUtile(courant)) return true;
    if (ancien.profilComplet && !courant.profilComplet) return true;
    if (!courant.profilComplet && compteRichesse(ancien) > compteRichesse(courant)) return true;
    return false;
}

function compteProfilActuel() {
    var stocke = typeof memoireJson === 'function' ? memoireJson(MEMOIRE_KEY) : null;
    var lie = null;
    var precieux = null;
    var locale = typeof memoireJson === 'function' ? memoireJson('studyPlanIB_sauvegarde:locale') : null;
    if (window.compteSession && window.compteSession.sub && typeof memoireJson === 'function') {
        lie = memoireJson(MEMOIRE_KEY + ':' + window.compteSession.sub);
        precieux = memoireJson('studyPlanIB_sauvegarde:' + window.compteSession.sub);
    }
    var choisi = compteChoisirProfil(precieux, compteChoisirProfil(lie, compteChoisirProfil(stocke, locale)));
    if (choisi) return choisi;
    if (typeof memoireLireEtat !== 'function') return null;
    var vivant = memoireLireEtat();
    if (!compteUtile(vivant)) return null;
    vivant.savedAt = stocke && stocke.savedAt ? stocke.savedAt : '';
    return vivant;
}

function compteSourceNuage() {
    var actuel = compteProfilActuel();
    if (typeof memoireLireEtat !== 'function') return actuel;
    var vivant = memoireLireEtat();
    if (!compteUtile(vivant)) return actuel;
    if (!compteUtile(actuel) || !compteDoitGarderLie(actuel, vivant)) return vivant;
    return actuel;
}

function compteRestaurerLocal() {
    if (!window.compteSession || !window.compteSession.sub || typeof memoireJson !== 'function') return false;
    var lie = memoireJson(MEMOIRE_KEY + ':' + window.compteSession.sub);
    var stocke = memoireJson(MEMOIRE_KEY);
    var choisi = compteChoisirProfil(lie, stocke);
    if (!choisi || choisi !== lie || compteEquivalent(lie, stocke)) return false;
    compteAfficherProfil(lie);
    return true;
}

var COMPTE_IDENTITE_SCOPE = 'openid email profile';
var COMPTE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
var COMPTE_DRIVE_NOM = 'study-plan-ib-profil.json';
var compteJeton = '';
var compteJetonFin = 0;
var compteNuageTimer = null;
var compteNuageEnCours = false;

function compteCleDrive() {
    return window.compteSession && window.compteSession.sub ? 'studyPlanIB_driveFileId:' + window.compteSession.sub : '';
}

function compteDemanderJeton(prompt, scope) {
    return new Promise(function (resolve, reject) {
        if (!window.google || !google.accounts || !google.accounts.oauth2) {
            reject(new Error('google'));
            return;
        }
        var fini = false;
        function ok(token) { if (fini) return; fini = true; resolve(token); }
        function ko(err) { if (fini) return; fini = true; reject(err || new Error('jeton')); }
        var client = google.accounts.oauth2.initTokenClient({
            client_id: compteClientId(),
            scope: scope || COMPTE_IDENTITE_SCOPE,
            include_granted_scopes: false,
            callback: function (resp) {
                if (resp && resp.access_token) {
                    compteJeton = resp.access_token;
                    compteJetonFin = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
                    ok(compteJeton);
                } else ko(resp || new Error('jeton'));
            },
            error_callback: function (err) { ko(err); }
        });
        try { client.requestAccessToken({ prompt: prompt || 'none' }); }
        catch (e) { ko(e); }
    });
}

function compteObtenirJeton() {
    if (compteJeton && Date.now() < compteJetonFin - 60000) return Promise.resolve(compteJeton);
    return Promise.reject(new Error('silence'));
}

function compteDriveTrouver(token) {
    var cle = compteCleDrive();
    var connu = '';
    try { connu = cle ? localStorage.getItem(cle) || '' : ''; } catch (e) {}
    if (connu) return Promise.resolve(connu);
    var q = encodeURIComponent("name='" + COMPTE_DRIVE_NOM + "' and trashed=false");
    return fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)&q=' + q, {
        headers: { Authorization: 'Bearer ' + token }
    }).then(function (res) {
        if (!res.ok) throw new Error('drive');
        return res.json();
    }).then(function (data) {
        var id = data && data.files && data.files[0] && data.files[0].id;
        if (id && cle) {
            try { localStorage.setItem(cle, id); } catch (e) {}
        }
        return id || '';
    });
}

function compteDriveLire(token, id) {
    if (!id) return Promise.resolve(null);
    return fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?alt=media', {
        headers: { Authorization: 'Bearer ' + token }
    }).then(function (res) {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('lecture');
        return res.json();
    });
}

function compteDriveEcrire(token, id, json) {
    function media(fileId) {
        return fetch('https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(fileId) + '?uploadType=media', {
            method: 'PATCH',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json; charset=UTF-8'
            },
            body: json
        }).then(function (res) {
            if (!res.ok) throw new Error('media');
            return res.json();
        });
    }
    if (id) return media(id);
    return fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: COMPTE_DRIVE_NOM,
            mimeType: 'application/json',
            parents: ['appDataFolder']
        })
    }).then(function (res) {
        if (!res.ok) throw new Error('creation');
        return res.json();
    }).then(function (fichier) {
        if (!fichier || !fichier.id) throw new Error('creation');
        if (compteCleDrive()) {
            try { localStorage.setItem(compteCleDrive(), fichier.id); } catch (e) {}
        }
        return media(fichier.id);
    });
}

function compteNuageFusionner(token) {
    return compteDriveTrouver(token).then(function (id) {
        return compteDriveLire(token, id).then(function (nuage) {
            var local = compteSourceNuage();
            var choisi = compteChoisirProfil(nuage, local);
            if (choisi && choisi === nuage && !compteEquivalent(nuage, local)) {
                compteAfficherProfil(nuage);
                if (typeof v3Toast === 'function') v3Toast('Emploi du temps restauré.', 'success');
                return 'restored';
            }
            if (!compteUtile(local)) return 'empty';
            if (nuage && compteEquivalent(nuage, local)) return 'same';
            return compteDriveEcrire(token, id, JSON.stringify(local)).then(function () { return 'uploaded'; });
        });
    });
}

function compteNuageSynchroniser(interactif) {
    if (!window.compteSession || !window.compteSession.sub || !compteClientId()) return Promise.resolve('skip');
    if (compteNuageEnCours) return Promise.resolve('busy');
    compteNuageEnCours = true;
    var etat = 'failed';
    return compteChargerGIS().then(function () {
        return compteObtenirJeton(!!interactif);
    }).then(function (token) {
        return compteNuageFusionner(token);
    }).then(function (resultat) {
        etat = resultat || 'ok';
    }).catch(function () {
        etat = 'failed';
    }).then(function () {
        compteNuageEnCours = false;
        return etat;
    });
}

function compteNuagePlanifier() {
    if (compteNuageTimer) clearTimeout(compteNuageTimer);
    compteNuageTimer = setTimeout(function () {
        compteNuageTimer = null;
        compteNuageSynchroniser(false);
    }, 6000);
}

function compteNuageEffacer() {
    if (!window.compteSession || !window.compteSession.sub) return Promise.resolve();
    function supprimer(token) {
        return compteDriveTrouver(token).then(function (id) {
            if (!id) return null;
            return fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id), {
                method: 'DELETE',
                headers: { Authorization: 'Bearer ' + token }
            }).then(function () {
                var cle = compteCleDrive();
                if (cle) {
                    try { localStorage.removeItem(cle); } catch (e) {}
                }
            });
        });
    }
    return compteChargerGIS().then(function () {
        return compteObtenirJeton();
    }).then(supprimer).catch(function () { return null; });
}

var compteCopieEnAttente = false;
var COMPTE_INVITE = 'Reconnecte-toi avec Google pour retrouver ton emploi du temps et tes informations.';

function compteSessionDepuis(payload) {
    return {
        sub: payload.sub,
        name: payload.name || '',
        email: payload.email || '',
        picture: payload.picture || '',
        given_name: payload.given_name || payload.name || ''
    };
}

function comptePoserBoutonCopie() {
    if (window.compteSession && window.compteSession.sub) return;
    var texte = document.getElementById('compteInviteTexte');
    if (texte) texte.textContent = 'Confirme Google pour ouvrir ton emploi du temps et tes informations.';
    var invite = document.getElementById('compteInvite');
    if (invite) invite.hidden = false;
    var slot = document.getElementById('googleBtnSlot');
    if (!slot) return;
    slot.innerHTML = '';
    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.id = 'compteCopieBtn';
    bouton.className = 'compte-google';
    bouton.textContent = 'Retrouver ma progression';
    bouton.onclick = function () { compteChargerCopieGoogle(bouton); };
    slot.appendChild(bouton);
}

function compteAfficherBoutonCopie() {
    compteCopieEnAttente = true;
    var modal = document.getElementById('compteModal');
    if (modal) modal.classList.add('active');
    comptePoserBoutonCopie();
}

function compteChargerCopieGoogle(bouton) {
    if (bouton) {
        bouton.disabled = true;
        bouton.textContent = 'Récupération…';
    }
    compteMessage('');
    compteConnexionGoogle({ currentTarget: bouton }).catch(function () {
        compteMessage('La récupération n’a pas abouti. Réessaie.');
    }).then(function () {
        if (bouton && document.body.contains(bouton)) {
            bouton.disabled = false;
            bouton.textContent = 'Retrouver ma progression';
        }
    });
}

function compteOuvrirPlanning() {
    if (typeof memoireAller === 'function') memoireAller('planning');
    if (typeof renderPlanning === 'function') {
        try { renderPlanning(); } catch (e) {}
    }
    if (typeof renderEEia === 'function') {
        try { renderEEia(); } catch (e) {}
    }
}

function compteTerminerConnexion(session) {
    var stocke = typeof memoireJson === 'function' ? memoireJson(MEMOIRE_KEY) : null;
    var avait = !!(stocke && stocke.profilComplet);
    localStorage.setItem(COMPTE_SESSION_KEY, JSON.stringify(session));
    window.compteSession = session;
    var restaure = false;
    try { restaure = compteRestaurerLocal(); } catch (e) {}
    if (!restaure) {
        var actuel = typeof memoireLireEtat === 'function' ? memoireLireEtat() : null;
        if (actuel && actuel.profilComplet) {
            compteOuvrirPlanning();
            restaure = true;
        } else if (typeof userName !== 'undefined' && !userName && session.given_name) {
            userName = session.given_name;
            if (typeof memoireSet === 'function') memoireSet('nameInput', session.given_name);
        }
    }
    if (typeof memoireSauvegarder === 'function') memoireSauvegarder();
    compteRafraichir();
    if (restaure) {
        compteCopieEnAttente = false;
        fermerCompte();
    }
    if (typeof v3Toast === 'function') {
        v3Toast(restaure && !avait ? 'Progression retrouvée.' : ('Connecté avec Google : ' + (session.email || session.name)), 'success');
    }
    return restaure;
}

function compteRelierNuage() {
    return compteNuageSynchroniser(false).then(function (etat) {
        if (etat === 'restored') {
            compteCopieEnAttente = false;
            fermerCompte();
            return etat;
        }
        if (etat === 'failed') {
            var profil = compteProfilActuel();
            if (!profil || !profil.profilComplet) compteAfficherBoutonCopie();
        }
        return etat;
    });
}

function compteMemoriserSession(session) {
    localStorage.setItem(COMPTE_SESSION_KEY, JSON.stringify(session));
    window.compteSession = session;
}

function compteMontrerProgression(data, forcer) {
    if (!data || typeof data !== 'object' || data.efface) return false;
    var stocke = typeof memoireJson === 'function' ? memoireJson(MEMOIRE_KEY) : null;
    var applique = false;
    if (!compteEquivalent(data, stocke) && typeof compteAfficherProfil === 'function') {
        compteAfficherProfil(data);
        applique = true;
    }
    var ouvrir = !!(data.profilComplet && (forcer || !stocke || !stocke.profilComplet));
    if (ouvrir) {
        compteOuvrirPlanning();
        fermerCompte();
    }
    return applique || ouvrir;
}

function compteRestaurerTout(session, token) {
    compteMemoriserSession(session);
    var lecture = typeof sauvegardeMeilleure === 'function' ? sauvegardeMeilleure(session.sub) : Promise.resolve(compteProfilActuel());
    return lecture.then(function (local) {
        var ouvert = compteMontrerProgression(local, true);
        if (local && typeof sauvegardeEcrireLocal === 'function') sauvegardeEcrireLocal(session.sub, local, true);
        var suite = token
            ? compteNuageFusionner(token).catch(function () { return 'echec'; })
            : Promise.resolve(ouvert ? 'local' : 'vide');
        return suite.then(function (etat) {
            var meilleur = compteSourceNuage() || local;
            if (meilleur && meilleur.profilComplet) {
                if (compteMontrerProgression(meilleur, true)) ouvert = true;
            }
            if (meilleur && typeof sauvegardeEcrireLocal === 'function') sauvegardeEcrireLocal(session.sub, meilleur, true);
            if (!token || !meilleur || !compteUtile(meilleur)) return ouvert ? 'local' : (etat || 'vide');
            if (etat === 'same' || etat === 'uploaded' || etat === 'restored') {
                return (etat === 'restored' || ouvert) ? 'restored' : etat;
            }
            return compteDriveTrouver(token).then(function (id) {
                return compteDriveEcrire(token, id, JSON.stringify(meilleur));
            }).then(function () {
                return ouvert ? 'restored' : 'uploaded';
            }).catch(function () {
                return ouvert ? 'local' : 'echec';
            });
        });
    }).then(function (etat) {
        compteRafraichir();
        if (etat === 'restored' || etat === 'local') {
            if (typeof v3Toast === 'function') v3Toast('Progression retrouvée.', 'success');
        } else if (etat === 'uploaded' || etat === 'same') {
            if (typeof v3Toast === 'function') v3Toast('Sauvegarde liée à ton compte Google.', 'success');
        } else if (etat === 'echec') {
            compteMessage('Connecté, mais la copie Google n’a pas pu être enregistrée. Réessaie.');
            if (typeof v3Toast === 'function') v3Toast('Connecté avec Google : ' + (session.email || session.name), 'info');
        } else if (typeof v3Toast === 'function') {
            v3Toast('Connecté avec Google : ' + (session.email || session.name), 'success');
        }
        return etat;
    });
}

function compteConnexionGoogle(origine) {
    var bouton = (origine && origine.currentTarget) || document.getElementById('compteGoogleBtn');
    var libelle = bouton ? bouton.textContent : 'Continuer avec Google';
    if (bouton) {
        bouton.disabled = true;
        bouton.textContent = 'Connexion…';
    }
    compteMessage('');
    if (typeof sauvegardeCapturer === 'function' && typeof sauvegardeEcrireLocal === 'function') {
        var instant = sauvegardeCapturer();
        if (instant) sauvegardeEcrireLocal('locale', instant, false);
    }
    function fin() {
        if (bouton && document.body.contains(bouton)) {
            bouton.disabled = false;
            bouton.textContent = libelle;
        }
    }
    function lancer() {
        return comptePreparerGoogle().then(function () {
            fin();
        }).catch(function (e) {
            compteMessage((e && e.message) || 'La connexion Google n’a pas abouti. Réessaie.');
            fin();
        });
    }
    if (window.google && google.accounts && google.accounts.oauth2) return lancer();
    return compteChargerGIS().then(lancer, function (e) {
        compteMessage((e && e.message) || 'Google est indisponible pour le moment.');
        fin();
    });
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
    var session = compteSessionDepuis(payload);
    if (typeof sauvegardeCapturer === 'function' && typeof sauvegardeEcrireLocal === 'function') {
        var instant = sauvegardeCapturer();
        if (instant) sauvegardeEcrireLocal('locale', instant, false);
    }
    compteRestaurerTout(session, null);
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
        var texteInvite = document.getElementById('compteInviteTexte');
        if (texteInvite && !compteCopieEnAttente) texteInvite.textContent = COMPTE_INVITE;
        function poserBouton(host) {
            if (!host || host.querySelector('iframe')) return;
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
        if (window.compteSession && window.compteSession.sub) {
            var deja = document.getElementById('googleBtnSlot');
            if (deja) deja.innerHTML = '';
            return true;
        }
        if (!compteCopieEnAttente) poserBouton(document.getElementById('googleBtnSlot'));
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
    var complet = !!window.__profilComplet;
    try {
        var mem = typeof memoireJson === 'function' ? memoireJson(MEMOIRE_KEY) : null;
        if (mem && mem.profilComplet) complet = true;
    } catch (e) {}
    if (profil) profil.hidden = !session;
    if (invite) invite.hidden = !!session;
    if (deconnect) deconnect.hidden = !session;
    var slotGoogle = document.getElementById('googleBtnSlot');
    if (session && slotGoogle) slotGoogle.innerHTML = '';
    var second = document.getElementById('googleBtnRestore');
    if (second) second.remove();
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
    if (menuDetail) menuDetail.textContent = session ? (session.email || 'Connecté avec Google') : 'Connexion Google';
    var setup = document.getElementById('compteSetup');
    if (setup && !compteClientId()) setup.open = true;
}

function ouvrirCompte() {
    var modal = document.getElementById('compteModal');
    if (!modal) return;
    modal.classList.add('active');
    compteMessage('');
    compteRafraichir();
    if (compteCopieEnAttente) {
        comptePoserBoutonCopie();
        return;
    }
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
    compteCopieEnAttente = false;
    compteJeton = '';
    compteJetonFin = 0;
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
    comptePreparerGoogle().catch(function () {});
    if (window.compteSession && window.compteSession.sub) {
        var sub = window.compteSession.sub;
        var appliquer = function (data) {
            if (!data) return;
            if (compteMontrerProgression(data, false) && typeof v3Toast === 'function') v3Toast('Progression retrouvée.', 'success');
        };
        try { appliquer(compteRestaurerLocal() ? memoireJson(MEMOIRE_KEY) : null); } catch (e) {}
        if (typeof sauvegardeMeilleure === 'function') {
            sauvegardeMeilleure(sub).then(appliquer).catch(function () {});
        }
        setTimeout(function () { compteNuageSynchroniser(false); }, 500);
    }
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
