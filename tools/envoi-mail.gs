/**
 * Envoi des réponses Studyplan. Version 4 (accepte encore l'ancien nom pendant la transition).
 * Méthode utilisée par les formulaires statiques : les champs arrivent dans e.parameter.
 * GmailApp, pas MailApp : MailApp part d'un serveur partagé et est rejeté.
 * Déployer > Gérer les déploiements > crayon > Nouvelle version > Déployer.
 * Ne crée pas un nouveau déploiement.
 */
/* Secret privé : Propriétés du script > MAIL_SECRET, jamais dans Git. */
var EXPEDITEUR = 'ibstudyplan@gmail.com';

function reponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function valeur(e, nom) {
  var simple = e && e.parameter ? e.parameter[nom] : '';
  if (simple) return simple;
  var liste = e && e.parameters ? e.parameters[nom] : null;
  if (liste && liste.length) return liste[0];
  return '';
}

function lire(e) {
  var payload = valeur(e, 'payload');
  if (payload) {
    try { return JSON.parse(payload); } catch (err) {}
  }
  var secret = valeur(e, 'secret');
  if (secret && valeur(e, 'to')) {
    return {
      secret: secret,
      nonce: valeur(e, 'nonce'),
      to: valeur(e, 'to'),
      nom: valeur(e, 'nom'),
      salutation: valeur(e, 'salutation'),
      subject: valeur(e, 'subject'),
      text: valeur(e, 'text'),
      html: valeur(e, 'html')
    };
  }
  var brut = e && e.postData && e.postData.contents ? e.postData.contents : '';
  try { return JSON.parse(brut); } catch (err2) { return {}; }
}

function echapper(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function ligneSalutation(data) {
  var ligne = String(data && data.salutation || '').replace(/\s+/g, ' ').trim();
  if (/^(Bonjour|Bonsoir) .+,$/.test(ligne)) return ligne;
  var nom = String(data && data.nom || '').replace(/\s+/g, ' ').trim();
  if (nom.indexOf('@') !== -1) nom = nom.split('@')[0].replace(/[._+-]+/g, ' ');
  nom = nom.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'’.\- ]/g, ' ').replace(/\s+/g, ' ').trim();
  var heure = new Date().getHours();
  var mot = (heure >= 5 && heure < 18) ? 'Bonjour' : 'Bonsoir';
  return nom ? (mot + ' ' + nom + ',') : (mot + ',');
}

function estAnnonce(data) {
  var sujet = String(data && data.subject || '');
  var texte = String(data && data.text || '');
  return sujet.indexOf('Annonce') === 0 || texte.indexOf('Annonce') === 0 || texte.indexOf('Chers utilisateurs') !== -1;
}

function assurerSalutation(data) {
  if (estAnnonce(data)) return data;
  var ligne = ligneSalutation(data);
  var texte = String(data.text || '');
  var html = String(data.html || '');
  if (texte.indexOf('Bonjour') !== 0 && texte.indexOf('Bonsoir') !== 0) texte = ligne + '\n\n' + texte;
  if (html.indexOf('Bonjour') === -1 && html.indexOf('Bonsoir') === -1) {
    html = '<p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#111827;white-space:nowrap;">' + echapper(ligne) + '</p>' + html;
  }
  data.salutation = ligne;
  data.text = texte.slice(0, 4000);
  data.html = html.slice(0, 80000);
  return data;
}

function doGet() {
  return reponse({ success: false, service: 'study-plan-ib', version: 3 });
}

function doPost(e) {
  var data = lire(e);
  var secret = PropertiesService.getScriptProperties().getProperty('MAIL_SECRET');
  if (!secret || !data.secret || data.secret !== secret) return reponse({ success: false, error: 'secret' });
  var nonce = String(data.nonce || '');
  if (!/^[a-z0-9]{16,40}$/.test(nonce)) return reponse({ success: false, error: 'nonce' });
  var to = String(data.to || '').trim();
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(to)) return reponse({ success: false, error: 'email' });
  var sujet = String(data.subject || 'Réponse à ta question — Studyplan').slice(0, 180);
  if (!marqueOk(sujet)) return reponse({ success: false, error: 'sujet' });
  var texte = String(data.text || '').slice(0, 4000);
  var html = String(data.html || '').slice(0, 80000);
  if (!marqueOk(texte) || !marqueOk(html)) {
    return reponse({ success: false, error: 'texte' });
  }
  if (/formsubmit|someone just submitted your form/i.test(html)) {
    return reponse({ success: false, error: 'modele' });
  }
  data = assurerSalutation(data);
  texte = data.text;
  html = data.html;
  var verrou = LockService.getScriptLock();
  try {
    verrou.waitLock(20000);
  } catch (err) {
    return reponse({ success: false, error: 'verrou' });
  }
  try {
    var cache = CacheService.getScriptCache();
    var cle = 'm' + nonce;
    if (cache.get(cle)) {
      return reponse({ success: true, id: nonce });
    }
    cache.put(cle, '1', 21600);
    try {
      GmailApp.sendEmail(to, sujet, texte, {
        htmlBody: html,
        name: 'Équipe Studyplan',
        replyTo: EXPEDITEUR
      });
    } catch (err2) {
      cache.remove(cle);
      return reponse({ success: false, error: String(err2).slice(0, 180) });
    }
    return reponse({ success: true, id: nonce });
  } finally {
    verrou.releaseLock();
  }
}

function marqueOk(texte) {
  return texte.indexOf('Studyplan') !== -1 || texte.indexOf('Study Plan IB') !== -1;
}
