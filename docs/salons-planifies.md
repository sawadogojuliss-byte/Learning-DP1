# Salons planifiés — solution gratuite en cours de validation

## État

Le propriétaire a demandé une solution **sans forfait payant**. La variante Cloud Functions/Blaze a été retirée. L'interface reste volontairement désactivée (`data/salons-planifies.json` a une URL vide). Le diagnostic public version 5 confirme le déploiement précédent et la présence de l’API ; les modifications d’acceptation préparées ici ne sont pas encore déployées ni testées sur les services réels. Une publication GitHub Pages ne modifie pas un projet Apps Script ni les règles Firebase.

## Variante gratuite proposée

`tools/salons-planifies-gratuit.gs` est prévu pour le même projet que `tools/envoi-mail.gs` ; ce dernier route les appels `actionSalons` vers lui et conserve son circuit mail historique. Un unique déclencheur installable Apps Script passe chaque minute, même si personne ne consulte le site. Il planifie le rappel de l'organisateur 10 minutes avant la séance et celui des invités ayant accepté 5 minutes avant, en utilisant GmailApp et le même compte d'envoi que le script existant. Le planning montre en haut une invitation avec organisateur, début et fin ; l’élève peut accepter ou refuser. Les liens sont stockés côté serveur et accessibles depuis le planning de l’organisateur et des invités ayant accepté à ces mêmes échéances. L’heure de fin affichée est indicative : elle ne ferme pas le salon automatiquement.

La variante utilise les propriétés **privées** du script pour les inscriptions consenties et les séances, Firebase Authentication REST pour vérifier le jeton Google, les règles Firestore pour lire la classe de l'utilisateur connecté, et OAuth/IAM de l'exécutant Apps Script pour créer et fermer les salons Firestore. Elle n'exige aucun secret côté navigateur ni fichier de clé de service. Le jeton Firebase est placé dans le corps HTTPS, jamais dans une URL ou un journal. La valeur `MAIL_SECRET` reste dans les propriétés du script ; elle sert aussi à dériver des identifiants de salon imprévisibles.

La création d'un salon exige que le compte exécutant Apps Script possède les droits IAM Firestore nécessaires. Le propriétaire a exécuté un diagnostic : lecture autorisée, puis création et suppression confirmées d'un document isolé, sous le compte `ibstudyplan@gmail.com`. Aucun mail n'a été envoyé. Cela ne vérifie pas encore la création réelle d'un salon, l'authentification des utilisateurs ou la livraison des rappels.

## Limites à communiquer

- Google peut retarder les déclencheurs et les e-mails ; aucune garantie d'envoi ou de réception exactement 10 ou 5 minutes avant. Une tentative incertaine n'est pas automatiquement relancée, pour éviter les doublons. Si le rappel ne part pas, le lien doit pouvoir être retrouvé dans le planning.
- Les quotas sont partagés avec les autres fonctions du compte Google : pour un compte Gmail personnel, Google indique notamment 100 destinataires mail par jour et 90 minutes d'exécution quotidienne des déclencheurs. Les valeurs peuvent changer et d'autres restrictions Gmail s'appliquent. La fonctionnalité ne doit pas promettre une capacité illimitée. [Quotas Apps Script](https://developers.google.com/apps-script/guides/services/quotas) ; [déclencheurs installables](https://developers.google.com/apps-script/guides/triggers/installable).
- Les propriétés d'un script sont limitées à 500 Ko au total et 9 Ko par valeur. Le code s'arrête avant le plafond et supprime les séances sept jours après leur début ; l'annuaire volontaire doit être maintenu et peut contenir au plus 500 inscriptions. Les autres usages de propriétés et de quotas du même projet comptent également.
- Maximum 20 invités par séance, cinq créations par organisateur et 20 invitations reçues par personne et par jour UTC. L'interface affiche au maximum 200 séances récentes et le signale si la limite est dépassée. DP1 et DP2 sont des années déclarées, pas une preuve d'appartenance à un établissement ou à une classe réelle.
- L'annuaire ne contient pas automatiquement tous les comptes Studyplan : seuls les élèves Google ayant déclaré DP1 ou DP2 et accepté d’y apparaître sont visibles. Les adresses ne sont pas affichées ; aucune fiche privée d’un autre élève n’est ouverte.
- L'utilisateur choisit d'apparaître dans l'annuaire et peut se retirer ; son adresse est conservée côté script pour l'envoi mais n'est pas affichée aux autres. L'annuaire ne couvre donc pas les personnes qui n'ont pas accepté. Le lien est un secret partageable : toute personne qui le possède peut entrer. Annuler, refuser ou se retirer empêche les prochains rappels concernés, mais un envoi déjà en cours ne peut pas toujours être arrêté. Accepter après l’échéance de cinq minutes mais avant le début déclenche l’envoi au prochain passage, si possible ; après le début, l’acceptation est refusée.
- Firebase Spark a lui aussi des quotas et peut refuser des opérations ; cette approche évite l'activation d'une facturation mais ne garantit pas de fonctionner au-delà des quotas gratuits.

## Avant activation réelle

1. Faire relire le code et le tester avec des comptes et un projet de test. Tester notamment les règles actuellement en production, OAuth/IAM, les écritures Firestore, les limites, l'annulation, la conservation et les doubles déclenchements. Ne jamais utiliser le secret compromis.
2. Vérifier quel compte exécute le projet Apps Script et s'il a les permissions Firestore adaptées. `tools/salons-manifeste.json` décrit les scopes requis ; modifier un manifeste existant avec prudence et conserver ses autres paramètres. Le déclencheur s'exécute avec les droits de son créateur. Éviter de partager des captures contenant des clés ou des jetons.
3. Pour l'acceptation, mettre à jour les deux fichiers (`version: 6` et `salonsAcceptation: true` au diagnostic), sans créer un nouveau déploiement. Installer les deux fichiers `.gs` dans **le bon projet**, autoriser les scopes nécessaires, exécuter `spDiagnosticGratuit`, puis vérifier séparément l'écriture avec accord explicite. Lancer `spInstallerRappels` une seule fois depuis le bon compte après validation ; il préserve les autres déclencheurs.
4. Déployer une nouvelle version du même déploiement Apps Script, puis confirmer que l'API est opérationnelle. Activer seulement ensuite `data/salons-planifies.json`, publier, et effectuer avec autorisation un test de bout en bout sur des comptes de test qui ont accepté, sans invitation collective. Un accusé du script ne prouve pas la réception.
5. Revoir la politique de confidentialité, le retrait des données, la reprise sur incident et les procédures en cas d'atteinte aux quotas. Une désinscription supprime son entrée d'annuaire et empêche les futurs rappels d'invitation ; les séances sont nettoyées après sept jours par le déclencheur. Les salons Firestore et leurs sous-collections ne sont pas automatiquement supprimés par cette version.

## Tests locaux — aucune opération réelle

```sh
node tools/tester-salons-gratuits.cjs
node tools/tester-script-mail.cjs
node tools/tester-salon-coeur.cjs
node tools/tester-salon-transport.cjs
STUDY_TEST_MODULES=/chemin/vers/node_modules STUDY_PLAYWRIGHT_SYSTEM=1 node tools/tester-interface-salons-planifies.cjs
```

Les tests simulent comptes, Firestore, propriétés Apps Script, temps et Gmail. Ils couvrent les échéances, l'échappement du mail, l'accord, l'annulation et l'absence de renvoi automatique incertain. **Ils ne prouvent pas que l'intégration distante fonctionne** ni que le compte possède les droits requis.
