#!/usr/bin/env python3
"""Fabrique une boucle de 5 minutes à partir d'un son court du Drive.

« Rue d'aubervilliers » (matin en ville) et « Petites vagues face océan »
duree quelques minutes : trop court pour y choisir une fenêtre de 306 s
comme dans les grands morceaux. On pave donc le son bout à bout — chaque
raccord est un fondu de 6 s à puissance constante, exactement la forme du
raccord de boucle de construire-sons-longs.py — puis on referme le tout
avec ce même fondu. Comme les autres sons : 5 minutes, rms 0,085, crete
<= 0,96, et rien ne recommence de façon audible.

Usage :
    python3 tools/construire-boucle-courte.py \
        --source /tmp/sons/matin.mp3 --id matin --nom-source matin-ville \
        --sortie /tmp/sortie
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
CIBLE = int((longs.DUREE + longs.FONDU) * FS)   # fenêtre analysée, comme les autres
XF = int(longs.FONDU * FS)


def canaux_fichier(chemin):
    res = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'stream=channels', '-of', 'csv=p=0', chemin],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    try:
        return int(res.stdout.decode().strip().splitlines()[0] or 1)
    except Exception:
        return 1


def paver(x):
    """Répète x bout à bout ; chaque raccord est le fondu à puissance
    constante de boucler(), appliqué entre la fin du precedent et le début
    du suivant."""
    angle = np.linspace(0.0, np.pi / 2.0, XF)
    if x.ndim == 2:
        angle = angle[:, None]
    sortie = x
    while len(sortie) < CIBLE + XF:
        bout = sortie[-XF:].copy()
        sortie = sortie[:-XF]
        sortie = np.concatenate([sortie, bout * np.cos(angle) + x[:XF] * np.sin(angle), x[XF:]])
    return sortie[:CIBLE]


def trimer(x):
    """Enleve les blancs de debut et de fin (seuil 1 % du pic) : ils
    creuseraient un trou dans le pavage."""
    pic = float(np.max(np.abs(x))) or 1.0
    seuil = 0.01 * pic
    if x.ndim == 2:
        fort = np.max(np.abs(x), axis=1)
    else:
        fort = np.abs(x)
    utiles = np.where(fort > seuil)[0]
    if not len(utiles):
        return x
    debut, fin = int(utiles[0]), int(utiles[-1]) + 1
    if fin - debut < 30 * FS:
        return x
    return x[debut:fin]


def fabriquer(chemin, identifiant, nom_source, dir_sortie):
    canaux = 'stereo' if canaux_fichier(chemin) >= 2 else 'mono'
    n = 1 if canaux == 'mono' else 2
    duree = longs.duree_fichier(chemin)
    debut_s = 0.0
    mode = 'pave'
    if duree >= longs.DUREE_FENETRE + 90:
        ana = longs.analyser(chemin)
        cands = longs.candidats(ana)
        choisi = longs.choisir(cands, 'regularite', -1, [], 0)
        debut_s = choisi['debut_s']
        mode = 'fenetre'
        wav_tmp = os.path.join(dir_sortie, '_tmp.wav')
        x = longs.fabriquer_depuis_musique(chemin, debut_s, canaux, wav_tmp)
        os.remove(wav_tmp)
    else:
        brut = longs.decoder(chemin, FS, n)
        if canaux == 'stereo':
            brut = brut.reshape(-1, 2)
        brut = trimer(brut)
        if canaux == 'mono':
            brut = longs.filtrer_bande(brut, 28.0, 15500.0)
        else:
            for c in (0, 1):
                brut[:, c] = longs.filtrer_bande(brut[:, c], 28.0, 15500.0)
        x = longs.boucler(longs.normaliser(paver(brut)))
        x = longs.normaliser(x)
    mp3 = os.path.join(dir_sortie, identifiant + '.mp3')
    wav_tmp = os.path.join(dir_sortie, '_tmp.wav')
    longs.ecrire_wav(wav_tmp, x)
    longs.encoder(wav_tmp, mp3, canaux)
    os.remove(wav_tmp)
    mesures = longs.mesurer(x)
    mesures.update({
        'id': identifiant,
        'source': nom_source,
        'debut_s': round(float(debut_s), 1),
        'canaux': canaux,
        'duree_s': round(len(x) / float(FS), 1),
        'octets': os.path.getsize(mp3),
        'mode': mode
    })
    return mesures


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source', required=True)
    p.add_argument('--id', required=True)
    p.add_argument('--nom-source', required=True)
    p.add_argument('--sortie', required=True)
    args = p.parse_args()
    os.makedirs(args.sortie, exist_ok=True)
    mesures = fabriquer(args.source, args.id, args.nom_source, args.sortie)
    with open(os.path.join(args.sortie, args.id + '.json'), 'w') as f:
        json.dump(mesures, f, indent=2, ensure_ascii=False)
    print(json.dumps(mesures, indent=2, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
