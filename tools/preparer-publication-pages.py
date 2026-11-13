#!/usr/bin/env python3
"""Assemble les changements ciblés sur la version publique, sans fusion.

Usage : python3 tools/preparer-publication-pages.py BASE SORTIE VERSION
BASE est un export du commit public validé par le workflow. SORTIE ne doit pas
exister. La liste explicite empêche d'inclure les autres travaux de la branche.
"""
import hashlib
import json
import os
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
boite_actual = subprocess.check_output(['git', 'hash-object', str(base / 'js/pages/boite.js')], text=True).strip()
if not boite_actual.startswith('d5ad249'):
    raise SystemExit('La boîte publique a changé : réconcilier avant publication')
for rel, expected_hash in {
    'js/pages/planning-interface.js': '91dcc0a4eafa879ec119363ba35d7c455f444fe4',
    'pages/planning.html': '5d479c0b95d409c573ecc3ebbfa38058e44e3a77',
    'pages/devoirs.html': '71e0fa0c1f9cf5ea3ccf10586d06a12af818f5a6',
    'js/pages/devoirs.js': 'cf3824b3b0ff7d7bdd77580bffeb93366f4563f2',
    'js/accessibilite.js': '26665dd3d801395941440d417377896a24eaf1a9',
    'js/pages/chrono-voix.js': '97854c5a6e81d2e1056632af72afbc6d154f6798',
    'css/pages/focus-parametres.css': '0c9093c628fa9760c16a4e8ea7c205b2a50f3795',
    'js/synchro.js': 'b872031f3b925ac4961b97fa6993506023f121a6',
    'js/compte.js': '3978b067fe612c92a6a35e4266abc31cf86c9892',
    'js/memoire.js': 'c6bff3e8fbb064baea991b35bc61783634d67439',
    'js/pages/statistiques.js': '10aa882d785ec3527767ad1a80a23efa4bfc6ef9',
    'js/pages/onboarding-classe.js': 'ba748e565e99d44f79c3424f3250f9b242179138',
}.items():
    found = subprocess.check_output(['git', 'hash-object', str(base / rel)], text=True).strip()
    if found != expected_hash:
        raise SystemExit('Base publique modifiée : réconcilier ' + rel)
shutil.copytree(base, output)

files = [
    'livrables/propositions-pomodoro/index.html',
    'livrables/publication-voix/vingte-une-minute-essai.mp3',
    'livrables/publication-voix/essai-annonce-masculine.mp3',
    'livrables/publication-voix/essai-debit.html',
    'livrables/publication-voix/essai-fluide-5-minutes.mp3',
    'livrables/publication-voix/fin-serie-essai.mp3',
    'livrables/publication-voix/essai-prononciation-claire-5.mp3',
    'livrables/publication-voix/essai-backend/index.html',
    'livrables/publication-voix/essai-prises-continues/index.html',
    'livrables/publication-voix/essai-prises-continues/manifest.json',
    'livrables/publication-voix/essai-prises-lot2/index.html',
    'livrables/publication-voix/essai-prises-lot2/manifest.json',
    'livrables/publication-voix/essai-prises-lot3/index.html',
    'livrables/publication-voix/essai-prises-lot3/manifest.json',
    'livrables/publication-voix/essai-prises-lot4/index.html',
    'livrables/publication-voix/essai-prises-lot4/manifest.json',
    'livrables/publication-voix/essai-prises-lot5/index.html',
    'livrables/publication-voix/essai-prises-lot5/manifest.json',
    'livrables/publication-voix/essai-prises-lot6/index.html',
    'livrables/publication-voix/essai-prises-lot6/manifest.json',
    'livrables/publication-voix/essai-prises-lot7/index.html',
    'livrables/publication-voix/essai-prises-lot7/manifest.json',
    'livrables/publication-voix/essai-prises-lot8/index.html',
    'livrables/publication-voix/essai-prises-lot8/manifest.json',
    'livrables/publication-voix/essai-prises-lot9/index.html',
    'livrables/publication-voix/essai-prises-lot9/manifest.json',
    'livrables/publication-voix/essai-traitement/index.html',
    'livrables/stock-voix/durees/21-minutes-approuve.mp3',
    'livrables/stock-voix/messages/annonce-debut.wav',
    'livrables/stock-voix/messages/annonce-de-pause.wav',
    'livrables/stock-voix/messages/reprise-proposition.wav',
    'livrables/stock-voix/messages/fin-serie.wav',
    'js/pages/chrono-voix.js',
    'css/pages/focus-parametres.css',
    'js/synchro.js',
    'js/compte.js',
    'js/memoire.js',
    'js/pages/statistiques.js',
    'js/pages/onboarding-classe.js',
    'livrables/publication-pomodoro/videos.css',
    'livrables/publication-pomodoro/mobile.css',
    'livrables/publication-pomodoro/reprise.css',
    'livrables/publication-retours/images.css',
    'js/pages/boite.js',
    'livrables/publication-rappels/rappels.js',
    'livrables/publication-rappels/rappels.css',
    'livrables/publication-planning/planning-design.css',
    'livrables/publication-devoirs/devoirs-design.css',
    'js/pages/pomodoro-page.js',
    'js/pages/minuteur-compteurs.js',
    'pages/seances.html',
    'pages/ee-ia.html',
    'js/pages/onboarding-travaux.js',
    'livrables/publication-eeia/design.css',
    'tools/verifier-pomodoro.js',
    'js/pages/pomodoro-parametres.js',
    'js/pages/salon-focus-coeur.js',
    'js/pages/salon-focus-firebase.js',
    'js/pages/salon-focus.js',
    'css/pages/salon-focus.css',
    'js/pages/musique.js',
    'videos/arbres-au-bord-de-leau-assemblage.mp4',
    'images/pomodoro/chalet-neige-anime.mp4',
    'images/pomodoro/chalet-neige-anime.webp',
    'images/pomodoro/mini/chalet-neige-anime.webp',
    'images/pomodoro/dunes-lagunes-anime.mp4',
    'images/pomodoro/dunes-lagunes-anime.webp',
    'images/pomodoro/mini/dunes-lagunes-anime.webp',
    'images/pomodoro/pluie-palmes-anime.mp4',
    'images/pomodoro/pluie-palmes-anime.webp',
    'images/pomodoro/mini/pluie-palmes-anime.webp',
    'images/pomodoro/foret-automne-anime.mp4',
    'images/pomodoro/foret-automne-anime-4k.mp4',
    'images/pomodoro/foret-automne-anime-leger.mp4',
    'images/pomodoro/foret-automne-anime.webp',
    'images/pomodoro/mini/foret-automne-anime.webp',
    'images/pomodoro/arbres-rivage-anime.mp4',
    'images/pomodoro/arbres-rivage-anime.webp',
    'images/pomodoro/mini/arbres-rivage-anime.webp',
]
# Échantillons servis par le backend en local, publiés uniquement pour écoute.
files.extend(f'livrables/publication-voix/essai-backend/{message}-{debit}.mp3'
             for message in ('fin-serie', 'pause-05', 'pause-21')
             for debit in ('lent', 'normal', 'rapide'))

files.extend(f'livrables/publication-voix/essai-prises-continues/{n:02d}.mp3'
             for n in (1, 2, 3, 4, 6, 10, 15, 16, 19, 21))
files.extend(f'livrables/publication-voix/essai-prises-lot2/{n:02d}.mp3'
             for n in (6, 7, 8, 9, 11, 12, 13, 14, 16, 19))
files.extend(f'livrables/publication-voix/essai-prises-lot3/{n:02d}.mp3'
             for n in (14, 17, 18, 19, 20, 22, 23, 24, 25, 26))
files.extend(f'livrables/publication-voix/essai-prises-lot4/{n:02d}.mp3'
             for n in (17, 18, 19, 27, 28, 29, 30, 31, 32, 33))
files.extend(f'livrables/publication-voix/essai-prises-lot5/{n:02d}.mp3'
             for n in (14, 17, 18, 19, 31, 20, 22, 23, 24, 25))
files.extend(f'livrables/publication-voix/essai-prises-lot6/{n:02d}.mp3'
             for n in (17, 18, 19, 31))
files.extend(f'livrables/publication-voix/essai-prises-lot7/{n:02d}.mp3'
             for n in (26, 34, 35, 36, 37, 38, 39, 40, 41, 42))
files.extend(f'livrables/publication-voix/essai-prises-lot8/{n:02d}.mp3'
             for n in range(43, 53))
files.extend(f'livrables/publication-voix/essai-prises-lot9/{n:02d}.mp3'
             for n in range(53, 61))

# Voix masculine choisie : durées enregistrées en entier, sans assemblage de nombres.
files.extend(f'livrables/stock-voix/durees/{n:02d}-minutes.wav' for n in range(1, 50))
files.extend(f'livrables/publication-voix/essai-{n:02d}-minutes.mp3' for n in range(50, 61))

# Liste explicite issue de l'inventaire du dossier Drive ; images et vignettes
# locales, sans dépendre de permissions Drive ou charger les originaux lourds.
images = json.loads((ROOT / 'livrables/publication-themes/images.json').read_text(encoding='utf-8'))
if len(images) != 28 or len({image['id'] for image in images}) != len(images):
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

# Moteur de traitement vocal à la construction : une phrase complète par
# durée est calculée à partir des prises existantes. Ces essais ne remplacent
# pas encore les annonces du minuteur avant leur validation à l'écoute.
subprocess.run([sys.executable, str(ROOT / 'tools/preparer-annonces-fluides.py'),
    '--ffmpeg', os.environ.get('STUDY_FFMPEG', 'ffmpeg'),
    '--sortie', str(output / 'livrables/publication-voix/essai-traitement'),
    *map(str, range(1, 61))], check=True)

css = (ROOT / 'css/pages/planning-panels.css').read_text(encoding='utf-8')
match = re.search(r'/\* Le décor statique reste sous la vidéo.*?\.focus-fond-video\.is-visible \{ visibility: visible; \}\n', css, flags=re.S)
if not match:
    raise SystemExit('Style vidéo introuvable')
path = output / 'css/pages/planning-panels.css'
text = path.read_text(encoding='utf-8')
anchor = '\n.focus-shade {\n'
if text.count(anchor) != 1 or '.focus-fond-video' in text:
    raise SystemExit('Feuille publique inattendue')
styles_seances = css[css.index('/* Une arrivée immobile :'): ]
# La translation du panneau révélait le planning sous toutes les pages.
ancien_mouvement = '    animation:slideInRight 0.3s ease-out;'
if text.count(ancien_mouvement) != 1:
    raise SystemExit('Animation publique des panneaux inattendue')
text = text.replace(ancien_mouvement, '    animation:none;', 1)
path.write_text(text.replace(anchor, match.group(0) + anchor, 1) + '\n' + styles_seances, encoding='utf-8')

# La page et sa feuille sont dédiées à la publication. Ne pas copier la version
# de travail distincte de pages/ ou js/pages/exercices.js.
# Overlays isolés : pas les travaux de planning encore en cours dans le checkout.
# Les dialogues créés sous body doivent recevoir le focus avant le grand
# dialogue du planning. Le gestionnaire partagé ne suit pas leurs attributs.
path = output / 'js/accessibilite.js'
# Inclure la prise en charge clavier de la fenêtre de reprise, puis conserver
# l'adaptation des dialogues propre au site publié.
text = (ROOT / 'js/accessibilite.js').read_text(encoding='utf-8')
ancien = "            m.addedNodes.forEach(function (noeud) { if (noeud.nodeType === 1) { traiter(noeud); lireSource(noeud); changer = true; } });"
nouveau = """            m.addedNodes.forEach(function (noeud) {
                if (noeud.nodeType !== 1) return;
                traiter(noeud); lireSource(noeud); changer = true;
                [noeud].concat(Array.from(noeud.querySelectorAll('[role=\"dialog\"]'))).forEach(function (el) {
                    if (el.matches('[role=\"dialog\"]') && dialogVisible(el)) ordreOuverture.set(el, ++prochainOrdre);
                });
            });"""
if text.count(ancien) != 1:
    raise SystemExit('Gestion des dialogues publique inattendue')
path.write_text(text.replace(ancien, nouveau, 1), encoding='utf-8')

# La pause démarre toujours ; ce réglage concerne la reprise en minuteur libre.
path = output / 'pages/pomodoro.html'
text = path.read_text(encoding='utf-8')
# Salon focus : insérer les seuls fragments ciblés de la page de travail,
# sans remplacer le reste du Pomodoro public.
source_salon = (ROOT / 'pages/pomodoro.html').read_text(encoding='utf-8')
menu_debut = source_salon.index('                    <li><button type="button" class="focus-tiroir-item" data-onglet="salon"')
menu_fin = source_salon.index('\n', menu_debut) + 1
page_debut = source_salon.index('                <section class="focus-tiroir-page salon-focus"')
page_fin = source_salon.index('                </section>\n', page_debut) + len('                </section>\n')
ecran_debut = source_salon.index('        <button type="button" id="salonRaccourci"')
ecran_fin = source_salon.index('        <div id="focusFonds"', ecran_debut)
for anchor, ajout in [
    ('                    <li><button type="button" class="focus-tiroir-item" data-onglet="statistiques"', source_salon[menu_debut:menu_fin]),
    ('                <section class="focus-tiroir-page" data-page="themes" hidden>', source_salon[page_debut:page_fin]),
    ('        <div id="focusFonds" class="focus-fonds" hidden></div>', source_salon[ecran_debut:ecran_fin]),
]:
    if text.count(anchor) != 1:
        raise SystemExit('Emplacement Salon focus public inattendu')
    text = text.replace(anchor, ajout + anchor, 1)
ancien_stats = 'Tes minuteurs terminés, enregistrés sur cet appareil.'
if text.count(ancien_stats) != 1:
    raise SystemExit('Texte des statistiques public inattendu')
text = text.replace(ancien_stats, 'Tes statistiques suivent ton compte sur tes appareils connectés.', 1)
ancien = 'Lancer automatiquement la phase suivante <em>(concentration puis pauses)</em>'
nouveau = 'Lancer automatiquement la concentration après une pause manuelle'
if text.count(ancien) != 1:
    raise SystemExit('Réglage Pomodoro public inattendu')
text = text.replace(ancien, nouveau, 1)
ancre_themes = '                        <div id="focusThemesCorps"></div>\n                    </div>\n                </section>'
if text.count(ancre_themes) != 1:
    raise SystemExit('Emplacement des thèmes personnel public inattendu')
text = text.replace(ancre_themes, '                        <div id="focusThemesCorps"></div>\n                    </div>\n' + (ROOT / 'livrables/publication-pomodoro/theme-personnel.html').read_text(encoding='utf-8') + '                </section>', 1)
ancre_citation = '                        <label class="focus-interrupteur focus-citation-bouton">'
if text.count(ancre_citation) != 1:
    raise SystemExit('Réglage de citation public inattendu')
text = text.replace(ancre_citation, (ROOT / 'livrables/publication-pomodoro/citation-personnelle.html').read_text(encoding='utf-8') + ancre_citation, 1)
ancre_voix = '                        <label for="focusVoixVolume">Volume de la voix</label>'
if text.count(ancre_voix) != 1:
    raise SystemExit('Réglage vocal public inattendu')
text = text.replace(ancre_voix, (ROOT / 'livrables/publication-voix/choix.html').read_text(encoding='utf-8') + ancre_voix, 1)
for identifiant in ('focusDureeShort', 'focusDureeLong'):
    ancien_input = 'id="' + identifiant + '" type="number" min="1" max="60"'
    if text.count(ancien_input) != 1:
        raise SystemExit('Champ de durée public inattendu : ' + identifiant)
    text = text.replace(ancien_input, ancien_input + ' oninput="chronoPreparerDureeSaisie(this)"', 1)
ancre_reprise = '        <p id="focusModeStatut" class="focus-sr" role="status" aria-live="polite"></p>'
if text.count(ancre_reprise) != 1:
    raise SystemExit('Emplacement de reprise public inattendu')
text = text.replace(ancre_reprise, (ROOT / 'livrables/publication-pomodoro/reprise.html').read_text(encoding='utf-8') + ancre_reprise, 1)
path.write_text(text, encoding='utf-8')

shutil.copy2(ROOT / 'livrables/publication-devoirs/devoirs.html', output / 'pages/devoirs.html')
shutil.copy2(ROOT / 'livrables/publication-planning/planning-interface.js', output / 'js/pages/planning-interface.js')
path = output / 'pages/planning.html'
text = path.read_text(encoding='utf-8')
start = text.index('        <div id="editEventModal"')
end = text.index('    </div><!-- fin planningModal -->', start)
text = text[:start] + (ROOT / 'livrables/publication-planning/edition.html').read_text(encoding='utf-8') + '\n' + text[end:]
path.write_text(text, encoding='utf-8')
path = output / 'js/pages/devoirs.js'
text = path.read_text(encoding='utf-8')
anchor_devoirs = "        if (bouton) {\n            bouton.style.background = g === genre"
if text.count(anchor_devoirs) != 1:
    raise SystemExit('Onglets Devoirs publics inattendus')
text = text.replace(anchor_devoirs, "        if (bouton) {\n            bouton.setAttribute('aria-selected', g === genre ? 'true' : 'false');\n            bouton.style.background = g === genre", 1)
path.write_text(text, encoding='utf-8')

shutil.copy2(ROOT / 'livrables/publication-exercices/exercices.html', output / 'pages/exercices.html')
shutil.copy2(ROOT / 'livrables/publication-exercices/exercices-design.css', output / 'css/pages/exercices-design.css')
shutil.copy2(ROOT / 'livrables/publication-legende/legende.html', output / 'pages/legende.html')
shutil.copy2(ROOT / 'livrables/publication-legende/defilement.css', output / 'css/pages/defilement.css')

# Planification des exercices : le moteur historique reste disponible ; seul
# le parcours de présentation/confirmation est remplacé sur la base publique.
path = output / 'js/pages/exercices.js'
text = path.read_text(encoding='utf-8')
# Une durée personnalisée ne doit pas allumer le préréglage 1 h 30.
ancien_preset = "(dur===30?'30 min':dur===45?'45 min':dur===60?'1h':'1h30')"
nouveau_preset = "(dur===30?'30 min':dur===45?'45 min':dur===60?'1h':dur===90?'1h30':'')"
if text.count(ancien_preset) != 1:
    raise SystemExit('Préréglages de durée publics inattendus')
text = text.replace(ancien_preset, nouveau_preset, 1)
helper = (ROOT / 'livrables/publication-exercices/planification-design.js').read_text(encoding='utf-8')
parcours = (ROOT / 'livrables/publication-exercices/planification-seances.js').read_text(encoding='utf-8')
a = text.index('function renderPlanifier() {')
b = text.index('// ── MOTEUR DE PLANIFICATION EXERCICES', a)
text = text[:a] + helper + '\n' + parcours + '\n' + text[b:]
ancien = "        if (action === 'creneau') scheduleExo(id, Number(btn.dataset.exoSlot), btn.dataset.exoDate, btn.dataset.exoTime);"
if text.count(ancien) != 1:
    raise SystemExit('Actions Exercices publiques inattendues')
text = text.replace(ancien, '        exoPlanAction(action, id, btn);', 1)
ancien = "function openPlanifier(exoId) {\n    planifyTarget = exoId;"
if text.count(ancien) != 1:
    raise SystemExit('Ouverture Exercices publique inattendue')
text = text.replace(ancien, "function openPlanifier(exoId) {\n    exoPlanEtat = null;\n    planifyTarget = exoId;\n    window.__exoAccesDirect = true;", 1)
ancien = "    switchExoTab('planifier');\n    renderPlanifier();\n}\n\nfunction scheduleExo"
if text.count(ancien) != 1:
    raise SystemExit('Navigation directe Exercices inattendue')
text = text.replace(ancien, "    try { switchExoTab('planifier'); } finally { window.__exoAccesDirect = false; }\n    renderPlanifier();\n}\n\nfunction scheduleExo", 1)
ancien = "function switchExoTab(tab) {"
if text.count(ancien) != 1:
    raise SystemExit('Navigation Exercices inattendue')
text = text.replace(ancien, "function switchExoTab(tab) {\n    if (tab === 'planifier' && !window.__exoAccesDirect) { exoPlanEtat = null; planifyTarget = null; }", 1)
path.write_text(text, encoding='utf-8')

# Une version de cache propre évite de servir les anciens scripts après mise en ligne.
for rel in ('index.html', 'js/boot.js', 'js/registre.js', 'service-worker.js'):
    path = output / rel
    text = path.read_text(encoding='utf-8')
    if rel != 'js/registre.js':
        if '20261104az' not in text:
            raise SystemExit('Version publique inattendue dans ' + rel)
        text = text.replace('20261104az', version)
    if rel == 'js/boot.js':
        # Même démarrage que la version de travail, sans jauge de chargement.
        text = (ROOT / rel).read_text(encoding='utf-8')
        text, remplacements = re.subn(r"var version = '[^']+';", "var version = '" + version + "';", text, count=1)
        if remplacements != 1:
            raise SystemExit('Version de démarrage introuvable')
    if rel == 'index.html':
        jauge = '        <div class="boot-jauge" id="boot-jauge" role="progressbar" aria-label="Chargement de Studyplan" aria-valuemin="0" aria-valuemax="100" aria-valuenow="6"><i id="boot-jauge-fill"></i></div>\n'
        if text.count(jauge) != 1:
            raise SystemExit('Jauge de démarrage publique inattendue')
        text = text.replace(jauge, '')
        text, styles = re.subn(r'        \.boot-jauge \{.*?        \.boot-mot \{', '        .boot-mot {', text, count=1, flags=re.S)
        if styles != 1:
            raise SystemExit('Styles de jauge publics inattendus')
        text = text.replace('body.boot-erreur .boot-boite, body.boot-erreur .boot-jauge', 'body.boot-erreur .boot-boite')
        text = text.replace('.boot-jauge i, .boot-status { transition: none; }', '.boot-status { transition: none; }')
        text = text.replace("        /* La lumière qui respire : le logo s'ouvre doucement, une lumière verte\n           passe derrière lui, et la barre suit le chargement réel. */", "        /* La lumière qui respire accompagne le chargement. */")
        # Récupérer le jeton avant les scripts tiers, puis l'enlever de l'URL.
        # Le texte exact du base tag peut varier ; insérer avant le titre.
        anchor_invitation = '    <title>'
        if text.count(anchor_invitation) != 1:
            raise SystemExit('En-tête public inattendu')
        capture = '''    <script>(function(){var m=/^#salon=([a-f0-9]{48})$/.exec(location.hash);if(m){window.__salonInvitation=m[1];try{history.replaceState(history.state,'',location.pathname+location.search)}catch(e){}}})();</script>\n'''
        text = text.replace(anchor_invitation, capture + anchor_invitation, 1)
        anchor_salon_css = '    <link rel="stylesheet" href="css/pages/focus-parametres.css?v=' + version + '">'
        if text.count(anchor_salon_css) != 1:
            raise SystemExit('Styles des paramètres publics inattendus')
        text = text.replace(anchor_salon_css, anchor_salon_css + '\n    <link rel="stylesheet" href="css/pages/salon-focus.css?v=' + version + '">', 1)
        anchor = '    <link rel="stylesheet" href="css/pages/planning-panels.css?v=' + version + '">'
        if text.count(anchor) != 1:
            raise SystemExit('Chargement des styles public inattendu')
        text = text.replace(anchor, anchor + '\n    <link rel="stylesheet" href="css/pages/exercices-design.css?v=' + version + '">', 1)
        anchor = '    <link rel="stylesheet" href="css/pages/planning-panels.css?v=' + version + '">'
        if text.count(anchor) != 1:
            raise SystemExit('Styles Pomodoro publics inattendus')
        text = text.replace(anchor, anchor + '\n    <link rel="stylesheet" href="livrables/publication-pomodoro/videos.css?v=' + version + '">\n    <link rel="stylesheet" href="livrables/publication-pomodoro/mobile.css?v=' + version + '">\n    <link rel="stylesheet" href="livrables/publication-pomodoro/reprise.css?v=' + version + '">', 1)
        anchor = '    <link rel="stylesheet" href="livrables/publication-pomodoro/videos.css?v=' + version + '">'
        if text.count(anchor) != 1:
            raise SystemExit('Styles Pomodoro introuvables')
        text = text.replace(anchor, anchor + '\n    <link rel="stylesheet" href="livrables/publication-rappels/rappels.css?v=' + version + '">', 1)
        anchor = '    <link rel="stylesheet" href="livrables/publication-rappels/rappels.css?v=' + version + '">'
        if text.count(anchor) != 1:
            raise SystemExit('Styles des rappels introuvables')
        text = text.replace(anchor, anchor + '\n    <link rel="stylesheet" href="livrables/publication-retours/images.css?v=' + version + '">', 1)
        anchor = '    <link rel="stylesheet" href="livrables/publication-retours/images.css?v=' + version + '">'
        text = text.replace(anchor, anchor + '\n    <link rel="stylesheet" href="livrables/publication-planning/planning-design.css?v=' + version + '">\n    <link rel="stylesheet" href="livrables/publication-devoirs/devoirs-design.css?v=' + version + '">\n    <link rel="stylesheet" href="livrables/publication-eeia/design.css?v=' + version + '">', 1)
        anchor = '    <link rel="stylesheet" href="css/accessibilite.css?v=' + version + '">'
        if text.count(anchor) != 1:
            raise SystemExit('Styles d’accessibilité publics inattendus')
        text = text.replace(anchor, anchor + '\n    <link rel="stylesheet" href="css/pages/defilement.css?v=' + version + '">', 1)
    if rel == 'js/registre.js':
        anchor = "    'js/pages/pomodoro-parametres.js'\n"
        if text.count(anchor) != 1:
            raise SystemExit('Registre public inattendu')
        text = text.replace(anchor, "    'js/pages/pomodoro-parametres.js',\n    'js/pages/salon-focus-coeur.js',\n    'js/pages/salon-focus-firebase.js',\n    'js/pages/salon-focus.js',\n    'livrables/publication-rappels/rappels.js'\n", 1)
    if rel == 'service-worker.js':
        anchor_salon = '    "css/pages/planning-panels.css",'
        text = text.replace(anchor_salon, anchor_salon + '\n    "css/pages/salon-focus.css",\n    "js/pages/salon-focus-coeur.js",\n    "js/pages/salon-focus-firebase.js",\n    "js/pages/salon-focus.js",', 1)
        anchor = '    "css/pages/planning-panels.css",'
        if text.count(anchor) != 1:
            raise SystemExit('Liste hors-ligne publique inattendue')
        text = text.replace(anchor, anchor + '\n    "css/pages/exercices-design.css",\n    "css/pages/defilement.css",', 1)
        anchor = '    "css/pages/planning-panels.css",'
        text = text.replace(anchor, anchor + '\n    "livrables/publication-pomodoro/videos.css",\n    "livrables/publication-pomodoro/mobile.css",\n    "livrables/publication-pomodoro/reprise.css",\n    "livrables/publication-rappels/rappels.js",\n    "livrables/publication-rappels/rappels.css",\n    "livrables/publication-retours/images.css",\n    "livrables/publication-planning/planning-design.css",\n    "livrables/publication-devoirs/devoirs-design.css",\n    "livrables/publication-eeia/design.css",', 1)
        text += '''
self.addEventListener('notificationclick', function (event) {
    if (!event.notification.tag || !event.notification.tag.startsWith('studyplan-rappel-')) return;
    event.notification.close();
    event.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(function (fenetres) {
        for (var i = 0; i < fenetres.length; i++) {
            if (fenetres[i].url.startsWith(self.registration.scope)) return fenetres[i].focus();
        }
        return clients.openWindow(self.registration.scope);
    }));
});
'''
        old = "        url.pathname.includes('/audio/')) return;"
        # Les médias et requêtes partielles ne doivent jamais passer par un
        # cache-first, même pour un futur thème ajouté au catalogue.
        new = "        url.pathname.includes('/audio/') ||\n        req.destination === 'video' || req.headers.has('range') ||\n        /\\.(mp4|webm|ogv)$/i.test(url.pathname)) return;"
        if text.count(old) != 1:
            raise SystemExit('Service worker public inattendu')
        text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')

# Vérification finale : aucun autre fichier existant n'a changé.
allowed = set(files + ['pages/devoirs.html', 'pages/pomodoro.html', 'pages/planning.html', 'js/pages/devoirs.js', 'js/pages/planning-interface.js', 'js/accessibilite.js', 'pages/exercices.html', 'pages/legende.html', 'js/pages/exercices.js', 'css/pages/exercices-design.css', 'css/pages/defilement.css', 'css/pages/planning-panels.css', 'index.html', 'js/boot.js', 'js/registre.js', 'service-worker.js'])
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
