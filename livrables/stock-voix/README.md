# Stock des annonces vocales pour utilisation ultérieure

Ces fichiers sont conservés dans le dépôt. Les durées de 1 à 60 sont utilisées par la voix masculine du minuteur ; la voix féminine existante reste inchangée. Ce stockage n'est pas une base de données applicative.

## Durées

- `durees/00-minutes.wav` à `durees/49-minutes.wav` : 50 fichiers distincts.
- `00` a été généré à la demande pour compléter le stock ; il n'a pas encore été validé à l'écoute.
- `16` est la version corrigée validée par l'utilisateur ; `19` est la version corrigée dont la prononciation a été validée.
- `21` est issu de l'essai à la prononciation approuvée, avec son début légèrement accéléré, également approuvé. `21-minutes-approuve.mp3` conserve exactement le fichier MP3 que l'utilisateur a entendu.
- Les nombres se terminant par un sont ceux demandés sans le mot « et », avec la correction particulière demandée pour 21.
- Les durées 22 à 49 ont été générées pour écoute ; leur validation individuelle n'est pas établie ici.

## Messages

- `reprise-proposition.wav` : « Ta pause est terminée. C’est parti pour une nouvelle séance de concentration ! » ; voix choisie pour les nouveaux extraits, pas encore validée à l'écoute.
- `fin-seance-proposition.wav` : proposition « Ta séance de révision est terminée. Tu as droit maintenant à une pause. » avec cette même voix ; formulation et prononciation à valider avant utilisation.
- `fin-seance-test-masculine-2-original.mp3` : extrait original du test Masculine 2, conservé à titre de référence. Il ne faut pas le présenter comme la même voix que celle sélectionnée pour les nouveaux enregistrements : leur identité exacte n'a pas pu être garantie.
- `annonce-debut.wav` et `annonce-de-pause.wav` : nouveaux morceaux utilisés avec les durées ; leur rendu global n'a pas encore été validé à l'écoute.

Les fichiers 50 à 60, validés par l'utilisateur, sont conservés dans `livrables/publication-voix/essai-XX-minutes.mp3`.
