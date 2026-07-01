# Hermes Notes V2 (Hermes Multi Notes Lab)

Application de prise de notes **multi-plateforme, offline-first et synchronisée** entre Windows et Android, avec compte utilisateur par email. Version produit issue du prototype « Hermes Multi Notes Lab » (V1, Python/tkinter).

> **Branche `v2-cross-platform-sync`** : contient la V2 complète (client web, serveur de sync, builds Windows/Android).
> **Branche `master`** : prototype V1 d'origine + documentation de l'expérience Hermes.

## Ce que fait l'application

- Créer, modifier, archiver, restaurer et supprimer des notes (avec **corbeille**, rien n'est détruit immédiatement)
- Tags, recherche instantanée (titre, contenu, tags), tri par date ou titre, épinglage
- **Compte utilisateur** : inscription/connexion par email + mot de passe, session persistante, données strictement isolées par utilisateur
- **Offline-first** : l'application fonctionne à 100 % sans internet ; les changements sont mis en file d'attente locale
- **Synchronisation automatique** Windows ↔ Android : au démarrage, après chaque changement, toutes les 60 s et au retour du réseau
- **Aucune perte silencieuse** : les modifications concurrentes créent une « copie de conflit » — les deux versions survivent
- Exports JSON et Markdown, import JSON (y compris le format du prototype V1), sauvegardes locales automatiques
- Interface sombre, moderne, responsive (clavier/souris sur PC, tactile sur mobile)

## Architecture en bref

```
┌────────────────┐        ┌────────────────┐
│  Windows (EXE)  │        │ Android (APK)  │      1 seule base de code web
│  Electron       │        │ Capacitor      │      (client/) embarquée dans
│  client/ (www)  │        │ client/ (www)  │      les deux applications
└───────┬────────┘        └───────┬────────┘
        │    IndexedDB locale = source de vérité (offline-first)
        └────────────┬─────────────┘
                     ▼  push/pull par révisions + détection de conflits
           ┌──────────────────────┐
           │  Serveur de sync      │  Node.js ZÉRO dépendance
           │  server/server.js     │  (node:http, node:sqlite, node:crypto)
           │  Auth email + JWT     │  SQLite + backups automatiques
           └──────────────────────┘
```

Détails : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/SYNC_DESIGN.md](docs/SYNC_DESIGN.md) · [docs/OFFLINE_MODE.md](docs/OFFLINE_MODE.md)

## Lancement rapide

### 1. Démarrer le serveur de synchronisation (nécessaire pour la sync, pas pour l'usage hors ligne)

```bash
cd server
node server.js --static ../client        # ou double-clic sur server/start-server.bat
```

- Node.js ≥ 23.4 requis (node:sqlite intégré). Zéro `npm install`.
- API sur `http://<ip-du-pc>:8787`, client web servi sur la même adresse.
- Les données vivent dans `server/data/` (base SQLite + backups + secret JWT).

### 2. Windows

- **EXE portable** : `desktop/dist/HermesNotes-2.0.0-portable.exe` (voir [docs/BUILD_WINDOWS.md](docs/BUILD_WINDOWS.md) pour le reconstruire)
- ou n'importe quel navigateur sur `http://127.0.0.1:8787`

### 3. Android

- **APK** : générée par Capacitor (voir [docs/BUILD_ANDROID.md](docs/BUILD_ANDROID.md))
- Installer l'APK, ouvrir l'app, dérouler « Serveur de synchronisation » et saisir l'adresse du PC sur le réseau local, ex. `http://192.168.1.10:8787`

### 4. Créer un compte

Dans l'app : saisir email + mot de passe (≥ 8 caractères) → « Créer un compte ». Le même compte sur PC et téléphone = les mêmes notes partout.

## Structure du projet (branche V2)

```
├── client/          # Client web (source unique de l'UI) : HTML/CSS/JS vanilla
│   ├── index.html
│   ├── css/app.css
│   └── js/          # db.js (IndexedDB) · api.js (REST) · sync.js (moteur offline-first) · app.js (UI)
├── server/          # Serveur de sync zéro dépendance (auth email, JWT, SQLite, conflits)
│   ├── server.js
│   ├── start-server.bat
│   └── test/api.test.js      # 23 tests d'intégration (auth, sync, conflits, isolation)
├── desktop/         # Wrapper Electron → EXE Windows portable
├── mobile/          # Wrapper Capacitor → APK Android
├── scripts/         # copy-www.mjs : copie client/ vers desktop/www et mobile/www
├── docs/            # Documentation V2 + rapports de l'expérience V1
└── src/             # Prototype V1 (Python/tkinter), conservé pour référence
```

## Documentation

| Document | Contenu |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Décision de stack, composants, sécurité |
| [docs/SYNC_DESIGN.md](docs/SYNC_DESIGN.md) | Protocole de sync, révisions, gestion des conflits |
| [docs/OFFLINE_MODE.md](docs/OFFLINE_MODE.md) | Fonctionnement hors ligne, file d'attente, retour réseau |
| [docs/BUILD_WINDOWS.md](docs/BUILD_WINDOWS.md) | Construire l'EXE Windows |
| [docs/BUILD_ANDROID.md](docs/BUILD_ANDROID.md) | Construire et installer l'APK Android |
| [docs/TEST_REPORT.md](docs/TEST_REPORT.md) | Rapport de test complet V2 (serveur, E2E, offline, conflits) |

## Défauts V1 corrigés en V2

| Défaut V1 | Statut V2 |
|---|---|
| Filtre « Archived » non fonctionnel | ✅ Archivage/désarchivage réel + vue dédiée |
| Pas de backup automatique | ✅ Backups serveur (14 roulants) + instantanés locaux (10) |
| Suppression irréversible immédiate | ✅ Corbeille + restauration + rétention 30 jours |
| IDs instables (collisions possibles) | ✅ UUID stables |
| Titres identiques indifférenciables | ✅ Cartes avec extrait, dates, tags ; sélection par id |
| Pas de verrouillage/concurrence | ✅ Transactions SQLite + transactions IndexedDB + verrou inter-onglets (Web Locks) |
| Pas de synchronisation | ✅ Sync multi-appareils offline-first avec gestion de conflits |

## Limites connues (V2)

- **APK non testée sur téléphone physique** : générée et signée (debug), mais la validation sur appareil réel reste à faire.
- **Pas d'email de vérification / récupération de mot de passe** : nécessiterait un serveur SMTP (voir prochaines étapes).
- **Serveur auto-hébergé en HTTP** : parfait en réseau local ; pour une exposition internet, mettre un reverse proxy HTTPS devant (Caddy/nginx) — documenté dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **EXE non signé** (pas de certificat de signature de code) : SmartScreen peut afficher un avertissement au premier lancement.
- Le serveur nécessite Node ≥ 23.4 sur la machine hôte.

---

## Historique : le prototype V1 et l'expérience Hermes

### Experiment: Hermes Multi-Instance Kanban Workflow

Ce projet est né d'un test de la capacité de Hermes à utiliser son dashboard Kanban comme centre de contrôle. Hermes devait se donner des ordres via son propre dashboard, créer des tâches Kanban par rôle (Superviseur, Architecte, Développeur, Testeur, Critique, Synthèse), et consolider les résultats.

Le multi-instance réel n'a pas été entièrement confirmé — la coordination a été simulée via `delegate_task`. Malgré cette limite, le workflow a produit une application fonctionnelle (V1, note 7/10) et un rapport consolidé. La V2 (cette branche) corrige ensuite tous les défauts identifiés par ce workflow et transforme le prototype en produit multi-plateforme.

- [📊 Rapport complet de l'expérience](docs/EXPERIMENT_REPORT.md)
- [🎯 Prompt utilisé pour l'expérience](PROMPT.md)
- [🔧 Pourquoi ça a marché](docs/WHY_IT_WORKED.md)
- [📋 Rapport de test V1](TEST_REPORT.md)

### Lancer le prototype V1 (référence)

```bash
pip install -r requirements.txt
python src/main.py
```
