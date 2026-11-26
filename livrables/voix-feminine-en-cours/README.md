# Voix féminine — archive des durées 18 à 60

Les prises de 18 à 60 minutes sont conservées ici et utilisées pour la
publication des pauses féminines de 1 à 60 minutes. Pour les pauses 42, 43, 51,
56 et 57, les dernières reprises demandées sont dans des fichiers distincts ;
les originaux précédents et les essais alternatifs restent disponibles.

- Chaque prise est une phrase complète : « Ta séance de révision est terminée.
  Tu as droit maintenant à … minutes de pause. » Pour 21, 31, 41 et 51 minutes,
  les formulations sont « vingt une », « trente une », « quarante une » et
  « cinquante une minutes », conformément au choix précédent pour la voix
  masculine. Pour la reprise active de 51, le texte de génération était
  « cinquante-une » à la demande de l’utilisateur.
- `original/` conserve les prises de synthèse. `harmonise/` contient les versions
  destinées à être proposées pour le minuteur. `manifest.json` indique les
  empreintes, l'ajustement de tempo et les niveaux mesurés. Le volume a été
  rapproché des précédentes prises (environ −22 LUFS) et l'ajustement de tempo
  borné à ±8 % ; cela ne garantit pas un débit ou un volume perçu identique.
- Tests techniques : les fichiers publiés sont décodés dans Chromium.
  L’utilisateur indique avoir écouté les dernières reprises demandées.
- `preparer-lot.py` documente le traitement d'harmonisation par FFmpeg. Les
  empreintes permettent de vérifier que les copies destinées au site sont exactes.

La phrase de fin singulière régénérée reste celle déjà utilisée sur le site.
Les fichiers du dossier d'archive ne sont pas directement référencés par le site.
