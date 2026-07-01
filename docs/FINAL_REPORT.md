# Rapport final — Hermes Notes V2 (produit multi-plateforme synchronisé)

> **Note d'archivage (01/07/2026)** : ce rapport est un instantané de la livraison. Les chemins locaux `C:\Users\A\Desktop\...` cités plus bas ont depuis été nettoyés du PC de développement ; les binaires (EXE, APK) et ce rapport sont attachés à la release GitHub **`v2.0.0-prototype`**. Le point de reprise unique est GitHub — voir [RESUME_LATER.md](RESUME_LATER.md).

Date : 01/07/2026 · Auteur : Hermès (Claude Fable 5) · Demande : transformer le prototype `HermesMultiNotesLab` en produit Windows + Android, offline-first, synchronisé, avec compte email.

---

## A. Résumé produit

| | |
|---|---|
| **Nom** | Hermes Notes V2 |
| **Version** | 2.0.0 |
| **Stack** | Client web unique (HTML/CSS/JS vanilla) → **Electron** (Windows) + **Capacitor 6** (Android) ; stockage local **IndexedDB** |
| **Backend** | Serveur Node.js **zéro dépendance** (node:http, node:sqlite, node:crypto), auto-hébergé, auth email + JWT |
| **Statut global** | ✅ Fonctionnel et testé sur PC (serveur + client + EXE) ; APK générée mais **non testée sur téléphone réel** |

Le prototype V1 (Python/tkinter) a été **remplacé** (impossible d'en tirer une APK) mais conservé dans `src/` comme référence. Tous ses défauts connus sont corrigés en V2.

## B. Emplacements exacts

| Livrable | Chemin |
|---|---|
| Code source complet | `C:\Users\A\Desktop\HermesMultiNotesLab_V2` |
| **EXE Windows (portable)** | `C:\Users\A\Desktop\HermesNotes-2.0.0-portable.exe` (copie ; original dans `desktop\dist\`) — 70,8 Mo |
| **APK Android** | `C:\Users\A\Desktop\HermesNotes-2.0.0-android.apk` (copie ; original dans `mobile\android\app\build\outputs\apk\debug\app-debug.apk`) — 3,6 Mo |
| Serveur de sync | `C:\Users\A\Desktop\HermesMultiNotesLab_V2\server\server.js` (lanceur : `server\start-server.bat`) |
| Repo GitHub / branche | https://github.com/Amoradvisory/HermesMultiNotesLab — branche **`v2-cross-platform-sync`**, commit `3bbf6ae` |
| Documentation | `README.md` + `docs/` (ARCHITECTURE, SYNC_DESIGN, OFFLINE_MODE, BUILD_WINDOWS, BUILD_ANDROID, TEST_REPORT) |

## C. Fonctionnalités livrées

### Compte utilisateur — ✅ livré
Inscription/connexion par email + mot de passe (≥ 8 car., hash scrypt), déconnexion, session persistante 90 jours, données strictement séparées par utilisateur (testé : un utilisateur ne voit jamais les notes d'un autre). *Non livré : email de vérification / récupération de mot de passe (pas de SMTP).*

### Notes — ✅ livré
Créer, modifier (auto-save), supprimer (→ corbeille), archiver/restaurer, rechercher (titre+contenu+tags), tags multiples, filtre par tag, dates création/modification affichées, tri par date de modification, de création ou titre, épinglage. Preuves : tests E2E n°2, 11–15 (docs/TEST_REPORT.md).

### Synchronisation — ✅ livré
Automatique : au démarrage, après chaque changement (debounce 1,5 s), toutes les 60 s, au retour du réseau, + bouton manuel. File d'attente locale (notes « dirty »), journal des 30 dernières passes, indicateur visuel 4 états (hors ligne / synchronisation / synchronisé / erreur) avec compteur en attente. Aucune perte constatée sur tous les scénarios testés.

### Offline-first — ✅ livré
L'app fonctionne à 100 % hors ligne après la première connexion : ouverture, lecture, création, modification, suppression/archivage, recherche, fermeture/réouverture. Au retour du réseau : push de la file, pull des nouveautés, fusion propre. Preuves : tests E2E n°6–10.

### Gestion des conflits — ✅ livré (politique « copie de conflit »)
UUID stable par note ; `createdAt/updatedAt/archivedAt/deletedAt` ; `clientId` tracé ; détection serveur par `baseRev`. **Jamais d'écrasement silencieux** : la version arrivée la première gagne la note d'origine, l'autre devient une « copie de conflit » (titre horodaté, tag `conflit`) visible sur tous les appareils. Testé en réel : les deux versions ont survécu.

### Sauvegarde et fiabilité — ✅ livré
Filtre Archivées **réellement fonctionnel** ; backups serveur automatiques (14 roulants, copie avant ouverture de la base) ; instantanés locaux automatiques (10 roulants, toutes les 10 min + démarrage) ; erreurs réseau/auth affichées en clair ; notes à titres identiques différenciées (extrait, dates, tags, id) ; suppression réversible (corbeille, rétention 30 jours) ; anti-corruption : SQLite WAL + transactions, transactions IndexedDB atomiques, verrou inter-onglets.

### Interface — ✅ livré
Thème sombre fidèle à l'esprit V1 (mêmes tons, messages positifs discrets), responsive PC/mobile (barre latérale ↔ navigation basse), tactile et clavier (Ctrl+N, Échap), vérifié en 375×812 et desktop, 0 erreur console.

### Exports — ✅ livré
Export JSON complet, export Markdown, **import JSON** (accepte les formats V2 et V1 du prototype), sauvegardes locales restaurables (restauration non destructive : ré-ajoute les notes manquantes sans écraser les récentes).

## D. Synchronisation (technique)

- **Méthode** : push/pull en une requête (`POST /api/sync`), révisions entières par utilisateur, transaction SQLite par passe. Détails : `docs/SYNC_DESIGN.md`.
- **Stockage local** : IndexedDB (notes + méta + backups).
- **Stockage cloud** : SQLite sur le serveur auto-hébergé (`server/data/`).
- **Authentification** : JWT HS256 (secret généré localement), scrypt pour les mots de passe, rate-limit sur /auth.
- **Offline-first** : le flag `dirty` EST la file d'attente — pas de journal séparé à désynchroniser.
- **Conflits** : « first writer wins + conflict copy », cas suppression/édition couverts dans les deux sens.
- **Limites** : granularité note entière (pas de fusion caractère par caractère) ; HTTP en LAN (mettre un reverse proxy HTTPS pour internet).

## E. Tests réalisés

- **Serveur** : 23/23 tests d'intégration automatisés PASS (`server/test/api.test.js`) — auth complète, sync 2 appareils, conflit, tombstones, isolation utilisateurs.
- **E2E navigateur** (2 origines = 2 appareils simulés) : 17 scénarios PASS — dont création croisée A↔B, hors ligne avec file d'attente, fermeture/réouverture offline, **conflit réel résolu par copie sans perte**, convergence finale des 2 appareils.
- **Windows** : EXE construit et lancé (fenêtre vérifiée) ; UI identique au client testé.
- **Android** : APK générée (be.hermes.notes, SDK 34, minSdk 22) et validée par aapt ; **pas de test sur téléphone physique**.
- **Bugs trouvés/corrigés en cours de test** : course auto-save ↔ sync qui fabriquait de faux conflits (corrigée par écritures atomiques + verrou inter-onglets + « rev jamais régressif ») — détail dans `docs/TEST_REPORT.md`.

## F. Défauts restants

| Priorité | Défaut |
|---|---|
| **P0** | Aucun bloquant connu sur PC. Sur Android : validation on-device manquante (voir P1). |
| **P1** | APK non testée sur téléphone réel (installation, WebView, sync LAN à confirmer). |
| **P1** | Pas de récupération de mot de passe ni de vérification d'email (nécessite SMTP). |
| **P2** | EXE non signé (avertissement SmartScreen possible) et icône Electron par défaut. |
| **P2** | APK en signature debug — passer en release signée pour distribution (procédure documentée). |
| **P2** | Le serveur nécessite Node ≥ 23.4 sur l'hôte (pas d'exe serveur autonome). |
| **P2** | Pare-feu Windows : autoriser Node sur le port 8787 pour l'accès depuis le téléphone. |

## G. Instructions utilisateur

1. **Démarrer le serveur** (une fois par session PC, nécessaire pour la sync uniquement) : double-clic sur `HermesMultiNotesLab_V2\server\start-server.bat`.
2. **Windows** : double-clic sur `HermesNotes-2.0.0-portable.exe` (Bureau). Premier lancement : SmartScreen → « Informations complémentaires » → « Exécuter quand même ».
3. **Android** : copier `HermesNotes-2.0.0-android.apk` sur le téléphone, l'ouvrir, autoriser l'installation. Dans l'app : « Serveur de synchronisation » → `http://<IP-du-PC>:8787` (trouver l'IP : `ipconfig`) → Tester → OK.
4. **Créer un compte** : email + mot de passe (min. 8 caractères) → « Créer un compte ». Utiliser **le même compte** sur PC et téléphone.
5. **Synchroniser** : automatique. La pastille en haut à droite montre l'état ; clic dessus = journal.
6. **Récupérer ses données** : menu ☰ → Exporter (JSON ou Markdown) ; sauvegardes locales : menu ☰ → Sauvegardes locales ; backups serveur : `server\data\backups\`.

*Un compte de démonstration issu des tests existe sur le serveur local (`amor.demo@hermes.local`) — il peut être ignoré ou le dossier `server/data` supprimé pour repartir à zéro.*

## H. Verdict

**« Prototype avancé mais pas encore produit »** — au sens strict : tout le cœur (client, sync, offline, conflits, comptes, EXE Windows) est **fonctionnel, testé et vérifié**, mais je refuse d'écrire « produit utilisable » tant que l'APK n'a pas tourné sur un vrai téléphone Android. C'est l'unique étape manquante : installer l'APK, entrer l'IP du PC, et dérouler les scénarios du rapport de test. Si ce test passe, le verdict devient « Produit utilisable » sans autre modification.
