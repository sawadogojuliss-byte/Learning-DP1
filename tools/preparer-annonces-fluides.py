#!/usr/bin/env python3
"""Prépare une phrase continue par durée à partir des prises masculines existantes.

Usage : python3 tools/preparer-annonces-fluides.py --ffmpeg /chemin/ffmpeg --sortie DOSSIER 5 21
Aucune synthèse vocale ni modification de la voix de reprise. Cet outil de
traitement hors ligne ne constitue pas un serveur déployé. Les résultats sont
à valider à l'écoute avant leur utilisation dans le minuteur.
"""
import argparse
import hashlib
import io
import re
import subprocess
import sys
import wave
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100

def extraire(ffmpeg, fichier):
    cmd = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-i', str(fichier), '-f', 'wav', '-ac', '1', '-ar', str(RATE), '-acodec', 'pcm_s16le', 'pipe:1']
    contenu = subprocess.run(cmd, check=True, stdout=subprocess.PIPE).stdout
    with wave.open(io.BytesIO(contenu), 'rb') as source:
        if source.getnchannels() != 1 or source.getsampwidth() != 2 or source.getframerate() != RATE:
            raise ValueError('Format audio inattendu : ' + str(fichier))
        data = array('h', source.readframes(source.getnframes()))
    if sys.byteorder != 'little':
        data.byteswap()
    return data

def silence_interne(ffmpeg, fichier, debut, fin, minimum):
    cmd = [ffmpeg, '-hide_banner', '-nostats', '-i', str(fichier), '-af', 'silencedetect=noise=-40dB:d=0.08', '-f', 'null', '-']
    resultat = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, check=True).stderr
    debuts = re.findall(r'silence_start:\s*([\d.]+)', resultat)
    fins = re.findall(r'silence_end:\s*([\d.]+)', resultat)
    intervalles = [(float(a), float(b)) for a, b in zip(debuts, fins) if debut <= float(a) < float(b) <= fin and float(b) - float(a) >= minimum]
    if len(intervalles) != 1:
        raise ValueError(f'Intervalle silencieux non identifié dans {fichier} : {intervalles}')
    return intervalles[0]

def compresser_pause(donnees, intervalle, cible=0.14):
    debut, fin = intervalle
    longueur = fin - debut
    if longueur <= cible:
        return donnees
    # Supprimer le centre de la zone silencieuse, pas son bord près des mots.
    milieu = (debut + fin) / 2
    enlever = longueur - cible
    a = round((milieu - enlever / 2) * RATE)
    b = round((milieu + enlever / 2) * RATE)
    return fondu(donnees[:a], donnees[b:], .005)

def rogner_bords(donnees, seuil=49, marge=.025):
    premier = next((i for i, n in enumerate(donnees) if abs(n) >= seuil), None)
    if premier is None:
        raise ValueError('Un des morceaux est silencieux')
    dernier = len(donnees) - 1 - next(i for i, n in enumerate(reversed(donnees)) if abs(n) >= seuil)
    return donnees[max(0, premier - round(marge * RATE)):min(len(donnees), dernier + round(marge * RATE) + 1)]

def fondu(gauche, droite, secondes=.01):
    n = min(round(RATE * secondes), len(gauche), len(droite))
    if not n:
        return gauche + droite
    transition = array('h', (round(gauche[len(gauche) - n + i] * (1 - i / n) + droite[i] * (i / n)) for i in range(n)))
    return gauche[:-n] + transition + droite[n:]

def fichier_duree(n):
    if n == 21:
        return ROOT / 'livrables/stock-voix/durees/21-minutes-approuve.mp3'
    if n < 50:
        return ROOT / f'livrables/stock-voix/durees/{n:02d}-minutes.wav'
    return ROOT / f'livrables/publication-voix/essai-{n:02d}-minutes.mp3'

def encoder(ffmpeg, donnees, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    cmd = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(RATE), '-ac', '1', '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-b:a', '160k', str(destination)]
    octets = donnees
    if sys.byteorder != 'little':
        octets = array('h', donnees)
        octets.byteswap()
    subprocess.run(cmd, input=octets.tobytes(), check=True)

def preparer(ffmpeg, sortie, numeros):
    debut = ROOT / 'livrables/stock-voix/messages/annonce-debut.wav'
    fin = ROOT / 'livrables/stock-voix/messages/annonce-de-pause.wav'
    # Ces fenêtres visent uniquement les deux prises connues. Un changement
    # des enregistrements doit provoquer un contrôle, pas un découpage aveugle.
    attendus = {
        debut: '86d2aa33a4aa7fd774f7251ccb0184b5dd45dffe28edf863b3438313b43dca91',
        fin: '0a9bb04c742d64cceff6e83681667239b82f8398127ed84157221822e0af1f47',
    }
    for chemin, attendu in attendus.items():
        if hashlib.sha256(chemin.read_bytes()).hexdigest() != attendu:
            raise ValueError('Prise modifiée : vérifier les points de traitement : ' + str(chemin))
    gap_debut = silence_interne(ffmpeg, debut, 3.8, 5.10, .35)
    gap_fin = silence_interne(ffmpeg, fin, .25, 1.10, .20)
    prefixe = rogner_bords(compresser_pause(extraire(ffmpeg, debut), gap_debut))
    suffixe = rogner_bords(compresser_pause(extraire(ffmpeg, fin), gap_fin))
    for n in numeros:
        if not 1 <= n <= 60:
            raise ValueError('Durée hors limites : ' + str(n))
        milieu = rogner_bords(extraire(ffmpeg, fichier_duree(n)))
        phrase = fondu(fondu(prefixe, milieu), suffixe)
        fichier = sortie / f'annonce-{n:02d}-minutes.mp3'
        encoder(ffmpeg, phrase, fichier)
        print(f'{n:02d} : {len(phrase) / RATE:.2f} s → {fichier}')

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--ffmpeg', default='ffmpeg')
    p.add_argument('--sortie', type=Path, required=True)
    p.add_argument('minutes', type=int, nargs='+')
    args = p.parse_args()
    preparer(args.ffmpeg, args.sortie, args.minutes)
