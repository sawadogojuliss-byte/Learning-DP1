#!/usr/bin/env node
/* Réception des retours dans l'Espace admin. Base fictive en mémoire :
   aucun compte réel, aucun feedback de test ni mail en production. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/pages/boite.js', 'utf8');
const elements = {};
const active = new Set();
function element(id) {
    return elements[id] || (elements[id] = {
        innerHTML: '', textContent: '', style: {},
        classList: { add(c) { if (c === 'active') active.add(id); }, contains(c) { return c === 'active' && active.has(id); } },
        addEventListener() {}, setAttribute() {}, querySelectorAll() { return []; }
    });
}
const store = {};
const db = { feedbacks: [], questions: [], boite: [], publie: [] };
let lectureFeedbacksRefusee = false;
let lectureCompteur = 0;
const horloges = [];
const context = {
    console, JSON, Math, Object, Array, Number, String, Date, Promise,
    setTimeout, clearTimeout, setInterval(fn, temps) { horloges.push({ fn, temps }); return horloges.length; },
    document: {
        visibilityState: 'visible', getElementById: element, addEventListener() {},
        activeElement: null
    },
    localStorage: {
        getItem(k) { return store[k] || null; },
        setItem(k, v) { store[k] = String(v); },
        removeItem(k) { delete store[k]; }
    }
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context);
context.boiteFirebasePret = () => Promise.resolve(null);
context.boiteEstAdmin = () => true;
context.boiteMajMenu = () => {};
context.boiteMemoriserVus = () => {};
context.boiteMajConnexion = () => {};
context.boiteSignalerOuverture = () => {};
context.firebase = { firestore() { return { collection(nom) {
    let chemin = 'at', depuis = '', ordre = 'desc', apres = null, limite = 400;
    return {
        where(cle, _, date) { chemin = cle; depuis = date; return this; },
        orderBy(cle, direction) { chemin = cle; ordre = direction; return this; },
        limit(n) { limite = n; return this; },
        startAfter(doc) { apres = doc; return this; },
        get() {
            lectureCompteur++;
            if (nom === 'feedbacks' && lectureFeedbacksRefusee) return Promise.reject({ code: 'permission-denied' });
            function champ(d) { return chemin === 'at' ? d.at : d.z_donnees_techniques && d.z_donnees_techniques.at; }
            let docs = (db[nom] || []).filter(d => champ(d) && (!depuis || champ(d) > depuis))
                .sort((a, b) => ordre === 'desc' ? champ(b).localeCompare(champ(a)) : champ(a).localeCompare(champ(b)))
                .map((data, i) => ({ id: nom + i, data() { return data; } }));
            if (apres) docs = docs.slice(docs.findIndex(d => d.id === apres.id) + 1);
            docs = docs.slice(0, limite);
            return Promise.resolve({ docs, forEach(fn) { docs.forEach(fn); } });
        }
    };
} }; } };
function feedback(nom, id, date) {
    return context.boiteMessagePourFirestore({
        type: 'feedback', id, at: date,
        '01_heure_envoi': '25/10/2026 16:00 (Ouagadougou)',
        '02_nom_utilisateur': nom,
        '04_feedback': 'Une suggestion fictive de ' + nom,
        z_email_reponse: 'eleve@example.invalid'
    });
}
async function fini() {
    await new Promise(resolve => setTimeout(resolve, 0));
}
(async () => {
    // Lecture ancienne en cache, puis arrivée d'un véritable nouveau format
    // dans le simulateur : ouvrir les retours doit forcer la lecture distante.
    await context.boiteChargerListes(true);
    assert.equal(context.boiteListesCache.feedbacks.length, 0);
    db.feedbacks.push(feedback('Mathis', 'f-mathis-fictif', '2026-10-25T15:00:00.000Z'));
    context.boiteOuvrirAdmin('retours');
    await fini();
    assert.match(element('retoursListe').innerHTML, /Mathis/);
    assert.match(element('retoursListe').innerHTML, /Une suggestion fictive de Mathis/);
    assert.equal(context.boiteListesCache.feedbacks.length, 1);
    assert.ok(horloges.some(h => h.temps === 15000), 'aucune veille pendant que les retours sont ouverts');

    // Une arrivée pendant que l'admin garde la page ouverte doit s'y
    // afficher sans clic sur Actualiser ni réouverture du panneau.
    db.feedbacks.push(feedback('Noa', 'f-noa-fictif', '2026-10-25T15:01:00.000Z'));
    const veille = horloges.find(h => h.temps === 15000);
    veille.fn();
    await fini();
    assert.match(element('retoursListe').innerHTML, /Noa/);
    assert.equal(context.boiteListesCache.feedbacks.length, 2);

    // Un refus n'est jamais confondu avec « aucun feedback reçu ».
    lectureFeedbacksRefusee = true;
    context.boiteRafraichirAdmin();
    await fini();
    assert.match(element('retoursStatut').textContent, /Lecture des feedbacks indisponible/);
    assert.equal(context.boiteListesCache.erreurFeedbacks, 'permission-denied');
    lectureFeedbacksRefusee = false;
    context.boiteRafraichirAdmin();
    await fini();
    assert.equal(context.boiteListesCache.erreurFeedbacks, '');
    assert.match(element('retoursListe').innerHTML, /Mathis/);
    assert.ok(lectureCompteur > 0);
    console.log('ok retours : lecture fraîche à l’ouverture, arrivée en direct, erreur distincte sans écriture distante');
})().catch(e => { console.error(e); process.exitCode = 1; });
