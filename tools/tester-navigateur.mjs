import { chromium } from 'playwright';

const SCRIPT = 'https://script.google.com/macros/s/AKfycbxhDi6E6ebNBrkAaKNIVXSeySUT6p1H7kG5X8l85FVArw8Yv5uRuOsWrdEFMYXzxxSDQA/exec';
const SECRET = 'spib-7c4e9a2b8d1f6c3e';
const SUJET = 'Réponse à ta question — Study Plan IB';
const SITE = 'https://sawadogojuliss-byte.github.io/Learning-DP1/';
const MARQUE = 'NAVIGATEUR-' + Date.now();

async function json(url, options) {
  const res = await fetch(url, options);
  const texte = await res.text();
  return { status: res.status, texte };
}

async function boite() {
  const domaines = await json('https://api.mail.tm/domains');
  const domaine = JSON.parse(domaines.texte)['hydra:member'][0].domain;
  const adresse = 'nav' + Date.now() + '@' + domaine;
  const secret = 'Verification-' + Date.now();
  await json('https://api.mail.tm/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: adresse, password: secret })
  });
  const jeton = await json('https://api.mail.tm/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: adresse, password: secret })
  });
  return { adresse, jeton: JSON.parse(jeton.texte).token };
}

async function derniers() {
  const res = await json('https://ntfy.sh/ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b/json?poll=1&since=all');
  const utiles = [];
  for (const ligne of res.texte.split('\n')) {
    if (!ligne.trim()) continue;
    let enveloppe;
    try { enveloppe = JSON.parse(ligne); } catch (e) { continue; }
    let item;
    try { item = JSON.parse(enveloppe.message || ''); } catch (e) { continue; }
    if (!item || !['question', 'reponse'].includes(item.type)) continue;
    utiles.push(item);
  }
  return utiles.slice(-8).map(function (item) {
    return {
      type: item.type,
      at: item.at,
      email: item.email || item.google || '',
      destinataire: item.destinataire || '',
      mail: item.mail || false,
      gmailId: item.gmailId || '',
      texte: String(item.texte || '').slice(0, 60)
    };
  });
}

async function attendre(jeton) {
  const fin = Date.now() + 80000;
  while (Date.now() < fin) {
    await new Promise(function (r) { setTimeout(r, 6000); });
    const liste = await json('https://api.mail.tm/messages', { headers: { Authorization: 'Bearer ' + jeton } });
    const membres = JSON.parse(liste.texte)['hydra:member'] || [];
    console.log('messages', membres.length);
    for (const item of membres) {
      const detail = await json('https://api.mail.tm/messages/' + item.id, { headers: { Authorization: 'Bearer ' + jeton } });
      const data = JSON.parse(detail.texte);
      const html = Array.isArray(data.html) ? data.html.join('\n') : (data.html || '');
      const tout = [data.subject, data.text, html].join('\n');
      if (!tout.includes(MARQUE)) {
        console.log('sujet', item.subject);
        continue;
      }
      console.log('from', JSON.stringify(data.from));
      console.log('livre_navigateur');
      return true;
    }
  }
  return false;
}

async function main() {
  console.log('retours', JSON.stringify(await derniers(), null, 0));
  const eleve = await boite();
  console.log('eleve', eleve.adresse);
  const nonce = 'nav' + Date.now() + 'abcdef';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const resultat = await page.evaluate(async function (args) {
    try {
      const res = await fetch(args.script, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(args.payload)
      });
      return { ok: res.ok, status: res.status, texte: (await res.text()).slice(0, 400) };
    } catch (e) {
      return { erreur: String(e && e.message || e) };
    }
  }, {
    script: SCRIPT,
    payload: {
      secret: SECRET,
      nonce: nonce,
      to: eleve.adresse,
      replyTo: 'ibstudyplan@gmail.com',
      subject: SUJET,
      text: "Bonjour,\n\n" + MARQUE + "\n\nÀ bientôt,\nL'équipe Study Plan IB",
      html: '<p>Bonjour,</p><p>' + MARQUE + '</p><p>L\'équipe Study Plan IB</p>'
    }
  });
  console.log('navigateur', JSON.stringify(resultat));
  await browser.close();
  if (!resultat.texte || !resultat.texte.includes(nonce)) {
    throw new Error('reponse_navigateur_inutilisable');
  }
  if (!(await attendre(eleve.jeton))) throw new Error('pas_livre_navigateur');
}

main().catch(function (e) {
  console.error(e && e.stack || e);
  process.exit(1);
});
