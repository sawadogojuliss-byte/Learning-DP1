/* Parcours des annonces en mémoire : aucun appel réseau ni e-mail réel. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ids = ['116965022060639990571','110718856042093635641','107483800962626598897','108029295239679260667'];
const compte = { sub: ids[0], email: 'admin@example.test' };
const base = { type:'annonce', id:'fiche-1', at:'2026-10-24T09:00:00Z', titre:'À lire', texte:'Une annonce complète à examiner.', auteurCle:'juliss', programme:'', acceptations:{}, publie:0, envoyes:[] };
let prive = {}, publicWrites = [], published = [], scheduled = [], mails = 0;
const firebaseUser = () => ({ uid:'uid-admin', providerData:[{ providerId:'google.com', uid:compte.sub }] });
const firestore = () => ({ collection: nom => {
    assert.equal(nom,'comptes');
    return { doc: uid => {
        assert.equal(uid,'uid-admin');
        return {
            get: () => Promise.resolve({ exists:true, data:() => ({ annoncesBrouillons:prive }) }),
            set: data => { Object.assign(prive, data.annoncesBrouillons); return Promise.resolve(); },
            update: (chemin,valeur) => { delete prive[chemin[1]]; return Promise.resolve(); }
        };
    } };
} });
firestore.FieldPath = class extends Array { constructor(...parts) { super(...parts); } };
firestore.FieldValue = { delete:()=>null };
const sandbox = { Promise, Date, console, setTimeout,
    BOITE_ADMINS_SUB:ids, boiteSession:()=>compte, boiteNom:()=> 'Nom libre modifiable',
    boiteEstAdmin:()=>true, boiteFirebasePret:()=>Promise.resolve(firebaseUser()),
    firebase:{ firestore }, boiteEnvoyer:record => { publicWrites.push(record); return Promise.resolve(true); },
    boiteEmailValide: email=> /^[^@ ]+@[^@ ]+\.[^@ ]+$/.test(email),
    boiteEchap: text=>String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;')
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('js/pages/annonce.js','utf8'),sandbox);
sandbox.annonceRendre = () => {};
sandbox.annonceDire = () => {};
sandbox.annoncePublierMaintenant = item => { published.push(item.id); return Promise.resolve(true); };
sandbox.annonceProgrammer = item => { scheduled.push(item.id); return Promise.resolve(true); };
sandbox.annoncePosterMail = () => { mails++; throw new Error('mail interdit dans le test'); };
(async () => {
    assert.equal(sandbox.annonceMoi(),'juliss','le compte prime sur le nom modifiable');
    assert.equal(sandbox.annonceEstAdmin(),true);
    await sandbox.annonceSauverBrouillon({ ...base, brouillon:1 });
    assert.equal(publicWrites.length,0,'un brouillon ne doit jamais être dans publie');
    assert.equal(prive['fiche-1'].texte,base.texte);
    assert.equal((await sandbox.annonceLireBrouillons()).length,1);
    await sandbox.annonceEffacerBrouillon('fiche-1');
    assert.equal(Object.keys(prive).length,0);
    sandbox.annonceListe = sandbox.annonceFusionner([base]);
    compte.sub = ids[0];
    assert.equal(await sandbox.annonceAccepter('fiche-1'),false,'auteur ne vote pas');
    for (let i=1;i<=3;i++) {
        compte.sub = ids[i];
        assert.equal(await sandbox.annonceAccepter('fiche-1'),true);
        assert.equal(published.length,i === 3 ? 1 : 0,'pas de publication avant les trois accords');
        assert.equal(await sandbox.annonceAccepter('fiche-1'),false,'un admin ne vote pas deux fois');
    }
    assert.equal(sandbox.annonceManquants(sandbox.annonceTrouver('fiche-1')).length,0);
    assert.equal(publicWrites.length,3,'un enregistrement par accord');
    assert.equal(mails,0,'aucun e-mail de test');
    const emails = Array.from({length:50},(_,i)=> ({ email:'eleve'+i+'@example.test' }));
    assert.equal(sandbox.annonceDestinataires({},emails).length,40,
        'audit : le circuit existant limite réellement les destinataires à 40');
    assert.equal((await sandbox.annonceLireComptes()).length,0,
        'audit : aucun répertoire complet de comptes n’est récupéré');
    compte.sub = 'compte-equipe';
    assert.equal(sandbox.annonceEstAdmin(),false,'le compte d’équipe supervise sans voter');
    console.log('ok annonces sans réseau : brouillon privé, identité, trois votes uniques, départ au 3e, limite de distribution détectée');
})().catch(err=>{ console.error(err); process.exitCode=1; });
