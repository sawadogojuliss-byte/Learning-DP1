# -*- coding: utf-8 -*-
"""Sécurité, synchronisation, accessibilité, performance, architecture, contenu."""

SE = dict(
    cle='se',
    titre='Sécurité et vie privée',
    intro=("Ces cinq constats ne sont pas des questions de confort. Sur un outil scolaire utilisé par des "
           "mineurs, deux d’entre eux suffisent à justifier une mise en pause du site le temps d’un "
           "correctif. Ils sont aussi les moins chers à réparer : six heures au total."),
    items=[
        dict(id='SE-01', sev='BLOQUANT',
             titre='N’importe quel élève peut devenir administrateur en tapant un nom',
             ou='js/pages/boite.js · l.7-14 et l.56-66',
             constat=("`boiteEstAdmin()` appelle `boiteNomEstAdmin(userName)`, où `userName` est le prénom "
                      "**librement saisi à la première étape de l’inscription** — aucun compte Google, aucun mot "
                      "de passe, aucune vérification. Et la liste comparée (`BOITE_ADMINS`) est écrite en clair "
                      "dans le JavaScript public, avec les quatre noms complets."),
             impact=("Taper « Sawadogo Juliss Bill Owen » dans le champ prénom ouvre la liste de **toutes les "
                     "questions et suggestions de tous les élèves**, avec nom, e-mail, classe et matières, plus "
                     "le bouton pour y répondre depuis l’adresse officielle. Un élève qui découvre cela perd "
                     "toute confiance dans l’outil ; un parent à qui on l’explique demande le retrait du site. "
                     "Les noms et adresses personnelles des quatre responsables sont par ailleurs exposés."),
             fix=("L’autorisation ne doit pas dépendre d’un texte saisi : elle doit venir du `sub` Google vérifié "
                  "de la session. Remplacer `BOITE_ADMINS` (noms) par `BOITE_ADMINS_SUB` (les quatre "
                  "identifiants Google, qui ne sont pas devinables) et tester `window.compteSession.sub`. Tant "
                  "que la session n’est pas vérifiée côté serveur, aucun accès admin. Retirer les noms complets "
                  "et les e-mails du code livré."),
             effort='1 h'),

        dict(id='SE-02', sev='BLOQUANT',
             titre='Tous les messages des élèves transitent par un fil public, au nom figé dans le code',
             ou='js/pages/boite.js · l.6 et l.326-336 ; publication l.1129',
             constat=("Les questions, suggestions et retours sont publiés sur **ntfy.sh**, un service public de "
                      "messagerie, sous un nom de fil (`ix7-74c4e`) écrit dans le fichier livré. Le contenu "
                      "transmis (`boiteCorpsNtfy`, l.260-290) contient nom, e-mail, `googleSub`, classe, "
                      "matières, appareil et le texte du message."),
             impact=("Quiconque ouvre le code source de la page connaît le nom du fil : il peut lire les "
                     "messages des dernières heures **et en publier de faux**, signés d’un élève. Le site les "
                     "affiche ensuite comme authentiques, sans rien pour distinguer un vrai d’un faux. Une "
                     "question intime lue par toute la classe, ou une fausse réponse attribuée à un camarade, "
                     "suffit à détruire la réputation de l’outil en une journée."),
             fix=("Deux niveaux. Immédiat : régénérer le nom du fil et le sortir du code (le servir par "
                  "`data/boite-url.json`, déjà utilisé pour l’URL du script) — cela protège l’historique, pas "
                  "l’avenir. Durable : ne plus publier de contenu d’élève sur un canal public ; conserver "
                  "l’Apps Script comme unique dépôt, avec une authentification par session. Si ntfy reste "
                  "utilisé, il doit l’être avec un compte et un jeton (accès en lecture seulement), jamais avec "
                  "un nom de fil public."),
             effort='3 h'),

        dict(id='SE-03', sev='BLOQUANT',
             titre='Le secret qui autorise l’envoi de mails est dans la page',
             ou='js/pages/boite.js · constante `BOITE_SCRIPT_SECRET`',
             constat=("Le jeton partagé avec l’Apps Script qui envoie les e-mails est écrit en clair dans le "
                      "JavaScript servi au navigateur. N’importe qui peut l’extraire et appeler le script "
                      "directement."),
             impact=("Un tiers peut envoyer des e-mails depuis l’adresse officielle du site, à n’importe qui, "
                     "avec n’importe quel contenu. C’est une usurpation d’identité de l’établissement, et un "
                     "risque de réputation qui dépasse largement le site."),
             fix=("Le secret ne doit jamais quitter le serveur. Faire vérifier l’identité par le jeton Google "
                  "de la session (Apps Script sait lire `Session.getActiveUser()`), et supprimer la constante "
                  "du client. Si un secret partagé reste nécessaire, le faire délivrer par un endpoint "
                  "authentifié, à durée limitée."),
             effort='2 h'),

        dict(id='SE-04', sev='MAJEUR',
             titre='Sur un appareil partagé, l’élève suivant peut voir le précédent',
             ou='js/compte.js · changement de compte ; js/boot.js',
             constat=("À la déconnexion, le profil Google est retiré mais les données locales (planning, "
                      "devoirs, messages, prénom) restent dans `localStorage`. Aucune question « ce n’est pas "
                      "moi ? » n’est posée au retour sur l’appareil."),
             impact=("Au CDI, dans une salle informatique ou sur le téléphone d’un frère, l’élève suivant "
                     "retrouve le planning, les devoirs et parfois les messages du précédent. Le site affiche "
                     "même son prénom comme s’il était connecté."),
             fix=("À la déconnexion, proposer « Effacer mes données de cet appareil » (par défaut coché sur un "
                  "appareil partagé), et au retour, si le profil local ne correspond pas au compte Google "
                  "actif, demander explicitement : « Continuer en tant que X » / « Ce n’est pas moi ». Les "
                  "données de l’élève restent récupérables depuis son compte."),
             effort='2 h'),

        dict(id='SE-05', sev='MOYEN',
             titre='Aucune politique de sécurité de contenu, aucune intégrité sur les ressources externes',
             ou='index.html · 0 balise CSP, 0 attribut `integrity`',
             constat=("Le site charge trois familles de polices Google et plusieurs scripts externes sans "
                      "`Content-Security-Policy` ni `Subresource Integrity`. Une balise `<meta http-equiv>` "
                      "suffirait pour la CSP de base."),
             impact=("Si un CDN est compromis, ou si un script inséré par erreur arrive dans une page, rien ne "
                     "l’arrête. Sur un site qui manipule des données de mineurs, c’est une couche de défense "
                     "gratuite qu’on n’a pas."),
             fix=("Une CSP en `default-src 'self'; script-src 'self' <les domaines réellement utilisés>`, et "
                  "`integrity` sur chaque ressource externe. Commencer en `Content-Security-Policy-Report-Only` "
                  "pour repérer les oublis sans rien casser."),
             effort='1 h 30'),
    ],
)

SY = dict(
    cle='sy',
    titre='Synchronisation et perte de travail',
    intro=("Le site promet « retrouve ton planning sur tous tes appareils ». La fusion existe, mais elle ne "
           "sait pas distinguer une suppression d’une absence, ni deux modifications concurrentes. Quatre "
           "constats, tous dans la même mécanique — et c’est le seul endroit du document où un correctif peut "
           "faire perdre des données s’il est mal testé."),
    items=[
        dict(id='SY-01', sev='BLOQUANT',
             titre='Ce qui est supprimé sur un appareil revient depuis l’autre',
             ou='js/compte.js · compteUnionParId(), l.109',
             constat=("La fusion fait l’union des tableaux par identifiant. Un objet supprimé sur l’appareil A "
                      "est absent de A, mais toujours présent dans la sauvegarde du compte (ou de B) : l’union "
                      "le fait réapparaître. Il n’y a aucune pierre tombale."),
             impact=("L’élève supprime un devoir, un cours, un exercice. Le lendemain, ils sont revenus. Il "
                     "supprime à nouveau, ils reviennent encore. À la troisième fois, il cesse de corriger quoi "
                     "que ce soit — y compris ce qui compte. **Une suppression qui ne tient pas est pire que "
                     "pas de suppression du tout.**"),
             fix=("Des pierres tombales : au lieu de retirer l’objet, écrire `{ id, supprime: true, "
                  "supprimeAt }`. La fusion garde la version la plus récente, et un objet supprimé ne "
                  "réapparaît jamais. Purge des tombstones après 60 jours, quand tous les appareils ont "
                  "forcément synchronisé. À tester avec deux profils de navigateur, dans les deux sens."),
             effort='3 h'),

        dict(id='SY-02', sev='MAJEUR',
             titre='Une modification faite sur un appareil est ignorée si l’autre a déjà une valeur',
             ou='js/compte.js · compteUnionParId() ; js/memoire.js · memoireAppliquerEtat()',
             constat=("La fusion champ par champ garde la valeur non vide, mais ne compare jamais les dates : "
                      "elle ne sait pas laquelle des deux versions est la plus récente. C’est l’ordre de "
                      "lecture qui décide, pas la chronologie."),
             impact=("L’élève corrige une heure de devoir sur son téléphone ; la version de l’ordinateur, plus "
                     "ancienne, gagne. La correction disparaît sans message. L’élève la refait, et elle "
                     "disparaît encore."),
             fix=("Un `modifieAt` par objet, écrit à chaque modification, et une comparaison stricte à la "
                  "fusion : la date la plus récente gagne ; à égalité, la version locale. Migrer les objets "
                  "existants avec `modifieAt = 0`, ce qui préserve le comportement actuel pour l’historique."),
             effort='3 h'),

        dict(id='SY-03', sev='MOYEN',
             titre='Le profil enregistre un champ que personne ne relit',
             ou='js/memoire.js, l.135 (`selectedDay`)',
             constat=("`selectedDay` est écrit dans le profil à chaque sauvegarde, mais aucune restauration ne "
                      "le lit : vérifié, zéro occurrence de `data.selectedDay` dans `memoire.js` et "
                      "`compte.js`."),
             impact=("Ce n’est pas un bug visible, mais c’est un piège : un futur correctif croira que la valeur "
                     "est restaurée et s’appuiera dessus. C’est aussi du bruit dans un profil déjà volumineux "
                     "et synchronisé à chaque modification."),
             fix=("Retirer le champ, ou le restaurer explicitement en le bornant à 0-6. Ne pas le laisser dans "
                  "un entre-deux."),
             effort='10 min'),

        dict(id='SY-04', sev='MOYEN',
             titre='Les clés du minuteur ne suivent pas l’élève d’un appareil à l’autre',
             ou='js/pages/pomodoro-page.js · studyPlanIB_focusDurees, focusTache, focusTaches, focusVol_*',
             constat=("Les réglages du Pomodoro (durées, tâches, volumes) vivent en `localStorage` et ne sont "
                      "pas inclus dans le profil synchronisé. Seuls les objets du planning le sont."),
             impact=("L’élève règle ses durées sur son téléphone, puis travaille sur l’ordinateur du lycée : "
                     "tout est à refaire. Ce n’est pas dramatique, mais c’est incohérent avec la promesse « "
                     "retrouve ton planning sur tous tes appareils »."),
             fix=("Inclure un petit objet `focusReglages` (durées, volumes, son, fond, voix on/off) dans "
                  "`memoireLireEtat`, et l’appliquer au chargement. Les tâches peuvent suivre aussi — elles "
                  "sont déjà bornées à 40 entrées."),
             effort='1 h'),
    ],
)

AC = dict(
    cle='ac',
    titre='Accessibilité, mobile et confort visuel',
    intro=("Le site est utilisable à la souris, sur un écran large, en pleine lumière. Ce n’est pas le cas "
           "au clavier, au lecteur d’écran, sur un téléphone d’entrée de gamme ou le soir. Ces constats ne "
           "sont pas des cases à cocher : chacun correspond à un élève qui ne peut pas faire ce que les "
           "autres font."),
    items=[
        dict(id='AC-01', sev='MAJEUR',
             titre='Aucune zone d’annonce sur tout le site',
             ou='toutes les pages · 0 occurrence de `aria-live`',
             constat=("Aucune page ne déclare de région `aria-live` ou `role=\"status\"`, alors que le site "
                      "met à jour du contenu en JavaScript partout : ajout de cours, lecture d’un document, "
                      "lancement d’une séance, réponse à un message."),
             impact=("Un lecteur d’écran n’entend jamais le résultat d’une action. L’élève appuie sur « Ajouter "
                     "», rien ne se dit, il recommence — et crée un doublon. C’est la barrière la plus "
                     "structurante du site."),
             fix=("Une région unique et persistante dans `index.html` : `<div id=\"annonce\" role=\"status\" "
                  "aria-live=\"polite\" class=\"sr-only\">`, et une fonction `annoncer(texte)` utilisée par "
                  "toutes les actions. Les messages visuels existants peuvent rester ; il suffit de les "
                  "recopier dans la région."),
             effort='2 h'),

        dict(id='AC-02', sev='MAJEUR',
             titre='Le clavier est aveugle : 32 `outline:none`, aucune règle `:focus-visible`',
             ou='pages/*.html et js/pages/*.js (32 occurrences) ; style_v1/v2/v3.css (0 `:focus-visible`)',
             constat=("Trente-deux déclarations suppriment l’anneau de focus sans rien mettre à la place. "
                      "Aucune feuille de style ne définit `:focus-visible`."),
             impact=("Un élève qui navigue au clavier ne voit pas où il est. Sur un formulaire de douze champs, "
                     "il appuie sur Tab à l’aveugle et valide au hasard. C’est aussi le premier critère "
                     "d’accessibilité qu’un enseignant vérifie."),
             fix=("Une règle globale `:focus-visible { outline: 3px solid #059669; outline-offset: 2px; }` et "
                  "la suppression des 32 `outline:none` (ou leur remplacement par un style visible). Deux "
                  "heures, dont l’essentiel est de trouver les occurrences."),
             effort='2 h'),

        dict(id='AC-03', sev='MAJEUR',
             titre='Treize modales sur quinze ne sont pas des modales pour un lecteur d’écran',
             ou='pages/*.html · 15 `.context-modal` ; 2 `role=\"dialog\"` ; 0 `aria-modal`',
             constat=("Quinze fenêtres superposées existent, deux seulement portent `role=\"dialog\"`, aucune "
                      "`aria-modal=\"true\"`. Aucune ne piège le focus ni ne le restitue à la fermeture."),
             impact=("Au clavier, le focus continue de circuler derrière la fenêtre : on peut activer un bouton "
                     "invisible. Au lecteur d’écran, rien n’annonce l’ouverture, et la page continue d’être lue "
                     "comme si de rien n’était."),
             fix=("Un composant unique : `role=\"dialog\"`, `aria-modal=\"true\"`, `aria-labelledby`, focus sur "
                  "le premier élément, piège de tabulation, fermeture par Échap, restitution du focus. Migrer "
                  "les quinze modales dessus, une par une."),
             effort='1 j'),

        dict(id='AC-04', sev='MOYEN',
             titre='Dix-sept boutons-icônes n’ont pas de nom',
             ou='pages/*.html · boutons « × », « ← », « [corbeille] », « [crayon] »',
             constat=("Dix-sept boutons ne contiennent qu’un caractère ou un pictogramme, sans `aria-label`, "
                      "sans texte caché."),
             impact=("Le lecteur d’écran annonce « bouton » dix-sept fois. Impossible de savoir lequel supprime, "
                     "lequel ferme, lequel revient en arrière."),
             fix=("`aria-label` explicite sur chacun (« Supprimer le cours d’histoire », « Fermer »). Un test "
                  "automatique peut lister les boutons dont le texte fait moins de deux caractères et qui n’ont "
                  "pas d’`aria-label`."),
             effort='45 min'),

        dict(id='AC-05', sev='MOYEN',
             titre='Une trentaine de champs n’ont pas d’étiquette associée',
             ou='pages/*.html',
             constat=("Les champs sont identifiés par un `placeholder`, parfois par un texte voisin non lié. "
                      "`<label for>` est rare."),
             impact=("Le placeholder disparaît à la première frappe ; au lecteur d’écran, le champ n’a pas de "
                     "nom. La saisie devient un jeu de devinettes."),
             fix=("Étiquettes visibles ou `sr-only`, associées par `for`/`id`. C’est le même correctif que "
                  "DE-23 et ET-13, appliqué partout."),
             effort='3 h'),

        dict(id='AC-06', sev='MOYEN',
             titre='Des textes gris sous le seuil de lisibilité',
             ou='CSS · contrastes mesurés à 2,54:1 sur les textes secondaires',
             constat=("Les textes d’aide, les dates et les libellés secondaires utilisent des gris clairs "
                      "(`#9ca3af` sur blanc) qui n’atteignent pas le rapport 4,5:1 exigé pour le texte courant."),
             impact=("Sur un écran de téléphone en plein soleil — la situation normale dans une cour de "
                     "lycée — ces textes disparaissent. Et ce sont souvent les informations utiles : l’heure, "
                     "la date, la consigne."),
             fix=("Remplacer les gris par `#4b5563` (7:1) pour le texte courant, réserver `#9ca3af` aux "
                  "éléments purement décoratifs. Un contrôle automatique de contraste dans la CI."),
             effort='2 h'),

        dict(id='AC-07', sev='MOYEN',
             titre='Les débordements sont masqués plutôt que corrigés',
             ou='CSS · largeurs fixes inférieures à 400 px, `overflow: hidden`',
             constat=("Plusieurs conteneurs ont une largeur minimale fixe supérieure à la largeur d’un petit "
                      "téléphone (360 px), et le débordement est masqué au lieu d’être réorganisé."),
             impact=("Sur un iPhone SE ou un Android d’entrée de gamme, une partie du contenu est coupée : un "
                     "bouton à droite, une heure, une colonne du planning. L’élève ne peut pas y accéder du "
                     "tout."),
             fix=("Remplacer les largeurs fixes par `min(100%, …)`, passer les rangées en `flex-wrap`, et "
                     "tester à 320 px de large. Supprimer les `overflow: hidden` qui cachent un vrai problème."),
             effort='3 h'),

        dict(id='AC-08', sev='MOYEN',
             titre='Pas de mode sombre, pour un outil utilisé le soir',
             ou='CSS · aucune requête `prefers-color-scheme`',
             constat=("Le site n’a qu’un thème clair. Aucune variable de couleur n’est prévue pour un thème "
                      "alternatif."),
             impact=("Le site est utilisé le soir, souvent dans un lit, sur un téléphone. Un écran blanc à "
                     "pleine luminosité gêne, et beaucoup d’élèves baissent la luminosité au point de ne plus "
                     "lire les textes gris (AC-06)."),
             fix=("Un jeu de variables CSS et une requête `@media (prefers-color-scheme: dark)` ; les couleurs "
                  "sont déjà centralisées dans `style_v3.css`. Commencer par les trois écrans les plus utilisés "
                  "(planning, devoirs, minuteur)."),
             effort='1 j'),

        dict(id='AC-09', sev='MOYEN',
             titre='Le mouvement n’est presque pas respecté',
             ou='CSS · `prefers-reduced-motion` quasi absent',
             constat=("Les animations (transitions de page, pulsation du chrono, carrousel) ne consultent pas "
                      "la préférence système. Une seule règle existe, sur un élément secondaire."),
             impact=("Pour les élèves sensibles au mouvement — un cas réel et documenté — les animations "
                     "provoquent gêne ou nausée. Ils n’ont aucun moyen de les couper."),
             fix=("Une requête globale `@media (prefers-reduced-motion: reduce) { *, *::before, *::after "
                  "{ animation-duration: .01ms !important; transition-duration: .01ms !important; } }`."),
             effort='30 min'),

        dict(id='AC-10', sev='MINEUR',
             titre='Cinq images n’ont pas de dimensions déclarées',
             ou='pages/*.html · `<img>` sans `width`/`height`',
             constat=("Cinq images n’indiquent ni largeur ni hauteur, et n’ont pas de `loading=\"lazy\"`."),
             impact=("La page saute pendant le chargement, et le contenu se décale sous le doigt — ce qui "
                     "provoque des clics involontaires sur mobile."),
             fix=("`width`/`height` (ou `aspect-ratio`), `loading=\"lazy\"` sauf pour l’image d’en-tête, et "
                  "`alt` utile."),
             effort='30 min'),

        dict(id='AC-11', sev='MINEUR',
             titre='La légende utilise la même couleur pour deux catégories',
             ou='pages/legende.html, l.19 et l.25 ; js/pages/planning-base.js, l.462',
             constat=("Le violet `#a78bfa` sert à la fois pour « Activités » et pour « Mémoire ». La légende "
                      "présente donc deux entrées identiques, et le planning deux types de blocs "
                      "indiscernables."),
             impact=("L’élève ne peut pas distinguer une activité personnelle d’une session de mémoire. La "
                     "légende, censée expliquer les couleurs, devient une source de confusion — et l’information "
                     "n’est pas seulement chromatique, elle est absente."),
             fix=("Une couleur distincte pour « Mémoire » (par exemple `#7c3aed`), et un motif ou une icône en "
                  "plus de la couleur, pour ne pas dépendre uniquement de la teinte."),
             effort='30 min'),
    ],
)

PE = dict(
    cle='pe',
    titre='Démarrage, réseau et performance',
    intro=("Le site est rapide sur une fibre et un ordinateur récent. Sur un téléphone d’entrée de gamme, en "
           "4G limitée, il ne l’est plus — et c’est le contexte réel d’usage. Les six constats ci-dessous "
           "expliquent l’écart entre l’impression laissée par une démonstration et l’expérience quotidienne."),
    items=[
        dict(id='PE-01', sev='BLOQUANT',
             titre='66 requêtes et 1,25 Mo à chaque ouverture, sans rien réutiliser',
             ou='index.html · 32 fragments de page, 39 scripts, 6 feuilles de style',
             constat=("Le site est assemblé par fragments HTML chargés un par un, avec 39 fichiers JavaScript "
                      "et six feuilles de style. Aucune ressource n’est mise en cache avec une version, et "
                      "aucune n’est servie en `defer`."),
             impact=("Sur un téléphone d’entrée de gamme en 4G, l’ouverture dépasse plusieurs secondes, et "
                     "chaque navigation recharge plusieurs fichiers. L’élève voit une page blanche et croit que "
                     "le site est cassé (PO-17)."),
             fix=("`defer` sur tous les scripts non critiques, un `?v=` par ressource (PE-05), et un service "
                  "worker qui sert le cache d’abord (PE-02). Le découpage en fragments peut rester : c’est le "
                  "nombre de requêtes qu’il faut réduire, pas l’architecture."),
             effort='1 j'),

        dict(id='PE-02', sev='MAJEUR',
             titre='Aucun mode hors-ligne, aucun manifeste : ni installation, ni consultation sans réseau',
             ou='index.html · 0 `manifest`, 0 service worker',
             constat=("Le site ne déclare pas de manifeste et n’enregistre aucun service worker. Il n’est pas "
                      "installable, et il est inutilisable sans réseau."),
             impact=("Un élève dans le bus, dans une salle sans Wi-Fi ou avec un forfait épuisé ne peut pas "
                     "consulter son planning — le seul objet qu’il voudrait consulter hors ligne. Or tout est "
                     "déjà dans `localStorage`."),
             fix=("Un `manifest.webmanifest` (nom, icônes, `display: standalone`) et un service worker qui "
                  "met en cache la coquille et les fragments. Les données étant locales, le planning "
                  "fonctionnerait intégralement hors ligne."),
             effort='1 j'),

        dict(id='PE-03', sev='MAJEUR',
             titre='Un seul script en échec bloque tout le site',
             ou='index.html · chargement séquentiel des scripts ; js/boot.js',
             constat=("Les scripts sont chargés les uns après les autres, sans isolation. Une erreur de syntaxe "
                      "ou un 404 dans l’un d’eux interrompt la suite : les pages restent vides, sans message."),
             impact=("Un incident sur un seul fichier rend le site entier inutilisable, et l’élève n’a aucun "
                     "moyen de comprendre ce qui se passe. C’est aussi ce qui rend le diagnostic difficile côté "
                     "maintenance."),
             fix=("Charger les scripts en `defer` et isoler les modules dans des `try/catch` avec un message "
                  "dans une zone de repli. Un script en échec doit dégrader une fonction, pas tout le site."),
             effort='3 h'),

        dict(id='PE-04', sev='MOYEN',
             titre='L’OCR, les PDF et les sons sont chargés alors que personne ne les demande',
             ou='js/registre.js ; lib/ocr (16 Mo), lib/pdf, audio',
             constat=("Tesseract, le lecteur PDF et les ambiances sont référencés au démarrage, alors qu’ils ne "
                      "servent que sur deux pages et après un geste explicite."),
             impact=("Le premier écran paie le prix de fonctions que l’élève n’utilisera peut-être jamais. "
                     "C’est le poids le plus facile à retirer."),
             fix=("Chargement à la demande (`import()` déclenché par le clic « Lire le document », lecture audio "
                  "au premier appui sur « play »). Le registre doit distinguer les modules « toujours » des "
                  "modules « à la demande »."),
             effort='4 h'),

        dict(id='PE-05', sev='MOYEN',
             titre='La troisième feuille de style n’est jamais invalidée',
             ou='index.html · `style_v3.css` sans paramètre de version',
             constat=("Les deux premières feuilles portent un `?v=`, la troisième non. Un correctif CSS peut "
                      "rester invisible pour un élève dont le navigateur garde l’ancienne version en cache."),
             impact=("Les corrections de cette liste — focus, contraste, impression — pourraient être livrées "
                     "sans effet visible, et on croirait qu’elles ne marchent pas."),
             fix=("Ajouter `?v=` et l’inclure dans la vérification de version (`tools/verifier-*`) pour qu’un "
                  "oubli casse la CI."),
             effort='10 min'),

        dict(id='PE-06', sev='MINEUR',
             titre='Le site pèse 59 Mo de médias',
             ou='audio/pomodoro (54 Mo), images (4,9 Mo)',
             constat=("Les boucles d’ambiance sont en fichiers WAV non compressés, servis depuis le dépôt."),
             impact=("Sur un forfait mobile limité, un élève qui essaie trois sons consomme plusieurs dizaines "
                     "de mégaoctets sans le savoir."),
             fix=("Convertir en AAC/Opus à 96-128 kbit/s (un facteur 5 à 10 sur le poids, inaudible pour une "
                  "ambiance), et transformer en vignettes les grandes images. Afficher le poids à côté du "
                  "bouton de téléchargement d’un son."),
             effort='1 j'),
    ],
)

AR = dict(
    cle='ar',
    titre='Architecture et dette technique',
    intro=("Le site fonctionne. Mais il porte des doublons qui rendent chaque correctif plus risqué : vingt "
           "fonctions existent deux ou trois fois, la dernière chargée gagne silencieusement, et la moitié "
           "des erreurs sont avalées. Ce sont les constats les moins visibles pour l’élève, et les plus "
           "coûteux pour la suite."),
    items=[
        dict(id='AR-01', sev='MAJEUR',
             titre='Vingt fonctions sont définies dans plusieurs fichiers, dont deux moteurs de planning',
             ou='js/pages/planning-base.js, planning-moteur.js, planning-interface.js, planning-edition.js',
             constat=("Vingt noms de fonctions sont définis dans au moins deux fichiers : `generateDayEvents`, "
                      "`renderPlanning`, `openEditModal`, `saveEditedEvent`, `deleteEditedEvent`, `chain`, "
                      "`fixed`, etc. Comme les scripts sont chargés dans l’ordre, la dernière définition "
                      "écrase silencieusement les précédentes."),
             impact=("Un correctif appliqué au mauvais fichier n’a aucun effet — ou pire, un effet partiel qui "
                     "dépend de l’ordre de chargement. C’est la cause probable de plusieurs bugs « fantômes » "
                     "corrigés puis revenus."),
             fix=("Un inventaire automatisé en CI (`grep` des définitions, échec si un nom apparaît deux fois), "
                  "puis fusion des doublons un par un. Commencer par `generateDayEvents`, qui existe dans deux "
                  "moteurs différents."),
             effort='2 j'),

        dict(id='AR-02', sev='MAJEUR',
             titre='La moitié des erreurs sont avalées sans laisser de trace',
             ou='js/pages/planning-moteur.js · l.1071 ; try/catch muets ailleurs',
             constat=("De nombreux `try/catch` n’ont ni `console.warn`, ni remontée, ni message. Le cas "
                      "emblématique est `generateDayEvents` (l.1071) : si la génération d’un jour échoue, la "
                      "fonction rend un tableau vide, et la journée paraît simplement vide."),
             impact=("Un bug de génération est indiscernable d’une journée sans cours. L’élève croit que le "
                     "site n’a rien à lui proposer ; le développeur n’a aucun signal. C’est ce qui rend les "
                     "incidents impossibles à reproduire."),
             fix=("Chaque `catch` doit au minimum journaliser (`console.warn` avec le contexte) et, pour les "
                     "échecs visibles par l’élève, afficher un message discret avec un identifiant d’erreur. Un "
                     "verifier peut compter les `catch` vides et échouer au-delà d’un seuil."),
             effort='1 j'),

        dict(id='AR-03', sev='MOYEN',
             titre='Trente et une sauvegardes peuvent échouer sans un mot',
             ou='js/** · 31 `setItem` sans `try/catch`',
             constat=("Trente et un appels à `localStorage.setItem` ne sont pas protégés. Or `setItem` lève une "
                      "exception quand le quota est dépassé (5 Mo, facilement atteint avec l’OCR et les "
                      "historiques)."),
             impact=("Au moment où le stockage est plein, la sauvegarde échoue sans que rien ne le signale : "
                     "l’élève travaille, ferme, revient, et tout a disparu. C’est une perte de travail "
                     "silencieuse, la pire catégorie."),
             fix=("Un utilitaire `sauver(cle, valeur)` qui encapsule `setItem`, attrape l’exception de quota, "
                     "purge les données les plus anciennes (historique, sons en cache) et prévient l’élève une "
                     "seule fois : « Ton appareil est plein, j’ai archivé les anciennes données. »"),
             effort='3 h'),

        dict(id='AR-04', sev='MOYEN',
             titre='Deux systèmes de minuteur coexistent, avec deux jeux d’états',
             ou='js/pages/pomodoro.js (mort mais chargé) ; js/pages/pomodoro-page.js (actif)',
             constat=("Deux modules implémentent un Pomodoro, avec leurs propres durées, leur propre "
                      "enchaînement et leurs propres clés de stockage. Un seul est utilisé ; l’autre est "
                      "toujours chargé (`registre.js`, l.65)."),
             impact=("Chaque correction doit être faite deux fois, et les deux versions divergent (PO-04, "
                     "PO-05). C’est une source de bugs garantie pour l’avenir."),
             fix=("Supprimer `pomodoro.js`, déplacer ses deux fonctions utilitaires réellement utilisées dans "
                     "`pomodoro-page.js`, et retirer l’entrée du registre. Une demi-journée, et une famille "
                     "entière de bugs disparaît."),
             effort='3 h'),

        dict(id='AR-05', sev='MINEUR',
             titre='L’état du minuteur est éparpillé en sept clés localStorage',
             ou='js/pages/pomodoro-page.js · studyPlanIB_focusDurees, focusTache, focusTaches, focusVol_*, focusFond',
             constat=("Sept clés distinctes décrivent un seul objet logique. Aucune n’est versionnée, aucune "
                      "n’est lue de façon groupée."),
             impact=("Une migration ou une synchronisation (SY-04) doit traiter sept clés au lieu d’une, avec "
                     "le risque d’en oublier. Et un état incohérent (volume restauré, durée non) est possible."),
             fix=("Un objet unique `studyPlanIB_focusReglages` avec une version, lu et écrit d’un bloc, et une "
                  "migration depuis les sept anciennes clés au premier chargement."),
             effort='2 h'),
    ],
)

CO = dict(
    cle='co',
    titre='Contenu, promesses et cohérence',
    intro=("Un site ne perd pas seulement des utilisateurs sur des bugs : il en perd quand il promet ce qu’il "
           "ne fait pas, ou quand il parle deux langues. Ces dix constats sont les moins techniques et les "
           "plus rapides à corriger — plusieurs tiennent en dix minutes."),
    items=[
        dict(id='CO-01', sev='MAJEUR',
             titre='L’accueil annonce deux fonctionnalités qui n’existent pas',
             ou='pages/accueil.html · cartes de présentation',
             constat=("Deux cartes décrivent des fonctions absentes du produit : l’une parle de notifications "
                      "et de suivi de progression, l’autre de photographie de documents avec analyse — alors "
                      "que ces fonctions n’existent pas, ou pas sous cette forme."),
             impact=("L’élève cherche une fonction qu’on lui a montrée, ne la trouve pas, et en conclut que le "
                     "site est incomplet. La première impression est une promesse non tenue."),
             fix=("Décrire exactement ce que le site fait, avec les mots de l’interface (« importe ton emploi "
                  "du temps en photo », « un planning qui se refait chaque jour »). Si une fonction arrive "
                  "plus tard, l’annoncer comme telle, ou ne pas l’annoncer."),
             effort='1 h'),

        dict(id='CO-02', sev='MOYEN',
             titre='L’accueil vouvoie, tout le reste du site tutoie',
             ou='pages/accueil.html ; pages/onboarding-*.html',
             constat=("L’accueil utilise « vous », l’inscription et l’application utilisent « tu ». La bascule "
                      "se fait sans transition, au premier écran."),
             impact=("Le changement de ton se remarque, et donne l’impression de deux produits assemblés. Ce "
                     "n’est pas grave, mais c’est exactement le détail qui fait dire « ce site n’est pas fini »."),
             fix=("Choisir le tutoiement — c’est la voix de 90 % des écrans — et réécrire l’accueil en "
                  "conséquence. Une heure de relecture."),
             effort='1 h'),

        dict(id='CO-03', sev='MOYEN',
             titre='Le compteur de stress de l’accueil est cliquable et augmente le stress',
             ou='pages/accueil.html · bloc « niveau de stress »',
             constat=("Un élément d’affichage du niveau de stress réagit au clic et fait monter la valeur. Ce "
                      "n’est ni un formulaire, ni un jeu : c’est un affichage."),
             impact=("L’élève clique, le chiffre monte, et rien ne l’explique. Sur un site censé réduire "
                     "l’anxiété scolaire, un compteur de stress qui s’aggrave au clic est au mieux déroutant, "
                     "au pire anxiogène."),
             fix=("Rendre l’élément non interactif (un simple indicateur), ou en faire un vrai réglage "
                  "explicite. Si le but était de montrer l’effet du travail sur le stress, le dire."),
             effort='20 min'),

        dict(id='CO-04', sev='MOYEN',
             titre='L’export de toutes les données existe, mais aucun bouton ne l’appelle',
             ou='js/compte.js · compteExporter(), l.1690',
             constat=("La fonction d’export est écrite, testée, et **jamais appelée** : aucun bouton, aucun "
                      "lien, aucun menu ne la référence dans tout le dépôt."),
             impact=("L’élève n’a aucun moyen de récupérer ses données — ni avant d’effacer sa progression "
                     "(AU-13), ni pour changer d’appareil, ni pour vérifier ce que le site sait de lui. Une "
                     "fonction terminée qui ne sert à personne."),
             fix=("Un bouton « Télécharger mes données » dans la page Compte, et un lien depuis la "
                  "confirmation d’effacement. La fonction existe : il ne manque que l’appel."),
             effort='30 min'),

        dict(id='CO-05', sev='MOYEN',
             titre='Un lien partagé n’a ni titre ni aperçu',
             ou='index.html · 0 balise `og:`',
             constat=("Aucune balise Open Graph ni Twitter Card. Un lien envoyé sur WhatsApp s’affiche comme "
                      "une URL nue."),
             impact=("Quand un élève partage le site à un camarade, le message ne montre ni nom, ni "
                     "description, ni image. Le taux de clic s’effondre — et c’est le principal canal de "
                     "diffusion d’un outil scolaire."),
             fix=("Cinq balises `og:` (titre, description, image, url, type) et une image de 1200 × 630. Une "
                  "heure, illustration comprise."),
             effort='1 h'),

        dict(id='CO-06', sev='MOYEN',
             titre='Impossible d’imprimer son planning',
             ou='CSS · 0 `@media print`, 0 bouton « Imprimer »',
             constat=("L’export en image existe (`telechargerEmploiDuTemps`), mais aucune feuille d’impression : "
                      "le planning s’imprime avec le menu, les fonds, les ombres."),
             impact=("Un élève qui veut afficher son planning au mur, ou le montrer à ses parents sans "
                     "téléphone, n’a aucun moyen simple. Dans un contexte scolaire, c’est une attente réelle — "
                     "et c’est aussi le seul mode de consultation sans batterie."),
             fix=("Un `@media print` qui masque le menu, les fonds et les boutons, garde le planning du jour en "
                  "noir sur blanc, et un bouton « Imprimer » à côté de l’export image. Une heure de CSS, aucun JS."),
             effort='2 h'),

        dict(id='CO-07', sev='MINEUR',
             titre='La page Fériés ne dit pas l’année et sa grille se contredit',
             ou='pages/feries.html, l.24 ; #holidayDaysGrid',
             constat=("Le titre annonce « Cette semaine et la suivante » sans année. La grille combine "
                      "`flex-direction: column` et `flex-wrap: wrap`, deux propriétés qui se contredisent dans "
                      "une colonne."),
             impact=("L’élève ne sait pas si les dates affichées sont à jour ; et le rendu change selon la "
                     "largeur de l’écran, sans raison visible."),
             fix=("Titre avec le mois et l’année (« Fériés · octobre 2026 »), et une grille `display: grid; "
                  "grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr))`. Ajouter une phrase : « Ces "
                  "jours-là, ton planning s’allège automatiquement. »"),
             effort='30 min'),

        dict(id='CO-08', sev='MINEUR',
             titre='Le pied de page ne dit pas qui édite le site',
             ou='pages/accueil.html · footer',
             constat=("« © 2026 Study Plan IB » et deux liens légaux. Ni nom d’éditeur, ni adresse de contact."),
             impact=("Un parent ou un professeur qui cherche « qui est derrière ? » ne trouve rien. C’est un "
                     "frein de confiance précisément au moment où le site demande un compte Google."),
             fix=("Une ligne : « Édité par … · contact@… » et un lien vers la page Aide. Deux minutes."),
             effort='10 min'),

        dict(id='CO-09', sev='MINEUR',
             titre='Le carrousel défile seul et ses commandes n’ont pas de nom',
             ou='pages/accueil.html · carrousel',
             constat=("Le carrousel avance automatiquement toutes les quelques secondes, sans bouton pause. "
                      "Les flèches n’ont pas d’`aria-label` et ne sont pas atteignables au clavier."),
             impact=("Un contenu qui bouge pendant qu’on le lit est désagréable, et impossible à lire pour "
                     "certains élèves. Les commandes, elles, sont inutilisables."),
             fix=("Arrêter le défilement automatique (ou le suspendre au survol et au focus), nommer les "
                  "flèches, et respecter `prefers-reduced-motion` (AC-09)."),
             effort='45 min'),

        dict(id='CO-10', sev='MINEUR',
             titre='Le tutoriel bloque le bouton « Publier » sans dire pourquoi',
             ou='js/pages/tutoriel.js ; pages/tutoriel.html',
             constat=("Le bouton « Publier » est désactivé tant qu’une condition interne n’est pas remplie, "
                      "mais aucun texte n’indique laquelle. Le bouton reste grisé, sans infobulle."),
             impact=("L’élève clique, rien ne se passe, il ne sait pas ce qu’il doit faire. Il recommence, puis "
                     "abandonne — sur un écran censé apprendre à utiliser le site."),
             fix=("Afficher la condition à côté du bouton (« Ajoute au moins une étape pour publier »), et "
                  "activer le bouton dès qu’elle est remplie. Un message, pas un bouton muet."),
             effort='30 min'),
    ],
)
