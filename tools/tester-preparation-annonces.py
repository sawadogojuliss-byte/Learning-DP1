#!/usr/bin/env python3
"""Tests du traitement vocal et des 60 fichiers assemblés dans le site."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('annonces', root / 'tools/preparer-annonces-fluides.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ffmpeg = os.environ.get('STUDY_FFMPEG', 'ffmpeg')
assert module.fichier_duree(21).name == '21-minutes-approuve.mp3'
assert module.fichier_duree(19).name == '19-minutes.wav'
assert module.fichier_duree(60).name == 'essai-60-minutes.mp3'
debut = root / 'livrables/stock-voix/messages/annonce-debut.wav'
fin = root / 'livrables/stock-voix/messages/annonce-de-pause.wav'
a = module.silence_interne(ffmpeg, debut, 3.8, 5.10, .35)
b = module.silence_interne(ffmpeg, fin, .25, 1.10, .20)
assert a[1] - a[0] > .5 and b[1] - b[0] > .2
for fichier, intervalle in ((debut, a), (fin, b)):
    brut = module.extraire(ffmpeg, fichier)
    traite = module.compresser_pause(brut, intervalle)
    attendu = (intervalle[1] - intervalle[0] - .14 + .005) * module.RATE
    assert abs((len(brut) - len(traite)) - attendu) < 4
    # Les parties éloignées de la zone silencieuse restent inchangées.
    assert traite[:round(intervalle[0] * module.RATE)] == brut[:round(intervalle[0] * module.RATE)]
    assert traite[-round((len(brut) / module.RATE - intervalle[1]) * module.RATE):] == brut[-round((len(brut) / module.RATE - intervalle[1]) * module.RATE):]

# Le milieu des prises des durées est strictement conservé avant encodage.
for n in (1, 5, 16, 19, 21, 31, 50, 60):
    milieu = module.rogner_bords(module.extraire(ffmpeg, module.fichier_duree(n)))
    prefixe = module.rogner_bords(module.compresser_pause(module.extraire(ffmpeg, debut), a))
    suffixe = module.rogner_bords(module.compresser_pause(module.extraire(ffmpeg, fin), b))
    assemble = module.fondu(module.fondu(prefixe, milieu), suffixe)
    limite = round(.02 * module.RATE)
    assert milieu[limite:-limite].tobytes() in assemble.tobytes(), f'la prise de {n} minutes a été modifiée'

if len(sys.argv) > 1:
    dossier = Path(sys.argv[1])
    fichiers = sorted(dossier.glob('annonce-*-minutes.mp3'))
    assert [f.name for f in fichiers] == [f'annonce-{n:02d}-minutes.mp3' for n in range(1, 61)]
    for f in fichiers:
        son = module.extraire(ffmpeg, f)
        assert 4 * module.RATE < len(son) < 15 * module.RATE, (f, len(son) / module.RATE)
else:
    with tempfile.TemporaryDirectory() as dossier:
        module.preparer(ffmpeg, Path(dossier), [5, 21])
        for n in (5, 21):
            assert len(module.extraire(ffmpeg, Path(dossier) / f'annonce-{n:02d}-minutes.mp3')) > 4 * module.RATE
print('OK traitement des prises, silences ciblés, durées non régénérées et audios décodables')
