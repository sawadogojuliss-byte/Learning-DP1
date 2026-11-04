#!/usr/bin/env python3
"""Assembler les écoutes à partir des nombres publiés.

Sans argument : régénérer les deux écoutes depuis audio/voix/n-*.wav.
Avec --decouper : découper aussi les prises sources dans
apercu/correction-voix/*.wav (fichiers de travail non publiés).
Les prises conservent une marge de silence de 90 ms autour des sons.
Note : le chiffre sept est enregistré par l'homophone « cette », pour
éviter que la synthèse interprète « sept » comme « septembre ».
"""
from array import array
from pathlib import Path
import math
import sys
import wave

RACINE = Path(__file__).resolve().parents[1]
SOURCE = RACINE / 'apercu' / 'correction-voix'
VOIX = RACINE / 'audio' / 'voix'
AUDIO = RACINE / 'audio'
TAUX = 24000
PAS = TAUX // 100
MARGE = round(.09 * TAUX)
CORRIGES = [2, 6, 7, 16] + list(range(21, 31))


def lire(chemin):
    with wave.open(str(chemin), 'rb') as fichier:
        assert (fichier.getnchannels(), fichier.getsampwidth(), fichier.getframerate()) == (1, 2, TAUX), chemin
        donnees = array('h')
        donnees.frombytes(fichier.readframes(fichier.getnframes()))
        return donnees


def ecrire(chemin, donnees):
    with wave.open(str(chemin), 'wb') as fichier:
        fichier.setnchannels(1)
        fichier.setsampwidth(2)
        fichier.setframerate(TAUX)
        fichier.writeframes(donnees.tobytes())


def resserrer(donnees):
    actifs = [i for i in range(0, len(donnees), PAS)
              if max(map(abs, donnees[i:i + PAS]), default=0) > 400]
    if not actifs:
        raise ValueError('Prise sans voix')
    return donnees[max(0, actifs[0] - MARGE):min(len(donnees), actifs[-1] + PAS + MARGE)]


def separer(chemin):
    donnees = lire(chemin)
    pas = TAUX // 50
    volumes = []
    for i in range(0, len(donnees), pas):
        tranche = donnees[i:i + pas]
        volumes.append(math.sqrt(sum(int(x) * x for x in tranche) / max(1, len(tranche))) / 32768)
    # Le modèle laisse un vrai blanc entre deux nombres. Ne jamais couper
    # un silence à l'intérieur d'un nombre (notamment « vingt et une »).
    intervalles = []
    debut = None
    for i, muet in enumerate([v < .012 for v in volumes] + [False]):
        if muet and debut is None:
            debut = i
        elif not muet and debut is not None:
            if (i - debut) * .02 >= .35 and .2 * len(volumes) < debut < .8 * len(volumes):
                intervalles.append((debut, i))
            debut = None
    if not intervalles:
        raise ValueError(f'Aucune séparation sûre entre les deux mots : {chemin}')
    premier, dernier = max(intervalles, key=lambda p: p[1] - p[0])
    milieu = round((premier + dernier) * pas / 2)
    return resserrer(donnees[:milieu]), resserrer(donnees[milieu:])


def ecoute(nombres, destination):
    total = array('h')
    for index, n in enumerate(nombres):
        total.extend(lire(VOIX / f'n-{n}.wav'))
        if index + 1 != len(nombres):
            total.extend([0] * round(.32 * TAUX))
    ecrire(AUDIO / destination, total)
    print(destination, f'{len(total) / TAUX:.2f} s')


if __name__ == '__main__':
    if sys.argv[1:] not in ([], ['--decouper']):
        raise SystemExit('Usage : python3 tools/preparer-nombres-corriges.py [--decouper]')
    if sys.argv[1:] == ['--decouper']:
        for n in (2, 6, 7, 16, 21, 30):
            prise = 'n-7-phoneme-cette.wav' if n == 7 else f'n-{n}.wav'
            ecrire(VOIX / f'n-{n}.wav', resserrer(lire(SOURCE / prise)))
        for gauche, droite in ((22, 23), (24, 25), (26, 27), (28, 29)):
            un, deux = separer(SOURCE / f'n-{gauche}-{droite}.wav')
            ecrire(VOIX / f'n-{gauche}.wav', un)
            ecrire(VOIX / f'n-{droite}.wav', deux)
    ecoute(CORRIGES, 'nombres-corriges.wav')
    ecoute(range(1, 31), 'nombres-1-a-30.wav')
