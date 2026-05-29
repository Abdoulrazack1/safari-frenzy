# Dev.to — Article technique

**Titre :** Building a Pixel-Art Browser Game in Vanilla JS: Architecture Lessons from Safari Frenzy
**Tags :** `javascript`, `gamedev`, `webdev`, `canvas`
**Canonical URL :** https://github.com/Abdoulrazack1/safari-frenzy

---

## Plan

### 1. Le projet
- Mini-jeu navigateur Game Boy-like
- Stack vanilla JS + Node/Express + SQLite
- Pourquoi ça : exercice de game dev sans Phaser/Unity/Godot

### 2. Architecture frontend
- Module pattern : IIFE exposant global (`window.SafariGame`, `SafariAudio`...)
- Pas de bundler, scripts chargés via `<script>` tags ordonnés
- State machine pour gérer les écrans (menu → playing → game over → leaderboard)
- Game loop : `requestAnimationFrame` + deltaTime

### 3. Sprites pixel art en code
- Format : string array 14×14
- Palette indexée (chars `▓░ ` mappés à des couleurs)
- Render via Canvas 2D `fillRect` par pixel
- Avantage : ajouter une créature = définir 14 strings, pas de fichier image
- Inconvénient : peu scalable au-delà de 50 sprites

### 4. Audio chiptune procédural
- Web Audio API, **zéro fichier audio**
- SFX : oscillator + envelope (attack/decay)
- Jingles : séquence de notes timée
- Musique de fond : boucle pentatonique 16/32 pas
- Avantage : bandwidth zero
- Inconvénient : variations limitées sans synthèse plus complexe

### 5. Anti-cheat
- Pourquoi (leaderboards = cibles fortes)
- HMAC-SHA256 : client demande token au start, joint au score final, serveur vérifie
- Plausibility check : ≤ 400 pts/sec (au-delà = humain impossible)
- TTL des tokens (5 min)
- Limites : un dev déterminé peut toujours reverse-engineer, le but est de raiser le coût

### 6. Achievements
- Définis dans config (id, title, description, check)
- `check(state) => bool` évalué à chaque tick
- Stockage localStorage + sync cloud optionnelle
- Toast notification au unlock

### 7. Backend Express + SQLite
- Endpoints : `/api/health`, `/api/session`, `/api/scores`, `/api/profile/:name`
- SQLite via better-sqlite3 (rapide, fichier unique)
- Fallback JSON si compilation native échoue (Windows is fun)
- Schema simple : sessions, scores, profiles

### 8. Tests
- 18 tests d'intégration
- Couvrent : session creation, score submission (valide + invalide), profil CRUD, plausibility rejection
- Pas de tests unitaires (overkill pour ce scope)

### 9. Déploiement
- Frontend : statique → GitHub Pages / Netlify
- Backend : Render / Fly.io / VPS
- Si tout-en-un : Render (Node + SQLite volume persistent)

### 10. Lessons learned
- Vanilla JS pour un petit jeu = OK
- Pour un jeu plus complexe (>5000 LOC) → Phaser ou framework dédié
- Audio procédural impressive mais limité — pour une vraie OST, fichiers
- Anti-cheat parfait n'existe pas — raise the cost, c'est tout

### 11. Liens
- Repo : https://github.com/Abdoulrazack1/safari-frenzy
- Itch.io : [à publier]
- Live demo : [à déployer]

---

## Notes

- Audience : devs intermédiaires curieux du game dev sans framework
- 2000-2500 mots
- 4-5 snippets (game loop, sprite renderer, HMAC check, achievement system, audio synth)
- GIF de gameplay en haut de l'article
