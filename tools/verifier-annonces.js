/* Vérifie la section Annonce sans envoyer de mail. */
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');

var echecs = 0;
function ok(cond, message) {
    if (cond) return;
    echecs += 1;
    console.error('échec:', message);
}

var code = fs.readFileSync('js/pages/annonce.js', 'utf8');
var sandbox = {
    console: console,
    Date: Date,
    Promise: Promise,
    setTimeout: setTimeout,
    fetch: function () { return Promise.reject(new Error('reseau')); },
    boiteMots: function (nom) {
        return String(nom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean);
    },
    boiteEstAdmin: function () { return sandbox.__admin; },
    boiteNom: function () { return sandbox.__nom; },
    boiteSalutation: function (nom, quand) {
        var h = quand.getHours();
        var mot = h >= 5 && h < 18 ? 'Bonjour' : 'Bonsoir';
        return mot + ' ' + nom + ',';
    },
    boiteEchap: function (s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    },
    boiteEchapHtml: function (s) { return sandbox.boiteEchap(s).replace(/\n/g, '<br>'); },
    boiteEmailValide: function (s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '')); },
    __admin: false,
    __nom: ''
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

var juliss = {
    type: 'annonce', id: 'a1', at: '2026-10-12T10:00:00.000Z',
    titre: 'Réunion', texte: 'La réunion est demain.', nom: 'Sawadogo Juliss Bill Owen',
    auteurCle: 'juliss', programme: '2026-10-13T18:00:00.000Z', acceptations: {}, publie: 0
};
var farid = Object.assign({}, juliss, {
    at: '2026-10-12T10:05:00.000Z',
    acceptations: { farid: '2026-10-12T10:05:00.000Z' }
});
var ashley = Object.assign({}, juliss, {
    at: '2026-10-12T10:04:00.000Z',
    acceptations: { ashley: '2026-10-12T10:04:00.000Z' }
});
var fusion = sandbox.annonceFusionner([juliss, farid, ashley]);
ok(fusion.length === 1, 'une seule annonce après fusion');
ok(fusion[0].acceptations.farid && fusion[0].acceptations.ashley, 'les accords simultanés sont conservés');
ok(sandbox.annonceManquants(fusion[0]).indexOf('wendsom') !== -1, 'il manque encore Wendsom');
ok(!sandbox.annonceValidee(fusion[0]), 'deux accords ne suffisent pas');
ok(sandbox.annonceManquants(fusion[0]).indexOf('juliss') === -1, 'l\'auteur ne compte pas parmi les accords exigés');

fusion[0].acceptations.wendsom = '2026-10-12T10:06:00.000Z';
ok(sandbox.annonceValidee(fusion[0]), 'les trois autres comptes débloquent la publication');
ok(!sandbox.annonceEstDue(fusion[0], Date.parse('2026-10-13T17:00:00.000Z')), 'pas d\'envoi avant l\'armement');
fusion[0].programmeActif = 1;
ok(!sandbox.annonceEstDue(fusion[0], Date.parse('2026-10-13T17:59:00.000Z')), 'pas d\'envoi avant l\'heure');
ok(sandbox.annonceEstDue(fusion[0], Date.parse('2026-10-13T18:00:01.000Z')), 'envoi dû à l\'heure programmée');
fusion[0].programmeActif = 0;
fusion[0].acceptations = { farid: 'x' };
ok(!sandbox.annonceEstDue(Object.assign({}, fusion[0], { programmeActif: 1 }), Date.parse('2026-10-14T00:00:00.000Z')), 'pas d\'envoi sans les trois accords');

ok(sandbox.annonceCompteBadge([juliss], false) === 0, 'un brouillon ne compte pas pour un élève');
ok(sandbox.annonceCompteBadge([Object.assign({}, juliss, { publie: 1 })], false) === 1, 'une annonce publiée compte');
ok(sandbox.annonceCompteBadge([juliss, Object.assign({}, juliss, { id: 'a2', publie: 1 })], true) === 2, 'l\'admin voit les annonces faites');

var matin = new Date('2026-10-12T08:00:00');
var soir = new Date('2026-10-12T19:00:00');
var texteMatin = sandbox.annonceTexteMail(juliss, 'Kenzah', matin);
var texteSoir = sandbox.annonceTexteMail(juliss, 'Kenzah', soir);
ok(texteMatin.indexOf('Annonce\n') === 0, 'annonce en haut');
ok(texteMatin.indexOf('Chers utilisateurs') !== -1, 'chers utilisateurs');
ok(texteSoir.indexOf('Annonce\n') === 0, 'le soir commence aussi par Annonce');
ok(texteMatin.indexOf('À bientôt,') !== -1 && texteMatin.indexOf("L'équipe Study Plan IB") !== -1, 'formule de fin');
var htmlAnnonce = sandbox.annonceHtmlMail(juliss, 'Kenzah', matin);
ok(htmlAnnonce.indexOf('>Annonce<') !== -1 && htmlAnnonce.indexOf('Chers utilisateurs') !== -1, 'html annonce et chers utilisateurs');
ok(htmlAnnonce.indexOf('<strong>L\'équipe Study Plan IB</strong>') !== -1, 'signature en gras');
var nonce = sandbox.annonceNonce('a1', 'Kenzah@gmail.com');
ok(/^[a-z0-9]{16,40}$/.test(nonce), 'nonce accepté par le script mail');
ok(nonce === sandbox.annonceNonce('a1', 'kenzah@gmail.com'), 'nonce stable pour la même adresse');

var planning = fs.readFileSync('pages/planning.html', 'utf8');
var feedback = planning.indexOf('id="menuFeedback"');
var annonce = planning.indexOf('id="menuAnnonce"');
var aide = planning.indexOf('id="menuAide"');
ok(aide !== -1 && aide < feedback && feedback < annonce, 'Annonce est juste sous Feedback');
ok(planning.indexOf('background:#ef4444') !== -1 && planning.indexOf('color:#111827') !== -1, 'cercle rouge, nombre noir');
ok(fs.readFileSync('js/registre.js', 'utf8').indexOf('pages/annonce.html') !== -1, 'page enregistrée');
ok(fs.readFileSync('js/boot.js', 'utf8').indexOf("20261017j") !== -1, 'cache rafraîchi');
ok(fs.readFileSync('js/pages/boite.js', 'utf8').indexOf('doc.annonces') !== -1, 'archive lit les annonces');
ok(fs.readFileSync('tools/sync-emplois.py', 'utf8').indexOf('def fusionner_annonces') !== -1, 'synchro fusionne les annonces');
ok(fs.readFileSync('.github/workflows/boite.yml', 'utf8').indexOf('data/annonces.json') !== -1, 'le flux enregistre le fichier');

sandbox.__admin = false;
sandbox.__nom = 'Kenzah Ilboudo';
ok(!sandbox.annonceEstAdmin(), 'un élève ne peut pas écrire');
sandbox.__admin = true;
sandbox.__nom = 'Sere Farid Abdourraham';
ok(sandbox.annonceCleAdmin(sandbox.__nom) === 'farid', 'les deux orthographes de Farid sont le même compte');
ok(sandbox.annonceCles().length === 4, 'quatre comptes, pas six alias');

var retire = sandbox.annonceFusionner([
    juliss,
    Object.assign({}, juliss, { at: '2026-10-12T11:00:00.000Z', retire: 1 }),
    Object.assign({}, juliss, { at: '2026-10-12T10:30:00.000Z', publie: 1 })
]);
ok(retire.length === 0, 'une annonce retirée ne revient pas');

console.log(echecs ? ('échecs ' + echecs) : 'échecs 0');
process.exit(echecs ? 1 : 0);
