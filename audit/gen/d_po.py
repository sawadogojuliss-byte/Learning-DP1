# -*- coding: utf-8 -*-
"""Pomodoro et page Séance — 20 constats."""

PO = dict(
    cle='po',
    titre='Pomodoro et page Séance',
    intro=("Le minuteur est la partie la plus soignée du site : interface accessible, chrono fondé sur une "
           "heure absolue, voix de fin de séance testée en navigateur réel. C’est aussi celle où deux "
           "systèmes coexistent encore, et où le décor choisi par l’élève est effacé à chaque ouverture. Les "
           "défauts listés ici ne sont pas des manques de finition : ils touchent le contrat de base — "
           "« ce que je vois est bien d’aujourd’hui »."),
    items=[
        dict(id='PO-01', sev='BLOQUANT',
             titre='La page Séance affiche les séances du dernier jour cliqué dans le planning, sous la date du jour',
             ou='js/pages/pomodoro-page.js · focusJourIndex(), l.232-236 ; focusDateTexte(), l.277 ; focusPeindreAccueil(), l.348',
             constat=("`focusJourIndex()` retourne `selectedDay` — la variable du **planning** — dès qu’elle "
                      "vaut 0 à 6. Or `selectDay()` (`planning-base.js`, l.367) la modifie à chaque clic sur un "
                      "onglet de jour, et le profil la synchronise même entre appareils. L’en-tête, lui, "
                      "affiche toujours `new Date()`. Enfin `focusStatSeance()` compare les horaires des "
                      "séances à l’heure **actuelle** pour étiqueter « En cours », « À venir », « Terminée »."),
             impact=("L’élève clique sur vendredi dans son planning, puis ouvre « Séances du jour » : la page "
                     "annonce « Mercredi 22 octobre » et liste **les séances de vendredi**, en les déclarant « À "
                     "venir » ou « Terminée » selon l’heure de mercredi. C’est l’écran d’entrée du minuteur, "
                     "celui qui décide quelle séance va devenir l’objectif. Un contresens ici fausse tout ce qui "
                     "suit : l’élève lance un chrono sur une séance qui n’est pas la sienne, puis s’étonne que "
                     "son planning ne corresponde pas."),
             fix=("Découpler les deux notions. `focusJourIndex()` doit retourner `indexJourCourant()` "
                  "(aujourd’hui) et **jamais** `selectedDay` ; si l’on veut permettre de consulter un autre "
                  "jour, introduire un état local `focusJour` propre à la page, avec un sélecteur explicite et "
                  "un titre qui affiche la date de ce jour-là. `focusDateTexte()` doit accepter le jour "
                  "affiché en paramètre, pour que le titre et la liste ne puissent plus diverger. Un test de "
                  "non-régression : sélectionner vendredi dans le planning, ouvrir la page Séance, vérifier que "
                  "le titre et la liste parlent du même jour."),
             effort='1 h + test'),

        dict(id='PO-02', sev='BLOQUANT',
             titre='Le décor choisi par l’élève n’est jamais conservé : il est réécrit et réinitialisé',
             ou='js/pages/pomodoro-page.js · focusCharger(), l.124-142 ; focusPoserFond(), l.567-576 ; focusOuvrirSeances(), l.163 ; focusOuvrirMinuteur(), l.179',
             constat=("Deux défauts se cumulent. (1) `focusPoserFond()` écrit bien `studyPlanIB_focusFond` dans "
                      "`localStorage` (l.571), mais **aucune lecture** de cette clé n’existe dans le fichier : "
                      "`focusCharger()` force `focusStat.fond = focusIndexParId(\'lumiere\')`. (2) Même si elle "
                      "était lue, `focusOuvrirSeances()` et `focusOuvrirMinuteur()` appellent toutes deux "
                      "`focusPoserFond(focusIndexParId(\'lumiere\'), true)` : entrer dans la page remet le décor "
                      "par défaut. C’est donc un écrasement, pas seulement un oubli."),
             impact=("L’élève passe deux minutes à choisir un fond, une ambiance, une couleur de chrono. Il "
                     "quitte la page, revient : tout est revenu au décor d’usine. Le geste de personnalisation "
                     "— celui qui attache à un outil qu’on utilise tous les jours — est annulé à chaque visite. "
                     "C’est la définition d’un réglage qui ne sert à rien."),
             fix=("Une seule source : lire `studyPlanIB_focusFond` au chargement, avec repli sur `lumiere` "
                  "uniquement si la clé est absente ou invalide. Supprimer le second argument "
                  "`forcer = true` des deux appels d’ouverture, ou le réserver à un bouton « Rétablir le décor "
                  "par défaut ». Ajouter le fond à l’objet `focusReglages` synchronisé (SY-04) pour qu’il suive "
                  "l’élève d’un appareil à l’autre. Test : choisir un fond, recharger, vérifier qu’il est "
                  "toujours là."),
             effort='30 min'),

        dict(id='PO-03', sev='MAJEUR',
             titre='Le chronomètre n’est jamais sauvegardé : un rechargement remet tout à zéro',
             ou='js/pages/pomodoro-page.js · focusEtat (objet en mémoire) ; aucun `setItem` de l’état courant',
             constat=("`focusEtat` contient le mode, le total, le restant, l’état `running` et les cycles. Il "
                      "n’est écrit nulle part : seules les durées réglées et les tâches le sont. Un "
                      "rechargement de page — ou un retour d’arrière-plan qui tue l’onglet sur iOS — repart à "
                      "zéro."),
             impact=("L’élève lance une concentration de 25 minutes, verrouille son téléphone, le déverrouille : "
                     "le chrono est revenu à 25:00 et ne tourne plus. Il ne sait pas s’il doit recommencer, ni "
                     "ce qu’il a réellement travaillé. Sur mobile, c’est le cas normal, pas l’exception."),
             fix=("Persister un état minimal dans `localStorage` à chaque changement de phase et toutes les "
                  "5 secondes : `{ mode, total, restant, running, cycles, date }`. Au chargement, si la date "
                  "est le jour même, restaurer ; si le chrono tournait, recalculer le restant à partir de "
                  "l’heure absolue (`finPrevue`) plutôt que de dépendre de l’intervalle — le site sait déjà le "
                  "faire pour la séance (`planning-base.js`). Si la date n’est pas le jour même, repartir "
                  "proprement en le disant."),
             effort='1 h 30'),

        dict(id='PO-04', sev='MAJEUR',
             titre='Un second minuteur, jamais branché, enchaîne automatiquement concentration et pause',
             ou='js/pages/pomodoro.js · v3BuildPomodoroPlan(), l.27 ; v3PomoAdvance(), l.164 ; chargé par js/registre.js, l.65',
             constat=("Un ancien moteur Pomodoro (`pomodoro.js`) est encore chargé par le registre alors "
                      "qu’aucune page ne l’utilise. Il contient sa propre logique d’enchaînement : à la fin "
                      "d’une concentration, `v3PomoAdvance()` **relance automatiquement** la pause puis la "
                      "concentration suivante, sans intervention."),
             impact=("Le module est mort, donc le défaut est latent — mais il est chargé sur toutes les pages, "
                     "et il suffit qu’un futur correctif rebranche une de ses fonctions pour ressusciter un "
                     "comportement que le site s’interdit : **jamais de nouvelle concentration automatique**. "
                     "C’est une bombe à retardement posée dans le code, et elle pèse sur le démarrage (PE-01)."),
             fix=("Supprimer le module et son inscription au registre (AR-04), ou le vider de toute logique "
                  "d’enchaînement. S’il reste des fonctions utilitaires utiles (`v3BuildPomodoroPlan` pour le "
                  "texte des séances), les déplacer dans `pomodoro-page.js` et supprimer le reste. Un test "
                  "grep suffit : aucune fonction du site ne doit appeler `v3PomoAdvance`."),
             effort='1 h'),

        dict(id='PO-05', sev='MAJEUR',
             titre='Deux jeux de durées coexistent, et le compteur affiché contredit le minuteur',
             ou='js/pages/pomodoro-page.js · focusNombrePomodoros(), l.225 ; focusDurees(), l.99 ; js/pages/pomodoro.js · v3BuildPomodoroPlan(), l.27',
             constat=("Le minuteur lit ses durées dans `studyPlanIB_focusDurees` (réglables : 1 à 180 min). Le "
                      "compteur de la page Séance lit `studyPlanIB_pomodoroPreset` (25/5 ou 50/15) via "
                      "`v3BuildPomodoroPlan`. Le libellé est de surcroît **écrit en dur** : `return n + \' × 25 "
                      "min\'`. Et la statistique de l’accueil affiche le texte fixe « sessions de 25 min »."),
             impact=("L’élève règle sa concentration à 40 minutes. La page Séance lui annonce « 2 × 25 min » "
                     "pour une séance de 50 minutes, puis le minuteur démarre à 40:00. Les deux nombres ne "
                     "peuvent pas être vrais en même temps : l’un des deux est faux, et l’élève n’a aucun moyen "
                     "de savoir lequel. Sur un site qui vend de la méthode, une arithmétique qui se contredit "
                     "est dévastatrice."),
             fix=("Une seule source de vérité : `focusDurees()`. Réécrire `focusPomodorosTexte` et "
                  "`focusNombrePomodoros` pour calculer à partir de `focusDurees().focus / .short`, et "
                  "supprimer `studyPlanIB_pomodoroPreset` (ou le migrer une fois vers `focusDurees`). "
                  "Remplacer le libellé fixe « sessions de 25 min » par le calcul de la durée réellement réglée."),
             effort='1 h'),

        dict(id='PO-06', sev='MAJEUR',
             titre='La copie, la sélection et le clic droit sont bloqués sur toute la page Pomodoro',
             ou='js/pages/pomodoro-page.js · focusBrancher(), l.1554-1580',
             constat=("Cinq écouteurs globaux annulent `copy`, `cut`, `selectstart`, `contextmenu` et les "
                      "raccourcis Ctrl+C / Ctrl+X / Ctrl+A **quand le panneau Pomodoro est actif**. Le test ne "
                      "regarde pas si la cible est un champ de saisie ou du texte affiché : il s’applique à tout."),
             impact=("Impossible de sélectionner le texte de son objectif pour le corriger, de copier une "
                     "tâche, ou d’ouvrir le menu contextuel pour coller. Sur un champ de saisie, "
                     "l’interception de `selectstart` peut empêcher la sélection au doigt. L’élève ne sait pas "
                     "que c’est voulu : il croit que le champ est cassé. C’est une protection invisible qui "
                     "coûte plus qu’elle ne protège."),
             fix=("Retirer ces écouteurs. S’ils protégeaient un contenu payant ou une consigne, la protection "
                  "doit porter sur l’élément concerné, pas sur la page. Si le but était d’éviter qu’un appui "
                  "long ouvre un menu pendant le chrono, cibler les seuls éléments décoratifs."),
             effort='20 min'),

        dict(id='PO-07', sev='MOYEN',
             titre='La barre d’espace déclenche le chrono même quand un bouton a le focus',
             ou='js/pages/pomodoro-page.js · écouteur `keydown` global (Espace)',
             constat=("Un écouteur global intercepte la barre d’espace pour lancer ou mettre en pause. Il ne "
                      "vérifie pas si l’événement vient d’un bouton, d’un champ ou d’une zone de texte : dans un "
                      "navigateur, la barre d’espace active déjà le bouton qui a le focus. L’action est donc "
                      "jouée deux fois, ou au mauvais moment."),
             impact=("L’élève tabule jusqu’au bouton « Régler les durées », appuie sur Espace pour l’activer : "
                     "le chrono démarre, et la modale s’ouvre. Ou l’inverse. Le comportement est imprévisible, "
                     "et il tombe précisément sur ceux qui naviguent au clavier."),
             fix=("Ignorer l’événement si `event.target` est un élément interactif (`button`, `input`, "
                  "`textarea`, `select`, `[contenteditable]`), et appeler `preventDefault()` seulement quand "
                  "l’action est réellement prise. Documenter le raccourci dans une infobulle."),
             effort='30 min'),

        dict(id='PO-08', sev='MOYEN',
             titre='La question « Combien de séances ? » ne peut pas être annulée',
             ou='js/pages/pomodoro-page.js · focusDemanderSeances() ; js/pages/devoirs.js · devoirsDemanderSeances()',
             constat=("La question est posée avec un `prompt()` natif dans certains chemins : si l’élève appuie "
                      "sur « Annuler », la valeur renvoyée est `null` et le code la convertit en 0 ou en "
                      "valeur par défaut, sans distinguer « je ne veux pas » de « zéro »."),
             impact=("L’élève change d’avis, appuie sur Annuler… et la séance est tout de même créée avec un "
                     "nombre par défaut. Ou l’action échoue silencieusement. Dans les deux cas, il n’a pas été "
                     "entendu."),
             fix=("Remplacer le `prompt()` par la modale interne, avec trois issues : Annuler (ne rien faire), "
                  "« Aucune séance » (0, choix légitime), et une valeur. Traiter `null` comme une annulation "
                  "explicite partout où un prompt subsiste."),
             effort='1 h'),

        dict(id='PO-09', sev='MOYEN',
             titre='Aucun moyen de couper la voix de fin de séance',
             ou='js/pages/chrono-voix.js · chronoAnnoncerPause() ; aucune préférence « voix »',
             constat=("La voix est déclenchée à chaque fin de phase, sans réglage. Il n’y a ni interrupteur, ni "
                      "volume, ni choix de voix. Le seul moyen de l’éviter est de couper le son de l’appareil — "
                      "ce qui coupe aussi le bip."),
             impact=("En cours, en bibliothèque, le soir dans une chambre partagée, une voix qui parle sans "
                     "prévenir est gênante. Certains élèves couperont le son de l’appareil, et perdront aussi "
                     "le repère sonore. D’autres quitteront le minuteur. Un réglage manquant transforme une "
                     "bonne idée en nuisance."),
             fix=("Ajouter `voix: true | false` et `volume: 0-100` dans `focusDurees` (ou dans un objet "
                  "`focusReglages`), avec un interrupteur dans la modale de réglages. Le bip reste "
                  "indépendant : on peut vouloir le repère sans la voix. Mémoriser le choix et le respecter "
                  "dans `chronoAnnoncerPause()` comme dans `chronoAnnoncerReprise()`."),
             effort='1 h'),

        dict(id='PO-10', sev='MOYEN',
             titre='Le son d’ambiance choisi n’est pas conservé après un rechargement',
             ou='js/pages/musique.js · aucune occurrence de `localStorage`',
             constat=("Le module de musique ne lit ni n’écrit aucune préférence : le son choisi vit uniquement "
                      "en mémoire. Chaque rechargement — et chaque retour sur la page — repart sur le silence "
                      "ou sur le son par défaut."),
             impact=("L’élève choisit « pluie » pour travailler, met le chrono en route, revient le lendemain : "
                     "le silence. Il doit refaire le choix à chaque session, alors que c’est précisément le "
                     "genre de réglage qu’on règle une fois."),
             fix=("Une clé `studyPlanIB_focusSon` (identifiant du son, volume, actif), lue au chargement et "
                  "écrite au changement. L’inclure dans `focusReglages` synchronisé (SY-04) si l’on veut qu’il "
                  "suive d’un appareil à l’autre. Ne jamais démarrer automatiquement : restaurer le choix, mais "
                  "attendre un geste pour jouer (politique navigateur)."),
             effort='45 min'),

        dict(id='PO-11', sev='MOYEN',
             titre='La boucle de 250 ms repeint toute la page, y compris les vignettes et le titre de l’onglet',
             ou='js/pages/pomodoro-page.js · focusPeindre(), intervalle `setInterval(…, 250)`',
             constat=("Quatre fois par seconde, la fonction de rendu reconstruit l’ensemble de l’interface : "
                      "le chrono, mais aussi les cartes de séance, les vignettes de décor et le titre du "
                      "document (`document.title`). Chaque passage réécrit des nœuds DOM identiques."),
             impact=("Sur un téléphone modeste, cela suffit à rendre le défilement saccadé et à vider la "
                     "batterie plus vite qu’un chrono ne le devrait. Et le titre de l’onglet qui change quatre "
                     "fois par seconde empêche de retrouver l’onglet dans la barre."),
             fix=("Séparer le rendu : une fonction `focusPeindreChrono()` qui ne touche que les nœuds du temps "
                  "(minutes, secondes, barre), appelée toutes les 250 ms ; le reste (cartes, vignettes, titre) "
                  "ne se redessine qu’au changement d’état. Mettre à jour le titre une fois par minute, pas "
                  "quatre fois par seconde."),
             effort='1 h 30'),

        dict(id='PO-12', sev='MOYEN',
             titre='Le compteur de cycles repart de zéro à chaque rechargement : la pause longue n’arrive jamais',
             ou='js/pages/pomodoro-page.js · focusEtat.cycles, l.57 et l.644',
             constat=("`focusEtat.cycles` n’est jamais persisté. Il est initialisé à 0 à chaque chargement. Or "
                      "c’est lui qui décide de la pause longue (`cycles % 4 === 0`)."),
             impact=("Si l’élève recharge la page entre deux sessions — ce qui arrive à chaque changement "
                     "d’application sur téléphone — il n’atteindra jamais quatre cycles consécutifs. La pause "
                     "longue, promise par le texte du panneau (« toutes les 4 concentrations »), ne se "
                     "déclenchera jamais."),
             fix=("Inclure `cycles` dans l’état persisté de PO-03, avec la date du jour : le compteur se remet à "
                  "zéro à minuit, pas à chaque rechargement. Afficher le cycle en cours près du chrono "
                  "(« cycle 2 / 4 ») pour que la promesse soit visible."),
             effort='30 min (avec PO-03)'),

        dict(id='PO-13', sev='MOYEN',
             titre='La musique revient par-dessus la voix si l’élève relance la pause trop vite',
             ou='js/pages/pomodoro-page.js · focusPhaseSuivante(), l.633-657 ; js/pages/chrono-voix.js, l.377-399',
             constat=("`chronoAnnoncerPause()` coupe la musique, joue le bip, puis attend **760 ms** avant de "
                      "faire parler la voix. Si l’élève appuie sur « lecture » dans cet intervalle, "
                      "`focusBasculer()` appelle `chronoRendreMusique()`, qui relance l’ambiance pendant que la "
                      "voix commence."),
             impact=("Le point le plus soigné du site — « la musique se tait, la voix parle seule » — est cassé "
                     "par un geste parfaitement naturel : relancer la pause tout de suite. Le résultat sonore "
                     "est confus, et l’élève n’a aucun moyen de comprendre que c’est l’ordre de ses propres "
                     "clics qui a posé problème."),
             fix=("Rendre la reprise de la musique **conditionnée à la fin de l’annonce** : un drapeau "
                  "`chronoVoixEnCours` posé au début de `chronoAnnoncerPause` et levé à la fin (ou après un "
                  "délai maximum de 12 s). `chronoRendreMusique()` ne fait rien si le drapeau est posé ; "
                  "`chronoAnnoncerPause` rappelle ensuite `chronoRendreMusique()` si une reprise a été demandée "
                  "entre-temps. C’est une file d’attente d’un seul élément, pas une refonte."),
             effort='45 min'),

        dict(id='PO-14', sev='MINEUR',
             titre='La voix de fin de pause n’existe pas : la pause se termine en silence',
             ou='js/pages/chrono-voix.js · chronoAnnoncerReprise(), l.401 ; audio/voix/ (28 fichiers, aucun `pause-fin`)',
             constat=("`chronoAnnoncerPause()` coupe la musique, joue le bip, puis la phrase « … minutes de "
                      "pause » — conforme à ce qui a été demandé. `chronoAnnoncerReprise()`, elle, joue un bip "
                      "puis **rien** : le fichier `pause-fin.wav` n’existe pas dans `audio/voix/`. Le code est "
                      "prêt, le son manque."),
             impact=("La pause se termine par un bip sec, sans la voix qui doit annoncer la reprise. C’est la "
                     "seule fonctionnalité sonore annoncée mais absente, et elle s’entend à chaque cycle. Le "
                     "contraste avec la fin de concentration, elle, soignée, la rend plus visible."),
             fix=("Enregistrer `pause-fin.wav` avec la même voix que les autres fichiers, sur le modèle de "
                  "`seance-fin` : « La pause est terminée. » (et, si l’on veut, « Tu peux reprendre. »). "
                  "Déposer le fichier dans `audio/voix/`, vérifier que `chronoVoixUrl()` le résout, et ajouter "
                  "le cas au test navigateur `tools/tester-voix.mjs`. À faire en même temps que le passage au "
                  "tutoiement (PO-15), pour ne pas enregistrer deux fois."),
             effort='1 h (dont enregistrement)'),

        dict(id='PO-15', sev='MINEUR',
             titre='La voix vouvoie l’élève alors que tout le site le tutoie',
             ou='audio/voix/*.wav ; js/pages/chrono-voix.js · chronoVoixPhrasePause()',
             constat=("Les 28 fichiers de voix ont été enregistrés avec des formulations de type « votre pause "
                      "se termine ». Le reste du site — accueil, planning, devoirs — tutoie systématiquement."),
             impact=("La voix est le seul endroit du produit qui parle comme un manuel. Ce n’est pas un défaut "
                     "fonctionnel, mais c’est une rupture de ton audible, au moment le plus intime de "
                     "l’expérience : la fin d’une séance de travail."),
             fix=("Réenregistrer les phrases avec « ta pause », « ta séance », « tu peux reprendre ». Profiter "
                  "de la séance pour enregistrer `pause-fin.wav` (PO-14). Vérifier la prononciation des nombres "
                  "1 à 60, déjà traitée, sur les nouvelles prises."),
             effort='2 h'),

        dict(id='PO-16', sev='MOYEN',
             titre='Lancer une séance écrase l’objectif que l’élève avait tapé',
             ou='js/pages/pomodoro-page.js · focusEntrerPiece()',
             constat=("Quand une séance est lancée depuis le planning, son titre est écrit dans le champ "
                      "« objectif » sans regarder ce qui s’y trouve déjà. Un objectif saisi à la main — « finir "
                      "le TP de chimie » — est remplacé par « Révision · Histoire »."),
             impact=("L’élève perd sa formulation, et le compte rendu de séance portera un intitulé qui ne "
                     "correspond pas à ce qu’il a réellement fait. Les statistiques deviennent fausses, et "
                     "l’élève ne comprend pas pourquoi son texte a disparu."),
             fix=("Si le champ est vide, le remplir. S’il contient déjà quelque chose, proposer : conserver "
                  "l’objectif existant, ou l’ajouter à la suite (« Révision · Histoire — finir le TP »). "
                  "Afficher un lien « utiliser le titre de la séance » plutôt qu’un écrasement."),
             effort='30 min'),

        dict(id='PO-17', sev='MINEUR',
             titre='Si le script ne se charge pas, le panneau Pomodoro est une page vide sans explication',
             ou='pages/pomodoro.html · #focusPage ; pages/seances.html · #focusAccueil',
             constat=("Les deux pages ne contiennent qu’un conteneur vide, rempli par JavaScript. Aucun "
                      "contenu de repli, aucun message d’erreur, aucun `noscript`. Un échec de chargement — "
                      "réseau, cache, erreur de syntaxe — laisse un écran blanc."),
             impact=("L’élève voit une page vide et en conclut que le site est cassé. Il n’a aucun moyen de "
                     "savoir s’il doit attendre, recharger ou revenir plus tard. C’est le pire état d’erreur : "
                     "silencieux et total."),
             fix=("Mettre un contenu de repli dans le HTML (« Le minuteur se prépare… ») et le remplacer au "
                  "chargement ; si le script échoue, laisser un message explicite avec un bouton « Recharger ». "
                  "C’est le même correctif que PE-03, appliqué à ces deux pages."),
             effort='30 min'),

        dict(id='PO-18', sev='MINEUR',
             titre='Les onglets de mode ne sont pas annoncés comme sélectionnés',
             ou='js/pages/pomodoro-page.js · focusPeindre(), boutons de mode',
             constat=("Les trois modes (Concentration, Pause courte, Pause longue) sont des boutons dont "
                      "l’état actif est purement visuel (classe CSS). Ni `aria-selected`, ni `role=\"tab\"`, ni "
                      "`aria-pressed` : un lecteur d’écran annonce trois boutons identiques."),
             impact=("L’élève non-voyant ne peut pas savoir dans quel mode il est, ni lequel des trois est "
                     "actif. Il appuie au hasard, et le chrono change de durée sans qu’il l’ait voulu."),
             fix=("Ajouter `aria-pressed=\"true|false\"` sur chaque bouton (ou `role=\"tab\"` + "
                  "`aria-selected` sur le conteneur), et une zone `aria-live=\"polite\"` qui annonce « Mode "
                  "pause courte, 5 minutes » au changement."),
             effort='20 min'),

        dict(id='PO-19', sev='MOYEN',
             titre='Le chrono continue quand on quitte la page, mais rien ne le rappelle',
             ou='js/pages/pomodoro-page.js · focusBasculer(), focusMaison(), navigation.js',
             constat=("C’est un bon choix : l’intervalle n’est pas arrêté par la navigation, et la fin de phase "
                      "sonne même si l’élève est retourné au planning. Mais aucun bandeau, aucune pastille, "
                      "aucun indicateur ne signale que le minuteur tourne encore ailleurs."),
             impact=("L’élève quitte la page, travaille, puis ne sait plus si son chrono tourne. Il rouvre la "
                     "page, voit un temps qui n’a plus de sens, et perd confiance dans le décompte. La "
                     "fonctionnalité existe mais elle est invisible."),
             fix=("Un indicateur global discret dans l’en-tête du planning (« [chrono] 12:34 ») tant qu’un "
                  "minuteur tourne, cliquable pour revenir à la page Pomodoro. Il s’appuie sur `focusEtat.running` "
                  "et sur l’état persisté de PO-03 ; rien de nouveau à calculer."),
             effort='1 h'),

        dict(id='PO-20', sev='MINEUR',
             titre='Changer une durée remet à zéro le temps en cours d’un autre mode',
             ou='js/pages/pomodoro-page.js · focusSauverDurees(), l.998-1015',
             constat=("Après avoir écrit les trois durées, la fonction réaffecte `focusEtat.total` et "
                      "`focusEtat.restant` **pour le mode courant** dès que le minuteur n’est pas en marche. "
                      "Elle ne regarde pas quelle durée a changé."),
             impact=("L’élève ajuste « Concentration » à 30 min alors qu’il est en pause (arrêtée) à 4:12 : sa "
                     "pause revient à 5:00 sans qu’il l’ait demandé. Petit, mais déroutant : on croit avoir mis "
                     "sa pause."),
             fix=("Ne réinitialiser que si la durée du **mode courant** a effectivement changé : comparer "
                  "l’ancienne et la nouvelle valeur avant d’écraser `total` / `restant`. Une condition de trois "
                  "lignes."),
             effort='10 min'),
    ],
)
