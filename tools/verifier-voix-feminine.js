#!/usr/bin/env node
/* Vérifie la conservation des enregistrements et des copies utilisées sur le site. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const archive = path.join(root, 'livrables/voix-feminine-en-cours');
const publicDir = path.join(root, 'livrables/publication-voix/essai-feminine');
const manifest = JSON.parse(fs.readFileSync(path.join(archive, 'manifest.json'), 'utf8'));
function sha(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function must(condition, message) { if (!condition) throw new Error(message); }
for (let n = 1; n <= 60; n++) {
  const nom = String(n).padStart(2, '0');
  for (const file of [path.join(publicDir, nom + '.mp3'), path.join(publicDir, 'harmonise', nom + '.mp3')])
    must(fs.statSync(file).size > 5000, 'prise absente ou tronquée : ' + file);
  if (n >= 18) {
    must(manifest[nom], 'entrée manquante : ' + nom);
    for (const [folder, key, cible] of [
      ['original', 'source_sha256', path.join(publicDir, nom + '.mp3')],
      ['harmonise', 'sortie_sha256', path.join(publicDir, 'harmonise', nom + '.mp3')]
    ]) {
      must(sha(path.join(archive, folder, nom + '.mp3')) === manifest[nom][key], 'archive modifiée : ' + nom + '/' + folder);
      must(sha(cible) === manifest[nom][key], 'copie destinée au site modifiée : ' + nom + '/' + folder);
    }
  }
}
must(Object.keys(manifest).length === 43, 'inventaire des durées 18 à 60 inattendu');
for (const file of ['16-nouvelle.mp3', 'harmonise/16-nouvelle.mp3'])
  must(fs.statSync(path.join(publicDir, file)).size > 5000, 'nouvelle prise de 16 minutes manquante : ' + file);
must(sha(path.join(publicDir, 'harmonise/16-nouvelle.mp3')) !== sha(path.join(publicDir, 'harmonise/16.mp3')), 'la nouvelle prise de 16 minutes doit différer de la précédente');
for (const name of ['fin-une', 'fin-plusieurs', 'reprise'])
  must(fs.statSync(path.join(publicDir, 'harmonise', name + '.mp3')).size > 5000, 'message manquant : ' + name);
console.log('OK : 60 pauses féminines, messages et conservation des 43 nouvelles prises');
