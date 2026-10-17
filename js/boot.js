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

var version = '20261017l';

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
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
        var chain = Promise.resolve();
        scripts.forEach(function (src) {
            chain = chain.then(function () {
                return loadScript(src).then(function () {
                    etapesFaites += 1;
                    avancer(etapesFaites, etapesTotales);
                });
            });
        });
        return chain;
    }).then(function () {
        avancer(etapesTotales, etapesTotales);
        document.body.classList.add('boot-fini');
        if (status) status.hidden = true;
        window.__STUDYPLAN_READY = true;
        if (typeof memoireHistoriqueActiver === 'function') memoireHistoriqueActiver();
        /* L'écran s'efface en douceur : la lumière s'éteint, la page reste. */
        setTimeout(function () {
            document.body.classList.remove('booting', 'boot-fini');
        }, 180);
    }).catch(function (err) {
        console.error(err);
        fail(err && err.message ? err.message : 'Impossible de charger Study Plan IB.');
    });
})();
