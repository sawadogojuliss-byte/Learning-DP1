/* ============================================================
   PAGE Tutoriel
   Les comptes administrateurs publient des vidéos.
   Les autres ne font que les regarder, et seulement après la première publication.
   Vue : pages/tutoriel.html
   ============================================================ */

var TUTORIEL_CLE = 'studyPlanIB_tutoriels';
var tutorielListe = [];
var tutorielFichier = null;
var tutorielApercuUrl = '';
var tutorielCharge = false;
var tutorielBranche = false;

function tutorielEstAdmin() {
    return typeof boiteEstAdmin === 'function' && boiteEstAdmin();
}

function tutorielTitrePropre(titre) {
    return String(titre || '').replace(/\s+/g, ' ').trim();
}

function tutorielTitreValide(titre) {
    var texte = tutorielTitrePropre(titre);
    return texte.length >= 2 && texte.length <= 80;
}

function tutorielLienValide(url) {
    var lien = String(url || '').trim();
    if (!/^https:\/\/\S+$/i.test(lien) || /[<>"']/.test(lien)) return false;
    var bas = lien.toLowerCase();
    if (/youtu\.be|youtube\.com|youtube-nocookie\.com|vimeo\.com|drive\.google\.com|docs\.google\.com/.test(bas)) return true;
    if (/ntfy\.sh\/file\//.test(bas) || /firebasestorage\.googleapis\.com/.test(bas)) return true;
    return /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/.test(bas);
}

function tutorielPeutInserer(titre) {
    return tutorielTitreValide(titre);
}

function tutorielPeutPublier(titre, lien, fichier) {
    return tutorielTitreValide(titre) && (tutorielLienValide(lien) || !!(fichier && fichier.size));
}

function tutorielPublies(liste) {
    return (liste || []).filter(function (item) {
        return item && item.type === 'tutoriel' && item.publie && !item.retire && tutorielTitreValide(item.titre) && tutorielLienValide(item.url);
    });
}

function tutorielSectionVisible(admin, liste) {
    if (arguments.length < 2) {
        admin = tutorielEstAdmin();
        liste = tutorielListe;
    }
    return !!admin || tutorielPublies(liste).length > 0;
}

function tutorielFusionner(items) {
    var map = {};
    (items || []).forEach(function (item) {
        if (!item || item.type !== 'tutoriel' || !item.id) return;
        var deja = map[item.id];
        if (!deja || String(item.at || '') >= String(deja.at || '')) map[item.id] = item;
    });
    return Object.keys(map).map(function (id) { return map[id]; }).sort(function (a, b) {
        return String(a.at || '').localeCompare(String(b.at || ''));
    });
}

function tutorielLireLocal() {
    try {
        var liste = JSON.parse(localStorage.getItem(TUTORIEL_CLE) || '[]');
        return Array.isArray(liste) ? liste : [];
    } catch (e) {
        return [];
    }
}

function tutorielEcrireLocal(liste) {
    try { localStorage.setItem(TUTORIEL_CLE, JSON.stringify((liste || []).slice(-40))); } catch (e) {}
}

function tutorielEmbed(url) {
    var lien = String(url || '');
    var youtube = lien.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
    if (youtube) return 'https://www.youtube-nocookie.com/embed/' + youtube[1];
    var vimeo = lien.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeo) return 'https://player.vimeo.com/video/' + vimeo[1];
    var drive = lien.match(/drive\.google\.com\/file\/d\/([^/?#]+)/) || lien.match(/[?&]id=([^&#]+)/);
    if (drive && /drive\.google\.com|docs\.google\.com/.test(lien)) return 'https://drive.google.com/file/d/' + drive[1] + '/preview';
    return '';
}

function tutorielMajMenu() {
    var bouton = document.getElementById('menuTutoriel');
    if (!bouton) return;
    bouton.style.display = !tutorielEstAdmin() && tutorielSectionVisible() ? 'flex' : 'none';
}

function tutorielDire(texte, erreur) {
    var el = document.getElementById('tutorielStatut');
    if (!el) return;
    el.textContent = texte || '';
    el.style.color = erreur ? '#b45309' : '#047857';
}

function tutorielActiverInsertion() {
    var titre = document.getElementById('tutorielTitre');
    var zone = document.getElementById('tutorielInsertion');
    var choisir = document.getElementById('tutorielChoisir');
    var lien = document.getElementById('tutorielLien');
    var publier = document.getElementById('tutorielPublier');
    var pret = tutorielPeutInserer(titre ? titre.value : '');
    if (zone) zone.style.opacity = pret ? '1' : '0.45';
    if (choisir) choisir.disabled = !pret;
    if (lien) lien.disabled = !pret;
    var peut = tutorielPeutPublier(titre ? titre.value : '', lien ? lien.value : '', tutorielFichier);
    if (publier) {
        publier.disabled = !peut;
        publier.style.background = peut ? 'linear-gradient(135deg,#059669,#10b981)' : '#d1d5db';
        publier.style.cursor = peut ? 'pointer' : 'not-allowed';
    }
}

function tutorielMontrerApercu(url, embed) {
    var zone = document.getElementById('tutorielApercu');
    if (!zone) return;
    if (!url) {
        zone.innerHTML = '';
        return;
    }
    var cadre = embed
        ? '<iframe src="' + tutorielEchap(embed) + '" title="Aperçu" style="width:100%;aspect-ratio:16/9;border:0;border-radius:0.85rem;" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>'
        : '<video controls playsinline preload="metadata" src="' + tutorielEchap(url) + '" style="width:100%;border-radius:0.85rem;background:#111827;"></video>';
    zone.innerHTML = '<p style="font-size:0.75rem;color:#6b7280;margin-bottom:0.4rem;">Aperçu, pas encore publié.</p>' + cadre;
}

function tutorielEchap(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function tutorielChoisirFichier() {
    var titre = document.getElementById('tutorielTitre');
    if (!tutorielPeutInserer(titre ? titre.value : '')) return;
    var input = document.getElementById('tutorielFichier');
    if (input) input.click();
}

function tutorielPoserFichier(fichier) {
    if (tutorielApercuUrl) URL.revokeObjectURL(tutorielApercuUrl);
    tutorielApercuUrl = '';
    tutorielFichier = null;
    var nom = document.getElementById('tutorielFichierNom');
    if (!fichier) {
        if (nom) nom.textContent = '';
        tutorielMontrerApercu('');
        tutorielActiverInsertion();
        return;
    }
    if (fichier.type && fichier.type.indexOf('video/') !== 0) {
        tutorielDire('Choisis un fichier vidéo.', true);
        tutorielActiverInsertion();
        return;
    }
    if (fichier.size > 12 * 1024 * 1024) {
        tutorielDire('Cette vidéo est trop lourde. Colle un lien YouTube, Drive ou mp4.', true);
        tutorielActiverInsertion();
        return;
    }
    tutorielFichier = fichier;
    tutorielApercuUrl = URL.createObjectURL(fichier);
    if (nom) nom.textContent = fichier.name || 'Vidéo choisie';
    var lien = document.getElementById('tutorielLien');
    if (lien) lien.value = '';
    tutorielMontrerApercu(tutorielApercuUrl, '');
    tutorielDire('');
    tutorielActiverInsertion();
}

function tutorielPoserLien() {
    var lien = document.getElementById('tutorielLien');
    var valeur = lien ? lien.value.trim() : '';
    if (!valeur) {
        if (!tutorielFichier) tutorielMontrerApercu('');
        tutorielActiverInsertion();
        return;
    }
    if (!tutorielLienValide(valeur)) {
        tutorielDire('Colle un lien YouTube, Drive, Vimeo ou un fichier mp4.', true);
        tutorielMontrerApercu('');
        tutorielActiverInsertion();
        return;
    }
    if (tutorielApercuUrl) URL.revokeObjectURL(tutorielApercuUrl);
    tutorielApercuUrl = '';
    tutorielFichier = null;
    var nom = document.getElementById('tutorielFichierNom');
    if (nom) nom.textContent = '';
    var input = document.getElementById('tutorielFichier');
    if (input) input.value = '';
    tutorielDire('');
    tutorielMontrerApercu(valeur, tutorielEmbed(valeur));
    tutorielActiverInsertion();
}

function tutorielLecteur(item) {
    var embed = tutorielEmbed(item.url);
    if (embed) {
        return '<iframe src="' + tutorielEchap(embed) + '" title="' + tutorielEchap(item.titre) + '" style="width:100%;aspect-ratio:16/9;border:0;border-radius:0.85rem;background:#111827;" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
    }
    return '<video controls playsinline preload="metadata" src="' + tutorielEchap(item.url) + '" style="width:100%;border-radius:0.85rem;background:#111827;"></video>';
}

function tutorielRendre() {
    var compose = document.getElementById('tutorielCompose');
    var liste = document.getElementById('tutorielListe');
    var vide = document.getElementById('tutorielVide');
    if (!liste) return;
    var admin = tutorielEstAdmin();
    if (compose) compose.style.display = admin ? 'block' : 'none';
    var panneau = document.getElementById('panelTutoriel');
    if (panneau) panneau.classList.toggle('tutoriel-admin', admin);
    var publies = tutorielPublies(tutorielListe);
    if (!publies.length) {
        liste.innerHTML = '';
        if (vide) vide.textContent = admin ? 'Aucune vidéo publiée.' : '';
        return;
    }
    if (vide) vide.textContent = '';
    liste.innerHTML = publies.map(function (item) {
        var retirer = admin
            ? '<button type="button" data-tutoriel-retirer="' + tutorielEchap(item.id) + '" style="margin-top:0.7rem;background:none;border:none;color:#56665e;font-size:0.75rem;cursor:pointer;text-decoration:underline;">Retirer</button>'
            : '';
        return '<article style="background:white;border:1.5px solid #e5e7eb;border-radius:1.05rem;padding:0.85rem;margin-bottom:0.85rem;">'
            + '<h3 style="font-size:1rem;font-weight:800;color:#111827;margin-bottom:0.65rem;">' + tutorielEchap(item.titre) + '</h3>'
            + tutorielLecteur(item)
            + retirer
            + '</article>';
    }).join('');
    if (admin) {
        liste.querySelectorAll('[data-tutoriel-retirer]').forEach(function (bouton) {
            bouton.onclick = function () { tutorielRetirer(bouton.getAttribute('data-tutoriel-retirer')); };
        });
    }
}

function tutorielMemoriser(liste) {
    tutorielListe = tutorielFusionner(tutorielLireLocal().concat(liste || []));
    tutorielEcrireLocal(tutorielListe);
    tutorielMajMenu();
    tutorielRendre();
}

function tutorielDepuisNtfy() {
    if (typeof boiteLireBoite !== 'function') return Promise.resolve([]);
    return boiteLireBoite().then(function (items) {
        return (items || []).filter(function (item) { return item && item.type === 'tutoriel'; });
    }).catch(function () { return []; });
}

function tutorielDepuisFichier() {
    var lire = typeof boiteFetch === 'function' ? boiteFetch : fetch;
    return Promise.resolve(lire('data/tutoriels.json?t=' + Date.now(), { cache: 'no-store' }))
        .then(function (res) { return res && res.ok ? res.json() : {}; })
        .then(function (doc) { return (doc && doc.tutoriels) || []; })
        .catch(function () { return []; });
}

function tutorielDepuisCoffres() {
    /* Plus de coffre externe : les tutoriels publics viennent de la
       collection « publie », déjà lue par tutorielDepuisNtfy. */
    if (boiteListesCache && boiteListesCache.tutoriels) return Promise.resolve(boiteListesCache.tutoriels);
    return Promise.resolve([]);
}

function tutorielCharger() {
    return Promise.all([tutorielDepuisFichier(), tutorielDepuisNtfy(), tutorielDepuisCoffres()]).then(function (lots) {
        tutorielCharge = true;
        tutorielMemoriser([].concat(lots[0], lots[1], lots[2]));
        return tutorielListe;
    });
}

/* Les vidéos sont publiques en lecture, mais seuls les comptes admins de
   BOITE_ADMINS_EMAIL peuvent en envoyer une : Firebase Storage refuse
   toute autre écriture (storage.rules). Plus aucun fil ntfy public. */
function tutorielDeposerFichier(fichier) {
    if (!tutorielEstAdmin()) return Promise.reject(new Error('admin'));
    return boiteFirebasePret().then(function (user) {
        if (!user || !window.firebase || typeof firebase.storage !== 'function') throw new Error('stockage');
        var nom = String(fichier.name || 'video.mp4').replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'video.mp4';
        var chemin = 'tutoriels/' + Date.now().toString(36) + '-' + nom;
        return firebase.storage().ref(chemin).put(fichier, {
            contentType: fichier.type || 'video/mp4'
        });
    }).then(function (tache) {
        return tache.ref.getDownloadURL();
    }).then(function (url) {
        if (!tutorielLienValide(url)) throw new Error('fichier');
        return url;
    });
}

function tutorielEnvoyer(record) {
    if (typeof boiteEnvoyer !== 'function') {
        tutorielMemoriser([record]);
        return Promise.resolve(true);
    }
    return boiteEnvoyer(record).then(function (ok) {
        tutorielMemoriser([record]);
        return ok;
    });
}

function tutorielPublier() {
    if (!tutorielEstAdmin()) return;
    var titreEl = document.getElementById('tutorielTitre');
    var lienEl = document.getElementById('tutorielLien');
    var bouton = document.getElementById('tutorielPublier');
    var titre = tutorielTitrePropre(titreEl ? titreEl.value : '');
    var lien = lienEl ? lienEl.value.trim() : '';
    if (!tutorielPeutPublier(titre, lien, tutorielFichier)) {
        tutorielDire('Écris le titre, puis insère la vidéo.', true);
        tutorielActiverInsertion();
        return;
    }
    if (bouton) bouton.disabled = true;
    tutorielDire('Publication…', false);
    var pret = tutorielFichier ? tutorielDeposerFichier(tutorielFichier) : Promise.resolve(lien);
    pret.then(function (url) {
        if (!tutorielLienValide(url)) throw new Error('lien');
        var record = {
            type: 'tutoriel',
            id: typeof boiteId === 'function' ? boiteId('t') : ('t' + Date.now().toString(16)),
            at: new Date().toISOString(),
            titre: titre,
            url: url,
            nom: typeof boiteNom === 'function' ? boiteNom() : '',
            publie: 1
        };
        return tutorielEnvoyer(record);
    }).then(function () {
        tutorielPoserFichier(null);
        if (titreEl) titreEl.value = '';
        if (lienEl) lienEl.value = '';
        tutorielActiverInsertion();
        tutorielDire('Vidéo publiée.', false);
        tutorielMajMenu();
    }).catch(function () {
        tutorielActiverInsertion();
        tutorielDire('La vidéo n\'a pas pu être publiée. Réessaie, ou colle un lien YouTube, Drive ou mp4.', true);
    });
}

function tutorielRetirer(id) {
    if (!tutorielEstAdmin() || !id) return;
    var record = {
        type: 'tutoriel',
        id: id,
        at: new Date().toISOString(),
        retire: 1,
        publie: 0,
        titre: '',
        url: ''
    };
    tutorielEnvoyer(record).then(function () {
        tutorielDire('Vidéo retirée.', false);
        tutorielMajMenu();
    }).catch(function () {
        tutorielDire('Le retrait n\'a pas abouti. Réessaie.', true);
    });
}

function initTutoriel() {
    if (!tutorielSectionVisible()) {
        if (typeof navigateTo === 'function') navigateTo('planning');
        return;
    }
    var compose = document.getElementById('tutorielCompose');
    if (compose) compose.style.display = tutorielEstAdmin() ? 'block' : 'none';
    var panneau = document.getElementById('panelTutoriel');
    if (panneau) panneau.classList.toggle('tutoriel-admin', tutorielEstAdmin());
    tutorielRendre();
    if (!tutorielBranche) {
        tutorielBranche = true;
        var titre = document.getElementById('tutorielTitre');
        var choisir = document.getElementById('tutorielChoisir');
        var fichier = document.getElementById('tutorielFichier');
        var lien = document.getElementById('tutorielLien');
        var publier = document.getElementById('tutorielPublier');
        if (titre) titre.addEventListener('input', tutorielActiverInsertion);
        if (choisir) choisir.addEventListener('click', tutorielChoisirFichier);
        if (fichier) fichier.addEventListener('change', function () {
            tutorielPoserFichier(fichier.files && fichier.files[0]);
        });
        if (lien) lien.addEventListener('input', tutorielPoserLien);
        if (publier) publier.addEventListener('click', tutorielPublier);
    }
    tutorielActiverInsertion();
    tutorielCharger();
}

function tutorielPreparer() {
    tutorielListe = tutorielFusionner(tutorielLireLocal());
    tutorielMajMenu();
    var suite = function () {
        tutorielCharger().then(function () {
            var hash = '';
            try { hash = location.hash; } catch (e) {}
            if (hash === '#tutoriel' && tutorielSectionVisible() && typeof navigateTo === 'function') navigateTo('tutoriel');
        });
    };
    /* Charger Firebase pendant le démarrage ralentissait tout le site
       pour un visiteur non connecté : on attend que la page soit posée.
       Un compte connecté charge tout de suite : il en a besoin. */
    var connecte = false;
    try { connecte = typeof boiteSession === 'function' && !!boiteSession(); } catch (e) { connecte = false; }
    if (connecte) { suite(); return; }
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(suite, { timeout: 5000 });
    else setTimeout(suite, 3000);
}

if (typeof document !== 'undefined') tutorielPreparer();
