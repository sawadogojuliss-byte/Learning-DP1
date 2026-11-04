# -*- coding: utf-8 -*-
"""Assemble les sections et les textes de synthèse du rapport."""
from collections import Counter

from d_et import ET
from d_po import PO
from d_de import DE
from d_autres import AU
from d_reste import SE, SY, AC, PE, AR, CO

SECTIONS = [ET, PO, DE, AU, SE, SY, AC, PE, AR, CO]

TOUS = [it for sec in SECTIONS for it in sec['items']]
IDS = [it['id'] for it in TOUS]
assert len(IDS) == len(set(IDS)), 'identifiants en double : %s' % (
    [x for x in IDS if IDS.count(x) > 1],)

COMPTE = Counter(it['sev'] for it in TOUS)

_ET, _PO, _DE = len(ET['items']), len(PO['items']), len(DE['items'])
_TOTAL = len(TOUS)
_B = COMPTE['BLOQUANT']
_M = COMPTE['MAJEUR']

COUVERTURE = dict(
    titre='Audit complet',
    sous_titre='Toutes les erreurs du site,<br/>expliquées et corrigées',
    chapeau=("Cent vingt et un constats, dont %s bloquants et %s majeurs. Pour chacun : où il se trouve dans "
             "le code, ce qui se passe réellement, pourquoi cela coûte de la satisfaction, et la correction "
             "durable — pas la rustine." % (_B, _M)),
    meta=[
        ('Objet', 'Study Plan IB — application de planification scolaire IB'),
        ('Branche auditée', 'arena/01a0bac7-learning-dp1'),
        ('Date', '22 octobre 2026'),
        ('Nature', 'Analyse en lecture seule. Aucun fichier du site n’a été modifié.'),
        ('Périmètre', '32 fragments de page, 39 fichiers JavaScript, 6 feuilles de style, 1 écran de démarrage'),
        ('Méthode', 'Lecture ligne à ligne des trois zones demandées (emploi du temps, Pomodoro, devoirs et '
                    'examens), puis mesures automatiques sur l’ensemble du dépôt, puis vérification manuelle '
                    'de chaque constat'),
    ],
)

OUVERTURE = ("Ce document remplace les deux rapports précédents. Il reprend les constats de la première "
             "passe (freins à la satisfaction), ceux de la deuxième (sécurité, synchronisation, "
             "architecture, mobile) et ceux de la troisième, consacrée aux trois zones demandées : emploi du "
             "temps, page Pomodoro, devoirs et examens. Rien n’a été retiré ; plusieurs constats anciens ont "
             "été vérifiés à nouveau.")

LIRE = [
    ("Chaque constat porte un identifiant", "ET emploi du temps, PO minuteur, DE devoirs et examens, AU "
     "autres pages, SE sécurité, SY synchronisation, AC accessibilité, PE performance, AR architecture, CO "
     "contenu. Un identifiant ne change jamais : il sert à discuter d’un point précis sans le décrire à "
     "nouveau."),
    ("Quatre niveaux de gravité", "**Bloquant** : une fonction ne marche pas, ou la sécurité est en défaut. "
     "**Majeur** : la fonction marche, mais l’élève en sort frustré ou perd son travail. **Moyen** : friction "
     "répétée. **Mineur** : finition."),
    ("Trois rubriques par constat", "« Ce qui se passe » décrit le comportement réel, code à l’appui. "
     "« Pourquoi c’est un problème » décrit l’effet sur l’élève, pas sur le code. « Solution durable » décrit "
     "la correction qui règle la cause — et non celle qui masque le symptôme."),
    ("Les renvois entre constats sont volontaires", "Beaucoup de défauts partagent une cause : la solution "
     "est parfois écrite une seule fois, avec un renvoi (« voir ET-03 »), pour éviter trois corrections "
     "divergentes du même geste."),
]

SURVOL = [
    ("Le socle est bon", "Moteur de planning complet, OCR embarqué localement, voix testée en navigateur "
     "réel, échappement HTML rigoureux, CSS propre et découpé. Ce n’est pas un site mal fait : c’est un site "
     "bien fait là où on l’a regardé, sans garde-fous là où personne n’a regardé."),
    ("Les trois zones demandées concentrent les défauts les plus coûteux", "Sur %d constats, %d concernent "
     "l’emploi du temps, le minuteur et les devoirs. Ce n’est pas un hasard : ce sont les trois endroits où "
     "le site prend des décisions à la place de l’élève." % (_TOTAL, _ET + _PO + _DE)),
    ("Cinq constats suffisent à changer la perception du produit", "DE-01 (l’aperçu des examens s’affiche "
     "dans une zone invisible), DE-14 (des révisions dans le passé), PO-02 (le décor choisi n’est jamais "
     "conservé), AU-06 (un exercice ne peut pas être marqué fait) et SE-01 (l’admin par prénom). Les cinq "
     "sont réparables en une journée."),
]

LIMITES = [
    ("Pas de test sur appareil réel", "L’analyse est statique : lecture du code, mesures sur le dépôt, "
     "vérification du comportement attendu. Les défauts tactiles sont déduits du CSS et des dimensions "
     "déclarées, pas observés sur un téléphone. Un passage sur deux appareils reste nécessaire avant de "
     "déclarer l’accessibilité mobile corrigée."),
    ("Pas de lecteur d’écran", "Le décompte des `aria-live`, des `role` et des étiquettes est fiable ; il ne "
     "remplace pas une lecture par VoiceOver ou NVDA. Trois constats (AC-01, AC-03, ET-13) demandent une "
     "vérification à l’oreille après correction."),
    ("Sécurité évaluée côté client", "Sans accès à la configuration du serveur, la sécurité est jugée sur ce "
     "que le client envoie et affiche. Les règles de lecture et d’écriture réelles des services (Google "
     "Identity, ntfy, Apps Script) doivent être confirmées avant de conclure qu’un correctif suffit."),
    ("Pas de mesure sur réseau lent", "Les chiffres de démarrage viennent du nombre de requêtes et du poids "
     "des fichiers, pas d’une trace réseau sur 3G. L’ordre de grandeur est juste ; le temps exact dépendra de "
     "l’appareil."),
]

PLAN = [
    dict(nom='Vague 0 — Fermer la porte', duree='1 jour', couleur='#b91c1c',
         texte=("Sécurité. Rien d’autre ne compte avant. **SE-01** (admin par `sub` Google), **SE-03** (secret "
                "sorti du client), **SE-02** (fil de messages privé), **SE-04** (« ce n’est pas moi » sur "
                "appareil partagé). Ces correctifs ne s’améliorent pas avec le temps : ils s’aggravent avec le "
                "nombre d’utilisateurs.")),
    dict(nom='Vague 1 — Ne plus mentir ni perdre', duree='3 à 4 jours', couleur='#c2410c',
         texte=("Les constats qui font dire « ce site est cassé » ou « ce site m’a pris mon travail ». **DE-01** "
                "et **DE-02** (l’onglet Examens), **DE-14** (révisions dans le passé), **DE-15** (semaine "
                "d’examen), **PO-01** (mauvais jour sur la page Séance), **PO-02** (décor perdu), **AU-06** "
                "(exercice fait), **AU-01** (navigation de semaine), **DE-06** (planning non rafraîchi), "
                "l’annulation commune sur les trois suppressions (**ET-03**, **DE-05**, **AU-07**).")),
    dict(nom='Vague 2 — Rendre le travail durable', duree='3 jours', couleur='#a16207',
         texte=("Synchronisation et édition. **SY-01** (pierres tombales), **SY-02** (`modifieAt`), **DE-25** "
                "(fusion du store de devoirs), **ET-16** (emploi du temps écrasé), **DE-03** et **DE-04** "
                "(édition d’un devoir et d’un examen), **ET-01** (chevauchements), **ET-05** et **ET-06** "
                "(lecture d’une photo), **PO-03** (chrono persisté).")),
    dict(nom='Vague 3 — Le confort qui fait revenir', duree='4 à 5 jours', couleur='#1d4ed8',
         texte=("Accessibilité, mobile, vitesse. **AC-01** (`aria-live` globale), **AC-02** (focus visible), "
                "**AC-03** (modales), **PE-01** (`defer` + cache), **PE-02** (hors-ligne), **PE-03** (un script "
                "en échec ne bloque plus), **CO-01** (accueil honnête), **CO-04** (export), **CO-05** (aperçu "
                "des liens), **CO-06** (impression), **AC-08** (mode sombre).")),
]

CHIFFRAGE = [
    ('Vague 0', 'Sécurité', '6 h', '1 jour', '#b91c1c'),
    ('Vague 1', 'Ne plus mentir ni perdre', '22 h', '3 à 4 jours', '#c2410c'),
    ('Vague 2', 'Travail durable', '19 h', '3 jours', '#a16207'),
    ('Vague 3', 'Confort et vitesse', '34 h', '4 à 5 jours', '#1d4ed8'),
    ('Reste', 'Constats mineurs et finitions', '26 h', '3 jours', '#4b5563'),
]

NE_PAS_TOUCHER = [
    ("Le moteur de planification", "Ses règles sont validées : fériés par date précise, séances réparties, "
     "jamais de cours inventé, jamais de nouvelle concentration automatique. Aucun correctif proposé ici ne "
     "change une règle — sauf DE-15, qui fait respecter une règle déjà écrite."),
    ("Le système de voix", "Il a été testé en navigateur réel (bip, annonce des minutes, arrêt de la "
     "musique). Les deux seuls ajouts proposés sont le fichier manquant (PO-14) et l’interrupteur (PO-09)."),
    ("Le CSS", "Propre, découpé, sans redondance. Les interventions proposées sont additives : focus, sombre, "
     "impression."),
    ("La structure en fragments", "Elle coûte cher au démarrage, mais elle n’est pas un défaut de conception. "
     "On la cache (PE-01, PE-02), on ne la réécrit pas."),
]

QUESTIONS = [
    ("Par quoi commencer ?", "La vague 0, seule, cette semaine. Six heures pour fermer la porte. Ensuite la "
     "vague 1, qui contient les cinq correctifs les plus visibles."),
    ("Les pierres tombales (SY-01) sont-elles risquées ?", "C’est le seul correctif de la liste qui touche au "
     "cœur de la synchronisation. Il mérite un test dédié (deux profils, suppression d’un côté, fusion, "
     "vérification de l’absence). En version courte, on peut ne l’appliquer qu’aux devoirs et aux exercices."),
    ("Faut-il garder le second minuteur ?", "Non. Le réduire à ses deux fonctions utilitaires (AR-04) supprime "
     "PO-05 et met PO-04 hors de portée. C’est trois heures qui évitent une famille entière de bugs."),
    ("Le fil public ntfy peut-il attendre ?", "Non. Changer le nom du fil prend dix minutes et protège "
     "l’historique. La vraie correction (ne plus publier de contenu d’élève sur un canal public) prend trois "
     "heures et devrait suivre dans la même semaine."),
]

PRIORITE = [
    ('SE-01', "L’administration repose sur un prénom saisi librement : n’importe qui peut lire la boîte.", '1 h'),
    ('SE-02', "Les messages passent par un fil public dont le nom est dans le code livré.", '3 h'),
    ('DE-01', "L’import d’un planning d’examens n’affiche rien : la zone existe dans l’autre onglet.", '30 min'),
    ('DE-14', "Des révisions sont posées dans des jours déjà passés.", '30 min'),
    ('DE-15', "La semaine d’examen garde les anciens blocs d’étude.", '30 min'),
    ('PO-01', "La page Séance affiche le dernier jour cliqué sous la date d’aujourd’hui.", '1 h'),
    ('PO-02', "Le décor choisi n’est jamais conservé : il est réécrit à chaque ouverture.", '30 min'),
    ('ET-05', "À la lecture d’une photo, les en-têtes de jour sont ignorés : tous les cours tombent sur un jour.", '1 h'),
    ('AU-06', "Un exercice ne peut jamais être marqué comme fait : le compteur ne descend pas.", '30 min'),
    ('AC-01', "Aucune zone d’annonce : un lecteur d’écran n’entend jamais les mises à jour.", '2 h'),
]
