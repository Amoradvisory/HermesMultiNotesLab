# Architecture — Hermes Notes V2

## 1. Décision de stack

### Question : garder Python/tkinter ?

**Non.** Le prototype V1 (Python + tkinter + JSON) ne peut pas produire d'APK Android, ne gère ni la concurrence ni la corruption, et ses IDs (`note_001`…) peuvent entrer en collision après une suppression. La V1 reste dans `src/` comme **référence fonctionnelle et visuelle** (thème sombre, tags, recherche, messages positifs discrets).

### Stack retenue

| Couche | Choix | Pourquoi |
|---|---|---|
| UI (les deux plateformes) | **Web app vanilla** (HTML/CSS/JS, zéro framework, zéro build) | Une seule base de code, aucun bundler, chargeable en `file://` (Electron) et WebView (Capacitor) |
| Windows | **Electron 33** + electron-builder (cible `portable`) | EXE autonome fiable, Chromium intégré, IndexedDB natif |
| Android | **Capacitor 6** | compileSdk 34 = SDK Android déjà présent sur la machine de build ; WebView moderne ; APK standard |
| Stockage local | **IndexedDB** (via `client/js/db.js`) | Disponible partout (Chrome, Electron, WebView), transactionnel, largement dimensionné |
| Backend | **Node.js zéro dépendance** (`node:http`, `node:sqlite`, `node:crypto`) | Aucun `npm install`, aucune supply-chain, auto-hébergeable partout où Node ≥ 23.4 existe |
| Base serveur | **SQLite** (WAL) | Fichier unique, transactions ACID, backups triviaux |

### Pourquoi pas Firebase / Supabase ?

Fonctionnellement valables, mais ils imposent la création d'un compte tiers, des clés d'API et un lock-in. Le serveur auto-hébergé : gratuit, contrôle total des données, fonctionne en réseau local sans internet, et reste déployable plus tard sur un VPS/Render/Railway derrière un reverse proxy HTTPS. La couche `client/js/api.js` est assez petite pour être portée vers Supabase si un jour le besoin change.

## 2. Composants

```
client/                    # source unique de l'UI
├── js/db.js               # IndexedDB : notes, meta (session/réglages/curseur), backups
│                          #   + mutateNote() : lecture-modification-écriture ATOMIQUE
├── js/api.js              # REST : register/login/me/sync/health, timeouts, erreurs réseau typées
├── js/sync.js             # moteur offline-first (voir SYNC_DESIGN.md)
└── js/app.js              # UI : vues, éditeur, corbeille, exports, backups, session

server/server.js           # HTTP + routage + auth + sync + statique (~550 lignes)
desktop/                   # main.js Electron (sandbox, contextIsolation, pas de Node côté page)
mobile/                    # capacitor.config.json + projet android généré (npx cap add android)
scripts/copy-www.mjs       # copie client/ -> desktop/www et mobile/www à chaque build
```

## 3. Modèle de données

### Note (partout : client, fil réseau, serveur)

```
id          UUID v4, stable à vie          createdAt   ISO 8601
title       texte (≤ 500)                  updatedAt   ISO 8601 (bump à chaque édition)
content     texte (≤ 1 Mo)                 archivedAt  ISO 8601 | null
tags        [string] (≤ 50)                deletedAt   ISO 8601 | null (corbeille/tombstone)
pinned      bool                           rev         entier : révision serveur
```

Côté client s'ajoutent : `dirty` (changement local pas encore poussé = file d'attente) et `conflictOf` (id d'origine d'une copie de conflit).

### Serveur (SQLite)

- `users(id, email UNIQUE, pass_hash, created_at)`
- `notes(id, user_id, …, rev, last_client_id)` — clé primaire `(id, user_id)`, index `(user_id, rev)`
- `user_seq(user_id, seq)` — compteur de révisions **par utilisateur**

## 4. Sécurité

- **Mots de passe** : scrypt (sel 16 octets aléatoire), comparaison en temps constant.
- **Sessions** : JWT HS256, secret 64 octets généré au premier démarrage (`server/data/secret.key`, jamais commité), durée 90 jours.
- **Isolation** : chaque requête SQL filtre par `user_id` issu du token — un utilisateur ne peut ni lire ni écrire les notes d'un autre (testé, voir TEST_REPORT.md).
- **Anti brute-force** : 20 requêtes/min/IP sur `/api/auth/*`.
- **Limites d'entrée** : corps ≤ 8 Mo, 500 changements/sync, champs bornés, IDs validés par regex.
- **Client Electron** : `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` ; liens externes ouverts dans le navigateur système.
- **CORS** : `Access-Control-Allow-Origin: *` — sans cookies (JWT en header), c'est sûr ; l'authentification reste obligatoire.
- **Exposition internet** : le serveur parle HTTP. En LAN c'est acceptable ; sur internet, placer un reverse proxy TLS devant :
  ```
  Caddyfile : notes.mondomaine.be { reverse_proxy 127.0.0.1:8787 }
  ```

## 5. Fiabilité / anti-corruption

- SQLite en mode **WAL** + transactions (`BEGIN IMMEDIATE`) autour de chaque sync.
- **Backup serveur automatique** à chaque démarrage, avant ouverture de la base (fichier fermé = copie cohérente), 14 conservés dans `server/data/backups/`.
- **Instantanés locaux** côté client (10 roulants dans IndexedDB) + export JSON/Markdown manuel.
- Écritures client **atomiques** : `mutateNote()` fait lecture+modification+écriture dans une seule transaction IndexedDB (élimine les courses entre auto-save et moteur de sync).
- **Verrou inter-onglets** (Web Locks API) : deux fenêtres ouvertes ne peuvent pas synchroniser en même temps.
