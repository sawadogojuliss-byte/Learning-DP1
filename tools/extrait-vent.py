#!/usr/bin/env python3
"""Extrait la boucle du son 🌬️ Vent depuis l'enregistrement fourni par Juliss.

Source : « Vents.mp3 », Drive Study Plan (174 Mo). Le fichier est trop gros
pour entrer dans le dépôt : il est téléchargé dans /tmp par
.github/workflows/extrait-vent.yml, analysé ici, et seul l'extrait de 7,91 s
(348 876 octets, 22 050 Hz, 16 bits, mono) rejoint audio/pomodoro/vent.wav.

Le script choisit le passage le plus calme de l'enregistrement — celui dont le
niveau bouge le moins et qui ne contient aucune attaque de rafale — puis le
referme sur lui-même par un fondu de 250 ms à puissance constante : le raccord
tombe sur deux échantillons consécutifs du fichier d'origine, donc sans clic.

Usage :
    python3 tools/extrait-vent.py --mp3 /tmp/vents.mp3 \
        --sortie audio/pomodoro/vent.wav --copie /tmp/vent/vent.wav
"""

import argparse
import json
import os
import subprocess
import sys
import wave

import numpy as np

FS = 22050                  # fréquence d'échantillonnage des sons du Pomodoro
DUREE = 8.0
N = int(FS * DUREE)         # 176 400 échantillons
FONDU = int(0.25 * FS)      # 250 ms de raccord
LONGUEUR = N - FONDU        # 174 416 échantillons = 7,91 s
RATE_ANALYSE = 4000         # décodage léger pour repérer le bon passage
TRAME = 0.05                # enveloppe par tranches de 50 ms


def decoder(rate, debut=None, duree=None):
    """Décode le MP3 en mono float32 à la fréquence demandée."""
    cmd = ['ffmpeg', '-hide_banner', '-v', 'error', '-nostdin']
    if debut is not None:
        cmd += ['-ss', '%.4f' % debut]
    cmd += ['-i', chemin_mp3]
    if duree is not None:
        cmd += ['-t', '%.4f' % duree]
    cmd += ['-vn', '-ac', '1', '-ar', str(rate), '-f', 'f32le', 'pipe:1']
    sortie = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if sortie.returncode != 0:
        raise SystemExit('ffmpeg a échoué : ' + sortie.stderr.decode('utf-8', 'replace')[-800:])
    return np.frombuffer(sortie.stdout, dtype='<f4').astype(np.float64)


def duree_totale():
    cmd = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
           '-of', 'default=nw=1:nk=1', chemin_mp3]
    sortie = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        return float(sortie.stdout.decode().strip())
    except ValueError:
        return 0.0


def enveloppe(x, rate):
    """Niveau RMS en dBFS par tranches de 50 ms."""
    m = int(rate * TRAME)
    n = len(x) // m
    blocs = x[:n * m].reshape(n, m)
    rms = np.sqrt(np.mean(blocs ** 2, axis=1))
    return 20.0 * np.log10(np.maximum(rms, 1e-9))


def filtrer(x):
    """Bande utile : on enlève l'infra-grave et les aigus inutiles, sans colorer."""
    n = len(x)
    f = np.fft.rfftfreq(n, 1.0 / FS)
    masque = (1.0 / np.sqrt(1.0 + (30.0 / np.maximum(f, 1.0)) ** 4)) * \
             (1.0 / np.sqrt(1.0 + (f / 7000.0) ** 8))
    return np.fft.irfft(np.fft.rfft(x) * masque, n)


def boucler(x):
    """Fondu à puissance constante : la fin revient dans le début sans creux."""
    tete = x[:FONDU].copy()
    queue = x[len(x) - FONDU:].copy()
    angle = np.linspace(0.0, np.pi / 2.0, FONDU)
    x = x[:len(x) - FONDU].copy()
    x[:FONDU] = queue * np.cos(angle) + tete * np.sin(angle)
    return x


def normaliser(x, rms_cible=0.070, crete_max=0.97):
    x = x - float(np.mean(x))
    r = float(np.sqrt(np.mean(x ** 2)))
    if r > 1e-9:
        x = x * (rms_cible / r)
    p = float(np.max(np.abs(x))) if len(x) else 0.0
    if p > crete_max:
        x = x * (crete_max / p)
    return x


def bandes(x):
    """Part de l'énergie par bande, en pourcentage."""
    spec = np.abs(np.fft.rfft(x)) ** 2
    f = np.fft.rfftfreq(len(x), 1.0 / FS)
    total = float(np.sum(spec)) or 1.0
    bornes = [20, 80, 250, 800, 2500, 6000, 10000]
    parts = []
    for bas, haut in zip(bornes[:-1], bornes[1:]):
        parts.append(100.0 * float(np.sum(spec[(f >= bas) & (f < haut)])) / total)
    return [round(p, 1) for p in parts]


def choisir_debut(x, rate):
    """Repère le passage de 8 s le plus stable, sans attaque de rafale."""
    env = enveloppe(x, rate)
    m = int(rate * TRAME)
    largeur = int(rms_fenetre / TRAME)
    mediane = float(np.median(env))
    pas = max(1, int(0.5 / TRAME))
    borne = int(0.03 * len(env))
    candidats = []
    for i in range(borne, len(env) - largeur - borne, pas):
        seg = env[i:i + largeur]
        dyn = float(np.percentile(seg, 95) - np.percentile(seg, 5))
        saut = float(np.max(np.abs(np.diff(seg))))
        niveau = float(np.mean(seg))
        facteur = float(np.max(seg) - 10.0 * np.log10(np.mean(10.0 ** (seg / 10.0))))
        penalite = max(0.0, (mediane - niveau) - 2.0) * 1.5
        score = abs(dyn - 3.0) + 2.0 * saut + 0.5 * abs(facteur - 12.0) + penalite
        candidats.append((score, i * TRAME, dyn, saut, facteur, niveau))
    candidats.sort(key=lambda c: c[0])
    print('  score   début    dyn   saut  crête  niveau')
    for c in candidats[:8]:
        print('  %5.2f  %7.2f s %5.1f  %5.1f  %5.1f  %6.1f' % (c[0], c[1], c[2], c[3], c[4], c[5]))
    return candidats[0][1], candidats[:8]


def ecrire(chemin, x):
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    pcm = np.clip(np.round(x * 32767.0), -32767, 32767).astype('<i2')
    with wave.open(chemin, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(FS)
        w.writeframes(pcm.tobytes())
    return len(pcm)


def main():
    global chemin_mp3, rms_fenetre
    p = argparse.ArgumentParser()
    p.add_argument('--mp3', required=True)
    p.add_argument('--sortie', required=True)
    p.add_argument('--copie', default=None)
    p.add_argument('--debut', type=float, default=None, help='forcer le début (s)')
    args = p.parse_args()
    chemin_mp3 = args.mp3
    rms_fenetre = DUREE + FONDU / float(FS)

    if not os.path.exists(chemin_mp3):
        raise SystemExit('MP3 introuvable : ' + chemin_mp3)
    duree = duree_totale()
    print('Fichier : %s — %.1f s' % (chemin_mp3, duree))

    analyse = decoder(RATE_ANALYSE)
    print('Décodage d\'analyse : %.1f s à %d Hz' % (len(analyse) / float(RATE_ANALYSE), RATE_ANALYSE))
    if len(analyse) < RATE_ANALYSE * 10:
        raise SystemExit('Enregistrement trop court')
    if float(np.max(np.abs(analyse))) < 1e-4:
        raise SystemExit('Enregistrement muet')

    candidats = []
    if args.debut is None:
        debut, candidats = choisir_debut(analyse, RATE_ANALYSE)
    else:
        debut = args.debut
    print('Passage retenu : %.2f s' % debut)

    brut = decoder(FS, debut, (N + 400) / float(FS))
    if len(brut) < N:
        raise SystemExit('Extrait trop court (%d échantillons)' % len(brut))
    x = brut[:N].copy()

    x = normaliser(filtrer(x), 0.070)
    x = boucler(x)
    x = normaliser(x, 0.070)
    if len(x) != LONGUEUR:
        raise SystemExit('Longueur inattendue : %d' % len(x))

    n = ecrire(args.sortie, x)
    if args.copie:
        ecrire(args.copie, x)

    saut = abs(float(x[-1]) - float(x[0]))
    mesures = {
        'debut_s': round(debut, 2),
        'echantillons': n,
        'duree': round(n / float(FS), 3),
        'rms': round(float(np.sqrt(np.mean(x ** 2))), 4),
        'crete': round(float(np.max(np.abs(x))), 4),
        'crete_rms_db': round(20 * np.log10(float(np.max(np.abs(x))) / float(np.sqrt(np.mean(x ** 2)))), 1),
        'dynamique_db': round(float(np.percentile(20 * np.log10(np.maximum(np.abs(x), 1e-9)), 95)
                                    - np.percentile(20 * np.log10(np.maximum(np.abs(x), 1e-9)), 5)), 1),
        'saut_dbfs': round(20 * np.log10(max(saut, 1e-9)), 1),
        'bandes_pct': bandes(x),
        'candidats': [[round(c[0], 2), round(c[1], 1), round(c[2], 1), round(c[3], 1)] for c in candidats],
    }
    print(json.dumps(mesures, indent=2))
    if args.copie:
        dossier = os.path.dirname(args.copie)
        with open(os.path.join(dossier, 'mesures.json'), 'w') as f:
            json.dump(mesures, f, indent=2)
        with open(os.path.join(dossier, 'rapport.txt'), 'w') as f:
            f.write('Passage retenu : %.2f s\n' % debut)
            f.write('Durée %.3f s — %d échantillons\n' % (mesures['duree'], n))
            f.write('rms %.4f — crête %.4f — crête/rms %.1f dB — dynamique %.1f dB\n'
                    % (mesures['rms'], mesures['crete'], mesures['crete_rms_db'], mesures['dynamique_db']))
            f.write('Raccord de boucle : %.1f dBFS\n' % mesures['saut_dbfs'])
            f.write('Bandes 20-80/80-250/250-800/800-2500/2500-6000/6000-10000 : %s %%\n'
                    % ' / '.join('%.1f' % b for b in mesures['bandes_pct']))
            if candidats:
                f.write('Candidats (score, début s, dynamique dB, saut dB) :\n')
                for c in candidats:
                    f.write('  %5.2f  %7.1f s  %4.1f  %4.1f\n' % c)
    return 0


if __name__ == '__main__':
    sys.exit(main())
