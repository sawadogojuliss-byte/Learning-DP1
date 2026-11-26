/**
 * Salons Studyplan — variante gratuite Apps Script, à installer dans le MÊME
 * projet que envoi-mail.gs, mais pas à déployer avant revue et tests réels.
 * Données dans les propriétés du script (privées), pas dans le navigateur.
 * Requiert une autorisation Firestore IAM et un déclencheur par minute.
 */
var SP_PROJET = 'study-plan-ib';
var SP_CLE_API = 'AIzaSyCip0suxr92DLM6Cx5pX0z_SjWEKYWR23E'; // Clé Web Firebase publique, pas un secret.
var SP_SITE = 'https://sawadogojuliss-byte.github.io/Learning-DP1/';
var SP_BASE = 'https://firestore.googleapis.com/v1/projects/' + SP_PROJET + '/databases/(default)/documents';
var SP_MIN = 60000;

function spErreur(code) { var e = new Error(code); e.spCode = code; throw e; }
function spAssert(ok, code) { if (!ok) spErreur(code); }
function spHash(texte) {
  var secret = PropertiesService.getScriptProperties().getProperty('MAIL_SECRET');
  spAssert(!!secret, 'service-indisponible');
  return Utilities.computeHmacSha256Signature(String(texte), secret, Utilities.Charset.UTF_8).map(function(b){return ('0' + ((b + 256) % 256).toString(16)).slice(-2);}).join('');
}
function spHttp(url, options) {
  options = options || {}; options.muteHttpExceptions = true;
  var res = UrlFetchApp.fetch(url, options), code = res.getResponseCode(), data;
  try { data = JSON.parse(res.getContentText()); } catch (_) { spErreur('service-indisponible'); }
  return {code:code, data:data};
}
function spUtilisateur(jeton) {
  spAssert(typeof jeton === 'string' && jeton.length > 50 && jeton.length < 10000, 'auth-requise');
  var r = spHttp('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(SP_CLE_API), {
    method:'post', contentType:'application/json', payload:JSON.stringify({idToken:jeton})
  });
  var u = r.code === 200 && r.data.users && r.data.users[0];
  var google = u && (u.providerUserInfo || []).some(function(p){return p.providerId === 'google.com';});
  spAssert(u && !u.disabled && u.emailVerified === true && google && typeof u.localId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(u.localId) && ['__proto__','constructor','prototype'].indexOf(u.localId)<0 && typeof u.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email), 'google-requis');
  return {uid:u.localId, email:u.email, nom:String(u.displayName || 'Membre Studyplan').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,80)};
}
function spIdentiteSalon(jeton) {
  spAssert(typeof jeton==='string' && jeton.length>50 && jeton.length<10000,'auth-requise');
  var r=spHttp('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(SP_CLE_API),{method:'post',contentType:'application/json',payload:JSON.stringify({idToken:jeton})});
  var compte=r.code===200 && r.data.users && r.data.users[0];
  spAssert(compte && !compte.disabled && typeof compte.localId==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(compte.localId),'auth-requise');
  return compte.localId;
}
function spClasse(uid, jeton) {
  // Lecture au nom de l'élève : les règles Firestore doivent autoriser
  // uniquement sa propre fiche. Le jeton n'est jamais enregistré.
  var r = spHttp(SP_BASE + '/documents/' + encodeURIComponent(uid), {headers:{Authorization:'Bearer ' + jeton}});
  var classe = r.code === 200 && r.data.fields && r.data.fields.classe && r.data.fields.classe.stringValue;
  spAssert(classe === 'DP1' || classe === 'DP2', 'classe-requise');
  return classe;
}
function spPropriete(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function spLire(k) { var s=spPropriete(k); if(!s)return null; try{return JSON.parse(s);}catch(_){spErreur('service-indisponible');} }
function spEcrire(k,v) {
  var texte=JSON.stringify(v);spAssert(Utilities.newBlob(texte).getBytes().length <= 8000,'capacite');
  // Laisser de la place à MAIL_SECRET et aux autres propriétés du projet.
  var toutes=PropertiesService.getScriptProperties().getProperties(), total=0;
  Object.keys(toutes).forEach(function(cle){if(cle!==k)total+=Utilities.newBlob(cle+toutes[cle]).getBytes().length;});
  spAssert(total + Utilities.newBlob(k+texte).getBytes().length < 450000,'capacite');
  PropertiesService.getScriptProperties().setProperty(k,texte);
}
function spSousVerrou(fn) {
  var lock=LockService.getScriptLock();lock.waitLock(20000);
  try{return fn();}finally{lock.releaseLock();}
}
function spEnregistrer(u, jeton, visible) {
  spAssert(typeof visible==='boolean','demande-invalide');
  var classe=visible ? spClasse(u.uid,jeton) : '';
  return spSousVerrou(function(){
    var p=PropertiesService.getScriptProperties(), cle='SP_U_'+u.uid;
    if(!visible){
      // Retirer aussi les acceptations en cours pour qu'une réinscription
      // ultérieure ne réactive pas silencieusement de vieux rappels.
      var existantes=p.getProperties();
      Object.keys(existantes).forEach(function(k){
        if(k.indexOf('SP_P_')!==0)return;
        var seance=spLire(k);
        if(seance && seance.reponses && seance.reponses[u.uid]==='accepte'){
          seance.reponses[u.uid]='refuse';spEcrire(k,seance);
        }
      });
      p.deleteProperty(cle);return {visible:false};
    }
    var toutes=p.getProperties();
    spAssert(toutes[cle] || Object.keys(toutes).filter(function(k){return k.indexOf('SP_U_')===0;}).length < 500,'capacite');
    spEcrire(cle,{uid:u.uid,nom:u.nom,email:u.email,classe:classe});
    return {visible:true,nom:u.nom,classe:classe};
  });
}
// Lecture serveur avec OAuth/IAM et masques minimaux ; aucune règle Firestore
// n'est ouverte entre utilisateurs et les emails ne sortent pas vers le client.
function spListerProfils(collection,champs) {
  var chemin='/'+collection+'?pageSize=250'+champs.map(function(c){return '&mask.fieldPaths='+encodeURIComponent(c);}).join('');
  var documents=[], page='', nombre=0;
  do {
    spAssert(++nombre<=50,'annuaire-limite');
    var r=spFirestore('get',chemin+(page?'&pageToken='+encodeURIComponent(page):''));
    spAssert(r.code===200 && r.data && typeof r.data==='object','annuaire-indisponible');
    if(r.data.documents)spAssert(Array.isArray(r.data.documents),'annuaire-indisponible');
    documents=documents.concat(r.data.documents || []);
    page=r.data.nextPageToken || '';
    spAssert(!page || typeof page==='string' && page.length<4000,'annuaire-indisponible');
  } while(page);
  return documents;
}
function spAnnuaireComptes() {
  var profils=spListerProfils('documents',['nom','classe']), comptes=spListerProfils('comptes',['email']);
  var ayantMail=Object.create(null), eleves=[];
  comptes.forEach(function(c){
    var uid=String(c.name || '').split('/').pop(), email=c.fields && c.fields.email && c.fields.email.stringValue;
    if(/^[A-Za-z0-9_-]{1,128}$/.test(uid) && ['__proto__','constructor','prototype'].indexOf(uid)<0 && typeof email==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))ayantMail[uid]=true;
  });
  profils.forEach(function(d){
    var uid=String(d.name || '').split('/').pop(), champs=d.fields || {}, classe=champs.classe && champs.classe.stringValue;
    if(!ayantMail[uid] || ['DP1','DP2'].indexOf(classe)<0)return;
    var nom=String(champs.nom && champs.nom.stringValue || 'Membre Studyplan').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,80) || 'Membre Studyplan';
    eleves.push({id:uid,nom:nom,classe:classe});
  });
  eleves.sort(function(a,b){return a.classe.localeCompare(b.classe)||a.nom.localeCompare(b.nom,'fr');});
  return eleves;
}
// Diagnostic manuel : aucun nom, adresse ou identifiant n'est journalisé.
// Lecture seule ; à lancer par le propriétaire depuis l'éditeur Apps Script.
function spDiagnosticAnnuaire() {
  var eleves=spAnnuaireComptes();
  Logger.log('Annuaire accessible : '+eleves.length+' profil(s) DP1/DP2 avec mail enregistré. Aucun mail ni écriture.');
}
function spMembres(u,jeton) {
  spClasse(u.uid,jeton);
  return {annuaireAutomatique:true,eleves:spAnnuaireComptes().filter(function(m){return m.id!==u.uid;}),limiteAtteinte:false};
}
function spValeur(v) {
  if (typeof v==='string')return {stringValue:v};
  if (typeof v==='boolean')return {booleanValue:v};
  if (typeof v==='number')return {integerValue:String(v)};
  if (v instanceof Date)return {timestampValue:v.toISOString()};
  if (Array.isArray(v))return {arrayValue:{values:v.map(spValeur)}};
  var champs={};Object.keys(v).forEach(function(k){champs[k]=spValeur(v[k]);});return {mapValue:{fields:champs}};
}
function spFields(v) {var o={};Object.keys(v).forEach(function(k){o[k]=spValeur(v[k]);});return o;}
function spFirestore(method,path,payload) {
  var opts={method:method,headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},contentType:'application/json'};
  if(payload)opts.payload=JSON.stringify(payload);
  return spHttp(SP_BASE+path,opts);
}
function spCreerSalon(id,u,nom,debut) {
  var base='projects/'+SP_PROJET+'/databases/(default)/documents/salons_focus/'+id;
  var options={theme:false,minuteur:false,horloge:false,sons:false,musique:false,citations:false};
  var salon={nom:nom,organisateurUid:u.uid,revision:1,ferme:false,verrouille:false,chrono:{mode:'focus',total:1500,restant:1500,running:false,fin:0},options:options,partage:{},expireLe:new Date(debut+12*60*60*1000)};
  var r=spFirestore('post',':commit',{writes:[{update:{name:base,fields:spFields(salon)},currentDocument:{exists:false}},{update:{name:base+'/membres/'+u.uid,fields:spFields({pseudo:u.nom.slice(0,30) || 'Organisateur'})},currentDocument:{exists:false}}]});
  if(r.code===200)return;
  // Si la réponse de l'écriture précédente a été perdue, retrouver uniquement
  // le même salon ; ne jamais écraser un document existant.
  var ancien=spFirestore('get','/salons_focus/'+id);
  spAssert(ancien.code===200 && ancien.data.fields && ancien.data.fields.organisateurUid && ancien.data.fields.organisateurUid.stringValue===u.uid && ancien.data.fields.nom && ancien.data.fields.nom.stringValue===nom && ancien.data.fields.ferme && ancien.data.fields.ferme.booleanValue===false,'firestore-indisponible');
}
function spValider(d,now) {
  var nom=typeof d.nom==='string'?d.nom.replace(/[\u0000-\u001f\u007f]/g,' ').trim():'';
  var debut=Number(d.debut), fin=Number(d.fin);
  spAssert(nom && nom.length<=60,'nom-invalide');
  spAssert(Number.isSafeInteger(debut) && debut>=now+15*SP_MIN && debut<=now+30*86400000,'date-invalide');
  spAssert(Number.isSafeInteger(fin) && fin>debut && fin<=debut+12*60*SP_MIN,'fin-invalide');
  spAssert(typeof d.fuseau==='string' && d.fuseau.length<=80,'fuseau-invalide');
  try{Utilities.formatDate(new Date(debut),d.fuseau,'yyyy');}catch(_){spErreur('fuseau-invalide');}
  spAssert(Array.isArray(d.invites) && d.invites.length<=20 && d.invites.every(function(x){return typeof x==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(x);}) && new Set(d.invites).size===d.invites.length,'invites-invalides');
  return {nom:nom,debut:debut,fin:fin,fuseau:d.fuseau,invites:d.invites.slice().sort()};
}
function spCreer(u,jeton,body) {
  var d=spValider(body,Date.now());spClasse(u.uid,jeton);spAssert(d.invites.indexOf(u.uid)<0,'invites-invalides');
  var eleves=d.invites.length?spAnnuaireComptes():[], autorises=Object.create(null);
  eleves.forEach(function(m){autorises[m.id]=true;});
  var id=spHash(JSON.stringify([u.uid,d.nom,d.debut,d.fin,d.fuseau,d.invites])).slice(0,64), salonId=spHash('salon:'+id).slice(0,48);
  return spSousVerrou(function(){
    var existant=spLire('SP_P_'+id);if(existant)return {id:id,deja:true,annule:!!existant.annule};
    var props=PropertiesService.getScriptProperties().getProperties(), jour=new Date().toISOString().slice(0,10), compteur=0;
    Object.keys(props).forEach(function(k){if(k.indexOf('SP_P_')===0){var p=JSON.parse(props[k]);if(p.organisateurUid===u.uid && p.creeJour===jour)compteur++;}});
    spAssert(compteur<5,'limite-quotidienne');
    d.invites.forEach(function(uid){spAssert(!!autorises[uid],'invite-indisponible');var n=0;Object.keys(props).forEach(function(k){if(k.indexOf('SP_P_')===0){var p=JSON.parse(props[k]);if(p.creeJour===jour && p.invites.indexOf(uid)>=0)n++;}});spAssert(n<20,'invite-indisponible');});
    var programme={id:id,salonId:salonId,nom:d.nom,debut:d.debut,fin:d.fin,fuseau:d.fuseau,organisateurUid:u.uid,organisateurNom:u.nom,organisateurEmail:u.email,invites:d.invites,reponses:{},courriels:{},annule:false,creeJour:jour,etats:{}};
    // Valider la capacité avant une création Firestore ; une écriture
    // incertaine peut être retrouvée avec le même identifiant déterministe.
    spAssert(Utilities.newBlob(JSON.stringify(programme)).getBytes().length<8000,'capacite');
    spCreerSalon(salonId,u,d.nom,d.debut);
    spEcrire('SP_P_'+id,programme);
    return {id:id,deja:false,annule:false};
  });
}
function spListe(u) {
  return spSousVerrou(function(){
    var props=PropertiesService.getScriptProperties().getProperties(), now=Date.now(), liste=[];
    Object.keys(props).forEach(function(k){
      if(k.indexOf('SP_P_')!==0)return;var p=JSON.parse(props[k]), hote=p.organisateurUid===u.uid;
      if(!hote && p.invites.indexOf(u.uid)<0 || p.debut<now-86400000)return;
      var reponse=hote?'organisateur':(p.reponses && p.reponses[u.uid] || 'attente');
      liste.push({id:p.id,nom:p.nom,debut:p.debut,fin:p.fin || null,fuseau:p.fuseau,organisateurNom:p.organisateurNom || 'Un camarade',role:hote?'organisateur':'invite',reponse:reponse,annule:p.annule,
        lien:!p.annule && (hote || reponse==='accepte') && now>=p.debut-(hote?10:5)*SP_MIN && now<p.debut+12*3600000 ? SP_SITE+'#salon='+p.salonId : ''});
    });
    liste.sort(function(a,b){return a.debut-b.debut;});return {salons:liste.slice(0,200),historique:spLire('SP_H_'+u.uid) || [],limiteAtteinte:liste.length>200};
  });
}
// Historique personnel : enregistré uniquement après une entrée confirmée
// dans le salon. Le jeton de l'identité utilisée dans le salon peut être
// anonyme, séparé du compte Google. Il n'est jamais conservé.
function spParticiper(u,salonId,jetonSalon) {
  spAssert(typeof salonId==='string' && /^[a-f0-9]{48}$/.test(salonId),'demande-invalide');
  var uidSalon=spIdentiteSalon(jetonSalon);
  return spSousVerrou(function(){
    var props=PropertiesService.getScriptProperties().getProperties(), programme=null;
    Object.keys(props).some(function(k){if(k.indexOf('SP_P_')!==0)return false;var p=JSON.parse(props[k]);if(p.salonId===salonId){programme=p;return true;}return false;});
    spAssert(programme && !programme.annule,'acces-refuse');
    var hote=programme.organisateurUid===u.uid;
    spAssert(hote || programme.invites.indexOf(u.uid)>=0 && programme.reponses && programme.reponses[u.uid]==='accepte','acces-refuse');
    var now=Date.now();spAssert(now>=programme.debut-(hote?10:5)*SP_MIN && now<programme.debut+12*60*SP_MIN,'acces-refuse');
    var membre=spFirestore('get','/salons_focus/'+salonId+'/membres/'+encodeURIComponent(uidSalon));
    spAssert(membre.code===200,'acces-refuse');
    var cle='SP_H_'+u.uid, historique=spLire(cle) || [];
    if(historique.some(function(x){return x.id===programme.id;}))return {enregistre:true};
    historique.unshift({id:programme.id,nom:programme.nom,debut:programme.debut,fin:programme.fin || null,fuseau:programme.fuseau,organisateurNom:programme.organisateurNom || 'Un camarade',role:hote?'organisateur':'invite'});
    historique=historique.slice(0,50);
    while(historique.length>1 && Utilities.newBlob(JSON.stringify(historique)).getBytes().length>7500)historique.pop();
    spEcrire(cle,historique);
    return {enregistre:true};
  });
}
function spRepondre(u,id,reponse) {
  spAssert(typeof id==='string' && /^[a-f0-9]{64}$/.test(id) && ['accepte','refuse'].indexOf(reponse)>=0,'demande-invalide');
  return spSousVerrou(function(){
    var p=spLire('SP_P_'+id);
    spAssert(p && p.organisateurUid!==u.uid && p.invites.indexOf(u.uid)>=0,'acces-refuse');
    spAssert(!p.annule && Date.now()<p.debut,'invitation-terminee');
    p.reponses=p.reponses || {};p.courriels=p.courriels || {};p.reponses[u.uid]=reponse;
    if(reponse==='accepte')p.courriels[u.uid]=u.email;else delete p.courriels[u.uid];
    spEcrire('SP_P_'+id,p);
    return {reponse:reponse};
  });
}
function spFermerSalon(id) {
  // Précondition de version pour ne pas écraser un changement de minuteur.
  for(var i=0;i<3;i++) {
    var room=spFirestore('get','/salons_focus/'+id);
    if(room.code===404 || room.code===200 && room.data.fields.ferme.booleanValue===true)return;
    spAssert(room.code===200 && room.data.updateTime && room.data.fields.revision,'firestore-indisponible');
    var revision=Number(room.data.fields.revision.integerValue);
    var chemin='/salons_focus/'+id+'?updateMask.fieldPaths=ferme&updateMask.fieldPaths=revision&currentDocument.updateTime='+encodeURIComponent(room.data.updateTime);
    var r=spFirestore('patch',chemin,{fields:spFields({ferme:true,revision:revision+1})});
    if(r.code===200)return;
    if(r.code!==409 && r.code!==412)spErreur('firestore-indisponible');
  }
  spErreur('firestore-indisponible');
}
function spAnnuler(u,id) {
  spAssert(typeof id==='string' && /^[a-f0-9]{64}$/.test(id),'demande-invalide');
  return spSousVerrou(function(){var p=spLire('SP_P_'+id);spAssert(p && p.organisateurUid===u.uid,'acces-refuse');p.annule=true;spEcrire('SP_P_'+id,p);spFermerSalon(p.salonId);return {annule:true};});
}
function spApi(d) {
  try {
    var u=spUtilisateur(d.jeton), action=d.actionSalons, resultat;
    if(action==='inscription')resultat=spEnregistrer(u,d.jeton,d.visible);
    else if(action==='membres')resultat=spMembres(u,d.jeton);
    else if(action==='creer')resultat=spCreer(u,d.jeton,d);
    else if(action==='liste')resultat=spListe(u);
    else if(action==='effacer-historique')resultat=spSousVerrou(function(){PropertiesService.getScriptProperties().deleteProperty('SP_H_'+u.uid);return {efface:true};});
    else if(action==='participer')resultat=spParticiper(u,d.salonId,d.jetonSalon);
    else if(action==='repondre')resultat=spRepondre(u,d.id,d.reponse);
    else if(action==='annuler')resultat=spAnnuler(u,d.id);
    else spErreur('action-invalide');
    return reponse({success:true,resultat:resultat});
  } catch(e) {return reponse({success:false,error:e.spCode || 'service-indisponible'});}
}
function spEchap(v){return String(v || '').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function spCourrier(p,role) {
  var date=Utilities.formatDate(new Date(p.debut),p.fuseau,'dd/MM/yyyy HH:mm')+(p.fin?' → '+Utilities.formatDate(new Date(p.fin),p.fuseau,'dd/MM/yyyy HH:mm'):'')+' ('+p.fuseau+')', lien=SP_SITE+'#salon='+p.salonId, delai=role==='organisateur'?'10 minutes':'5 minutes';
  var text='Bonjour,\n\nStudyplan — Ton salon commence bientôt\n\n'+p.nom+'\n'+date+'\n\nLa séance commence dans environ '+delai+'.\nRejoindre le salon : '+lien+'\n\nCe lien donne accès au salon : partage-le seulement avec les personnes invitées.\nL’équipe Studyplan';
  var html='<html><body style="margin:0;padding:0;background:#eef7f1;color:#173b2d;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef7f1"><tr><td align="center" style="padding:32px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:white;border-radius:24px;overflow:hidden"><tr><td style="padding:34px 32px;background:#087c57;color:white"><p style="font-size:12px;font-weight:700;letter-spacing:2px;color:#c4f7dc">STUDYPLAN · SALON FOCUS</p><p>Bonjour,</p><h1 style="font-size:30px;line-height:1.2">Un beau moment<br>pour avancer ensemble.</h1><p style="color:#dcfce7">Ta séance commence dans environ '+delai+'.</p></td></tr><tr><td style="padding:30px 32px"><p style="font-size:12px;color:#488164;font-weight:700;letter-spacing:1px">TON RENDEZ-VOUS</p><h2 style="font-size:23px;color:#123e2e">'+spEchap(p.nom)+'</h2><p style="color:#4b6e5c">'+spEchap(date)+'</p><a href="'+spEchap(lien)+'" style="display:inline-block;padding:15px 22px;border-radius:12px;background:#059669;color:white;text-decoration:none;font-weight:700">Rejoindre le salon →</a><p style="margin-top:28px;font-size:13px;color:#6b8175">Ce lien donne accès au salon. Partage-le seulement avec les personnes invitées.</p></td></tr><tr><td style="padding:20px 32px;background:#f6fbf8;color:#59816c;font-size:13px">Avec toi à chaque étape · L’équipe Studyplan</td></tr></table></td></tr></table></body></html>';
  return {text:text,html:html};
}
function spRappelsSalons() {
  var props=PropertiesService.getScriptProperties(), maintenant=Date.now();
  var cles=Object.keys(props.getProperties()).filter(function(k){return k.indexOf('SP_P_')===0;});
  var traites=0;
  cles.forEach(function(k){
    if(traites>=25)return;
    var initial=spLire(k);if(!initial)return;
    if(initial.debut<maintenant-7*86400000) {
      spSousVerrou(function(){var p=spLire(k);if(p && p.debut<Date.now()-7*86400000)props.deleteProperty(k);});return;
    }
    [initial.organisateurUid].concat(initial.invites).forEach(function(uid){
      if(traites>=25)return;
      var tache=spSousVerrou(function(){
        var p=spLire(k), now=Date.now();
        if(!p || p.annule || now>=p.debut || p.etats[uid])return null;
        var hote=p.organisateurUid===uid, avant=hote?10:5;
        if(!hote && (!p.reponses || p.reponses[uid]!=='accepte'))return null;
        if(now<p.debut-avant*SP_MIN)return null;
        var membre=hote?null:spLire('SP_U_'+uid), email=hote?p.organisateurEmail:(p.courriels && p.courriels[uid] || membre && membre.email);
        if(!email){p.etats[uid]='desinscrit';spEcrire(k,p);return null;}
        // Une seule revendication durable avant l'appel réseau ; une réponse
        // incertaine n'est jamais renvoyée automatiquement.
        p.etats[uid]='tentative';spEcrire(k,p);
        return {programme:p,email:email,role:hote?'organisateur':'invite'};
      });
      if(!tache)return;traites++;
      var etat='confirme';
      try {var c=spCourrier(tache.programme,tache.role);GmailApp.sendEmail(tache.email,'Rappel de ton salon — Studyplan',c.text,{htmlBody:c.html,name:'Équipe Studyplan',replyTo:EXPEDITEUR});}
      catch(_){etat='incertain';}
      spSousVerrou(function(){var p=spLire(k);if(p && p.etats[uid]==='tentative'){p.etats[uid]=etat;spEcrire(k,p);}});
    });
  });
}
function spInstallerRappels() {
  // Fonction à lancer manuellement UNE fois dans l'éditeur, après autorisation.
  // Ne touche pas aux autres déclencheurs du projet.
  var existants=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='spRappelsSalons';});
  if(!existants.length) {
    ScriptApp.newTrigger('spRappelsSalons').timeBased().everyMinutes(1).create();
    Logger.log('Déclencheur des rappels installé. Aucun mail envoyé.');
  } else {
    Logger.log('Le déclencheur des rappels existe déjà. Aucun mail envoyé.');
  }
}
