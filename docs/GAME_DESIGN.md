# Game Design

Ce document explique pourquoi les mécaniques sont ce qu'elles sont, et comment elles s'imbriquent pour produire de l'engagement.

## Boucle d'engagement principale

```
       ┌──► capturer ──┐
       │               ▼
       │            +score
       │               │
   reflex ◄───┐        ▼
       ▲      │      +combo
       │      │        │
       │      └─── multiplicateur ──► risque accru
       │                                  │
       │                                  ▼
       │                              décision
       └────────────────────────── (jouer safe / pousser)
```

Le coeur c'est l'arbitrage **risque vs récompense** sur chaque clic. Plus le combo monte, plus chaque capture vaut cher, MAIS aussi plus la chute est douloureuse — un seul miss / BOOMb réinitialise tout. Cette tension permanente est ce qui transforme un whack-a-mole basique en quelque chose qu'on relance.

## Pourquoi ces créatures, ces points ?

| Type        | Pts  | Weight | Lifetime | Justification |
| ----------- | ---- | ------ | -------- | ------------- |
| Communes    | +10  | 86     | 1000ms+  | Volume de captures pour alimenter le combo |
| Rares       | +25  | 26     | 850ms    | Récompense intermédiaire, mainstream-fun |
| Légendaires | +50  | 3      | 600ms    | Moment "wow", visible loin, courte fenêtre |
| BOOMb       | -20  | 18     | 1200ms   | Long pour qu'on ait le temps de l'éviter — la pénalité est dans la rupture du combo, pas vraiment dans -20 |

Les pondérations donnent ~85% commun / 13% rare / 1.5% légendaire / 9% BOOMb (avant modulation par difficulté). Les 9% BOOMb sont la chose la plus importante : assez pour que ce ne soit pas anecdotique, pas assez pour que le jeu devienne un anti-pattern où on évite plus qu'on capture.

**Lifetime des BOOMb (1200ms) > lifetime des légendaires (600ms)** : volontaire. Le BOOMb t'invite à *ne pas cliquer*. Le légendaire t'oblige à *cliquer vite*. Les deux mécaniques se complètent — on apprend à scanner le screen et à prioriser, pas juste à spammer.

## Pourquoi les niveaux ?

Sans niveaux, le score est sans contexte. 1500 c'est beaucoup ? peu ? Avec niveaux :

- **Objectif clair** : "atteindre 200 en 45s" est un défi binaire, immédiatement compréhensible
- **Sentiment de progression** : passer L3 c'est un *événement*, pas juste un nombre qui monte
- **Variété** : chaque niveau a son ambiance (biome, tint), son spawn rate, son ratio de BOOMb
- **Bonus de temps** (+10 pts/sec restant) à la fin → récompense l'efficacité, pas juste la persévérance

Les 8 niveaux sont conçus pour ~8-12 minutes de session première complète. Au-delà, génération procédurale (`getLevel(n)`) avec courbe linéaire de difficulté.

### Courbe de difficulté

Trois leviers modifiés par `level.difficulty` :

1. **Spawn rate** : `750ms - 320ms × elapsed - 220ms × diff`
2. **Lifetime des créatures** : ×`(1 - diff × 0.3)`, plafond -40%
3. **Pondérations** : BOOMb ×(1 + diff × 0.7), commons ×(1 - diff × 0.15)

À L8 (`diff = 1.15`), tu es à ~280ms entre spawns avec des BOOMb beaucoup plus fréquents et des fenêtres de capture courtes.

## Bonus rounds

Tous les 3 niveaux en mode classique. 15 secondes où :

- **Seuls les légendaires apparaissent** (50 pts)
- **Pas de BOOMb**
- **Multiplicateur ×2 sur tout** (donc combo ×3 × bonus ×2 = ×6)
- **Spawn rate accéléré** (600ms intervals)

Pourquoi : même les meilleurs joueurs ont des creux d'attention, et ces 15s sont une **récompense pure**, sans risque. Ça donne envie de pousser pour atteindre le prochain bonus. C'est aussi visuellement spectaculaire (tint cosmique, bordure dorée pulsante) — un payoff sensoriel qui marque la mémoire et alimente l'envie de retry.

## Modes de jeu

### Classique

Le mode "principal", celui décrit ci-dessus. 8 niveaux + procédural infini.

### Endless

3 vies. Chaque BOOMb = -1 vie. Pas de timer. Pas d'objectif. **Pure score chase.**

Pourquoi cette variante : certains joueurs n'aiment pas les timers (anxiété de performance). En endless, ils peuvent jouer tranquille, focus pure dextérité. La difficulté monte avec le temps écoulé, mais sans pression de timer.

### Hardcore

**Une seule erreur = game over.** Miss un clic ? Mort. Hit un BOOMb ? Mort.

C'est le mode pour les sweat. Très court, très intense, idéal pour speedrun ou défi entre amis. La courbe de difficulté est la même que classique, mais on ne dépasse jamais L4-5 sans être quasi-parfait.

### Hunt

90 secondes. Une cible désignée (uncommon ou rare). N'attrape **que** la cible — toute autre capture = -20 pts.

Pourquoi : entraîne un skill différent — l'inhibition. Tu apprends à *ne pas cliquer*. C'est aussi la rampe d'apprentissage idéale pour les BOOMb : si tu peux retenir tes clics sur les autres créatures, retenir sur les BOOMb devient automatique.

## Power-ups (drops 5%)

Chaque slot de spawn a 5% de chances de produire un item à la place d'une créature. 5 items existent :

| Item        | Effet                              | Pourquoi |
| ----------- | ---------------------------------- | -------- |
| Time +5     | +5s au timer                       | Bouée de sauvetage en fin de niveau |
| Freeze      | Toutes les créatures gèlent 3s     | Permet de rattraper un screen surchargé |
| Master AOE  | Prochain clic capture toute l'aire | Moment power-fantasy, +3-5 captures d'un coup |
| Magnet      | Auto-aim 4s                        | Pardon des clics imprécis (mais pas sur BOOMb !) |
| Repel       | Clear tous les BOOMb du screen     | Récompense le scan visuel |

**Pourquoi 5% et pas 10%** : trop d'items rendent le jeu trivial. À 5%, voir un power-up est un *événement*. Le ressenti d'apparition rare > l'utilité absolue.

**Pourquoi le Magnet n'attrape pas les BOOMb** : c'est anti-frustrant. Sinon le power-up devient un piège. Game design rule : les power-ups doivent te faire sentir plus fort, jamais te punir.

## Combo system

```
1-2 captures   → ×1
3-5 captures   → ×2
6-8 captures   → ×3
9-11 captures  → ×4
12+ captures   → ×5 (cap)
```

Cap à ×5 : pour qu'il y ait toujours un objectif atteignable. À ×∞, les top scores deviendraient juste "qui a la chance d'enchaîner 50 captures sans rien voir d'autre". À ×5, on stabilise — la chasse devient *maintenir* le combo, pas le gonfler à l'infini.

## Achievements

13 achievements, débloqués via toasts en haut du canvas. Plusieurs catégories :

- **Premier-quelque-chose** (firstCatch, powerup, masterball, bonusRound, huntComplete) — récompenses d'onboarding
- **Skill** (combo10, combo20, perfect) — défis de précision
- **Volume** (legendary, legendary5, score5k, score10k, pokedexHalf) — encouragements à poursuivre
- **Mode-specific** (level5, level8, hardcoreRun, endlessRun) — pousser vers les autres modes

L'idée n'est pas de complétion à 100% (ennuyeux après le 3ème jeu). C'est de **ponctuer** la première session avec des moments "ah cool", et de pointer du doigt des comportements à explorer (essaie le hardcore !).

## Pokédex persistant

Chaque créature capturée incrémente un compteur dans localStorage. Visible au menu sous forme de grille — créatures non-vues affichées en `???`.

Pourquoi : appel au "collectionneur" en chacun. Voir 4/6 espèces remplies pousse à essayer assez longtemps pour voir un Mewzy. Pas de mécanique de gameplay liée — c'est purement métacognitif.

## Persistance & sync

- **Local (toujours)** : pokédex, achievements, best score par mode, settings — `localStorage`
- **Serveur** : top scores (par mode) — SQLite
- **Cloud sync optionnel** : profile (pokédex + achievements + best) — sauvegarde après chaque score posté, lecture manuelle via `/api/profile/:name`

Le serveur n'authentifie pas — c'est un projet portfolio, pas un MMO. N'importe qui peut écrire sur n'importe quel nom. Pour un déploiement public à enjeux, il faudrait JWT + login.

## Audio chiptune procédural

Tout est généré par le Web Audio API : pas de fichiers audio, pas de bandwidth. Le son d'une capture commune c'est deux oscillateurs square en montée d'octave (50ms d'intervalle). Le BOOMb c'est un noise burst lowpass + un sawtooth qui descend 80→30Hz.

La musique de fond est un pattern pentatonique 16 pas (basse triangle) + 32 pas (mélodie square) à 120 BPM, en loop. Hors par défaut — opt-in dans les settings, parce que beaucoup de joueurs préfèrent leur propre musique.

## Anti-frustration

- **Hitbox padding 6px** autour des sprites — clic légèrement à côté = capture quand même
- **Auto-aim Magnet** ignore les BOOMb
- **BOOMb lifetime > tous les autres** — toujours le temps de les voir
- **Pop-in animation 150ms** — créatures jamais "pop instant"
- **Pas de score négatif** : `Math.max(0, ...)` partout

## Anti-trivial

- **Cap multiplicateur ×5** — pas d'inflation
- **Combo reset sur escape** — tu peux pas juste attendre que les communes spawnent
- **Spawn position aléatoire** — pas de mémoire spatiale possible
- **Difficulty ramp** — impossible de tenir L8+ sans être bon

## Ce qui manque (consciemment)

- **Pas de mode multijoueur** — le scope serait massif (sync, lobby, anti-cheat strict)
- **Pas de microtransactions** — c'est un projet portfolio, pas un free-to-play
- **Pas de tutorial explicite** — le menu décrit les modes, le reste s'apprend en jouant. Le pokédex à `???` apprend la diversité, le toast d'achievement apprend les patterns
- **Pas de fail-state spectaculaire** — le game over est sobre, on est dans le retry rapide

Si tu veux ajouter ces features, [EXTENSIONS.md](EXTENSIONS.md) couvre les pistes concrètes.
