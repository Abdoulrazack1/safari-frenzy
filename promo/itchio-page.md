# Itch.io — Page

**URL création :** https://itch.io/game/new
**Catégorie :** Browser game, Pixel art, Arcade

---

## Title

Safari Frenzy

## Short description (200 chars)

Game Boy-style pixel art browser game. Capture créatures, avoid BOOMb, build combos. 4 modes, 13 achievements, procedural chiptune audio. Open source.

## Genre

Action

## Tags

`arcade`, `pixel-art`, `gameboy`, `retro`, `browser`, `open-source`, `pokemon-like`, `score-attack`

## Description (Markdown supported)

```markdown
# Safari Frenzy

A Game Boy-style browser game where you capture pixel creatures, avoid explosive BOOMb, and build combos for massive scores.

## Modes

- **Classique** — 8 levels + infinite procedural, objectives, bonus rounds
- **Endless** — 3 lives, no timer, pure score chase
- **Hardcore** — one-shot, one miss = game over
- **Chasse** — 90s to track a specific target

## Features

- 🎮 4 modes + 8 hand-crafted levels + procedural infinity
- ✨ Bonus rounds every 3 levels (legendary creatures only, ×2 points)
- 🎵 100% procedural chiptune audio (Web Audio API, zero audio files)
- 📖 Persistent pokédex (localStorage)
- 🏆 13 achievements with toast notifications
- 📊 Per-mode leaderboards (server-side)
- ☁️ Optional cloud sync for profiles
- 🔒 HMAC anti-cheat
- ♿ Reduced motion mode for accessibility

## Power-ups (5% drop rate)

- ⏱ **Time +5** — lifesaver
- ❄ **Freeze** — freeze all creatures for 3s
- ⚪ **Master AOE** — next click captures all in area
- 🧲 **Magnet** — auto-aim for 4s (BOOMb excluded)
- 💨 **Repel** — clears all BOOMb on screen

## Open Source

Full source code on GitHub: https://github.com/Abdoulrazack1/safari-frenzy

MIT licensed. Add your own creatures, modes, achievements — the architecture is documented in `docs/EXTENSIONS.md`.

## Stack

Vanilla JS frontend, Node.js + Express + SQLite backend. Zero framework, zero bundler in frontend.

## Credits

Built by [Abdoulrazack1](https://github.com/Abdoulrazack1) as a personal project — first "real" game I've finished.
```

---

## Pricing

`$0.00 USD` (free, no donation required)
Toggle "Donations" if tu veux activer les tips.

## Visibility

- **Visibility :** Public (after upload)
- **Type :** Browser
- **Embed in browser :** ✅ Yes (toggle)
- **Mobile friendly :** ✅ Yes (if mobile-tested)

---

## Upload checklist

1. Build le jeu en mode "static export" (frontend seul + un backend déployé séparément type Render/Fly)
2. Zip le frontend
3. Upload sur Itch.io en cochant "Embed in browser"
4. Définir le `index.html` comme entry point
5. Test in browser via le preview Itch.io
6. Publier

---

## Visuals

- **Cover image** : 630×500 (PNG, le sprite GBC d'une créature représentative)
- **Screenshots** : 3-5 (gameplay, level complete, leaderboard, achievement unlock, dark mode)
- **GIF de gameplay** : autoplay sur la page (10-15s, capture d'une session)

---

## Notes

- Itch.io a une communauté petite mais qualifiée — moins de bruit qu'un Reddit
- Devlog : poster 1 devlog par mois pour rester visible (Itch met en avant les jeux actifs)
- Cross-post : après quelques semaines sur Itch.io, partager le lien Itch sur r/incremental_games ou r/WebGames
