# Préparation des annonces Pomodoro

La publication assemble une annonce masculine par durée (1 à 60 minutes) à l'aide de `tools/preparer-annonces-fluides.py` et FFmpeg. L'étape s'exécute **avant la publication** : elle produit des fichiers statiques ; ce n'est pas un service HTTP ni un backend en temps réel. GitHub Pages ne peut pas héberger un tel service. Le minuteur ne consomme pas ces essais tant qu'ils ne sont pas approuvés.

L'outil part des trois enregistrements existants et n'altère pas l'annonce de reprise. Dans les deux prises de phrase connues, il détecte les longues zones de faible amplitude, puis raccourcit leur centre. Il conserve une marge autour des mots et utilise de courts fondus entre les prises. Les empreintes SHA-256 des prises de phrase empêchent de réutiliser automatiquement ces repères sur un autre enregistrement. Pour 21 minutes il utilise le MP3 à la prononciation approuvée ; les prises de durées ne sont pas accélérées ni régénérées.

Un traitement des silences et des fondus ne garantit **pas** une prosodie naturelle, ni ne prouve qu'aucun phonème faible n'a été affecté. Les essais doivent être écoutés et acceptés avant d'activer cette solution. L'annonce complète enregistrée en une seule prise reste une autre possibilité, mais elle ne garantit pas non plus les prononciations précédemment validées.

Pour exécuter localement :

```sh
python3 tools/preparer-annonces-fluides.py --ffmpeg /chemin/vers/ffmpeg --sortie /tmp/annonces 5 21
```

Pour assembler tout le site avec une autre installation FFmpeg :

```sh
STUDY_FFMPEG=/chemin/vers/ffmpeg python3 tools/preparer-publication-pages.py BASE SORTIE VERSION
```
