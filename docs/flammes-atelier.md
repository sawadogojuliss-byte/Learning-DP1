# Flammes dans l’Atelier admin

Les pastilles individuelles affichent la série enregistrée et son jour, pas une estimation depuis l’archive du planning. Le symbole « — » signifie que la valeur est indisponible, et non zéro. Les filtres et les compteurs de réception concernent toujours les plannings.

L’association exige un document `emplois_du_temps/{uid}` dont l’UID technique correspond à son identifiant ; un nom, une adresse déclarée ou une ancienne archive ne suffisent pas. La fiche privée `documents/{uid}` est lue depuis le serveur par l’admin, à l’ouverture puis au plus une fois par minute pendant la consultation (ou immédiatement sur Actualiser). Une lecture refusée, une fiche absente ou une valeur invalide donne « — ». Ces garanties supposent que les règles Firestore du dépôt sont déployées ; la publication Pages ne déploie pas les règles.

Lorsqu’un élève connecté utilise une version récente du site, sa progression est synchronisée selon le cycle de flammes existant. Une transaction distincte relit cette progression pour publier la série dans sa fiche, sans empêcher la sauvegarde privée si la fiche est refusée. Une écriture de fiche tardive relit elle aussi la progression dans une transaction. La date affichée est celle de la dernière activité enregistrée, et non une promesse que l’élève s’est connecté aujourd’hui. Une personne hors ligne ou utilisant une ancienne version du site peut avoir une valeur ancienne jusqu’à sa prochaine synchronisation.

Essais sans réseau et sans mail : `node tools/verifier-flammes-admin.cjs`, `node tools/verifier-flammes-exercices.js`, et `tools/tester-flammes-admin.mjs` contre un site local assemblé.
