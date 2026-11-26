# Salons planifiés — préparation, pas encore activée

## État

Le site contient une interface de préparation et le code d'un service Firebase séparé. **La fonction n'est pas en production** tant que le service, l'index et le secret ne sont pas installés et vérifiés. `data/salons-planifies.json` reste volontairement vide : le site ne transmet aucun jeton à une URL non configurée. Les salons immédiats continuent de fonctionner.

Le code utilise une API authentifiée Firebase et Cloud Scheduler (un passage par minute), donc un déploiement de Cloud Functions et une facturation Google Cloud appropriée sont nécessaires. Vérifier le plan et les coûts avec le propriétaire avant toute activation. Une publication GitHub Pages ne déploie ni les fonctions, ni les règles Firestore, ni le secret. Ne pas créer de ressources ou activer la facturation sans son accord.

## Fonctionnement prévu

- Tout utilisateur authentifié par Google, avec une année DP1 ou DP2 dans sa fiche `documents/{uid}`, peut programmer une séance de 15 minutes à 30 jours à l'avance, jusqu'à 20 invités. Les années sont déclarées par l'utilisateur : **DP1 et DP2 ne constituent pas une vérification d'école ou de classe réelle**.
- Chaque élève doit activer volontairement sa visibilité dans le formulaire ; il peut la désactiver. L'annuaire ne montre que le nom et l'année ; les adresses ne sont ni renvoyées aux autres utilisateurs ni écrites dans cet annuaire. La liste est actuellement limitée à 500 membres visibles, et le signalera si la limite est atteinte.
- La séance figure en haut du planning des participants. Le lien apparaît 10 minutes avant pour l'organisateur et 5 minutes avant pour l'invité. Le serveur prévoit les e-mails aux mêmes échéances, avec le fuseau de l'organisateur. L'exécution Cloud Scheduler et la livraison Gmail peuvent être en retard : aucune garantie d'arrivée à la seconde exacte.
- Le salon est créé sur le serveur avec une expiration 12 heures après son début. Le lien donne accès au salon à toute personne qui le possède ; il n'est pas un contrôle d'identité individuel. Le créateur peut annuler ; un rappel déjà lancé ne peut pas toujours être interrompu.
- Cinq créations par organisateur et 20 invitations reçues par personne et par jour UTC, dédoublonnage transactionnel des demandes identiques. Le traitement enregistre la tentative avant de contacter Apps Script et ne relance pas automatiquement si le résultat est incertain. Cela évite un doublon automatique, mais peut laisser un rappel non envoyé ; consulter le planning, qui présente le lien à l'heure prévue. Pas de garantie de réception ni de diagnostic complet affiché dans l'interface.

## Prérequis à vérifier avant activation

1. Vérifier que le projet Firebase `study-plan-ib` dispose du plan, des permissions, des API et des limites adaptées à Cloud Functions v2, Cloud Scheduler, Firestore, Secret Manager et Gmail. Prévoir le coût et les alertes. Les déclencheurs ne sont pas une horloge exacte.
2. Confirmer que les règles Firestore effectivement déployées interdisent l'accès direct aux collections `salons_annuaire_prive`, `salons_programmes_prives`, `salons_rappels_prives`, `salons_limites_privees`, `salons_dedoublonnage_prive`. Les tests de règles dans `tools/tester-salon-regles.cjs` couvrent ces refus. Ne jamais rendre ces collections publiques.
3. Faire une revue de sécurité et un essai sur un projet Firebase de test avant toute mise en production : authentification Google, autorisations du compte de service (notamment lecture des comptes Firebase Auth), quotas, annulation, désinscription, doublons, accès au salon et nettoyage des données. Les tests automatisés actuels simulent Firebase et n'envoient aucun mail ; ils ne valident pas ces prérequis en production.
4. Le script Apps Script utilisé est celui de `data/mail-script.json`. Le service lit la valeur privée `SALONS_MAIL_SECRET` depuis Secret Manager. Elle doit être identique à `MAIL_SECRET` dans le projet Apps Script, mais ne doit jamais être écrite dans Git, dans le site, dans les commandes shell enregistrées ou dans la conversation. Si la clé est renouvelée, mettre à jour les deux côtés et redéployer les fonctions concernées.
5. Créer dans la console Firestore deux index composites (portée collection) : pour `salons_rappels_prives`, `etat` croissant puis `prevuLe` croissant ; pour `salons_programmes_prives`, `participants` en mode tableau (« contient ») puis `debut` croissant. Laisser les index se construire. Éviter de remplacer les index existants par une configuration partielle. Le planning affiche au maximum 200 séances récentes et l'indique si cette limite est atteinte.
6. Déployer depuis `services/salons-planifies/` avec un compte autorisé et la CLI Firebase, projet `study-plan-ib`, les fonctions `salonsPlanifies` et `rappelsSalons` ; paramétrer le secret **de façon interactive et privée**. Cette opération peut créer des ressources facturées. Le site vérifie l'URL exacte `https://europe-west1-study-plan-ib.cloudfunctions.net/salonsPlanifies` pour ne pas envoyer de jeton à une adresse arbitraire.
7. Mettre en place une politique de conservation/suppression : les collections privées et sous-collections des salons ne sont pas supprimées automatiquement par ce prototype. Les champs `expireLe` sur les quotas et empreintes permettent éventuellement une politique TTL Firestore, à configurer et vérifier ; elle ne supprime pas les autres données ni les sous-collections. Documenter la confidentialité et permettre les demandes de suppression.
8. Avant de remplir l'URL dans `data/salons-planifies.json` et de publier, vérifier le déploiement, les protections et effectuer **avec accord explicite** un test réel limité aux comptes de test des participants, sans provoquer une invitation collective. Ne jamais considérer `success` comme preuve de réception.

## Vérifications locales sans envoi

```sh
node tools/tester-salons-planifies.cjs
node tools/tester-salon-coeur.cjs
node tools/tester-salon-transport.cjs
# Avec Playwright et Chromium installés :
STUDY_TEST_MODULES=/chemin/vers/node_modules STUDY_PLAYWRIGHT_SYSTEM=1 node tools/tester-interface-salons-planifies.cjs
```

Le premier test simule les comptes, Firestore, le temps et Gmail, puis exécute aussi le vrai `tools/envoi-mail.gs` dans un environnement isolé. Il vérifie les échéances, le modèle, la désinscription, l'annulation et les réponses incertaines. Il ne remplace pas les tests d'intégration d'un véritable projet de test ni un audit de sécurité.
