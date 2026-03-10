# Guide d'actualisation des données — Municipales 2026

## Vue d'ensemble

Les données de sondages sont stockées dans `data/municipales-2026-sondages.json` et exposées au dashboard via `tendances.js`. L'actualisation se fait en deux étapes :
1. Mettre à jour le fichier JSON avec les nouveaux sondages
2. Regénérer le fichier `tendances.js`

---

## Prompt d'actualisation (copier-coller dans Claude)

```
Tu es un expert en OSINT politique. Mets à jour le fichier de données des sondages
municipales 2026 situé dans data/municipales-2026-sondages.json.

Référence-toi au document screening-instituts-sondage.md pour les scores de fiabilité
des instituts et les sources à consulter.

### Tâches :
1. Recherche les NOUVEAUX sondages publiés depuis la dernière mise à jour
   (champ metadata.lastUpdate dans le JSON actuel)
2. Pour chaque nouveau sondage trouvé, ajoute-le au tableau "polls" de la ville concernée
3. Mets à jour metadata.lastUpdate avec la date du jour
4. Ajoute les nouvelles sources dans metadata.sources si nécessaire

### Sources à consulter (par priorité) :
1. Commission des sondages : https://www.commission-des-sondages.fr/notices/
2. NSPPolls GitHub : https://github.com/nsppolls/nsppolls
3. Wikipedia FR — pages municipales 2026 par ville
4. Sites des instituts :
   - IFOP : https://www.ifop.com/
   - Ipsos : https://www.ipsos.com/fr-fr/topic/municipales-2026
   - Cluster17 : https://cluster17.com/nos-sondages-municipaux-publies/
   - Elabe : https://elabe.fr/
   - OpinionWay : https://www.opinion-way.com/
   - Harris Interactive : https://harris-interactive.fr/opinion_polls/
5. Médias : France Info, BFMTV, Le Figaro, Le Monde, Le Parisien, CNews

### Format d'un sondage dans le JSON :
{
  "institute": "ifop",          // clé dans institutes{}
  "commissioner": "Le Figaro",  // média commanditaire
  "publishDate": "2026-03-05",  // date de publication
  "fieldDates": {
    "start": "2026-03-01",      // début du terrain
    "end": "2026-03-03"         // fin du terrain
  },
  "sampleSize": 1005,           // taille de l'échantillon
  "round": 1,                   // 1 = 1er tour, 2 = 2nd tour
  "candidates": [
    { "name": "Nom Prénom", "party": "Parti / Étiquette", "score": 28.5 }
  ]
}

### Après mise à jour du JSON, régénère tendances.js :
Lis le fichier data/municipales-2026-sondages.json et écris tendances.js
avec le contenu : const TENDANCES_DATA = <contenu JSON>;

### Vérifications :
- Le JSON doit rester valide (parseable)
- Pas de doublons (même institut + même date + même ville)
- Les scores du 1er tour doivent être cohérents (somme proche de 100%)
- Les scores de fiabilité des instituts doivent correspondre au screening
```

---

## Structure du fichier JSON

```
data/municipales-2026-sondages.json
├── metadata
│   ├── lastUpdate          # Date ISO de dernière mise à jour
│   ├── electionDates       # Dates des 1er et 2nd tours
│   └── sources[]           # URLs des sources consultées
├── institutes{}            # Dictionnaire des instituts
│   └── [clé]
│       ├── name            # Nom complet
│       └── reliability     # Score de fiabilité /10
└── cities[]                # Tableau des 80 villes
    └── [ville]
        ├── name, population, department, region
        ├── currentMayor    # Maire actuel {name, party, since}
        ├── municipales2020 # Résultat 2020 {winner, party, score, round}
        ├── polls[]         # Sondages collectés
        ├── secondRound     # Hypothèses de 2nd tour
        └── context         # Texte contextuel (villes sans sondage)
```

---

## Scores de fiabilité des instituts (référence)

| Institut | Clé JSON | Score /10 |
|---|---|---|
| Cluster17 | `cluster17` | 8.0 |
| Elabe | `elabe` | 8.0 |
| Harris Interactive | `harris` | 7.5 |
| IFOP-Fiducial | `ifop` | 7.5 |
| Ipsos BVA | `ipsos` | 7.5 |
| BVA (legacy) | `bva` | 6.5 |
| OpinionWay | `opinionway` | 6.0 |
| Odoxa | `odoxa` | 6.0 |
| Kantar/Verian | `verian` | 6.0 |
| CSA | `csa` | 5.5 |

Source : [screening-instituts-sondage.md](screening-instituts-sondage.md)

---

## Méthodologie d'agrégation (implémentée dans app.js)

Le dashboard calcule automatiquement les moyennes pondérées à partir des sondages bruts :

```
poids = exp(-0.1 × jours) × √(n/1000) × (fiabilité/10) × (1/N_dédup)
```

- **Récence** : décroissance exponentielle, demi-vie ~7 jours
- **Échantillon** : racine carrée normalisée à 1000
- **Fiabilité** : score de l'institut sur 10
- **Déduplication** : 1/N si N sondages du même institut en 14 jours

Les intervalles de confiance à 95% sont affichés en whiskers sur les barres.

---

## Régénération de tendances.js

Après toute modification du JSON, exécuter :

```bash
python3 -c "
import json
with open('data/municipales-2026-sondages.json', 'r') as f:
    data = json.load(f)
with open('tendances.js', 'w') as f:
    f.write('const TENDANCES_DATA = ')
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write(';')
print('tendances.js regenerated')
"
```

Ou simplement demander à Claude de le faire dans le prompt d'actualisation.
