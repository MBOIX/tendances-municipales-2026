# Political Trends Dashboard — Municipales 2026

## Projet

Dashboard d'observation des tendances politiques pour les élections municipales françaises 2026 (1er tour 15 mars, 2nd tour 22 mars). Couvre les 80 plus grandes villes de France métropolitaine (INSEE).

## Stack

HTML/CSS/JS vanilla — aucun framework, aucun build step. S'ouvre directement via `file://` dans un navigateur.

## Structure des fichiers

```
.
├── index.html                          # Dashboard par ville
├── national.html                       # Dashboard synthèse nationale
├── styles.css                          # Dark mode, data-journalism (FiveThirtyEight/NYT)
├── lib.js                              # Bibliothèque partagée (PollLib) — constantes, détection parti, agrégation, formatage
├── app.js                              # Rendu par ville + filtres (IIFE, utilise PollLib)
├── national.js                         # Rendu national — carte SVG, projections, balance, scores parti (IIFE, utilise PollLib)
├── tendances.js                        # Données exposées en `const TENDANCES_DATA = {...};`
├── candidats-data.js                   # Référentiel candidats exposé en `const CANDIDATS_DATA = {...};`
├── data/
│   ├── municipales-2026-sondages.json  # Source de vérité des données brutes
│   └── candidats.json                  # Référentiel officiel des candidats (parti, rôle, coalition)
├── screening-instituts-sondage.md      # Screening fiabilité des instituts de sondage
├── GUIDE-ACTUALISATION-DONNEES.md      # Guide + prompt pour actualiser les données
└── CLAUDE.md                           # Ce fichier
```

## Architecture JS

### lib.js — Bibliothèque partagée (`window.PollLib`)

IIFE exposant toutes les fonctions réutilisables via `window.PollLib` :

1. **Constants** — `ELECTION_DATE`, `DECAY_LAMBDA`, `SAMPLE_REF`, `DEDUP_WINDOW_DAYS`
2. **PARTY_COLORS** — dictionnaire `{clé: {color, badge}}` pour chaque parti
3. **LEFT_PARTIES / RIGHT_PARTIES** — classification gauche/droite
4. **PARTY_SHORT_LABELS** — abréviations 2 caractères max pour les badges candidats
5. **Candidate Reference Lookup** — `_candidateLookup` (index par id depuis `CANDIDATS_DATA`), `resolvePartyKey()` (résout le parti officiel via `candidateId`, fallback `detectPartyKey`)
6. **Party Detection** — `detectPartyKey()`, `getPartyColor()`, `getPartyBadgeClass()`, `getPartyShortLabel()`, `isLeftParty()`, `isRightParty()`
7. **Poll Aggregation** — `daysBetween()`, `computeRecencyWeight()`, `computeSampleWeight()`, `computeReliabilityWeight()`, `computeDedupWeight()`, `aggregatePolls()`
8. **Formatting** — `formatPopulation()`, `formatDate()`, `escapeHtml()`

### app.js — Dashboard par ville

IIFE qui destructure `window.PollLib`, garde `TOP_N` en local :

1. **Countdown** — `updateCountdown()`
2. **Header Stats** — `renderHeaderStats()`
3. **Rendering** — `renderCandidateBars()`, `renderSecondRound()`, `renderCityCard()`, `renderModal()`
4. **Filter & Sort** — par population, nom, nb sondages, compétitivité ; filtres par bord politique
5. **init()** — boot, event listeners, pre-compute des agrégats

### national.js — Synthèse nationale

IIFE qui destructure `window.PollLib` :

1. **CITY_COORDS** — coordonnées SVG hardcodées pour les 80 villes (carte principale + inset IDF élargi)
2. **computeNationalData()** — agrège les données par ville (leader, parti projeté)
3. **renderMap()** — carte de France SVG avec points colorés par ville
4. **renderProjectionGrid()** — grille de cards projetant le parti en tête par ville
5. **renderBalance()** — barres gauche/droite comparant maires sortants vs projections
6. **renderPartyScores()** — scores moyens nationaux par parti
7. **init()** — boot, countdown, rendu des 4 sections

## Données (tendances.js / data/municipales-2026-sondages.json)

Le JSON source est dans `data/`. Le fichier `tendances.js` est un wrapper JS :
```js
const TENDANCES_DATA = { ...contenu du JSON... };
```

**Régénérer tendances.js et candidats-data.js après toute modification des JSON** :
```bash
python3 -c "
import json
with open('data/municipales-2026-sondages.json', 'r') as f:
    data = json.load(f)
with open('tendances.js', 'w') as f:
    f.write('const TENDANCES_DATA = ')
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write(';')
with open('data/candidats.json', 'r') as f:
    cdata = json.load(f)
with open('candidats-data.js', 'w') as f:
    f.write('const CANDIDATS_DATA = ')
    json.dump(cdata, f, ensure_ascii=False, indent=2)
    f.write(';')
"
```

### Schéma JSON

```
metadata.lastUpdate           # ISO date
metadata.electionDates        # {firstRound, secondRound}
metadata.sources[]            # URLs consultées
institutes.{clé}              # {name, reliability} — score /10
cities[].name                 # Nom de la ville
cities[].population           # Nombre d'habitants (INSEE 2023)
cities[].department           # "Nom (XX)"
cities[].region               # Région
cities[].currentMayor         # {name, party, since}
cities[].municipales2020      # {winner, party, score, round}
cities[].polls[]              # Sondages bruts
cities[].polls[].institute    # Clé dans institutes{}
cities[].polls[].commissioner # Média commanditaire
cities[].polls[].publishDate  # ISO date
cities[].polls[].fieldDates   # {start, end}
cities[].polls[].sampleSize   # Taille échantillon
cities[].polls[].round        # 1 ou 2
cities[].polls[].candidates[] # {name, party, score, candidateId}
cities[].secondRound.scenarios[] # Hypothèses de 2nd tour
cities[].context              # Texte libre (villes sans sondage)
```

### Référentiel candidats (data/candidats.json)

Fichier de référence contenant le **parti officiel** de chaque candidat. Le champ `party` des sondages contient la coalition telle que l'institut l'a publiée (ex: `"PS / Écologistes / PCF"`), tandis que le référentiel contient la clé normalisée (ex: `"PS"`).

```
candidates[].id              # Slug unique (ex: "paris-emmanuel-gregoire")
candidates[].firstName       # Prénom
candidates[].lastName        # Nom de famille
candidates[].party           # Clé parti normalisée (ex: "PS", "LR", "EELV")
candidates[].city            # Ville
candidates[].currentRole     # Rôle actuel (Maire sortant, Député, null)
candidates[].coalition       # Nom de la liste/coalition (null si inconnu)
```

**Mapping** : chaque entrée `polls[].candidates[]` et `secondRound.scenarios[].candidates[]` contient un champ `candidateId` pointant vers l'`id` du référentiel. `resolvePartyKey(candidate)` utilise ce lien pour afficher le bon parti/couleur/badge.

## Partis politiques

### Dictionnaire des couleurs, badges et abréviations (spectre politique)

| Clé interne    | Couleur barre | Classe badge       | Abrév. 2 car. | Position          |
|----------------|---------------|--------------------| ---------------|-------------------|
| LO             | `#a01010`     | `badge-lo`         | LO             | Extrême gauche    |
| NPA            | `#c41e1e`     | `badge-npa`        | NP             | Extrême gauche    |
| LFI            | `#b42828`     | `badge-lfi`        | FI             | Extrême gauche    |
| PCF            | `#d63030`     | `badge-pcf`        | PC             | Extrême gauche    |
| PS             | `#e85868`     | `badge-ps`         | PS             | Gauche            |
| DVG            | `#f49aaa`     | `badge-dvg`        | DG             | Gauche            |
| EELV           | `#2ecc71`     | `badge-eelv`       | EV             | Écologiste (vert) |
| Renaissance    | `#f0c830`     | `badge-renaissance`| RE             | Centre            |
| Horizons       | `#d4b030`     | `badge-horizons`   | HZ             | Centre            |
| UDI            | `#7ab0d8`     | `badge-udi`        | UD             | Droite            |
| DVD            | `#508cc0`     | `badge-dvd`        | DD             | Droite            |
| LR             | `#2e6fb0`     | `badge-lr`         | LR             | Droite            |
| RN             | `#4a5878`     | `badge-rn`         | RN             | Extrême droite    |
| Reconquête     | `#303048`     | `badge-reconquete` | RQ             | Extrême droite    |
| *(fallback)*   | `#9ca3af`     | `badge-other`      | SE             | —                 |

### Classification gauche/droite

- **Gauche** : PS, LFI, PCF, EELV, DVG, Génération.s, NPA, LO
- **Droite** : LR, RN, Reconquête, DVD, UDI, Horizons, Renaissance, DLF

### Détection de parti (`detectPartyKey`)

La fonction parse les chaînes libres du JSON (ex: `"PS (Union de la gauche)"`) en clé normalisée. Elle cherche des sous-chaînes dans cet ordre de priorité : LO → NPA → Reconquête → Renaissance/LREM/MoDem → Horizons → LFI → EELV → PCF → RN/UDR → PS → LR → UDI → DVG → DVD.

## Méthodologie d'agrégation

Moyenne pondérée FiveThirtyEight-inspired :

```
w = exp(-0.1 × jours) × √(n/1000) × (fiabilité/10) × (1/N_dédup)
```

- **Récence** : décroissance exponentielle, λ=0.1, demi-vie ~7 jours
- **Échantillon** : √(n/1000), normalisé à 1 pour n=1000
- **Fiabilité** : score institut /10 (cf. screening-instituts-sondage.md)
- **Déduplication** : 1/N si N sondages du même institut en 14 jours
- **IC 95%** : `1.96 × √(p(1-p)/n_eff)` affiché en whiskers

## Scores de fiabilité des instituts

| Institut            | Clé JSON     | Score /10 |
|---------------------|--------------|-----------|
| Cluster17           | `cluster17`  | 8.0       |
| Elabe               | `elabe`      | 8.0       |
| Harris Interactive  | `harris`     | 7.5       |
| IFOP-Fiducial       | `ifop`       | 7.5       |
| Ipsos BVA           | `ipsos`      | 7.5       |
| OpinionWay          | `opinionway` | 6.0       |
| Odoxa               | `odoxa`      | 6.0       |
| Verian              | `verian`     | 6.0       |

## Conventions CSS

- **Dark mode** exclusif, palette dans `:root` de styles.css
- Badges parti : `<span class="card-mayor-badge badge-{parti}">{LABEL}</span>`
- Badges candidats dans les barres : même classe mais avec override `.candidate-row .card-mayor-badge` (compact, 2 car. max)
- Barres horizontales : `.candidate-bar` dans `.candidate-bar-wrapper`, couleur via `style="background:..."` en inline
- Segments 2nd tour : `.duel-segment` dans `.duel-bar`

## Conventions de code

- JS vanilla en IIFE, pas de modules ESM (compatibilité file://)
- Pas de dépendances externes (sauf Google Fonts Inter + JetBrains Mono)
- Toutes les données passent par `TENDANCES_DATA` (variable globale définie dans tendances.js)
- `escapeHtml()` obligatoire pour toute donnée du JSON injectée dans le DOM
- Les scores `null` dans secondRound sont tolérés (filtrés côté rendu)
- Les scores `null` dans polls[].candidates sont interdits (nettoyés en amont)

## Actualisation des données

Voir `GUIDE-ACTUALISATION-DONNEES.md` pour le prompt complet. En résumé :
1. Rechercher les nouveaux sondages via les sources listées dans le screening
2. Ajouter au JSON en respectant le schéma
3. Mettre à jour `metadata.lastUpdate`
4. Régénérer `tendances.js` (commande python ci-dessus)
5. Vérifier : JSON valide, pas de scores null en 1er tour, clés institut connues
