# Checklist — test Android réel (à faire à la reprise)

Objectif : valider l'APK sur un téléphone physique. Si tout passe → le verdict du projet devient **« Produit utilisable »**.

APK : release GitHub `v2.0.0-prototype` (`HermesNotes-2.0.0-android.apk`) ou rebuild via [BUILD_ANDROID.md](BUILD_ANDROID.md).

## Préparation

- [ ] Lancer le serveur sur le PC (`server\start-server.bat`) et vérifier `http://127.0.0.1:8787/api/health`
- [ ] Règle pare-feu ajoutée (terminal admin) : `netsh advfirewall firewall add rule name="Hermes Notes Sync (8787)" dir=in action=allow protocol=TCP localport=8787 profile=private`
- [ ] Trouver l'IP du PC : `ipconfig` → IPv4 du Wi-Fi
- [ ] Téléphone sur le **même Wi-Fi** que le PC
- [ ] Depuis le navigateur du téléphone : `http://<IP-du-PC>:8787/api/health` répond `{"ok":true}`

## Installation

- [ ] Copier l'APK sur le téléphone (câble, Drive…)
- [ ] Autoriser « Installer des applications inconnues » pour l'app qui ouvre l'APK
- [ ] Installer, lancer : l'écran de connexion sombre s'affiche

## Connexion

- [ ] Dérouler « Serveur de synchronisation » → saisir `http://<IP-du-PC>:8787` → « Tester la connexion » → ✓
- [ ] Se connecter avec le **même compte email** que sur PC (ou en créer un et l'utiliser des deux côtés)
- [ ] Les notes existantes du compte apparaissent, pastille « synchronisé »

## Synchronisation croisée

- [ ] Créer une note sur **PC** → elle apparaît sur **Android** (≤ 60 s ou après « Synchroniser maintenant »)
- [ ] Créer une note sur **Android** → elle apparaît sur **PC**
- [ ] Modifier une note sur Android → la modification arrive sur PC
- [ ] Supprimer une note sur PC (corbeille) → elle passe à la corbeille sur Android

## Hors ligne

- [ ] Couper le Wi-Fi du téléphone → l'app reste utilisable, notes visibles
- [ ] Créer + modifier des notes hors ligne → pastille « hors ligne (N en attente) »
- [ ] Fermer et rouvrir l'app hors ligne → tout est encore là
- [ ] Réactiver le Wi-Fi → la file part toute seule, pastille « synchronisé », notes visibles sur PC

## Conflit (optionnel mais recommandé)

- [ ] Téléphone hors ligne : modifier la note X
- [ ] Sur PC (en ligne) : modifier la même note X différemment
- [ ] Téléphone de retour en ligne → une « copie de conflit » apparaît, les deux versions existent, rien n'est perdu

## UI / confort

- [ ] Affichage correct (thème sombre, navigation basse, clavier tactile OK, pas de zoom parasite)
- [ ] Recherche, tags, archives, corbeille fonctionnent au doigt
- [ ] Export JSON depuis le téléphone fonctionne

## Consigner

- [ ] Noter chaque bug : appareil, version Android, étapes, comportement attendu/observé
- [ ] Mettre à jour [PROJECT_STATUS.md](PROJECT_STATUS.md) et [TEST_REPORT.md](TEST_REPORT.md)
- [ ] Si tout est vert : changer le verdict en « Produit utilisable » dans [FINAL_REPORT.md](FINAL_REPORT.md) et le README
