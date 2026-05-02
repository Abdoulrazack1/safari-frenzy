# Deployment

Comment mettre Safari Frenzy en production.

## Cas 1 : Démo locale (le plus simple)

```bash
npm install
npm start
```

C'est tout. SQLite se crée automatiquement, le serveur sert le frontend depuis `/public`. Idéal pour montrer en entretien depuis ton laptop.

## Cas 2 : VPS / Raspberry Pi

### Prérequis
- Node.js ≥ 18
- (optionnel) `build-essential` pour `better-sqlite3` si Linux

```bash
git clone <repo>
cd safari-frenzy
npm install --production
```

### Lancement persistant avec systemd

Crée `/etc/systemd/system/safari-frenzy.service` :

```ini
[Unit]
Description=Safari Frenzy game server
After=network.target

[Service]
Type=simple
User=safari
WorkingDirectory=/opt/safari-frenzy
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable safari-frenzy
sudo systemctl start safari-frenzy
sudo systemctl status safari-frenzy
```

### Reverse proxy nginx avec HTTPS

```nginx
server {
    listen 443 ssl http2;
    server_name safari.tondomaine.fr;

    ssl_certificate     /etc/letsencrypt/live/safari.tondomaine.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/safari.tondomaine.fr/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

server {
    listen 80;
    server_name safari.tondomaine.fr;
    return 301 https://$server_name$request_uri;
}
```

```bash
sudo certbot --nginx -d safari.tondomaine.fr
```

### Backup automatique

Le fichier SQLite est `data/safari.db`. Backup quotidien dans `/etc/cron.daily/safari-backup` :

```bash
#!/bin/bash
BACKUP_DIR=/var/backups/safari-frenzy
mkdir -p "$BACKUP_DIR"
sqlite3 /opt/safari-frenzy/data/safari.db ".backup $BACKUP_DIR/safari-$(date +%Y%m%d).db"
# Garde 30 jours
find "$BACKUP_DIR" -name 'safari-*.db' -mtime +30 -delete
```

## Cas 3 : Docker

`Dockerfile` :

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

COPY public ./public
COPY server.js ./

# Volumes pour persistance
VOLUME /app/data

EXPOSE 3000
ENV NODE_ENV=production

USER node

CMD ["node", "server.js"]
```

`docker-compose.yml` :

```yaml
version: '3.8'
services:
  safari:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - safari-data:/app/data
    restart: unless-stopped

volumes:
  safari-data:
```

```bash
docker compose up -d
```

## Cas 4 : Plateforme Node hébergée (Render, Railway, Fly.io)

Tous prennent en compte automatiquement `package.json` → `npm start`.

### Render.com

- New Web Service → connect repo
- Runtime: `Node`
- Build: `npm install`
- Start: `node server.js`
- Add disk: `data` (1 Go suffit, monté sur `/app/data`)

### Fly.io

```bash
fly launch
fly volumes create safari_data --size 1
fly deploy
```

`fly.toml` mount :
```toml
[mounts]
  source = "safari_data"
  destination = "/app/data"
```

### Vercel / Netlify

❌ Pas adapté — ces plateformes sont pour les fonctions serverless, pas pour un serveur Node persistant avec stockage local. Le frontend statique pourrait y aller, mais l'API doit aller ailleurs.

## Cas 5 : Frontend séparé du backend

Si tu veux héberger le frontend sur Vercel et l'API sur Render :

**1.** Modifier `public/js/api.js` :
```js
const API_BASE = 'https://safari-api.tondomaine.fr';
const res = await fetch(`${API_BASE}/api/scores`);
```

**2.** Activer CORS dans `server.js` :
```js
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://safari.tondomaine.fr');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
```

**3.** Frontend déployé en static sur Vercel, backend en Web Service sur Render.

## Variables d'environnement

| Variable    | Default | Description                                 |
| ----------- | ------- | ------------------------------------------- |
| `PORT`      | 3000    | Port d'écoute HTTP                          |
| `NODE_ENV`  | -       | Pas utilisé spécifiquement, laisse `production` |

Le secret HMAC (`data/.secret`) est généré automatiquement au premier lancement. **Ne le commit jamais.**

## Sécurité production

Le projet en l'état est conçu pour usage personnel ou portfolio. Avant un déploiement public à fort trafic, considère :

1. **Auth** sur `PUT /api/profile/:name` — actuellement n'importe qui peut écraser n'importe quel profil. Ajoute un JWT issued au login.
2. **Rate limit plus strict** — actuellement 1 req/2s par IP, suffisant pour 1000 joueurs concurrents mais pas pour un DDoS. Ajoute Cloudflare devant.
3. **CSP headers** — pour éviter XSS via les noms de joueurs (déjà sanitisés mais ceinture+bretelles) :
   ```js
   app.use((_req, res, next) => {
     res.setHeader('Content-Security-Policy',
       "default-src 'self'; style-src 'self' fonts.googleapis.com 'unsafe-inline'; font-src fonts.gstatic.com; img-src 'self' data:;");
     next();
   });
   ```
4. **Validation forte du score** — le check de plausibilité actuel (400 pts/sec) bloque les triches grossières mais pas un client patché qui attend 60s avant submit. Pour un mode compétitif, le serveur devrait recevoir et valider chaque action de jeu (overkill pour la plupart des projets).
5. **Sauvegarde** — la DB SQLite est un fichier unique. Backup quotidien obligatoire (voir plus haut).

## Monitoring

Logs basiques par défaut sur stdout. Pour structurer :

```js
// Au début de server.js
const logger = (level, ...args) => {
  console.log(JSON.stringify({
    level, ts: new Date().toISOString(),
    msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')
  }));
};
// Remplace les console.log par logger('info', ...)
```

Puis pipe vers Loki/Datadog/CloudWatch selon ta stack.

Pour un health endpoint déjà disponible :
```bash
curl https://safari.tondomaine.fr/api/health
# {"status":"ok","backend":"sqlite","timestamp":1735689600000}
```

Plug ça dans UptimeRobot ou n'importe quel monitoring HTTP.
