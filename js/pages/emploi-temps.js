/* ============================================================
   EMPLOI DU TEMPS SCOLAIRE
   L'élève dépose le document de son emploi du temps (PDF ou photo) :
   le site lit ses vrais cours, le planning remplace les créneaux
   « Cours » par les matières réelles, et les heures creuses reçoivent
   du travail (révisions, exercices, mémoire, IA).
   Le document sert de modèle hebdomadaire, remplaçable à tout moment.
   Vue : pages/emploi-temps.html — moteur : js/pages/emploi-temps-moteur.js
   ============================================================ */

var EMPLOI_CLE = 'studyPlanIB_emploiScolaire';
var emploiCacheBrut = null;
var emploiCacheStore = null;
var emploiPropositions = [];
var emploiOcrEnCours = false;

/* ── Le store ─────────────────────────────────────────────────────── */

function emploiScolaireNormaliser(d) {
    if (!d || !Array.isArray(d.jours) || d.jours.length !== 7) return { at: '', jours: [[], [], [], [], [], [], []] };
    return { at: d.at || '', jours: d.jours.map(function (jour) {
        var vus = {};
        return (Array.isArray(jour) ? jour : []).filter(function (c) {
            return c && c.id && /^\d{2}:\d{2}$/.test(c.debut) && /^\d{2}:\d{2}$/.test(c.fin);
        }).map(function (c) {
            var cours = { id: String(c.id), nom: String(c.nom || '').slice(0, 80),
                matiere: String(c.matiere || '').slice(0, 60), debut: c.debut, fin: c.fin,
                src: c.src === 'doc' || c.src === 'manuel' ? c.src : '' };
            if (c.parallele) cours.parallele = true;
            return cours;
        }).filter(function (c) {
            var cle = c.debut + '|' + c.fin + '|' + c.nom.toLowerCase().replace(/\s+/g, ' ').trim();
            if (vus[cle]) return false;
            vus[cle] = true;
            return true;
        }).sort(function (a, b) { return a.debut.localeCompare(b.debut); });
    }) };
}

function emploiScolaireLireCache() {
    var brut = localStorage.getItem(EMPLOI_CLE);
    if (brut !== emploiCacheBrut || !emploiCacheStore) {
        var data = null;
        try { data = JSON.parse(brut || 'null'); } catch (e) {}
        emploiCacheStore = emploiScolaireNormaliser(data);
        emploiCacheBrut = brut;
    }
    return emploiCacheStore;
}

function emploiScolaireLire() {
    /* Copie indépendante pour les appelants qui modifient le store. */
    var cache = emploiScolaireLireCache();
    return { at: cache.at, jours: cache.jours.map(function (jour) {
        return jour.map(function (cours) { return Object.assign({}, cours); });
    }) };
}

function emploiScolaireEcrire(data) {
    try { localStorage.setItem(EMPLOI_CLE, JSON.stringify(emploiScolaireNormaliser(data)));
        emploiCacheBrut = null; emploiCacheStore = null; } catch (e) {}
}

function emploiScolaireVider() {
    try { localStorage.removeItem(EMPLOI_CLE); emploiCacheBrut = null; emploiCacheStore = null; } catch (e) {}
}

function emploiScolaireCompact() {
    var d = emploiScolaireLire();
    if (!d.jours.some(function (j) { return j.length; })) return null;
    return { at: d.at, jours: d.jours };
}

function emploiScolaireJour(dayIndex) {
    var j = Number(dayIndex);
    if (!(j >= 0 && j <= 6)) return [];
    return emploiScolaireLireCache().jours[j].map(function (c) { return Object.assign({}, c); });
}

function emploiScolaireActif() {
    return emploiScolaireLire().jours.some(function (j) { return j.length; });
}

function emploiId() {
    return 'ec' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ── Heures : am/pm, nettoyage des noms ───────────────────────────── */

function emploiH2M(h) {
    var p = String(h || '').split(':');
    return ((parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0)) % 1440;
}

function emploiM2H(m) {
    m = ((Math.round(m) % 1440) + 1440) % 1440;
    return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
}

/* « 8:00 am - 9:30 am », « 1:25 pm - 2:55 pm », « 8h00 - 9h30 » → {debut, fin} */
function emploiLirePlage(s) {
    var t = String(s || '').toLowerCase().replace(/[\u2013\u2014]/g, '-');
    var m = t.match(/(\d{1,2})\s*[:h.]?\s*(\d{2})?\s*(am|pm|h)?\s*(?:-|–|—|to|à|a)\s*(\d{1,2})\s*[:h.]?\s*(\d{2})?\s*(am|pm|h)?/);
    if (!m) return null;
    function convertir(hh, mm, suffixe, autre) {
        var h = parseInt(hh, 10), min = mm ? parseInt(mm, 10) : 0;
        if (suffixe === 'pm') { if (h < 12) h += 12; }
        else if (suffixe === 'am') { if (h === 12) h = 0; }
        else if (autre === 'pm' && h <= 7) h += 12; /* « 1:25 - 2:55 pm » */
        return h * 60 + min;
    }
    var d = convertir(m[1], m[2], m[3], m[6]);
    var f = convertir(m[4], m[5], m[6], m[3]);
    if (f <= d) return null;
    return { debut: emploiM2H(d), fin: emploiM2H(f) };
}

function emploiContientPlage(s) {
    return /(\d{1,2})\s*[:h.]\s*\d{2}\s*(am|pm)?\s*(?:-|–|—|to|à|a)\s*(\d{1,2})\s*[:h.]\s*\d{2}/i.test(String(s || ''));
}

/* Le nom de cours, nettoyé : préfixe de classe et niveaux retirés,
   le nom d'affichage reste lisible. */
function emploiNettoyerNom(nom) {
    var n = String(nom || '').replace(/\s+/g, ' ').trim()
        .replace(/^dp\s*\d?\s*[-–—:]?\s*/i, '')
        .replace(/\s*(sl\s*&?\s*hl|hl\s*&?\s*sl|sl|hl)\s*$/i, '')
        .trim();
    return n || String(nom || '').trim();
}

/* La matière de l'élève correspondant à ce cours, si elle existe :
   « DP2 Maths AA SL » → « Maths AA » (le nom de l'élève). */
function emploiMatiereDe(nom) {
    if (typeof devoirsFamillesEleve !== 'function' || typeof devoirsMatiereLigne !== 'function') return '';
    var familles = devoirsFamillesEleve();
    if (!familles.length) return '';
    var nettoye = emploiNettoyerNom(nom);
    var norm = String(nettoye).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    var trouve = devoirsMatiereLigne(norm, familles);
    return trouve ? trouve.nom : '';
}

/* ── Lecture du document ──────────────────────────────────────────── */

var EMPLOI_JOURS = [
    { mots: ['mon', 'lun', 'lundi', 'monday'], idx: 0 },
    { mots: ['tue', 'mar', 'mardi', 'tuesday'], idx: 1 },
    { mots: ['wed', 'mer', 'mercredi', 'wednesday'], idx: 2 },
    { mots: ['thu', 'jeu', 'jeudi', 'thursday'], idx: 3 },
    { mots: ['fri', 'ven', 'vendredi', 'friday'], idx: 4 },
    { mots: ['sat', 'sam', 'samedi', 'saturday'], idx: 5 },
    { mots: ['sun', 'dim', 'dimanche', 'sunday'], idx: 6 }
];

function emploiMotJour(s) {
    var t = String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    for (var i = 0; i < EMPLOI_JOURS.length; i++) {
        for (var j = 0; j < EMPLOI_JOURS[i].mots.length; j++) {
            if (t === EMPLOI_JOURS[i].mots[j]) return EMPLOI_JOURS[i].idx;
        }
    }
    return -1;
}

/* Les cours d'un document avec positions (pdf.js) : les colonnes de
   jours sont repérées par l'en-tête (Mon Tue Wed…), chaque entrée est
   un nom (une ou deux lignes) suivi de sa plage horaire. Ce qui n'est
   dans aucune colonne de jour (événements de l'école) est ignoré. */
function emploiParseItems(items) {
    var ents = (items || []).filter(function (it) { return it && it.str && it.str.trim() && typeof it.x === 'number'; });
    if (!ents.length) return { jours: [[], [], [], [], [], [], []], colonnes: 0 };

    /* l'en-tête : la bande horizontale qui porte le plus de noms de
       jours (les pieds de page du document ne sont pas des jours) */
    var candidats = [];
    ents.forEach(function (it) {
        var idx = emploiMotJour(it.str.replace(/[^A-Za-zÀ-ÿ]+/g, ' ').trim());
        if (idx >= 0) candidats.push({ idx: idx, x: it.x, y: it.y });
    });
    if (!candidats.length) return { jours: [[], [], [], [], [], [], []], colonnes: 0 };
    var meilleureBande = null, meilleurScore = -1;
    candidats.forEach(function (ref) {
        var bande = candidats.filter(function (c) { return Math.abs(c.y - ref.y) <= 6; });
        var joursDistincts = {};
        bande.forEach(function (c) { joursDistincts[c.idx] = 1; });
        var score = Object.keys(joursDistincts).length;
        if (score > meilleurScore) { meilleurScore = score; meilleureBande = bande; }
    });
    var anchors = [];
    meilleureBande.forEach(function (c) {
        var deja = anchors.filter(function (a) { return a.idx === c.idx; })[0];
        if (!deja) anchors.push(c);
    });
    if (!anchors.length) return { jours: [[], [], [], [], [], [], []], colonnes: 0 };

    var jours = [[], [], [], [], [], [], []];
    var limiteY = Math.max.apply(null, anchors.map(function (a) { return a.y; })) - 5;

    /* chaque colonne de jour : les items de haut en bas ; un item
       horaire prend comme nom les lignes juste au-dessus de lui (un nom
       peut se couper en deux lignes). Ce qui est trop loin au-dessus
       (les événements de l'école) ne lui est jamais rattaché. */
    anchors.forEach(function (ancre) {
        var colonne = ents.filter(function (it) {
            if (it.y >= limiteY) return false;
            var dist = Math.abs(ancre.x - it.x);
            var autre = 1e9;
            anchors.forEach(function (a2) { autre = Math.min(autre, Math.abs(a2.x - it.x)); });
            return dist <= autre + 1; /* cette colonne est la plus proche */
        }).sort(function (a, b) { return (b.y - a.y) || (a.x - b.x); });
        colonne.forEach(function (it, i) {
            if (!emploiContientPlage(it.str)) return;
            var plage = emploiLirePlage(it.str);
            if (!plage) return;
            var morceaux = [];
            var yRef = it.y;
            for (var k = i - 1; k >= 0 && morceaux.length < 2; k--) {
                var auDessus = colonne[k];
                if (auDessus.y < yRef) break; /* en dessous : autre chose */
                if (auDessus.y - yRef > 18) break; /* trop loin : un autre bloc (événement) */
                if (emploiContientPlage(auDessus.str)) break;
                morceaux.unshift(String(auDessus.str).trim());
                yRef = auDessus.y;
            }
            var nom = morceaux.length ? morceaux.join(' ').replace(/\s+/g, ' ').trim() : '';
            if (nom) jours[ancre.idx].push({ nom: nom, plage: plage });
        });
        jours[ancre.idx].sort(function (a, b) { return a.plage.debut < b.plage.debut ? -1 : 1; });
    });
    return { jours: jours, colonnes: anchors.length };
}

/* Repli sans positions (photo lue par l'OCR, texte collé) : les entrées
   défilent jour après jour ; le jour change quand l'heure de début
   redescend. Le jour de chaque ligne reste modifiable à la confirmation. */
function emploiParseTexte(texte) {
    var lignes = String(texte || '').split(/[\n\r]+/);
    var jours = [[], [], [], [], [], [], []];
    var jourCourant = 0;
    var buf = [];
    var dernierePlage = null;
    lignes.forEach(function (ligne) {
        var t = String(ligne || '').trim();
        if (!t) return;
        var idx = emploiMotJour(t.split(/[^A-Za-zÀ-ÿ]+/).filter(Boolean)[0] || '');
        if (idx >= 0 && !emploiContientPlage(t)) { /* ligne d'en-tête de jour */ }
        if (emploiContientPlage(t)) {
            var plage = emploiLirePlage(t);
            var nom = buf.length ? buf.join(' ').replace(/\s+/g, ' ').trim() : t.replace(/^p\d+\s*[·:\-–]\s*/i, '').trim();
            buf = [];
            if (plage && nom) {
                if (dernierePlage && plage.debut < dernierePlage.debut && jours[jourCourant].length >= 1) {
                    jourCourant = Math.min(4, jourCourant + 1); /* l'heure redescend : jour suivant */
                }
                jours[jourCourant].push({ nom: nom, plage: plage });
                dernierePlage = plage;
            }
        } else if (!/^p\d+$/i.test(t)) {
            buf.push(t);
        }
    });
    return { jours: jours, colonnes: 0 };
}

/* ── Le document devient des propositions ─────────────────────────── */

function emploiDire(texte, erreur) {
    var el = document.getElementById('emploiOcrStatut');
    if (!el) return;
    el.textContent = texte || '';
    el.style.color = erreur ? '#b45309' : '#047857';
}

function emploiPdfItems(fichier, dire) {
    return devoirsChargerPdfJs().then(function () {
        return fichier.arrayBuffer();
    }).then(function (tampon) {
        return window.pdfjsLib.getDocument({ data: tampon }).promise;
    }).then(function (doc) {
        var pages = Math.min(doc.numPages, 3);
        var items = [];
        function pageSuivante(n) {
            if (n > pages) return items;
            if (dire) dire('Lecture du document (page ' + n + ' sur ' + pages + ')…');
            return doc.getPage(n).then(function (page) {
                return page.getTextContent().then(function (tc) {
                    var brut = (tc.items || []).map(function (it) { return (it.str || '') + (it.hasEOL ? '\n' : ' '); }).join('');
                    var assezDeTexte = brut.trim().length >= 60;
                    if (assezDeTexte) {
                        (tc.items || []).forEach(function (it) {
                            if (!it.str || !it.str.trim() || !it.transform) return;
                            items.push({ str: it.str, x: it.transform[4], y: it.transform[5] });
                        });
                        return pageSuivante(n + 1);
                    }
                    /* page scannée : rendu en image puis lecture automatique,
                       et repli sur l'analyse ligne par ligne */
                    var vp = page.getViewport({ scale: 1 });
                    var echelle = Math.min(2.5, 2200 / Math.max(1, vp.width));
                    var viewport = page.getViewport({ scale: echelle });
                    var canvas = document.createElement('canvas');
                    canvas.width = Math.floor(viewport.width);
                    canvas.height = Math.floor(viewport.height);
                    return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise.then(function () {
                        return devoirsChargerTesseract().then(function () {
                            return window.Tesseract.recognize(canvas.toDataURL('image/png'), 'fra', {
                                workerPath: 'lib/ocr/worker.min.js', corePath: 'lib/ocr', langPath: 'lib/ocr/langs', workerBlobURL: false
                            });
                        });
                    }).then(function (res) {
                        var lignes = String((res && res.data && res.data.text) || '').split(/[\n\r]+/);
                        lignes.forEach(function (l) {
                            if (l && l.trim()) items.push({ str: l, x: 0, y: 0, ocr: true });
                        });
                        return pageSuivante(n + 1);
                    });
                });
            });
        }
        return pageSuivante(1);
    });
}

function emploiLireDocument() {
    var input = document.getElementById('emploiFichier');
    var fichier = input && input.files && input.files[0];
    if (!fichier) {
        emploiDire('Choisis le document de ton emploi du temps (PDF ou photo).', true);
        return;
    }
    if (emploiOcrEnCours) return;
    emploiOcrEnCours = true;
    emploiDire('Lecture du document…', false);
    var promesse;
    if (typeof devoirsEstPdf === 'function' && devoirsEstPdf(fichier)) {
        promesse = emploiPdfItems(fichier, function (m) { emploiDire(m, false); }).then(function (items) {
            var avecPos = items.filter(function (it) { return !it.ocr; });
            if (avecPos.length >= 6) return emploiParseItems(avecPos);
            return emploiParseTexte(items.filter(function (it) { return it.ocr; }).map(function (it) { return it.str; }).join('\n'));
        });
    } else {
        promesse = devoirsOcrImage(fichier, function (m) { emploiDire(m, false); }).then(function (texte) {
            return emploiParseTexte(texte);
        });
    }
    promesse.then(function (res) {
        emploiOcrEnCours = false;
        emploiMontrerPropositions(res);
    }).catch(function (e) {
        emploiOcrEnCours = false;
        emploiDire((e && e.message) || 'La lecture a échoué. Ajoute les cours à la main ci-dessous.', true);
    });
}

function emploiMontrerPropositions(res) {
    var propositions = [];
    res.jours.forEach(function (liste, idx) {
        liste.forEach(function (c) {
            propositions.push({ jour: idx, nom: emploiNettoyerNom(c.nom), matiere: emploiMatiereDe(c.nom), debut: c.plage.debut, fin: c.plage.fin });
        });
    });
    var zone = document.getElementById('emploiConfirmation');
    if (!zone) return;
    if (!propositions.length) {
        zone.innerHTML = '<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:1rem;padding:0.9rem 1rem;font-size:0.85rem;color:#92400e;">Aucun cours reconnu dans ce document. Vérifie la photo (lumière, netteté) ou ajoute les cours à la main ci-dessous.</div>';
        return;
    }
    emploiPropositions = propositions.map(function (p, i) { p.cle = 'ep' + i; return p; });
    var lignes = emploiPropositions.map(function (p) {
        return '<div data-eprop="' + p.cle + '" style="display:flex;gap:0.45rem;align-items:center;flex-wrap:wrap;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:0.8rem;padding:0.55rem;">' +
            '<select class="ep-jour" style="flex:1 1 5.5rem;border:1px solid #e5e7eb;border-radius:0.55rem;padding:0.4rem;font:inherit;font-size:0.8rem;">' +
            ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(function (j, ji) {
                return '<option value="' + ji + '"' + (ji === p.jour ? ' selected' : '') + '>' + j + '</option>';
            }).join('') + '</select>' +
            '<input class="ep-nom" value="' + emploiEchap(p.nom) + '" placeholder="Cours" style="flex:2 1 9rem;border:1px solid #e5e7eb;border-radius:0.55rem;padding:0.4rem;font:inherit;font-size:0.8rem;">' +
            '<input class="ep-debut" type="time" value="' + p.debut + '" style="flex:1 1 5rem;border:1px solid #e5e7eb;border-radius:0.55rem;padding:0.4rem;font:inherit;font-size:0.8rem;">' +
            '<span style="color:#9ca3af;">→</span>' +
            '<input class="ep-fin" type="time" value="' + p.fin + '" style="flex:1 1 5rem;border:1px solid #e5e7eb;border-radius:0.55rem;padding:0.4rem;font:inherit;font-size:0.8rem;">' +
            '<button type="button" onclick="emploiRetirerProposition(\'' + p.cle + '\')" style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:0.95rem;">✕</button>' +
            '</div>';
    }).join('');
    zone.innerHTML =
        '<div style="background:#f0fdf4;border:1.5px solid #a7f3d0;border-radius:1rem;padding:0.9rem 1rem;">' +
        '<p style="margin:0 0 0.6rem;font-size:0.85rem;font-weight:700;color:#065f46;">' + emploiPropositions.length + ' cours détecté' + (emploiPropositions.length > 1 ? 's' : '') + ' — vérifie chaque ligne (jour, nom, heures) avant d\u2019enregistrer :</p>' +
        '<div style="display:flex;flex-direction:column;gap:0.45rem;">' + lignes + '</div>' +
        '<div style="display:flex;gap:0.6rem;margin-top:0.7rem;">' +
        '<button type="button" onclick="emploiViderPropositions()" style="flex:1;padding:0.65rem;border:1.5px solid #e5e7eb;border-radius:0.75rem;background:white;color:#374151;font:inherit;font-weight:700;cursor:pointer;">Tout effacer</button>' +
        '<button type="button" onclick="emploiConfirmerPropositions()" style="flex:2;padding:0.65rem;border:none;border-radius:0.75rem;background:linear-gradient(135deg,#059669,#10b981);color:white;font:inherit;font-weight:800;cursor:pointer;">Enregistrer mes cours</button>' +
        '</div></div>';
    emploiDire('', false);
}

function emploiEchap(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function emploiRetirerProposition(cle) {
    emploiPropositions = emploiPropositions.filter(function (p) { return p.cle !== cle; });
    var el = document.querySelector('[data-eprop="' + cle + '"]');
    if (el) el.remove();
    if (!emploiPropositions.length) emploiViderPropositions();
}

function emploiViderPropositions() {
    emploiPropositions = [];
    var zone = document.getElementById('emploiConfirmation');
    if (zone) zone.innerHTML = '';
    var f = document.getElementById('emploiFichier');
    if (f) f.value = '';
}

function emploiConfirmerPropositions() {
    var store = emploiScolaireLire();
    /* Le nouveau document remplace le modèle du précédent document :
       les cours venus d'une ancienne analyse disparaissent (avant, ils
       s'ajoutaient aux anciens et tout semblait doublé), ceux ajoutés
       à la main restent. */
    store.jours = store.jours.map(function (j) {
        return j.filter(function (c) { return c.src !== 'doc'; });
    });
    var ajoutes = 0;
    var refuse = '';
    var vues = {};
    emploiPropositions.forEach(function (p) {
        var el = document.querySelector('[data-eprop="' + p.cle + '"]');
        var jour = p.jour, nom = p.nom, debut = p.debut, fin = p.fin;
        if (el) {
            jour = parseInt((el.querySelector('.ep-jour') || {}).value, 10);
            nom = (el.querySelector('.ep-nom') || {}).value || nom;
            debut = (el.querySelector('.ep-debut') || {}).value || debut;
            fin = (el.querySelector('.ep-fin') || {}).value || fin;
        }
        if (!(jour >= 0 && jour <= 6) || !nom || !/^\d{2}:\d{2}$/.test(debut) || !/^\d{2}:\d{2}$/.test(fin) || fin <= debut) {
            refuse = 'Certaines lignes incomplètes n\u2019ont pas été enregistrées.';
            return;
        }
        var cle = jour + '|' + debut + '|' + fin + '|' + String(nom).toLowerCase().replace(/\s+/g, ' ').trim();
        if (vues[cle]) return; /* la même ligne deux fois dans le document */
        vues[cle] = 1;
        store.jours[jour].push({ id: emploiId(), nom: nom.slice(0, 80), matiere: emploiMatiereDe(nom), debut: debut, fin: fin, src: 'doc' });
        ajoutes++;
    });
    store.jours = store.jours.map(function (j) { return j.sort(function (a, b) { return a.debut < b.debut ? -1 : 1; }); });
    store.at = new Date().toISOString();
    emploiScolaireEcrire(store);
    emploiViderPropositions();
    emploiRendre();
    if (typeof generatePlanning === 'function') { try { generatePlanning(); } catch (e) {} }
    emploiDire(ajoutes + ' cours enregistré' + (ajoutes > 1 ? 's' : '') + '.' + (refuse ? ' ' + refuse : ''), false);
}

/* ── Ajout manuel, liste, effacement ──────────────────────────────── */

var emploiEditionId = '';

function emploiEditionFinir() {
    emploiEditionId = '';
    var bouton = document.getElementById('emploiAjouterBouton');
    if (bouton) bouton.textContent = 'Ajouter le cours';
    var annuler = document.getElementById('emploiAnnulerEdition');
    if (annuler) annuler.hidden = true;
}

function emploiEditer(id) {
    var store = emploiScolaireLire();
    for (var jour = 0; jour < 7; jour++) {
        var cours = store.jours[jour].find(function (c) { return c.id === id; });
        if (!cours) continue;
        emploiEditionId = id;
        ['Jour', 'Nom', 'Debut', 'Fin'].forEach(function (champ) {
            var el = document.getElementById('emploiManuel' + champ);
            if (el) el.value = champ === 'Jour' ? String(jour) : cours[champ.toLowerCase()];
        });
        var bouton = document.getElementById('emploiAjouterBouton');
        if (bouton) bouton.textContent = 'Enregistrer le cours';
        var annuler = document.getElementById('emploiAnnulerEdition');
        if (annuler) annuler.hidden = false;
        var nom = document.getElementById('emploiManuelNom');
        if (nom && nom.focus) nom.focus();
        return;
    }
}

function emploiChoisirConflit(conflits, suite) {
    var zone = document.getElementById('emploiConflit');
    var texte = document.getElementById('emploiConflitTexte');
    if (!zone || !texte) return; /* Jamais de remplacement implicite. */
    texte.textContent = 'Ce créneau chevauche : ' + conflits.map(function (c) {
        return '« ' + c.nom + ' » (' + c.debut + '–' + c.fin + ')';
    }).join(', ') + '.';
    zone.hidden = false;
    ['remplacer', 'garder', 'annuler'].forEach(function (choix) {
        var bouton = document.getElementById('emploiConflit' + choix.charAt(0).toUpperCase() + choix.slice(1));
        if (!bouton) return;
        bouton.onclick = function () {
            zone.hidden = true;
            var ajout = document.getElementById('emploiAjouterBouton');
            if (ajout && ajout.focus) ajout.focus();
            suite(choix);
        };
        if (choix === 'annuler' && bouton.focus) bouton.focus();
    });
}

function emploiAjouterManuel() {
    var jour = Number((document.getElementById('emploiManuelJour') || {}).value);
    var nom = String((document.getElementById('emploiManuelNom') || {}).value || '').trim();
    var debut = (document.getElementById('emploiManuelDebut') || {}).value || '';
    var fin = (document.getElementById('emploiManuelFin') || {}).value || '';
    var zone = document.getElementById('emploiAjoutStatut');
    function dire(t, err) { if (zone) { zone.textContent = t; zone.style.color = err ? '#b45309' : '#047857'; } }
    if (!Number.isInteger(jour) || jour < 0 || jour > 6 || !nom || !/^\d{2}:\d{2}$/.test(debut) || !/^\d{2}:\d{2}$/.test(fin) || fin <= debut) {
        dire('Jour, nom et heures (fin après le début) sont nécessaires.', true);
        return;
    }
    var brutAvant = localStorage.getItem(EMPLOI_CLE);
    var store = emploiScolaireLire();
    var ancien = null;
    var ancienJour = -1;
    if (emploiEditionId) for (var j = 0; j < 7; j++) {
        ancien = store.jours[j].find(function (c) { return c.id === emploiEditionId; });
        if (ancien) { ancienJour = j; break; }
    }
    if (emploiEditionId && !ancien) { emploiEditionFinir(); dire('Ce cours n’existe plus. Réessaie.', true); return; }
    var conflits = store.jours[jour].filter(function (c) {
        return c.id !== emploiEditionId && debut < c.fin && fin > c.debut;
    });
    if (conflits.length) {
        emploiChoisirConflit(conflits, appliquer);
        return;
    }
    appliquer('aucun');

    function appliquer(choix) {
    if (choix === 'annuler') { dire('Modification annulée.', true); return; }
    if (localStorage.getItem(EMPLOI_CLE) !== brutAvant) {
        dire('L’emploi du temps a changé. Réessaie sans perdre les nouveaux cours.', true); return;
    }
    var parallele = ancien ? !!ancien.parallele : false;
    if (choix === 'remplacer') {
        var ids = conflits.map(function (c) { return c.id; });
        store.jours[jour] = store.jours[jour].filter(function (c) { return ids.indexOf(c.id) === -1; });
        parallele = false;
    } else if (choix === 'garder') {
        parallele = true;
        conflits.forEach(function (c) { c.parallele = true; });
    }
    if (ancien) store.jours[ancienJour] = store.jours[ancienJour].filter(function (c) { return c.id !== emploiEditionId; });
    store.jours[jour].push({ id: ancien ? ancien.id : emploiId(), nom: nom.slice(0, 80),
        matiere: emploiMatiereDe(nom), debut: debut, fin: fin, src: ancien ? ancien.src : 'manuel', parallele: parallele });
    store.jours[jour].sort(function (a, b) { return a.debut.localeCompare(b.debut); });
    store.at = new Date().toISOString();
    emploiScolaireEcrire(store);
    ['emploiManuelNom', 'emploiManuelDebut', 'emploiManuelFin'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    dire(ancien ? 'Cours modifié ✓' : 'Cours ajouté ✓', false);
    emploiEditionFinir();
    emploiRendre();
    if (typeof generatePlanning === 'function') { try { generatePlanning(); } catch (e) {} }
    }
}

function emploiSupprimer(id) {
    var store = emploiScolaireLire();
    for (var jour = 0; jour < 7; jour++) {
        var index = store.jours[jour].findIndex(function (c) { return c.id === id; });
        if (index < 0) continue;
        store.jours[jour].splice(index, 1);
        store.at = new Date().toISOString();
        emploiScolaireEcrire(store);
        if (emploiEditionId === id) emploiEditionFinir();
        emploiRendre();
        if (typeof generatePlanning === 'function') { try { generatePlanning(); } catch (e) {} }
        return;
    }
}

function emploiRendre() {
    var zone = document.getElementById('emploiListe');
    if (!zone) return;
    var store = emploiScolaireLire();
    var nomsJours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    var total = 0;
    var html = nomsJours.map(function (nom, idx) {
        var liste = store.jours[idx];
        if (!liste.length) return '';
        total += liste.length;
        return '<div style="margin-bottom:0.6rem;"><p style="margin:0 0 0.3rem;font-size:0.8rem;font-weight:800;color:#374151;">' + nom + '</p>' +
            liste.map(function (c) {
                return '<div style="display:flex;align-items:center;gap:0.5rem;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:0.7rem;padding:0.45rem 0.6rem;margin-bottom:0.3rem;">' +
                    '<span style="font-size:0.95rem;">🏫</span>' +
                    '<div style="flex:1;min-width:0;"><p style="margin:0;font-weight:700;color:#111827;font-size:0.82rem;">' + emploiEchap(c.nom) + (c.matiere && c.matiere !== c.nom ? ' <span style="font-weight:600;color:#059669;font-size:0.72rem;">· ' + emploiEchap(c.matiere) + '</span>' : '') + '</p>' +
                    '<p style="margin:0;font-size:0.72rem;color:#6b7280;">' + c.debut + ' → ' + c.fin + '</p></div>' +
                    '<button type="button" aria-label="Modifier ' + emploiEchap(c.nom) + '" onclick="emploiEditer(' + emploiEchap(JSON.stringify(c.id)) + ')" style="border:none;background:none;color:#047857;cursor:pointer;font-size:0.9rem;">✏️</button>' +
                    '<button type="button" aria-label="Supprimer ' + emploiEchap(c.nom) + '" onclick="emploiSupprimer(' + emploiEchap(JSON.stringify(c.id)) + ')" style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:0.9rem;">🗑️</button></div>';
            }).join('') + '</div>';
    }).join('');
    zone.innerHTML = total
        ? '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-bottom:0.6rem;">' +
            '<p style="margin:0;font-size:0.82rem;font-weight:700;color:#065f46;">' + total + ' cours enregistré' + (total > 1 ? 's' : '') + ' — modèle appliqué chaque semaine</p>' +
            '<button type="button" onclick="emploiToutEffacer()" style="border:1px solid #fca5a5;background:#fff;color:#b91c1c;border-radius:0.5rem;padding:0.4rem;font:inherit;font-weight:700;font-size:0.78rem;cursor:pointer;white-space:nowrap;">Tout effacer</button></div>' + html
        : '<p style="margin:0;font-size:0.82rem;color:#9ca3af;">Aucun cours pour l\u2019instant : sans emploi du temps, le planning garde des créneaux « Cours » génériques.</p>';
}

function emploiExporterAvantEffacement() {
    var blob = new Blob([JSON.stringify(emploiScolaireLire(), null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var lien = document.createElement('a');
    lien.href = url;
    lien.download = 'studyplan-emploi-du-temps.json';
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function emploiToutEffacer() {
    var nombre = emploiScolaireLire().jours.reduce(function (n, liste) { return n + liste.length; }, 0);
    if (!nombre) return;
    confirmerAction({
        titre: 'Effacer les ' + nombre + ' cours de l’emploi du temps ?',
        detail: 'Le modèle hebdomadaire et ses révisions générées disparaîtront. Tu peux télécharger tes cours avant de confirmer.',
        action: 'Effacer les cours',
        exporter: emploiExporterAvantEffacement,
        confirmer: function () {
            emploiScolaireVider();
            emploiEditionFinir();
            emploiRendre();
            if (typeof generatePlanning === 'function') { try { generatePlanning(); } catch (e) {} }
        }
    });
}

/* ── Navigation dans le parcours ──────────────────────────────────── */

function showEmploiPage() {
    document.querySelectorAll('.context-modal').forEach(function (el) {
        if (el.id !== 'emploiModal') el.classList.remove('active');
    });
    document.querySelectorAll('.app-panel').forEach(function (el) { el.classList.remove('active'); });
    var modal = document.getElementById('emploiModal');
    if (modal) modal.classList.add('active');
    emploiRendre();
    if (typeof memoireMarquerEtape === 'function') { try { memoireMarquerEtape('emploi'); } catch (e) {} }
}

function goBackFromEmploi() {
    var modal = document.getElementById('emploiModal');
    if (modal) modal.classList.remove('active');
    /* Pendant l'inscription, on revient à la page Temps libre. Depuis
       le menu d'un profil déjà complet, on revient au planning. */
    if (window.__profilComplet) {
        if (typeof generatePlanning === 'function') generatePlanning();
        return;
    }
    if (typeof goToFreeTime === 'function') goToFreeTime();
}

function validateEmploiTemps() {
    /* Continuer referme la page Emploi du temps puis ouvre le
       planning : avant, la page restait affichée par-dessus et le
       bouton semblait ne rien faire. */
    function versLePlanning() {
        var modal = document.getElementById('emploiModal');
        if (modal) modal.classList.remove('active');
        if (typeof generatePlanning === 'function') generatePlanning();
    }
    /* En DP2, juste après l'insertion de l'emploi du temps scolaire, on
       demande si l'élève fait le bac national (les créneaux du bac sont
       réservés : samedi 8h00-13h00, vendredi 14h55-16h25). */
    if (typeof ibYear !== 'undefined' && ibYear === 'DP2' && typeof devoirsPoserQuestionBac === 'function' &&
        typeof devoirsBacADemander === 'function' && devoirsBacADemander()) {
        devoirsPoserQuestionBac(function () {
            versLePlanning();
        });
        return;
    }
    versLePlanning();
}

function initEmploiTemps() {
    emploiRendre();
}
