#!/usr/bin/env python3
"""Assemble plusieurs sons courts du Drive en une boucle de 5 minutes.

Pour l'orage : les trois enregistrements de tonnerre sont superposés,
chacun à même niveau. Chaque couche est pavée bout à bout — mais chaque
répétition entre dans le son à un point différent (réparti par le nombre
d'or), et les couches démarrent décalées entre elles : rien ne se
reproduit au même moment, et rien ne recommence de façon audible. Le tout
est refermé par le même fondu de 6 s à puissance constante que les autres
sons, puis ramené au niveau commun (rms 0,085, crete <= 0,96).

Usage :
    python3 tools/construire-ensemble.py --cible orage --sortie /tmp/sortie \
        --source tonnerre-1=/tmp/sons/tonnerre-1.mp3 \
        --source tonnerre-4=/tmp/sons/tonnerre-4.mp3 \
        --source tonnerre-6=/tmp/sons/tonnerre-6.mp3
"""

import argparse
import importlib.util
import json
import os
import subprocess
import sys

import numpy as np

ICI = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('longs', os.path.join(ICI, 'construire-sons-longs.py'))
longs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(longs)

FS = longs.FS
CIBLE = int(longs.DUREE_FENETRE * FS)   # 306 s analysés, comme les autres
XF = int(longs.FONDU * FS)
OR = 0.6180339887498949                # nombre d'or : points d'entrée étalés


def canaux_fichier(chemin):
    res = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'stream=channels', '-of', 'csv=p=0', chemin],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    try:
        return int(res.stdout.decode().strip().splitlines()[0] or 1)
    except Exception:
        return 1


def trimer(x):
    """Enleve les blancs de debut et de fin (seuil 1 % du pic)."""
    pic = float(np.max(np.abs(x))) or 1.0
    seuil = 0.01 * pic
    fort = np.max(np.abs(x), axis=1) if x.ndim == 2 else np.abs(x)
    utiles = np.where(fort > seuil)[0]
    if not len(utiles):
        return x
    debut, fin = int(utiles[0]), int(utiles[-1]) + 1
    if fin - debut < 30 * FS:
        return x
    return x[debut:fin]


def tourner(x, depart):
    """Le même son, remis à l'endroit 'depart' : la répétition suivante
    n'entre jamais au même point."""
    depart %= len(x)
    if depart == 0:
        return x.copy()
    if x.ndim == 2:
        return np.concatenate([x[depart:], x[:depart]])
    return np.concatenate([x[depart:], x[:depart]])


def joindre(acc, suivant):
    """Raccord de deux bouts par le fondu de 6 s à puissance constante
    (même forme que le raccord de boucle de construire-sons-longs.py)."""
    angle = np.linspace(0.0, np.pi / 2.0, XF)
    if acc.ndim == 2:
        angle = angle[:, None]
    fin = acc[-XF:].copy()
    corps = acc[:-XF]
    return np.concatenate([corps, fin * np.cos(angle) + suivant[:XF] * np.sin(angle), suivant[XF:]])


def paver(x, longueur, graine):
    """Piste de 'longueur' échantillons : le son répété, chaque répétition
    entrée à un point différent."""
    if len(x) <= XF + 5 * FS:
        raise RuntimeError('source trop courte pour être pavée (%.1f s)'
                           % (len(x) / float(FS)))
    k = 0
    acc = tourner(x, int((graine * OR * len(x)) % len(x)))
    while len(acc) < longueur + XF:
        k += 1
        acc = joindre(acc, tourner(x, int(((graine + k) * OR * len(x)) % len(x))))
    return acc[:longueur]


def fabriquer(cible, sources, dir_sortie):
    """sources : liste (nom, chemin). Renvoie l'entrée du manifeste."""
    stereo = any(canaux_fichier(chemin) >= 2 for _, chemin in sources)
    canaux = 'stereo' if stereo else 'mono'
    n = 2 if stereo else 1
    couches = []
    for nom, chemin in sources:
        brut = longs.decoder(chemin, FS, n)
        if brut.ndim == 1 and n == 2:
            brut = np.repeat(brut[:, None], 2, axis=1)
        elif brut.ndim == 2 and n == 1:
            brut = brut.mean(axis=1)
        brut = trimer(brut)
        if brut.ndim == 2:
            for c in (0, 1):
                brut[:, c] = longs.filtrer_bande(brut[:, c], 28.0, 15500.0)
        else:
            brut = longs.filtrer_bande(brut, 28.0, 15500.0)
        r = float(np.sqrt(np.mean(brut ** 2)))
        if r > 1e-9:
            brut = brut * (1.0 / r)      # chaque couche pèse le même niveau
        couches.append((nom, brut))

    melange = np.zeros((CIBLE, n) if n == 2 else CIBLE)
    for i, (nom, brut) in enumerate(couches):
        depart = int((i * CIBLE) / (2.0 * len(couches)))   # couches décalées
        couche = paver(brut, CIBLE + depart, i + 1)
        melange = melange + couche[depart:depart + CIBLE]
    melange = melange / np.sqrt(float(len(couches)))

    x = longs.boucler(longs.normaliser(melange))
    x = longs.normaliser(x)

    mp3 = os.path.join(dir_sortie, cible + '.mp3')
    wav_tmp = os.path.join(dir_sortie, '_tmp.wav')
    longs.ecrire_wav(wav_tmp, x)
    longs.encoder(wav_tmp, mp3, canaux)
    os.remove(wav_tmp)
    mesures = longs.mesurer(x)
    mesures.update({
        'id': cible,
        'source': ' + '.join(nom for nom, _ in sources),
        'sources': [nom for nom, _ in sources],
        'canaux': canaux,
        'duree_s': round(len(x) / float(FS), 1),
        'octets': os.path.getsize(mp3),
    })
    return mesures


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--cible', required=True)
    p.add_argument('--source', action='append', required=True,
                   help='nom=chemin, répété pour chaque son à assembler')
    p.add_argument('--sortie', required=True)
    args = p.parse_args()
    os.makedirs(args.sortie, exist_ok=True)
    sources = []
    for item in args.source:
        nom, _, chemin = item.partition('=')
        assert nom and chemin, item
        sources.append((nom, chemin))
    mesures = fabriquer(args.cible, sources, args.sortie)
    with open(os.path.join(args.sortie, args.cible + '.json'), 'w') as f:
        json.dump(mesures, f, indent=2, ensure_ascii=False)
    print(json.dumps(mesures, indent=2, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
