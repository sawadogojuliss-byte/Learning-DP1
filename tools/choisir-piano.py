#!/usr/bin/env python3
"""Choisit, dans « Musique classique », le passage qui sonne le plus piano.

Le morceau « Musique classique » dure 2 h et ne contient pas que du piano :
certains passages sont orchestraux, d'autres très percussifs. Pour l'emoji
🎹 Piano, on repère la fenêtre de 306 s (300 s + le fondu de raccord) la plus
tonale et la plus « frappée » :

  • planéité spectrale basse  → un son tenu, harmonieux, pas un bruit ;
  • concentration des pics   → des harmoniques nettes, pas un souffle large ;
  • attaques nettes          → des notes frappées (piano), pas des nappes ;
  • décroissance             → la note s'éteint après la frappe ;
  • peu d'aigus > 4 kHz      → pas de cymbales ni de chuintement.

Usage :
    python3 tools/choisir-piano.py --source /tmp/sons/classique.mp3 \
        --sortie /tmp/piano --eviter 6060
"""

import argparse
import importlib.util
import json
import os
import sys

import numpy as np

ICI = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('longs', os.path.join(ICI, 'construire-sons-longs.py'))
longs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(longs)

FS_ANA = 11025
CADRE = 4096
SAUT = 2205          # ≈ 0,2 s
DUREE_FENETRE = longs.DUREE_FENETRE
PAS = 30.0


def analyser(chemin):
    x = longs.decoder(chemin, FS_ANA, 1).astype(np.float32)
    n = len(x)
    nb = max(0, (n - CADRE) // SAUT + 1)
    fen = np.hanning(CADRE).astype(np.float32)
    f = np.fft.rfftfreq(CADRE, 1.0 / FS_ANA)
    bande = (f >= 50) & (f <= 5000)
    aigus = f >= 4000
    plat = np.empty(nb)
    conc = np.empty(nb)
    flux = np.empty(nb)
    haut = np.empty(nb)
    niveau = np.empty(nb)
    precedent = None
    for i in range(nb):
        t = x[i * SAUT:i * SAUT + CADRE] * fen
        mag = np.abs(np.fft.rfft(t))
        p = mag[bande] ** 2 + 1e-12
        plat[i] = float(np.exp(np.mean(np.log(p))) / (np.mean(p) + 1e-12))
        s = mag[bande]
        if len(s) > 3:
            loc = np.where((s[1:-1] > s[:-2]) & (s[1:-1] > s[2:]))[0]
            pointes = np.sort(s[1:-1][loc])[-20:] ** 2 if len(loc) else np.array([0.0])
            conc[i] = float(pointes.sum() / ((s ** 2).sum() + 1e-12))
        haut[i] = float((mag[aigus] ** 2).sum() / ((mag[bande] ** 2).sum() + 1e-12))
        niveau[i] = float(np.sqrt(np.mean(t ** 2)))
        lg = np.log1p(mag)
        flux[i] = 0.0 if precedent is None else float(np.maximum(0.0, lg - precedent).sum())
        precedent = lg
    return {'duree': n / float(FS_ANA), 'plat': plat, 'conc': conc, 'flux': flux,
            'haut': haut, 'niveau': niveau, 'pas': SAUT / float(FS_ANA)}


def fenetres(ana):
    pas = ana['pas']
    duree = ana['duree']
    larg = int(DUREE_FENETRE / pas)
    marge = int(60 / pas)
    flux = ana['flux']
    seuil = float(np.mean(flux) + 1.5 * np.std(flux))
    sorties = []
    debut = marge
    while debut + larg < len(ana['plat']) - marge:
        fin = debut + larg
        seg_plat = ana['plat'][debut:fin]
        seg_niv = ana['niveau'][debut:fin]
        if float(np.mean(seg_niv)) > 1e-4 and np.all(np.isfinite(seg_plat)):
            seg_flux = flux[debut:fin]
            local = float(np.mean(seg_flux) + 2.0 * np.std(seg_flux))
            pics = np.where((seg_flux[1:-1] > local) &
                            (seg_flux[1:-1] >= seg_flux[:-2]) &
                            (seg_flux[1:-1] >= seg_flux[2:]))[0] + 1
            # une seule attaque par 0,4 s au maximum
            gardes = []
            for i in pics:
                if not gardes or i - gardes[-1] > 2:
                    gardes.append(i)
            # décroissance : la note s'éteint-elle après la frappe ?
            db = 20 * np.log10(np.maximum(seg_niv, 1e-9))
            chutes = 0
            for i in gardes:
                if i + 6 < len(db) and float(np.min(db[i + 1:i + 6])) < db[i] - 6.0:
                    chutes += 1
            frac = (chutes / len(gardes)) if gardes else 0.0
            dniv = np.diff(seg_niv)
            sorties.append({
                'debut_s': round(debut * pas, 1),
                'plat': float(np.mean(seg_plat)),
                'conc': float(np.mean(ana['conc'][debut:fin])),
                'haut': float(np.mean(ana['haut'][debut:fin])),
                'attaques': len(gardes) / DUREE_FENETRE,
                'frappe': float(frac),
                'decroissance': float(np.mean(dniv < 0)),
                'niveau': float(20 * np.log10(np.mean(seg_niv) + 1e-9)),
            })
        debut += int(PAS / pas)
    return sorties


def classer(cands):
    if not cands:
        return []
    def z(cle, sens=1):
        v = np.array([c[cle] for c in cands], dtype=float)
        e = float(np.std(v)) or 1.0
        return sens * (v - float(np.mean(v))) / e
    for c in cands:
        for cle in ('plat', 'conc', 'haut', 'decroissance', 'attaques', 'niveau'):
            if not np.isfinite(c[cle]):
                c[cle] = float(np.nanmedian([d[cle] for d in cands if np.isfinite(d[cle])]) or 0.0)
    z_plat = z('plat', -1)
    z_conc = z('conc', +1)
    z_haut = z('haut', -1)
    z_dec = z('decroissance', +1)
    z_frappe = z('frappe', +1)
    z_att = -np.abs(np.array([c['attaques'] for c in cands]) - 3.0) / 3.0
    for i, c in enumerate(cands):
        c['score'] = round(float(z_plat[i] + 0.8 * z_conc[i] + z_haut[i] + 0.5 * z_dec[i]
                                 + 1.4 * z_frappe[i] + 0.6 * z_att[i]), 3)
    return sorted(cands, key=lambda c: c['score'], reverse=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source', required=True)
    p.add_argument('--sortie', required=True)
    p.add_argument('--eviter', type=float, default=None,
                   help='début déjà utilisé dans ce morceau, à ne pas recouper')
    p.add_argument('--ecart', type=float, default=900.0)
    p.add_argument('--forcer', type=float, default=None, help='imposer un début (s)')
    args = p.parse_args()
    os.makedirs(args.sortie, exist_ok=True)

    print('Analyse de %s' % args.source)
    ana = analyser(args.source)
    print('durée %.0f s — %d fenêtres analysées' % (ana['duree'], len(ana['plat'])))
    cands = fenetres(ana)
    if not cands:
        raise SystemExit('aucune fenêtre exploitable')
    med = float(np.median([c['niveau'] for c in cands]))
    cands = [c for c in cands if c['niveau'] >= med - 6.0]
    rang = classer(cands)
    print('  score   début    plat    conc   aigus  att/s  frappe  decr.  niveau')
    for c in rang[:12]:
        print('  %5.2f  %7.1f s  %.4f  %.3f  %.3f  %4.1f  %.2f   %.2f  %6.1f'
              % (c['score'], c['debut_s'], c['plat'], c['conc'], c['haut'],
                 c['attaques'], c['frappe'], c['decroissance'], c['niveau']))

    choisi = None
    for c in rang:
        if args.eviter is not None and abs(c['debut_s'] - args.eviter) < args.ecart:
            continue
        choisi = c
        break
    if choisi is None:
        choisi = rang[0]
    if args.forcer is not None:
        proche = min(cands, key=lambda c: abs(c['debut_s'] - args.forcer))
        choisi = proche
    print('Passage retenu : %.1f s (score %.2f)' % (choisi['debut_s'], choisi['score']))

    x = longs.fabriquer_depuis_musique(args.source, choisi['debut_s'], 'stereo',
                                       os.path.join(args.sortie, '_tmp.wav'))
    mp3 = os.path.join(args.sortie, 'piano.mp3')
    longs.encoder(os.path.join(args.sortie, '_tmp.wav'), mp3, 'stereo')
    autres = []
    for c in rang:
        if c is choisi:
            continue
        if all(abs(c['debut_s'] - d['debut_s']) > 300 for d in [choisi] + autres):
            autres.append(c)
        if len(autres) == 2:
            break
    for suffixe, candidat in (('-2', autres[0] if len(autres) > 0 else None),
                              ('-3', autres[1] if len(autres) > 1 else None)):
        if candidat is None:
            continue
        y = longs.fabriquer_depuis_musique(args.source, candidat['debut_s'], 'stereo',
                                           os.path.join(args.sortie, '_tmp2.wav'))
        longs.encoder(os.path.join(args.sortie, '_tmp2.wav'),
                      os.path.join(args.sortie, 'piano%s.mp3' % suffixe), 'stereo')
        print('Alternative %s : %.1f s (score %.2f)' % (suffixe, candidat['debut_s'], candidat['score']))
    if os.path.exists(os.path.join(args.sortie, '_tmp2.wav')):
        os.remove(os.path.join(args.sortie, '_tmp2.wav'))
    mesures = longs.mesurer(x)
    mesures.update({'id': 'piano', 'source': 'classique', 'debut_s': choisi['debut_s'],
                    'canaux': 'stereo', 'duree_s': round(len(x) / float(longs.FS), 1),
                    'octets': os.path.getsize(mp3),
                    'criteres': {k: round(v, 4) for k, v in choisi.items() if k != 'debut_s'}})
    with open(os.path.join(args.sortie, 'rapport.json'), 'w') as f:
        json.dump({'mesures': mesures, 'candidats': rang[:12],
                   'propositions': [choisi] + autres}, f, indent=2, ensure_ascii=False)
    os.remove(os.path.join(args.sortie, '_tmp.wav'))
    print(json.dumps(mesures, indent=2, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
