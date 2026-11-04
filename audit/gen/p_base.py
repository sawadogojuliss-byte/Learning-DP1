# -*- coding: utf-8 -*-
"""Textes d'introduction du guide de prompts : mode d'emploi, prompt maître, gabarit, règles."""

INTRO = (
    "Ce document ne corrige rien. Il contient les textes à coller dans une session d’assistant de code "
    "pour faire appliquer l’audit, lot par lot, sans casser ce qui marche. Chaque lot correspond à un "
    "ensemble de constats qui partagent une cause : on obtient un résultat vérifiable, on coche, on "
    "passe au suivant."
)

MODE_EMPLOI = [
    ("Ouvrez une nouvelle session", "Un lot = une session. Ne mélangez pas deux lots dans la même "
     "conversation : l’assistant perd le fil, et vous ne savez plus ce qui a été fait quand quelque chose "
     "casse."),
    ("Collez d’abord le prompt maître", "Il rappelle les règles du projet — ce qu’on ne touche pas, ce "
     "qu’on vérifie avant de livrer. Sans lui, l’assistant improvise la définition du « terminé »."),
    ("Collez ensuite le prompt du lot", "Un seul. Lisez la ligne « Vous devez obtenir » avant de "
     "l’envoyer : c’est votre critère d’acceptation. Si vous ne savez pas la vérifier vous-même, demandez "
     "à l’assistant de vous donner la manipulation exacte."),
    ("Exigez la preuve", "Fichiers modifiés, résultat des vérificateurs, manipulation de test. Une "
     "réponse qui dit « c’est corrigé » sans rien de tout cela n’est pas une réponse."),
    ("Testez vous-même sur le site déployé", "Le code peut être juste et le déploiement en retard (cache, "
     "build Pages). Si le comportement n’a pas changé, attendez la fin du déploiement avant de rouvrir "
     "le lot."),
    ("Committez un lot à la fois", "Un message de commit qui reprend l’identifiant du lot (« Lot 4 — "
     "annulation des suppressions (ET-02, ET-03, DE-05, AU-07) »). Ainsi, un retour arrière reste possible "
     "sans perdre les lots précédents."),
]

MAITRE = """Tu vas travailler sur Study Plan IB, un site statique (HTML, CSS, JavaScript, sans étape de
build) publié sur GitHub Pages. Il sert à un élève de DP1 : emploi du temps, planning de révisions,
minuteur Pomodoro, devoirs et examens. Les données vivent dans le navigateur (localStorage) et se
synchronisent avec un compte Google.

Avant de répondre, lis les fichiers concernés par ma demande, ainsi que js/registre.js et js/boot.js.
Ne suppose rien sur le contenu d'un fichier : ouvre-le.

Mes règles, valables pour toutes mes demandes :

1. Ne change que ce que je demande. Pas de refactor opportuniste, pas de « pendant que j'y suis », pas
   de reformatage. Si tu vois autre chose à corriger, signale-le à la fin, sans y toucher.
2. Avant d'écrire du code, décris en cinq lignes ce que tu vas faire et dans quels fichiers. Si cela
   touche plus de trois fichiers, arrête-toi et attends mon accord.
3. Après, montre-moi ce que tu as fait : les fichiers modifiés, le résumé du diff, et la preuve que ça
   fonctionne. Jamais « c'est corrigé » sans preuve.
4. Aucune correction ne doit notifier les utilisateurs : pas de message, pas de bannière, pas
   d'explication affichée. Le correctif vaut pour tout le monde, silencieusement.
5. Règles métier intouchables : jamais de nouvelle concentration automatique après le bip ; la musique
   s'arrête complètement quand la pause commence, puis la voix parle seule ; les fériés sont gérés par
   date précise ; le site ne propose jamais de réviser pendant un cours ; jamais de cours inventé.
6. La voix doit s'entendre sur un vrai navigateur. Un test hors du site ne compte pas.
7. Aucun mail de test, jamais.
8. Avant de livrer, lance node --check sur chaque fichier JavaScript modifié, puis les vérificateurs un
   par un (node tools/verifier-*.js). Donne le résultat exact de chacun, y compris les échecs.
9. Si un point est ambigu, ou si deux constats se contredisent, pose la question au lieu de choisir.
10. Si une partie du correctif dépend d'autre chose que du dépôt (Apps Script, console Google, réglage
    d'hébergement), ne l'improvise pas : liste-la séparément dans une section « à faire hors dépôt ».
11. Tu écris en français, et tu tutoies l'élève dans le code que tu produis (c'est la voix du site).

Commence par me dire ce que tu as compris de la demande, puis attends mon feu vert si la règle 2
s'applique."""

GABARIT = """Lot : <numéro et nom>
Constat(s) de l'audit : <identifiants, par exemple DE-01, DE-02>
But : en une phrase, ce que l'élève doit pouvoir faire à la fin.
Fichiers concernés : <liste des fichiers à ouvrir>

Ce que je veux exactement :
1. <le comportement attendu, formulé comme une phrase de test>
2. <le cas limite à traiter>
3. <ce qui doit rester inchangé>

Ce que je ne veux pas : <les tentations à écarter pour ce lot>

Comment on vérifie : <la manipulation précise, celle que je peux refaire moi-même>

Réponds dans cet ordre : le plan, le code, la preuve. Pas de conclusion avant la preuve."""

REGLES = [
    ("Un lot à la fois", "Deux lots dans une session, et vous ne saurez plus lequel a cassé quoi. "
     "L’assistant, lui, mélange les fichiers et perd la moitié des contraintes."),
    ("Un constat = un test", "Pour chaque problème corrigé, il doit exister une manipulation qui échoue "
     "avant et réussit après. Si vous ne pouvez pas l’écrire, le correctif n’est pas vérifiable."),
    ("Toujours demander la preuve", "« Montre-moi le diff », « donne-moi le résultat de node "
     "--check », « quelle est la commande qui prouve que ça marche ? ». C’est ce qui distingue un "
     "correctif d’une intention."),
    ("La sécurité d’abord", "Les lots 0 à 2 ne sont pas négociables et ne s’améliorent pas avec le "
     "temps : chaque semaine d’attente ajoute des données exposées. Le reste peut attendre."),
    ("Ne jamais demander « corrige tout »", "Un prompt qui demande les 121 constats d’un coup produit "
     "cent vingt et un changements dont aucun n’est testé. C’est la garantie d’un site cassé et d’un "
     "retour arrière complet."),
    ("Un commit par lot", "Le message reprend les identifiants. Si un lot casse quelque chose deux "
     "semaines plus tard, vous pouvez l’annuler seul."),
    ("Relire avant d’accepter", "Demandez toujours un second passage : « relis ton propre diff et "
     "cherche ce que tu as cassé ». Un assistant trouve ses propres erreurs une fois sur deux."),
    ("Ne pas mélanger correctif et design", "Si un lot change l’apparence en plus du comportement, vous "
     "ne saurez pas ce qui a cassé l’affichage. Le design se demande séparément."),
    ("Vérifier sur le site déployé", "Le code peut être juste et le déploiement en retard. Si le "
     "comportement n’a pas changé, attendez la fin du déploiement avant de conclure."),
    ("Tenir le décompte", "Le tableau de suivi à la fin du document sert à cela. Ce qui n’est pas coché "
     "n’est pas fait, même si l’assistant a dit qu’il l’avait fait."),
]

CONTROLES = [
    dict(titre='Relire un diff avant de l’accepter', quand='Juste après un lot, avant de committer.',
         prompt="""Relis le diff que tu viens de produire, comme si tu ne l'avais pas écrit.

Cherche, dans cet ordre :
1. Ce que tu as cassé ailleurs : une fonction renommée encore appelée, un identifiant HTML supprimé
   encore lu, un style qui ne s'applique plus.
2. Ce que tu as changé sans que je l'aie demandé.
3. Les cas limites que tu n'as pas traités : valeur vide, null, date passée, tableau vide, double clic.
4. Les erreurs avalées : un try/catch sans message, une promesse sans catch.

Pour chaque point trouvé, donne le fichier, la ligne, et la correction. Ne corrige rien avant de me
l'avoir montré."""),
    dict(titre='Vérifier avant de livrer', quand='Avant chaque commit.',
         prompt="""Avant de considérer ce lot terminé, donne-moi :

1. La liste des fichiers modifiés, avec le nombre de lignes ajoutées et supprimées.
2. Le résultat de node --check sur chaque fichier JavaScript modifié.
3. Le résultat de chaque vérificateur, un par un (node tools/verifier-*.js), en indiquant ceux qui
   échouent et pourquoi.
4. La manipulation exacte que je dois faire pour constater le correctif, étape par étape, en partant
   d'un état propre.
5. Ce qui n'est pas couvert par ce lot, et qui reste à faire.

Si un vérificateur échoue, ne le contourne pas : dis-moi ce qu'il détecte et propose une correction."""),
    dict(titre='Tester la voix et le son sur un vrai navigateur', quand='Lots 13 et 12 (minuteur).',
         prompt="""Le correctif touche au son. Un test hors du site ne compte pas.

Donne-moi un scénario de test à faire moi-même, dans l'ordre exact :
1. Le fichier à ouvrir, le geste à faire, ce que je dois entendre.
2. Le cas où la musique doit se taire complètement avant que la voix parle.
3. Le cas où je relance la pause pendant l'annonce (le son ne doit pas se superposer).
4. Le cas où je change d'onglet pendant la pause (le son doit continuer ou s'arrêter, mais pas se
   dédoubler).

Précise pour chaque étape ce qui doit se passer et ce qui signalerait un défaut. Ne me dis pas que
c'est bon sans que je te l'aie confirmé."""),
    dict(titre='Écrire un test de non-régression', quand='Quand un bug est corrigé et pourrait revenir.',
         prompt="""Ce défaut pourrait revenir à la prochaine modification. Écris un test de non-régression
qui échoue sur l'ancien comportement et passe sur le nouveau.

Contraintes : le test doit tourner avec les outils déjà présents dans tools/ (pas de nouvelle
dépendance), s'exécuter en moins de dix secondes, et ne rien envoyer sur le réseau. Donne-moi la
commande pour le lancer, et le résultat avant et après correction."""),
    dict(titre='Faire le point sur ce qui reste', quand='À la fin de chaque vague.',
         prompt="""Fais le point sur l'audit, sans rien corriger.

Pour les constats suivants : <liste d'identifiants>, dis-moi pour chacun :
1. Corrigé, avec la preuve (fichier et ligne du correctif).
2. Partiellement corrigé, et ce qui manque.
3. Non commencé.

Puis liste les constats qui, d'après ce que tu as vu dans le code, demandent une décision de ma part
avant d'être corrigés — et pose-moi les questions une par une."""),
]

ANTI = [
    ("Corrige tous les problèmes de l’audit",
     "L’assistant va modifier cinquante fichiers, en oublier la moitié, casser trois fonctions et vous "
     "annoncer que tout est fait. Vous ne pourrez ni vérifier, ni revenir en arrière proprement.",
     "Un lot par session, avec les identifiants concernés."),
    ("Fais en sorte que ce soit mieux",
     "« Mieux » n’est pas un critère. Vous obtiendrez une refonte de l’interface et un nouveau bug sur "
     "le chrono, alors que vous vouliez trois lignes de confirmation.",
     "Décrivez le comportement observable : « quand je supprime un cours, un toast de 8 secondes "
     "propose Annuler »."),
    ("Optimise le code",
     "Sans mesure, l’optimisation est une opinion. Et sur ce dépôt, elle touche le moteur de planning, "
     "qui est la partie la plus fragile.",
     "« Le planning met 900 ms à s’afficher sur mon téléphone ; trouve pourquoi et corrige uniquement "
     "ça. »"),
    ("Refais la page comme tu veux",
     "Vous perdez la main sur un produit qui a des règles métier précises — et l’assistant n’a aucune "
     "raison de les connaître.",
     "Décrivez écran par écran, et gardez les lots de design séparés des lots de comportement."),
    ("Ajoute des tests partout",
     "Cent tests qui échouent pour des raisons de configuration ne valent pas un test qui protège le "
     "bug que vous venez de corriger.",
     "« Écris le test qui empêche CE bug de revenir », un par lot."),
    ("Ignore les erreurs de la console",
     "Une erreur JavaScript non traitée, sur ce site, signifie souvent une fonction qui ne s’exécute "
     "pas du tout. C’est exactement ce que l’audit reproche déjà au code (AR-02).",
     "« Corrige l’erreur affichée dans la console, et dis-moi ce qui l’a causée. »"),
]
