# Statut du projet — Hermes Notes V2

**Statut actuel : Prototype avancé — PC testé, Android à tester.**
**Projet gelé le : 01/07/2026** (mis en pause volontairement, à reprendre plus tard).

## Références de reprise

| | |
|---|---|
| Repo | https://github.com/Amoradvisory/HermesMultiNotesLab |
| **Branche à utiliser** | `v2-cross-platform-sync` |
| Commit de référence (code V2 complet) | `3bbf6ae` |
| Release binaire | `v2.0.0-prototype` (EXE + APK + rapport final attachés) |
| Guide de reprise | [RESUME_LATER.md](RESUME_LATER.md) |

## Ce qui fonctionne (testé)

- **Serveur de sync local** (Node zéro dépendance) : 23/23 tests d'intégration automatisés PASS.
- **Client / EXE Windows** : testé sur le PC réel, **y compris avec un vrai compte email** (inscription + connexion via l'EXE le 01/07/2026) — fonctionne.
- **Sync multi-appareils** : validée avec deux navigateurs simulant PC et téléphone (création croisée, modifications, suppressions).
- **Offline-first** : app utilisable sans réseau, file d'attente locale, resynchronisation automatique au retour — testé.
- **Conflits** : modification concurrente → « copie de conflit », aucune perte — testé en conditions réelles.
- **Archives, corbeille + restauration, tags, recherche, tri, épinglage, exports JSON/Markdown, import, backups** : testés.

## Ce qui n'a PAS encore été testé

- **L'APK Android sur un téléphone physique.** Elle est générée, validée par `aapt` (package `be.hermes.notes`, SDK 34, minSdk 22) et attachée à la release, mais jamais installée sur un vrai appareil. Checklist prête : [ANDROID_TEST_TODO.md](ANDROID_TEST_TODO.md).
- Test de charge / gros volumes de notes.
- Signature release de l'APK et signature de l'EXE (procédures documentées, non exécutées).

## Dernières actions effectuées (01/07/2026)

1. V2 complète développée, testée et poussée (commit `3bbf6ae`).
2. EXE portable construit et vérifié ; APK debug construite et validée.
3. Test réel sur PC par l'utilisateur : premier lancement en échec (« Serveur injoignable » — le serveur ne tournait pas, voir [TROUBLESHOOTING.md](TROUBLESHOOTING.md)), résolu en démarrant le serveur ; compte email créé avec succès ensuite.
4. Documentation d'archivage ajoutée, release `v2.0.0-prototype` créée, fichiers locaux du Bureau nettoyés (le point de reprise est GitHub).

## Prochain point de reprise

**Milestone : tester l'APK sur un téléphone Android réel** en suivant [ANDROID_TEST_TODO.md](ANDROID_TEST_TODO.md). Si le test passe → verdict « Produit utilisable », puis roadmap (voir README).
