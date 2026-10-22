# Audit complet — Study Plan IB

Ce dossier contient le rapport d’audit au format PDF et le code qui le produit.

- `Study-Plan-IB-audit-complet.pdf` — **le livrable** : 121 constats, 62 pages, chaque problème
  expliqué (où, ce qui se passe, pourquoi c’est un problème) et suivi d’une solution durable.
- `gen/` — le générateur. Les textes sont dans `d_et.py` (emploi du temps), `d_po.py` (Pomodoro),
  `d_de.py` (devoirs et examens), `d_autres.py` (autres pages), `d_reste.py` (sécurité, synchro,
  accessibilité, performance, architecture, contenu) ; `donnees.py` assemble, `construire.py` met
  en page, `main.py` écrit le PDF.

Régénérer :

```bash
pip install --break-system-packages reportlab
python3 audit/gen/main.py
```

Le PDF est écrit dans ce dossier. L’analyse est en lecture seule : aucun fichier du site n’a été
modifié pour produire ce rapport.

Répartition : 18 bloquants, 31 majeurs, 51 moyens, 21 mineurs — dont 64 sur les trois zones
demandées (emploi du temps, Pomodoro, devoirs et examens).
