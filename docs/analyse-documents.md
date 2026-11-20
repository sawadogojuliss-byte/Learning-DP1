# Analyse locale des documents scolaires

Le site utilise PDF.js pour les PDF et Tesseract.js pour les scans et photos. Les données OCR françaises et anglaises sont servies par le site lui-même : l'analyse ne transmet pas les documents à une API externe. Le chargement initial peut nécessiter Internet. La synchronisation éventuelle des données de compte après validation conserve son comportement existant ; la confidentialité annoncée concerne l'analyse du fichier, non toutes les fonctions du site.

## Fonctionnement et prudence

- Les pages sont examinées individuellement jusqu'à 20 pages. Un PDF plus long est refusé avec une instruction de le fractionner, sans traitement partiel silencieux. Le rendu des scans est borné pour limiter la mémoire utilisée.
- La couche texte est reconstituée selon les positions visuelles. Une grande image déclenche aussi l'OCR, même en présence d'une couche texte partielle.
- L'emploi du temps utilise plusieurs interprétations (colonnes, lignes ou grille) et conserve une seule interprétation. Si aucun cours complet n'est reconnu, le formulaire manuel permet de fournir le jour, le nom et les heures. Aucun jour n'est présélectionné dans ce formulaire. Les cours manquants peuvent aussi être ajoutés à la main.
- Les dates ISO, numériques non ambiguës et les mois français ou anglais avec année explicite sont reconnus. Une année manquante, un jour et un quantième seuls, ou une date numérique telle que 04/05/2031 dont l'ordre jour/mois est ambigu restent à préciser. Les dates impossibles ne sont pas corrigées arbitrairement.
- Pour les devoirs et examens importés, une matière, une date et deux heures valides doivent être présentes ou saisies avant confirmation. En particulier, les horaires absents ne sont pas automatiquement copiés de l'emploi du temps. Quand plusieurs horaires et matières sont extraits d'un même bloc sans association fiable, les matières sont conservées mais leurs heures restent à compléter. Les anciennes données et les autres fonctions de saisie manuelle conservent leur comportement.
- Toutes les propositions sont modifiables et demandent une confirmation avant écriture ; l'analyse seule ne supprime pas les anciennes données. Les documents peuvent contenir des lignes non détectées : il faut vérifier l'intégralité du résultat et ajouter les omissions.

## Corpus reproductible de 20 PDF fictifs

`tools/tester-corpus-ocr.mjs` génère en mémoire et analyse séparément dix emplois du temps et dix programmes d'examen, avec comparaison exacte aux valeurs attendues ; il ne conserve ni ne transmet de document d'utilisateur. Les résultats ci-dessous correspondent à l'exécution après ajustements :

| Emploi du temps | Résultat attendu et constaté |
|---|---|
| 1. Ligne française | Chimie, lundi, 08:00–09:00 |
| 2. Ligne anglaise | Physics, mardi, 10:00–11:30 |
| 3. Horaire anglais am/pm | History, vendredi, 13:00–14:00 |
| 4. Bloc français | Chimie, mercredi, 08:00–09:00 |
| 5. Bloc anglais | Physics, jeudi, 10:00–11:00 |
| 6. Deux pages | deux cours, sur lundi et mardi |
| 7. Jour absent | aucune attribution automatique de jour |
| 8. Heure impossible | aucun cours proposé |
| 9. Scan anglais | Physics, lundi, 08:00–09:00 |
| 10. Scan français | Chimie, mardi, 10:00–11:00 |

| Examen | Résultat attendu et constaté |
|---|---|
| 1. Date ISO | Chimie, 2031-10-23, 08:00–09:00 |
| 2. Date numérique non ambiguë | Physique, 2031-10-23, 10:00–11:00 |
| 3. Mois puis jour en anglais | Physics, 2031-10-23, 08:00–09:00 |
| 4. Jour puis mois en anglais | Chemistry, 2031-10-23, 10:00–11:00 |
| 5. Mois en français | Histoire, 2031-10-23, 08:00–09:00 |
| 6. Année manquante | matière et heures conservées, date vide |
| 7. Date numérique ambiguë | matière et heures conservées, date vide |
| 8. Heures absentes | matière et date conservées, heures vides |
| 9. Scan anglais | Physics, 2031-10-23, 08:00–09:00 |
| 10. Scan français | Chimie, 2031-10-23, 10:00–11:00 |

Les matières anglaises sont rapprochées du nom correspondant dans le profil de test. Les essais incluent quatre scans artificiels nets, pas des documents réels. Ils vérifient aussi qu'aucune date ambiguë ou heure manquante n'est enregistrée par l'aperçu, qu'aucun jour manuel n'est présélectionné et qu'aucun document n'est envoyé à un tiers pendant la lecture.

## Diagnostic et limites

L'examen du code et des anciens tests a mis en évidence trois hypothèses risquées : année déduite de la date courante, association d'horaires aux matières selon l'ordre d'extraction d'un tableau, et remplissage automatique d'horaires depuis l'emploi scolaire. Ces hypothèses ont été retirées de l'import et les tests correspondants adaptés. L'absence des mois anglais empêchait aussi de reconnaître certaines dates ; le dictionnaire et les données OCR anglaises ont été ajoutés. Les contrôles existants continuent de couvrir notamment les grilles, les PDF mixtes, les pages multiples, les doublons et la limite de pages.

**Aucun modèle neuronal n'a été réentraîné** : les données linguistiques préentraînées de Tesseract ont été ajoutées et les règles de lecture ajustées. Les 20 tests synthétiques ne mesurent pas la performance sur tous les documents. Un texte flou, manuscrit, tourné, dense, une grille complexe, un ordre d'extraction trompeur ou un profil de matières ambigu peut produire des erreurs ou des omissions, même après ces améliorations. Les propositions sont des aides, pas une garantie : comparer au document d'origine avant de confirmer, et tester à l'avenir des exemples réels anonymisés et variés.
