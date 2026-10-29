/* ============================================================
   Synchronisation du compte — lot 9 (SY-01 à SY-04, DE-25, ET-16)

   Quatre règles, valables pour tout ce qui voyage entre appareils :
   1. Une suppression ne revient jamais. Elle est notée dans un registre
      de « pierres tombales » (id -> date de suppression). Le registre
      est séparé des listes : le planning n'a rien à filtrer.
   2. Chaque champ d'un objet porte sa date de modification (modifieChamps),
      et l'objet porte la plus récente (modifieAt). À la fusion, chaque champ
      prend la version la plus récente : deux modifications sur des champs
      différents sont conservées toutes les deux. À égalité, la version déjà
      présente sur l'appareil.
   3. Les objets sans date (anciennes sauvegardes) gardent le comportement
      d'avant : on complète les champs vides, sans rien écraser.
   4. Les dates sont posées par comparaison avec l'état précédent, au
      moment de sauvegarder. Rien à modifier dans les 80 endroits qui
      écrivent un cours, un exercice ou un devoir.

   Pendant qu'une sauvegarde distante est appliquée, rien n'est daté :
   l'état reçu devient la nouvelle référence à la fin.
   Les pierres tombales sont purgées après 60 jours.
   Chargé avant memoire.js (voir registre.js).
   ============================================================ */

var SYNC_CLE_REGISTRE = 'studyPlanIB_suppressions';
var SYNC_CLE_FOCUS = 'studyPlanIB_focusReglages';
var SYNC_DELAI_PURGE_MS = 60 * 24 * 60 * 60 * 1000;
var SYNC_MAX_PAR_LISTE = 2000;
var SYNC_LISTES = ['customEvents', 'exercices', 'memoirPlan', 'devoirs', 'examens', 'cours'];
var SYNC_ETATS_EXERCICE = ['done', 'scheduledSlot', 'planVersion', 'etatAt'];
var syncInstantanes = {};
var syncApplicationProfonde = 0;

/* ── Petites aides ─────────────────────────────────────────────────── */

function syncNombre(v) {
    var n = Number(v);
    return isFinite(n) && n > 0 ? n : 0;
}

function syncCopier(x) {
    try { return JSON.parse(JSON.stringify(x)); } catch (e) { return x; }
}

function syncRempli(v) {
    if (v === null || v === undefined || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
}

/* L'objet sans ses dates : ce qui compte pour savoir s'il a changé. */
function syncSansDates(item) {
    var copie = {};
    Object.keys(item).forEach(function (k) { if (k !== 'modifieAt' && k !== 'modifieChamps') copie[k] = item[k]; });
    return syncCopier(copie);
}

/* Instantané d'une liste : id -> objet sans dates (copie profonde). */
function syncIndexer(liste) {
    var map = {};
    (Array.isArray(liste) ? liste : []).forEach(function (item) {
        if (item && typeof item === 'object' && item.id != null) map[String(item.id)] = syncSansDates(item);
    });
    return map;
}

/* Les champs qui ont changé entre deux instantanés (ajoutés, retirés ou modifiés). */
function syncChamps(anc, nouv) {
    var cles = {};
    Object.keys(anc).forEach(function (k) { cles[k] = true; });
    Object.keys(nouv).forEach(function (k) { cles[k] = true; });
    return Object.keys(cles).filter(function (k) {
        return !(k in anc) || !(k in nouv) || JSON.stringify(anc[k]) !== JSON.stringify(nouv[k]);
    });
}

/* La date d'un champ : la sienne si elle existe, sinon celle de l'objet. */
function syncDateChamp(x, k) {
    if (x.modifieChamps && typeof x.modifieChamps === 'object' && Object.prototype.hasOwnProperty.call(x.modifieChamps, k)) {
        return syncNombre(x.modifieChamps[k]);
    }
    return syncNombre(x.modifieAt);
}

function syncLireJson(cle, defaut) {
    try {
        var brut = localStorage.getItem(cle);
        if (brut === null) return defaut;
        return JSON.parse(brut);
    } catch (e) { return defaut; }
}

/* ── Registre des suppressions ─────────────────────────────────────── */

function syncPurgerRegistre(reg, maintenant) {
    SYNC_LISTES.forEach(function (nom) {
        var liste = reg[nom];
        if (!liste) return;
        Object.keys(liste).forEach(function (id) {
            if (syncNombre(liste[id]) < maintenant - SYNC_DELAI_PURGE_MS) delete liste[id];
        });
        var ids = Object.keys(liste);
        if (ids.length > SYNC_MAX_PAR_LISTE) {
            ids.sort(function (x, y) { return syncNombre(liste[y]) - syncNombre(liste[x]); })
                .slice(SYNC_MAX_PAR_LISTE).forEach(function (id) { delete liste[id]; });
        }
    });
    return reg;
}

function syncLireRegistre() {
    var reg = {};
    var brut = syncLireJson(SYNC_CLE_REGISTRE, null);
    if (brut && typeof brut === 'object') {
        SYNC_LISTES.forEach(function (nom) {
            if (brut[nom] && typeof brut[nom] === 'object') reg[nom] = Object.assign({}, brut[nom]);
        });
    }
    return syncPurgerRegistre(reg, Date.now());
}

function syncEcrireRegistre(reg) {
    syncPurgerRegistre(reg, Date.now());
    try { localStorage.setItem(SYNC_CLE_REGISTRE, JSON.stringify(reg)); } catch (e) {}
    return reg;
}

/* Union de deux registres : une suppression connue de l'un est retenue. */
function syncFusionnerRegistres(a, b) {
    var res = {};
    [a, b].forEach(function (src) {
        if (!src || typeof src !== 'object') return;
        SYNC_LISTES.forEach(function (nom) {
            if (!src[nom] || typeof src[nom] !== 'object') return;
            res[nom] = res[nom] || {};
            Object.keys(src[nom]).forEach(function (id) {
                res[nom][id] = Math.max(syncNombre(res[nom][id]), syncNombre(src[nom][id]));
            });
        });
    });
    return res;
}

/* Intègre le registre reçu au registre local et le retourne. */
function syncIntegrerRegistre(recu) {
    var fusion = syncFusionnerRegistres(syncLireRegistre(), recu);
    return syncEcrireRegistre(fusion);
}

/* Un objet est-il supprimé ? Oui si sa suppression est postérieure ou égale
   à sa dernière modification. */
function syncEstSupprime(item, listeSupprimes) {
    if (!listeSupprimes || !item || typeof item !== 'object' || item.id == null) return false;
    var t = listeSupprimes[String(item.id)];
    if (t === undefined) return false;
    return syncNombre(t) >= syncNombre(item.modifieAt);
}

function syncFiltrer(liste, nom, reg) {
    if (!Array.isArray(liste)) return [];
    var supprimes = (reg || syncLireRegistre())[nom];
    return liste.filter(function (item) { return !syncEstSupprime(item, supprimes); });
}

/* ── Dates de modification (instantanés) ───────────────────────────── */

/* Compare la liste à son instantané et date ce qui a changé, champ par champ.
   Un objet disparu devient une pierre tombale datée de maintenant.
   Sans instantané, `precedent` (l'état enregistré juste avant) sert de
   référence ; à défaut, l'état courant devient la référence, sans date. */
/* Registre lu une fois par passage de sauvegarde (voir syncEstampiller). */
var syncRegistreEnCours = null;
function syncRegistreCourant() {
    if (!syncRegistreEnCours) syncRegistreEnCours = syncLireRegistre();
    return syncRegistreEnCours;
}

function syncEstampiller(nom, liste, precedent) {
    if (!Array.isArray(liste) || syncApplicationProfonde > 0) return false;
    syncRegistreEnCours = null;
    var maintenant = Date.now();
    var ancien = syncInstantanes[nom] || null;
    var amorce = !ancien && !Array.isArray(precedent);
    if (!ancien) ancien = syncIndexer(Array.isArray(precedent) ? precedent : liste);
    var neuf = {};
    liste.forEach(function (item) {
        if (!item || typeof item !== 'object' || item.id == null) return;
        var id = String(item.id);
        var nu = syncSansDates(item);
        neuf[id] = nu;
        if (!amorce) {
            var anc = ancien[id];
            if (!anc) {
                /* Objet nouveau (ou restauré par « Annuler ») : chaque champ est daté de maintenant,
                   mais strictement après la suppression qu'il annule. */
                var quand = maintenant;
                var tombe = syncNombre(syncRegistreCourant()[nom] && syncRegistreCourant()[nom][id]);
                if (tombe >= quand) quand = tombe + 1;
                item.modifieChamps = {};
                Object.keys(nu).forEach(function (k) { item.modifieChamps[k] = quand; });
                item.modifieAt = quand;
            } else {
                var changes = syncChamps(anc, nu);
                if (!item.modifieChamps || typeof item.modifieChamps !== 'object') item.modifieChamps = {};
                /* Un champ encore sans date (objet ancien) part de 0 : seuls les changements
                   reçoivent la date de maintenant. */
                Object.keys(nu).forEach(function (k) { if (!(k in item.modifieChamps)) item.modifieChamps[k] = 0; });
                if (changes.length) {
                    changes.forEach(function (k) { item.modifieChamps[k] = maintenant; });
                    item.modifieAt = maintenant;
                }
            }
        }
        if (item.modifieAt == null) item.modifieAt = 0;
        if (!item.modifieChamps || typeof item.modifieChamps !== 'object') item.modifieChamps = {};
    });
    var retires = [];
    if (!amorce) Object.keys(ancien).forEach(function (id) { if (!(id in neuf)) retires.push(id); });
    syncInstantanes[nom] = neuf;
    syncRegistreEnCours = null;
    if (retires.length) {
        var reg = syncLireRegistre();
        reg[nom] = reg[nom] || {};
        retires.forEach(function (id) { reg[nom][id] = maintenant; });
        syncEcrireRegistre(reg);
    }
    return true;
}

function syncRecaler(nom, liste) {
    syncInstantanes[nom] = syncIndexer(liste);
}

/* Aplatit un emploi du temps (7 jours) en une liste de cours. */
function syncAplatirCours(store) {
    var out = [];
    if (store && Array.isArray(store.jours)) {
        store.jours.forEach(function (jour) { (Array.isArray(jour) ? jour : []).forEach(function (c) { out.push(c); }); });
    }
    return out;
}

/* Les listes en mémoire : planning, exercices, plan du mémoire. */
function syncListesMemoire() {
    var l = {};
    if (typeof customEvents !== 'undefined' && Array.isArray(customEvents)) l.customEvents = customEvents;
    if (typeof exercices !== 'undefined' && Array.isArray(exercices)) l.exercices = exercices;
    if (typeof memoirPlan !== 'undefined' && Array.isArray(memoirPlan)) l.memoirPlan = memoirPlan;
    return l;
}

/* Date ce qui a changé depuis la dernière sauvegarde (appelé avant de sauver). */
function syncPreparer() {
    if (syncApplicationProfonde > 0) return;
    var l = syncListesMemoire();
    Object.keys(l).forEach(function (nom) { syncEstampiller(nom, l[nom]); });
    syncFocusCourant();
}

/* Après une application : l'état reçu devient la référence, sans date. */
function syncRecalerMemoire() {
    var l = syncListesMemoire();
    Object.keys(l).forEach(function (nom) { syncRecaler(nom, l[nom]); });
}

/* Effacement volontaire de la progression de cet appareil : pas de suppression
   propagée, la liste repart à vide. */
function syncRemettreAZero() {
    ['customEvents', 'exercices', 'memoirPlan'].forEach(function (nom) { syncInstantanes[nom] = {}; });
}

function syncDebutApplication() { syncApplicationProfonde++; }

function syncFinApplication() {
    syncApplicationProfonde = Math.max(0, syncApplicationProfonde - 1);
    if (syncApplicationProfonde === 0) syncRecalerMemoire();
}

/* ── Fusion de deux listes d'objets ────────────────────────────────── */

function syncCleItem(item, cle) {
    if (!item || typeof item !== 'object') return '';
    if (cle && item[cle]) return String(cle) + ':' + String(item[cle]);
    if (item.id != null && item.id !== '') return 'id:' + String(item.id);
    if (item.name) return 'name:' + String(item.name);
    if (item.nom) return 'nom:' + String(item.nom);
    try { return JSON.stringify(item); } catch (e) { return ''; }
}

/* Fusionne deux versions d'un même objet. `a` est la version de référence
   (locale), `b` l'autre. Chaque champ prend la version la plus récente. */
function syncFusionnerDeux(a, b, opts) {
    opts = opts || {};
    var ta = syncNombre(a.modifieAt);
    var tb = syncNombre(b.modifieAt);
    var res;
    var autre;
    if (ta === 0 && tb === 0) {
        /* Ancien format : pas de date. On garde le comportement d'avant. */
        if (opts.dates && a.date && b.date && Number(b.timestamp) > Number(a.timestamp || 0)) return syncCopier(b);
        res = syncCopier(a);
        Object.keys(b).forEach(function (k) {
            if (k === 'modifieAt' || k === 'modifieChamps') return;
            if (opts.etats && SYNC_ETATS_EXERCICE.indexOf(k) !== -1) return;
            if (!syncRempli(res[k]) && syncRempli(b[k])) res[k] = syncCopier(b[k]);
        });
        autre = b;
    } else {
        res = {};
        var champs = {};
        Object.keys(a).concat(Object.keys(b)).forEach(function (k) {
            if (k !== 'modifieAt' && k !== 'modifieChamps') champs[k] = true;
        });
        Object.keys(champs).forEach(function (k) {
            var sa = syncDateChamp(a, k);
            var sb = syncDateChamp(b, k);
            var ha = k in a;
            var hb = k in b;
            var choisi;
            if (sa === sb) {
                /* Égalité (ou anciens champs) : la version locale, sauf si elle est vide. */
                if (ha && syncRempli(a[k])) choisi = a;
                else if (hb && syncRempli(b[k])) choisi = b;
                else if (ha) choisi = a;
                else if (hb) choisi = b;
                else return;
            } else {
                choisi = sb > sa ? b : a;
            }
            /* Un champ retiré sur la version la plus récente reste retiré. */
            if (!(k in choisi)) return;
            res[k] = syncCopier(choisi[k]);
        });
        var dates = {};
        [a, b].forEach(function (x) {
            if (!x.modifieChamps || typeof x.modifieChamps !== 'object') return;
            Object.keys(x.modifieChamps).forEach(function (k) {
                dates[k] = Math.max(syncNombre(dates[k]), syncNombre(x.modifieChamps[k]));
            });
        });
        res.modifieChamps = dates;
        res.modifieAt = Math.max(ta, tb);
        autre = tb > ta ? a : b;
    }
    /* « Fait » et la planification sont des états réversibles : la version
       dont l'état est le plus récent l'emporte, même si l'autre objet est
       plus récent pour le reste. */
    if (opts.etats && (Date.parse(autre.etatAt) || 0) > (Date.parse(res.etatAt) || 0)) {
        res.done = autre.done === true;
        res.scheduledSlot = autre.scheduledSlot || null;
        res.planVersion = autre.planVersion || null;
        res.etatAt = autre.etatAt;
    }
    return res;
}

/* Fusionne plusieurs listes (la première est la référence) et retire les
   objets supprimés selon le registre `reg`. */
function syncFusionnerListes(listes, nom, reg, opts) {
    opts = opts || {};
    var cle = opts.cle || 'id';
    var supprimes = reg && reg[nom] ? reg[nom] : null;
    var map = {};
    var ordre = [];
    (listes || []).forEach(function (liste) {
        (Array.isArray(liste) ? liste : []).forEach(function (item) {
            if (!item || typeof item !== 'object') return;
            var id = syncCleItem(item, cle);
            if (!id) return;
            if (!map[id]) { map[id] = syncCopier(item); ordre.push(id); return; }
            map[id] = syncFusionnerDeux(map[id], item, opts);
        });
    });
    return ordre.map(function (id) { return map[id]; }).filter(function (item) {
        return !syncEstSupprime(item, supprimes);
    });
}

/* Fusion des cours : par identifiant de cours, comme les devoirs. */
function syncFusionnerEmploi(a, b, reg) {
    var A = a && Array.isArray(a.jours) ? a : null;
    var B = b && Array.isArray(b.jours) ? b : null;
    if (!A && !B) return null;
    var at = (A && A.at) || (B && B.at) || '';
    if (A && B && (Date.parse(B.at) || 0) > (Date.parse(A.at) || 0)) at = B.at;
    var map = {};
    var ordre = [];
    [A, B].forEach(function (src) {
        if (!src) return;
        src.jours.forEach(function (jour, j) {
            (Array.isArray(jour) ? jour : []).forEach(function (c) {
                if (!c || typeof c !== 'object' || c.id == null) return;
                var id = String(c.id);
                if (!map[id]) { map[id] = { j: j, c: syncCopier(c) }; ordre.push(id); return; }
                var nouveauGagne = syncNombre(c.modifieAt) > syncNombre(map[id].c.modifieAt);
                var fusion = syncFusionnerDeux(map[id].c, c, {});
                map[id] = { j: nouveauGagne ? j : map[id].j, c: fusion };
            });
        });
    });
    var supprimes = reg && reg.cours ? reg.cours : null;
    var jours = [[], [], [], [], [], [], []];
    ordre.forEach(function (id) {
        var entree = map[id];
        if (syncEstSupprime(entree.c, supprimes)) return;
        jours[entree.j].push(entree.c);
    });
    return { at: at, jours: jours };
}

/* Fusion des devoirs et examens (le bac national reste la réponse la plus
   aboutie). */
function syncFusionnerStore(a, b, reg) {
    var A = a && typeof a === 'object' ? a : null;
    var B = b && typeof b === 'object' ? b : null;
    if (!A) return B ? syncCopier(B) : null;
    if (!B) return syncCopier(A);
    var res = syncCopier(A);
    if (res.bac !== true && res.bac !== false && (B.bac === true || B.bac === false)) res.bac = B.bac;
    res.bacDemande = (A.bacDemande === 2 || B.bacDemande === 2) ? 2 : 0;
    res.devoirs = syncFusionnerListes([A.devoirs, B.devoirs], 'devoirs', reg, {});
    res.examens = syncFusionnerListes([A.examens, B.examens], 'examens', reg, {});
    return res;
}

/* ── Réglages du minuteur (point 5) ────────────────────────────────── */

function syncFocusLire() {
    var r = {
        durees: syncLireJson('studyPlanIB_focusDurees', null),
        fond: null,
        ambiance: syncLireJson('studyPlanIB_focusAmbiance', null),
        taches: syncLireJson('studyPlanIB_focusTaches', null),
        volumes: {},
        voixActive: null,
        voixVolume: null
    };
    try {
        r.fond = localStorage.getItem('studyPlanIB_focusFond');
        r.voixActive = localStorage.getItem('studyPlanIB_voixActive');
        r.voixVolume = localStorage.getItem('studyPlanIB_voixVolume');
        for (var i = 0; i < localStorage.length; i++) {
            var cle = localStorage.key(i);
            if (cle && cle.indexOf('studyPlanIB_focusVol_') === 0) {
                r.volumes[cle.slice('studyPlanIB_focusVol_'.length)] = localStorage.getItem(cle);
            }
        }
    } catch (e) {}
    return r;
}

function syncFocusEmpreinte(o) {
    o = o || {};
    return JSON.stringify({
        durees: o.durees == null ? null : o.durees,
        fond: o.fond == null ? null : o.fond,
        ambiance: o.ambiance == null ? null : o.ambiance,
        taches: o.taches == null ? null : o.taches,
        volumes: o.volumes || {},
        voixActive: o.voixActive == null ? null : o.voixActive,
        voixVolume: o.voixVolume == null ? null : o.voixVolume
    });
}

/* Renvoie les réglages courants, datés si quelque chose a changé. */
function syncFocusCourant() {
    var actuel = syncFocusLire();
    var precedent = syncLireJson(SYNC_CLE_FOCUS, null);
    var empreinte = syncFocusEmpreinte(actuel);
    if (!precedent || typeof precedent !== 'object') {
        actuel.modifieAt = 0;
    } else if (syncFocusEmpreinte(precedent) !== empreinte) {
        actuel.modifieAt = Date.now();
    } else {
        actuel.modifieAt = syncNombre(precedent.modifieAt);
    }
    if (!precedent || syncFocusEmpreinte(precedent) !== empreinte || precedent.modifieAt !== actuel.modifieAt) {
        try { localStorage.setItem(SYNC_CLE_FOCUS, JSON.stringify(actuel)); } catch (e) {}
    }
    return actuel;
}

/* Écrit des réglages reçus, seulement s'ils sont plus récents que les locaux. */
function syncFocusAppliquer(recu) {
    if (!recu || typeof recu !== 'object') return;
    var local = syncFocusCourant();
    if (syncNombre(recu.modifieAt) <= syncNombre(local.modifieAt)) return;
    function ecrire(cle, valeur) { try { localStorage.setItem(cle, valeur); } catch (e) {} }
    if (recu.durees && typeof recu.durees === 'object') ecrire('studyPlanIB_focusDurees', JSON.stringify(recu.durees));
    if (typeof recu.fond === 'string' && /^\d{1,3}$/.test(recu.fond)) ecrire('studyPlanIB_focusFond', recu.fond);
    if (Array.isArray(recu.ambiance)) ecrire('studyPlanIB_focusAmbiance', JSON.stringify(recu.ambiance.slice(0, 12)));
    if (Array.isArray(recu.taches)) ecrire('studyPlanIB_focusTaches', JSON.stringify(recu.taches.slice(-40)));
    if (recu.volumes && typeof recu.volumes === 'object') {
        Object.keys(recu.volumes).forEach(function (id) {
            var v = Number(recu.volumes[id]);
            if (/^[A-Za-z0-9_-]{1,60}$/.test(id) && isFinite(v) && v >= 0 && v <= 1) ecrire('studyPlanIB_focusVol_' + id, String(v));
        });
    }
    if (recu.voixActive === 'true' || recu.voixActive === 'false') ecrire('studyPlanIB_voixActive', recu.voixActive);
    if (typeof recu.voixVolume === 'string' && isFinite(Number(recu.voixVolume))) ecrire('studyPlanIB_voixVolume', recu.voixVolume);
    /* On garde ce qui est réellement écrit sur l'appareil, pas ce qui a été reçu :
       un réglage absent de la sauvegarde reste celui de l'appareil. */
    var applique = syncFocusLire();
    applique.modifieAt = syncNombre(recu.modifieAt);
    ecrire(SYNC_CLE_FOCUS, JSON.stringify(applique));
}
