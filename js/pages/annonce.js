/* ============================================================
   Annonces
   Quatre comptes admin. Les trois autres doivent accepter
   avant la publication. L'envoi peut être programmé.
   Vue : pages/annonce.html
   ============================================================ */

var ANNONCE_GROUPES = [
    { cle: 'juliss', label: 'Juliss', noms: ['sawadogo juliss bill owen'] },
    { cle: 'farid', label: 'Farid', noms: ['sere farid abdourrahman', 'sere farid abdourraham'] },
    { cle: 'ashley', label: 'Ashley', noms: ['tamini ashley kania harisoa'] },
    { cle: 'wendsom', label: 'Wendsom', noms: ['ouedraogo wendsom rayyan', 'ouedraogo wendsom ryyan'] }
];
var annonceListe = [];
var annonceBranchee = false;
var annonceEnvoiEnCours = false;
var annonceSessionEnvoi = false;

function annonceMots(nom) {
    if (typeof boiteMots === 'function') return boiteMots(nom);
    return String(nom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
}

function annonceCleAdmin(nom) {
    var mots = annonceMots(nom);
    if (mots.length < 3) return '';
    var i, j, alias, attendus, ok;
    for (i = 0; i < ANNONCE_GROUPES.length; i++) {
        for (j = 0; j < ANNONCE_GROUPES[i].noms.length; j++) {
            alias = ANNONCE_GROUPES[i].noms[j];
            attendus = alias.split(' ');
            ok = attendus.every(function (mot) { return mots.indexOf(mot) !== -1; });
            if (ok) return ANNONCE_GROUPES[i].cle;
        }
    }
    return '';
}

function annonceLabel(cle) {
    var i;
    for (i = 0; i < ANNONCE_GROUPES.length; i++) {
        if (ANNONCE_GROUPES[i].cle === cle) return ANNONCE_GROUPES[i].label;
    }
    return cle || '';
}

function annonceCles() {
    return ANNONCE_GROUPES.map(function (groupe) { return groupe.cle; });
}

function annonceEstAdmin() {
    return typeof boiteEstAdmin === 'function' && boiteEstAdmin() && !!annonceCleAdmin(typeof boiteNom === 'function' ? boiteNom() : '');
}

function annonceNormaliser(item) {
    var acceptations = {};
    var brut = item && item.acceptations;
    if (brut && typeof brut === 'object') {
        annonceCles().forEach(function (cle) {
            if (brut[cle]) acceptations[cle] = String(brut[cle]);
        });
    }
    var envoyes = [];
    (item && item.envoyes || []).forEach(function (email) {
        var propre = String(email || '').trim().toLowerCase();
        if (propre && envoyes.indexOf(propre) === -1) envoyes.push(propre);
    });
    return {
        type: 'annonce',
        id: String(item && item.id || ''),
        at: String(item && item.at || ''),
        titre: String(item && item.titre || '').slice(0, 80),
        texte: String(item && item.texte || '').slice(0, 1500),
        nom: String(item && item.nom || ''),
        auteurCle: String(item && item.auteurCle || ''),
        programme: String(item && item.programme || ''),
        programmeActif: item && item.programmeActif ? 1 : 0,
        acceptations: acceptations,
        publie: item && item.publie ? 1 : 0,
        publieAt: String(item && item.publieAt || ''),
        envoyeAt: String(item && item.envoyeAt || ''),
        envoyes: envoyes.slice(0, 80),
        envoiVerrou: String(item && item.envoiVerrou || ''),
        retire: item && item.retire ? 1 : 0
    };
}

function annonceFusionner(items) {
    var map = {};
    (items || []).forEach(function (item) {
        if (!item || item.type !== 'annonce' || !item.id) return;
        var copie = annonceNormaliser(item);
        var deja = map[copie.id];
        if (!deja) {
            map[copie.id] = copie;
            return;
        }
        var acceptations = {};
        annonceCles().forEach(function (cle) {
            var a = deja.acceptations[cle] || '';
            var b = copie.acceptations[cle] || '';
            if (a || b) acceptations[cle] = a >= b ? a : b;
        });
        var recent = String(copie.at || '') >= String(deja.at || '') ? copie : deja;
        var autre = recent === copie ? deja : copie;
        var envoyes = deja.envoyes.slice();
        copie.envoyes.forEach(function (email) {
            if (envoyes.indexOf(email) === -1) envoyes.push(email);
        });
        map[copie.id] = annonceNormaliser(Object.assign({}, autre, recent, {
            acceptations: acceptations,
            publie: deja.publie || copie.publie,
            retire: deja.retire || copie.retire,
            programmeActif: deja.programmeActif || copie.programmeActif,
            envoyes: envoyes,
            envoyeAt: deja.envoyeAt || copie.envoyeAt,
            publieAt: deja.publieAt || copie.publieAt,
            envoiVerrou: String(copie.at || '') >= String(deja.at || '') ? copie.envoiVerrou : deja.envoiVerrou
        }));
    });
    return Object.keys(map).map(function (id) { return map[id]; }).filter(function (item) {
        return item.titre && item.texte && !item.retire;
    }).sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
}

function annonceManquants(item) {
    if (!item || !item.auteurCle) return annonceCles();
    return annonceCles().filter(function (cle) {
        return cle !== item.auteurCle && !(item.acceptations && item.acceptations[cle]);
    });
}

function annonceValidee(item) {
    if (!item || !item.auteurCle) return false;
    return annonceManquants(item).length === 0 && annonceCles().indexOf(item.auteurCle) !== -1;
}

function annonceCompteBadge(items, admin) {
    var liste = annonceFusionner(items || []);
    if (admin) return liste.length;
    return liste.filter(function (item) { return item.publie; }).length;
}

function annonceHeureProgramme(valeur) {
    if (!valeur) return '';
    var date = new Date(valeur);
    if (!isFinite(date.getTime())) return '';
    return date.toISOString();
}

function annonceEstDue(item, maintenant) {
    if (!item || item.retire || item.publie || !item.programmeActif || !annonceValidee(item)) return false;
    var instant = new Date(item.programme).getTime();
    if (!isFinite(instant)) return false;
    return instant <= (maintenant || Date.now());
}

function annonceTexteMail(item) {
    var titre = String(item && item.titre || '').trim();
    var corps = String(item && item.texte || '').trim();
    var texte = 'Annonce\n\nChers utilisateurs\n\n';
    if (titre) texte += titre + '\n\n';
    texte += corps + '\n\nÀ bientôt,\nL\'équipe Study Plan IB';
    return texte.slice(0, 4000);
}

function annonceHtmlMail(item) {
    var echap = typeof boiteEchap === 'function' ? boiteEchap : function (s) { return String(s || ''); };
    var lignes = typeof boiteEchapHtml === 'function' ? boiteEchapHtml : echap;
    var titre = String(item && item.titre || '').trim();
    var titreHtml = titre
        ? '<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:1.35;font-weight:700;color:#111827;">' + echap(titre) + '</p>'
        : '';
    return '<div style="display:none;max-height:0;overflow:hidden;">Annonce — Chers utilisateurs</div>'
        + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">'
        + '<tr><td align="center" style="padding:24px 12px;">'
        + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">'
        + '<tr><td style="background:#059669;padding:28px 28px 22px;">'
        + '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:34px;line-height:1.05;font-weight:700;color:#ffffff;">Annonce</p>'
        + '<p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.3;font-weight:700;color:#d1fae5;">Chers utilisateurs</p>'
        + '</td></tr>'
        + '<tr><td style="padding:28px 28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65;color:#1f2937;">'
        + titreHtml
        + '<p style="margin:0;">' + lignes(String(item && item.texte || '')) + '</p>'
        + '<p style="margin:32px 0 0;">À bientôt,</p>'
        + '<p style="margin:4px 0 0;font-weight:700;color:#047857;"><strong>L\'équipe Study Plan IB</strong></p>'
        + '</td></tr></table></td></tr></table>';
}

function annonceNonce(id, email) {
    var s = String(id || '') + '|' + String(email || '').toLowerCase();
    var h = 2166136261;
    var h2 = 0;
    var i;
    for (i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
        h2 = (h2 * 33 + s.charCodeAt(i)) >>> 0;
    }
    var out = ((h >>> 0).toString(16) + (h2 >>> 0).toString(16) + 'annonceenvoi').replace(/[^a-z0-9]/g, '');
    if (out.length < 16) out = (out + 'annonceenvoiok12').slice(0, 24);
    return out.slice(0, 32);
}

function annonceDire(texte, erreur) {
    if (typeof boiteDire === 'function') boiteDire('annonceStatut', texte, erreur);
}

function annoncePoserBadge(badge, nombre) {
    if (!badge) return;
    if (nombre > 0) {
        badge.hidden = false;
        badge.style.display = 'flex';
        badge.textContent = String(nombre);
    } else {
        badge.hidden = true;
        badge.style.display = 'none';
        badge.textContent = '0';
    }
}

function annonceMajMenu() {
    var bouton = document.getElementById('menuAnnonce');
    var admin = typeof boiteEstAdmin === 'function' && boiteEstAdmin();
    var panneau = document.getElementById('panelAnnonce');
    if (panneau && panneau.classList) panneau.classList.toggle('annonce-public', !admin);
    if (bouton) {
        bouton.style.display = admin ? 'none' : 'flex';
        bouton.style.marginTop = '0';
    }
    var nombre = annonceCompteBadge(annonceListe, annonceEstAdmin());
    if (nombre > 0 && bouton && !admin) bouton.style.marginTop = '0.85rem';
    annoncePoserBadge(document.getElementById('annonceBadge'), nombre);
    annoncePoserBadge(document.getElementById('adminAnnonceBadge'), nombre);
    annoncePoserBadge(document.getElementById('adminAnnonceBadgePage'), nombre);
    annoncePoserBadge(document.getElementById('annonceBadgePage'), nombre);
}

function annonceDateLisible(iso) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
}

function annonceCarte(item) {
    var admin = annonceEstAdmin();
    var moi = annonceCleAdmin(typeof boiteNom === 'function' ? boiteNom() : '');
    var echap = typeof boiteEchap === 'function' ? boiteEchap : function (s) { return String(s || ''); };
    var manquants = annonceManquants(item).map(annonceLabel);
    var accords = annonceCles().filter(function (cle) {
        return cle !== item.auteurCle && item.acceptations && item.acceptations[cle];
    }).map(annonceLabel);
    var etat = 'Publiée';
    if (!item.publie && item.programmeActif) etat = 'Envoi programmé';
    else if (!item.publie && annonceValidee(item)) etat = 'Prête à publier';
    else if (!item.publie) etat = 'En attente de validation';
    var actions = '';
    if (admin && !item.publie && !item.programmeActif) {
        if (moi && moi !== item.auteurCle && !(item.acceptations && item.acceptations[moi])) {
            actions += '<button type="button" data-annonce-accepter="' + echap(item.id) + '" style="width:100%;margin-top:0.75rem;padding:0.75rem 1rem;border:none;border-radius:0.8rem;background:#111827;color:white;font-weight:800;cursor:pointer;">J\'accepte la publication</button>';
        }
        if (annonceValidee(item)) {
            var futur = item.programme && new Date(item.programme).getTime() > Date.now();
            actions += '<button type="button" data-annonce-publier="' + echap(item.id) + '" style="width:100%;margin-top:0.55rem;padding:0.75rem 1rem;border:none;border-radius:0.8rem;background:#059669;color:white;font-weight:800;cursor:pointer;">' + (futur ? 'Programmer l\'envoi' : 'Publier') + '</button>';
        }
        if (moi && moi === item.auteurCle) {
            actions += '<button type="button" data-annonce-retirer="' + echap(item.id) + '" style="width:100%;margin-top:0.55rem;padding:0.7rem 1rem;border:1.5px solid #e5e7eb;border-radius:0.8rem;background:white;color:#6b7280;font-weight:700;cursor:pointer;">Retirer</button>';
        }
    }
    if (admin && item.publie) {
        actions += '<button type="button" data-annonce-renvoyer="' + echap(item.id) + '" style="width:100%;margin-top:0.55rem;padding:0.7rem 1rem;border:1.5px solid #a7f3d0;border-radius:0.8rem;background:white;color:#047857;font-weight:700;cursor:pointer;">Renvoyer les mails manquants</button>';
    }
    if (!admin && !item.publie) return '';
    var meta = admin
        ? '<p style="margin:0.35rem 0 0;font-size:0.75rem;color:#6b7280;">Par ' + echap(item.nom || annonceLabel(item.auteurCle)) + ' · ' + echap(etat) + (accords.length ? ' · accords : ' + echap(accords.join(', ')) : '') + (manquants.length && !item.publie ? ' · il manque : ' + echap(manquants.join(', ')) : '') + (item.programme ? ' · ' + echap(annonceDateLisible(item.programme)) : '') + '</p>'
        : '<p style="margin:0.35rem 0 0;font-size:0.75rem;color:#6b7280;">De l\'équipe Study Plan IB · ' + echap(annonceDateLisible(item.publieAt || item.envoyeAt || item.at)) + '</p>';
    return '<article style="background:white;border:1.5px solid #f3f4f6;border-radius:1rem;padding:0.95rem 1rem;margin-bottom:0.75rem;">'
        + '<p style="margin:0;font-size:1.15rem;font-weight:800;color:#059669;">Annonce</p>'
        + '<p style="margin:0.35rem 0 0;font-size:0.95rem;font-weight:700;color:#111827;">Chers utilisateurs</p>'
        + '<h3 style="margin:0.7rem 0 0;font-size:1rem;color:#111827;">' + echap(item.titre) + '</h3>'
        + meta
        + '<p style="margin:0.7rem 0 0;white-space:pre-wrap;line-height:1.5;color:#1f2937;font-size:0.92rem;">' + echap(item.texte) + '</p>'
        + '<p style="margin:1rem 0 0;color:#1f2937;">À bientôt,</p>'
        + '<p style="margin:0.15rem 0 0;font-weight:800;color:#047857;">L\'équipe Study Plan IB</p>'
        + actions
        + '</article>';
}

function annonceRendre() {
    annonceMajMenu();
    var liste = document.getElementById('annonceListe');
    var composer = document.getElementById('annonceComposer');
    if (composer) composer.style.display = annonceEstAdmin() ? 'block' : 'none';
    if (!liste) return;
    var cartes = annonceListe.map(annonceCarte).filter(Boolean).join('');
    liste.innerHTML = cartes || '<p style="color:#6b7280;font-size:0.9rem;">Aucune annonce pour le moment.</p>';
}

function annonceDepuisDoc(doc) {
    doc = doc || {};
    return [].concat(doc.annonces || []).filter(function (item) { return item && item.type === 'annonce'; });
}

function annonceLireFichier() {
    var lire = typeof boiteFetch === 'function' ? boiteFetch : function (url) { return fetch(url); };
    return lire('data/annonces.json?t=' + Date.now(), { cache: 'no-store' }, 12000)
        .then(function (res) { return res.ok ? res.json() : {}; })
        .then(annonceDepuisDoc)
        .catch(function () { return []; });
}

function annonceEnAttentePourMoi() {
    if (!annonceEstAdmin()) return [];
    var moi = annonceCleAdmin(typeof boiteNom === 'function' ? boiteNom() : '');
    if (!moi) return [];
    return annonceListe.filter(function (item) {
        return !item.publie && !item.programmeActif && item.auteurCle !== moi && !(item.acceptations && item.acceptations[moi]);
    });
}

function annonceAlerteCle() {
    return 'studyPlanIB_annoncesAlerte';
}

function annonceAlertesVues() {
    try {
        var vus = JSON.parse(sessionStorage.getItem(annonceAlerteCle()) || '[]');
        return Array.isArray(vus) ? vus : [];
    } catch (e) {
        return [];
    }
}

function annonceMarquerAlerte(ids) {
    try {
        var vus = annonceAlertesVues();
        (ids || []).forEach(function (id) {
            if (vus.indexOf(id) === -1) vus.push(id);
        });
        sessionStorage.setItem(annonceAlerteCle(), JSON.stringify(vus.slice(-40)));
    } catch (e) {}
}

function annonceOuvrirAlerte() {
    if (typeof document === 'undefined' || !document.body) return;
    var panel = document.getElementById('panelAnnonce');
    if (panel && panel.classList.contains('active')) return;
    var deja = annonceAlertesVues();
    var attente = annonceEnAttentePourMoi().filter(function (item) { return deja.indexOf(item.id) === -1; });
    if (!attente.length || document.getElementById('annonceAlerte') || document.getElementById('boiteAlerteRetours')) return;
    var echap = typeof boiteEchap === 'function' ? boiteEchap : function (s) { return String(s || ''); };
    var lignes = attente.slice(0, 4).map(function (item) {
        return '<p style="margin:0.35rem 0;color:#1c1917;font-size:1rem;line-height:1.4;">' + echap(item.nom || annonceLabel(item.auteurCle)) + ' a écrit « ' + echap(item.titre) + ' ».</p>';
    }).join('');
    var el = document.createElement('div');
    el.id = 'annonceAlerte';
    el.style.cssText = 'position:fixed;inset:0;z-index:221;background:rgba(17,24,39,0.55);display:flex;align-items:center;justify-content:center;padding:1rem;';
    el.innerHTML = '<div style="max-width:26rem;width:100%;background:white;border-radius:1.25rem;padding:1.35rem 1.2rem;box-shadow:0 24px 60px rgba(0,0,0,0.18);">'
        + '<p style="margin:0 0 0.35rem;font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;font-weight:800;color:#059669;">Study Plan IB</p>'
        + '<h3 style="margin:0 0 0.7rem;font-size:1.22rem;color:#1c1917;">Annonce à accepter</h3>'
        + lignes
        + '<div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:1.1rem;">'
        + '<button type="button" id="annonceAlerteVoir" style="width:100%;border:none;background:#059669;color:white;border-radius:0.85rem;padding:0.8rem 1rem;font-weight:800;cursor:pointer;">Voir</button>'
        + '<button type="button" id="annonceAlerteFermer" style="width:100%;border:1.5px solid #e7e5e4;background:white;color:#44403c;border-radius:0.85rem;padding:0.75rem 1rem;font-weight:700;cursor:pointer;">Fermer</button>'
        + '</div></div>';
    document.body.appendChild(el);
    annonceMarquerAlerte(attente.map(function (item) { return item.id; }));
    document.getElementById('annonceAlerteFermer').onclick = function () {
        if (el.parentNode) el.parentNode.removeChild(el);
    };
    document.getElementById('annonceAlerteVoir').onclick = function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        if (typeof navigateTo === 'function') navigateTo('annonce');
    };
}

function annonceCharger(force) {
    var distant = (force || !annonceListe.length) && typeof boiteChargerListes === 'function'
        ? boiteChargerListes(!!force).then(function (fusion) { return fusion && fusion.annonces || []; }).catch(function () { return []; })
        : Promise.resolve(annonceListe);
    return Promise.all([annonceLireFichier(), distant]).then(function (parts) {
        annonceListe = annonceFusionner([].concat(parts[0], parts[1]));
        annonceRendre();
        annonceOuvrirAlerte();
        return annonceListe;
    });
}

function annonceSauver(record) {
    var copie = annonceNormaliser(record);
    copie.at = copie.at || new Date().toISOString();
    annonceListe = annonceFusionner(annonceListe.concat([copie]));
    annonceRendre();
    if (typeof boiteGarderVu === 'function') boiteGarderVu(copie);
    if (typeof boiteListesCache !== 'undefined' && boiteListesCache) {
        boiteListesCache.annonces = annonceFusionner((boiteListesCache.annonces || []).concat([copie]));
    }
    var envoi = typeof boiteEnvoyer === 'function' ? boiteEnvoyer(copie) : Promise.resolve(true);
    return envoi.then(function () { return copie; });
}

function annonceDestinataires(fusion, comptes) {
    var map = {};
    function ajouter(email, nom) {
        var propre = String(email || '').trim().toLowerCase();
        if (typeof boiteEmailValide === 'function' && !boiteEmailValide(propre)) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(propre)) return;
        if (propre === 'ibstudyplan@gmail.com') return;
        if (!map[propre]) map[propre] = { email: propre, nom: String(nom || '').trim() };
        else if (nom && !map[propre].nom) map[propre].nom = String(nom).trim();
    }
    (comptes || []).forEach(function (compte) {
        ajouter(compte && (compte.email || compte.google), compte && compte.nom);
    });
    ['emplois', 'questions', 'feedbacks', 'profils'].forEach(function (cle) {
        ((fusion && fusion[cle]) || []).forEach(function (item) {
            ajouter(item && (item.google || item.email), item && (item.nom || item.googleNom));
        });
    });
    var session = typeof boiteSession === 'function' ? boiteSession() : null;
    if (session) ajouter(session.email, typeof boiteNom === 'function' ? boiteNom() : session.name);
    return Object.keys(map).map(function (email) { return map[email]; }).slice(0, 40);
}

function annonceLireComptes() {
    /* Les destinataires viennent de la boîte privée, que seuls les
       admins peuvent lire : plus de fichier de comptes public. */
    return Promise.resolve([]);
}

function annoncePosterMail(email, nom, item) {
    var quand = new Date();
    var sujet = ('Annonce — ' + String(item.titre || 'Study Plan IB') + ' — Study Plan IB').slice(0, 180);
    var nonce = annonceNonce(item.id, email);
    return Promise.all([
        boiteUrlScript(),
        typeof boiteSecretMail === 'function' ? boiteSecretMail() : Promise.reject(new Error('script'))
    ]).then(function (prets) {
        var url = prets[0];
        var payload = {
            secret: prets[1],
            nonce: nonce,
            to: email,
            replyTo: typeof BOITE_EXPEDITEUR !== 'undefined' ? BOITE_EXPEDITEUR : 'ibstudyplan@gmail.com',
            subject: sujet,
            text: annonceTexteMail(item, nom, quand),
            html: annonceHtmlMail(item, nom, quand)
        };
        function secours() {
            if (typeof boitePosterChamps === 'function') {
                return boitePosterChamps(url, payload).catch(function () {
                    return boitePosterFormulaire(url, payload);
                });
            }
            return Promise.reject(new Error('mail'));
        }
        return fetch(url, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (res.ok && typeof boiteMailAccepte === 'function' && boiteMailAccepte(data, nonce)) return data;
                return secours();
            });
        }).catch(secours);
    });
}

function annonceEnvoyerMails(item) {
    var fusion = typeof boiteListesCache !== 'undefined' ? boiteListesCache : null;
    return annonceLireComptes().then(function (comptes) {
        var destinataires = annonceDestinataires(fusion, comptes).filter(function (personne) {
            return item.envoyes.indexOf(personne.email) === -1;
        });
        return destinataires.reduce(function (chaine, personne) {
            return chaine.then(function (etat) {
                return annoncePosterMail(personne.email, personne.nom, item).then(function () {
                    etat.ok.push(personne.email);
                    return etat;
                }).catch(function () {
                    etat.ko.push(personne.email);
                    return etat;
                });
            });
        }, Promise.resolve({ ok: [], ko: [], total: destinataires.length }));
    });
}

function annonceMarquerEnvoyee(item, resultat) {
    var envoyes = item.envoyes.slice();
    (resultat.ok || []).forEach(function (email) {
        if (envoyes.indexOf(email) === -1) envoyes.push(email);
    });
    var maintenant = new Date().toISOString();
    return annonceSauver(Object.assign({}, item, {
        at: maintenant,
        publie: 1,
        publieAt: item.publieAt || maintenant,
        envoyeAt: resultat.ok && resultat.ok.length ? maintenant : item.envoyeAt,
        envoyes: envoyes,
        envoiVerrou: ''
    })).then(function (sauve) {
        return { item: sauve, resultat: resultat };
    });
}

function annoncePublierMaintenant(item) {
    if (!annonceEstAdmin() || !annonceValidee(item) || item.publie) return Promise.resolve(null);
    annonceDire('Publication et envoi vers les boîtes mail…', false);
    var maintenant = new Date().toISOString();
    var pret = Object.assign({}, item, { publie: 1, publieAt: maintenant, at: maintenant, programmeActif: item.programme ? 1 : 0 });
    return annonceSauver(pret).then(function (sauve) {
        return annonceEnvoyerMails(sauve).then(function (resultat) {
            return annonceMarquerEnvoyee(sauve, resultat);
        });
    }).then(function (etat) {
        var ko = etat && etat.resultat ? etat.resultat.ko.length : 0;
        var ok = etat && etat.resultat ? etat.resultat.ok.length : 0;
        if (!ok && !ko) annonceDire('Annonce publiée sur le site. Aucune adresse mail connue, donc aucun mail n\'est parti.', true);
        else if (!ok && ko) annonceDire('L\'annonce est publiée sur le site, mais le mail n\'a pas pu partir. Réessaie depuis un compte admin.', true);
        else if (ko) annonceDire('Annonce publiée. ' + ok + ' mail' + (ok > 1 ? 's' : '') + ' parti' + (ok > 1 ? 's' : '') + ', ' + ko + ' en échec.', true);
        else annonceDire('Annonce publiée. Elle est partie dans les boîtes mail.', false);
        return etat;
    });
}

function annonceProgrammer(item) {
    if (!annonceEstAdmin() || !annonceValidee(item) || item.publie) return Promise.resolve(null);
    var quand = new Date(item.programme).getTime();
    if (!item.programme || !isFinite(quand)) return annoncePublierMaintenant(item);
    if (quand <= Date.now()) return annoncePublierMaintenant(item);
    return annonceSauver(Object.assign({}, item, {
        at: new Date().toISOString(),
        programmeActif: 1,
        publie: 0
    })).then(function () {
        annonceDire('Envoi programmé le ' + annonceDateLisible(item.programme) + ', après les trois accords.', false);
    });
}

function annonceRevendiquer(item) {
    var verrou = new Date().toISOString();
    return annonceSauver(Object.assign({}, item, { at: verrou, envoiVerrou: verrou })).then(function () {
        return new Promise(function (resolve) { setTimeout(resolve, 1200); });
    }).then(function () {
        return annonceCharger(true);
    }).then(function (liste) {
        var frais = null;
        liste.some(function (candidat) {
            if (candidat.id === item.id) { frais = candidat; return true; }
            return false;
        });
        if (!frais || frais.envoiVerrou !== verrou || frais.publie) return null;
        return frais;
    });
}

function annonceEnvoyerDues() {
    if (annonceEnvoiEnCours || annonceSessionEnvoi) return Promise.resolve();
    var dues = annonceListe.filter(function (item) { return annonceEstDue(item); });
    if (!dues.length) return Promise.resolve();
    annonceEnvoiEnCours = true;
    annonceSessionEnvoi = true;
    return dues.reduce(function (chaine, item) {
        return chaine.then(function () {
            return annonceRevendiquer(item).then(function (frais) {
                if (!frais) return null;
                return annonceEnvoyerMails(frais).then(function (resultat) {
                    return annonceMarquerEnvoyee(frais, resultat);
                });
            });
        });
    }, Promise.resolve()).then(function () {
        annonceEnvoiEnCours = false;
        annonceRendre();
    }).catch(function () {
        annonceEnvoiEnCours = false;
    });
}

function annonceTrouver(id) {
    var trouve = null;
    annonceListe.some(function (item) {
        if (item.id === id) { trouve = item; return true; }
        return false;
    });
    return trouve;
}

function annonceAccepter(id) {
    if (!annonceEstAdmin()) return;
    var item = annonceTrouver(id);
    var moi = annonceCleAdmin(typeof boiteNom === 'function' ? boiteNom() : '');
    if (!item || !moi || moi === item.auteurCle || (item.acceptations && item.acceptations[moi])) return;
    var acceptations = Object.assign({}, item.acceptations);
    acceptations[moi] = new Date().toISOString();
    annonceDire('Accord enregistré.', false);
    annonceSauver(Object.assign({}, item, { at: acceptations[moi], acceptations: acceptations })).catch(function () {
        annonceDire('L\'accord n\'a pas pu être partagé. Réessaie.', true);
    });
}

function annonceRetirer(id) {
    if (!annonceEstAdmin()) return;
    var item = annonceTrouver(id);
    var moi = annonceCleAdmin(typeof boiteNom === 'function' ? boiteNom() : '');
    if (!item || item.publie || moi !== item.auteurCle) return;
    annonceSauver(Object.assign({}, item, { at: new Date().toISOString(), retire: 1 })).then(function () {
        annonceListe = annonceListe.filter(function (candidat) { return candidat.id !== id; });
        annonceRendre();
        annonceDire('Annonce retirée.', false);
    });
}

function annonceRenvoyer(id) {
    if (!annonceEstAdmin() || annonceEnvoiEnCours) return;
    var item = annonceTrouver(id);
    if (!item || !item.publie) return;
    annonceEnvoiEnCours = true;
    annonceDire('Nouvel essai vers les adresses qui n\'ont pas encore reçu le mail…', false);
    annonceEnvoyerMails(item).then(function (resultat) {
        return annonceMarquerEnvoyee(item, resultat);
    }).then(function (etat) {
        var ok = etat && etat.resultat ? etat.resultat.ok.length : 0;
        var ko = etat && etat.resultat ? etat.resultat.ko.length : 0;
        if (!ok && !ko) annonceDire('Aucun mail manquant. Les adresses connues ont déjà reçu cette annonce.', false);
        else if (!ok) annonceDire('Le mail n\'a pas pu partir. Réessaie plus tard.', true);
        else if (ko) annonceDire(ok + ' mail' + (ok > 1 ? 's' : '') + ' parti' + (ok > 1 ? 's' : '') + ', ' + ko + ' encore en échec.', true);
        else annonceDire(ok + ' mail' + (ok > 1 ? 's' : '') + ' parti' + (ok > 1 ? 's' : '') + '.', false);
    }).catch(function () {
        annonceDire('Le mail n\'a pas pu partir. Réessaie plus tard.', true);
    }).then(function () {
        annonceEnvoiEnCours = false;
        annonceRendre();
    });
}

function annonceLancerPublication(id) {
    if (!annonceEstAdmin() || annonceEnvoiEnCours) return;
    var item = annonceTrouver(id);
    if (!item || !annonceValidee(item)) {
        annonceDire('Les trois autres comptes doivent d\'abord accepter.', true);
        return;
    }
    annonceEnvoiEnCours = true;
    var futur = item.programme && new Date(item.programme).getTime() > Date.now();
    var action = futur ? annonceProgrammer(item) : annoncePublierMaintenant(item);
    Promise.resolve(action).catch(function () {
        annonceDire('La publication n\'a pas abouti. Réessaie.', true);
    }).then(function () {
        annonceEnvoiEnCours = false;
        annonceRendre();
    });
}

function annonceMontrerAnalyse(texte, erreurs) {
    var zone = document.getElementById('annonceAnalyse');
    if (!zone) return;
    if (!erreurs || !erreurs.length) {
        zone.innerHTML = '';
        return;
    }
    var echap = typeof boiteEchap === 'function' ? boiteEchap : function (s) { return String(s || ''); };
    var lignes = erreurs.map(function (err) {
        var extrait = texte.slice(err.debut, err.fin);
        var suggestion = err.suggestions && err.suggestions.length ? ' Suggestion : « ' + err.suggestions[0] + ' ».' : '';
        return '<li style="margin:0.35rem 0;"><strong>' + echap(err.type || 'À corriger') + '.</strong> « ' + echap(extrait) + ' » — ' + echap(err.message || '') + echap(suggestion) + '</li>';
    }).join('');
    zone.innerHTML = '<div style="margin-top:0.7rem;background:#fffbeb;border:1.5px solid #fcd34d;border-radius:0.8rem;padding:0.75rem 0.8rem;">'
        + '<p style="font-weight:800;color:#92400e;margin:0;">Corrige ces points avant de soumettre.</p>'
        + '<ul style="margin:0.55rem 0 0;padding-left:1.1rem;color:#78350f;font-size:0.84rem;">' + lignes + '</ul>'
        + '<button type="button" id="annonceMalgre" style="width:100%;margin-top:0.7rem;padding:0.7rem 1rem;border:1.5px solid #d97706;border-radius:0.8rem;background:white;color:#92400e;font-weight:800;cursor:pointer;">Soumettre malgré ces remarques</button>'
        + '</div>';
}

function annonceSoumettre(forcer) {
    if (!annonceEstAdmin()) {
        annonceDire('Seuls les comptes administrateur peuvent écrire une annonce.', true);
        return;
    }
    var titreEl = document.getElementById('annonceTitre');
    var texteEl = document.getElementById('annonceTexte');
    var programmeEl = document.getElementById('annonceProgramme');
    var titre = titreEl ? titreEl.value.trim() : '';
    var texte = texteEl ? texteEl.value.trim() : '';
    if (titre.length < 3) {
        annonceDire('Le titre est obligatoire.', true);
        return;
    }
    if (texte.length < 3) {
        annonceDire('Écris le message avant de le soumettre.', true);
        return;
    }
    var auteurCle = annonceCleAdmin(typeof boiteNom === 'function' ? boiteNom() : '');
    if (!auteurCle) {
        annonceDire('Ce nom n\'est pas reconnu comme l\'un des quatre comptes admin.', true);
        return;
    }
    function envoyer() {
        var programme = programmeEl && programmeEl.value ? annonceHeureProgramme(programmeEl.value) : '';
        var record = {
            type: 'annonce',
            id: typeof boiteId === 'function' ? boiteId('a') : ('a' + Date.now().toString(16)),
            at: new Date().toISOString(),
            titre: titre.slice(0, 80),
            texte: texte.slice(0, 1500),
            nom: typeof boiteNom === 'function' ? boiteNom() : '',
            auteurCle: auteurCle,
            programme: programme,
            programmeActif: 0,
            acceptations: {},
            publie: 0,
            retire: 0,
            envoyes: []
        };
        annonceDire('Envoi aux trois autres comptes…', false);
        annonceSauver(record).then(function () {
            if (titreEl) titreEl.value = '';
            if (texteEl) texteEl.value = '';
            if (programmeEl) programmeEl.value = '';
            annonceMontrerAnalyse('', []);
            annonceDire('Annonce soumise. Elle pourra être publiée quand les trois autres comptes auront accepté.', false);
        }).catch(function () {
            annonceDire('L\'annonce n\'a pas pu être partagée. Réessaie.', true);
        });
    }
    if (forcer || typeof langueAnalyser !== 'function') {
        envoyer();
        return;
    }
    annonceDire('Vérification de l\'orthographe, de la grammaire et de la conjugaison…', false);
    langueAnalyser(texte.slice(0, 1500)).then(function (erreurs) {
        if (erreurs && erreurs.length) {
            annonceDire('Le message n\'a pas été soumis. Les erreurs sont indiquées ci-dessous.', true);
            annonceMontrerAnalyse(texte.slice(0, 1500), erreurs);
            var bouton = document.getElementById('annonceMalgre');
            if (bouton) bouton.onclick = function () { annonceSoumettre(true); };
            return;
        }
        envoyer();
    }).catch(function () {
        envoyer();
    });
}

function initAnnonce() {
    if (typeof boiteMajMenu === 'function') boiteMajMenu();
    annonceRendre();
    annonceCharger(true).then(annonceEnvoyerDues).catch(function () {});
    if (annonceBranchee) return;
    annonceBranchee = true;
    var envoi = document.getElementById('annonceEnvoi');
    if (envoi) envoi.onclick = function () { annonceSoumettre(false); };
    var liste = document.getElementById('annonceListe');
    if (liste && !liste.__annonce) {
        liste.__annonce = true;
        liste.addEventListener('click', function (e) {
            var accepter = e.target && e.target.closest ? e.target.closest('[data-annonce-accepter]') : null;
            var publier = e.target && e.target.closest ? e.target.closest('[data-annonce-publier]') : null;
            var retirer = e.target && e.target.closest ? e.target.closest('[data-annonce-retirer]') : null;
            var renvoyer = e.target && e.target.closest ? e.target.closest('[data-annonce-renvoyer]') : null;
            if (accepter) annonceAccepter(accepter.getAttribute('data-annonce-accepter'));
            if (publier) annonceLancerPublication(publier.getAttribute('data-annonce-publier'));
            if (retirer) annonceRetirer(retirer.getAttribute('data-annonce-retirer'));
            if (renvoyer) annonceRenvoyer(renvoyer.getAttribute('data-annonce-renvoyer'));
        });
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { annonceCharger(false).then(annonceEnvoyerDues).catch(function () {}); });
    } else {
        setTimeout(function () { annonceCharger(false).then(annonceEnvoyerDues).catch(function () {}); }, 400);
    }
}
