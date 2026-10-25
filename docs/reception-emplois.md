# Réception privée des emplois du temps — mise en service

Diagnostic du code : la semaine complète est envoyée dans `emplois_du_temps`, et la lecture admin est paginée. Une écriture refusée reste dans la file locale ; ce n’est **pas** une semaine reçue. Les règles effectivement actives sur la base réelle ne sont pas vérifiables depuis ce dépôt : ne pas attribuer avec certitude l’absence de fiches à un seul facteur. Le statut de la page admin signale maintenant explicitement un refus de lecture de `emplois_du_temps`.

Le code du site et les règles Firestore sont deux déploiements distincts. Mettre le site en ligne **ne publie pas** `firestore.rules`. Tant que les règles réellement actives refusent l'écriture atomique dans `emplois_du_temps` et `receptions_emplois`, les nouvelles semaines restent dans la file locale du navigateur ; elles ne sont pas reçues par les admins.

1. Faire publier **l'intégralité** du fichier [`firestore.rules`](../firestore.rules) dans les règles de la base Firestore du projet réel, par le responsable du projet, puis vérifier dans la console la version active. Garder la lecture admin complète, la recherche du seul UID connecté limitée à une fiche, et la lecture des accusés par ID sans liste ; ne pas autoriser `update` ou `delete`. Ne pas ouvrir l'ancienne collection `emplois` en écriture.
2. Vérifier avec un **vrai emploi volontaire et non fictif** qu'une semaine valide est créée dans `emplois_du_temps`, puis qu'elle apparaît dans la page admin « Emplois du temps » avec le bon nom. Une édition de cette semaine doit créer une nouvelle version, afficher la version la plus récente et conserver la précédente dans Firestore. Une simple reconnexion, une flamme différente ou le passage de six heures ne doit pas créer une version supplémentaire. Ne pas générer de fiche ni envoyer de mail de test en production.
3. Si la page admin indique qu'une partie des données n'est pas accessible, vérifier les autorisations de lecture des cinq comptes admins et l'état de la session Firebase ; ne pas interpréter une liste vide comme une preuve qu'aucun emploi n'existe. Conserver toutes les archives des collections `emplois_du_temps`, `emplois` et `boite` tant que leur lecture/migration n'est pas vérifiée.

Le site ne lit pas `comptes/{uid}` d'un autre élève : cette donnée reste privée. Une semaine **jamais envoyée** ni conservée dans une file d'un navigateur qui se reconnectera ne peut pas être récupérée à distance. Les fiches en attente sont gardées localement, sans plafond arbitraire de 40, et retentées tant que le navigateur revient en ligne. Une écriture refusée, ou un quota de stockage local épuisé, n'est jamais considérée comme reçue. Les documents confirmés sont immuables ; un balayage complet régulier retrouve aussi les envois tardifs dont la date `at` est ancienne. Aucune annonce publique n'est nécessaire.

## Vérification silencieuse lors de l'ouverture de la page Emploi du temps

Une semaine nouvelle est enregistrée par un lot **atomique** : le document
privé `emplois_du_temps/{id}` et son accusé minimal `receptions_emplois/{id}`
(`recu: true`, **sans nom, UID, matière ni horaire**). Si les anciennes règles
acceptent encore le document privé mais refusent le nouvel accusé, l'envoi
historique seul est conservé **sans prétendre qu'il est vérifiable**. Si le
réseau ou l'écriture privée échoue, la semaine reste dans la file locale. La page de l'élève vérifie le reçu sur
le **serveur Firestore** avec l'ID aléatoire gardé localement. Si l'accusé
n'existe plus, elle remet sa semaine complète en file puis réessaie, sans
supprimer les anciennes versions. Si les faits du planning ont été modifiés
par l'élève depuis la version accusée, cette édition part comme nouvelle
version, et non comme remplacement de l'ancienne. Un compte Google sans ancien reçu vérifie,
avec Firebase Auth, l'existence d'une semaine sous **son seul UID** dans la
même collection que lit l'Espace admin. Les règles interdisent de demander
les semaines des autres élèves. Un refus de lecture, une session incohérente
ou une absence de réseau ne vaut **pas** absence de document : aucun renvoi
n'est déclenché sur cette seule base.

**Limite des archives sans compte :** les anciens documents anonymes n'ont
aucun ID d'accusé conservé sur l'appareil ; il serait impossible de prouver
côté élève leur présence ou absence sans ouvrir la base privée. S'il y a un
ancien ACK local sans ID, on ne duplique pas la semaine ; les nouveaux envois
anonymes reçoivent tous un accusé vérifiable. Si l'élève change ou efface son
navigateur sans compte, l'ID local disparaît : on ne peut pas rattacher de
façon sûre son nouvel appareil aux anciennes archives anonymes.

La mise en ligne de GitHub Pages **ne déploie pas** les règles. Publier les
règles actives complètes est indispensable avant de conclure que le contrôle
backend fonctionne en production. Vérifier uniquement avec une vraie semaine
existante, sans créer de fiche de test en production ni envoyer de message.
