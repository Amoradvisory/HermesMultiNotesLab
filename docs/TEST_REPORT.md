# Rapport de test — Hermes Notes V2

Date : 01/07/2026 · Environnement : Windows 10 Pro, Node 24.15, Chrome (préviews pilotées), Electron 33.4.11.

## 1. Tests d'intégration du serveur (automatisés)

Script : `server/test/api.test.js` (zéro dépendance, démarre un serveur éphémère sur port 8891).

**Résultat : 23 PASS / 0 FAIL.**

| Domaine | Cas couverts | Résultat |
|---|---|---|
| Santé | `/api/health` | ✅ |
| Inscription | email invalide, mot de passe court, création, doublon (409) | ✅ |
| Connexion | succès, mauvais mot de passe (401) | ✅ |
| Session | `/api/me` avec/sans token | ✅ |
| Sync 2 appareils | push A → pull B, modification A → B | ✅ |
| **Conflit** | 2 modifications concurrentes : 2ᵉ push rejeté `base_rev_mismatch`, version serveur renvoyée, **rien d'écrasé** | ✅ |
| Suppression | tombstone `deletedAt` propagé à l'autre appareil | ✅ |
| **Isolation** | utilisateur 2 ne voit aucune note de l'utilisateur 1 (et inversement) | ✅ |
| Auth | sync sans token → 401 | ✅ |

## 2. Tests E2E du client (navigateur réel, deux « appareils » simulés)

Méthode : serveur lancé avec le client statique ; deux origines (`localhost:8787` = appareil A, `127.0.0.1:8787` = appareil B) → deux IndexedDB indépendantes, comme deux machines distinctes.

| # | Scénario | Résultat |
|---|---|---|
| 1 | Inscription depuis l'UI, arrivée dans l'app, pastille `synchronisé` | ✅ |
| 2 | Création de note sur A (titre, contenu, tags) → poussée automatiquement | ✅ |
| 3 | Connexion sur B → la note de A apparaît (pull au démarrage) | ✅ |
| 4 | Création de note sur B → visible sur A après sync | ✅ |
| 5 | **Session persistante** : retour sur A sans re-login | ✅ |
| 6 | **Hors ligne sur B** (serveur injoignable) : création + modification → pastille `hors ligne (2 en attente)` | ✅ |
| 7 | Fermeture/réouverture de l'app hors ligne : données et file d'attente intactes | ✅ |
| 8 | Pendant ce temps, A modifie la même note en ligne (rev 5) | ✅ |
| 9 | **Retour en ligne de B** : note offline poussée (rev 6) ; modification concurrente → **copie de conflit** (rev 7, tag `conflit`) ; version de A conservée ; **aucune perte** | ✅ |
| 10 | Convergence : A reçoit la note offline ET la copie de conflit (4 notes identiques des deux côtés) | ✅ |
| 11 | Archivage → disparaît de « Notes », apparaît dans « Archivées » (défaut V1 corrigé) | ✅ |
| 12 | Corbeille → restauration (`deletedAt` remis à null) | ✅ |
| 13 | Recherche plein texte (contenu) → résultat exact | ✅ |
| 14 | Filtre par tag (`conflit`) + bannière de filtre actif | ✅ |
| 15 | Épinglage → tri en tête + icône 📌 | ✅ |
| 16 | Responsive mobile 375×812 : navigation basse, cartes 1 colonne, FAB | ✅ (capture vérifiée) |
| 17 | Console navigateur | ✅ 0 erreur, 0 warning |

### Bugs trouvés et corrigés pendant les tests

1. **Faux conflits multi-onglets / course auto-save↔sync** : l'éditeur gardait un objet en mémoire avec une révision périmée ; l'auto-save pouvait réécrire `rev: 0` après un push réussi → le push suivant partait avec un `baseRev` obsolète et fabriquait une copie de conflit injustifiée.
   *Correctifs* : écritures atomiques `mutateNote()` (une transaction IndexedDB par lecture-modification-écriture), règle « la révision ne régresse jamais », verrou inter-onglets Web Locks, `BroadcastChannel` pour rafraîchir les autres fenêtres. **Re-testé : disparu.**

## 3. Windows (EXE)

| Test | Résultat |
|---|---|
| Build `electron-builder --win portable` | ✅ `HermesNotes-2.0.0-portable.exe` (70,8 Mo) |
| Lancement de l'EXE → fenêtre « Hermes Notes » ouverte | ✅ (processus vérifié) |
| UI complète dans l'EXE | ✅ par équivalence : même code client que les tests E2E ci-dessus (Chromium embarqué) |

## 4. Android (APK)

| Test | Résultat |
|---|---|
| Génération projet Capacitor 6 + `cap sync` | ✅ |
| Build Gradle `assembleDebug` (SDK 34, JDK 17) | voir rapport final |
| Installation et tests sur téléphone physique | ⚠️ **non testé** — aucun appareil Android disponible pendant la session. L'UI et la sync sont identiques au client testé ; la validation on-device reste à faire (voir Limites). |

## 5. Limites des tests

- Pas de test sur téléphone Android réel (APK générée mais non installée sur appareil).
- Export JSON/Markdown et import JSON vérifiés fonctionnellement en code, pas via téléchargement de bout en bout dans la préview.
- Pas de test de charge (des centaines de notes simultanées) ni de test multi-utilisateurs concurrents au-delà des tests d'intégration.
