# Séparer les données Firestore — guide des responsables

La base reste **`study-plan-ib`**. On sépare les données en **collections**
(comme des dossiers) ; il ne faut pas créer un autre projet Firebase.
Aucune explication de ce changement n'a été ajoutée aux pages des élèves.

## Ce que contient chaque collection

| Collection | Contenu | Lecture depuis le site |
|---|---|---|
| `questions` | Nouvelles questions posées dans Aide | Cinq comptes admins seulement |
| `feedbacks` | Nouveaux avis et suggestions | Cinq comptes admins seulement |
| `emplois_du_temps` | Nouveaux emplois du temps | Cinq comptes admins seulement |
| `reponses` | Traces des réponses envoyées | Cinq comptes admins seulement |
| `emplois`, `profils`, `connexions` | Archives de la version précédente, seulement si ces collections ont reçu des données | Cinq comptes admins seulement |
| `boite` | **Archives** reçues avant cette séparation ; anciens onglets encore ouverts peuvent aussi y écrire temporairement | Cinq comptes admins seulement |
| `publie` | Annonces et tutoriels | Public volontairement |
| `config/mail` | Secret du courrier, une fois renouvelé | Cinq comptes admins seulement |
| `comptes/{uid}` | Progression personnelle de chaque élève | **Le propriétaire uniquement** ; même les admins ne lisent pas les progressions d'autrui |

Les cinq comptes admins pour la boîte sont les quatre comptes personnels déjà
configurés et `ibstudyplan@gmail.com`. La lecture est décidée par les règles
Firestore avec une connexion Google **vérifiée par Firebase**, pas par le
prénom saisi sur le site. La console Firebase est différente : quiconque a un
rôle dans le projet peut consulter les données depuis la console, car les
règles de l'application ne limitent pas les administrateurs du projet.

## Ce que tu dois faire, dans cet ordre

1. **Garder une copie des règles actuelles.** Ouvrir
   <https://console.firebase.google.com/project/study-plan-ib/firestore/rules>,
   sélectionner tout le texte présent et le copier dans une note privée.
2. **Publier les nouvelles règles.** Dans le même éditeur « Règles », remplacer
   **tout** le texte par le contenu complet du fichier [`firestore.rules`](firestore.rules)
   de cette branche du dépôt, puis cliquer sur **Publier**. Ne rien coller à
   la suite des anciennes règles. Ne créer aucune collection à la main.
   Le code du site se met à jour automatiquement. Tant que les règles
   ne donnent pas accès aux nouvelles collections, le formulaire indique
   un échec ; il ne confirme plus un envoi dirigé vers l'archive par erreur.
3. **Vérifier la séparation sans envoyer de mail de test.** Sur le site,
   poser une question ordinaire depuis Aide ; attendre « Question envoyée. ».
   Dans la console Firebase → Firestore Database → **Données**, une collection
   `questions` doit apparaître après le premier nouvel envoi. Cliquer sur
   `questions`, puis sur le document : le champ `type` doit valoir `question`.
   Un avis envoyé depuis Feedback apparaît dans `feedbacks` (`type: feedback`).
   Un emploi du temps apparaît dans `emplois_du_temps`. Les anciennes entrées restent
   dans `boite`, elles n'ont pas été effacées ni déplacées.
4. **Vérifier le compte de l'équipe.** Sur un navigateur personnel, se
   connecter au site avec le bouton Google **en choisissant exactement**
   `ibstudyplan@gmail.com`, puis ouvrir le menu : « Questions des utilisateurs »,
   « Retour des feedbacks » et « Emplois du temps » doivent être visibles.
   Cliquer sur **Actualiser** dans la rubrique. Si ce n'est pas le cas, vérifier
   que Google est activé dans Firebase Authentication et se reconnecter.
   Vérifier avec un autre compte non admin : il ne doit pas pouvoir lire les
   collections privées (Firestore répond `permission-denied`). Être propriétaire
   du projet et voir les documents dans **la console Firebase** ne teste pas
   les droits d'un élève sur le site.

**Publier des règles ne détruit ni ne déplace aucun document.** La règle de
`comptes/{uid}` est conservée à l'identique. Si d'autres collections que celles
listées ici sont utilisées par une autre application sur **la même base**,
vérifier leurs règles avant de remplacer l'ensemble du fichier : toute
collection sans règle correspondante sera inaccessible depuis les applications.

## Présentation des questions dans Firebase

Les **nouvelles** questions ont désormais quatre champs lisibles en premier,
numérotés parce que la console Firebase trie les champs par leur nom :
`01_heure_envoi` (heure d'Ouagadougou), `02_nom_utilisateur`,
`03_compte_gmail` (seulement si une adresse Gmail a été fournie ou si ce
Gmail est connecté), puis `04_question` (texte complet). L'adresse de contact
pour répondre est conservée séparément dans `z_email_reponse`. Les champs
techniques `at`, `id` et `type` restent nécessaires au site ; la console peut
les afficher à la suite, on ne peut pas personnaliser son interface.

Les nouveaux documents ne recopient plus le planning dans la question : il
part séparément dans `emplois_du_temps`. Les anciennes questions restent sous
leur format d'origine, et le site lit les deux formats. Publier des règles
Firestore ne transforme pas les documents déjà présents.

## Présentation des emplois du temps dans Firebase

Pour les **nouveaux envois** dans `emplois_du_temps`, la console montre en
premier `01_nom_utilisateur`, puis `02_matieres` et enfin
`03_emploi_du_temps`. Ce dernier champ déroule les jours de la semaine dans
l'ordre (`01_Lundi`, `02_Mardi`, etc.), avec une ligne par créneau, par exemple
`08h00 – 09h30  ·  Mathématiques`. Un planning hebdomadaire tient dans **un
seul document**, plutôt que d'être découpé en morceaux par jour.

Les champs techniques indispensables au site sont rangés sous
`z_donnees_techniques`. Le site reconstitue le planning exact depuis ces
champs, sans changer les vrais cours, trajets ou autres créneaux. Les anciens
documents conservent leur format : il faudrait une migration distincte pour
les réécrire. La console Firebase ne permet pas d'ajouter couleurs, tableau
ou mise en page personnalisée à ces documents ; un rendu plus visuel doit
être fait dans une page réservée aux admins, séparément.

## Anciennes entrées de `boite` (ne pas effacer)

Les données déjà présentes dans `boite` restent **mélangées dans cette archive**,
lisibles par les cinq admins. Le site lit l'archive **et** les nouvelles
collections, afin de ne perdre aucune question. Le code rectifié n'utilise
jamais `boite` comme repli pour les nouvelles questions, feedbacks ou emplois :
si les règles refusent l'écriture, le formulaire signale l'échec et garde
l'envoi sur l'appareil jusqu'à ce que les règles soient corrigées. Ne pas supprimer
`boite` : certaines questions et certains emplois y sont encore. Une migration
ancienne → nouvelles collections ne doit être faite qu'après sauvegarde,
vérification des nombres et déduplication ; elle n'est **pas** automatique.

## Courrier : étape séparée, à ne pas faire avec l'ancien secret

Le vieux secret du script Google a été publié dans l'historique Git : il est
**compromis**, même si on l'enlève du code actuel. Ne **pas** le recopier dans
`config/mail`. Le code source `tools/envoi-mail.gs` utilise désormais une
propriété de script `MAIL_SECRET` et ne transmet plus les confirmations au
vieux canal public ; **le déploiement Google déjà en ligne n'est pas modifié par
un push Git**. Pour réactiver les réponses par mail, le responsable du script
doit, séparément :

1. Générer dans son gestionnaire de mots de passe un **nouveau** secret
   aléatoire d'au moins 32 caractères. Ne pas le communiquer dans une issue,
   dans le code Git ou dans cette conversation.
2. Ouvrir le projet Apps Script qui exécute l'envoi : remplacer le code
   déployé par `tools/envoi-mail.gs` ; dans **Paramètres du projet** →
   **Propriétés du script**, ajouter `MAIL_SECRET` avec le nouveau secret.
3. **Déployer → Gérer les déploiements** → modifier le déploiement existant
   → sélectionner **Nouvelle version** → **Déployer**. Cela remplace l'ancienne
   version sans changer l'URL. Révoquer aussi tout ancien déploiement du script
   si plusieurs existent.
4. Console Firebase → Firestore Database → **Données** → collection `config`,
   document `mail`, champ `secret` (chaîne) : y enregistrer **ce même nouveau**
   secret. Les règles ne permettent pas d'écrire ce document depuis le site ;
   il doit être créé dans la console.

Tant que la rotation et le déploiement ne sont pas faits, ne pas utiliser la
fonction « Répondre » : elle ne doit pas s'appuyer sur l'ancien secret. La
réception des questions et des feedbacks **ne dépend pas** de ce secret.

## Confidentialité locale et limites

Le nouveau site ne conserve plus de copies des messages admin déjà lus dans
`localStorage` ; il retire les anciennes copies et vide la mémoire de la boîte
ainsi que le secret au moment de la déconnexion. Les envois qui ont échoué
restent temporairement en file locale pour pouvoir être renvoyés ; utiliser
un appareil privé pour l'administration, et se déconnecter après usage.
L'ancien canal public et les anciens fichiers personnels restent dans
l'**historique public Git** : les règles Firestore ne peuvent pas les effacer.
Effacer l'historique du dépôt demande une opération séparée et un accord exprès.
