# Audit complet — Study Plan IB

Ce dossier contient les deux rapports PDF et le code qui les produit.

- `Study-Plan-IB-audit-complet.pdf` — **l’audit** : 121 constats, chaque problème expliqué
  (où, ce qui se passe, pourquoi c’est un problème) et suivi d’une solution durable.
- `Study-Plan-IB-guide-prompts.pdf` — **le compagnon** : les prompts à coller dans une session
  d’assistant de code pour appliquer l’audit, lot par lot. Un prompt maître, un gabarit, dix règles,
  dix-neuf lots (les 121 constats couverts, chacun dans un seul lot), cinq contrôles et un tableau de
  suivi.
- `gen/` — le générateur. Les textes sont dans les fichiers de données, la mise en page est commune.

| Fichier | Contenu |
|---|---|
| `gen/d_et.py` | emploi du temps (18 constats) |
| `gen/d_po.py` | Pomodoro et page Séance (20) |
| `gen/d_de.py` | devoirs et examens (26) |
| `gen/d_autres.py` | autres pages (16) |
| `gen/d_reste.py` | sécurité, synchro, accessibilité, performance, architecture, contenu (41) |
| `gen/donnees.py` | assemble l’audit |
| `gen/p_lots.py` | les 19 lots de prompts |
| `gen/p_base.py` | prompt maître, gabarit, règles, contrôles, anti-exemples |
| `gen/construire.py` | styles, couverture, cartes de constat, encarts |
| `gen/main.py` | écrit le PDF d’audit |
| `gen/main_prompts.py` | écrit le PDF des prompts |

Régénérer les deux PDF :

```bash
pip install --break-system-packages reportlab
python3 audit/gen/main.py
python3 audit/gen/main_prompts.py
```

`main_prompts.py` vérifie à la construction que chaque constat de l’audit est présent dans exactement
un lot : un constat oublié ou placé deux fois fait échouer la génération.

L’analyse est en lecture seule : aucun fichier du site n’a été modifié pour produire ces rapports.

Répartition de l’audit : 18 bloquants, 31 majeurs, 51 moyens, 21 mineurs — dont 64 sur les trois zones
demandées (emploi du temps, Pomodoro, devoirs et examens).
