# -*- coding: utf-8 -*-
"""Emploi du temps scolaire — 18 constats."""

ET = dict(
    cle='et',
    titre='Emploi du temps scolaire',
    intro=("C’est la page qui décide de la vérité du planning : tout ce que le site croit savoir des cours "
           "d’un élève vient d’ici. Trois défauts y sont structurants — les chevauchements acceptés, les "
           "en-têtes de jour ignorés à la lecture d’une photo, et la disparition silencieuse des cours du "
           "samedi. À eux trois, ils suffisent à produire un planning faux sur une base honnête."),
    items=[
        dict(id='ET-01', sev='BLOQUANT',
             titre='Deux cours qui se chevauchent sont acceptés sans un mot',
             ou='js/pages/emploi-temps.js · emploiAjouterManuel(), l.439-462 ; emploiConfirmerPropositions(), l.399-431',
             constat=("La fonction valide le jour, le nom et l’ordre des heures (`fin > debut`), puis écrit "
                      "directement dans le store. Elle ne compare **jamais** le nouveau cours avec ceux déjà "
                      "présents ce jour-là. Le mot « chevauchement » n’apparaît nulle part dans le fichier, "
                      "et `emploiConfirmerPropositions()` — la confirmation après lecture d’un document — ne "
                      "contrôle pas davantage."),
             impact=("Un emploi du temps faux produit un planning faux, et l’élève ne comprend pas pourquoi le "
                     "site lui propose de réviser **pendant un cours**. C’est la pire catégorie d’erreur : "
                     "silencieuse, plausible, et attribuée au site plutôt qu’à la saisie. Elle apparaît "
                     "surtout après un OCR imparfait (deux lignes pour le même cours, un jour mal attribué) — "
                     "le cas le plus fréquent."),
             fix=("Avant d’écrire, comparer la nouvelle plage à chaque cours du même jour : `debut < autre.fin "
                  "&& fin > autre.debut`. En cas de conflit, ne pas refuser sèchement : ouvrir un choix à "
                  "trois issues — **Remplacer** « Histoire 8h-10h », **Garder les deux** (cours en parallèle, "
                  "cas réel des options), **Annuler** — en nommant le cours en conflit. Le même contrôle doit "
                  "s’appliquer dans `emploiConfirmerPropositions()` avec un compteur « 2 conflits à vérifier » "
                  "avant le bouton d’enregistrement. Prévoir dès maintenant un champ `parallele: true` sur les "
                  "cours volontairement simultanés, pour que le planning sache les afficher côte à côte au lieu "
                  "de les empiler."),
             effort='2 à 3 h'),

        dict(id='ET-02', sev='MAJEUR',
             titre='« Tout effacer » détruit l’emploi du temps en un clic, sans rien demander',
             ou='js/pages/emploi-temps.js · emploiToutEffacer(), l.497-501 ; bouton l.493',
             constat=("Le bouton est un simple lien rouge souligné (« tout effacer »), placé dans la phrase "
                      "qui annonce « 12 cours enregistrés », juste au-dessus de la liste. Un appui vide le "
                      "store entier (`emploiScolaireVider()`), sans `confirm()`, sans annulation, puis "
                      "régénère immédiatement le planning."),
             impact=("Ce n’est pas seulement « j’ai perdu mes cours » : **tout le planning de la semaine est "
                     "recalculé sur une base fausse**, puisque les créneaux réels disparaissent et que les "
                     "heures creuses sont réinventées. L’élève voit son planning changer sous ses yeux et "
                     "conclut que le moteur s’est trompé. Sur téléphone, le lien est à portée de pouce, dans "
                     "une zone qu’on lit rarement."),
             fix=("Sortir l’action de la phrase : bouton secondaire, bordure neutre, à droite du titre de la "
                  "liste. Ouvrir une modale qui nomme l’objet et son volume (« Effacer les 12 cours de la "
                  "semaine ? Ton planning sera recalculé sans eux. »), proposer « Télécharger d’abord » "
                  "(export JSON déjà disponible), et laisser 8 secondes d’annulation après validation. Cette "
                  "primitive d’annulation doit être la même que pour ET-03, DE-05 et AU-07 — une seule "
                  "implémentation, trois usages."),
             effort='1 h 30'),

        dict(id='ET-03', sev='MAJEUR',
             titre='Supprimer un cours est immédiat, et emporte les révisions posées dessus',
             ou='js/pages/emploi-temps.js · emploiSupprimer(), l.464 ; bouton l.492',
             constat=("La croix de chaque ligne appelle `emploiSupprimer(jour, id)` : la fonction filtre le "
                      "store, réécrit, rend. Aucune confirmation, aucune annulation, aucun décompte. Les "
                      "blocs de révision que le moteur avait posés dans les trous ouverts par ce cours "
                      "(`emploi-rev-<id>`) disparaissent à la génération suivante, sans un mot."),
             impact=("L’élève qui corrige un cours supprime aussi, sans le savoir, les séances de révision "
                     "qui en dépendaient. Le lendemain, son planning est plus vide et il ne fait pas le lien : "
                     "il croit que le site « oublie » des révisions. C’est une perte de travail réelle, "
                     "causée par un geste de correction anodin."),
             fix=("Avant suppression, compter les blocs liés et l’annoncer : « Ce cours porte 3 séances de "
                  "révision. Les supprimer aussi ? ». Proposer « Déplacer les révisions » quand les heures "
                  "creuses existent encore. Et appliquer l’annulation de 8 secondes d’ET-02 : la suppression "
                  "n’est pas définitive tant que le toast est visible."),
             effort='1 h'),

        dict(id='ET-04', sev='MAJEUR',
             titre='Aucune modification : corriger une faute oblige à tout supprimer et ressaisir',
             ou='js/pages/emploi-temps.js · emploiRendreLigne() ; aucune fonction d’édition',
             constat=("Chaque ligne affiche son jour, ses heures, sa matière et une croix. Il n’y a ni "
                      "crayon, ni double-clic, ni formulaire pré-rempli : la seule façon de corriger « Mathé » "
                      "en « Mathématiques » est de supprimer la ligne et d’en créer une autre."),
             impact=("La correction d’une faute — le geste le plus fréquent après un OCR — coûte trois "
                     "actions et une perte de contexte. Elle emporte au passage les révisions liées (ET-03). "
                     "À la troisième correction, l’élève laisse les fautes : l’emploi du temps devient "
                     "approximatif, puis inutile."),
             fix=("Réutiliser le formulaire existant en mode édition : `emploiEditer(id)` pré-remplit les "
                  "quatre champs, le bouton devient « Enregistrer », la validation est la même qu’à l’ajout "
                  "(ET-01), et l’identifiant du cours ne change pas — donc les révisions posées survivent. "
                  "Un crayon sur chaque ligne, avec un `aria-label` explicite."),
             effort='1 h 30'),

        dict(id='ET-05', sev='BLOQUANT',
             titre='À la lecture d’une photo, les en-têtes de jour sont ignorés — et deviennent des noms de cours',
             ou='js/pages/emploi-temps.js · emploiParseItems(), l.199-245 ; emploiParseTexte()',
             constat=("Le découpage est ligne à ligne. Seule une expression régulière d’heure identifie un "
                      "cours ; le texte qui la précède devient la matière. Or un emploi du temps photographié "
                      "comporte des en-têtes (« Lundi », « Mardi 14 ») : ces lignes sans heure sont prises "
                      "pour des matières, et le jour reste celui par défaut. Les lignes 229-230 gardent même "
                      "un bloc vide quand rien n’est reconnu, plutôt que d’ignorer la ligne."),
             impact=("Tous les cours atterrissent sur un seul jour, ou sur le mauvais, avec des matières qui "
                     "s’appellent « Lundi ». L’élève voit une liste absurde, corrige les deux premières "
                     "lignes, puis abandonne la fonction. **L’import par photo est inutilisable en pratique**, "
                     "alors que le reste de la chaîne (OCR local, PDF, confirmation) fonctionne."),
             fix=("Lire les en-têtes avant les heures : une expression régulière `^(lundi|mardi|…|dimanche|"
                  "lun\\.?|mar\\.?|…)` change le jour courant ; une ligne sans heure et sans matière connue est "
                  "ignorée ; une ligne d’en-tête n’est jamais une matière. Ajouter un test de non-régression "
                  "sur un texte à trois jours, et vérifier sur une vraie photo que les jours sont respectés. "
                  "Le parseur doit exposer le jour courant dans son état, pas le déduire de la position."),
             effort='2 h + test'),

        dict(id='ET-06', sev='BLOQUANT',
             titre='Les cours du samedi ne peuvent jamais être placés depuis une photo ou un texte',
             ou='js/pages/emploi-temps.js · emploiParseItems(), l.238 (`Math.min(4, …)`)',
             constat=("L’index de jour calculé pour chaque cours est plafonné à 4, soit du lundi au vendredi. "
                      "Le samedi (5) et le dimanche (6) ne peuvent donc jamais être produits, quel que soit "
                      "le document fourni. Le formulaire manuel, lui, accepte bien sept jours : les deux "
                      "chemins ne font pas la même chose."),
             impact=("Beaucoup d’élèves ont cours le samedi matin — c’est le cas dans la majorité des "
                     "établissements de la sous-région. Le site leur propose alors des révisions **pendant "
                     "leurs cours**, et affiche une journée qu’ils savent fausse. Le plafond est invisible : "
                     "aucun message ne dit « samedi ignoré »."),
             fix=("Remplacer la borne par la longueur réelle de la table des jours (7) et accepter 0 à 6. "
                  "Vérifier que le moteur de planning lit bien sept jours (c’est le cas, ET-17) et que "
                  "l’affichage du samedi existe. Un test unitaire : un texte « Samedi 8h-10h » doit produire "
                  "un cours d’index 5."),
             effort='20 min'),

        dict(id='ET-07', sev='MAJEUR',
             titre='Confirmer un deuxième document efface les cours du premier, sans prévenir',
             ou='js/pages/emploi-temps.js · emploiConfirmerPropositions(), l.399-431',
             constat=("Avant d’ajouter les cours proposés, la fonction retire **tous** les cours dont "
                      "`src === 'doc'`, c’est-à-dire tout ce qui a été importé d’une photo ou d’un PDF. "
                      "L’intention est d’éviter les doublons ; l’effet est qu’un deuxième document remplace "
                      "le premier. Les cours saisis à la main, eux, survivent."),
             impact=("L’élève photographie son emploi du temps du tronc commun, puis celui des options. Le "
                     "second efface le premier : il ne reste que les options, et le planning perd la moitié "
                     "des cours. Rien ne l’indique, et il ne pense pas à vérifier une liste qu’il vient de "
                     "voir correcte."),
             fix=("Ne retirer que ce que le document remplace : marquer chaque cours importé d’une empreinte "
                  "(`src: 'doc:2026-10-20'`) et ne supprimer que les cours de la même empreinte. Proposer "
                  "explicitement, à la confirmation, « Remplacer les cours du document précédent » ou "
                  "« Ajouter à la suite ». Par défaut : ajouter, jamais effacer."),
             effort='1 h'),

        dict(id='ET-08', sev='MAJEUR',
             titre='La confirmation d’un document peut créer des chevauchements sans alerte',
             ou='js/pages/emploi-temps.js · emploiConfirmerPropositions(), l.399-431',
             constat=("La fonction dédoublonne les lignes identiques du document (`vues[cle]`), mais ne "
                      "compare jamais les nouveaux cours à ceux qui restent — les cours manuels, ou ceux d’un "
                      "autre jour. Deux lignes correctes séparément peuvent donc produire un emploi du temps "
                      "impossible."),
             impact=("Même conséquence qu’ET-01, mais à plus grande échelle : un document entier est confirmé "
                     "d’un coup, et l’élève ne peut pas voir les conflits dans la liste (les lignes sont "
                     "affichées une par une, sans vue par jour)."),
             fix=("Faire tourner le détecteur d’ET-01 sur l’ensemble des propositions **avant** l’écriture, et "
                  "afficher en tête de la zone de confirmation : « 2 conflits horaires — les vérifier ». Les "
                  "lignes en conflit prennent un fond ambré. C’est la même fonction de validation, appelée "
                  "sur un tableau plutôt que sur une ligne."),
             effort='1 h'),

        dict(id='ET-09', sev='MAJEUR',
             titre='Un cours annulé ne peut pas être marqué : le planning révisera pendant l’absence du professeur',
             ou='js/pages/emploi-temps.js et js/pages/emploi-temps-moteur.js · aucune occurrence de « annul », « absence »',
             constat=("Le modèle ne connaît que des cours qui ont lieu. Les fériés sont gérés par date "
                      "(`holidayDates`), mais une absence de professeur, une sortie scolaire, une journée "
                      "blanche ne le sont pas. Il n’existe aucune notion d’exception ponctuelle sur un cours."),
             impact=("C’est un événement hebdomadaire dans un lycée. L’élève doit soit subir un planning faux "
                     "toute la semaine, soit supprimer le cours — ce qui le supprime **toutes les semaines** "
                     "(le modèle est hebdomadaire) et casse la semaine suivante."),
             fix=("Ajouter une table d’exceptions par date : `studyPlanIB_emploiExceptions = { '2026-10-23': "
                  "{ 'cours-reel-2': 'annule' } }`, et un bouton « Ce cours n’a pas eu lieu » sur le bloc du "
                  "planning du jour (pas sur l’emploi du temps modèle). Le moteur retire le cours pour cette "
                  "date et replace les heures creuses ; la semaine suivante n’est pas touchée. Purge "
                  "automatique des exceptions de plus de 60 jours pour ne pas gonfler le stockage."),
             effort='3 h'),

        dict(id='ET-10', sev='MOYEN',
             titre='Pas de semaine A / semaine B, alors que c’est la norme des emplois du temps scolaires',
             ou='js/pages/emploi-temps.js (modèle) ; js/pages/planning-moteur.js · V3_STUDY_TYPES',
             constat=("Le site ne connaît qu’un seul emploi hebdomadaire, identique d’une semaine à l’autre. "
                      "Les recherches `semaine a`, `semaine b`, `paire`, `alterne` renvoient zéro occurrence "
                      "dans tout le dépôt."),
             impact=("En IB, les groupes de langues, les options et parfois les sciences tournent en quinzaine. "
                     "L’élève ne peut pas décrire sa réalité : il saisit un emploi faux une semaine sur deux, "
                     "et le planning se trompe une semaine sur deux. C’est exactement le genre d’écart qui "
                     "fait perdre confiance dans tout le reste."),
             fix=("Ajouter un champ `parite: 'A' | 'B' | 'toutes'` par cours, et une fonction `semaineParite"
                  "(date)` (numéro de semaine ISO modulo 2). Le moteur filtre les cours selon la parité de la "
                  "date traitée. L’interface : un simple sélecteur à trois positions sur le formulaire, "
                  "« Toutes les semaines » par défaut. Migration sans douleur : tous les cours existants sont "
                  "en « toutes »."),
             effort='4 h'),

        dict(id='ET-11', sev='MOYEN',
             titre='Les cours réels du planning portent un identifiant indexé, que toute insertion décale',
             ou='js/pages/planning-moteur.js · l.1327 (`\'cours-reel-\' + index`)',
             constat=("L’identifiant d’un cours généré dans le planning est construit à partir de sa position "
                      "dans le tableau. Insérer un cours au début, en supprimer un au milieu, ou recevoir une "
                      "synchronisation décale tous les suivants : deux cours différents peuvent porter le même "
                      "identifiant d’une génération à l’autre."),
             impact=("Les blocs de révision déjà posés pointent vers un identifiant qui désigne désormais un "
                     "autre cours. L’élève voit « Révision · Physique » collée à un cours d’Histoire, ou une "
                     "révision orpheline. Le bug est rare mais impossible à expliquer."),
             fix=("Utiliser un identifiant stable, déjà présent dans le store (`c.id`, généré par "
                  "`emploiId()`), et non la position : `'cours-reel-' + c.id`. Aucun autre changement n’est "
                  "nécessaire ; il suffit que l’identifiant ne dépende plus de la place."),
             effort='15 min'),

        dict(id='ET-12', sev='MOYEN',
             titre='La suppression dépend d’un index de jour calculé au moment du rendu',
             ou='js/pages/emploi-temps.js · emploiSupprimer(jour, id), l.464 ; bouton l.492',
             constat=("Le bouton transmet l’index du jour **tel qu’il était au moment du rendu** "
                      "(`emploiSupprimer(index, id)`). Si le store a changé entre-temps — autre onglet, "
                      "synchronisation du compte, ajout manuel — l’index peut désigner un autre jour."),
             impact=("On supprime un cours qui n’est pas celui qu’on visait, sans aucun message. C’est rare, "
                     "mais impossible à comprendre pour l’élève qui ne se souvient pas d’avoir touché au "
                     "mardi."),
             fix=("Ne plus transmettre le jour : `emploiSupprimer(id)` et laisser la fonction chercher le "
                  "cours dans les sept jours (`jours.findIndex(j => j.some(c => c.id === id))`). Un "
                  "identifiant unique est déjà garanti par `emploiId()` ; l’index n’apporte que du risque."),
             effort='20 min'),

        dict(id='ET-13', sev='MOYEN',
             titre='Le formulaire manuel n’a aucune étiquette, et « Continuer » ne dit pas ce qu’il fait',
             ou='pages/emploi-temps.html, l.35-44',
             constat=("Les quatre champs (jour, cours, début, fin) sont nus : ni `<label>`, ni `aria-label`. "
                      "Le seul repère est le texte au-dessus du groupe. Les boutons du bas sont « ← Retour » "
                      "et « Continuer → » ; le second valide l’étape et ouvre le planning."),
             impact=("Au lecteur d’écran, on entend quatre fois « champ de saisie ». Pour tous les autres, "
                     "« Continuer » est ambigu : on ne sait pas s’il enregistre le cours en cours de saisie ou "
                     "s’il passe à l’écran suivant. Sur une page où l’on vient de saisir un cours, le doute "
                     "coûte un aller-retour."),
             fix=("Une étiquette visible par champ (jour / cours / début / fin), courte, au-dessus de "
                  "l’entrée. Renommer le bouton du bas « Voir mon planning → » et laisser « Ajouter le "
                  "cours » au formulaire, pour que la différence soit évidente. Ajouter `aria-live=\"polite\"` "
                  "sur `#emploiAjoutStatut` et `#emploiOcrStatut`."),
             effort='30 min'),

        dict(id='ET-14', sev='MOYEN',
             titre='La zone de dépôt de fichier est un div cliquable, inutilisable au clavier',
             ou='pages/emploi-temps.html · zone « Choisis une photo de ton emploi du temps »',
             constat=("Toute la zone est un `<div onclick>` qui déclenche l’input file caché. Pas de "
                      "`tabindex`, pas de `role`, pas de gestion de la touche Entrée ou Espace : au clavier, "
                      "elle est invisible. Le nom du fichier choisi n’est pas annoncé non plus."),
             impact=("Un élève qui navigue au clavier — ou qui utilise un lecteur d’écran — ne peut pas "
                     "importer son emploi du temps. C’est le seul chemin d’entrée rapide de la page, et il "
                     "est réservé à ceux qui utilisent une souris."),
             fix=("Remplacer le `div` par un `<button type=\"button\">` (ou un `<label for=\"emploiFichier\">`, "
                  "qui est nativement cliquable et accessible), avec l’input en `visually-hidden`. Annoncer "
                  "le fichier retenu dans `#emploiOcrStatut`, et gérer un état de chargement explicite."),
             effort='30 min'),

        dict(id='ET-15', sev='MOYEN',
             titre='La lecture d’un PDF scanné peut durer une minute sans aucun retour visible',
             ou='js/pages/emploi-temps.js · emploiPdfItems() ; OCR limité aux 3 premières pages',
             constat=("Le fichier est découpé, rendu en image, puis passé à Tesseract page par page. Aucun "
                      "indicateur de progression n’est affiché, aucun bouton d’annulation n’existe, et la "
                      "limite de trois pages n’est annoncée nulle part. Si le document fait dix pages, "
                      "l’élève croit que tout a été lu."),
             impact=("Un écran figé de 30 à 90 secondes, c’est une page qu’on quitte. Et si l’élève quitte, il "
                     "recommence — et retélécharge. C’est le principal point d’abandon de toute la fonction "
                     "d’import."),
             fix=("Afficher une progression réelle : `Tesseract.recognize` expose un `logger` (statut et "
                  "pourcentage) ; le rendu de page fournit `pageNum / numPages`. Les combiner en une barre "
                  "unique. Ajouter un bouton « Annuler la lecture » qui interrompt le worker, et dire "
                  "explicitement la limite : « les 3 premières pages sont lues »."),
             effort='2 h'),

        dict(id='ET-16', sev='MOYEN',
             titre='L’emploi du temps du compte écrase celui de l’appareil au lieu de le compléter',
             ou='js/memoire.js · memoireAppliquerEtat(), l.333-339',
             constat=("À la restauration, si `data.emploiScolaire.jours` existe, il est écrit tel quel dans "
                      "`localStorage`, sans fusion avec ce qui est déjà sur l’appareil. À l’inverse, les "
                      "devoirs et les exercices sont fusionnés. L’emploi du temps est le seul objet traité "
                      "par « le dernier écrase gagne »."),
             impact=("L’élève ajoute un cours sur son téléphone, puis ouvre l’ordinateur : la version du "
                     "compte — plus ancienne si le téléphone n’a pas encore synchronisé — remplace la sienne. "
                     "Le cours disparaît, et il ne revient jamais. C’est une perte de données silencieuse, la "
                     "plus coûteuse en confiance."),
             fix=("Passer l’emploi du temps au même régime que le reste : fusion par identifiant de cours "
                  "(`compteUnionParId` sur les sept jours), avec un `modifieAt` par cours pour arbitrer les "
                  "modifications, et des pierres tombales pour les suppressions (voir SY-01). En attendant, "
                  "le minimum est de comparer les deux versions et de garder la plus récente par date."),
             effort='3 h (avec SY-01)'),

        dict(id='ET-17', sev='MOYEN',
             titre='Le planning régénère sept jours complets à chaque affichage d’un seul jour',
             ou='js/pages/planning-moteur.js · emploiReconstruire(), l.723-740',
             constat=("`emploiReconstruire(dayIndex)` construit **les sept jours** (`for i = 0; i < 7; i++`) "
                      "pour n’en renvoyer qu’un, puis met en cache `emploiFige` avec une signature. Or "
                      "`emploiScolaireLire()` est appelée à chaque génération et fait un `JSON.parse` complet "
                      "du store. Et `focusSeancesJour()` (page Séance) déclenche elle aussi une génération "
                      "complète."),
             impact=("Sur un téléphone d’entrée de gamme, chaque changement d’onglet coûte plusieurs dizaines "
                     "de millisecondes de calcul, et la page Séance s’ouvre avec un temps de latence "
                     "perceptible. Ce n’est pas bloquant, mais c’est exactement la lenteur qu’on attribue à "
                     "« ce site est lourd »."),
             fix=("Deux gestes simples : (1) mémoïser la lecture du store (`emploiScolaireLire` dans une "
                  "variable, invalidée à chaque écriture) ; (2) ne générer que le jour demandé quand "
                  "`emploiFige` n’est pas encore calculé — le cache se remplit jour par jour au lieu de sept "
                  "d’un coup. Garder la signature pour invalider."),
             effort='2 h'),

        dict(id='ET-18', sev='MINEUR',
             titre='Le libellé du bouton « Continuer » et le titre de page ne racontent pas la même chose',
             ou='pages/emploi-temps.html, l.10 et l.47',
             constat=("Le titre est « Emploi du temps scolaire », le texte parle de « créneaux Cours » "
                      "génériques. Les deux formulations ne se répondent pas, et « Continuer » ne dit pas "
                      "qu’il va ouvrir le planning."),
             impact=("L’élève ne sait pas où il met les pieds, ni si son emploi du temps est facultatif. "
                     "Beaucoup sautent l’étape, puis se plaignent d’un planning générique — sans faire le lien "
                     "avec l’écran qu’ils viennent de passer."),
             fix=("Une phrase de tête qui répond à « à quoi ça sert ? » : « Avec ton emploi du temps, le site "
                  "sait quand tu es en cours — il ne te proposera jamais de réviser à ce moment-là. » Et un "
                  "bouton « Voir mon planning → ». Le bénéfice avant la mécanique."),
             effort='10 min'),
    ],
)
