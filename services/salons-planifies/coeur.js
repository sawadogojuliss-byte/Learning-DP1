'use strict';

// Logique indépendante du réseau : l'horloge, l'annuaire et le transport sont
// fournis par le service. Les liens sont des secrets : ne pas les journaliser.
const crypto = require('node:crypto');
const SITE = 'https://sawadogojuliss-byte.github.io/Learning-DP1/';
const MINUTE = 60 * 1000;
const MAX_INVITES = 20;

function erreur(code) { const e = new Error(code); e.code = code; return e; }
function echapper(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function zoneValide(zone) {
  if (typeof zone !== 'string' || zone.length > 80) return false;
  try { new Intl.DateTimeFormat('fr-FR', {timeZone:zone}).format(0); return true; } catch (_) { return false; }
}
function verifierDemande(data, maintenant) {
  if (!data || typeof data !== 'object') throw erreur('demande-invalide');
  const nom = typeof data.nom === 'string' ? data.nom.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
  if (!nom || nom.length > 60) throw erreur('nom-invalide');
  const debut = Number(data.debut);
  if (!Number.isSafeInteger(debut) || debut < maintenant + 15 * MINUTE || debut > maintenant + 30 * 24 * 60 * MINUTE) throw erreur('date-invalide');
  if (!zoneValide(data.fuseau)) throw erreur('fuseau-invalide');
  if (!Array.isArray(data.invites) || data.invites.length > MAX_INVITES || data.invites.some(x => typeof x !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(x)) || new Set(data.invites).size !== data.invites.length) throw erreur('invites-invalides');
  if (typeof data.demandeId !== 'string' || !/^[a-f0-9]{32}$/.test(data.demandeId)) throw erreur('identifiant-invalide');
  return {nom, debut, fuseau:data.fuseau, invites:data.invites.slice(), demandeId:data.demandeId};
}
function lienSalon(id) {
  if (!/^[a-f0-9]{48}$/.test(id)) throw erreur('salon-invalide');
  return SITE + '#salon=' + id;
}
function empreinte(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function rappel(salon, role) {
  if (!salon || !['organisateur','invite'].includes(role) || !zoneValide(salon.fuseau)) throw erreur('rappel-invalide');
  const lien = lienSalon(salon.id);
  const date = new Intl.DateTimeFormat('fr-FR', {timeZone:salon.fuseau, weekday:'long', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit', timeZoneName:'short'}).format(new Date(salon.debut));
  const delai = role === 'organisateur' ? '10 minutes' : '5 minutes';
  const nom = echapper(salon.nom), dateHtml = echapper(date), url = echapper(lien);
  const texte = `Bonjour,\n\nStudyplan — Ton salon commence bientôt\n\n${salon.nom}\n${date}\n\nLa séance commence dans environ ${delai}.\nRejoindre le salon : ${lien}\n\nCe lien donne accès au salon : partage-le seulement avec les personnes invitées.\nL’équipe Studyplan`;
  const html = '<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#eef7f1;color:#173b2d;font-family:Arial,Helvetica,sans-serif;">'
    + '<div style="display:none;max-height:0;overflow:hidden;">Ton moment de concentration approche.</div>'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef7f1;"><tr><td align="center" style="padding:32px 14px;">'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;">'
    + '<tr><td style="padding:34px 32px;background:#087c57;color:#ffffff;">'
    + '<p style="margin:0 0 18px;font-size:12px;font-weight:700;letter-spacing:2px;color:#c4f7dc;">STUDYPLAN · SALON FOCUS</p>'
    + '<p style="margin:0 0 10px;color:#dcfce7;font-size:15px;">Bonjour,</p>'
    + '<h1 style="margin:0;font-size:30px;line-height:1.2;">Un beau moment<br>pour avancer ensemble.</h1>'
    + '<p style="margin:14px 0 0;color:#dcfce7;font-size:16px;line-height:1.5;">Ta séance commence dans environ ' + delai + '.</p></td></tr>'
    + '<tr><td style="padding:30px 32px;"><p style="margin:0 0 8px;font-size:12px;color:#488164;font-weight:700;letter-spacing:1px;">TON RENDEZ-VOUS</p>'
    + '<h2 style="margin:0 0 12px;font-size:23px;line-height:1.3;color:#123e2e;">' + nom + '</h2>'
    + '<p style="margin:0 0 26px;font-size:16px;line-height:1.5;color:#4b6e5c;">' + dateHtml + '</p>'
    + '<a href="' + url + '" style="display:inline-block;padding:15px 22px;border-radius:12px;background:#059669;color:#fff;text-decoration:none;font-weight:700;">Rejoindre le salon &nbsp; →</a>'
    + '<p style="margin:28px 0 0;font-size:13px;line-height:1.55;color:#6b8175;">Ce lien donne accès au salon. Partage-le seulement avec les personnes invitées.</p>'
    + '</td></tr><tr><td style="padding:20px 32px;background:#f6fbf8;color:#59816c;font-size:13px;">Avec toi à chaque étape · L’équipe Studyplan</td></tr></table></td></tr></table></body></html>';
  return {subject:'Rappel de ton salon — Studyplan', text:texte, html};
}
module.exports = {SITE, MINUTE, MAX_INVITES, erreur, echapper, zoneValide, verifierDemande, lienSalon, empreinte, rappel};
