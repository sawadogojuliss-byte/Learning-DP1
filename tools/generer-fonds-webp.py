#!/usr/bin/env python3
"""Crée les fonds Pomodoro en WebP : pleine taille et vignettes.

Les PNG d'origine étaient très lourds (2,5 Mo chacun, 52 Mo au total) :
la page mettait longtemps à charger les images. Ce script produit, pour
chaque fond :

  images/pomodoro/<id>.webp        pleine taille 1376x768, qualité 88
  images/pomodoro/mini/<id>.webp   vignette 400 px, qualité 80

Les images finies sont déjà dans le dépôt ; pour relancer ce script, il
faut d'abord récupérer les PNG d'origine depuis l'historique git, par
exemple :

  git show 3b67011:images/pomodoro/riviere.png > images/pomodoro/riviere.png

Il faut ImageMagick (commande « convert ») avec le support WebP.
"""

import shutil
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
SOURCE = RACINE / "images" / "pomodoro"
MINI = SOURCE / "mini"
QUALITE = 88
QUALITE_MINI = 80
LARGEUR_MINI = 400


def convertir(source, sortie, arguments):
    sortie.parent.mkdir(parents=True, exist_ok=True)
    commande = ["convert", str(source), "-strip"] + arguments + [str(sortie)]
    subprocess.run(commande, check=True)


def poids(chemin):
    return chemin.stat().st_size


def octets(nombre):
    if nombre >= 1024 * 1024:
        return "%.1f Mo" % (nombre / (1024.0 * 1024.0))
    return "%.0f Ko" % (nombre / 1024.0)


def main():
    if shutil.which("convert") is None:
        raise SystemExit("ImageMagick est introuvable (commande « convert »).")
    fonds = sorted(SOURCE.glob("*.png"))
    if not fonds:
        raise SystemExit("aucun PNG dans images/pomodoro")

    total_avant = 0
    total_apres = 0
    total_mini = 0
    lignes = []
    for source in fonds:
        nom = source.stem
        plein = SOURCE / (nom + ".webp")
        petit = MINI / (nom + ".webp")
        convertir(source, plein, ["-quality", str(QUALITE), "-define", "webp:method=6"])
        convertir(
            source,
            petit,
            ["-resize", "%dx" % LARGEUR_MINI, "-quality", str(QUALITE_MINI),
             "-define", "webp:method=6"],
        )
        avant = poids(source)
        apres = poids(plein)
        mini = poids(petit)
        total_avant += avant
        total_apres += apres
        total_mini += mini
        lignes.append("%-12s %9s -> %8s  (vignette %7s, %.0f fois plus léger)"
                      % (nom, octets(avant), octets(apres), octets(mini),
                         avant / float(apres)))

    for ligne in lignes:
        print(ligne)
    print("---")
    print("total avant : %s" % octets(total_avant))
    print("total après : %s (+ vignettes %s)" % (octets(total_apres), octets(total_mini)))
    print("%d fonds convertis." % len(fonds))
    return 0


if __name__ == "__main__":
    sys.exit(main())
