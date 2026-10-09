/* ============================================================
   Démarrage — charge chaque page puis ses scripts, dans l'ordre.
   ============================================================ */

(function () {
    var root = document.getElementById('app-pages');
    var status = document.getElementById('boot-status');

    function fail(message) {
        document.body.classList.remove('booting');
        if (status) {
            status.hidden = false;
            status.textContent = message;
        }
    }

var version = '20261008l';

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

    Promise.all(pages.map(function (url) {
        return fetch(url + '?v=' + version, { cache: 'no-store' }).then(function (res) {
            if (!res.ok) throw new Error('Page introuvable : ' + url);
            return res.text();
        });
    })).then(function (parts) {
        root.innerHTML = parts.join('\n');
        var chain = Promise.resolve();
        scripts.forEach(function (src) {
            chain = chain.then(function () { return loadScript(src); });
        });
        return chain;
    }).then(function () {
        document.body.classList.remove('booting');
        if (status) status.hidden = true;
        window.__STUDYPLAN_READY = true;
        if (typeof memoireHistoriqueActiver === 'function') memoireHistoriqueActiver();
    }).catch(function (err) {
        console.error(err);
        fail(err && err.message ? err.message : 'Impossible de charger Study Plan IB.');
    });
})();
