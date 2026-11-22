# Voix féminine — archive des durées 18 à 60

L'utilisateur a demandé de conserver tous les enregistrements puis de les publier
ensemble. Les prises de 18 à 60 minutes sont maintenant complètes et recopiées
vers `livrables/publication-voix/essai-feminine/` pour intégration. Les copies de
cette archive permettent de conserver les originaux et les versions harmonisées.

- Chaque prise est une phrase complète : « Ta séance de révision est terminée.
  Tu as droit maintenant à … minutes de pause. » Pour 21, 31, 41 et 51 minutes,
  les formulations sont « vingt une », « trente une », « quarante une » et
  « cinquante une minutes », conformément au choix précédent pour la voix
  masculine. Les prononciations et le naturel n'ont pas été validés à l'écoute.
- `original/` conserve les prises de synthèse. `harmonise/` contient les versions
  destinées à être proposées pour le minuteur. `manifest.json` indique les
  empreintes, l'ajustement de tempo et les niveaux mesurés. Le volume a été
  rapproché des précédentes prises (environ −22 LUFS) et l'ajustement de tempo
  borné à ±8 % ; cela ne garantit pas un débit ou un volume perçu identique.
- Tests techniques : les enregistrements et versions harmonisées sont décodés
  dans Chromium ; aucun contrôle d'écoute humaine n'a été effectué.
- `preparer-lot.py` documente le traitement d'harmonisation par FFmpeg. Les
  empreintes permettent de vérifier que les copies destinées au site sont exactes.

La phrase de fin singulière régénérée reste celle déjà utilisée sur le site.
Les fichiers du dossier d'archive ne sont pas directement référencés par le site.
