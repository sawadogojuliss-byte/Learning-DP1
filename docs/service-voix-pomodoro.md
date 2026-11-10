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

Le minuteur précharge les deux pauses possibles et leurs variantes finales, sauf les durées dont une phrase complète a été approuvée, qui utilisent toujours la prise locale même si le service et un débit sont configurés. Il n'utilise la piste serveur que si elle est déjà téléchargée et décodée avant l'annonce ; sinon il garde les sons existants. Si l'AudioContext échoue après préchargement, il retombe sur les lecteurs des prises existantes, sans ajouter de bip. La voix désactivée reste inchangée ; le réglage féminin est visible mais temporairement indisponible. Le service n'est pas encore paramétré en production ; si l'URL est absente ou si aucun débit valide n'est choisi, le comportement reste exactement celui du site actuel.

### Phrases complètes approuvées

Pour la voix masculine, les pauses de 1 à 52 minutes utilisent leurs phrases complètes approuvées : aucun assemblage devant le nombre. En dernière séance, le message de fin précède la prise. Si la prise ne peut pas être lue, le minuteur poursuit la transition sans rejouer les anciens fragments pour ces durées. La voix féminine demeure visible mais indisponible, et l'annonce de reprise est inchangée. Les cinquante-deux prises sont prioritaires même lorsqu'un backend et un débit différent sont configurés, afin de conserver le rythme approuvé.

Les prises de 14 et 19 minutes du deuxième lot n'ont pas été retenues ; des prises ultérieures ont depuis été validées. Pour les durées sans nouvelle prise approuvée, l'annonce actuelle reste provisoirement en place. Le MP3 de durée de 21 minutes antérieurement approuvé reste conservé.

Le service non hébergé renvoie le MP3 de cinq minutes approuvé à l'identique pour `message=pause&minutes=5&debit=normal&finale=0`. Pour les autres durées, il compose encore les anciennes prises et ne remplace pas les phrases complètes choisies par le minuteur. Les variantes finales ou à un autre débit nécessitent une écoute. `message=essai-clair` reste l'ancien endpoint expérimental.

### Voix féminine temporairement indisponible

Le choix reste visible dans les réglages mais son bouton est désactivé. Le minuteur utilise la voix masculine, même si une préférence féminine a été mémorisée ou synchronisée ; cette ancienne préférence n'est pas effacée. Le code et les enregistrements féminins sont conservés pour une éventuelle réactivation.

Dans le deuxième lot, 6, 7, 8, 9, 11, 12, 13 et 16 minutes ont été validées puis intégrées. Les prises de 14 et 19 sont refusées. Le troisième lot reprend 14 et 19 et propose 17, 18, 20 et 22 à 26 minutes ; ces dix prises n'ont pas été intégrées ; les versions ultérieurement approuvées figurent dans les lots suivants. Après ce troisième lot, huit des 30 nouvelles durées demandées avaient été générées ; 34 durées restaient alors sans nouvelle prise complète au total.

Le quatrième lot contient de nouvelles prises pour 17, 18 et 19 minutes après le retour sur leur prononciation, puis 27 à 33 minutes. Les prises 27, 28, 29, 30, 32 et 33 ont été validées et intégrées ; les prises 17, 18, 19 et 31 ne sont pas retenues. À ce stade, quinze des trente nouvelles durées demandées avaient été générées.

Le cinquième lot reprend les annonces 14, 17, 18, 19, 20, 22 à 25 et 31 pour écoute. Les prises 14, 20 et 22 à 25 ont depuis été validées et activées ; pour 17, 18, 19 et 31, ce sont les versions du lot 6 qui sont utilisées. Les références phonétiques de [France Podcasts](https://www.francepodcasts.com/2019/04/14/les-nombres-de-10-a-19/) indiquent notamment /disɛt/, /dizɥit/ et /diznœf/ pour 17, 18 et 19. La génération et le contrôle d'intégrité ne garantissent pas la prononciation : une écoute humaine reste indispensable.

Sur demande, un sixième lot reprend 17, 18 et 19 sans tiret dans le texte, ainsi que 31 avec les mots exacts « trente une minute ». Les quatre prises ont été validées puis activées.

Les prises 14, 20, 22 à 26 et 34 à 42 ont été validées puis activées. Les prises 43 à 52 du huitième lot ont été validées et activées. Le neuvième lot propose les phrases complètes de 53 à 60 pour écoute ; elles ne sont pas activées avant validation.
