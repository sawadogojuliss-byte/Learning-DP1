# Boîte privée — ce qui a changé et ce qu'il reste à faire une fois

Ce document est pour les responsables du site, pas pour les élèves.
Rien n'a été ajouté dans les pages pour prévenir les utilisateurs : le
site a exactement la même apparence qu'avant.

## Ce qui a changé

| Avant | Après |
|---|---|
| Les questions, suggestions et emplois du temps partaient sur un canal **public** (ntfy.sh), lisible par quiconque connaissait son nom | Ils sont écrits dans la collection Firestore **`boite`**, que seuls les quatre comptes admins peuvent lire |
| Le nom du canal était écrit dans `js/pages/boite.js` et dans `data/boite-url.json` | Il n'existe plus nulle part dans le site |
| Le prénom tapé à l'accueil ouvrait les sections réservées | L'accès dépend du **compte Google réellement connecté**, vérifié par Firebase |
| Les quatre adresses Gmail étaient écrites dans la page | Elles ne sont plus dans le site (seulement dans `firestore.rules`, qui n'est pas servi) |
| Le secret d'envoi des mails (`spib-…`) était dans la page | Il est dans le document Firestore privé `config/mail` |
| `data/comptes.json`, `data/emplois.json`, `data/rappels.json` contenaient les profils, les emplois du temps et les noms, téléchargeables par tous | Ces fichiers sont **vidés** et ne sont plus régénérés |
| La progression d'un élève transitait par le canal public | Elle reste dans `comptes/{uid}`, lisible par ce seul compte |
| La déconnexion Google laissait la session Firebase ouverte | La déconnexion ferme aussi Firebase |

Les annonces et les tutoriels restent publics (c'est leur nature) : ils
sont rangés dans la collection `publie`.

## À faire une fois — obligatoire

**Sans cette étape, la boîte ne fonctionne plus : Firebase refuse tout.**
C'est voulu : mieux vaut une boîte fermée qu'une boîte ouverte.

1. Ouvrir <https://console.firebase.google.com/project/study-plan-ib/firestore/rules>.
2. Si la base Firestore n'existe pas encore : **Créer une base de données**,
   mode production, région `europe-west` (par exemple).
3. Remplacer tout le contenu de l'onglet « Règles » par le contenu du
   fichier `firestore.rules` de ce dépôt.
4. Cliquer sur **Publier**.

## À faire une fois — pour que les réponses par mail repartent

Le secret d'envoi n'est plus dans la page. Il doit être recopié dans
Firestore :

1. Console Firebase → **Firestore Database** → **Démarrer une collection**.
2. Identifiant de la collection : `config`.
3. Identifiant du document : `mail`.
4. Ajouter un champ `secret` (type *chaîne*), valeur : l'ancienne valeur
   `spib-…` du script `tools/envoi-mail.gs` (variable `SECRET`).
5. Enregistrer. Ne rien mettre d'autre dans ce document.

Tant que ce document manque, répondre à une question affiche « L'envoi
au nom de l'équipe Study Plan IB n'est pas encore activé. » — le message
existait déjà.

## Comment vérifier, en cinq minutes

1. **Un élève ne voit rien.** Se connecter avec un compte quelconque,
   ouvrir `pages/boite.html` : les listes restent vides, même en
   modifiant la page. Ouvrir la console du navigateur et essayer de lire
   la collection `boite` : Firebase répond `permission-denied`.
2. **Un admin voit tout.** Se connecter avec l'un des quatre comptes,
   ouvrir la boîte : les messages apparaissent.
3. **Une question arrive.** Depuis un autre navigateur (ou en navigation
   privée), poser une question depuis la page Aide. Elle apparaît chez
   l'admin après **Actualiser**, ou toute seule en moins de deux minutes
   si la page est ouverte.

Si un admin voit « Connecte-toi avec ton compte Google, puis clique sur
Actualiser », c'est que sa session Firebase a expiré : il se reconnecte
avec le bouton Google, et tout revient.

**Les quatre admins doivent désormais se connecter avec leur compte
Google.** Avant, taper son prénom suffisait : c'était le trou. Sans
connexion, les entrées « Retours », « Questions » et « Emplois » ne
s'affichent plus. Si l'un des quatre n'a jamais utilisé le bouton
Google, il le fait une fois : sa progression et son nom sont déjà sur
l'appareil, rien n'est perdu.

Si la connexion Google n'ouvre toujours pas la boîte, vérifier dans la
console Firebase → **Authentication** → **Sign-in method** que le
fournisseur **Google** est activé (il l'est probablement déjà : c'est
lui qui enregistre les progressions dans `comptes/{uid}`).

## Ce qui n'est plus automatique

- **L'avis par mail aux quatre admins** quand une question arrive. Il
  partait du navigateur de l'élève avec le secret écrit dans la page :
  n'importe qui pouvait donc envoyer des mails au nom du site. La boîte
  prévient maintenant dans le site (popup « Nouveaux messages ») dès
  qu'un admin l'ouvre. Si l'avis par mail est indispensable, il faut un
  petit service côté serveur (fonction Cloud ou script Google planifié) —
  à décider séparément.
- **L'historique** des emplois du temps déjà reçus n'est pas repris : il
  faudrait une importation. Les fiches des élèves qui reviennent sur le
  site se réaffichent d'elles-mêmes, une fois par appareil.

## Risques qui restent

1. **L'ancien canal public est brûlé.** Les messages déjà publiés y sont
   restés (ntfy les garde quelques heures). Ils ne sont pas rappelables.
   Ne pas réutiliser ce nom de canal.
2. **L'historique Git est public.** Les anciens `data/*.json` (profils,
   emplois du temps, adresses) restent lisibles dans les commits passés
   du dépôt. Les vider aujourd'hui ferme l'accès facile, pas l'accès à
   l'historique. Si cela doit disparaître, il faut réécrire l'historique
   et forcer le push — une opération à décider avec toi, pas à faire
   dans la foulée.
3. **Les vidéos de tutoriel** passent toujours par un hébergeur public
   (fil distinct, contenu public par nature).
4. **Un message peut toujours être écrit par n'importe qui** (c'est le
   principe de la page Aide) : les règles limitent la forme et la taille,
   pas le volume. Si le spam devient un problème, il faudra exiger un
   compte Google pour écrire.
