/**
 * Envoi des réponses Study Plan IB. Version 3.
 * Remplace tout le code.
 * Déployer > Gérer les déploiements > crayon > Nouvelle version > Déployer.
 * Ne crée pas un nouveau déploiement. L'adresse /exec doit rester la même.
 * Exécuter en tant que Moi, accès Tout le monde.
 * Compte : ibstudyplan@gmail.com.
 */
var SECRET = 'spib-7c4e9a2b8d1f6c3e';
var EXPEDITEUR = 'ibstudyplan@gmail.com';
var SUJET = 'Réponse à ta question — Study Plan IB';
var FIL = 'ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b';

function reponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function lire(e) {
  var brut = '';
  if (e && e.parameter && e.parameter.payload) brut = e.parameter.payload;
  else if (e && e.postData && e.postData.contents) brut = e.postData.contents;
  try {
    return JSON.parse(brut);
  } catch (err) {
    return {};
  }
}

function confirmer(nonce, to) {
  try {
    UrlFetchApp.fetch('https://ntfy.sh/' + FIL, {
      method: 'post',
      contentType: 'text/plain; charset=utf-8',
      headers: { Title: 'mail-ok', Priority: 'min' },
      payload: JSON.stringify({
        type: 'mail-ok',
        nonce: nonce,
        to: to,
        at: new Date().toISOString()
      }),
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return reponse({ success: false, error: 'email' });
  if (String(data.subject || '') !== SUJET) return reponse({ success: false, error: 'sujet' });
  var texte = String(data.text || '').slice(0, 4000);
  var html = String(data.html || '').slice(0, 80000);
  if (texte.indexOf("L'équipe Study Plan IB") === -1) return reponse({ success: false, error: 'texte' });
  if (html.indexOf("L'équipe Study Plan IB") === -1) return reponse({ success: false, error: 'html' });
  if (/formsubmit|someone just submitted your form/i.test(html)) return reponse({ success: false, error: 'modele' });
  var verrou = LockService.getScriptLock();
  verrou.waitLock(20000);
  try {
    var cache = CacheService.getScriptCache();
    var cle = 'm' + nonce;
    if (cache.get(cle)) {
      confirmer(nonce, to);
      return reponse({ success: true, id: nonce });
    }
    cache.put(cle, '1', 21600);
    try {
      GmailApp.sendEmail(to, SUJET, texte, {
        htmlBody: html,
        name: 'Équipe Study Plan IB',
        replyTo: EXPEDITEUR
      });
    } catch (err) {
      cache.remove(cle);
      return reponse({ success: false, error: String(err).slice(0, 180) });
    }
    confirmer(nonce, to);
    return reponse({ success: true, id: nonce });
  } finally {
    verrou.releaseLock();
  }
}
