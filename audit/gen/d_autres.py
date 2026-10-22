# -*- coding: utf-8 -*-
"""Autres pages du site — 16 constats."""

AU = dict(
    cle='au',
    titre='Autres pages du site',
    intro=("Ces constats viennent des deux premières passes d’analyse. Ils ne concernent pas les trois zones "
           "demandées, mais ils font partie du même produit : les omettre donnerait une image fausse de l’état "
           "du site. Le premier — l’impossibilité de changer de semaine — est d’ailleurs le plus visible de "
           "tout le site après la sécurité."),
    items=[
        dict(id='AU-01', sev='BLOQUANT',
             titre='Le planning ne montre qu’une seule semaine, et rien ne permet d’en changer',
             ou='js/pages/planning-base.js · getWeekDates(), l.64-77 ; planning-interface.js, l.38',
             constat=("`getWeekDates()` calcule la semaine du lundi au dimanche à partir de la date du jour. "
                      "Aucun décalage n’est possible : la fonction n’accepte pas de paramètre de semaine, et il "
                      "n’existe aucun bouton « semaine précédente / suivante » dans `pages/planning.html`."),
             impact=("L’élève ne peut pas voir ce qui l’attend la semaine prochaine — alors que c’est "
                     "précisément là que le site place les révisions des devoirs (DE-14 à DE-16) et les "
                     "sessions d’examen (DE-15). Il doit **attendre lundi**. Toute la valeur du moteur "
                     "prédictif est invisible : on planifie pour un futur qu’on ne peut pas consulter."),
             fix=("Ajouter un état `semaineDecalee` (-1, 0, +1, ou un entier libre) et le passer à "
                  "`getWeekDates(decalage)` ; deux flèches dans l’en-tête, avec les dates affichées (« 20 – 26 "
                  "oct. ») et un retour rapide « Aujourd’hui ». `generateDayEvents` reçoit déjà un index de "
                  "jour : il suffit de lui fournir des dates décalées et de laisser `devoirsDateDuJour` suivre. "
                  "Attention : la navigation de semaine doit aussi corriger PO-01 (la page Séance ne doit pas "
                  "hériter de ce décalage)."),
             effort='1 j'),

        dict(id='AU-02', sev='MAJEUR',
             titre='L’inscription n’annonce ni le nombre d’étapes ni où l’on en est',
             ou='pages/onboarding-*.html (13 fichiers)',
             constat=("La barre de progression affiche « 1 - 2 - … » sans total réel, sans nom d’étape. "
                      "L’élève ne sait pas s’il en a pour deux minutes ou vingt."),
             impact=("C’est la première cause d’abandon dans un formulaire long. Treize étapes sans repère, "
                     "c’est treize occasions de renoncer avant d’avoir vu le produit."),
             fix=("Un bandeau « Étape 4 sur 12 · Tes matières » et une barre réelle (`width: 33%`). Une ligne à "
                  "ajouter dans le gabarit commun aux treize pages."),
             effort='1 h'),

        dict(id='AU-03', sev='MAJEUR',
             titre='Aucune étape facultative ne peut être passée',
             ou='pages/onboarding-*.html ; js/pages/onboarding.js',
             constat=("Chaque étape valide ses champs avant d’autoriser la suivante. Les étapes non "
                      "essentielles (transport, activités, téléphone) n’ont pas de bouton « Passer », et leur "
                      "formulaire est obligatoire."),
             impact=("L’élève qui n’a pas encore son emploi du temps, ou qui ne veut pas donner ses horaires de "
                     "transport, est bloqué à l’étape 5. Il ferme l’onglet. Le site perd un utilisateur sur une "
                     "question qui n’était pas nécessaire."),
             fix=("Un lien « Passer cette étape » sur toutes les étapes non indispensables, et des valeurs par "
                  "défaut raisonnables. Les seules étapes obligatoires sont le prénom et les matières."),
             effort='1 h'),

        dict(id='AU-04', sev='MAJEUR',
             titre='Aucune reprise : après une fermeture, « Commencer » repart au prénom',
             ou='js/pages/onboarding.js · état non persisté',
             constat=("L’avancement de l’inscription vit en mémoire. Fermer l’onglet, perdre le réseau ou "
                      "changer d’application ramène à l’écran 1, sans proposition de reprendre."),
             impact=("Sur téléphone, un appel entrant suffit à tout perdre. L’élève qui a rempli huit étapes "
                     "ne recommence pas : il abandonne."),
             fix=("Persister `onboardingEtape` et les réponses au fil de la saisie, et proposer au retour "
                  "« Reprendre où tu en étais (étape 8) » / « Recommencer »."),
             effort='2 h'),

        dict(id='AU-05', sev='MOYEN',
             titre='Aucun auto-focus, aucune touche Entrée dans l’inscription',
             ou='js/pages/onboarding.js',
             constat=("À chaque changement d’étape, le focus reste où il était — souvent sur un bouton devenu "
                      "invisible. La touche Entrée ne valide pas le champ courant."),
             impact=("Il faut cliquer dans chaque champ, puis aller chercher le bouton. Sur treize étapes, cela "
                     "représente des dizaines de gestes inutiles, et un formulaire qui semble « lent »."),
             fix=("Au changement d’étape : focus sur le premier champ, `Enter` soumet le formulaire, "
                  "`autocomplete` renseigné. Trois lignes par étape."),
             effort='1 h'),

        dict(id='AU-06', sev='BLOQUANT',
             titre='Un exercice ne peut jamais être marqué comme fait : le compteur ne descend jamais',
             ou='js/pages/exercices.js · `done: false` à la création (l.109), l.200-215',
             constat=("`done` est écrit à `false`, lu dans trois filtres (restants, total de minutes, liste à "
                      "planifier), et **jamais repassé à `true`**. Aucun bouton ne propose de le faire. La "
                      "recherche sur l’ensemble du dépôt ne trouve aucune affectation à `true` pour cet objet."),
             impact=("C’est le bug de satisfaction le plus coûteux de la page. Le compteur « exercices "
                     "restants » ne descend jamais, le total de minutes non plus, et le même exercice est "
                     "reproposé à la planification indéfiniment. L’élève travaille, et le site continue de lui "
                     "dire qu’il est en retard. À la troisième semaine, il cesse de regarder la page."),
             fix=("Un bouton « [coche] Fait » sur chaque carte, qui passe `done = true`, écrit le store et "
                  "affiche « 3 faits cette semaine ». Dix lignes. Prévoir aussi l’inverse (décocher) et un "
                  "filtre « faits / à faire »."),
             effort='30 min'),

        dict(id='AU-07', sev='MAJEUR',
             titre='La croix d’un exercice supprime immédiatement, sans confirmation',
             ou='js/pages/exercices.js · deleteExo(), l.182-189 ; bouton l.168',
             constat=("`deleteExo` filtre, écrit, rend. Aucune confirmation, aucune annulation. Le bouton est "
                      "un × de 1,75 rem, sans `aria-label`."),
             impact=("L’élève perd un exercice qu’il venait de scanner — donc le texte extrait et les heures "
                     "qu’il avait réglées. Même défaut que DE-05 et ET-03."),
             fix=("La même primitive d’annulation que ET-03 (toast 8 s). Mutualiser plutôt que réécrire trois "
                  "fois."),
             effort='30 min'),

        dict(id='AU-08', sev='MAJEUR',
             titre='Le fichier d’un exercice est jeté : seul son nom est conservé',
             ou='js/pages/exercices.js · exo.filename, exo.text',
             constat=("Après la lecture, le PDF ou la photo ne sont stockés nulle part. `exo.filename` garde le "
                      "nom, `exo.text` le texte extrait (souvent tronqué)."),
             impact=("L’élève doit retrouver son sujet ailleurs. La promesse implicite (« ajoute ton "
                     "exercice ») n’est pas tenue : le site garde une étiquette, pas le contenu."),
             fix=("Stocker le fichier en IndexedDB (le quota y est bien plus grand que `localStorage`), avec "
                  "une limite explicite (5 Mo) et une purge proposée. Si ce n’est pas fait, le dire clairement : "
                  "« Le fichier reste sur ton appareil, seul son nom est enregistré. »"),
             effort='3 h'),

        dict(id='AU-09', sev='MOYEN',
             titre='Les erreurs de la page Exercices passent par des alert() bloquants',
             ou='js/pages/exercices.js · l.96-98 (6 `alert()` dans le dépôt)',
             constat=("Trois `alert()` valident le formulaire : « Choisis une matière d’abord ! », « Décris ton "
                      "exercice… », « Choisis une date limite ». Ce sont des boîtes natives, grises, non "
                      "stylables, qui bloquent le fil d’exécution."),
             impact=("Sur mobile, l’alerte recouvre le champ fautif : on ne voit pas ce qu’il faut corriger. "
                     "Et l’alerte casse le fil de la saisie, sans laisser de trace à l’écran."),
             fix=("Messages en ligne sous le champ concerné, avec `aria-live`, et focus sur le champ fautif. "
                  "Le composant de message existe ailleurs dans le site."),
             effort='1 h'),

        dict(id='AU-10', sev='MOYEN',
             titre='Les actions destructrices du planning utilisent le confirm() du navigateur',
             ou='js/memoire.js, l.753 ; js/pages/planning-interface.js, l.150 ; js/pages/pomodoro.js, l.75 et l.91',
             constat=("« Effacer toute la progression », « Remettre le planning automatique », « Remplacer le "
                      "Pomodoro en cours », « Changer de rythme » passent par `confirm()`. Quatre occurrences "
                      "dans tout le site, dont deux dans un module mort (AR-04)."),
             impact=("Boîte grise illisible sur mobile, non traduisible, sans contexte (« quel jour ? »). Et "
                     "surtout : le site sait faire de belles modales partout ailleurs, ce qui rend "
                     "l’incohérence visible."),
             fix=("Les remplacer par la modale interne, avec le nom du jour ou de la séance dans le titre. Le "
                  "composant existe ; il ne manque que l’appel."),
             effort='1 h'),

        dict(id='AU-11', sev='MOYEN',
             titre='La page Soutien n’a ni état vide ni zone d’annonce',
             ou='pages/soutien.html (110 lignes) ; js/pages/soutien*.js',
             constat=("Quinze boutons sans `type`, aucune zone `aria-live`, aucun message quand il n’y a rien "
                      "à afficher."),
             impact=("Si rien n’est chargé, la zone reste blanche : l’élève croit à un bug. Au lecteur d’écran, "
                     "les mises à jour sont muettes."),
             fix=("Un état vide explicite (« Rien pour l’instant · voici comment commencer »), `aria-live` sur "
                  "la zone de réponse, `type=\"button\"` partout."),
             effort='1 h'),

        dict(id='AU-12', sev='MINEUR',
             titre='Les champs de recherche n’ont pas d’étiquette',
             ou='pages/boite.html, l.57 (#emploisFiltre) ; autres listes filtrées',
             constat=("`type=\"search\"` avec un `placeholder` seul. Aucun `<label>`, aucun `aria-label`."),
             impact=("« Champ de recherche » sans dire quoi chercher, et le placeholder disparaît à la saisie."),
             fix=("`<label class=\"sr-only\">Chercher un nom</label>` et `aria-live=\"polite\"` sur le compteur "
                  "de résultats."),
             effort='20 min'),

        dict(id='AU-13', sev='MAJEUR',
             titre='« Effacer ma progression » ne dit pas ce qui sera effacé',
             ou='pages/compte.html ; js/compte.js · memoireEffacerSuite',
             constat=("Un bouton rouge, une confirmation qui n’énumère pas les objets concernés (planning, "
                      "devoirs, examens, séances, historique, emploi du temps)."),
             impact=("Un clic peut effacer un semestre. Sans liste, on ne mesure pas ce qu’on perd — et sans "
                     "export (CO-04), on ne peut pas se rattraper."),
             fix=("Une modale qui liste les cinq objets avec leur nombre (« 24 devoirs, 12 cours, 3 exercices »), "
                  "une case « Je comprends », et un bouton « Télécharger mes données d’abord »."),
             effort='1 h'),

        dict(id='AU-14', sev='MOYEN',
             titre='La page Aide n’aide pas : elle renvoie vers un formulaire',
             ou='pages/aide.html',
             constat=("Pas de questions fréquentes, pas de recherche, pas de réponses. Le seul recours est "
                      "d’écrire, avec un e-mail obligatoire."),
             impact=("La question la plus fréquente (« comment ajouter un devoir ? ») coûte un aller-retour, et "
                     "encombre la boîte des quatre responsables."),
             fix=("Cinq questions/réponses repliées en `<details>` en haut de page, le formulaire en dessous. "
                  "Rendre l’e-mail facultatif : si l’élève est connecté, on sait déjà qui il est."),
             effort='1 h 30'),

        dict(id='AU-15', sev='MINEUR',
             titre='La page EE & IA s’affiche vide si son script échoue',
             ou='pages/ee-ia.html',
             constat=("Un `div` vide rempli en JavaScript, sans contenu de repli, sans `aria-live`."),
             impact=("Page blanche, sans explication, sur une fonction dont le nom même (EE, IA) est opaque "
                     "pour un nouvel élève."),
             fix=("Un contenu de repli dans le HTML (« Chargement… » puis message d’erreur) et une phrase qui "
                  "explique ce que sont l’EE et l’IA dans le contexte IB."),
             effort='30 min'),

        dict(id='AU-16', sev='MINEUR',
             titre='Des titres h3 sans h2 au-dessus',
             ou='pages/legende.html',
             constat=("Les sections commencent en h3, sans niveau intermédiaire."),
             impact=("La navigation par titres saute un niveau : le document n’a pas de structure cohérente "
                     "pour un lecteur d’écran."),
             fix=("Passer les titres de section en h2 et garder h3 pour les sous-blocs."),
             effort='10 min'),
    ],
)
