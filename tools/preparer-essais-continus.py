#!/usr/bin/env python3
"""Prépare dix essais complets, jamais découpés près du nombre de minutes.

Les WAV proviennent du lot généré pour écoute, pas d'un modèle exportable.
Seule une pause détectée entre les deux phrases peut être raccourcie ; la
validité phonétique et la prononciation nécessitent l'écoute de l'utilisateur.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('traitement_audio', ROOT / 'tools/preparer-annonces-fluides.py')
audio = importlib.util.module_from_spec(spec); spec.loader.exec_module(audio)
EXPECTED = {
    '01':'7933cedda1e52f3e2ec15fc31b11698dd8d1849a85d24fb8329c44c5954e25d3',
    '02':'17ba22dd3da6da7fb852a868e4e691da994d2b7faf444c2d3782e00047e9d6c4',
    '03':'780024e8ddc9c5cd3d19f38b1c2b7d582cd3a6c800930895980336f094434e1a',
    '04':'42d44a69fdeff51e414d2bddf182d2ce3dbe47f051f175867e11d5b8a312815c',
    '06':'d52ef87011ec75623597b6f9926ae8fd5e12378e1e4cec6d79da2430e88b8adf',
    '10':'ee16796b2e41307aa3de57ce862b6ba9c000cf6380a22f13d12d8f59abcfaff5',
    '15':'9870e85aff775144d472668fe2e5828aa565dbe1c27eae2fd266750e27f44d3a',
    '16':'e0f12b61d61081478299caad5fd26e81b8a52f8bb4c03cfc26c4cc4f9364820e',
    '19':'7392cb5121145409465b451c6c4a519cc9470b86efe494f06b5306404ab8b555',
    '21':'7a54955052ba029e15789a915a29e0a69ad527101c7a9b68c7964149b33d0643',
}
# Ces deux prises ont une pause entre les phrases déjà courte ou fragmentée :
# ne rien supprimer automatiquement dans ces fichiers.
SANS_RETOUCHE = {'16', '21'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--sortie', type=Path, required=True)
    parser.add_argument('--ffmpeg', default='ffmpeg')
    args = parser.parse_args()
    args.sortie.mkdir(parents=True, exist_ok=True)
    manifest = []
    for numero, attendu in EXPECTED.items():
        fichier = args.source / (numero + '.wav')
        if hashlib.sha256(fichier.read_bytes()).hexdigest() != attendu:
            raise ValueError('WAV différent, revoir les points de silence : ' + str(fichier))
        brut = audio.extraire(args.ffmpeg, fichier)
        intervalle = None
        donnees = brut
        if numero not in SANS_RETOUCHE:
            intervalle = audio.silence_interne(args.ffmpeg, fichier, 1.5, 3.4, .5)
            donnees = audio.compresser_pause(brut, intervalle, cible=.35)
            # Le signal en dehors du silence désigné ne doit pas être changé.
            avant = round(intervalle[0] * audio.RATE)
            apres = round((len(brut) / audio.RATE - intervalle[1]) * audio.RATE)
            assert donnees[:avant] == brut[:avant] and donnees[-apres:] == brut[-apres:]
        sortie = args.sortie / (numero + '.mp3')
        audio.encoder(args.ffmpeg, donnees, sortie)
        manifest.append({'minutes': int(numero), 'wav_sha256': attendu, 'mp3_sha256': hashlib.sha256(sortie.read_bytes()).hexdigest(),
                         'duree_secondes': round(len(donnees) / audio.RATE, 3), 'silence_reduit': intervalle})
    (args.sortie / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Dix phrases complètes préparées pour écoute ; aucune n’est validée automatiquement.')

if __name__ == '__main__':
    main()
