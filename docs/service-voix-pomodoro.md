# Service vocal Pomodoro : essai à valider

Ce répertoire contient un **vrai service HTTP** (`services/voix/serveur.py`) et une image Docker possible. Il tourne en local et est couvert par des tests, mais il **n'est pas déployé** et n'est pas activé sur le minuteur public. GitHub Pages héberge uniquement des fichiers statiques et ne peut pas exécuter ce service. Il faut un hébergement HTTPS séparé et une URL stable avant de l'activer.

## Ce que fait et ne fait pas le service

- `GET /v1/audio?message=fin-serie&debit=lent|normal|rapide` traite l'enregistrement existant « Tes séances de révisions sont terminées. » ; trois rythmes (0,85, 1,00 et 1,15) sont proposés par étirement temporel FFmpeg `atempo`.
- `GET /v1/audio?message=pause&minutes=21&debit=lent|normal|rapide&finale=0|1` compose une **seule piste MP3** à partir des prises masculines existantes ; si `finale=1`, le message de fin est inclus. Les paramètres sont limités à ces valeurs et à 1–60 minutes.
- Sauf pour cinq minutes (voir ci-dessous), la durée reste la prise existante sans modification de débit ; pour 21, c'est le MP3 à la prononciation approuvée. Le débit des autres fragments est modifié, puis la piste est encodée. L'annonce de reprise est inchangée. Pour les pauses, le traitement de silences et de fondus est celui de l'essai antérieur : il n'a pas été approuvé à l'écoute.
- Il ne génère pas une nouvelle voix : il n'a pas accès à un modèle de synthèse `voice-08` exportable. Raccourcir ou étirer des enregistrements ne garantit ni une prosodie naturelle, ni l'intégrité de chaque phonème. Une écoute et un choix utilisateur restent indispensables ; une amélioration définitive ne peut pas être garantie par les tests techniques.
- Les neuf MP3 publiés dans `livrables/publication-voix/essai-backend/` sont des **captures statiques** de réponses HTTP de ce service, uniquement pour l'écoute sur Studyplan. Ils ne prouvent pas que le backend est en ligne. Les tests du dépôt interrogent aussi le service HTTP réel et vérifient le préchargement et les secours du minuteur.

## Exécuter et tester

Depuis la racine du dépôt, avec Python 3 et FFmpeg disponibles :

```sh
PORT=8080 python3 services/voix/serveur.py
curl 'http://127.0.0.1:8080/healthz'
curl -o /tmp/fin.mp3 'http://127.0.0.1:8080/v1/audio?message=fin-serie&debit=lent'
python3 tests/voix/test_serveur.py
```

On peut préciser le chemin du binaire avec `STUDY_FFMPEG`. L'image Docker se construit **depuis la racine** :

```sh
docker build -f services/voix/Dockerfile -t studyplan-voix .
docker run --rm -p 8080:8080 -e STUDY_VOIX_ORIGIN=https://sawadogojuliss-byte.github.io studyplan-voix
```

Le serveur écoute sur `0.0.0.0:$PORT` et expose `/healthz`. `STUDY_VOIX_ORIGIN` est l'origine exacte autorisée par CORS (sans chemin ni barre finale). Aucun texte libre, identifiant, profil ou nom de tâche n'est envoyé : seules la durée, la vitesse et l'indication de dernière séance sont demandées. Seules des prises locales connues sont utilisées ; aucune commande ou chemin fourni par le client n'est exécuté. Les réponses réussies sont mises en cache, les calculs sont sérialisés et les requêtes simultanées sont bornées. Pour une exposition publique, ajouter une limite de débit par client au niveau de l'hébergeur ou du proxy, surveiller la mémoire, les erreurs et la disponibilité, et limiter les coûts. CORS n'est pas une authentification ni une protection contre l'abus.

## Raccordement, seulement après validation

Le code du minuteur peut utiliser le service pour la **voix masculine** si les deux valeurs suivantes sont configurées dans le site avant le chargement du module vocal :

```js
window.STUDYPLAN_VOIX_BACKEND = 'https://adresse-https-du-service';
window.STUDYPLAN_VOIX_DEBIT = 'lent'; // ou 'normal' / 'rapide', après écoute
```

Une route de proxy relative, par exemple `/api/voix`, est aussi acceptée. Ne jamais configurer `localhost` dans le site public : le navigateur de l'élève ne voit pas le serveur de développement. Une URL HTTPS externe doit autoriser l'origine exacte du site. Aucun secret ne doit être placé dans le navigateur.

Le minuteur précharge les deux pauses possibles et leurs variantes finales, sauf cinq minutes qui utilise toujours la prise locale approuvée, même si le service et un débit sont configurés. Il n'utilise la piste serveur que si elle est déjà téléchargée et décodée avant l'annonce ; sinon il garde les sons existants. Si l'AudioContext échoue après préchargement, il retombe sur les lecteurs des prises existantes, sans ajouter de bip. Le réglage féminin et la voix désactivée restent inchangés. Le service n'est pas encore paramétré en production ; si l'URL est absente ou si aucun débit valide n'est choisi, le comportement reste exactement celui du site actuel.

### Prise complète approuvée et nouveaux essais

Pour la voix masculine et une pause de cinq minutes, le minuteur utilise désormais le MP3 complet approuvé par l'utilisateur : il n'y a pas de raccord avant le nombre. En dernière séance, le message de fin précède cette prise ; si le MP3 est indisponible, les anciens fragments restent le secours. La voix féminine, l'annonce de reprise et la prise de 21 minutes précédemment approuvée restent inchangées. Cette prise de cinq minutes est prioritaire même lorsqu'un backend et un débit différent sont configurés, afin de conserver le rythme approuvé.

Le service non hébergé renvoie lui aussi le MP3 approuvé à l'identique pour `message=pause&minutes=5&debit=normal&finale=0`. Les variantes finales ou à un autre débit sont recomposées ; leur résultat nécessite une écoute. `message=essai-clair` reste l'ancien endpoint expérimental.

Dix autres prises complètes (1, 2, 3, 4, 6, 10, 15, 16, 19 et 21 minutes) sont proposées à l'écoute dans `livrables/publication-voix/essai-prises-continues/`. Elles ne sont pas intégrées au minuteur, leur qualité et leur prononciation ne sont pas encore validées. La nouvelle prise expérimentale de 21 ne remplace pas celle qui avait été approuvée. Après ce lot, 49 durées sur 60 n'ont pas encore de nouvelle prise complète ; elles doivent être générées et validées progressivement. Les silences perceptibles à l'intérieur de certaines prises restent possibles malgré l'absence de raccord artificiel.
