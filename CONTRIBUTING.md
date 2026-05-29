# Contribuer à Safari Frenzy

Merci de t'intéresser au projet ! Safari Frenzy est un mini-jeu open source — les contributions qui ajoutent du contenu (créatures, modes, achievements) ou améliorent le moteur sont les bienvenues.

## 🚀 Setup local

```bash
git clone https://github.com/Abdoulrazack1/safari-frenzy.git
cd safari-frenzy
npm install
npm run dev     # auto-reload sur :3000
npm test        # 18 tests d'intégration
```

## 🎯 Bonnes premières contributions

### 1. Ajouter une créature

Toutes les créatures sont dans `public/js/config.js` :

```js
{
  id: 'mewzy',
  name: 'MEWZY',
  sprite: [
    "  ▓▓░░  ▓▓░░  ",
    " ▓░░░░ ▓░░░░  ",
    // ... 14×14 pixels
  ],
  rarity: 'legendary',
  spawnRate: 0.01,
  points: 500
}
```

Sprites = string array 14×14, palette indexée. Voir `docs/EXTENSIONS.md` pour le format détaillé.

### 2. Ajouter un mode de jeu

Les 4 modes (Classique / Endless / Hardcore / Chasse) sont dans `config.js`. Ajouter un mode = définir :
- Conditions de fin (timer / vies / cible spécifique)
- Modificateurs (spawn rate, point multiplier, BOOMb density)
- Logique custom dans `game.js` si nécessaire

### 3. Ajouter un achievement

Dans `config.js`, ajoute une entrée au tableau `achievements` :

```js
{
  id: 'combo_master',
  title: 'Combo Master',
  description: 'Atteindre un combo ×10',
  check: (state) => state.maxCombo >= 10
}
```

Le `check` est évalué à chaque tick.

### 4. Ajouter un power-up

Ajoute dans `config.js` + implémente l'effet dans `game.js`. Les power-ups existants (Time+5, Freeze, Master AOE, Magnet, Repel) sont des bons modèles.

### 5. Améliorer l'anti-cheat

L'anti-cheat actuel est HMAC + plausibility check (≤ 400 pts/sec). Idées d'améliorations :
- Replay tokens (le client envoie les inputs, le serveur rejoue)
- Détection de patterns inhumains (clic exactement régulier)

## 🐛 Signaler un bug

Ouvre une [issue](https://github.com/Abdoulrazack1/safari-frenzy/issues) avec :

1. **Mode** joué
2. **Étapes pour reproduire**
3. **Comportement attendu vs obtenu**
4. **Navigateur + OS**

Pour les bugs de score (anti-cheat trop strict), inclus le payload exact rejeté.

## 🔀 Proposer une PR

1. **Fork** le repo
2. Branche descriptive : `git checkout -b feat/mode-coop`
3. **Lance `npm test`** avant de pousser
4. Commit clair, PR vers `main`

## 🧪 Tests

```bash
npm test
```

18 tests d'intégration couvrent : sessions HMAC, soumission de scores, profils cloud, plausibility check.

## 📚 Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — state machine + design
- [`docs/API.md`](docs/API.md) — référence HTTP
- [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) — pourquoi ces mécaniques
- [`docs/EXTENSIONS.md`](docs/EXTENSIONS.md) — comment étendre
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — local, VPS, Docker, Render/Fly.io

## 📜 Licence

MIT.
