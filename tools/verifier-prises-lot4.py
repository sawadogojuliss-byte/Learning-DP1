#!/usr/bin/env python3
"""Contrôle l'intégrité des pistes à écouter, sans valider la prononciation."""
import hashlib
import json
import sys
from pathlib import Path
racine = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
dossier = racine / 'livrables/publication-voix/essai-prises-lot4'
manifest = json.loads((dossier / 'manifest.json').read_text(encoding='utf-8'))
assert [p['minutes'] for p in manifest] == [19, 17, 18, 27, 28, 29, 30, 31, 32, 33]
page = (dossier / 'index.html').read_text(encoding='utf-8')
assert page.count('<audio controls') == len(manifest)
for prise in manifest:
    nom = f"{prise['minutes']:02d}.mp3"
    data = (dossier / nom).read_bytes()
    assert len(data) > 10000 and hashlib.sha256(data).hexdigest() == prise['mp3_sha256']
    assert 'src="' + nom + '"' in page
print('OK : dix fichiers intacts ; écoute et validation nécessaires')
