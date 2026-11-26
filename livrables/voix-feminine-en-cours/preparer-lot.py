#!/usr/bin/env python3
"""Harmonise les prises provisoires sans modifier celles déjà publiées.

Usage : STUDY_FFMPEG=/chemin/ffmpeg python3 preparer-lot.py 18 27
Le niveau et les bornes de tempo sont ceux du premier lot. Les originaux sont
conservés ; les résultats sont des propositions qui nécessitent une écoute.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent
FFMPEG = os.environ.get('STUDY_FFMPEG', 'ffmpeg')
if len(sys.argv) != 3:
    raise SystemExit(__doc__)
debut, fin = map(int, sys.argv[1:])
if not 18 <= debut <= fin <= 60:
    raise SystemExit('Durées attendues : 18 à 60')
sortie = ROOT / 'harmonise'
sortie.mkdir(exist_ok=True)
manifest = ROOT / 'manifest.json'
infos = json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else {}
for n in range(debut, fin + 1):
    nom = f'{n:02d}'
    source = ROOT / 'original' / f'{nom}.mp3'
    cible = sortie / f'{nom}.mp3'
    if not source.is_file():
        raise SystemExit('Prise originale absente : ' + str(source))
    analyse = subprocess.run([FFMPEG, '-hide_banner', '-i', str(source), '-f', 'null', '-'], capture_output=True, text=True, check=True).stderr
    duree = re.search(r'Duration: (\d+):(\d+):([\d.]+)', analyse)
    if not duree:
        raise SystemExit('Durée illisible : ' + str(source))
    secondes = int(duree[1]) * 3600 + int(duree[2]) * 60 + float(duree[3])
    tempo = max(.92, min(1.08, secondes / 4.89941))
    with tempfile.TemporaryDirectory(prefix='voix-feminine-') as dossier:
        intermediaire = Path(dossier) / 'etape.wav'
        subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source), '-af', f'atempo={tempo:.5f}', '-c:a', 'pcm_s24le', str(intermediaire)], check=True)
        analyse = subprocess.run([FFMPEG, '-hide_banner', '-i', str(intermediaire), '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True, check=True).stderr
        lufs = float(re.findall(r'^    I:\s+(-?[\d.]+) LUFS', analyse, re.M)[-1])
        peak = float(re.findall(r'^    Peak:\s+(-?[\d.]+) dBFS', analyse, re.M)[-1])
        gain = min(-21.5 - lufs, -2.5 - peak)
        subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(intermediaire), '-af', f'volume={gain:.3f}dB', '-codec:a', 'libmp3lame', '-b:a', '128k', str(cible)], check=True)
    analyse = subprocess.run([FFMPEG, '-hide_banner', '-i', str(cible), '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True, check=True).stderr
    integre = float(re.findall(r'^    I:\s+(-?[\d.]+) LUFS', analyse, re.M)[-1])
    crete = float(re.findall(r'^    Peak:\s+(-?[\d.]+) dBFS', analyse, re.M)[-1])
    if not (-22.5 <= integre <= -21.4 and crete <= -2):
        raise SystemExit(f'Niveau inattendu pour {nom} : {integre} LUFS, {crete} dBFS')
    infos[nom] = {'duree_source_s': secondes, 'tempo': round(tempo, 5), 'gain_db': round(gain, 3), 'lufs_mesure': integre, 'crete_dbtp': crete, 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'sortie_sha256': hashlib.sha256(cible.read_bytes()).hexdigest()}
    print(f'{nom} : tempo {tempo:.3f}, {integre:.1f} LUFS, crête {crete:.1f} dBTP')
manifest.write_text(json.dumps(infos, ensure_ascii=False, indent=2, sort_keys=True) + '\n', encoding='utf-8')
