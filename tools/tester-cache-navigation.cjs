'use strict';
// Simule le gestionnaire du service worker : aucun réseau ni profil réel.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const listeners = {};
let appels = [], disponible = true;
const cache = {match: async () => ({source: 'cache'})};
const contexte = {
  URL, console,
  self: {
    registration: {scope: 'https://studyplan.test/app/'},
    location: {origin: 'https://studyplan.test'},
    addEventListener: (nom, fn) => { listeners[nom] = fn; }
  },
  fetch: async (req, options) => { appels.push({req, options}); if (!disponible) throw Error('hors ligne'); return {source: 'réseau'}; },
  caches: {match: cache.match, open: async () => cache, keys: async () => []}
};
vm.runInNewContext(fs.readFileSync('service-worker.js', 'utf8'), contexte);
async function requete(path, mode) {
  let promise;
  listeners.fetch({request:{method:'GET',url:'https://studyplan.test/app/'+path,mode,headers:{has:()=>false}},respondWith:p=>{promise=p;}});
  return promise && await promise;
}
(async()=>{
  assert.equal((await requete('', 'navigate')).source,'réseau');
  assert.equal(appels[0].options.cache,'no-store','ne pas réutiliser l’ancien index du cache HTTP');
  disponible=false;
  assert.equal((await requete('', 'navigate')).source,'cache','fallback hors ligne conservé');
  disponible=true;appels=[];
  assert.equal((await requete('js/boot.js', 'cors')).source,'réseau');
  assert.equal(appels[0].options.cache,'no-store','le contrôle de version reste réseau');
  assert.equal(await requete('data/salons-planifies.json', 'cors'),undefined,'la configuration dynamique ne passe pas par le cache');
  const publication = fs.readFileSync('tools/preparer-publication-pages.py','utf8');
  assert.ok(publication.includes('nouvelle_navigation = "event.respondWith(fetch(req, { cache: \'no-store\' })'),'la correction doit aussi atteindre le site assemblé');
  console.log('ok cache : index réseau sans cache HTTP, repli hors ligne et assemblage');
})().catch(e=>{console.error(e);process.exitCode=1;});
