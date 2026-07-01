# Note d'archivage — 01/07/2026

Ce projet est **volontairement mis en pause** à l'état de prototype avancé fonctionnel.

- **Le point de reprise unique est GitHub** : branche `v2-cross-platform-sync` (code + documentation complète) et release `v2.0.0-prototype` (EXE Windows, APK Android, rapport final).
- **Les fichiers locaux du Bureau du PC de développement ont été supprimés** après vérification que GitHub contenait tout : code source, documentation, guides de reprise, rapport final et binaires (en release). Les données locales du serveur (`server/data` : comptes et notes de test) n'ont pas été publiées — elles sont sensibles par nature et régénérables.
- **Pourquoi une pause** : le cœur du produit est terminé et validé sur PC ; la seule étape significative restante (test de l'APK sur téléphone Android réel) nécessite une session dédiée avec l'appareil physique.
- **Priorités à la reprise** :
  1. Test Android réel — checklist prête : [ANDROID_TEST_TODO.md](ANDROID_TEST_TODO.md) ;
  2. Corrections éventuelles issues de ce test ;
  3. Améliorations produit (roadmap du README : récupération de mot de passe, builds signés, HTTPS/hébergement distant).

Pour reprendre : lire [RESUME_LATER.md](RESUME_LATER.md) — il contient tout, de `git clone` jusqu'au test de synchronisation PC ↔ Android.
