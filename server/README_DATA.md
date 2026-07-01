# server/data — données locales du serveur (JAMAIS versionnées)

Le dossier `server/data/` est **créé automatiquement au premier démarrage** du serveur et est exclu de Git (`.gitignore`). Il contient des données réelles et sensibles :

| Fichier | Contenu |
|---|---|
| `hermes-notes.db` (+ `-wal`, `-shm`) | Base SQLite : comptes utilisateurs (emails + hash scrypt) et notes |
| `secret.key` | Secret JWT (64 octets aléatoires) — le régénérer invalide toutes les sessions |
| `backups/` | Copies automatiques de la base (14 max, une par démarrage) |

## Repartir à zéro (sans toucher au code)

```powershell
# serveur arrêté :
Remove-Item -Recurse -Force server\data
# au prochain démarrage : base vide + nouveau secret. Tous les comptes/notes locaux sont perdus.
```

## Règles

- **Ne jamais commiter ce dossier** (même pour un « exemple ») : il contient des emails réels et des hashes de mots de passe.
- Pour donner un exemple de structure, ce fichier README suffit — la base se régénère toute seule.
- Sauvegarde : copier le dossier complet `server/data/` (serveur arrêté) suffit à tout restaurer.
