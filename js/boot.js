/* ============================================================
   Démarrage — charge chaque page puis ses scripts, dans l'ordre.
   ============================================================ */

(function () {
    var root = document.getElementById('app-pages');
    var status = document.getElementById('boot-status');
    var jauge = document.getElementById('boot-jauge-fill');
    var barre = document.getElementById('boot-jauge');

    /* La barre suit le chargement réel : chaque page reçue et chaque script
       chargé la font avancer. On ne ment jamais sur l'avancement. */
    function avancer(fait, total) {
        if (!jauge) return;
        var pourcentage = Math.max(6, Math.min(100, Math.round((fait / Math.max(1, total)) * 100)));
        jauge.style.width = pourcentage + '%';
        if (barre) barre.setAttribute('aria-valuenow', String(pourcentage));
    }

    function fail(message) {
        document.body.classList.remove('booting');
        document.body.classList.add('boot-erreur');
        if (jauge) jauge.style.width = '0%';
        if (status) {
            status.hidden = false;
            var mot = status.querySelector('.boot-mot');
            if (mot) mot.textContent = message;
            else status.textContent = message;
        }
    }

var version = '20261025c';

    /* ── Le site se met à jour tout seul ──────────────────────────────
       Un navigateur garde volontiers l'ancienne page : sans cela, un
       élève qui revient sur son onglet continue d'utiliser le code
       d'hier, et les corrections ne lui parviennent jamais. Au
       démarrage, on regarde la version publiée ; si elle est plus
       récente, la page se recharge une fois, sans rien dire. La marque
       posée dans la session évite toute boucle si le réseau répond
       encore l'ancienne version. */
    (function seMettreAJour() {
        try {
            if (typeof fetch !== 'function' || !window.sessionStorage) return;
            var marque = 'studyPlanIB_version';
            fetch('js/boot.js', { cache: 'no-store' }).then(function (reponse) {
                return reponse.ok ? reponse.text() : '';
            }).then(function (texte) {
                var trouve = /var version = '([^']+)'/.exec(texte || '');
                if (!trouve || trouve[1] === version) return;
                if (sessionStorage.getItem(marque) === trouve[1]) return;
                sessionStorage.setItem(marque, trouve[1]);
                var url = new URL(window.location.href);
                url.searchParams.set('v', trouve[1]);
                window.location.replace(url.toString());
            }).catch(function () {});
        } catch (e) {}
    })();

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.async = false; /* téléchargés ensemble, exécutés dans l'ordre du registre */
            s.src = src + '?v=' + version;
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error('Script introuvable : ' + src)); };
            document.body.appendChild(s);
        });
    }

    var pages = window.STUDYPLAN_HTML || [];
    var scripts = window.STUDYPLAN_SCRIPTS || [];
    var etapesFaites = 0;
    var etapesTotales = pages.length + scripts.length;

    /* Une page retirée du site ne doit jamais bloquer le démarrage : on
       l'ignore et le reste s'ouvre normalement. */
    Promise.all(pages.map(function (url) {
        return fetch(url + '?v=' + version, { cache: 'no-store' }).then(function (res) {
            if (!res.ok) throw new Error('Page absente : ' + url);
            return res.text();
        }).then(function (texte) {
            etapesFaites += 1;
            avancer(etapesFaites, etapesTotales);
            return texte;
        }).catch(function (e) {
            if (window.console && console.warn) console.warn(e.message);
            etapesFaites += 1;
            avancer(etapesFaites, etapesTotales);
            return '';
        });
    })).then(function (parts) {
        root.innerHTML = parts.join('\n');
        var erreurs = [];
        return Promise.all(scripts.map(function (src) {
            return loadScript(src).catch(function (e) {
                erreurs.push(src);
                console.error('Module indisponible', src, e);
            }).then(function () {
                etapesFaites += 1;
                avancer(etapesFaites, etapesTotales);
            });
        })).then(function () {
            if (erreurs.length) {
                /* Le reste du site reste utilisable, sans page blanche. */
                var alerte = document.createElement('p');
                alerte.setAttribute('role', 'alert');
                alerte.className = 'boot-modules-erreur';
                alerte.textContent = 'Certaines fonctions ne sont pas disponibles. Recharge la page quand le réseau revient.';
                root.prepend(alerte);
            }
        });
    }).then(function () {
        avancer(etapesTotales, etapesTotales);
        document.body.classList.add('boot-fini');
        if (status) status.hidden = true;
        window.__STUDYPLAN_READY = true;
        /* Hors-ligne après une première visite ; ne bloque pas l'écran. */
        if ('serviceWorker' in navigator) {
            var inscrire = function () {
                navigator.serviceWorker.register('service-worker.js?v=' + version, { updateViaCache: 'none' })
                    .catch(function (e) { console.warn('Hors-ligne indisponible', e); });
            };
            if ('requestIdleCallback' in window) requestIdleCallback(inscrire, { timeout: 1800 });
            else setTimeout(inscrire, 0);
        }
        if (typeof memoireHistoriqueActiver === 'function') memoireHistoriqueActiver();
        /* La question du bac national doit atteindre TOUS les DP2 déjà
           connectés : ceux qui n'ont jamais répondu, et une fois de plus
           ceux qui avaient répondu avant que la réponse ne s'applique
           vraiment au planning. Le profil peut mettre quelques secondes
           à revenir : on réessaie jusqu'à ce que la question soit posée. */
        var essaisBac = 0;
        setTimeout(function tenterBac() {
            essaisBac++;
            try {
                if (typeof ibYear !== 'undefined' && ibYear && ibYear !== 'DP2') return;
                if (typeof devoirsPoserQuestionBac === 'function' && typeof devoirsBacADemander === 'function' &&
                    typeof ibYear !== 'undefined' && ibYear === 'DP2' && window.__profilComplet) {
                    if (devoirsBacADemander()) devoirsPoserQuestionBac();
                    return;
                }
            } catch (e) {}
            if (essaisBac < 15) setTimeout(tenterBac, 2000);
        }, 1200);
        /* L'écran s'efface en douceur : la lumière s'éteint, la page reste. */
        setTimeout(function () {
            document.body.classList.remove('booting', 'boot-fini');
        }, 180);
    }).catch(function (err) {
        console.error(err);
        fail(err && err.message ? err.message : 'Impossible de charger Study Plan IB.');
    });
})();
