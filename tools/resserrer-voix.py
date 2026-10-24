#!/usr/bin/env python3
"""Réduire les silences aux frontières des WAV de la voix du minuteur.

Ne touche pas aux pauses à l'intérieur de la phrase ni au bip. Relancer le
script est sans danger : la marge est conservée autour des phonèmes.
"""
from array import array
from pathlib import Path
import wave

DOSSIER = Path(__file__).resolve().parents[1] / 'audio' / 'voix'
SEUIL = 400  # PCM 16 bits : détecte la voix sans confondre le bruit de fond
MARGE = 0.09  # 90 ms avant et après le signal : préserver les attaques faibles


def resserrer(chemin):
    with wave.open(str(chemin), 'rb') as fichier:
        params = fichier.getparams()
        if params.sampwidth != 2 or params.nchannels != 1 or params.framerate != 24000:
            raise ValueError(f'Format inattendu : {chemin}')
        echantillons = array('h')
        echantillons.frombytes(fichier.readframes(params.nframes))
    # Un passage de 10 ms au-dessus du seuil signale un phonème. On conserve
    # une marge en plus : aucune coupe au milieu de la voix ni du souffle.
    pas = params.framerate // 100
    actifs = [i for i in range(0, len(echantillons), pas)
              if max(map(abs, echantillons[i:i + pas]), default=0) > SEUIL]
    if not actifs:
        raise ValueError(f'Aucune voix détectée : {chemin}')
    debut = max(0, actifs[0] - round(MARGE * params.framerate))
    fin = min(len(echantillons), actifs[-1] + pas + round(MARGE * params.framerate))
    if debut == 0 and fin == len(echantillons):
        return 0
    with wave.open(str(chemin), 'wb') as fichier:
        fichier.setparams(params)
        fichier.writeframes(echantillons[debut:fin].tobytes())
    return (len(echantillons) - (fin - debut)) / params.framerate


if __name__ == '__main__':
    gains = [resserrer(chemin) for chemin in sorted(DOSSIER.glob('*.wav'))]
    print(f'{len(gains)} morceaux contrôlés, {sum(gains):.2f} s de silence de bord retirées')
