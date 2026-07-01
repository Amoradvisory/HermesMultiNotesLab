# Serveur local de synchronisation — guide complet

Le serveur est le point de rencontre entre le PC et le téléphone. **Sans lui, l'app reste utilisable hors ligne, mais rien ne se synchronise et on ne peut pas créer de compte.**

> ⚠️ **Il n'existe aucun serveur public partagé pour Hermes Notes.** Ce projet est **self-hosted** : chaque utilisateur doit lancer son propre serveur local (ce guide) **ou** brancher son propre backend. Aucune donnée n'est envoyée vers un serveur tiers ou vers le PC de qui que ce soit d'autre — l'adresse du serveur est celle que *vous* saisissez dans l'app.

## L'essentiel

| | |
|---|---|
| Emplacement | `server/server.js` (zéro dépendance, un seul fichier) |
| Lancement | double-clic `server\start-server.bat` **ou** `node server.js --static ../client` |
| Port | **8787** |
| URL locale (PC) | `http://127.0.0.1:8787` |
| URL pour Android | `http://<IP-du-PC>:8787` — ex. `http://192.168.1.10:8787` |
| Test de vie | `http://127.0.0.1:8787/api/health` → `{"ok":true,"name":"hermes-notes-sync",...}` |
| Données | `server/data/` (voir [../server/README_DATA.md](../server/README_DATA.md)) |
| Prérequis | Node.js ≥ 23.4 — aucun `npm install` |

## Trouver l'IP du PC

```powershell
ipconfig
# chercher « Carte réseau sans fil Wi-Fi » → « Adresse IPv4 » (ex. 192.168.1.10)
```
L'adresse à saisir dans l'app Android est alors `http://192.168.1.10:8787` (remplacer par TON IPv4).
⚠️ Cette IP peut changer (DHCP) — si la sync tombe en panne après un redémarrage de box, revérifier l'IP.

## Vérifier que le serveur tourne

```powershell
# Réponse attendue : {"ok":true,...}
Invoke-WebRequest http://127.0.0.1:8787/api/health -UseBasicParsing | Select-Object -Expand Content

# Qui écoute sur 8787 ?
netstat -ano | findstr :8787
```

## Arrêter le serveur

- Lancé via `start-server.bat` : fermer la fenêtre ou Ctrl+C.
- Lancé en arrière-plan :
  ```powershell
  Get-NetTCPConnection -LocalPort 8787 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess }
  ```

## Démarrage automatique avec Windows (optionnel)

Créer `HermesNotesServer.vbs` dans `shell:startup` (Win+R → `shell:startup`) :

```vbs
CreateObject("Wscript.Shell").Run """C:\Program Files\nodejs\node.exe"" ""<CHEMIN-DU-PROJET>\server\server.js"" --static ""<CHEMIN-DU-PROJET>\client""", 0, False
```

Le serveur démarre alors, invisible, à chaque ouverture de session. Pour désactiver : supprimer le fichier.

## Si le téléphone ne se connecte pas

Dans l'ordre :

1. **Le serveur tourne ?** → test de vie ci-dessus sur le PC.
2. **Même réseau ?** → le téléphone doit être sur le **même Wi-Fi** que le PC (pas en 4G/5G, pas sur le Wi-Fi invité).
3. **URL exacte ?** → `http://` (pas https), IP correcte, `:8787` à la fin, pas d'espace.
4. **Pare-feu Windows** → autoriser Node.js en entrée sur le réseau privé :
   ```powershell
   # Terminal ADMINISTRATEUR :
   netsh advfirewall firewall add rule name="Hermes Notes Sync (8787)" dir=in action=allow protocol=TCP localport=8787 profile=private
   ```
   (Sans cette règle, le PC lui-même fonctionne, mais le téléphone est bloqué.)
5. **Test croisé** : ouvrir `http://<IP-du-PC>:8787/api/health` dans le navigateur **du téléphone**. Si ça répond, l'app se connectera.

## Repartir à zéro (comptes/notes de test)

Serveur arrêté : supprimer `server/data/` → au prochain démarrage, base neuve. Le code n'est pas touché. Détails : [../server/README_DATA.md](../server/README_DATA.md).
