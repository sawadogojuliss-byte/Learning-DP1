#!/usr/bin/env python3
"""Fabrique les 18 ambiances longues du Pomodoro (5 minutes chacune).

Les musiques fournies par Juliss (Drive Study Plan) sont trop lourdes pour le
dépôt : elles sont téléchargées dans /tmp sur un runner GitHub Actions, et ce
script n'en garde qu'un passage, refermé sur lui-même par un fondu de 6 s.

Pour chaque emoji :
  • on repère dans la musique un passage de 306 s (300 s + le fondu) ;
  • on choisit le passage selon l'emoji (le plus fort pour « forte pluie »,
    le plus calme pour « pluie légère », celui qui contient un coup de tonnerre
    pour « orage », etc.) ;
  • on fond les 6 dernières secondes dans les 6 premières à puissance
    constante : à la lecture, la fin du fichier se prolonge dans le début,
    sans silence, sans clic, sans redémarrage audible ;
  • on normalise le niveau et on encode en MP3 (96 kb/s mono, 128 kb/s stéréo).

Les trois bruits (blanc, rose, brun) sont fabriqués ici, sans musique.

Usage :
    python3 tools/construire-sons-longs.py --sources /tmp/sons --sortie /tmp/sortie
"""

import argparse
import json
import os
import subprocess
import sys
import wave
import zlib

import numpy as np

FS = 44100
DUREE = 300.0            # longueur du fichier final
FONDU = 6.0              # fondu de raccord
N = int(DUREE * FS)
XF = int(FONDU * FS)
FS_ANA = 4000            # décodage d'analyse
DUREE_FENETRE = DUREE + FONDU

# emoji → (musique source, canaux)
PLAN = [
    ('pluie', 'pluie', 'mono'),
    ('cafe', 'cafe', 'stereo'),
    ('piano', 'classique', 'stereo'),
    ('avion', '8d', 'stereo'),
    ('train', '8d', 'stereo'),
    ('beta', 'flowstate', 'stereo'),
    ('salle', 'brainfm', 'stereo'),
    ('vent', 'vents', 'mono'),
    ('gamma', 'gamma', 'stereo'),
]
BRUITS = []   # les bruits ont été retirés de la grille (2026-10-17)
DEBITS = {'mono': '96k', 'stereo': '128k'}
RMS_CIBLE = 0.085
CRETE_MAX = 0.96


# ── Lecture / écriture ────────────────────────────────────────────────
def duree_fichier(chemin):
    cmd = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
           '-of', 'default=nw=1:nk=1', chemin]
    sortie = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        return float(sortie.stdout.decode().strip())
    except ValueError:
        return 0.0


def decoder(chemin, rate, canaux, debut=None, duree=None):
    cmd = ['ffmpeg', '-hide_banner', '-v', 'error', '-nostdin']
    if debut is not None:
        cmd += ['-ss', '%.3f' % debut]
    cmd += ['-i', chemin]
    if duree is not None:
        cmd += ['-t', '%.3f' % duree]
    cmd += ['-vn', '-ac', str(canaux), '-ar', str(rate), '-f', 'f32le', 'pipe:1']
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.decode('utf-8', 'replace')[-600:])
    audio = np.frombuffer(res.stdout, dtype='<f4').astype(np.float64)
    if canaux > 1:
        return audio.reshape(-1, canaux)
    return audio


def filtrer_bande(x, bas, haut):
    """Garde la bande [bas, haut] par masque FFT (mono)."""
    n = len(x)
    f = np.fft.rfftfreq(n, 1.0 / FS)
    masque = np.ones_like(f)
    if bas > 0:
        masque *= 1.0 / np.sqrt(1.0 + (bas / np.maximum(f, 1e-6)) ** 4)
    masque *= 1.0 / np.sqrt(1.0 + (f / haut) ** 4)
    return np.fft.irfft(np.fft.rfft(x) * masque, n)


# ── Analyse d'une musique ─────────────────────────────────────────────
def analyser(chemin):
    d = duree_fichier(chemin)
    x = decoder(chemin, FS_ANA, 1)
    if len(x) < FS_ANA * 60:
        raise RuntimeError('trop court')
    # enveloppe 1 s
    m = FS_ANA
    k = len(x) // m
    env = 20.0 * np.log10(np.maximum(np.sqrt(np.mean(x[:k * m].reshape(k, m) ** 2, axis=1)), 1e-9))
    # bandes par tranches de 0,5 s (STFT courte)
    bloc, saut = 8192, 2048
    nb = (len(x) - bloc) // saut + 1
    bas = np.empty(nb)
    mid = np.empty(nb)
    haut = np.empty(nb)
    f = np.fft.rfftfreq(bloc, 1.0 / FS_ANA)
    mb = (f >= 20) & (f < 120)
    mm = (f >= 120) & (f < 1500)
    mh = (f >= 1500)
    fen = np.hanning(bloc)
    for i in range(nb):
        t = x[i * saut:i * saut + bloc] * fen
        p = np.abs(np.fft.rfft(t)) ** 2
        tot = float(p.sum()) or 1.0
        bas[i] = p[mb].sum() / tot
        mid[i] = p[mm].sum() / tot
        haut[i] = p[mh].sum() / tot
    return {'duree': d, 'env': env, 'bas': bas, 'mid': mid, 'haut': haut,
            'pas': saut / float(FS_ANA)}


def candidats(ana, pas_s=30):
    d = ana['duree']
    marge = 90.0
    debuts = np.arange(marge, max(marge + 1.0, d - DUREE_FENETRE - marge), pas_s)
    out = []
    for debut in debuts:
        i0 = int(debut)
        i1 = i0 + int(DUREE_FENETRE)
        if i1 >= len(ana['env']) or int(i1 / ana['pas']) >= len(ana['bas']):
            continue
        seg = ana['env'][i0:i1]
        i0b = int(i0 / ana['pas'])
        i1b = int(i1 / ana['pas'])
        b = ana['bas'][i0b:i1b]
        h = ana['haut'][i0b:i1b]
        out.append({
            'debut': float(debut),
            'rms': float(np.mean(seg)),
            'regularite': float(np.std(seg)),
            'pique': float(np.max(seg) - np.median(seg)),
            'bas': float(np.mean(b)),
            'haut': float(np.mean(h)),
        })
    if not out:
        return out
    median = float(np.median([c['rms'] for c in out]))
    return [c for c in out if c['rms'] >= median - 6.0]


def choisir(cands, critere, sens, pris, ecart_min):
    """Renvoie un passage respectant le critère et l'écart minimal."""
    tries = sorted(cands, key=lambda c: c[critere], reverse=(sens > 0))
    for c in tries:
        if all(abs(c['debut'] - p) >= ecart_min for p in pris):
            return c
    return tries[0]


# ── Fabrication ───────────────────────────────────────────────────────
def limiter(x, seuil=0.80):
    """Écrêtage doux : on arrondit les pointes au lieu de baisser tout le son."""
    a = np.abs(x)
    return np.where(a <= seuil, x,
                    np.sign(x) * (seuil + (1.0 - seuil) * np.tanh((a - seuil) / (1.0 - seuil))))


def normaliser(x):
    """Niveau commun à tous les sons, sans écraser les crêtes fortes."""
    x = x - float(np.mean(x))
    r = float(np.sqrt(np.mean(x ** 2)))
    if r > 1e-9:
        x = x * (RMS_CIBLE / r)
    p = float(np.max(np.abs(x)))
    if p > CRETE_MAX:
        x = limiter(x, 0.80)
        p = float(np.max(np.abs(x)))
        if p > CRETE_MAX:
            x = x * (CRETE_MAX / p)
    return x


def boucler(x):
    """Fondu de 6 s à puissance constante : la fin se prolonge dans le début."""
    tete = x[:XF].copy()
    queue = x[len(x) - XF:].copy()
    angle = np.linspace(0.0, np.pi / 2.0, XF)
    if x.ndim == 2:
        angle = angle[:, None]
    x = x[:len(x) - XF].copy()
    x[:XF] = queue * np.cos(angle) + tete * np.sin(angle)
    return x


def ecrire_wav(chemin, x):
    pcm = np.clip(np.round(x * 32767.0), -32767, 32767).astype('<i2')
    with wave.open(chemin, 'wb') as w:
        w.setnchannels(1 if x.ndim == 1 else x.shape[1])
        w.setsampwidth(2)
        w.setframerate(FS)
        w.writeframes(pcm.tobytes())


def encoder(wav, mp3, canaux):
    cmd = ['ffmpeg', '-hide_banner', '-v', 'error', '-y', '-i', wav,
           '-c:a', 'libmp3lame', '-b:a', DEBITS[canaux], '-ar', str(FS),
           '-ac', '1' if canaux == 'mono' else '2', mp3]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.decode('utf-8', 'replace')[-600:])


def mesurer(x):
    rms = float(np.sqrt(np.mean(x ** 2)))
    crete = float(np.max(np.abs(x)))
    m = int(0.05 * FS)
    k = len(x) // m
    mono = x.mean(axis=1) if x.ndim == 2 else x
    env = 20 * np.log10(np.maximum(np.sqrt(np.mean(mono[:k * m].reshape(k, m) ** 2, axis=1)), 1e-9))
    return {
        'rms': round(rms, 4),
        'crete': round(crete, 3),
        'dynamique_db': round(float(np.percentile(env, 95) - np.percentile(env, 5)), 1),
        'raccord': round(abs(float(x[-1]) - float(x[0])) if x.ndim == 1 else
                         float(np.max(np.abs(x[-1] - x[0]))), 5),
    }


def fabriquer_depuis_musique(chemin_source, debut, canaux, wav_tmp):
    n = 1 if canaux == 'mono' else 2
    brut = decoder(chemin_source, FS, n, debut, DUREE_FENETRE + 1.0)
    if canaux == 'mono':
        if len(brut) < int(DUREE_FENETRE * FS):
            raise RuntimeError('extrait trop court')
        x = brut[:int(DUREE_FENETRE * FS)]
        x = normaliser(filtrer_bande(x, 28.0, 15500.0))
    else:
        brut = brut.reshape(-1, 2)
        x = brut[:int(DUREE_FENETRE * FS)]
        for c in (0, 1):
            x[:, c] = filtrer_bande(x[:, c], 28.0, 15500.0)
        x = normaliser(x)
    x = boucler(x)
    x = normaliser(x)
    ecrire_wav(wav_tmp, x)
    return x


def fabriquer_bruit(nom, duree_s, wav_tmp):
    rng = np.random.default_rng(zlib.crc32(nom.encode('utf-8')))
    n = int((duree_s + FONDU) * FS)
    blanc = rng.standard_normal(n)
    if nom == 'blanc':
        x = blanc
    else:
        spec = np.fft.rfft(blanc)
        f = np.fft.rfftfreq(n, 1.0 / FS)
        pente = 0.5 if nom == 'rose' else 1.0
        spec = spec / np.maximum(f, 1.0) ** pente
        spec[0] = 0.0
        x = np.fft.irfft(spec, n)
    x = normaliser(filtrer_bande(x, 28.0, 15500.0))
    x = boucler(x)
    x = normaliser(x)
    ecrire_wav(wav_tmp, x)
    return x


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--sources', required=True)
    p.add_argument('--sortie', required=True)
    args = p.parse_args()
    os.makedirs(args.sortie, exist_ok=True)

    # Regroupe les emojis par musique
    par_source = {}
    for emoji, source, canaux in PLAN:
        par_source.setdefault(source, []).append((emoji, canaux))

    # Rôles : quel emoji veut quel type de passage
    roles = {
        'pluie': {'pluie': ('regularite', -1)},
        # Le passage piano est choisi à part par tools/choisir-piano.py ;
        # matin et océan sont pavés depuis les sons courts du Drive par
        # tools/construire-boucle-courte.py, et orage et bibliothèque
        # assemblent plusieurs sons du Drive par
        # tools/construire-ensemble.py. Ces réglages ne servent que si
        # l'on relance toute la chaîne.
        'classique': {'piano': ('regularite', -1)},
        '8d': {'train': ('pique', +1), 'avion': ('regularite', -1)},
        'cafe': {'cafe': ('regularite', -1)},
        'flowstate': {'beta': ('regularite', -1)},
        'brainfm': {'salle': ('regularite', -1)},
        'vents': {'vent': ('regularite', -1)},
        'gamma': {'gamma': ('regularite', -1)},
    }
    ecarts = {'pluie': 900, 'classique': 1200, '8d': 900}

    manifeste = []
    wav_tmp = os.path.join(args.sortie, '_tmp.wav')

    for source, liste in par_source.items():
        chemin = os.path.join(args.sources, source + '.mp3')
        print('— %s (%d emoji)' % (source, len(liste)))
        ana = analyser(chemin)
        print('  durée %.0f s' % ana['duree'])
        cands = candidats(ana)
        pris = []
        for emoji, canaux in liste:
            critere, sens = roles[source][emoji]
            c = choisir(cands, critere, sens, pris, ecarts.get(source, 600))
            pris.append(c['debut'])
            x = fabriquer_depuis_musique(chemin, c['debut'], canaux, wav_tmp)
            mp3 = os.path.join(args.sortie, emoji + '.mp3')
            encoder(wav_tmp, mp3, canaux)
            m = mesurer(x)
            m.update({'id': emoji, 'source': source, 'debut_s': round(c['debut'], 1),
                      'canaux': canaux, 'duree_s': round(len(x) / float(FS), 1),
                      'octets': os.path.getsize(mp3)})
            manifeste.append(m)
            print('  %-13s %-8s début %6.0f s  rms %.3f  crête %.2f  %5.1f Mo'
                  % (emoji, canaux, c['debut'], m['rms'], m['crete'], m['octets'] / 1e6))

    for nom in BRUITS:
        x = fabriquer_bruit(nom, DUREE, wav_tmp)
        mp3 = os.path.join(args.sortie, nom + '.mp3')
        encoder(wav_tmp, mp3, 'mono')
        m = mesurer(x)
        m.update({'id': nom, 'source': 'généré', 'debut_s': 0,
                  'canaux': 'mono', 'duree_s': round(len(x) / float(FS), 1),
                  'octets': os.path.getsize(mp3)})
        manifeste.append(m)
        print('  %-13s généré          rms %.3f  crête %.2f  %5.1f Mo'
              % (nom, m['rms'], m['crete'], m['octets'] / 1e6))

    if os.path.exists(wav_tmp):
        os.remove(wav_tmp)
    with open(os.path.join(args.sortie, 'manifeste.json'), 'w') as f:
        json.dump(sorted(manifeste, key=lambda m: m['id']), f, indent=2, ensure_ascii=False)
    total = sum(m['octets'] for m in manifeste)
    print('Total : %d sons, %.1f Mo' % (len(manifeste), total / 1e6))
    return 0


if __name__ == '__main__':
    sys.exit(main())
