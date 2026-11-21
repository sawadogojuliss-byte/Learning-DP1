# Réactivité des thèmes et des sons

Le changement d'un décor affiche d'abord sa miniature déjà présente dans la galerie si elle est décodée, puis la remplace par l'image complète dès que celle-ci est disponible. Le décor précédent reste en place tant que la miniature n'est pas prête. Les téléchargements et décodages simultanés d'une même image sont partagés entre les deux pages ; un résultat tardif ne peut pas écraser un choix plus récent. Le survol, le focus clavier ou le toucher d'une tuile préparent l'image complète, sauf sur les connexions économes ou lentes.

Pour un son, le survol, le focus ou le toucher préparent silencieusement les métadonnées d'un seul fichier à la fois. Le clic réutilise ce lecteur et reste indispensable pour lancer la lecture ; le préchargement spéculatif est désactivé en mode économie de données ou sur réseau lent. Ces mesures améliorent le retour perçu et peuvent accélérer le premier son, mais ne garantissent pas un chargement instantané : celui-ci dépend toujours de la connexion et du navigateur.

`node tools/tester-latence-pomodoro.mjs` vérifie avec un vrai navigateur l'affichage de la miniature pendant un téléchargement complet volontairement bloqué, les changements rapides de thème, le téléchargement unique, le préchargement silencieux et sa désactivation en économie de données.
