/* Coquille hors-ligne : uniquement fichiers publics, jamais les comptes,
   les messages, les documents importés ni les bibliothèques audio/OCR. */
const VERSION = '20261030ag';
const CACHE = 'study-plan-coquille-' + VERSION;
const FICHIERS = [
    "index.html",
    "",
    "js/registre.js",
    "js/boot.js",
    "style_v1.css",
    "style_v2.css",
    "style_v3.css",
    "css/pages/planning-panels.css",
    "css/pages/planning-semaines.css",
    "css/pages/retours.css",
    "css/pages/emplois-atelier.css",
    "css/pages/admin-atelier.css",
    "css/compte.css",
    "css/accessibilite.css",
    "js/accessibilite.js",
    "images/logo.png",
    "app.webmanifest",
    "pages/onboarding-prenom.html",
    "pages/onboarding-objectif.html",
    "pages/onboarding-classe.html",
    "pages/onboarding-matieres.html",
    "pages/onboarding-transport.html",
    "pages/onboarding-voiture.html",
    "pages/onboarding-moto.html",
    "pages/onboarding-sommeil.html",
    "pages/onboarding-habitudes.html",
    "pages/accueil.html",
    "pages/onboarding-activites.html",
    "pages/onboarding-ecran.html",
    "pages/onboarding-libre.html",
    "pages/planning.html",
    "pages/seances.html",
    "pages/pomodoro.html",
    "pages/soutien.html",
    "pages/exercices.html",
    "pages/devoirs.html",
    "pages/emploi-temps.html",
    "pages/legende.html",
    "pages/ee-ia.html",
    "pages/feries.html",
    "pages/tutoriel.html",
    "pages/aide.html",
    "pages/feedback.html",
    "pages/annonce.html",
    "pages/boite.html",
    "pages/compte.html",
    "js/config.js",
    "js/pages/accueil.js",
    "js/pages/onboarding-prenom.js",
    "js/pages/onboarding-objectif.js",
    "js/pages/onboarding-sommeil.js",
    "js/pages/onboarding-habitudes.js",
    "js/pages/onboarding-classe.js",
    "js/pages/onboarding-matieres.js",
    "js/pages/onboarding-travaux.js",
    "js/pages/onboarding-transport.js",
    "js/pages/onboarding-activites.js",
    "js/pages/onboarding-ecran.js",
    "js/pages/onboarding-libre.js",
    "js/pages/onboarding-feries.js",
    "js/pages/planning-base.js",
    "js/pages/navigation.js",
    "js/pages/planning-edition.js",
    "js/pages/suppressions.js",
    "js/pages/soutien.js",
    "js/pages/exercices.js",
    "js/pages/devoirs.js",
    "js/pages/devoirs-moteur.js",
    "js/pages/emploi-temps.js",
    "js/pages/emploi-temps-moteur.js",
    "js/pages/planning-moteur.js",
    "js/pages/chrono-voix.js",
    "js/pages/planning-interface.js",
    "js/pages/planning-export.js",
    "js/pages/musique.js",
    "js/synchro.js",
    "js/memoire.js",
    "js/sauvegarde.js",
    "js/compte.js",
    "js/pages/langue.js",
    "js/pages/boite.js",
    "js/pages/annonce.js",
    "js/pages/tutoriel.js",
    "js/pages/pomodoro-page.js"
];
function urlDuSite(fichier) {
    var url = new URL(fichier || './', self.registration.scope);
    if (fichier && !['app.webmanifest'].includes(fichier)) url.searchParams.set('v', VERSION);
    return url;
}
self.addEventListener('install', function (event) {
    event.waitUntil(caches.open(CACHE).then(function (cache) {
        /* La page de démarrage doit être présente avant activation.
           Les pages annexes sont indépendantes : une absence ne bloque
           ni l'installation ni le reste du site. */
        return cache.addAll(['', 'index.html', 'js/registre.js', 'js/boot.js',
            'style_v1.css', 'style_v2.css', 'style_v3.css'].map(urlDuSite)).then(function () {
            return Promise.all(FICHIERS.map(function (fichier) {
                return cache.add(urlDuSite(fichier)).catch(function (e) {
                    console.warn('Hors-ligne non préchargé :', fichier, e);
                });
            }));
        });
    }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (event) {
    event.waitUntil(caches.keys().then(function (keys) {
        return Promise.all(keys.filter(function (k) {
            return k.startsWith('study-plan-coquille-') && k !== CACHE;
        }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (event) {
    var req = event.request, url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== self.location.origin ||
        !url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
    if (url.pathname.includes('/data/') || url.pathname.includes('/api/') ||
        url.pathname.endsWith('.json') || url.pathname.includes('/lib/') ||
        url.pathname.includes('/audio/')) return;
    var navigation = req.mode === 'navigate';
    var versionCheck = url.pathname.endsWith('/js/boot.js') && !url.search;
    if (navigation || versionCheck) {
        event.respondWith(fetch(req).catch(function () {
            return caches.match(navigation ? urlDuSite('index.html') : urlDuSite('js/boot.js'));
        }));
        return;
    }
    /* La version est dans l'URL : cache-first ne masque jamais une mise à jour.
       Si une ancienne page garde un ancien ?v=, sa réponse reste disponible
       jusqu'au chargement de la nouvelle coquille. */
    event.respondWith(caches.match(req).then(function (cache) {
        if (cache) return cache;
        return fetch(req).then(function (res) {
            if (res.ok && (res.type === 'basic' || res.type === 'default')) {
                var copie = res.clone();
                caches.open(CACHE).then(function (c) { c.put(req, copie); }).catch(function () {});
            }
            return res;
        }).catch(function () {
            /* Ancienne URL avec une autre version : le même fichier local
               reste lisible hors connexion, mais jamais une API privée. */
            return caches.match(urlDuSite(url.pathname.slice(new URL('./', self.registration.scope).pathname.length)));
        });
    }));
});
