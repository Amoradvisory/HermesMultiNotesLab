# Build Windows (EXE) — Hermes Notes V2

## Prérequis

- Node.js ≥ 20 et npm (testé avec Node 24 / npm 11)
- Connexion internet (electron-builder télécharge les binaires Electron au premier build)

## Construire l'EXE portable

```powershell
cd desktop
npm install
npm run build
```

Le script :
1. copie `client/` → `desktop/www/` (`scripts/copy-www.mjs`) ;
2. lance `electron-builder --win portable`.

**Résultat : `desktop/dist/HermesNotes-2.0.0-portable.exe`** (~70 Mo, autonome, aucune installation requise).

## Lancer en mode développement (sans packager)

```powershell
cd desktop
npm run start
```

## Notes de build

- `signAndEditExecutable: false` est activé dans `desktop/package.json` : on ne signe pas l'exécutable (pas de certificat), et cela évite l'étape winCodeSign qui exige le privilège « liens symboliques » sous Windows. Conséquence : icône Electron par défaut et avertissement SmartScreen possible au premier lancement (cliquer « Informations complémentaires » → « Exécuter quand même »).
- Pour une icône personnalisée : ajouter `desktop/build/icon.ico` puis `"win": { "icon": "build/icon.ico" }` (nécessite de réactiver `signAndEditExecutable`, donc le mode développeur Windows ou un terminal administrateur).
- Cible `portable` = un seul fichier .exe. Pour un installateur : remplacer `"target": ["portable"]` par `["nsis"]`.

## Utilisation

1. Démarrer le serveur de sync quelque part (`server/start-server.bat` sur ce PC, ou un VPS).
2. Double-cliquer sur l'EXE.
3. Première fois : dérouler « Serveur de synchronisation » si le serveur n'est pas sur `http://127.0.0.1:8787`, puis créer un compte ou se connecter.
4. Les données locales de l'app vivent dans `%APPDATA%\hermes-notes-desktop` (profil Electron / IndexedDB).
