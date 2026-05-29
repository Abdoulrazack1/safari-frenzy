# Reddit — r/gamedev

**Subreddit cible :** r/gamedev
**Flair :** `Game` ou `Project Showcase`
**Best time :** mardi-jeudi

---

## Titre

> Safari Frenzy — Game Boy-style pixel art browser game in vanilla JS (4 modes, procedural levels, anti-cheat, chiptune audio)

---

## Body

Hey r/gamedev,

J'ai fini **Safari Frenzy**, un mini-jeu navigateur dans le style Game Boy. C'est mon premier "vrai" jeu, donc je voulais partager les choix techniques + recevoir des feedbacks sur le game design.

### Le pitch

Tu captures des créatures à coups de Pokéball (clic), évites les BOOMb (-points), maintiens un combo. Plus le combo monte, plus les points par capture montent. Tu débloque un pokédex au fil des parties.

```
       .  ✨   .
    ┌─────────────────┐
    │  ▓▓░░  ▓▓░░     │
    │ ▓░░░░ ▓░░░░     │
    │  ▓▓▓▓  ▓▓▓▓     │
    │                 │
    │   ●           ◇ │
    │  PIDGY      MASTER
    │              BALL
    └─────────────────┘
       L4 ⏱ 32  COMBO ×3
```

### Modes (4)

- **Classique** — 8 niveaux + procédural infini, objectifs, bonus rounds
- **Endless** — 3 vies, pas de timer, pure score chase
- **Hardcore** — one-shot, un miss = game over
- **Chasse** — 90s pour traquer une cible spécifique

### Choix techniques

**Stack** : HTML/CSS/JS vanilla + Node/Express + SQLite (avec fallback JSON).

**Frontend zero-dep** : chaque module est IIFE exposant un global (`window.SafariConfig`, `SafariAudio`, `SafariGame`...). Pas de bundler.

**Sprites** : strings array 14×14, palette indexée, render via Canvas 2D. Pas d'image bitmap — tout est défini en code, ce qui rend l'ajout d'une créature trivial.

**Audio chiptune procédural** : Web Audio API, zéro fichier audio. SFX, jingles de level complete, ET la musique de fond (boucle pentatonique 16/32 pas) sont générés à la volée.

**Anti-cheat** : HMAC-SHA256 + plausibility check (≤ 400 pts/sec).
- Client demande un token signé au start
- Joint au score final
- Serveur vérifie signature + mode + plausibilité
- Bonus : tokens à TTL court (5 min)

**Achievements** : 13 achievements, vérifiés à chaque tick via callbacks `check(state) => bool`.

**Power-ups** (drops 5%) : Time+5, Freeze (3s), Master AOE, Magnet, Repel.

### Stats

- ~3500 LOC frontend
- ~700 LOC backend
- 18 tests d'intégration (anti-cheat + scores + profils)
- 5 fichiers de doc dans `docs/` (ARCHITECTURE, API, GAME_DESIGN, EXTENSIONS, DEPLOYMENT)

### Live

→ [à déployer Render / Fly.io / Github Pages]

### Code

https://github.com/Abdoulrazack1/safari-frenzy

MIT. Contributions welcome — surtout des nouvelles créatures (le format sprite est trivial), modes, achievements.

Je serais curieux de vos retours sur :
- L'équilibrage des modes (Hardcore est-il trop punitif ?)
- L'audio chiptune procédural (est-ce que la musique fond saoule au bout de 5 min ?)
- L'anti-cheat (vous tenteriez quoi pour le contourner ?)

---

## Notes

- Inclure GIF gameplay dans le post (essentiel)
- Mentionner les **doc files** — montre que c'est sérieux, pas juste un toy project
- Cross-poster sur Itch.io après (pas pendant — l'algo HN/Reddit n'aime pas)
