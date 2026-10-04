/* ============================================================
   Sauvegarde liée au compte Google
   Une copie précieuse reste sur l'appareil, une autre dans
   le compte Google (Drive). On ne remplace jamais une copie
   utile par une copie plus pauvre.
   ============================================================ */

var SAUVEGARDE_PREFIX = 'studyPlanIB_sauvegarde:';
var sauvegardeNuageTimer = null;
var sauvegardeDernier = '';

function sauvegardeRiche(data) {
    if (!data || typeof data !== 'object' || data.efface) return 0;
    var n = data.profilComplet ? 50 : 0;
    if (data.userName) n += 4;
    if (data.ibYear) n += 2;
    if (Array.isArray(data.subjects)) n += data.subjects.length * 5;
    if (Array.isArray(data.optionalSubjects)) n += data.optionalSubjects.length * 2;
    if (Array.isArray(data.selectedActivities)) n += data.selectedActivities.length;
    if (Array.isArray(data.customEvents)) n += Math.min(data.customEvents.length, 20);
    if (Array.isArray(data.exercices)) n += Math.min(data.exercices.length, 12);
    if (Array.isArray(data.memoirPlan) && data.memoirPlan.length) n += 3;
    if (data.iaPlans && typeof data.iaPlans === 'object') n += 2;
    return n;
}

function sauvegardeGarder(ancien, courant) {
    if (sauvegardeRiche(ancien) <= 0) return false;
    if (sauvegardeRiche(courant) <= 0) return true;
    if (ancien.profilComplet && !courant.profilComplet) return true;
    if (!courant.profilComplet && sauvegardeRiche(ancien) > sauvegardeRiche(courant)) return true;
    return false;
}

function sauvegardeLireCle(cle) {
    try {
        return JSON.parse(localStorage.getItem(cle) || 'null');
    } catch (e) {
        return null;
    }
}

function sauvegardeDb() {
    return new Promise(function (resolve, reject) {
        if (!window.indexedDB) {
            reject(new Error('idb'));
            return;
        }
        var req = indexedDB.open('studyPlanIB', 1);
        req.onupgradeneeded = function () {
            var db = req.result;
            if (!db.objectStoreNames.contains('sauvegardes')) db.createObjectStore('sauvegardes');
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error || new Error('idb')); };
    });
}

function sauvegardeIdbLire(cle) {
    return sauvegardeDb().then(function (db) {
        return new Promise(function (resolve) {
            var tx = db.transaction('sauvegardes', 'readonly');
            var req = tx.objectStore('sauvegardes').get(cle);
            req.onsuccess = function () { resolve(req.result || null); };
            req.onerror = function () { resolve(null); };
        });
    }).catch(function () { return null; });
}

function sauvegardeIdbEcrire(cle, data) {
    return sauvegardeDb().then(function (db) {
        return new Promise(function (resolve) {
            var tx = db.transaction('sauvegardes', 'readwrite');
            tx.objectStore('sauvegardes').put(data, cle);
            tx.oncomplete = function () { resolve(true); };
            tx.onerror = function () { resolve(false); };
        });
    }).catch(function () { return false; });
}

function sauvegardeIdbEffacer(cle) {
    return sauvegardeDb().then(function (db) {
        return new Promise(function (resolve) {
            var tx = db.transaction('sauvegardes', 'readwrite');
            tx.objectStore('sauvegardes').delete(cle);
            tx.oncomplete = function () { resolve(true); };
            tx.onerror = function () { resolve(false); };
        });
    }).catch(function () { return false; });
}

function sauvegardeEcrireCle(cle, data, forcer) {
    if (!data || typeof data !== 'object') return false;
    var ancien = sauvegardeLireCle(cle);
    if (!forcer && sauvegardeGarder(ancien, data)) return false;
    try {
        localStorage.setItem(cle, JSON.stringify(data));
    } catch (e) {}
    sauvegardeIdbEcrire(cle, data);
    return true;
}

function sauvegardeEcrireLocal(cle, data, forcer) {
    if (!cle || !data) return false;
    return sauvegardeEcrireCle(SAUVEGARDE_PREFIX + cle, data, !!forcer);
}

function sauvegardeChoisirListe(liste) {
    var choisi = null;
    liste.forEach(function (item) {
        if (typeof compteChoisirProfil === 'function') {
            choisi = compteChoisirProfil(item, choisi) || choisi || (sauvegardeRiche(item) ? item : choisi);
        } else if (sauvegardeRiche(item) > sauvegardeRiche(choisi)) {
            choisi = item;
        }
    });
    return choisi;
}

function sauvegardeMeilleure(sub) {
    var cles = [
        SAUVEGARDE_PREFIX + 'locale',
        typeof MEMOIRE_KEY === 'string' ? MEMOIRE_KEY : 'studyPlanIB_profil'
    ];
    if (sub) {
        cles.unshift(SAUVEGARDE_PREFIX + sub);
        cles.unshift((typeof MEMOIRE_KEY === 'string' ? MEMOIRE_KEY : 'studyPlanIB_profil') + ':' + sub);
    }
    var locaux = cles.map(sauvegardeLireCle);
    var lectures = [sauvegardeIdbLire('locale')];
    if (sub) lectures.unshift(sauvegardeIdbLire(sub));
    return Promise.all(lectures).then(function (distants) {
        return sauvegardeChoisirListe(locaux.concat(distants));
    });
}

function sauvegardeCapturer() {
    if (typeof memoireLireEtat !== 'function') return null;
    try { return memoireLireEtat(); } catch (e) { return null; }
}

function sauvegardeApresMemoire() {
    var data = sauvegardeCapturer();
    if (!data || sauvegardeRiche(data) <= 0) return;
    var json = '';
    try { json = JSON.stringify(data); } catch (e) { return; }
    if (json === sauvegardeDernier) return;
    sauvegardeDernier = json;
    var sub = window.compteSession && window.compteSession.sub;
    sauvegardeEcrireLocal('locale', data, false);
    if (sub) {
        sauvegardeEcrireLocal(sub, data, false);
        sauvegardePlanifierNuage(sub, data);
    }
}

function sauvegardePlanifierNuage(sub, data) {
    if (!sub || !data) return;
    if (sauvegardeNuageTimer) clearTimeout(sauvegardeNuageTimer);
    sauvegardeNuageTimer = setTimeout(function () {
        sauvegardeNuageTimer = null;
        if (typeof compteNuageSynchroniser === 'function') compteNuageSynchroniser(false);
    }, 4000);
}

function sauvegardeEffacerLocal() {
    var cles = [];
    var i;
    try {
        for (i = 0; i < localStorage.length; i++) cles.push(localStorage.getItem && localStorage.key(i));
    } catch (e) {}
    cles.forEach(function (cle) {
        if (cle && cle.indexOf(SAUVEGARDE_PREFIX) === 0) {
            try { localStorage.removeItem(cle); } catch (e) {}
        }
    });
    return sauvegardeDb().then(function (db) {
        return new Promise(function (resolve) {
            var tx = db.transaction('sauvegardes', 'readwrite');
            tx.objectStore('sauvegardes').clear();
            tx.oncomplete = function () { resolve(true); };
            tx.onerror = function () { resolve(false); };
        });
    }).catch(function () { return false; });
}

function sauvegardeBrancher() {
    if (typeof memoireSauvegarder === 'function' && !memoireSauvegarder.__sauvegarde) {
        var original = memoireSauvegarder;
        var wrapped = function () {
            var resultat = original.apply(this, arguments);
            try { sauvegardeApresMemoire(); } catch (e) {}
            return resultat;
        };
        wrapped.__sauvegarde = true;
        window.memoireSauvegarder = wrapped;
    }
}

sauvegardeBrancher();
setTimeout(sauvegardeApresMemoire, 600);
document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') sauvegardeApresMemoire();
});
