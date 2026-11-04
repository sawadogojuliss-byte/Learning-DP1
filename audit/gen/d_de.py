# -*- coding: utf-8 -*-
"""Devoirs et Examens — 26 constats."""

DE = dict(
    cle='de',
    titre='Devoirs et Examens',
    intro=("C’est la zone la plus complexe du site : un analyseur de documents, un magasin de dates, et un "
           "moteur qui repose des blocs de révision dans un planning déjà construit. Trois défauts y sont "
           "rédhibitoires : l’aperçu de l’onglet Examens s’affiche dans une zone invisible, les révisions se "
           "posent dans des jours déjà passés, et pendant la semaine d’examen les anciens blocs d’étude ne "
           "sont pas retirés — la promesse affichée n’est alors pas tenue."),
    items=[
        dict(id='DE-01', sev='BLOQUANT',
             titre='Après « Lire le planning », rien ne s’affiche dans l’onglet Examens',
             ou='pages/devoirs.html, l.42 ; js/pages/devoirs.js · devoirsMontrerPropositions(), l.744',
             constat=("Il n’existe qu’**une seule** zone `#devoirsConfirmation` dans tout le HTML, et elle est "
                      "située dans l’onglet « Devoirs » (l.42). L’onglet « Examens » (à partir de l.65) n’en a "
                      "pas. Or `devoirsMontrerPropositions()` écrit toujours dans "
                      "`document.getElementById(\'devoirsConfirmation\')`, quel que soit le genre demandé — la "
                      "fonction reçoit bien `genre`, mais ne s’en sert pas pour choisir la zone. L’onglet "
                      "Examens reste affiché, donc la zone de confirmation est cachée."),
             impact=("L’élève photographie son planning d’examens, appuie sur « Lire le planning », voit "
                     "« Lecture du document… », puis… rien. Le statut de l’onglet Examens n’est même pas mis à "
                     "jour (DE-02). Il en conclut que la lecture a échoué, recommence, photographie à nouveau, "
                     "abandonne. **La fonction d’import des examens est inutilisable en pratique**, alors que "
                     "tout le code de lecture fonctionne. S’il bascule par hasard sur l’onglet Devoirs, il y "
                     "trouvera ses examens proposés dans la mauvaise section."),
             fix=("Deux options, la seconde est préférable. (1) Minimale : ajouter un "
                  "`<div id=\"devoirsConfirmationExam\">` dans l’onglet Examens et choisir la zone par "
                  "`genre === \'devoirs\' ? \'devoirsConfirmation\' : \'devoirsConfirmationExam\'`. (2) Durable : "
                  "rendre la zone **commune** en la sortant des onglets, juste sous les deux, pour que la "
                  "confirmation soit toujours visible quel que soit l’onglet actif. Dans les deux cas, ajouter "
                  "un test de non-régression : lire un texte d’examen, vérifier que le nombre de lignes "
                  "proposées apparaît dans le DOM visible."),
             effort='30 min + test'),

        dict(id='DE-02', sev='BLOQUANT',
             titre='Le compte rendu de l’ajout s’écrit dans l’onglet où l’élève n’est pas',
             ou='js/pages/devoirs.js · devoirsMontrerPropositions(), l.793 ; devoirsConfirmerPropositions(), l.825-828',
             constat=("`devoirsMontrerPropositions()` termine par `devoirsDire(\'devoirsOcrStatut\', \'\', false)` : "
                      "il vide le statut de l’onglet Devoirs, même quand on vient de lire un document "
                      "d’examens. Et `devoirsConfirmerPropositions()` écrit son bilan dans "
                      "`devoirsOngletActif === \'devoirs\' ? \'devoirsOcrStatut\' : \'exaOcrStatut\'` — donc dans "
                      "l’onglet **actif au moment de la confirmation**, qui peut avoir changé depuis la lecture."),
             impact=("Le statut de l’onglet Examens reste bloqué sur « Lecture du document… » indéfiniment, "
                     "tandis que le message de réussite s’affiche dans un onglet invisible. L’élève n’a aucun "
                     "retour sur ce qui a réussi ou échoué. C’est le complément de DE-01 : même quand tout "
                     "fonctionne, le site ne le dit pas."),
             fix=("Passer le genre en paramètre à `devoirsDire` plutôt que de le déduire de l’onglet actif : "
                  "`devoirsDire(genre, cle, texte, erreur)`. Une petite fonction qui résout `\'devoirsOcrStatut\'` "
                  "/ `\'exaOcrStatut\'` à partir du genre, et l’utiliser partout. Ajouter `aria-live=\"polite\"` "
                  "sur les deux `<p>` au passage (DE-22)."),
             effort='30 min'),

        dict(id='DE-03', sev='BLOQUANT',
             titre='Un devoir ne peut pas être modifié : il faut le supprimer et le ressaisir',
             ou='js/pages/devoirs.js · liste des fonctions (devoirsAjouterManuel, devoirsSupprimer, devoirsEditerSeances)',
             constat=("La page sait ajouter, supprimer, et régler les séances. Elle ne sait pas modifier la "
                      "matière, la date, l’heure de début ou de fin d’un devoir existant. "
                      "`devoirsEditerSeances()` ne complète que les heures si elles sont **absentes** ; si elles "
                      "sont fausses, il ne peut rien faire."),
             impact=("Une faute de frappe sur une date (« 30/10 » au lieu de « 03/11 ») place les révisions sur "
                     "trois semaines entières au mauvais endroit. Pour corriger, l’élève doit supprimer — geste "
                     "destructeur, sans confirmation (DE-05) — puis ressaisir, puis répondre à nouveau à la "
                     "question des séances. Trois étapes risquées pour une date. C’est le scénario d’usage le "
                     "plus fréquent d’une page de devoirs."),
             fix=("Une modale d’édition unique, ouverte par un crayon sur chaque ligne, avec les quatre champs "
                  "(matière, date, début, fin) et le nombre de séances. Enregistrer par `devoirsModifier(id, "
                  "champs)` qui valide comme `devoirsAjouter` (fin > début, date non passée) et déclenche "
                  "`generatePlanning()` à la fin. Le code de validation existe déjà : il suffit de l’extraire "
                  "dans une fonction `devoirsValider(champs)` appelée par l’ajout et par la modification."),
             effort='2 h'),

        dict(id='DE-04', sev='BLOQUANT',
             titre='Un examen ne peut être ni modifié ni complété, seulement supprimé',
             ou='js/pages/devoirs.js · devoirsRendre(), l.1094-1102',
             constat=("Dans la liste, seuls les devoirs reçoivent un bouton « séances » ([livres]). Les examens "
                      "n’ont qu’une corbeille. Or un examen est l’objet le plus structurant du site : il "
                      "déclenche deux semaines de planning particulier. Une heure fausse ou une matière mal lue "
                      "par l’OCR fausse tout."),
             impact=("Après un OCR, l’élève corrige les lignes **avant** de confirmer — mais une erreur qui "
                     "passe quand même (une matière non reconnue, une heure décalée) ne peut plus être corrigée "
                     "après coup. Il doit supprimer l’examen, ce qui **efface rétroactivement** les révisions "
                     "posées pour lui, et le ressaisir. La semaine de préparation change deux fois sous ses yeux."),
             fix=("Le même crayon que les devoirs (DE-03), avec en plus le choix des matières à examiner et du "
                  "nombre de séances. La suppression d’un examen doit demander confirmation et proposer "
                  "l’annulation (DE-05)."),
             effort='1 h 30'),

        dict(id='DE-05', sev='MAJEUR',
             titre='La corbeille supprime immédiatement, sans confirmation ni annulation',
             ou='js/pages/devoirs.js · devoirsSupprimer(), l.984-990',
             constat=("Un clic sur la corbeille retire le devoir du store, régénère le planning (parfois), et "
                      "redessine. Aucune demande de confirmation, aucune possibilité de revenir en arrière. Le "
                      "bouton est petit, mais il est le seul de la ligne à être rouge."),
             impact=("Un devoir supprimé par erreur — sur un écran tactile, dans une liste dense — emporte avec "
                     "lui les révisions déjà posées et le travail de planification. L’élève ne s’en aperçoit "
                     "parfois que le lendemain, quand la séance n’apparaît plus. C’est la même famille que "
                     "ET-02, ET-03 et AU-07."),
             fix=("Une primitive d’annulation unique, réutilisée partout : suppression optimiste, toast de 8 "
                  "secondes « Devoir supprimé — Annuler », restauration de l’objet et des blocs liés si "
                  "l’élève clique. Pour un examen, ajouter en plus une confirmation nommant les révisions "
                  "concernées."),
             effort='1 h'),

        dict(id='DE-06', sev='MAJEUR',
             titre='Supprimer un devoir ne rafraîchit pas le planning : le bloc reste affiché',
             ou='js/pages/devoirs.js · devoirsSupprimer(), l.984-990',
             constat=("La fonction met à jour le store et redessine la liste, mais n’appelle jamais "
                      "`generatePlanning()`. Les blocs de révision déjà générés restent dans le planning "
                      "jusqu’à la prochaine génération — qui peut survenir des heures plus tard, ou jamais "
                      "dans la session."),
             impact=("L’élève supprime un devoir, retourne au planning : les révisions sont toujours là, "
                     "associées à un devoir qui n’existe plus. Il clique dessus, la fiche est vide. Il en "
                     "conclut que la suppression n’a pas marché, recommence, et finit par douter de tout."),
             fix=("Appeler `generatePlanning()` à la fin de `devoirsSupprimer`, comme le font déjà l’ajout et "
                  "la modification. Vérifier au passage que les autres actions (édition de séances, "
                  "import) le font aussi — un seul point de sortie serait plus sûr : une fonction "
                  "`devoirsApresChangement()` qui enregistre, régénère et redessine."),
             effort='10 min'),

        dict(id='DE-07', sev='MAJEUR',
             titre='Analyser deux fois le même document crée des devoirs en double',
             ou='js/pages/devoirs.js · devoirsConfirmerPropositions() ; devoirsAjouter()',
             constat=("Le dédoublonnage se fait à l’intérieur d’un lot (`vues[cle]`), pas contre les devoirs "
                      "déjà enregistrés. L’élève qui relit le même document — parce qu’il a oublié une ligne, "
                      "parce que la première lecture a paru incomplète — ajoute une deuxième copie de chaque "
                      "ligne. La fonction d’ajout, elle, ne compare que la matière et arrondit la date."),
             impact=("La liste se remplit de doublons, le planning pose deux fois plus de révisions, et "
                     "l’élève doit supprimer les copies une par une (DE-05, sans annulation)."),
             fix=("Avant d’ajouter une proposition, chercher un devoir existant de même matière et de même "
                  "date (à l’heure près) : si trouvé, proposer « Mettre à jour » au lieu d’« Ajouter ». "
                  "Afficher les lignes déjà connues comme telles dans la proposition."),
             effort='1 h'),

        dict(id='DE-08', sev='MOYEN',
             titre='Les devoirs passés restent affichés pour toujours, en tête de liste',
             ou='js/pages/devoirs.js · devoirsRendre() ; devoirsEstPasse()',
             constat=("La liste affiche tous les devoirs, triés par date croissante. Les devoirs dont la date "
                      "est passée restent en haut, avec leur bouton « séances » et leur corbeille. Rien ne les "
                      "distingue, sinon la date."),
             impact=("Au bout d’un trimestre, la liste commence par dix lignes mortes. L’élève doit défiler "
                     "pour trouver le devoir de la semaine. Il finit par ne plus ouvrir la page — alors que "
                     "c’est l’écran qui devrait répondre à « qu’est-ce que j’ai à faire ? »."),
             fix=("Séparer en deux : « À venir » (par défaut) et « Passés » (repliés, accessibles par un lien "
                  "« Voir les devoirs passés (12) »). Ajouter un bouton « Archiver » pour les devoirs rendus, "
                  "ou un effacement automatique après 30 jours avec export préalable."),
             effort='1 h'),

        dict(id='DE-09', sev='MOYEN',
             titre='Les examens passés restent dans la liste, et y restent en premier',
             ou='js/pages/devoirs.js · devoirsRendre()',
             constat=("Même logique que DE-08, mais l’enjeu est plus fort : un examen passé continue de "
                      "déclencher la logique « semaine d’examen » si sa date n’est pas correctement comparée. "
                      "Rien ne le marque comme terminé."),
             impact=("L’élève voit un examen de septembre en haut de sa liste en décembre, et se demande s’il "
                     "est encore attendu. Le planning peut garder des révisions pour lui (DE-16)."),
             fix=("Même séparation à venir / passés. Marquer visuellement les examens terminés et ne plus "
                     "générer de révisions pour eux. Purge après 60 jours."),
             effort='45 min'),

        dict(id='DE-10', sev='MOYEN',
             titre='La question « Combien de séances ? » ne peut pas être annulée',
             ou='js/pages/devoirs.js · devoirsDemanderSeances() ; devoirsPoserBloc()',
             constat=("La question est posée par `prompt()` natif. Un appui sur « Annuler » renvoie `null`, "
                      "que le code convertit en valeur par défaut ; l’élève ne peut donc pas revenir en "
                      "arrière. Le prompt bloque par ailleurs tout le fil d’exécution."),
             impact=("L’élève qui change d’avis se retrouve avec une séance qu’il n’a pas voulue, ou avec une "
                     "séance en moins. Il ne peut pas distinguer « je ne veux pas » de « zéro »."),
             fix=("Modale interne à trois issues (Annuler / Aucune séance / valeur), comme PO-08. Traiter "
                  "`null` comme une annulation."),
             effort='1 h'),

        dict(id='DE-11', sev='MOYEN',
             titre='Impossible de choisir « aucune séance de révision »',
             ou='js/pages/devoirs.js · devoirsNombreSeances()',
             constat=("Le calcul impose au moins une séance. Pour un devoir déjà bien préparé, ou pour un "
                      "devoir blanc, l’élève ne peut pas dire « je n’ai pas besoin de révisions ». La valeur "
                      "minimale est 1, et le `prompt` ne propose pas 0."),
             impact=("Le planning se remplit de séances que l’élève n’a pas demandées, sur des matières qu’il "
                     "maîtrise. Il apprend à ignorer les blocs « Révision », et finit par ignorer aussi ceux "
                     "qui comptent."),
             fix=("Autoriser 0 (et le distinguer de « pas encore répondu »). Afficher alors « Sans révisions » "
                  "dans la ligne du devoir, avec un lien pour en ajouter plus tard. La logique de nombre de "
                  "séances doit accepter 0 sans planter."),
             effort='45 min'),

        dict(id='DE-12', sev='MOYEN',
             titre='Deux limites contradictoires pour le nombre de séances (6 et 10)',
             ou='js/pages/devoirs.js · devoirsNombreSeances() ; devoirsPoserBloc()',
             constat=("Une première fonction plafonne à 6, une autre à 10. Selon le chemin (ajout manuel, "
                      "import, édition), le même devoir peut recevoir 6 ou 10 séances. Les deux constantes "
                      "vivent dans deux fichiers différents."),
             impact=("Deux devoirs identiques n’obtiennent pas le même planning selon la façon dont ils ont "
                     "été créés. L’élève ne peut pas comprendre pourquoi, et le moteur devient imprévisible."),
             fix=("Une seule constante `DEVOIRS_MAX_SEANCES`, exportée et utilisée partout. Un test unitaire "
                  "vérifie que les trois chemins donnent le même résultat pour les mêmes entrées."),
             effort='20 min'),

        dict(id='DE-13', sev='MOYEN',
             titre='Les modales de la page Devoirs échappent à tout le traitement modal du site',
             ou='js/pages/devoirs.js · confirmation de séances ; pages/devoirs.html',
             constat=("Les fenêtres de la page sont des `div` positionnés en absolu, avec un fond, sans "
                      "`role=\"dialog\"`, sans `aria-modal`, sans piège de focus, sans fermeture par Échap. Le "
                      "reste du site utilise un système de modale (`context-modal`) qui gère ces points — mais "
                      "seulement deux des quinze modales du site l’utilisent (AC-03)."),
             impact=("Au clavier, le focus reste derrière la modale : on tabule dans la page sans la voir. Au "
                     "lecteur d’écran, rien n’annonce qu’une fenêtre s’est ouverte. Et sur mobile, le fond ne "
                     "bloque pas toujours le défilement."),
             fix=("Remplacer par le composant commun, ou appliquer le même traitement : `role=\"dialog\"`, "
                  "`aria-modal=\"true\"`, focus sur le premier bouton, piège de tabulation, Échap, retour du "
                  "focus à l’élément d’origine. C’est le correctif d’AC-03, appliqué ici."),
             effort='2 h'),

        dict(id='DE-14', sev='BLOQUANT',
             titre='Des révisions sont posées dans des jours déjà passés',
             ou='js/pages/devoirs-moteur.js · devoirsAdapterJour(), devoirsPlacerBloc()',
             constat=("Le moteur cherche des créneaux libres à partir du jour de génération, mais rien ne "
                      "l’empêche de compléter un jour antérieur à la date du jour. `devoirsDateDuJour()` existe "
                      "et n’est pas utilisée comme borne. Les blocs sont ensuite affichés tels quels."),
             impact=("L’élève ouvre son planning, clique sur lundi — un jour déjà écoulé — et y trouve "
                     "« Révision · Mathématiques · Devoir le ven. 30/10 · dans 8 j ». C’est impossible : lundi "
                     "n’existe plus, et le compte à rebours affiché est faux (il était de 10 jours à l’époque). "
                     "La semaine passée est remplie de tâches qu’il n’a jamais pu faire, et la semaine en cours "
                     "paraît deux fois plus chargée qu’elle ne l’est. C’est l’erreur la plus visible du moteur "
                     "— elle ne demande aucun cas tordu, juste un mercredi."),
             fix=("Une garde unique en tête de `devoirsAdapterJour` : si `devoirsDateDuJour(dayIndex)` est "
                  "antérieure à la date du jour, ne rien ajouter (retourner `events` tel quel après le "
                  "nettoyage du samedi). Les blocs fixes du jour (composition, examen) peuvent rester — ils ont "
                  "eu lieu. Pour la rampe automatique, ajouter aussi la condition dans la boucle principale : "
                  "ne rien poser si `offsetJour < 0`. Un test : régler la date système au mercredi, vérifier "
                  "qu’aucun `devoir-rev-` n’apparaît lundi ni mardi."),
             effort='30 min + test'),

        dict(id='DE-15', sev='BLOQUANT',
             titre='Pendant la semaine d’examen, les anciens blocs d’étude ne sont pas retirés',
             ou='js/pages/devoirs-moteur.js · devoirsBlocARetirer(), l.81-90 ; js/pages/emploi-temps-moteur.js, l.47-76',
             constat=("La promesse affichée est forte : « ton planning ne contient plus que des révisions et "
                      "des exercices sur les matières à examiner — plus de CAS, ni mémoire, ni évaluation "
                      "interne ». `devoirsBlocARetirer()` retire les types `activity`, `ia`, `memoire` et les "
                      "identifiants `study1`, `study2`, `exercices`. Mais quand un emploi du temps est chargé, "
                      "les blocs d’étude portent les identifiants `emploi-rev-<heure>`, `emploi-exo-<heure>`, "
                      "`emploi-memoire-…`, `emploi-ia-…` (`emploi-temps-moteur.js`). Les `emploi-rev-` et "
                      "`emploi-exo-` **ne sont pas dans la liste** : ils survivent."),
             impact=("La semaine d’examen, l’élève voit cohabiter « Révisions Histoire » (son créneau habituel) "
                     "et « Révision · Physique » (le programme d’examen), sur la même journée. Deux "
                     "conséquences : la journée est surchargée, et il **révise une matière qui n’est pas au "
                     "programme**. Le texte de la page promet le contraire, mot pour mot. C’est la promesse la "
                     "plus visible de la page qui n’est pas tenue."),
             fix=("Ajouter `emploi-rev-` et `emploi-exo-` à `devoirsBlocARetirer()` — mais pas `emploi-memoire-` "
                  "ni `emploi-ia-`, déjà couverts par leur type. Mieux : faire reposer la décision sur une "
                  "propriété explicite du bloc (`ev.study === true`) plutôt que sur des préfixes d’identifiant, "
                  "qui divergent à chaque nouveau générateur. Un test : charger un emploi du temps, ajouter un "
                  "examen dans 5 jours, vérifier qu’aucun bloc dont le titre ne contient pas la matière de "
                  "l’examen ne subsiste."),
             effort='30 min + test'),

        dict(id='DE-16', sev='MAJEUR',
             titre='Un examen dans trois mois décale 45 minutes de révision chaque jour, dès son ajout',
             ou='js/pages/devoirs-moteur.js · devoirsNombreSeances() ; devoirsPoserBloc()',
             constat=("Le nombre de séances est calculé en jours calendaires entre aujourd’hui et la date de "
                      "l’examen, puis réparti sur cette période. Un examen en janvier ajouté en octobre génère "
                      "donc des séances **dès la semaine suivante**, à raison de trois par semaine, pendant "
                      "trois mois. Le moteur ne connaît pas de « début de préparation »."),
             impact=("Le planning de l’élève est envahi de révisions pour un examen lointain, au détriment du "
                     "travail courant. Il désactive les blocs, ou ignore le planning. Et le jour de l’examen, "
                     "il a révisé distraitement trois mois durant au lieu de se concentrer sur les deux "
                     "dernières semaines."),
             fix=("Introduire une fenêtre de préparation : les séances ne commencent pas avant J-14 (ou "
                  "J-21 pour un examen majeur). Calculer le nombre de séances **dans cette fenêtre**, pas "
                  "depuis aujourd’hui. La règle « au moins une la veille » reste prioritaire. Afficher dans la "
                  "fiche de l’examen : « révisions du 12 au 26 janvier »."),
             effort='2 h'),

        dict(id='DE-17', sev='MOYEN',
             titre='Deux devoirs à la même heure se superposent sans alerte',
             ou='js/pages/devoirs.js · devoirsAjouter() ; devoirsConfirmerPropositions()',
             constat=("Rien ne vérifie qu’un devoir existe déjà au même créneau. Les deux blocs sont posés, "
                      "et l’affichage les empile ou les masque l’un l’autre selon la largeur."),
             impact=("Sur le planning, deux cartes occupent la même hauteur : l’une masque l’autre. L’élève ne "
                     "peut pas cliquer sur celle du dessous, et n’a aucun message lui disant qu’il a saisi "
                     "deux compositions incompatibles."),
             fix=("Contrôler au moment de l’ajout (dans `devoirsValider`) : si un devoir ou un examen existant "
                  "chevauche, proposer « Garder les deux » ou « Corriger ». En affichage, juxtaposer les blocs "
                  "en colonnes plutôt que les empiler — le CSS de la grille du planning gère déjà "
                  "`overflow-x`."),
             effort='1 h 30'),

        dict(id='DE-18', sev='MOYEN',
             titre='Un devoir sans heures dont le créneau « DEVOIR DE NIVEAU » est absent n’apparaît jamais',
             ou='js/pages/devoirs-moteur.js · devoirsAdapterJour(), l.526-560',
             constat=("Sans `debut`/`fin`, le devoir ne peut être posé que dans un créneau dont le titre "
                      "contient « devoir » (`devoirsEstCreneauDevoir`). Si l’emploi du temps n’est pas chargé, "
                      "ou si le document dit « Composition » au lieu de « Devoir de niveau », il n’y a aucun "
                      "créneau : `devoirsDecouperCreneau` retourne un tableau vide et le devoir n’est jamais "
                      "ajouté à la journée."),
             impact=("Le devoir est bien enregistré (il figure dans la liste) mais **invisible dans le "
                     "planning**. L’élève conclut que le site l’a perdu, ou pire, que le devoir n’existe pas — "
                     "alors qu’il approche. Le silence est total : aucun message, aucun badge."),
             fix=("Ajouter un repli : sans créneau identifié, poser le bloc à un horaire par défaut (par "
                  "exemple 8h00, durée 2 h) marqué « heure à confirmer », et afficher une alerte dans la "
                  "liste : « Heure inconnue — précise-la ». Mieux vaut un bloc visible et imparfait qu’un "
                  "devoir invisible."),
             effort='1 h'),

        dict(id='DE-19', sev='MOYEN',
             titre='« lundi 23 » peut produire une date fausse sans le dire',
             ou='js/pages/devoirs.js · devoirsParserTexte(), l.437-448',
             constat=("La recherche avance jour après jour pendant 60 itérations et s’arrête sur la première "
                      "date dont le quantième et le jour de semaine correspondent. Si aucune ne correspond — un "
                      "« lundi 23 » qui n’existe pas dans les huit prochaines semaines, un document mal lu — la "
                      "boucle se termine sans break, et `essai` vaut alors **date du jour + 60 jours**, quel que "
                      "soit quantième. Cette date est acceptée sans vérification."),
             impact=("Un devoir se retrouve à une date arbitraire, deux mois plus tard, avec l’apparence d’une "
                     "lecture sûre. L’élève ne le voit pas : la ligne affiche une date plausible. Il ne "
                     "découvrira l’erreur qu’en constatant l’absence de révisions, trop tard."),
             fix=("Après la boucle, si aucune correspondance n’a été trouvée, renvoyer une date vide et "
                  "marquer la ligne « date à préciser » au lieu d’inventer. Le parseur doit distinguer « trouvé "
                  "avec certitude », « trouvé approximativement » et « non trouvé » — et l’interface doit le "
                  "montrer."),
             effort='45 min'),

        dict(id='DE-20', sev='MINEUR',
             titre='« 12:00 am » est converti en 12:00 au lieu de 00:00',
             ou='js/pages/devoirs.js · devoirsParserTexte()',
             constat=("La conversion des heures anglo-saxonnes lit l’heure et les minutes, mais traite « am » "
                      "et « pm » comme de simples suffixes : 12:00 am devient 12:00 (midi) au lieu de minuit, "
                      "et 12:00 pm devient 12:00 au lieu de midi. Les deux extrémités sont fausses."),
             impact=("Un examen qui commence à minuit — ou plus vraisemblablement une heure mal lue — se "
                     "retrouve à midi. Le bloc de composition est posé au mauvais moment, et les révisions "
                     "autour sont décalées."),
             fix=("Traiter 12 am = 0 h et 12 pm = 12 h explicitement, avant l’ajout de 12 pour les pm. Un test "
                  "avec les quatre cas (12 am, 12 pm, 1 am, 1 pm)."),
             effort='20 min'),

        dict(id='DE-21', sev='MINEUR',
             titre='Choisir une photo dans l’onglet Examens ne déclenche rien',
             ou='pages/devoirs.html · `<input id="devoirsFichierExam">` sans `onchange`',
             constat=("L’input file de l’onglet Devoirs porte `onchange=\"devoirsLireDocument()\"`. Celui de "
                      "l’onglet Examens, non : il n’a aucun écouteur. Sélectionner une photo ne produit donc "
                      "aucun effet, et le bouton « Lire le planning » lit en réalité le texte collé, pas le "
                      "fichier choisi."),
             impact=("L’élève choisit une photo, la voit apparaître dans le sélecteur, puis rien. Il appuie sur "
                     "« Lire le planning » : le site lui répond qu’il n’y a rien à lire. Il recommence, "
                     "photographie à nouveau, abandonne."),
             fix=("Ajouter `onchange=\"devoirsLireDocument()\"` sur l’input, et faire en sorte que "
                  "`devoirsLireDocument()` sache de quel onglet vient le fichier. Le test navigateur doit "
                  "couvrir les deux onglets."),
             effort='10 min'),

        dict(id='DE-22', sev='MOYEN',
             titre='Aucun message de réussite ou d’erreur n’est annoncé par un lecteur d’écran',
             ou='js/pages/devoirs.html · `#devoirsOcrStatut`, `#exaOcrStatut`, `#devoirsAjoutStatut`',
             constat=("Les trois zones de statut sont de simples `<p>`. Elles changent de texte sans "
                      "`aria-live`, sans `role=\"status\"`, sans focus. Un lecteur d’écran ne signale jamais "
                      "que la lecture a réussi, échoué, ou trouvé douze lignes."),
             impact=("L’élève non-voyant lance une lecture et n’obtient aucun retour. Il ne peut pas savoir si "
                     "le document a été reconnu, combien de créneaux ont été trouvés, ni si l’ajout a abouti."),
             fix=("`aria-live=\"polite\"` sur les trois zones (et `aria-atomic=\"true\"`), plus un résumé "
                  "textuel après chaque action : « 4 créneaux détectés », « 4 devoirs ajoutés », « lecture "
                  "impossible : photo trop sombre ». C’est le correctif d’AC-01, appliqué ici."),
             effort='30 min'),

        dict(id='DE-23', sev='MOYEN',
             titre='Une douzaine de champs sans étiquette sur la page',
             ou='pages/devoirs.html · formulaire manuel, filtres, sélecteurs',
             constat=("Les champs du formulaire manuel (matière, date, début, fin), ceux de l’édition des "
                      "séances et les filtres n’ont ni `<label for>` ni `aria-label`. Les seuls repères sont "
                      "des `placeholder`, qui disparaissent à la saisie."),
             impact=("Au lecteur d’écran, on entend « champ de saisie » répété, sans indication de ce qu’il "
                     "faut y mettre. Les `placeholder` disparaissent dès la première frappe, ce qui gêne aussi "
                     "les utilisateurs voyants qui vérifient leur saisie."),
             fix=("Étiquettes visibles (ou `visually-hidden`) associées par `for`/`id`, sur tous les champs. "
                  "Garder les `placeholder` comme exemples, jamais comme étiquettes."),
             effort='45 min'),

        dict(id='DE-24', sev='MINEUR',
             titre='Aucune recherche ni filtre dans les listes de devoirs et d’examens',
             ou='js/pages/devoirs.html · `#devoirsListe`, liste des examens',
             constat=("Les deux listes sont rendues d’un bloc, triées par date. Il n’y a ni champ de recherche, "
                      "ni filtre par matière, ni filtre « à venir / passés »."),
             impact=("Au bout de vingt devoirs, retrouver « l’examen de physique » demande de faire défiler et "
                     "de lire chaque ligne. Ce n’est pas bloquant, mais c’est exactement ce qui fait qu’on "
                     "cesse d’utiliser une liste."),
             fix=("Un champ de recherche (matière ou date) au-dessus de chaque liste, et deux filtres "
                  "« à venir / passés » (DE-08, DE-09). Le rendu existe déjà ; il suffit de filtrer le tableau "
                  "avant `map`."),
             effort='1 h'),

        dict(id='DE-25', sev='MAJEUR',
             titre='La synchronisation du compte peut perdre les devoirs ajoutés sur un autre appareil',
             ou='js/compte.js · compteUnionParId(), l.109 ; js/memoire.js · memoireAppliquerEtat()',
             constat=("La fusion se fait par identifiant : les objets présents des deux côtés sont fusionnés "
                      "champ par champ, mais les objets absents d’un côté sont **écrasés** par la version du "
                      "compte. Il n’y a ni horodatage par objet (`modifieAt`), ni pierre tombale pour les "
                      "suppressions. Le dernier écrivain gagne, à l’échelle de tout le tableau."),
             impact=("L’élève ajoute un devoir sur son téléphone hors ligne. Il ouvre l’ordinateur : la version "
                     "du compte, plus ancienne, remplace le tableau, et le devoir disparaît. Il le recrée, puis "
                     "le perd à nouveau au prochain aller-retour. C’est la perte de travail la plus coûteuse du "
                     "site, et elle est invisible."),
             fix=("Trois ajouts indissociables : (1) un `modifieAt` par devoir, mis à jour à chaque écriture ; "
                  "(2) une fusion par identifiant qui garde la version la plus récente **par objet**, pas par "
                  "tableau ; (3) des pierres tombales (`supprime: true`, `supprimeAt`) pour que l’absence ne "
                  "soit pas interprétée comme « à recréer » (SY-01, SY-02)."),
             effort='4 h'),

        dict(id='DE-26', sev='MINEUR',
             titre='Le titre de la page promet un contenu que la page ne montre pas',
             ou='pages/devoirs.html · en-tête « Tes compositions et ton programme de révisions »',
             constat=("Le sous-titre annonce « tes compositions, tes examens, et le nombre de séances de "
                      "révision avant chacun ». Ni le nombre de séances ni le compte à rebours ne sont "
                      "affichés dans la liste des devoirs."),
             impact=("L’élève cherche une information que la page promet et ne trouve pas. Ce n’est pas un bug "
                     "fonctionnel, mais c’est une promesse non tenue — exactement le genre d’écart qui fait "
                     "douter du reste."),
             fix=("Afficher le nombre de séances et le compte à rebours sur chaque ligne (« 3 séances · dans "
                  "12 jours »), ou corriger le sous-titre. Le plus simple est d’afficher : l’information existe "
                  "déjà dans le modèle."),
             effort='45 min'),
    ],
)
