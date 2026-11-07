#!/usr/bin/env python3
"""Assemble les changements ciblés sur la version publique, sans fusion.

Usage : python3 tools/preparer-publication-pages.py BASE SORTIE VERSION
BASE est un export du commit public validé par le workflow. SORTIE ne doit pas
exister. La liste explicite empêche d'inclure les autres travaux de la branche.
"""
import hashlib
import json
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
    'js/pages/pomodoro-parametres.js',
    'images/pomodoro/chalet-neige-anime.mp4',
    'images/pomodoro/chalet-neige-anime.webp',
    'images/pomodoro/mini/chalet-neige-anime.webp',
]
# Liste explicite issue de l'inventaire du dossier Drive ; images et vignettes
# locales, sans dépendre de permissions Drive ou charger les originaux lourds.
images = json.loads((ROOT / 'livrables/publication-themes/images.json').read_text(encoding='utf-8'))
if len(images) != 29 or len({image['id'] for image in images}) != len(images):
    raise SystemExit('Inventaire des thèmes inattendu')
for image in images:
    identifiant = image['id']
    if not re.fullmatch(r'drive-[a-z0-9-]+', identifiant):
        raise SystemExit('Identifiant de thème invalide')
    files.extend([f'images/pomodoro/{identifiant}.webp', f'images/pomodoro/mini/{identifiant}.webp'])
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

# La page et sa feuille sont dédiées à la publication. Ne pas copier la version
# de travail distincte de pages/ ou js/pages/exercices.js.
shutil.copy2(ROOT / 'livrables/publication-exercices/exercices.html', output / 'pages/exercices.html')
shutil.copy2(ROOT / 'livrables/publication-exercices/exercices-design.css', output / 'css/pages/exercices-design.css')
shutil.copy2(ROOT / 'livrables/publication-legende/legende.html', output / 'pages/legende.html')
shutil.copy2(ROOT / 'livrables/publication-legende/defilement.css', output / 'css/pages/defilement.css')

# Modification strictement visuelle du rendu des créneaux du script public.
# Les index originaux, le moteur, la validation et les données restent inchangés.
path = output / 'js/pages/exercices.js'
text = path.read_text(encoding='utf-8')
def remplacer_unique(ancien, nouveau):
    global text
    if text.count(ancien) != 1:
        raise SystemExit('Rendu Exercices public inattendu : arrêt avant publication')
    text = text.replace(ancien, nouveau, 1)

helper = (ROOT / 'livrables/publication-exercices/planification-design.js').read_text(encoding='utf-8')
remplacer_unique('function renderPlanifier() {', helper + '\nfunction renderPlanifier() {')
remplacer_unique('        const slots = findAvailableSlots(exo);', '''        const slots = findAvailableSlots(exo);
        const dejaPlanifie = exo.scheduledSlot && !(typeof customEvents !== 'undefined' && customEvents.some(e => e && e.exoId === exo.id && !e.date));
        const alternatives = slots.map((slot, index) => ({slot, index})).filter(entry => !dejaPlanifie || entry.slot.label !== exo.scheduledSlot);''')
remplacer_unique('''            '<p style="font-size:0.8rem;font-weight:600;color:#374151;margin-bottom:0.625rem;">Créneaux disponibles :</p>';

        if (slots.length === 0) {''', '''            '';
        if (dejaPlanifie) html += exoCartePlanifiee(exo.scheduledSlot);
        html += '<p class="ed-slots-heading">' + (dejaPlanifie ? 'Autres créneaux disponibles' : 'Créneaux disponibles') + '</p>';

        if (alternatives.length === 0 && dejaPlanifie) {
            html += '<p class="ed-no-alternative">Aucun autre créneau complet disponible pour le moment.</p>';
        } else if (alternatives.length === 0) {''')
remplacer_unique('if (slots.some(s => s.parts.length > 1)) {', 'if (alternatives.some(entry => entry.slot.parts.length > 1)) {')
remplacer_unique('''                html += '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:0.75rem;padding:0.625rem 0.875rem;margin-bottom:0.625rem;font-size:0.78rem;color:#92400e;">✂️ Durée complète répartie sur plusieurs créneaux, avant la date limite.</div>';''', '''                html += '<p class="ed-slot-note">La durée est répartie sur plusieurs séances, avant la date limite.</p>';''')
remplacer_unique('''            html += '<div style="display:flex;flex-direction:column;gap:0.5rem;">' +
                slots.map((slot, si) =>
                    '<button type="button" data-exo-action="creneau" data-exo-id="' + exoEscape(exo.id) + '" data-exo-slot="' + si + '" data-exo-date="' + exoEscape(slot.dateKey) + '" data-exo-time="' + exoEscape(slot.startTime) + '" class="slot-chip" style="text-align:left;min-height:44px;">✅ ' + exoEscape(slot.label) + '</button>'
                ).join('') + '</div>';
        }
        if (exo.scheduledSlot && !(typeof customEvents !== 'undefined' && customEvents.some(e => e && e.exoId === exo.id && !e.date))) {
            html += '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:0.75rem;padding:0.625rem 0.875rem;margin-top:0.75rem;font-size:0.8rem;color:#059669;font-weight:600;">✓ Planifié : ' + exoEscape(exo.scheduledSlot) + '</div>';
        }''', '''            html += '<div class="ed-slot-options">' +
                alternatives.map((entry, i) => exoCarteProposition(entry.slot, entry.index, exo.id, i + 1)).join('') + '</div>';
        }''')
path.write_text(text, encoding='utf-8')

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
        anchor = '    <link rel="stylesheet" href="css/accessibilite.css?v=' + version + '">'
        if text.count(anchor) != 1:
            raise SystemExit('Styles d’accessibilité publics inattendus')
        text = text.replace(anchor, anchor + '\n    <link rel="stylesheet" href="css/pages/defilement.css?v=' + version + '">', 1)
    if rel == 'service-worker.js':
        anchor = '    "css/pages/planning-panels.css",'
        if text.count(anchor) != 1:
            raise SystemExit('Liste hors-ligne publique inattendue')
        text = text.replace(anchor, anchor + '\n    "css/pages/exercices-design.css",\n    "css/pages/defilement.css",', 1)
        old = "        url.pathname.includes('/audio/')) return;"
        new = "        url.pathname.includes('/audio/') ||\n        url.pathname.endsWith('/images/pomodoro/chalet-neige-anime.mp4')) return;"
        if text.count(old) != 1:
            raise SystemExit('Service worker public inattendu')
        text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')

# Vérification finale : aucun autre fichier existant n'a changé.
allowed = set(files + ['pages/exercices.html', 'pages/legende.html', 'js/pages/exercices.js', 'css/pages/exercices-design.css', 'css/pages/defilement.css', 'css/pages/planning-panels.css', 'index.html', 'js/boot.js', 'service-worker.js'])
for path in base.rglob('*'):
    if not path.is_file():
        continue
    rel = path.relative_to(base).as_posix()
    other = output / rel
    if not other.is_file():
        raise SystemExit('Fichier public perdu : ' + rel)
    if rel not in allowed and hashlib.sha256(path.read_bytes()).digest() != hashlib.sha256(other.read_bytes()).digest():
        raise SystemExit('Fichier public modifié hors périmètre : ' + rel)
print('Publication préparée : chalet, thèmes, Exercices, légende et défilement ; autres fichiers publics inchangés.')
