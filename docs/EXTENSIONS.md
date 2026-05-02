# Extensions & Modding

Comment ajouter des choses sans tout casser.

## Ajouter une créature

**1.** Dessine ton sprite dans `public/js/sprites.js` :

```js
const NEWMON = [
  '..............',
  '.kk........kk.',
  // ... 14 lignes de 14 chars
  '..............',
];
```

Caractères de la palette (voir `PALETTE` en haut du fichier) :
- `k` outline noir, `d` shadow gray, `w` highlight blanc
- `r/R` rouge, `y/Y` jaune, `o` orange, `g/G/l` verts
- `p/P` rose, `u/U` lilas, `c/C` cyan, `b/B` brun
- `s` cream, `.` transparent

**2.** Ajoute-le au tableau `CREATURES` :

```js
{
  id: 'newmon',
  sprite: NEWMON,
  name: 'NewMon',
  points: 30,
  rarity: 'uncommon',     // 'common' | 'uncommon' | 'rare' | 'danger'
  weight: 10,             // poids de spawn
  lifeMs: 800,            // ms à l'écran avant escape
}
```

**3.** Test : recharge la page. Le pokédex s'auto-met à jour pour inclure la nouvelle créature.

### Tips de design

- **Lifetime** ↔ **Points** : plus la créature vaut cher, plus sa fenêtre doit être courte
- **Weight** : pour rester équilibré, un total ~150 entre toutes les créatures + items
- **Couleur dominante** : doit ressortir sur fond vert. Évite les verts proches du grass

## Ajouter un item / power-up

**1.** Sprite dans `sprites.js` :

```js
const NEWITEM = [/* 14×14 */];
```

**2.** Ajoute à `ITEMS` :

```js
{
  id: 'newitem',
  sprite: NEWITEM,
  name: 'NewItem',
  effect: 'my_effect',
  weight: 4,
  lifeMs: 2000,
  rarity: 'item'
}
```

**3.** Configure dans `config.js` → `POWERUPS` :

```js
my_effect: {
  duration: 5000,           // ms (0 = instant)
  timeAdd: 0,               // ms à ajouter au timer
  toast: { icon: '✨', title: 'NEW EFFECT', msg: 'Quelque chose se passe !' }
}
```

**4.** Implémente dans `game.js` → `handlePowerUp()` :

```js
case 'my_effect':
  // ta logique ici
  // ex: state.someBuffUntil = performance.now() + cfg.duration;
  break;
```

**5.** Si l'effet est temporaire et visible, ajoute un indicateur visuel dans `render()` :

```js
if (now < state.someBuffUntil) {
  ctx.strokeStyle = `rgba(255, 0, 0, 0.5)`;
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, CANVAS_SIZE - 6, CANVAS_SIZE - 6);
}
```

## Ajouter un niveau

Dans `config.js` → `LEVELS` :

```js
{
  num: 9,
  goal: 5500,               // points à atteindre
  durationMs: 60000,        // 60s
  tint: 'aurora',           // voir tints dispo plus bas
  difficulty: 1.3,          // 0 = chill, 1+ = très dur
  biome: 'TON BIOME'
}
```

Au-delà du dernier niveau défini, `getLevel(n)` génère proceduralement.

### Tints disponibles

Définis dans `style.css` :

```css
.canvas-tint[data-tint="goldenhour"] { background: #ffb24a; opacity: 0.18; }
.canvas-tint[data-tint="dusk"]       { background: #5d4a8e; opacity: 0.32; }
.canvas-tint[data-tint="night"]      { background: #1c2a5a; opacity: 0.5; }
.canvas-tint[data-tint="aurora"]     { background: linear-gradient(...); opacity: 0.45; }
.canvas-tint[data-tint="none"]       { /* aucun */ }
```

Pour ajouter `frostbite` (par exemple) :

```css
.canvas-tint[data-tint="frostbite"] {
  background: #5dade2;
  opacity: 0.3;
  mix-blend-mode: screen;  /* éclaircit au lieu d'assombrir */
}
```

Puis dans `LEVELS` : `tint: 'frostbite'`.

## Ajouter un mode de jeu

Dans `config.js` → `MODES` :

```js
chaos: {
  id: 'chaos',
  name: 'CHAOS',
  description: 'Spawn rate 5x, lifetime 50%',
  icon: '🌀',
  hasLevels: false,
  hasTimer: true,
  lives: 0,
  duration: 60_000,
}
```

Puis dans `game.js` → `startNewGame()`, ajoute la branche du mode :

```js
} else if (mode.id === 'chaos') {
  state.timeLeft = mode.duration;
  state.levelConfig = { /* config artificielle */ };
  applyTint('aurora');
  startPlaying();
}
```

Pour modifier le comportement spécifique au mode, ajoute des branches dans `pickSpawnEntity()`, `handleClick()`, `update()` selon les besoins (`if (state.mode.id === 'chaos') ...`).

## Ajouter un achievement

Dans `config.js` → `ACHIEVEMENTS` :

```js
myAchievement: {
  icon: '🎖',
  title: 'MA RÉCOMPENSE',
  msg: 'Description courte de la condition'
}
```

Puis trigger dans `game.js` au bon endroit :

```js
if (someCondition) tryUnlock('myAchievement');
```

## Brancher Postgres au lieu de SQLite

Dans `server.js`, remplace `initSqlite()` par une fonction équivalente avec `pg`. L'API exposée doit rester :

```js
{
  backend: 'postgres',
  insertScore(entry),
  getTopScores(mode, limit),
  rankOf(mode, scoreId),
  countByMode(mode),
  saveProfile(name, data),
  getProfile(name),
}
```

Ainsi le reste du code ne change pas.

```js
function initPostgres() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // CREATE TABLE IF NOT EXISTS scores (...);
  // CREATE TABLE IF NOT EXISTS profiles (...);
  return {
    backend: 'postgres',
    async insertScore(entry) {
      await pool.query(
        'INSERT INTO scores (id, name, score, combo, level, mode, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [entry.id, entry.name, entry.score, entry.combo, entry.level, entry.mode, entry.createdAt]
      );
      // trim per-mode top
    },
    // ... etc
  };
}
```

Note : tu devras passer toutes les routes en `async` puisque `pg` est asynchrone là où `better-sqlite3` est synchrone.

## Ajouter une animation custom

Les sprites font de l'idle bob automatique (`Math.sin(age / 180)`). Pour un sprite animé en plusieurs frames, modifie `drawSprite` dans `sprites.js` pour accepter un array de sprites :

```js
function drawSprite(ctx, spriteOrFrames, x, y, pixelSize, frameIndex = 0) {
  const sprite = Array.isArray(spriteOrFrames[0])
    ? spriteOrFrames[frameIndex % spriteOrFrames.length]
    : spriteOrFrames;
  // ... rest
}
```

Puis dans `render()` :

```js
const frameIndex = Math.floor(age / 200); // change toutes les 200ms
drawSprite(ctx, c.creature.sprite, c.x, c.y + ..., SPRITE_PIXEL, frameIndex);
```

Et la créature peut maintenant avoir `sprite: [WORMY_FRAME1, WORMY_FRAME2]`.

## Ajouter un son

Dans `audio.js` → objet `SFX` :

```js
mySound() {
  tone({ freq: noteHz(7), duration: 0.1, type: 'square', gain: 0.4 });
  // ou plusieurs notes en séquence avec setTimeout
},
```

Puis dans `game.js` :

```js
Audio.play('mySound');
```

Helpers utiles :
- `tone({ freq, duration, type, gain, attack, decay, sustain, release, bend })` — note ADSR
- `noise({ duration, gain, lowpass, highpass })` — bruit blanc filtré
- `noteHz(semitone)` — Hz d'une note (offset depuis A4)

## Personnaliser la palette

Tout est dans `sprites.js` → `PALETTE`. Change une couleur, **tous les sprites qui l'utilisent** changent — pratique pour dark/light mode :

```js
const PALETTE = {
  '.': null,
  'k': '#0a0a14',  // ← change ici
  // ...
};
```

Pour un thème entier, tu peux dupliquer `PALETTE` en `PALETTE_DARK` / `PALETTE_LIGHT` et passer en paramètre à `drawSprite`.

## Fichiers à NE PAS toucher si tu débutes

- `tests/run.js` — change si tu changes l'API
- `data/.secret` — généré, doit rester secret (pas Git !)
- Les `localStorage` keys dans `store.js` (`safari_frenzy_*_v2`) — change la version si tu casses la compat

## Conventions de code

- **Indent** : 2 spaces partout
- **Single quotes** pour les strings JS (pas de backticks sauf templates)
- **camelCase** pour les variables, **CONSTANT_CASE** pour les constantes
- **Pas de `==`** — toujours `===`
- **Pas de `var`** — `const` par défaut, `let` si réassigné
- **Commentaires en français OK** dans la doc, **anglais préféré** dans le code
