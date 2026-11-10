# Synchronisation du compte

## Parcours

1. Les modifications sont enregistrées dans le navigateur. Un profil utile, lié au compte connecté, est envoyé après regroupement des changements. La sauvegarde locale reste disponible sans réseau.
2. La progression est stockée dans `progressions/{uid}` sur Firestore. L'accès est réservé au compte propriétaire par les règles Firestore. La fiche administrative `documents/{uid}` et la fiche d'emploi du temps de la semaine sont des écritures distinctes ; elles ne constituent pas une transaction unique avec la progression.
3. Avant d'écrire la progression, une transaction lit la version courante, fusionne les listes, leurs dates de modification et les suppressions connues, puis écrit le résultat. Firestore peut réexécuter la transaction en cas d'écriture concurrente. Les modifications locales faites pendant l'attente restent sur l'appareil et sont envoyées à nouveau.
4. Les autres appareils connectés écoutent la progression ; si un appareil a des changements locaux en attente, ils sont conservés pour la prochaine fusion. Au retour d'Internet, une nouvelle tentative est programmée. Une progression distante illisible n'est pas remplacée.
5. Les réglages Pomodoro inclus dans `focusReglages`, notamment la citation personnelle, déclenchent aussi une sauvegarde après une courte attente. Le minuteur en cours n'est pas synchronisé entre appareils.

Google Drive `appDataFolder` reste une sauvegarde distincte, facultative et soumise à son autorisation ; l'envoi échoue si une copie distante ne peut pas être lue. Les transactions décrites ici concernent Firestore, pas Drive.

## Limites et vérifications

- Les essais automatisés utilisent deux appareils et un Firestore **simulé** ; ils ne démontrent pas l'authentification Google ni le comportement du service Firestore réel. Aucun compte élève réel n'est utilisé par ces tests.
- Les suppressions sont conservées 60 jours et plafonnées à 2 000 par liste. Un appareil resté trop longtemps hors ligne peut donc conserver une copie ancienne. Les dates de modifications dépendent aussi des horloges des appareils.
- Certaines valeurs du profil et les réglages Pomodoro sont fusionnés par groupe ou copie, et non champ par champ : deux changements simultanés au même réglage peuvent entrer en conflit. Les anciennes versions de l'application n'utilisent pas la nouvelle transaction.
- La reconnexion conserve une modification locale du même compte lorsqu'une empreinte précédente permet d'identifier un changement non envoyé. Sans repère précédent, une copie locale ancienne et un travail inédit ne sont pas toujours distinguables.
- L'échec d'envoi est journalisé dans la console ; l'interface ne dispose pas encore d'un indicateur fiable de synchronisation réussie ou en attente. Une sauvegarde dépassant la limite Firestore (900 000 caractères) ne peut pas être envoyée.

Test principal : `node tools/verifier-synchro-deux-telephones.js` ; autres contrôles : `node tools/verifier-synchro.js`, `node tools/verifier-semaine-sync.js` et les vérifications de compte et de rechargement.
