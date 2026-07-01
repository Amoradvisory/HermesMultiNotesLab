# Build Android (APK) — Hermes Notes V2

## Prérequis

- Node.js ≥ 20 et npm
- JDK 17 (`JAVA_HOME` pointant dessus)
- Android SDK avec `platforms;android-34` et `build-tools;34.0.0` (`ANDROID_HOME` défini)
- Le projet `mobile/android/` est généré par Capacitor (non versionné : régénérable)

## Construire l'APK (debug, installable)

```powershell
cd mobile
npm install                       # @capacitor/core + @capacitor/android + CLI (v6)
node ..\scripts\copy-www.mjs mobile
npx cap add android               # première fois uniquement (génère mobile/android/)
npx cap sync android              # copie www/ + config dans le projet natif
cd android
.\gradlew.bat assembleDebug
```

**Résultat : `mobile/android/app/build/outputs/apk/debug/app-debug.apk`** — signée avec la clé de debug Android, directement installable.

## Installer sur le téléphone

1. Copier l'APK sur le téléphone (câble USB, Drive, etc.) **ou** `adb install app-debug.apk`.
2. Sur le téléphone : ouvrir le fichier → autoriser « Installer des applications inconnues » pour l'app utilisée.
3. Ouvrir **Hermes Notes** → dérouler « Serveur de synchronisation » → saisir l'adresse du PC, ex. `http://192.168.1.10:8787` → « Tester la connexion » → se connecter.

> Le téléphone et le PC doivent être sur le même réseau (ou le serveur accessible via internet/VPN type Tailscale).
> Pare-feu Windows : autoriser Node.js sur le port 8787 en réseau privé si le test de connexion échoue.

## Version release (optionnel, pour distribution)

```powershell
# 1. Générer une clé (À CONSERVER, JAMAIS dans le repo) :
keytool -genkeypair -v -keystore C:\Users\A\.hermes\keys\hermes-notes.keystore `
  -alias hermes-notes -keyalg RSA -keysize 2048 -validity 10000

# 2. mobile/android/keystore.properties (gitignoré) :
#    storeFile=C:/Users/A/.hermes/keys/hermes-notes.keystore
#    storePassword=...  keyAlias=hermes-notes  keyPassword=...

# 3. Déclarer le signingConfig dans app/build.gradle puis :
.\gradlew.bat assembleRelease
```

## Notes techniques

- `capacitor.config.json` : `server.cleartext: true` + `allowMixedContent` autorisent l'app (WebView `https://localhost`) à parler au serveur en HTTP sur le LAN. Pour un serveur exposé en HTTPS, ces options peuvent être remises à `false`.
- Le stockage local de l'app est l'IndexedDB de la WebView : les notes restent disponibles hors ligne et survivent aux redémarrages. Désinstaller l'app efface ce stockage local (les notes restent sur le serveur).
- Capacitor 6 cible compileSdk 34 / minSdk 22 (Android 5.1+).
