# Grilles d'examens fictives

Ces PDF sont des scans artificiels créés à partir de tableaux synthétiques, sans données personnelles. Ils imitent la structure générale du document de référence : cinq jours en colonnes, deux sessions, matières, épreuves, surveillants et durées. Ils ne reproduisent pas les noms du document réel et ne couvrent pas tous ses détails, notamment la troisième session et les sous-colonnes.

Chaque fichier JSON associé indique les dix cellules attendues et les plages générales de session. L'année est absente : elle ne doit pas être inventée ; une plage de session n'est pas nécessairement l'horaire individuel d'une épreuve. Les exemples comprennent des variantes de langue, de police et de compression. Le premier est volontairement difficile et peut entraîner des omissions.

Pour générer d'autres variantes et leurs corrigés (avec un serveur local et les dépendances Playwright nécessaires aux tests) :

```sh
STUDY_GRILLE_N=4 STUDY_GRILLE_OFFSET=0 STUDY_EXPORT_GRILLES=tools/fixtures/grilles-examens node tools/stress-grilles-examens.mjs
```

Le script exécute également l'analyse et compare les résultats aux cellules attendues. Il s'agit d'un corpus de validation et de calibration des règles, pas d'un réentraînement des modèles Tesseract. Il faut toujours vérifier les résultats sur le document original.
