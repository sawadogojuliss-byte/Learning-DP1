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
    if (typeof memoireReinitialiser === 'function') memoireReinitialiser();
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
    var sub = window.compteSession && window.compteSession.sub;
    if (sub) {
        var dedie = compteLireDedie(sub);
        if (dedie && compteUtile(dedie)) return dedie;
    }
    var stocke = typeof memoireJson === 'function' ? memoireJson(MEMOIRE_KEY) : null;
    var locale = typeof memoireJson === 'function' ? memoireJson('studyPlanIB_sauvegarde:locale') : null;
    var session = window.compteSession;
    var candidats = [stocke, locale].filter(function (item) {
        if (!sub) return item && !(item.google && item.google.sub);
        return item && comptePeutRevendiquer(item, session);
    });
    var choisi = candidats.reduce(function (acc, item) {
        return compteChoisirProfil(item, acc) || acc;
    }, null);
    if (choisi) return choisi;
    if (!sub && typeof memoireLireEtat === 'function') {
        var vivant = memoireLireEtat();
        if (compteUtile(vivant) && !(vivant.google && vivant.google.sub)) return vivant;
    }
    return null;
}

function compteSourceNuage() {
    var sub = window.compteSession && window.compteSession.sub;
    var actuel = compteProfilActuel();
    if (typeof memoireLireEtat !== 'function') return actuel;
    var vivant = memoireLireEtat();
    if (sub && vivant && vivant.google && vivant.google.sub && vivant.google.sub !== sub) vivant = null;
    if (sub && vivant && compteProfilEtranger(vivant, sub) && vivant.google && vivant.google.sub) vivant = null;
    if (!compteUtile(vivant)) return actuel;
    if (!compteUtile(actuel) || !compteDoitGarderLie(actuel, vivant)) return vivant;
    return actuel;
}

function compteRestaurerLocal() {
    if (!window.compteSession || !window.compteSession.sub || typeof memoireJson !== 'function') return false;
    var lie = compteLireDedie(window.compteSession.sub);
    var stocke = memoireJson(MEMOIRE_KEY);
    if (!lie || !compteUtile(lie) || compteEquivalent(lie, stocke)) return false;
    if (stocke && stocke.google && stocke.google.sub && stocke.google.sub !== window.compteSession.sub) {
        compteBasculer(lie, window.compteSession);
        return true;
    }
    if (!comptePeutRevendiquer(stocke, window.compteSession) && compteUtile(lie)) {
        compteBasculer(lie, window.compteSession);
        return true;
    }
    return false;
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
var session = window.compteSession;
            var local = compteSourceNuage();
            if (session && session.sub) {
                if (local && !compteProfilEtranger(local, session.sub)) local = compteEstampiller(local, session);
                else local = null;
                if (nuage && compteUtile(nuage)) nuage = compteEstampiller(nuage, session);
            }
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

var COMPTE_IDENTITES_KEY = 'studyPlanIB_identites';

function compteNormaliserNom(nom) {
    return String(nom || '').trim().replace(/\s+/g, ' ');
}

function compteEmailCle(email) {
    return String(email || '').trim().toLowerCase();
}

function compteLireIdentites() {
    var data = typeof memoireJson === 'function' ? memoireJson(COMPTE_IDENTITES_KEY) : null;
    if (!data || typeof data !== 'object') data = { comptes: {}, emails: {}, alias: {} };
    if (!data.comptes || typeof data.comptes !== 'object') data.comptes = {};
    if (!data.emails || typeof data.emails !== 'object') data.emails = {};
    if (!data.alias || typeof data.alias !== 'object') data.alias = {};
    return data;
}

function compteEcrireIdentites(data) {
    try { localStorage.setItem(COMPTE_IDENTITES_KEY, JSON.stringify(data)); } catch (e) {}
}

function compteCanonique(sub) {
    var id = compteLireIdentites();
    var vu = {};
    var cur = sub || '';
    while (cur && id.alias[cur] && id.alias[cur] !== cur && !vu[cur]) {
        vu[cur] = true;
        cur = id.alias[cur];
    }
    return cur || '';
}

function compteSubDeEmail(email) {
    var cle = compteEmailCle(email);
    if (!cle) return '';
    return compteCanonique(compteLireIdentites().emails[cle] || '');
}

function compteNomLie(sub) {
    var canon = compteCanonique(sub);
    if (!canon) return '';
    var row = compteLireIdentites().comptes[canon];
    return row && row.userName ? String(row.userName) : '';
}

function compteLierCompte(session, nom) {
    if (!session || !session.sub) return '';
    var id = compteLireIdentites();
    var email = compteEmailCle(session.email);
    var canon = session.sub;
    if (email && id.emails[email]) canon = compteCanonique(id.emails[email]) || id.emails[email];
    else if (email) id.emails[email] = session.sub;
    if (canon !== session.sub) id.alias[session.sub] = canon;
    if (email) id.emails[email] = canon;
    var row = id.comptes[canon] || { userId: canon, email: session.email || '', userName: '' };
    row.userId = canon;
    if (session.email) row.email = session.email;
    var propre = compteNormaliserNom(nom);
    if (propre) row.userName = propre;
    row.at = new Date().toISOString();
    id.comptes[canon] = row;
    compteEcrireIdentites(id);
    return canon;
}

function compteLierNom(sub, nom, email) {
    return compteLierCompte({ sub: sub, email: email || '' }, nom);
}

function compteOublierNom(sub) {
    var canon = compteCanonique(sub);
    if (!canon) return;
    var id = compteLireIdentites();
    Object.keys(id.emails).forEach(function (cle) {
        if (compteCanonique(id.emails[cle]) === canon) delete id.emails[cle];
    });
    Object.keys(id.alias).forEach(function (cle) {
        if (id.alias[cle] === canon || cle === canon) delete id.alias[cle];
    });
    delete id.comptes[canon];
    compteEcrireIdentites(id);
}

function compteMemeCompte(a, b) {
    if (!a || !b) return false;
    var ca = compteCanonique(a);
    var cb = compteCanonique(b);
    return !!(ca && cb && ca === cb);
}

function compteProfilEtranger(data, sub) {
    if (!data || typeof data !== 'object' || data.efface) return true;
    var canon = compteCanonique(sub);
    if (!canon) return true;
    var dataSub = data.google && data.google.sub;
    if (dataSub && !compteMemeCompte(dataSub, canon)) return true;
    var dataId = data.utilisateurId;
    if (dataId && !compteMemeCompte(dataId, canon)) return true;
    var owner = compteSubDeEmail(data.google && data.google.email);
    if (owner && !compteMemeCompte(owner, canon)) return true;
    return false;
}

function comptePeutRevendiquer(data, session) {
    if (!data || !session || !session.sub || data.efface) return false;
    if (compteProfilEtranger(data, session.sub) && (data.google && data.google.sub || data.utilisateurId)) return false;
    if (data.google && data.google.sub && !compteMemeCompte(data.google.sub, session.sub)) return false;
    if (data.utilisateurId && !compteMemeCompte(data.utilisateurId, session.sub)) return false;
    var owner = compteSubDeEmail(data.google && data.google.email);
    if (owner && !compteMemeCompte(owner, session.sub)) return false;
    return true;
}

function compteLireDedie(sub) {
    var canon = compteCanonique(sub) || sub;
    if (!canon || typeof memoireJson !== 'function') return null;
    var cles = [canon];
    if (sub && sub !== canon) cles.push(sub);
    var choisi = null;
    cles.forEach(function (id) {
        var lie = memoireJson(MEMOIRE_KEY + ':' + id);
        var precieux = memoireJson('studyPlanIB_sauvegarde:' + id);
        var candidat = typeof compteChoisirProfil === 'function' ? compteChoisirProfil(precieux, lie) : (precieux || lie);
        if (candidat && !compteProfilEtranger(candidat, canon)) {
            choisi = typeof compteChoisirProfil === 'function' ? (compteChoisirProfil(candidat, choisi) || candidat) : (choisi || candidat);
        }
    });
    return choisi;
}

function compteProprietaireConnu() {
    if (window.compteSession && window.compteSession.sub) return window.compteSession;
    if (window.compteProprietaire && window.compteProprietaire.sub) return window.compteProprietaire;
    try {
        var garde = JSON.parse(localStorage.getItem('studyPlanIB_proprietaire') || 'null');
        if (garde && garde.sub) return garde;
    } catch (e) {}
    if (typeof memoireJson === 'function') {
        var data = memoireJson(MEMOIRE_KEY);
        if (data && data.google && data.google.sub) return data.google;
    }
    return null;
}

function compteMemoriserProprietaire(session) {
    window.compteProprietaire = session && session.sub ? session : null;
    try {
        if (session && session.sub) localStorage.setItem('studyPlanIB_proprietaire', JSON.stringify(session));
        else localStorage.removeItem('studyPlanIB_proprietaire');
    } catch (e) {}
}

function compteEstampiller(data, session) {
    var copie;
    try { copie = JSON.parse(JSON.stringify(data || {})); } catch (e) { copie = data || {}; }
    var canon = compteLierCompte(session, copie.userName || '');
    copie.utilisateurId = canon || session.sub;
    copie.google = {
        sub: canon || session.sub,
        email: session.email || '',
        name: session.name || '',
        given_name: session.given_name || '',
        picture: session.picture || ''
    };
    if (!copie.userName) copie.userName = compteNomLie(canon || session.sub) || '';
    return copie;
}

function compteEtatVide(session) {
    return {
        v: 1,
        savedAt: new Date().toISOString(),
        etape: 'prenom',
        profilComplet: false,
        userName: compteNomLie(session && session.sub) || '',
        utilisateurId: session && session.sub ? (compteCanonique(session.sub) || session.sub) : '',
        subjects: [],
        optionalSubjects: [],
        customEvents: [],
        exercices: [],
        selectedActivities: [],
        google: session || null
    };
}

function compteArchiverPour(sub, data) {
    sub = compteCanonique(sub) || sub;
    if (!sub || !data || typeof data !== 'object') return;
    var copie;
    try { copie = JSON.parse(JSON.stringify(data)); } catch (e) { return; }
    copie.utilisateurId = sub;
    if (!copie.google || !compteMemeCompte(copie.google.sub, sub)) {
        copie.google = { sub: sub, email: (copie.google && copie.google.email) || '' };
    }
    try { localStorage.setItem(MEMOIRE_KEY + ':' + sub, JSON.stringify(copie)); } catch (e) {}
    if (typeof sauvegardeEcrireLocal === 'function') sauvegardeEcrireLocal(sub, copie, true);
}

function compteIndexerExistants() {
    var id = compteLireIdentites();
    var i, cle, data, sub;
    try {
        for (i = 0; i < localStorage.length; i++) {
            cle = localStorage.key(i);
            if (!cle || (cle.indexOf('studyPlanIB_profil:') !== 0 && cle.indexOf('studyPlanIB_sauvegarde:') !== 0)) continue;
            if (cle.slice(-7) === ':locale') continue;
            data = memoireJson(cle);
            if (!data || !data.userName) continue;
            sub = data.utilisateurId || (data.google && data.google.sub) || cle.split(':').pop();
            sub = compteCanonique(sub) || sub;
            if (!sub || sub === 'locale' || sub.length < 4) continue;
            var email = compteEmailCle(data.google && data.google.email);
            if (email && id.emails[email] && compteCanonique(id.emails[email]) !== sub) continue;
            if (email && !id.emails[email]) id.emails[email] = sub;
            if (!id.comptes[sub]) {
                id.comptes[sub] = { userId: sub, userName: data.userName, email: (data.google && data.google.email) || '', at: data.savedAt || '' };
            }
        }
        compteEcrireIdentites(id);
    } catch (e) {}
}

function compteBasculer(data, session) {
    if (session && session.sub) {
        data = compteEstampiller(data || compteEtatVide(session), session);
        if (data.userName) compteLierNom(session.sub, data.userName, session.email || '');
    }
    compteAfficherProfil(data || {});
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
    return compteRestaurerTout(session, null);
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
    if (!session || !session.sub) return Promise.resolve('vide');
    var ancien = compteProprietaireConnu();
    var vivant = typeof memoireLireEtat === 'function' ? memoireLireEtat() : null;
    if (ancien && ancien.sub && ancien.sub !== session.sub) {
        compteArchiverPour(ancien.sub, vivant);
        vivant = null;
    } else if (vivant && vivant.google && vivant.google.sub && vivant.google.sub !== session.sub) {
        compteArchiverPour(vivant.google.sub, vivant);
        vivant = null;
    }
    compteLierCompte(session, '');
    var canon = compteCanonique(session.sub) || session.sub;
    compteMemoriserSession(session);
    compteMemoriserProprietaire(session);
    var dedie = compteLireDedie(canon);
    var choisi = null;
    if (dedie && compteUtile(dedie) && !compteProfilEtranger(dedie, session.sub)) choisi = dedie;
    else if (vivant && comptePeutRevendiquer(vivant, session) && compteUtile(vivant)) choisi = vivant;
    if (choisi) {
        compteBasculer(choisi, session);
    } else if (ancien && ancien.sub && ancien.sub !== session.sub) {
        compteBasculer(compteEtatVide(session), session);
    }
    var suite = token
        ? compteNuageFusionner(token).catch(function () { return 'echec'; })
        : Promise.resolve(choisi ? 'local' : 'vide');
    if (!token) suite = suite.then(function (etat) { return compteNuageSynchroniser(false).then(function (nuage) { return nuage && nuage !== 'failed' && nuage !== 'skip' ? nuage : etat; }); });
    return suite.then(function (etat) {
        if (!choisi && etat !== 'restored') {
            var apres = compteLireDedie(session.sub);
            if (apres && compteUtile(apres) && !compteProfilEtranger(apres, session.sub)) compteBasculer(apres, session);
            else compteBasculer(compteEtatVide(session), session);
        }
        var nom = (typeof userName !== 'undefined' && userName) || compteNomLie(session.sub) || '';
        if (typeof sauvegardeEcrireLocal === 'function' && typeof memoireLireEtat === 'function') {
            var courant = memoireLireEtat();
            if (courant && courant.google && courant.google.sub === session.sub) sauvegardeEcrireLocal(session.sub, courant, true);
        }
        if (typeof memoireSauvegarder === 'function') memoireSauvegarder();
        compteRafraichir();
        compteCopieEnAttente = false;
        if (window.__profilComplet) fermerCompte();
        if (etat === 'restored' || etat === 'local') {
            if (typeof v3Toast === 'function') v3Toast(nom ? ('Emploi du temps de ' + nom + '.') : 'Progression retrouvée.', 'success');
        } else if (etat === 'uploaded' || etat === 'same') {
            if (typeof v3Toast === 'function') v3Toast(nom ? (nom + ' est lié à ce compte Google.') : 'Sauvegarde liée à ton compte Google.', 'success');
        } else if (etat === 'echec') {
            compteMessage('Connecté, mais la copie Google n’a pas pu être enregistrée. Réessaie.');
        } else if (typeof v3Toast === 'function') {
            v3Toast(nom ? ('Compte de ' + nom + '.') : 'Choisis ton prénom.', 'info');
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
        var nomUtilisateur = (typeof userName !== 'undefined' && userName) || (session && compteNomLie(session.sub)) || '';
        btn.appendChild(document.createTextNode(session ? (nomUtilisateur || session.given_name || 'Compte') : 'Se connecter'));
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
var nomLie = compteNomLie(session.sub) || (typeof userName !== 'undefined' ? userName : '');
        if (nom) nom.textContent = nomLie || session.name || session.given_name || 'Compte Google';
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
    var nomMenu = session ? ((typeof userName !== 'undefined' && userName) || compteNomLie(session.sub) || session.given_name || 'Mon compte') : 'Mon compte';
    if (menuNom) menuNom.textContent = nomMenu;
    if (menuDetail) menuDetail.textContent = session ? (session.email || 'Connecté avec Google') : 'Connexion Google';
    var setup = document.getElementById('compteSetup');
    if (setup && !compteClientId()) setup.open = true;
}

function compteEmploiGenere() {
    if (window.__profilComplet) return true;
    var planning = document.getElementById('planningModal');
    return !!(planning && planning.classList.contains('active'));
}

function comptePoserOutils(depuisSection) {
    var outils = document.getElementById('compteOutils');
    if (!outils) return;
    outils.hidden = !(depuisSection && compteEmploiGenere());
}

function ouvrirCompte(depuisSection) {
    var modal = document.getElementById('compteModal');
    if (!modal) return;
    comptePoserOutils(!!depuisSection);
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
    if (window.compteSession && window.compteSession.sub) {
        compteMemoriserProprietaire(window.compteSession);
        if (typeof memoireSauvegarder === 'function') memoireSauvegarder();
    }
    window.compteSession = null;
    compteCopieEnAttente = false;
    compteJeton = '';
    compteJetonFin = 0;
    localStorage.removeItem(COMPTE_SESSION_KEY);
    if (window.google && google.accounts && google.accounts.id) {
        try { google.accounts.id.disableAutoSelect(); } catch (e) {}
    }
    compteRafraichir();
    if (typeof v3Toast === 'function') v3Toast('Compte Google déconnecté. Le nom et l’emploi du temps restent liés à ce compte.', 'info');
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
if (sauve && sauve.sub) {
            window.compteSession = sauve;
            compteMemoriserProprietaire(sauve);
        }
    } catch (e) {}
    try { compteIndexerExistants(); } catch (e) {}
    var stocke = '';
    try { stocke = localStorage.getItem(COMPTE_CLIENT_KEY) || ''; } catch (e) {}
    if (stocke && !window.STUDYPLAN_GOOGLE_CLIENT_ID) window.STUDYPLAN_GOOGLE_CLIENT_ID = stocke;
    compteRafraichir();
    comptePreparerGoogle().catch(function () {});
    if (window.compteSession && window.compteSession.sub) {
        var sub = window.compteSession.sub;
        var appliquer = function (data) {
            if (!data || compteProfilEtranger(data, sub)) return;
            if (!compteUtile(data)) return;
            var courant = typeof memoireJson === 'function' ? memoireJson(MEMOIRE_KEY) : null;
            if (courant && courant.google && courant.google.sub && courant.google.sub !== sub) {
                compteBasculer(data, window.compteSession);
                return;
            }
            if (compteMontrerProgression(data, false) && typeof v3Toast === 'function') v3Toast('Progression retrouvée.', 'success');
        };
        try {
            var dedie = compteLireDedie(sub);
            if (dedie) appliquer(dedie);
        } catch (e) {}
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
