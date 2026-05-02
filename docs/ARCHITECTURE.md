# Architecture

Safari Frenzy est volontairement minimaliste : pas de framework, pas de bundler, pas de transpileur. Le code parle directement au navigateur, et le serveur Node n'a qu'une dépendance obligatoire (Express).

## Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────┐
│                          NAVIGATEUR                          │
│                                                              │
│  index.html ──► config.js ──► store.js ──► audio.js          │
│                     │             │            │             │
│                     ▼             ▼            ▼             │
│  sprites.js ──► api.js ──► game.js ──► <canvas>              │
│                     │                                        │
│                     │ fetch                                  │
└─────────────────────┼────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│                    SERVEUR NODE.JS                           │
│                                                              │
│  server.js                                                   │
│   ├── express (statique /public)                             │
│   ├── /api/health                                            │
│   ├── /api/session       (HMAC token issue)                  │
│   ├── /api/scores        (CRUD scores, anti-cheat)           │
│   └── /api/profile/:name (cloud sync pokédex)                │
│                                                              │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────┐    ┌──────────────────┐                │
│  │ better-sqlite3   │ OR │   JSON files     │                │
│  │ data/safari.db   │    │ data/scores.json │                │
│  │                  │    │ data/profiles…   │                │
│  └──────────────────┘    └──────────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

## Frontend

### Modules (chargés dans cet ordre par `index.html`)

| Module       | Rôle                                                                |
| ------------ | ------------------------------------------------------------------- |
| `config.js`  | Définitions immuables : modes, niveaux, achievements, constantes    |
| `store.js`   | Persistance localStorage + sync cloud optionnelle                   |
| `audio.js`   | Moteur audio Web Audio API procédural (SFX + musique)               |
| `sprites.js` | Pixel art creatures + items + renderer canvas                       |
| `api.js`     | Client fetch avec gestion sessions + erreurs                        |
| `game.js`    | State machine, game loop, input, render                             |

Aucun import ES module — tout est en IIFE qui expose une variable globale (`window.SafariConfig`, etc.). Pourquoi ? Parce que pas de bundler, pas d'étape de build. Le code peut être ouvert directement dans un navigateur via `file://` (avec quelques limites sur l'API évidemment).

### State machine du jeu

```
              ┌──────────┐
              │   MENU   │
              └────┬─────┘
                   │ "Jouer" / mode select
                   ▼
            ┌──────────────┐
            │ MODE_SELECT  │◄────────────────┐
            └──────┬───────┘                 │
                   │                         │
                   ▼                         │
            ┌──────────────┐                 │
            │ LEVEL_INTRO  │                 │
            └──────┬───────┘                 │
                   │ Go!                     │
                   ▼                         │
            ┌──────────────┐                 │
   ┌───────►│   PLAYING    │                 │
   │        └──────┬───────┘                 │
   │               │                         │
   │     ┌─────────┼─────────┐               │
   │     │         │         │               │
   │     ▼         ▼         ▼               │
   │ goal hit   timeout   strict err         │
   │     │         │         │               │
   │     ▼         └────►┌───┴────┐          │
   │ ┌──────────┐        │GAME_OVER│─────────┘
   │ │LEVEL_DONE│        └─────────┘ "rejouer"
   │ └────┬─────┘
   │      │
   │      ├──► every 3 levels ──► BONUS_ROUND ──┐
   │      │                                     │
   │      ▼                                     │
   └─ next level (LEVEL_INTRO again)            │
                                                │
                  ◄─────────────────────────────┘
```

### Game loop

- 60 fps via `requestAnimationFrame`
- `update(dt, now)` : timer, expirations, spawn timing, effects physics
- `render(now)` : background, sprites (sortés par Y pour faux 3D), effects, indicators
- Tout est immédiat — pas de scene graph, pas de WebGL, juste du Canvas 2D

### Rendu pixel art

Chaque sprite est un `string[]` où chaque caractère mappe une couleur de la palette :

```js
const WORMY = [
  '..............',
  '.kk........kk.',
  'kggk......kggk',
  // ...
];
```

`drawSprite(ctx, sprite, x, y, pixelSize)` itère sur chaque cellule et dessine un `fillRect`. Avec `image-rendering: pixelated`, le canvas reste net même upscalé. Pas besoin d'asset pipeline — un sprite c'est 14 lignes de texte.

## Backend

### Storage : SQLite avec fallback JSON

`server.js` essaie d'abord `require('better-sqlite3')`. Si le module n'est pas installé (compilation native peut échouer sur certaines plateformes), il bascule sur des fichiers JSON. L'API publique (`storage.insertScore()`, etc.) est identique dans les deux cas — le code métier ne sait pas lequel est actif.

**Tables SQLite :**

```sql
CREATE TABLE scores (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  score      INTEGER NOT NULL,
  combo      INTEGER NOT NULL DEFAULT 0,
  level      INTEGER NOT NULL DEFAULT 1,
  mode       TEXT NOT NULL DEFAULT 'classic',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_scores_mode_score ON scores(mode, score DESC);

CREATE TABLE profiles (
  name       TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

L'index sur `(mode, score DESC)` rend les requêtes top-N quasi-instantanées même avec des milliers d'entrées.

### Anti-cheat : tokens HMAC

Le serveur génère un secret aléatoire 32 bytes au premier lancement (`data/.secret`, mode 600). Au début de chaque partie, le client demande `/api/session` qui retourne un token signé contenant `{sid, mode, issuedAt}`.

Quand le client soumet un score, il joint le token. Le serveur :

1. Vérifie la signature HMAC (constant-time)
2. Vérifie que le token a < 30 minutes
3. Vérifie que le mode du token = mode du score
4. Vérifie la plausibilité (score ≤ 400 pts/sec × age de session)

Un token forgé → 401. Un score absurde → 400 (`implausible_score`). Les soumissions sans token sont acceptées (back-compat, devs en local) mais marquées `verified: false`.

**Limites :**
- Pas de protection contre un client modifié qui suit la logique (wait 60s puis envoie 24000 pts)
- Pour un déploiement public à enjeux, il faudrait que le serveur valide les actions de jeu (chaque capture postée), façon MMO authoritative
- C'est suffisant pour empêcher 99% des soumissions triviales (dev console fetch hack)

## Pourquoi ces choix ?

**Pas de framework JS** — Le projet tient en ~2000 lignes de JS. React/Vue ajouteraient ~150 ko gzippé pour zéro bénéfice. Le DOM est manipulé seulement pour les overlays (menus), tout le reste est dans le canvas.

**Pas de TypeScript** — Le projet est volontairement accessible, lisible directement. Les JSDoc sur les fonctions principales documentent les types là où c'est utile.

**Web Audio plutôt que des fichiers** — Zéro asset à charger, latence nulle, et c'est cohérent avec l'esthétique chiptune. Tu peux régler le BPM en live, ajouter des notes au pattern, etc.

**SQLite plutôt que Postgres** — Zéro setup serveur, fichier unique, parfait pour un projet portfolio. Migration vers Postgres triviale si besoin (changer 5 fonctions dans `storage`).
