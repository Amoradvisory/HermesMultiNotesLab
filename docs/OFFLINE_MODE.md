# Mode hors ligne — Hermes Notes V2

## Principe : IndexedDB est la source de vérité

Chaque action utilisateur (créer, modifier, archiver, supprimer, restaurer…) est **d'abord écrite dans IndexedDB** avec le drapeau `dirty`. L'interface lit exclusivement IndexedDB. Le réseau n'est sollicité qu'ensuite, par le moteur de sync. Conséquence : l'application se comporte exactement pareil avec ou sans internet — seule la pastille d'état change.

## Ce qui marche sans internet (après la première connexion)

| Action | Hors ligne |
|---|---|
| Ouvrir l'application | ✅ (session persistante : token stocké localement, 90 jours) |
| Voir toutes ses notes déjà synchronisées | ✅ |
| Créer / modifier / archiver / restaurer / corbeille | ✅ (mis en file d'attente) |
| Rechercher, filtrer par tag, trier, épingler | ✅ (tout est local) |
| Exporter JSON / Markdown, sauvegardes locales | ✅ |
| Fermer puis rouvrir l'application | ✅ (les données et la file d'attente persistent) |
| S'inscrire / se connecter pour la première fois | ❌ (le serveur doit être joignable une fois) |

## La file d'attente locale

Il n'y a pas de file séparée : **toute note `dirty` EST la file d'attente**. C'est robuste par construction :

- pas de journal à rejouer ni de risque de désynchronisation entre « la file » et « les données » ;
- plusieurs modifications hors ligne de la même note = un seul envoi (l'état final) ;
- la pastille affiche `hors ligne (N en attente)` tant que des changements attendent.

## Retour du réseau

Déclenché par l'événement `online`, la passe périodique (60 s) ou un changement :

1. **Push** : toutes les notes `dirty` partent avec leur `baseRev`.
2. **Pull** : le serveur renvoie tout ce qui a changé depuis `lastRev` (autres appareils inclus).
3. **Fusion** : les nouveautés distantes s'appliquent aux notes non-dirty ; les modifications concurrentes deviennent des **copies de conflit** (voir [SYNC_DESIGN.md](SYNC_DESIGN.md)) — aucune perte.
4. La pastille repasse à `synchronisé`.

## Détection de l'état réseau

- Erreur `fetch`/timeout vers le serveur → état `hors ligne (serveur injoignable)` : couvre à la fois la coupure internet et le serveur éteint.
- `navigator.onLine` et les événements `online`/`offline` affinent l'affichage et déclenchent la reprise.
- Chaque échec est consigné dans le journal de synchronisation.

## Scénario vérifié en test (voir TEST_REPORT.md)

1. Appareil B passe hors ligne → crée une note + modifie une note existante → pastille `hors ligne (2 en attente)` ✅
2. B ferme/rouvre l'app hors ligne → données et file intactes ✅
3. Pendant ce temps, appareil A modifie la même note en ligne ✅
4. B retrouve le réseau → sa nouvelle note part (rev 6), sa modification concurrente devient une copie de conflit (rev 7), la version de A est conservée ✅
5. A reçoit la note offline de B **et** la copie de conflit ✅ — convergence totale, zéro perte.
