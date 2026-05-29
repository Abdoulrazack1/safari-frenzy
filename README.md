# 🎮 Safari Frenzy

> **Mini browser game pixel-art type Game Boy** — capture les créatures à coups de Pokéball, évite les BOOMb, monte ton combo, débloque le pokédex.
> 4 modes (Classique / Endless / Hardcore / Chasse), 8 niveaux + procédural infini, leaderboard anti-cheat, audio chiptune procédural (Web Audio API).

[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Canvas](https://img.shields.io/badge/HTML5-Canvas-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
[![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎮 Démo

> ⚠️ **Le lien GitHub Pages actuel (`abdoulrazack1.github.io/safari-frenzy/`) sert ce README, pas le jeu** — `public/index.html` n'est pas à la racine du repo, et les paths du jeu sont absolus (`/css/...`).
>
> **Pour jouer maintenant** : clone + `npm install && npm start` → `http://localhost:3000` (instructions ci-dessous).
>
> **Pour rendre la démo en ligne fonctionnelle**, deux options :
> 1. Déployer le tout sur **Render / Fly.io / VPS** (backend Express + SQLite + frontend) — voir [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
> 2. Réorganiser pour servir `public/` via GH Pages : changer les paths absolus en relatifs + ajouter un workflow `.github/workflows/pages.yml` qui upload `public/` comme artifact

<!-- 📽️ GIF de gameplay à ajouter ici : 15s
     1) capture d'une créature normale (+50)
     2) capture en combo ×3
     3) BOOMb évité de justesse
     4) bonus round avec légendaire -->

**Stack** : HTML/CSS/JS vanilla + Node.js/Express + SQLite (avec fallback JSON). Zéro framework, zéro bundler, zéro dépendance dans le frontend.

```
                                   ┌────────────┐
                                   │  +50  ×3   │
                                   └────────────┘
        .  ✨   .                      ↑
    ┌─────────────────┐              ✦
    │  ▓▓░░  ▓▓░░     │            ╭──╮
    │ ▓░░░░ ▓░░░░     │            │MEW│
    │  ▓▓▓▓  ▓▓▓▓     │            │ZY │
    │                 │            ╰──╯
    │   ●           ◇ │
    │  PIDGY      MASTER
    │              BALL
    └─────────────────┘
       L4 ⏱ 32  COMBO ×3
```

---

## Démarrage rapide

```bash
npm install
npm start
```

Va sur `http://localhost:3000`.

Pour développer avec auto-reload :
```bash
npm run dev
```

Pour les tests d'intégration :
```bash
npm test
```

## Modes de jeu

| Mode      | Description                                                    |
| --------- | -------------------------------------------------------------- |
| **Classique** | 8 niveaux + procédural infini, objectifs, bonus rounds         |
| **Endless**   | 3 vies, pas de timer, pure score chase                         |
| **Hardcore**  | One-shot — un seul miss ou BOOMb = game over                   |
| **Chasse**    | 90s pour traquer une cible spécifique. Mauvaise capture = -20  |

## Power-ups (drops 5%)

- ⏱ **Time +5** — bouée de sauvetage
- ❄ **Freeze** — gèle toutes les créatures 3s
- ⚪ **Master AOE** — prochain clic capture toute l'aire
- 🧲 **Magnet** — auto-aim 4s (BOOMb exclus, bien sûr)
- 💨 **Repel** — efface tous les BOOMb à l'écran

## Features

- 🎮 **4 modes** + 8 niveaux + génération procédurale infinie
- ✨ **Bonus rounds** tous les 3 niveaux (légendaires uniquement, ×2 points)
- 🎵 **Audio chiptune procédural** (Web Audio API, zéro fichier audio)
- 📖 **Pokédex persistant** (localStorage)
- 🏆 **13 achievements** avec toasts
- 📊 **Leaderboards par mode** (SQLite côté serveur)
- ☁️ **Sync cloud optionnelle** des profils
- 🔒 **Anti-cheat** : tokens HMAC + plausibility check
- ♿ **Mode mouvement réduit** pour accessibilité

## API

| Endpoint                    | Méthode | Rôle                                  |
| --------------------------- | ------- | ------------------------------------- |
| `/api/health`               | GET     | Health check                          |
| `/api/session`              | POST    | Ouvrir une session (token signé)      |
| `/api/scores?mode=...`      | GET     | Top scores par mode                   |
| `/api/scores`               | POST    | Soumettre un score                    |
| `/api/profile/:name`        | GET/PUT | Profil cloud (pokédex, achievements)  |

Détails complets dans [`docs/API.md`](docs/API.md).

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — vue d'ensemble technique, state machine, choix de design
- [`docs/API.md`](docs/API.md) — référence complète de l'API HTTP
- [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) — pourquoi ces mécaniques, pourquoi ces nombres
- [`docs/EXTENSIONS.md`](docs/EXTENSIONS.md) — comment ajouter créatures, items, modes, sons
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — déploiement local, VPS, Docker, Render/Fly.io

## Structure du projet

```
safari-frenzy/
├── README.md
├── package.json
├── server.js
├── data/                       # créé au runtime, gitignored
├── docs/                       # 5 fichiers .md
├── tests/run.js                # 18 tests d'intégration
└── public/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── config.js           # modes, niveaux, achievements
        ├── store.js            # localStorage + sync cloud
        ├── audio.js            # Web Audio chiptune
        ├── sprites.js          # pixel art + renderer canvas
        ├── api.js              # client fetch
        └── game.js             # state machine + game loop
```

## Comment ça marche

Chaque créature est un sprite 14×14 (string array, palette indexée) dessiné via Canvas 2D. Le frontend est en pur JS sans bundler — chaque module IIFE expose un objet global (`window.SafariConfig`, `window.SafariAudio`...).

Le backend stocke les scores en SQLite (avec fallback JSON si le module natif ne compile pas). Anti-cheat via HMAC-SHA256 : à chaque début de partie le client demande un token signé, qu'il joint au score final. Le serveur vérifie signature, mode, et plausibilité (≤ 400 pts/sec).

L'audio est 100% procédural via Web Audio API — pas de fichiers, pas de bandwidth. SFX, jingles de level complete, et même la musique de fond (boucle pentatonique 16/32 pas) sont générés à la volée.

Voir [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) pour les détails.

## Licence

MIT — fais-en ce que tu veux.
