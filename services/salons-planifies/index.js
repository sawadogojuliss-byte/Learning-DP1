'use strict';

// Déploiement séparé requis. Aucune clé ni adresse des élèves dans le client.
const {onRequest} = require('firebase-functions/v2/https');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {defineSecret} = require('firebase-functions/params');
const {initializeApp} = require('firebase-admin/app');
const {getAuth} = require('firebase-admin/auth');
const {getFirestore, Timestamp} = require('firebase-admin/firestore');
const crypto = require('node:crypto');
const core = require('./coeur');
initializeApp();
const db = getFirestore();
const MAIL_SECRET = defineSecret('SALONS_MAIL_SECRET');
const MAIL_URL = 'https://script.google.com/macros/s/AKfycbyj9XN-o0AJa34uk7e98ZTcVNGovwWVcZSeKIitj9iOGPQmjnCCd3_hwApgJXlYAmAqjA/exec';
const origine = 'https://sawadogojuliss-byte.github.io';
const annuaire = db.collection('salons_annuaire_prive');
const programmes = db.collection('salons_programmes_prives');
const rappels = db.collection('salons_rappels_prives');
const limites = db.collection('salons_limites_privees');
const dedoublonnage = db.collection('salons_dedoublonnage_prive');

function exiger(ok, code) { if (!ok) throw core.erreur(code); }
async function utilisateur(req) {
  const jeton = /^Bearer (\S+)$/.exec(req.get('Authorization') || '');
  exiger(jeton, 'auth-requise');
  let u;
  try { u = await getAuth().verifyIdToken(jeton[1], true); } catch (_) { throw core.erreur('auth-requise'); }
  exiger(u.firebase && u.firebase.sign_in_provider === 'google.com' && u.email_verified === true && typeof u.email === 'string', 'google-requis');
  return u;
}
async function classePour(uid) {
  const snap = await db.collection('documents').doc(uid).get();
  const c = snap.exists && snap.data().classe;
  exiger(c === 'DP1' || c === 'DP2', 'classe-requise');
  return c;
}
async function inscription(u, body) {
  exiger(typeof body.visible === 'boolean', 'demande-invalide');
  if (!body.visible) {
    await annuaire.doc(u.uid).delete();
    return {visible:false};
  }
  const classe = await classePour(u.uid);
  const nom = String(u.name || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80);
  exiger(nom, 'nom-requis');
  // Ni adresse mail ni donnée scolaire détaillée dans l'annuaire.
  await annuaire.doc(u.uid).set({nom, classe, visible:true, modifieLe:Timestamp.now()});
  return {visible:true, nom, classe};
}
async function membres(u) {
  await classePour(u.uid);
  const me = await annuaire.doc(u.uid).get();
  const snap = await annuaire.where('visible', '==', true).limit(500).get();
  const eleves = snap.docs.filter(d => d.id !== u.uid).map(d => ({id:d.id, nom:d.data().nom, classe:d.data().classe})).filter(d => d.classe === 'DP1' || d.classe === 'DP2');
  eleves.sort((a,b) => a.classe.localeCompare(b.classe) || a.nom.localeCompare(b.nom,'fr'));
  return {visible:me.exists, eleves, limiteAtteinte:snap.size === 500};
}
async function creer(u, body) {
  const maintenant = Date.now(), data = core.verifierDemande(body, maintenant);
  exiger(!data.invites.includes(u.uid), 'invites-invalides');
  const classe = await classePour(u.uid);
  const demandeId = core.empreinte(u.uid + ':' + data.demandeId);
  const programme = programmes.doc(demandeId);
  const salonId = crypto.randomBytes(24).toString('hex');
  const jour = new Date(maintenant).toISOString().slice(0,10);
  const limiteRef = limites.doc(core.empreinte(u.uid + ':' + jour));
  const donneesHash = core.empreinte(JSON.stringify(data));
  // Une seconde requête identique, même après rechargement ou depuis un autre
  // appareil, retrouve la séance au lieu de créer un deuxième envoi.
  const doublonId = core.empreinte(JSON.stringify([u.uid,data.nom,data.debut,data.fuseau,data.invites.slice().sort()]));
  const doublonRef = dedoublonnage.doc(doublonId);
  return db.runTransaction(async tx => {
    const precedent = await tx.get(programme);
    if (precedent.exists) {
      exiger(precedent.data().empreinte === donneesHash && precedent.data().organisateurUid === u.uid, 'identifiant-utilise');
      return {id:demandeId, deja:true, annule:precedent.data().annule};
    }
    const doublon = await tx.get(doublonRef);
    if (doublon.exists) {
      const ancienne = await tx.get(programmes.doc(doublon.data().programmeId));
      if (ancienne.exists) return {id:ancienne.id, deja:true, annule:ancienne.data().annule};
    }
    const limite = await tx.get(limiteRef);
    exiger(!limite.exists || limite.data().nombre < 5, 'limite-quotidienne');
    const inscrits = await Promise.all(data.invites.map(id => tx.get(annuaire.doc(id))));
    exiger(inscrits.every(d => d.exists && d.data().visible === true && ['DP1','DP2'].includes(d.data().classe)), 'invite-indisponible');
    // Limiter aussi les invitations reçues, y compris lorsque plusieurs comptes
    // différents invitent la même personne le même jour.
    const quotas = data.invites.map(id => limites.doc(core.empreinte('invite:' + id + ':' + jour)));
    const dejaInvites = await Promise.all(quotas.map(ref => tx.get(ref)));
    exiger(dejaInvites.every(s => !s.exists || s.data().nombre < 20), 'invite-indisponible');
    const salonRef = db.collection('salons_focus').doc(salonId);
    const opts = {theme:false, minuteur:false, horloge:false, sons:false, musique:false, citations:false};
    tx.set(salonRef, {nom:data.nom, organisateurUid:u.uid, revision:1, ferme:false, verrouille:false,
      chrono:{mode:'focus',total:1500,restant:1500,running:false,fin:0}, options:opts, partage:{}, expireLe:Timestamp.fromMillis(data.debut + 12*60*60*1000)});
    tx.set(salonRef.collection('membres').doc(u.uid), {pseudo:String(u.name || 'Organisateur').slice(0,30)});
    tx.set(programme, {nom:data.nom, debut:Timestamp.fromMillis(data.debut), fuseau:data.fuseau, salonId, organisateurUid:u.uid,
      participants:[u.uid].concat(data.invites), annule:false, empreinte:donneesHash, classe, creeLe:Timestamp.now()});
    tx.set(doublonRef,{programmeId:demandeId, expireLe:Timestamp.fromMillis(data.debut+7*86400000)});
    tx.set(limiteRef, {nombre:(limite.exists ? limite.data().nombre : 0)+1, expireLe:Timestamp.fromMillis(maintenant + 3*86400000)});
    quotas.forEach((ref,i) => tx.set(ref,{nombre:(dejaInvites[i].exists ? dejaInvites[i].data().nombre : 0)+1, expireLe:Timestamp.fromMillis(maintenant + 3*86400000)}));
    [u.uid].concat(data.invites).forEach((uid, i) => {
      const id = core.empreinte(demandeId + ':' + uid);
      tx.set(rappels.doc(id), {programmeId:demandeId, uid, role:i === 0 ? 'organisateur':'invite',
        prevuLe:Timestamp.fromMillis(data.debut-(i === 0 ? 10 : 5)*core.MINUTE), etat:'attente'});
    });
    return {id:demandeId, deja:false};
  });
}
async function liste(u) {
  const now = Date.now();
  const snaps = await programmes.where('participants','array-contains',u.uid).where('debut','>=',Timestamp.fromMillis(now - 24*60*60*1000)).orderBy('debut').limit(200).get();
  return {salons:snaps.docs.map(doc => {
    const d=doc.data(), debut=d.debut.toMillis();
    const estHote = d.organisateurUid === u.uid;
    return {id:doc.id,nom:d.nom,debut,fuseau:d.fuseau,role:estHote?'organisateur':'invite',annule:d.annule,
      // Le lien apparaît au même moment que le rappel prévu, même si le mail tarde.
      lien:!d.annule && now >= debut - (estHote ? 10 : 5)*core.MINUTE && debut + 12*60*60*1000 > now ? core.lienSalon(d.salonId) : ''};
  }).sort((a,b)=>a.debut-b.debut), limiteAtteinte:snaps.size===200};
}
async function annuler(u, body) {
  exiger(typeof body.id === 'string' && /^[a-f0-9]{64}$/.test(body.id), 'demande-invalide');
  const ref=programmes.doc(body.id);
  await db.runTransaction(async tx => {
    const p=await tx.get(ref); exiger(p.exists && p.data().organisateurUid===u.uid,'acces-refuse');
    if(p.data().annule) return;
    const room=db.collection('salons_focus').doc(p.data().salonId), s=await tx.get(room);
    tx.update(ref,{annule:true});
    if(s.exists && !s.data().ferme) tx.update(room,{ferme:true,revision:s.data().revision+1});
  });
  return {annule:true};
}
const actions = {inscription, membres, creer, liste, annuler};
exports.salonsPlanifies = onRequest({region:'europe-west1',cors:[origine], timeoutSeconds:30}, async (req,res) => {
  res.set('Cache-Control','no-store');
  if(req.method !== 'POST') return res.status(405).json({erreur:'methode'});
  try {
    const u=await utilisateur(req), action=req.body && req.body.action;
    exiger(Object.prototype.hasOwnProperty.call(actions,action),'action-invalide');
    return res.json(await actions[action](u,req.body || {}));
  } catch(e) {
    const code=e.code || 'indisponible';
    const connus=['auth-requise','google-requis','classe-requise','demande-invalide','nom-requis','nom-invalide','date-invalide','fuseau-invalide','invites-invalides','identifiant-invalide','identifiant-utilise','limite-quotidienne','invite-indisponible','acces-refuse','action-invalide'];
    return res.status(code==='auth-requise'?401:connus.includes(code)?400:503).json({erreur:connus.includes(code)?code:'indisponible'});
  }
});

async function revendiquer(ref) {
  return db.runTransaction(async tx => {
    const snap=await tx.get(ref); if(!snap.exists || snap.data().etat!=='attente') return null;
    const r=snap.data(), p=await tx.get(programmes.doc(r.programmeId));
    if(!p.exists || p.data().annule || p.data().debut.toMillis() <= Date.now()) {tx.update(ref,{etat:'annule'});return null;}
    const salon=await tx.get(db.collection('salons_focus').doc(p.data().salonId));
    if(!salon.exists || salon.data().ferme || salon.data().expireLe.toMillis() <= Date.now()) {tx.update(ref,{etat:'annule'});return null;}
    if(r.role==='invite') {
      const inscrit=await tx.get(annuaire.doc(r.uid));
      if(!inscrit.exists || inscrit.data().visible !== true) {tx.update(ref,{etat:'desinscrit'});return null;}
    }
    // Une tentative est enregistrée AVANT l'appel réseau. On ne réessaie pas
    // automatiquement après une réponse incertaine : risque de doublon.
    tx.update(ref,{etat:'tentative', tenteLe:Timestamp.now()});
    return {r, programme:p.data()};
  });
}
async function envoyerRappel(ref) {
  const t=await revendiquer(ref); if(!t)return;
  let etat='incertain';
  try {
    const u=await getAuth().getUser(t.r.uid);
    if(u.disabled || !u.emailVerified || !u.email || !u.providerData.some(p=>p.providerId==='google.com')) {etat='destinataire-indisponible';}
    else {
      const p=t.programme, contenu=core.rappel({id:p.salonId,nom:p.nom,debut:p.debut.toMillis(),fuseau:p.fuseau},t.r.role);
      const nonce=core.empreinte(ref.id).slice(0,32);
      const response=await fetch(MAIL_URL,{method:'POST',redirect:'follow',headers:{'content-type':'text/plain;charset=utf-8'},signal:AbortSignal.timeout(25000),
        body:JSON.stringify({secret:MAIL_SECRET.value(),nonce,to:u.email,subject:contenu.subject,text:contenu.text,html:contenu.html})});
      const data=await response.json();
      if(response.ok && data.success===true && data.id===nonce) etat='confirme';
      else if(data.success===false && typeof data.error==='string') etat='refuse';
    }
  } catch (_) { /* inconnu : pas de second POST automatique */ }
  await ref.update({etat, termineLe:Timestamp.now()});
}
exports.rappelsSalons = onSchedule({schedule:'every 1 minutes',region:'europe-west1',timeZone:'UTC',secrets:[MAIL_SECRET],timeoutSeconds:540,retryCount:0}, async () => {
  const snap=await rappels.where('etat','==','attente').where('prevuLe','<=',Timestamp.now()).orderBy('prevuLe').limit(50).get();
  for(const doc of snap.docs) await envoyerRappel(doc.ref);
});
