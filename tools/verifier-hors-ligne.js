/* Lot 15 : shell versionnée, origin confinement et absence de données privées. */
const fs = require('fs');
const assert = require('assert');
const boot = fs.readFileSync('js/boot.js','utf8');
const index = fs.readFileSync('index.html','utf8');
const sw = fs.readFileSync('service-worker.js','utf8');
const registre = fs.readFileSync('js/registre.js','utf8');
const version = /var version = '([^']+)'/.exec(boot)[1];
assert(sw.includes("const VERSION = '" + version + "'"));
assert(index.includes('style_v3.css?v=' + version));
assert(index.includes('app.webmanifest'));
assert(index.includes('<script defer src="js/boot.js'));
assert(boot.includes('s.async = false') && boot.includes('Promise.all(scripts.map'));
assert(boot.includes("service-worker.js?v=' + version"));
assert(sw.includes('url.origin !== self.location.origin'));
assert(sw.includes("!url.pathname.startsWith(new URL('./', self.registration.scope).pathname)"));
assert(sw.includes("url.pathname.includes('/data/')"));
assert(sw.includes('caches.delete(k)'));
assert(sw.includes('cache.addAll') && sw.includes('self.clients.claim()'));
assert(sw.includes("url.searchParams.set('v', VERSION)"));
for (const f of [...registre.matchAll(/'(pages\/[^']+\.html|js\/[^']+\.js)'/g)].map(x => x[1])) {
    assert(sw.includes(JSON.stringify(f)), 'fichier manquant hors-ligne : ' + f);
}
for (const secret of ['boite-url.json','firestore.rules','audio/','lib/ocr/']) {
    assert(!sw.includes('"' + secret + '"'), 'une ressource privée/lourde ne doit pas être préchargée');
}
console.log('ok hors-ligne : cache versionné, scripts ordonnés, aucune donnée privée en cache');
