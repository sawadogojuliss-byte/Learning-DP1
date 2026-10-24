/* Contrat de présentation : mêmes rails et typographie, actions conservées.
   Pas de compte ni de lecture/écriture distante. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const lire = file => fs.readFileSync(file, 'utf8');
const boite = lire('pages/boite.html');
const annonce = lire('pages/annonce.html');
const css = lire('css/pages/admin-atelier.css');
const logique = lire('js/pages/boite.js');
const annonces = lire('js/pages/annonce.js');
const pages = [
    ['admin','panelAdmin',boite], ['annonce','panelAnnonce',annonce],
    ['retours','panelRetours',boite], ['questions','panelQuestions',boite],
    ['emplois','panelEmplois',boite]
];
for (const [name,id,source] of pages) {
    const panel = source.split('id="' + id + '"')[1].split(/<div class="app-panel"|<!-- ===/)[0];
    assert.ok(panel, 'page manquante : ' + id);
    assert.match(panel, /class="admin-nav(?: [^"]+)?"/);
    assert.match(panel, /class="admin-nav-lien admin-nav-prive" onclick="navigateTo\('admin'\)"|class="admin-nav-lien admin-nav-prive admin-nav-actif" onclick="navigateTo\('admin'\)"/);
    for (const destination of ['admin','annonce','retours','questions','emplois']) {
        assert.ok(panel.includes('onclick="navigateTo(\'' + destination + '\')"'), id + ' perd ' + destination);
    }
    assert.match(panel, new RegExp('aria-current="page"[^>]*>[^<]+</button>'));
    assert.ok(css.includes('#164633') && css.includes('Georgia,serif'), 'typo ou rail Atelier absent');
    if (name !== 'admin' && name !== 'emplois') assert.match(panel, /admin-page-entete/);
}
for (const id of ['annonceBadgePage','annonceComposer','annonceTitre','annonceTexte','annonceProgramme','annonceEnvoi','annonceAnalyse','annonceStatut','annonceListe']) {
    assert.ok(annonce.includes('id="' + id + '"'), 'fonction Annonce perdue : ' + id);
}
for (const id of ['retoursRafraichir','retoursPartageTexte','retoursStatut','retoursListe','questionsRafraichir','questionsStatut','questionsListe','emploisRafraichir','emploisListe','emploisDetail']) {
    assert.ok(boite.includes('id="' + id + '"'), 'fonction admin perdue : ' + id);
}
assert.match(logique, /function boiteOuvrirAdmin\(page\)/);
assert.match(logique, /function boiteRendreQuestions\(fusion\)/);
assert.match(annonces, /function annonceRendre\(\)/);
assert.match(annonces, /panneau\.classList\.toggle\('annonce-public', !admin\)/);
assert.match(css, /#panelAnnonce\.annonce-public \.admin-nav-prive[^\n]*display:none/);
assert.match(css, /#panelAnnonce\.annonce-public \.admin-nav-lien\[aria-current="page"\][^\n]*display:grid/);
assert.match(css, /@media\(max-width:750px\)/);
console.log('ok pages admin Atelier : rail persistant, dossier et quatre accès, lecteur public protégé, actions et champs préservés');
