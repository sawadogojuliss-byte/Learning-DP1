# Analyse locale des documents scolaires

Le site utilise PDF.js pour lire les PDF et le modèle neuronal LSTM français de Tesseract.js déjà embarqué pour les pages scannées et les photos. Aucun service d'IA externe n'est appelé pour la lecture. La validation et la synchronisation éventuelle des données du compte continuent de suivre les règles existantes du site ; la promesse de traitement local concerne l'analyse des fichiers, pas l'ensemble de la synchronisation.

## Méthode

- Les pages sont examinées individuellement jusqu'à 20 pages. Un PDF plus long est refusé avec une instruction de le fractionner, jamais traité partiellement sans avertissement.
- La couche texte est reconstituée selon les positions visuelles, indépendamment de l'ordre interne des fragments du PDF. Une grande image sur une page déclenche également l'OCR même si le PDF contient déjà du texte : cela couvre notamment les scans accompagnés d'un titre numérique.
- Pour l'emploi du temps, plusieurs interprétations sont comparées : colonnes de jours et horaires sous les matières, lignes textuelles explicites, ou grille avec une colonne d'horaires commune. Une interprétation unique est retenue ; les jours et heures absents ne sont pas inventés. Les doublons identiques entre pages sont retirés.
- Les dates ISO et les années explicites accompagnant un mois en lettres sont reconnues pour les devoirs et les examens. Les heures impossibles dans les emplois du temps sont rejetées.
- Le rendu des pages scannées est borné en surface pour réduire le risque d'épuiser la mémoire du navigateur ; les pages sont traitées l'une après l'autre.
- Les propositions restent modifiables et doivent être confirmées avant toute écriture dans le planning. Les anciennes données ne sont pas effacées lors de la simple lecture.

## Limites

La compréhension des horaires et des matières combine l'OCR neuronal et des règles géométriques et textuelles : ce n'est pas un modèle de langage ni une garantie de compréhension universelle. Un document flou, manuscrit, très dense, tourné, dans une autre langue, ou une grille ambiguë peut être partiellement lu ou mal interprété. Il faut vérifier toutes les propositions et compléter manuellement les informations manquantes. Le lecteur peut nécessiter une connexion initiale pour charger ses bibliothèques locales ; la vitesse dépend de l'appareil.

## Vérifications

`tools/tester-ocr-formats.mjs` fabrique des PDF fictifs et vérifie notamment la lecture au-delà de la troisième page, la couche texte mélangée à une image, la grille avec horaires à gauche, les dates et la limite de pages. `tools/tester-upload-emploi.cjs` vérifie de vrais imports PDF et images, ainsi que l'absence de modification avant confirmation. Les documents réels et leurs différentes présentations restent à valider avec des exemples anonymisés fournis par les utilisateurs.
