/* Regroupement visuel admin : vérifie le routage sans toucher aux pages existantes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const lire = rel => fs.readFileSync(rel, 'utf8');
const page = lire('pages/boite.html');
const menu = lire('pages/planning.html');
const css = lire('css/pages/admin-atelier.css');
const navigation = lire('js/pages/navigation.js');
const memoire = lire('js/memoire.js');
assert.match(menu, /id="menuEspaceAdmin"[^>]*navigateTo\('admin'\)/);
assert.match(page, /id="panelAdmin"/);
for (const [texte, cible] of [
    ['Annonce','annonce'], ['Retour des feedbacks','retours'],
    ['Questions des utilisateurs','questions'], ['Emplois du temps','emplois'],
    ['Tutoriel','tutoriel']
]) {
    assert.ok(page.includes('onclick="navigateTo(\'' + cible + '\')"'), 'carte manquante : ' + texte);
    assert.ok(page.includes('<strong>' + texte + '</strong>'), 'titre absent : ' + texte);
}
assert.ok(css.includes('#panelAdmin .admin-atelier-rail') && css.includes('#164633'), 'rail Atelier absent');
assert.ok(css.includes('@media(max-width:750px)') && css.includes('grid-template-columns:1fr'), 'vue mobile absente');
assert.ok(navigation.includes("page === 'admin'") && navigation.includes("!boiteEstAdmin()"), 'page non protégée');
assert.ok(memoire.includes("panelAdmin: 'admin'") && memoire.includes("etape === 'admin'"), 'reprise sur le hub impossible');
assert.ok(lire('index.html').includes('css/pages/admin-atelier.css'), 'CSS non chargé');
assert.ok(lire('service-worker.js').includes('css/pages/admin-atelier.css'), 'CSS hors ligne absent');
assert.ok(lire('tools/bundle-site.py').includes('css/pages/admin-atelier.css'), 'CSS hors bundle absent');
const elements = Object.create(null);
for (const id of ['menuEspaceAdmin','menuAnnonce','menuRetours','menuQuestions','menuEmplois','adminAnnonceBadge','adminAnnonceBadgePage','annonceBadge','annonceBadgePage']) {
    elements[id] = { style: {}, hidden: true, textContent: '' };
}
let admin = false;
const context = {
    document: { getElementById(id) { return elements[id] || null; } },
    boiteVerifierAdmin() {}, boiteEstAdmin() { return admin; },
    boiteSignalerOuverture() {}, annonceEstAdmin() { return admin; },
    annonceCompteBadge() { return 2; }, annonceListe: [],
};
context.window = context;
vm.createContext(context);
function fonction(source, nom) {
    const debut = source.indexOf('function ' + nom + '(');
    assert.ok(debut >= 0, 'fonction manquante ' + nom);
    const fin = source.indexOf('\nfunction ', debut + 8);
    vm.runInContext(source.slice(debut, fin < 0 ? undefined : fin), context);
}
fonction(lire('js/pages/boite.js'), 'boiteMajMenu');
fonction(lire('js/pages/annonce.js'), 'annoncePoserBadge');
fonction(lire('js/pages/annonce.js'), 'annonceMajMenu');
context.boiteMajMenu(); context.annonceMajMenu();
assert.equal(elements.menuEspaceAdmin.style.display, 'none');
assert.equal(elements.menuAnnonce.style.display, 'flex', 'les élèves gardent Annonce');
admin = true;
context.boiteMajMenu(); context.annonceMajMenu();
assert.equal(elements.menuEspaceAdmin.style.display, 'flex');
for (const id of ['menuAnnonce','menuRetours','menuQuestions','menuEmplois']) {
    assert.equal(elements[id].style.display, 'none', 'raccourci séparé visible chez un admin : ' + id);
}
assert.equal(elements.adminAnnonceBadge.textContent, '2', 'badge des annonces transmis au hub');
admin = false;
context.boiteMajMenu(); context.annonceMajMenu();
assert.equal(elements.menuEspaceAdmin.style.display, 'none', 'entrée admin retirée après déconnexion');
assert.equal(elements.menuAnnonce.style.display, 'flex');
console.log('ok Espace admin : cinq liens dont Tutoriel, rail Atelier, mobile et Annonce publique préservée');
