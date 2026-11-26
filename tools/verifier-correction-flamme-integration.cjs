/* Rejoue le vrai démarrage et les vraies restaurations dans le harnais hors ligne. */
const fs = require('fs');
const prefixe = fs.readFileSync(__dirname + '/verifier-semaine-flammes.js', 'utf8').split('/* ── Scénario 1 :')[0];
const scenario = `
return (async function () {
  const n = creerNuage(), email = 'doriilboudo235@gmail.com', sub = 'KENZAH-SUB-123';
  const profile = { ...FULL, userName: 'Kenzah', google: {sub,email}, utilisateurId: sub, flammes: 27, flammeJour: cleJour(new Date()), savedAt: new Date().toISOString() };
  n.docs['progressions/UID-K'] = { progression: JSON.stringify(profile) };
  n.docs['comptes/UID-K'] = { nom:'Kenzah', email };
  const session = { sub, email, name:'Kenzah' };
  const init = { studyPlanIB_googleSession: JSON.stringify(session), studyPlanIB_proprietaire: JSON.stringify(session), studyPlanIB_profil:JSON.stringify(profile), 'studyPlanIB_archive:KENZAH-SUB-123':JSON.stringify(profile), studyPlanIB_flamme: '27', studyPlanIB_flammeJour: profile.flammeJour };
  function creer(init, offset) {
    let c = creerContexte(init); c.crypto = require('crypto').webcrypto; c.TextEncoder = TextEncoder;
    const Vrai = Date; class D extends Vrai { constructor(...a) { super(...(a.length ? a : [Vrai.now()+offset*86400000])); } static now() { return Vrai.now()+offset*86400000; } }; c.Date = D;
    let u = { uid:'UID-K', email, emailVerified:true, displayName:'Kenzah', providerData:[{providerId:'google.com',uid:sub}] };
    const auth = () => ({currentUser:u, onAuthStateChanged(cb) {setTimeout(()=>cb(u),30)}});
    const fs2=()=>n.db; fs2.FieldValue={serverTimestamp:()=> 'TS'}; fs2.FieldPath={documentId:()=> '__name__'};
    c.firebase={apps:[{}],auth,firestore:fs2}; charger(c); return c;
  }
  let c=creer(init,0); await attendre(5000); figer(c);
  if (apercu(c).flammes !== 18 || JSON.parse(n.docs['progressions/UID-K'].progression).flammes !== 18 || !n.docs['comptes/UID-K'].correctionFlamme18) throw Error('première ouverture');
  lire(c,'compteEcouterArreter()');
  c=creer({...c.__store},0); await attendre(5000); figer(c);
  if(apercu(c).flammes!==18) throw Error('réouverture');
  lire(c,'compteEcouterArreter()');
  c=creer({...c.__store},1); await attendre(5000); figer(c);
  if(apercu(c).flammes!==19) throw Error('lendemain');
  await envoyer(c); await attendre(300); if (JSON.parse(n.docs['progressions/UID-K'].progression).flammes!==19) throw Error('synchronisation lendemain');
  lire(c,'compteEcouterArreter()');
  console.log('Démarrage, réouverture et lendemain : OK (nuage simulé, réseau et mails bloqués)');
})()`;
new Function('require', '__dirname', prefixe + '\n' + scenario)(require, __dirname)
  .then(() => process.exit(0), err => { console.error(err); process.exit(1); });
