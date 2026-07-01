# Reprendre le projet plus tard — guide pas à pas

Ce guide part de zéro : un PC (Windows) sans le projet, et GitHub comme unique source.

## 1. Cloner et se placer sur la bonne branche

```powershell
git clone https://github.com/Amoradvisory/HermesMultiNotesLab.git
cd HermesMultiNotesLab
git checkout v2-cross-platform-sync
```

> `master` = prototype V1 (Python) + expérience Hermes. **Tout le produit V2 est sur `v2-cross-platform-sync`.**

## 2. Prérequis machine

| Outil | Version | Pour quoi |
|---|---|---|
| Node.js | ≥ 23.4 (idéal : 24) | Serveur (node:sqlite intégré) + builds |
| JDK | 17 | Build APK uniquement |
| Android SDK | platforms;android-34 + build-tools;34.0.0 | Build APK uniquement |

⚠️ Piège connu sur le PC d'origine : un fichier parasite `C:\Windows\System32\npm` masque npm — utiliser le chemin complet `"C:\Program Files\nodejs\npm.cmd"` si `npm` ne répond pas.

## 3. Lancer le serveur de synchronisation

```powershell
cd server
node server.js --static ../client     # ou double-clic sur start-server.bat
# Vérification : http://127.0.0.1:8787/api/health doit répondre {"ok":true,...}
```

Aucun `npm install` nécessaire (zéro dépendance). Détails, pare-feu, IP, données : [SERVER_SETUP.md](SERVER_SETUP.md).

## 4. Utiliser / développer l'app sur PC

- **Sans rien installer** : ouvrir `http://127.0.0.1:8787` dans un navigateur (le serveur sert le client).
- **App Electron en dev** :
  ```powershell
  cd desktop
  npm install
  npm run start
  ```

## 5. Reconstruire l'EXE Windows

```powershell
cd desktop
npm install
npm run build      # -> desktop/dist/HermesNotes-2.0.0-portable.exe
```
Détails et pièges (winCodeSign/symlinks déjà contournés) : [BUILD_WINDOWS.md](BUILD_WINDOWS.md).

## 6. Reconstruire l'APK Android

```powershell
cd mobile
npm install
node ..\scripts\copy-www.mjs mobile
npx cap add android        # première fois (le dossier android/ n'est pas versionné)
npx cap sync android
cd android
.\gradlew.bat assembleDebug   # -> app\build\outputs\apk\debug\app-debug.apk
```
Détails : [BUILD_ANDROID.md](BUILD_ANDROID.md).

> Pas envie de rebuilder ? L'EXE et l'APK du 01/07/2026 sont attachés à la release **`v2.0.0-prototype`** sur GitHub.

## 7. Tester la synchro PC ↔ Android

Suivre la checklist complète : [ANDROID_TEST_TODO.md](ANDROID_TEST_TODO.md). En résumé : serveur lancé sur le PC → APK installée → adresse `http://<IP-du-PC>:8787` dans l'app → même compte email des deux côtés → notes croisées + test hors ligne.

## 8. Ce qu'il reste à faire (dans l'ordre)

1. **Test Android réel** (la seule étape avant le verdict « Produit utilisable »).
2. Corriger ce que le test révèle, le cas échéant.
3. P1 : récupération de mot de passe / vérification email (nécessite SMTP).
4. P2 : APK signée release, EXE signé + icône, exe serveur autonome, HTTPS pour exposition internet.
5. Roadmap complète : voir README section *Roadmap*.

## Comprendre le code rapidement

- Architecture et choix : [ARCHITECTURE.md](ARCHITECTURE.md)
- Protocole de sync + conflits : [SYNC_DESIGN.md](SYNC_DESIGN.md)
- Mode hors ligne : [OFFLINE_MODE.md](OFFLINE_MODE.md)
- Ce qui a été testé (et comment) : [TEST_REPORT.md](TEST_REPORT.md)
- Bilan complet du projet : [FINAL_REPORT.md](FINAL_REPORT.md)
