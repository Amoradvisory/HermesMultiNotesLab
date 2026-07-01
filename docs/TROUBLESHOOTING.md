# Dépannage — Hermes Notes V2

## Problème rencontré : serveur non fonctionnel au premier lancement

**Cas réel (01/07/2026).** Au tout premier lancement de l'EXE Windows par l'utilisateur, la création de compte a échoué avec le message :

> **« Serveur injoignable. Vérifiez l'adresse du serveur et votre connexion. »**

*(Capture d'écran non incluse dans le repo — le message exact est celui ci-dessus, affiché en rouge sous le champ mot de passe de l'écran de connexion.)*

**Cause** : le serveur de synchronisation ne tournait pas. Il avait été lancé pendant la session de développement puis arrêté ; l'EXE, lui, ne démarre pas le serveur — ce sont deux programmes séparés.

**Correction appliquée** :
1. Démarrage du serveur : `node server.js --static ../client` (équivalent : `server\start-server.bat`).
2. Vérification : `http://127.0.0.1:8787/api/health` → `{"ok":true,...}`.
3. Nouveau clic sur « Créer un compte » → succès immédiat.
4. Pour éviter la récidive : mise en place d'un démarrage automatique du serveur à l'ouverture de session (script VBS dans `shell:startup`, procédure dans [SERVER_SETUP.md](SERVER_SETUP.md)).

**Leçon retenue** : l'app cliente est volontairement autonome (offline-first) — elle s'ouvre et fonctionne même sans serveur. L'erreur n'apparaît donc qu'au moment d'une action nécessitant le serveur (inscription, connexion, sync). Toujours vérifier le serveur en premier.

---

## Symptômes → causes → remèdes

| Symptôme | Cause probable | Remède |
|---|---|---|
| « Serveur injoignable » sur PC | Serveur non lancé | `server\start-server.bat`, puis re-tester |
| « Serveur injoignable » sur PC alors que le serveur tourne | Mauvaise URL dans l'app (champ « Serveur de synchronisation ») | Mettre `http://127.0.0.1:8787` puis « Tester la connexion » |
| Le téléphone ne se connecte pas | Pas le même Wi-Fi / IP fausse / pare-feu | Suivre les 5 étapes de [SERVER_SETUP.md](SERVER_SETUP.md#si-le-téléphone-ne-se-connecte-pas) |
| Ça marchait, plus maintenant (téléphone) | L'IP du PC a changé (DHCP) | `ipconfig` → mettre à jour l'URL dans Réglages serveur |
| Le serveur ne démarre pas : erreur `node:sqlite` | Node trop ancien (< 23.4) | Installer Node 24+ |
| `node` introuvable / `npm` bizarre | Fichier parasite `C:\Windows\System32\npm` qui masque npm | Utiliser les chemins complets `"C:\Program Files\nodejs\node.exe"` / `npm.cmd` |
| Port 8787 déjà occupé | Ancien serveur encore actif | `netstat -ano \| findstr :8787` puis `Stop-Process -Id <PID>` — ou lancer avec `--port 8788` et adapter l'URL |
| Pastille orange « erreur de sync » avec `session_expiree` | Token de 90 jours expiré | Se déconnecter/reconnecter (les notes locales sont conservées) |
| Notes en double « (copie de conflit …) » | Modifications concurrentes hors ligne — comportement **voulu** (aucune perte) | Fusionner à la main puis supprimer la copie |

## Diagnostic rapide (3 commandes)

```powershell
# 1. Le serveur répond-il ?
Invoke-WebRequest http://127.0.0.1:8787/api/health -UseBasicParsing | Select-Object -Expand Content

# 2. Qui écoute sur le port ?
netstat -ano | findstr :8787

# 3. L'IP actuelle du PC (pour le téléphone) :
ipconfig | findstr IPv4
```

## Relancer proprement

```powershell
# tout arrêter :
Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
# relancer :
cd <projet>\server
node server.js --static ../client
```

Dans l'app : pastille d'état en haut à droite → clic = journal de synchronisation (30 dernières passes, erreurs incluses) — premier réflexe pour comprendre un souci de sync.
