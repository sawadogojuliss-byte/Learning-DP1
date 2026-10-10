/**
 * Envoi des réponses Study Plan IB. Version 2.
 * Remplace tout le code, puis Déployer > Gérer les déploiements >
 * crayon > Nouvelle version > Déployer.
 * Exécuter en tant que Moi, accès Tout le monde.
 * Connecté avec ibstudyplan@gmail.com.
 */
var SECRET = 'spib-7c4e9a2b8d1f6c3e';
var EXPEDITEUR = 'ibstudyplan@gmail.com';
var SUJET = 'Réponse à ta question — Study Plan IB';

function reponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return reponse({ success: false, service: 'study-plan-ib', version: 2 });
}

function doPost(e) {
  var data = {};
  try {
    data = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
  } catch (err) {
    data = {};
  }
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
  try {
    GmailApp.sendEmail(to, SUJET, texte, {
      htmlBody: html,
      name: 'Équipe Study Plan IB',
      replyTo: EXPEDITEUR
    });
  } catch (err) {
    return reponse({ success: false, error: String(err).slice(0, 180) });
  }
  return reponse({ success: true, id: nonce });
}
