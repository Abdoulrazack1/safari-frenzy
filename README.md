# 🌿 Safari Frenzy

Mini browser game pixel art **Pokémon-style** avec API de scores en Node.js.

> **Stack** : HTML · CSS (vanilla) · JavaScript (vanilla, Canvas API) · Node.js + Express

---

## 🎮 Le concept

Whack-a-mole revisité dans l'esthétique Game Boy. 60 secondes pour capturer un maximum de créatures dans les hautes herbes, tout en évitant les **BOOMb** explosifs.

| Type        | Points | Détail                             |
| ----------- | ------ | ---------------------------------- |
| Communes    | +10    | Wormy, Pidgy, Rattz                |
| Rares       | +25    | Sparky, Furrball                   |
| Légendaires | +50    | Mewzy (apparition flash)           |
| **BOOMb**   | **−20** | **piège — combo perdu + screen-shake** |

**Multiplicateur de combo** : enchaîne 3 captures pour ×2, 6 pour ×3, jusqu'à **×5**. Une seule erreur (BOOMb, miss, créature qui s'enfuit) → combo réinitialisé.

C'est cette mécanique combo + Voltorb qui crée la tension : le joueur veut prendre des risques pour le multiplicateur, mais chaque clic peut tout faire s'écrouler.

---

## 🚀 Lancer le projet

```bash
# Depuis la racine du projet
npm install
npm start
```

Puis ouvre **http://localhost:3000**.

Le serveur Node.js sert à la fois le frontend statique (depuis `/public`) et l'API REST des scores.

### Mode dev (rechargement auto, Node 18+)

```bash
npm run dev
```

---

## 🗂 Structure

```
safari-frenzy/
├── server.js              ← API Express + serveur statique
├── package.json
├── data/
│   └── scores.json        ← stockage JSON (auto-créé à la 1ʳᵉ partie)
└── public/
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        ├── sprites.js     ← pixel art + palette + renderer
        ├── api.js         ← client fetch
        └── game.js        ← state machine + game loop + canvas
```

---

## 🛰 API

Tout part de `server.js`. Stockage : un simple fichier JSON capé à 100 entrées (auto-tronqué au top scores).

### `GET /api/scores?limit=10`

```json
{
  "scores": [
    { "id": "ab12cd", "name": "RED", "score": 1850, "combo": 12, "createdAt": "2026-05-01T18:30:00.000Z" }
  ],
  "total": 27
}
```

### `POST /api/scores`

```json
{ "name": "RED", "score": 1850, "combo": 12 }
```

Réponse :

```json
{
  "entry": { "id": "...", "name": "RED", "score": 1850, "combo": 12, "createdAt": "..." },
  "rank": 3,
  "isTop10": true
}
```

Validation côté serveur : nom (12 chars max, sanitize control chars), score (entier 0–1 000 000), payload limité à 8 ko. Pas de DB requise, zéro coût.

### `GET /api/health`

Health check simple.

---

## 🎨 Pixel art

Tous les sprites sont définis comme des arrays de strings dans `public/js/sprites.js`. Chaque caractère mappe une couleur de la palette (ex. `g` = vert clair, `k` = noir, `.` = transparent). Le rendu se fait au canvas via `fillRect` pour chaque pixel — `image-rendering: pixelated` garantit le rendu chunky même en hi-DPI.

Pour ajouter une créature :

1. Dessine le sprite 14×14 dans `sprites.js`
2. Ajoute-le au tableau `CREATURES` avec `points`, `weight` (probabilité de spawn), et `lifeMs` (durée à l'écran)

Palette inspirée Pokémon Red/Blue (jaunes, rouges, verts, lilas) — les créatures sont **originales** pour rester safe niveau IP, mais l'esthétique est volontairement nostalgique.

---

## 🔥 Pistes d'extension

Quelques idées si tu veux enrichir :

- **Modes de jeu** : Endless (vies au lieu d'un timer), Hardcore (un seul BOOMb = game over), Hunt (capturer une créature spécifique)
- **Power-ups** : Maître Ball (capture garantie), Repousse (clear all BOOMb), Multiplicateur ×10 temporaire
- **Persistance avancée** : remplacer le JSON par SQLite (`better-sqlite3`) — tu connais déjà MySQL, ça serait 10 minutes
- **Auth** : JWT pour empêcher les soumissions de scores forgés (tu as l'expérience après Cycling)
- **PvP async** : défier un score d'un autre joueur, partage de challenge par lien
- **Audio** : bruitages 8-bit (Web Audio API) — chaque créature un son distinct, music chiptune en boucle

---

## 📝 Notes techniques

- **Validation côté serveur** : le score posté n'est **pas** vérifié contre la logique du jeu — un client malicieux peut forger un score. Pour un vrai déploiement public, ajouter un token de session côté serveur (issued au début de partie, signé avec timestamp et stats minimales).
- **Concurrence** : `writeFile` n'est pas atomique. Acceptable pour un projet local/portfolio, à remplacer par SQLite ou `proper-lockfile` en prod.
- **Mobile** : layout responsive < 760px, touch events via pointerdown.
