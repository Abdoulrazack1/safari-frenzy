# API Reference

Base URL en local : `http://localhost:3000`

Toutes les routes acceptent et retournent du JSON. Les erreurs ont la forme `{ "error": "code_string" }`.

---

## `GET /api/health`

Health check. Aucun paramètre.

```json
{
  "status": "ok",
  "backend": "sqlite",
  "timestamp": 1735689600000
}
```

`backend` vaut `"sqlite"` ou `"json"` selon ce que le serveur a réussi à initialiser.

---

## `POST /api/session`

Ouvre une session pour une partie. Le token retourné doit être joint à la soumission de score pour passer la vérif anti-cheat.

**Body :**
```json
{ "mode": "classic" }
```

`mode` est `"classic" | "endless" | "hardcore" | "hunt"`. Les valeurs invalides sont normalisées en `"classic"`.

**Réponse 200 :**
```json
{
  "token": "eyJzaWQiOiI4N2ExIiwibW9kZSI6ImNsYXNzaWMi…",
  "sid": "87a1f3...",
  "mode": "classic",
  "issuedAt": 1735689600000
}
```

Le token est valide 30 minutes.

---

## `GET /api/scores`

Récupère le top-N pour un mode donné.

**Query params :**

| Param  | Default   | Description                           |
| ------ | --------- | ------------------------------------- |
| `mode` | `classic` | `classic / endless / hardcore / hunt` |
| `limit`| `10`      | 1 à 100                               |

**Exemple :**
```
GET /api/scores?mode=hardcore&limit=5
```

**Réponse 200 :**
```json
{
  "scores": [
    {
      "id": "lt7m3a4f",
      "name": "ROUGE",
      "score": 1850,
      "combo": 12,
      "level": 4,
      "mode": "hardcore",
      "createdAt": "2026-05-01T18:30:00.000Z"
    }
  ],
  "total": 27,
  "mode": "hardcore"
}
```

---

## `POST /api/scores`

Soumet un score. Limité à 1 requête / 2 secondes par IP.

**Body :**
```json
{
  "name": "ROUGE",
  "score": 1850,
  "combo": 12,
  "level": 4,
  "mode": "classic",
  "sessionToken": "eyJzaWQ..."
}
```

| Champ          | Requis | Notes                                        |
| -------------- | ------ | -------------------------------------------- |
| `name`         | oui    | 1-12 chars, control chars sanitizés          |
| `score`        | oui    | entier 0-10 000 000                          |
| `combo`        | non    | entier ≥ 0, default 0                        |
| `level`        | non    | entier ≥ 1, default 1                        |
| `mode`         | non    | default `classic`, normalisé si invalide     |
| `sessionToken` | non    | obtenu de `/api/session`. Si présent, vérifié. |

**Réponse 201 :**
```json
{
  "entry": {
    "id": "lt7m3a4f7c8d",
    "name": "ROUGE",
    "score": 1850,
    "combo": 12,
    "level": 4,
    "mode": "classic",
    "createdAt": "2026-05-01T18:30:00.000Z"
  },
  "rank": 3,
  "isTop10": true,
  "verified": true
}
```

**Erreurs possibles :**

| Status | `error`             | Cause                                                  |
| ------ | ------------------- | ------------------------------------------------------ |
| 400    | `invalid_name`      | name vide / non-string                                 |
| 400    | `invalid_score`     | score négatif, NaN, ou > 10 000 000                    |
| 400    | `mode_mismatch`     | mode du token ≠ mode soumis                            |
| 400    | `implausible_score` | score > 400 pts/sec × age session                      |
| 401    | `invalid_session`   | token forgé / expiré                                   |
| 429    | `rate_limited`      | < 2s depuis la dernière soumission depuis cette IP     |

---

## `GET /api/profile/:name`

Lit le profil cloud (pokédex + achievements + best score classique) d'un dresseur.

**Réponse 200 :**
```json
{
  "name": "ROUGE",
  "data": {
    "pokedex": { "wormy": 47, "pidgy": 32, "mewzy": 3 },
    "achievements": { "firstCatch": 1735000000000, "combo10": 1735100000000 },
    "best": { "score": 5200, "level": 6 }
  }
}
```

**Réponse 404 :**
```json
{ "error": "not_found" }
```

---

## `PUT /api/profile/:name`

Sauvegarde / met à jour le profil cloud. Pas d'authentification — n'importe qui peut écrire sur n'importe quel nom (c'est volontaire pour le portfolio, à ne PAS déployer tel quel en prod).

**Body :**
```json
{
  "pokedex": { "wormy": 47 },
  "achievements": { "firstCatch": 1735000000000 },
  "best": { "score": 5200, "level": 6 }
}
```

**Réponse 200 :**
```json
{
  "name": "ROUGE",
  "data": { "pokedex": {...}, "achievements": {...}, "best": {...} },
  "updatedAt": "2026-05-02T10:15:00.000Z"
}
```

---

## Codes d'erreur récapitulatif

| Code                 | HTTP | Sens                                          |
| -------------------- | ---- | --------------------------------------------- |
| `invalid_name`       | 400  | Nom vide ou type invalide                     |
| `invalid_score`      | 400  | Score hors bornes ou NaN                      |
| `invalid_pokedex`    | 400  | PUT profile sans champ pokedex                |
| `mode_mismatch`      | 400  | Token vs body                                 |
| `implausible_score`  | 400  | Détection anti-cheat                          |
| `invalid_session`    | 401  | HMAC invalide ou token expiré                 |
| `not_found`          | 404  | Route inconnue ou profil inexistant           |
| `rate_limited`       | 429  | Trop de soumissions trop rapides              |
| `failed_to_*`        | 500  | Erreur interne — voir logs serveur            |

---

## Tester en CLI

```bash
# Health
curl http://localhost:3000/api/health

# Open session
TOKEN=$(curl -s -X POST http://localhost:3000/api/session \
  -H "Content-Type: application/json" \
  -d '{"mode":"classic"}' | jq -r .token)

# Wait > 1s for plausibility
sleep 2

# Submit score
curl -X POST http://localhost:3000/api/scores \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"ROUGE\",\"score\":250,\"mode\":\"classic\",\"sessionToken\":\"$TOKEN\"}"

# Get top scores
curl "http://localhost:3000/api/scores?mode=classic&limit=5"
```
