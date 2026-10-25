# Séparer les données Firestore — guide des responsables

La base reste **`study-plan-ib`**. On sépare les données en **collections**
(comme des dossiers) ; il ne faut pas créer un autre projet Firebase.
Aucune explication de ce changement n'a été ajoutée aux pages des élèves.

## Ce que contient chaque collection

| Collection | Contenu | Lecture depuis le site |
|---|---|---|
| `questions` | Nouvelles questions posées dans Aide | Cinq comptes admins seulement |
| `feedbacks` | Nouveaux avis et suggestions | Cinq comptes admins seulement |
| `emplois_du_temps` | Semaines privées reçues et versions immuables ; conservation des archives | Cinq admins ; un élève connecté ne peut rechercher que ses propres semaines |
| `receptions_emplois` | Accusés de réception sans nom ni créneaux | Lecture individuelle par ID aléatoire ; liste interdite |
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
   ne donnent pas accès aux nouvelles collections et à l'écriture atomique
   de `receptions_emplois`, un ancien envoi privé encore autorisé peut
   réussir sans accusé vérifiable ; sinon l'emploi reste en file locale.
   Aucun faux accusé n'est créé. Ne pas tester avec un profil fictif réel.
3. **Vérifier la séparation sans envoyer de mail de test.** Sur le site,
   poser une question ordinaire depuis Aide ; attendre « Question envoyée. ».
   Dans la console Firebase → Firestore Database → **Données**, une collection
   `questions` doit apparaître après le premier nouvel envoi. Cliquer sur
   `questions`, puis sur le document : voir `01_heure_envoi`,
   `02_nom_utilisateur`, `04_question` et `z_donnees_techniques`.
   Un avis reçu depuis Feedback apparaît dans `feedbacks` avec `04_feedback`
   à la place de `04_question`. `type` se trouve dans le groupe technique.
   Les emplois du temps complets sont envoyés séparément dans `emplois_du_temps`
   si les règles actives autorisent leur création. Les anciennes entrées dans
   `boite` ne sont ni effacées ni déplacées.
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

## Conserver les emplois du temps et leurs versions

**Ne supprimer ni `emplois_du_temps`, ni `emplois`, ni `boite`.** La demande
actuelle est de conserver durablement la dernière semaine reçue et toutes ses
versions antérieures. Le site n'envoie pas une nouvelle version au seul passage
du temps ou au changement de flamme ; il n'en envoie qu'après un changement
des données du planning par l'élève. Les documents confirmés ne sont jamais
modifiés ni supprimés par le site (`allow update, delete: if false`). Une
sauvegarde régulière de la base reste nécessaire pour se prémunir contre une
suppression manuelle, un incident du service ou une erreur d'administration.

La publication du site GitHub Pages **ne publie pas les règles Firestore**.
Vérifier, dans le projet réel, que les règles actives correspondent au fichier
[`firestore.rules`](firestore.rules), après avoir sauvegardé les règles
existantes. Une réception échouée reste en attente dans le navigateur de
l'élève ; il faudra qu'il revienne avec ce même navigateur. Aucune collection
ne doit être purgée avant un inventaire, une sauvegarde et une migration
vérifiée. L'ancienne collection `boite` sert également aux questions et à la
vérification des comptes admins : ne pas la supprimer. Sur la page Emploi
du temps, une vérification serveur silencieuse contrôle l'accusé de la
semaine reçue et relance l'envoi si cette réception manque. Pour les
comptes connectés, une recherche limitée par UID prend aussi en charge
les anciens documents ; une archive anonyme sans identifiant d'accusé
reste indéterminable et n'est pas dupliquée par supposition. Voir
[`docs/reception-emplois.md`](docs/reception-emplois.md) pour le contrôle de
mise en service sans fiches de test ni courrier aux utilisateurs.

## Présentation des questions et feedbacks dans Firebase

Pour les **nouveaux** documents `questions` et `feedbacks`, la fiche affiche
`01_heure_envoi` (heure d'Ouagadougou), `02_nom_utilisateur`, puis
`03_compte_gmail` si une adresse Gmail a été fournie, et enfin
`04_question` ou `04_feedback`. La console trie les champs par leur nom.

Les anciennes lignes `at`, `id`, `type`, `z_email_reponse`,
`z_google_connecte`, `z_google_nom` ne sont **plus des champs distincts** des
nouveaux documents. Date de tri, type, identifiant et adresse de réponse
indispensables au site sont rassemblés dans **un seul groupe repliable**
`z_donnees_techniques`. Ne pas supprimer ce groupe : sans l'adresse de
réponse, les utilisateurs sans Gmail connecté ne pourraient plus recevoir
leurs réponses. La console Firebase peut ouvrir automatiquement ce groupe ;
son état visuel n'est pas contrôlable par le site.

Publier les dernières [`firestore.rules`](firestore.rules) **avant** de vérifier
un nouvel envoi : une version trop ancienne refuse le nouveau format, et une
version intermédiaire laisse encore passer les anciens documents à plat.
Si un ancien onglet reçoit un refus, le site garde le message sur l'appareil
pour réessayer après actualisation. Les documents déjà reçus conservent
leur ancien format : le site lit **les deux versions**, mais les règles ne
réécrivent pas l'historique dans Firebase. Les anciennes règles acceptaient
encore des écritures à plat depuis un ancien onglet : la version actuelle les
**refuse** pour `questions`, `feedbacks` et pour ces messages dans `boite`.
Si l'envoi échoue dans un vieil onglet, actualiser la page : la file locale
est reprise avec les champs lisibles et l'heure d'origine. Les documents
à plat déjà créés restent à migrer séparément si l'on veut aussi les changer.

Les nouveaux messages ne recopient pas le planning dans la question ou le
feedback. L'envoi séparé dans `emplois_du_temps` nécessite les règles de réception actives.

## Présentation des emplois du temps dans Firebase

Une fois les règles actives, les **nouveaux envois** dans
`emplois_du_temps` montreront en premier `01_nom_utilisateur`, puis `02_matieres` et enfin
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
lisibles par les cinq admins. Aucun ancien onglet ne peut plus y déposer une
nouvelle question ou un nouveau feedback à plat. Le site lit l'archive **et** les nouvelles
collections, afin de ne perdre aucune question. Le code rectifié n'utilise
jamais `boite` comme repli pour les nouvelles questions, feedbacks ou emplois :
si les règles refusent l'écriture, les formulaires de questions et avis
signalent l'échec. Un emploi du temps reste en attente sur le navigateur
de l'élève jusqu'à ce que les règles soient corrigées. Ne pas supprimer
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
