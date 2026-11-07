#!/usr/bin/env python3
"""Assemble le chalet et la présentation Exercices sur la version publique, sans fusion.

Usage : python3 tools/preparer-publication-pages.py BASE SORTIE VERSION
BASE est un export du commit public validé par le workflow. SORTIE ne doit pas
exister. La liste explicite empêche d'inclure les autres travaux de la branche.
"""
import hashlib
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if len(sys.argv) != 4:
    raise SystemExit(__doc__)
base, output = map(lambda value: Path(value).resolve(), sys.argv[1:3])
version = sys.argv[3]
if not re.fullmatch(r'[A-Za-z0-9-]+', version):
    raise SystemExit('Version de cache invalide')
if not base.is_dir() or output.exists():
    raise SystemExit('La base doit exister et la sortie ne doit pas exister')

# Refuser de remplacer silencieusement un script Pomodoro public qui aurait
# évolué depuis la base utilisée pour préparer et tester cette publication.
expected = 'fa04e6c'
script = base / 'js/pages/pomodoro-page.js'
import subprocess
actual = subprocess.check_output(['git', 'hash-object', str(script)], text=True).strip()
if not actual.startswith(expected):
    raise SystemExit('Le Pomodoro public a changé : réconcilier avant publication')
shutil.copytree(base, output)

files = [
    'js/pages/pomodoro-page.js',
    'images/pomodoro/chalet-neige-anime.mp4',
    'images/pomodoro/chalet-neige-anime.webp',
    'images/pomodoro/mini/chalet-neige-anime.webp',
]
for rel in files:
    dest = output / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / rel, dest)

css = (ROOT / 'css/pages/planning-panels.css').read_text(encoding='utf-8')
match = re.search(r'/\* Le décor statique reste sous la vidéo.*?\.focus-fond-video\.is-visible \{ visibility: visible; \}\n', css, flags=re.S)
if not match:
    raise SystemExit('Style vidéo introuvable')
path = output / 'css/pages/planning-panels.css'
text = path.read_text(encoding='utf-8')
anchor = '\n.focus-shade {\n'
if text.count(anchor) != 1 or '.focus-fond-video' in text:
    raise SystemExit('Feuille publique inattendue')
path.write_text(text.replace(anchor, match.group(0) + anchor, 1), encoding='utf-8')

# La page et sa feuille dédiées utilisent le JS public inchangé. En particulier,
# ne pas copier les versions de travail de pages/ ou js/pages/exercices.js.
shutil.copy2(ROOT / 'livrables/publication-exercices/exercices.html', output / 'pages/exercices.html')
shutil.copy2(ROOT / 'livrables/publication-exercices/exercices-design.css', output / 'css/pages/exercices-design.css')

# Une version de cache propre évite de servir les anciens scripts après mise en ligne.
for rel in ('index.html', 'js/boot.js', 'service-worker.js'):
    path = output / rel
    text = path.read_text(encoding='utf-8')
    if '20261104az' not in text:
        raise SystemExit('Version publique inattendue dans ' + rel)
    text = text.replace('20261104az', version)
    if rel == 'index.html':
        anchor = '    <link rel="stylesheet" href="css/pages/planning-panels.css?v=' + version + '">'
        if text.count(anchor) != 1:
            raise SystemExit('Chargement des styles public inattendu')
        text = text.replace(anchor, anchor + '\n    <link rel="stylesheet" href="css/pages/exercices-design.css?v=' + version + '">', 1)
    if rel == 'service-worker.js':
        anchor = '    "css/pages/planning-panels.css",'
        if text.count(anchor) != 1:
            raise SystemExit('Liste hors-ligne publique inattendue')
        text = text.replace(anchor, anchor + '\n    "css/pages/exercices-design.css",', 1)
        old = "        url.pathname.includes('/audio/')) return;"
        new = "        url.pathname.includes('/audio/') ||\n        url.pathname.endsWith('/images/pomodoro/chalet-neige-anime.mp4')) return;"
        if text.count(old) != 1:
            raise SystemExit('Service worker public inattendu')
        text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')

# Vérification finale : aucun autre fichier existant n'a changé.
allowed = set(files + ['pages/exercices.html', 'css/pages/exercices-design.css', 'css/pages/planning-panels.css', 'index.html', 'js/boot.js', 'service-worker.js'])
for path in base.rglob('*'):
    if not path.is_file():
        continue
    rel = path.relative_to(base).as_posix()
    other = output / rel
    if not other.is_file():
        raise SystemExit('Fichier public perdu : ' + rel)
    if rel not in allowed and hashlib.sha256(path.read_bytes()).digest() != hashlib.sha256(other.read_bytes()).digest():
        raise SystemExit('Fichier public modifié hors périmètre : ' + rel)
print('Publication préparée : chalet et présentation Exercices ; autres fichiers publics inchangés.')
