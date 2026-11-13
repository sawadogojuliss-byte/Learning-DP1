# Salon focus — intégration en cours

## Périmètre et comportement

La rubrique est dans les paramètres du Pomodoro uniquement. Le salon a son propre écran et son propre minuteur, commandé par l'organisateur ; le minuteur personnel est mis en pause si nécessaire à l'entrée. L'invité choisit un pseudo et n'a pas à créer de compte ; la vérification du rôle d'organisateur devra être faite par le serveur.

Le compte à rebours est commun. Les six cases sont facultatives et décochées par défaut : le thème du catalogue, les durées du minuteur, l'apparence de l'horloge, les sons choisis, la playlist de sons Studyplan et la citation affichée. L'organisateur peut ouvrir ses réglages, changer les choix et enregistrer à nouveau le partage. Les paramètres reçus ne sont pas écrits dans le stockage du profil de l'invité. Une photo personnelle n'est jamais transmise. Chaque appareil doit autoriser localement le son ; aucun alignement à l'échantillon près n'est promis. L'écran propose la reprise des décors vidéo en cas de blocage.

Le lien d'invitation utilise un identifiant aléatoire dans le fragment d'URL, capturé et retiré dès le début du chargement. Les informations de reprise sont uniquement conservées dans le `sessionStorage` de l'onglet ; elles sont effacées au départ ou à la fermeture. Le pseudo est visible dans le salon. L'organisateur confirme la fermeture ; en cas d'erreur, la sortie locale indique que le salon peut rester ouvert ailleurs. Cette étape ne constitue pas une révocation serveur.

## Contrat du transport à réaliser en dernier

Le module d'interface cherche `window.SALON_FOCUS_TRANSPORT` avant son chargement. Sans transport, la création et l'entrée sont désactivées ; aucune simulation n'est utilisée sur le site réel. Les tests injectent un faux transport local aux navigateurs de test seulement.

- `creer({nom, options, partage, chrono})` → promesse d'une session hôte après authentification et confirmation serveur.
- `rejoindre(id, pseudo)` → promesse d'une session invitée après authentification anonyme isolée et confirmation serveur.
- `reprendre(id)` → promesse d'une session hôte après vérification serveur de l'identité.
- Une session contient `id` (48 caractères hexadécimaux aléatoires cryptographiquement), `role` (`hote` ou `invite`), `maintenant()` (millisecondes estimées dans le référentiel de temps du serveur), `observer(callback, erreur)` (retourne une fonction d'arrêt), `modifier(revision, changement)` (promesse de l'état confirmé complet), `quitter()` et `fermer()`.
- L'observateur transmet `(salle, {connecte})`. L'état complet contient `nom`, `revision`, `ferme`, `chrono`, `options`, `partage`, `membres`. Il ne doit jamais annoncer « connecté » pour une simple donnée en cache ou une écriture locale non confirmée. Il doit reprendre après interruption et traiter fermeture, expiration et erreurs.
- `modifier` doit être transactionnel et comparer la révision ; seules les écritures du propriétaire autorisé sont permises. Aucune écriture différée hors ligne ne doit être présentée comme confirmée. Renvoyer des erreurs en temps utile sans laisser une écriture fantôme en attente.
- Une date de fin est exprimée en temps serveur. Le transport doit étalonner et réétalonner l'écart d'horloge et tenir compte du temps de trajet ; les clients recalculent le temps restant à l'affichage. Tester appareils désynchronisés, mise en veille, reprise et retard réseau. Le chrono du salon ne change pas de phase automatiquement : l'hôte lance explicitement la phase suivante.

## Sécurité et déploiement Firebase — à faire après les autres travaux

1. Concevoir et tester des règles Firestore dédiées : authentification obligatoire, salons impossibles à lister, lecture par connaissance d'un lien à forte entropie, écriture de l'état et fermeture réservées à l'hôte, validation stricte des champs/taille, rôle non forgeable, membres limités à leurs propres données. Prévoir limites, fermeture, expiration et suppression des données ; la seule non-indexation d'un lien ne constitue pas une sécurité complète. Examiner les quotas et protections anti-abus.
2. Isoler l'authentification anonyme du compte Google principal ; ne jamais le déconnecter ou le convertir implicitement. Éviter de journaliser ou transmettre le lien à des services tiers. Indiquer clairement que toute personne qui possède le lien peut rejoindre.
3. Tester les règles avec un émulateur et plusieurs identités, y compris tentatives d'écriture par un invité, accès sans lien, données malformées, refus après fermeture et conflits. Tester ensuite contre un projet Firebase de test, puis le projet réel après autorisation.
4. Activer l'authentification anonyme dans Firebase et publier les règles après sauvegarde et vérification des règles réellement en place. La publication GitHub Pages ne publie pas les règles. Ne pas ouvrir l'accès général à Firestore ni toucher aux données de compte.
5. Ajouter l'adaptateur réel au registre et à l'assembleur, tester sur plusieurs appareils/réseaux et navigateurs, puis seulement activer et publier. Ne pas annoncer une synchronisation réelle sur la seule base des simulations.

## Vérifications disponibles

- `node tools/tester-salon-coeur.cjs` : logique du compte à rebours, limites et filtrage du partage.
- `node tools/tester-salon-apercu.mjs` : interface sans transport (désactivée), responsive.
- `node tools/tester-salon-simulation.mjs` : deux contextes de navigateur et faux transport en mémoire, sélection, audio réellement démarré, création, invitation, rôle, commandes, coupure simulée, reprise après rechargement, fermeture et conservation des préférences. Les permissions, la précision de l'horloge serveur et les reconnexions Firebase réelles ne sont **pas** vérifiées par cette simulation.

L'assembleur contrôlé sait inclure les fichiers du salon sans inclure les autres travaux non liés. Aucun adaptateur Firebase réel n'a été déployé. L'utilisateur indique avoir publié et testé la règle des pseudos ; elle ne couvre pas encore les salons. Ne pas publier la fonctionnalité comme opérationnelle avant les étapes ci-dessus.

## Fonctions supplémentaires — interface et contrat en préparation

L'interface comporte un objectif conservé dans `sessionStorage` par salon, à ne transmettre qu'après choix explicite (y compris la case « accompli »). Elle affiche l'état de partage confirmé et signale un retrait non confirmé ; les données du salon ne doivent pas être reprises comme objectif privé. Elle propose prêt, liste, verrou, transfert, retrait, coup de pouce et réponse prédéfinie, deux ambiances Studyplan, bilan, volume local, mode discret et signal de fin local. Le son doux dépend de l'autorisation audio du navigateur. L'utilisateur choisit lui-même le volume et l'activation de l'audio ; aucune préférence personnelle n'est imposée par l'hôte.

Le futur transport doit fournir un `uid` stable dans la session, `organisateurUid`, `verrouille`, les membres et un bilan confirmé `{secondes, sessions}` dans les états observés, ainsi que les méthodes asynchrones `personnaliser`, `verrouiller`, `transferer`, `retirer`, `demanderAide`, `encourager`. `personnaliser` porte les champs `pret`, `objectifPartage`, `objectif`, `objectifFait` ; seules les données partagées sont transmises. Les autres méthodes reçoivent un booléen ou un UID selon le cas. Les refus d'accès après retrait doivent produire `removed`. Les boutons dépendant de ces méthodes restent désactivés en leur absence. L'interface ne calcule pas un bilan global à partir d'un chronomètre local.

Ces méthodes ne constituent **pas** une implémentation serveur. Avant toute activation : règles atomiques pour le rôle courant (et non l'identité initiale), transferts à un membre présent, verrou à l'entrée sans empêcher les membres existants de se reconnecter, révocation effective de la lecture et des écritures après retrait, prévention de réentrée avec l'identité retirée, limites de taille et de fréquence, encouragements à vocabulaire fixe et expiration ; protocole de suppression et conservation des données ; bilan calculé de manière unique côté serveur même en cas de reconnexion, pause et concurrence. La reprise après transfert doit fonctionner pour un organisateur authentifié anonymement sans affecter le compte Google principal. Tester les tentatives adverses avec l'émulateur puis un projet d'essai.

Le bloc des pseudos ajouté à `firestore.rules` a été fourni à l'utilisateur, qui indique l'avoir publié et testé. **La version effectivement déployée n'a pas pu être lue ni vérifiée depuis cet environnement.** Ce bloc ne met en place ni document parent ni transport, verrou, transfert ou retrait et ne permet pas de considérer le salon comme fonctionnel ou ses permissions complètes. Les règles devront être révisées conjointement avec l'adaptateur réel, sans élargir l'accès aux autres collections. Le test `tester-salon-fonctions.mjs` est une simulation multi-navigateurs, pas un test des règles Firebase.

## Liens distincts et arrivée en cours de séance

`SalonFocusCoeur.nouvelIdentifiant(crypto)` produit 24 octets cryptographiquement aléatoires (48 caractères hexadécimaux) et échoue si une source d'aléa sûre n'est pas disponible. Le futur transport doit l'utiliser pour chaque création, vérifier l'absence de collision par une création atomique et ne jamais générer de lien avant confirmation serveur. Il doit enregistrer la phase, le temps restant ou l'échéance serveur et les choix cochés ; un invité arrivant plus tard lit cet état confirmé au lieu de redémarrer une séance. La synchronisation de l'horloge avec le serveur reste indispensable.

Le sélecteur indique combien d'éléments facultatifs sont choisis. `tester-salon-coeur.cjs` couvre les 64 combinaisons, dont aucune, une et deux ; `tester-salon-liens.mjs` simule deux salons à identifiants distincts, leurs paramètres indépendants et une arrivée pendant le compte à rebours. Ce test utilise un serveur en mémoire injecté uniquement dans le navigateur de test. Il ne prouve pas que la création de liens ou l'accès Firebase fonctionnent en ligne.

La règle des pseudos transmise antérieurement ne permet que des documents membres réduits à `pseudo` sous un salon parent existant. Elle ne permet pas la création, la lecture et la modification du salon parent et ne suffit donc pas pour la synchronisation réelle. L'authentification anonyme doit également être activée dans le projet pour les invités sans compte. Il faut adapter et tester les règles en place avec l'utilisateur et intégrer un transport avant activation.

## Prototype Firebase — non activé

L'utilisateur indique avoir activé l'authentification anonyme. `js/pages/salon-focus-firebase.js` est un **prototype non chargé** : il utilise le compte Firebase principal de l'organisateur, un second contexte Firebase anonyme avec persistance d'onglet pour l'invité, et une transaction pour créer ou rejoindre un salon. La création utilise `nouvelIdentifiant`, les contenus sont filtrés par case cochée, la session reçue contient une échéance commune, et un document d'horloge avec horodatage serveur permet d'estimer le décalage de chaque appareil. Les révisions protègent les modifications simultanées et les données non confirmées du cache ne remplacent pas les données serveur dans l'observateur.

`firestore.rules` contient localement une **proposition non validée** qui remplace le seul bloc pseudos par des permissions pour l'horloge, l'état et les membres. Elle n'a pas été publiée ; les autres règles ont été conservées. Elle ne couvre pas les fonctionnalités supplémentaires de verrouillage, transfert, retrait, objectifs partagés ou réactions : ces actions restent indisponibles dans ce prototype. Le lien contient un secret à forte entropie : toute personne authentifiée qui possède un lien d'un salon ouvert non verrouillé peut accéder à son état et à ses pseudos.

Avant activation : exécuter les règles dans l'émulateur Firebase avec identités Google et anonymes multiples, vérifier les règles réellement déployées, configurer l'effacement serveur à l'expiration (TTL ne supprime pas les sous-collections), limiter les abus et les coûts, puis tester toutes les opérations sur un projet Firebase de test et plusieurs navigateurs. Vérifier notamment collision, refus invité, document absent, règles `getAfter`, expiration, fermeture, opérations atomiques, interruptions, horloge désynchronisée, veille et permissions du stockage. La mise en ligne du code ou des règles avant ces tests serait prématurée. `tester-salon-transport.cjs` utilise un double Firestore ; il ne valide ni le compilateur des règles ni leur sécurité réelle. Aucun déploiement Firebase n'a été effectué depuis cet environnement.

## Publication expérimentale à la demande de l'utilisateur

L'utilisateur indique avoir activé l'authentification anonyme et publié les règles proposées. Il demande la mise en ligne pour tester lui-même, sans exécuter de vérifications. Le transport est donc branché pour cet essai, sans validation réelle préalable. Le site indique clairement que c'est un essai et recommande des données fictives. Les actions supplémentaires non supportées par le transport restent désactivées. Le lien donne accès aux données partagées aux personnes qui le connaissent. Aucun effacement automatique ni protection anti-abus complète n'est encore configuré. Une expiration refuse l'accès mais ne supprime pas les documents ou sous-collections.

La publication sans tests est limitée au commit portant le marqueur `[essai sans tests]` ; les tests automatiques habituels restent en place pour les commits suivants. Ne pas considérer cette publication comme une validation de sécurité, une vérification Firebase ou l'achèvement des fonctions de gestion du groupe.
