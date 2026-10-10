/**
 * Envoi des réponses Study Plan IB. Version 3.
 * Méthode utilisée par les formulaires statiques : les champs arrivent dans e.parameter.
 * GmailApp, pas MailApp : MailApp part d'un serveur partagé et est rejeté.
 * Déployer > Gérer les déploiements > crayon > Nouvelle version > Déployer.
 * Ne crée pas un nouveau déploiement.
 */
var SECRET = 'spib-7c4e9a2b8d1f6c3e';
var EXPEDITEUR = 'ibstudyplan@gmail.com';
var FIL = 'ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b';

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
      subject: valeur(e, 'subject'),
      text: valeur(e, 'text'),
      html: valeur(e, 'html')
    };
  }
  var brut = e && e.postData && e.postData.contents ? e.postData.contents : '';
  try { return JSON.parse(brut); } catch (err2) { return {}; }
}

function confirmer(nonce, to) {
  try {
    UrlFetchApp.fetch('https://ntfy.sh/' + FIL, {
      method: 'post',
      contentType: 'text/plain; charset=utf-8',
      headers: { Title: 'mail-ok', Priority: 'min' },
      payload: JSON.stringify({ type: 'mail-ok', nonce: nonce, to: to, at: new Date().toISOString() }),
      muteHttpExceptions: true
    });
  } catch (err) {}
}

function doGet() {
  return reponse({ success: false, service: 'study-plan-ib', version: 3 });
}

function doPost(e) {
  var data = lire(e);
  if (!data.secret || data.secret !== SECRET) return reponse({ success: false, error: 'secret' });
  var nonce = String(data.nonce || '');
  if (!/^[a-z0-9]{16,40}$/.test(nonce)) return reponse({ success: false, error: 'nonce' });
  var to = String(data.to || '').trim();
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(to)) return reponse({ success: false, error: 'email' });
  var sujet = String(data.subject || 'Réponse à ta question — Study Plan IB').slice(0, 180);
  if (sujet.indexOf('Study Plan IB') === -1) return reponse({ success: false, error: 'sujet' });
  var texte = String(data.text || '').slice(0, 4000);
  var html = String(data.html || '').slice(0, 80000);
  if (texte.indexOf('Study Plan IB') === -1 || html.indexOf('Study Plan IB') === -1) {
    return reponse({ success: false, error: 'texte' });
  }
  if (/formsubmit|someone just submitted your form/i.test(html)) {
    return reponse({ success: false, error: 'modele' });
  }
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
      confirmer(nonce, to);
      return reponse({ success: true, id: nonce });
    }
    cache.put(cle, '1', 21600);
    try {
      GmailApp.sendEmail(to, sujet, texte, {
        htmlBody: html,
        name: 'Équipe Study Plan IB',
        replyTo: EXPEDITEUR
      });
    } catch (err2) {
      cache.remove(cle);
      return reponse({ success: false, error: String(err2).slice(0, 180) });
    }
    confirmer(nonce, to);
    return reponse({ success: true, id: nonce });
  } finally {
    verrou.releaseLock();
  }
}
