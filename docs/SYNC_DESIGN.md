# Conception de la synchronisation — Hermes Notes V2

## Objectifs

1. **Aucune perte de données silencieuse** — jamais.
2. Fonctionner **offline-first** : le réseau est un bonus, pas une condition.
3. Rester **simple à raisonner** : un seul endpoint (`POST /api/sync`), un seul compteur de révisions par utilisateur.

## Principe : révisions par utilisateur

Chaque utilisateur possède un compteur `seq` strictement croissant. Chaque écriture acceptée d'une note incrémente ce compteur et estampille la note (`rev = seq`). Le client mémorise :

- `lastRev` : la plus haute révision serveur qu'il a déjà vue (curseur de pull) ;
- par note : `rev` = révision serveur de la dernière version connue (= **baseRev** au push) ;
- par note : `dirty` = modifiée localement, en attente d'envoi (c'est la **file d'attente**).

## Le cycle de sync (une requête unique)

```
Client                                          Serveur
──────                                          ───────
POST /api/sync {
  clientId, lastRev,
  changes: [notes dirty avec baseRev]  ──────►  pour chaque changement :
}                                                 • note inconnue        → INSERT, rev = ++seq   → applied
                                                  • rev serveur == baseRev → UPDATE, rev = ++seq → applied
                                                  • rev serveur > baseRev  → CONFLIT, rien n'est
                                                    écrit, version serveur renvoyée
                                       ◄──────  { serverRev, applied[], conflicts[],
                                                  changes: [notes avec rev > lastRev] }
```

Le tout dans **une transaction SQLite** (`BEGIN IMMEDIATE … COMMIT`).

### Traitement de la réponse côté client

1. **applied** : `note.rev = rev` ; `dirty` levé **seulement si** la note n'a pas été re-modifiée pendant la requête (comparaison avec un instantané de `updatedAt` pris à l'envoi).
2. **conflicts** : voir ci-dessous.
3. **changes** (pull) : appliqués **uniquement si la note locale n'est pas dirty** — une note dirty n'est jamais écrasée par un pull ; c'est le prochain push qui tranchera (conflit contrôlé).
4. `lastRev = serverRev`.

Toutes les écritures locales passent par `DB.mutateNote()` : lecture + décision + écriture dans **une seule transaction IndexedDB**, ce qui élimine les courses avec l'auto-save.

## Gestion des conflits : copie de conflit, jamais d'écrasement

Un conflit = deux appareils ont modifié la même note à partir de la même base (typiquement hors ligne).

**Politique : "first writer wins + conflict copy".**

- Le premier push arrivé au serveur gagne la note d'origine.
- Le second push est refusé (`base_rev_mismatch`) ; le client :
  1. si le contenu local est identique au serveur → simple alignement de révision (aucune copie) ;
  2. sinon → crée une **« copie de conflit »** : nouvelle note (UUID neuf) contenant la version locale, titre suffixé `(copie de conflit JJ/MM/AAAA HH:mm)`, tag `conflit`, bordure orange dans l'UI ;
  3. adopte la version serveur pour la note d'origine ;
  4. la copie part au serveur à la passe suivante → visible sur **tous** les appareils.

**Résultat : les deux versions survivent toujours.** L'utilisateur fusionne à la main s'il le souhaite, puis supprime la copie.

Cas particuliers :
- *Édition locale vs suppression distante* → la suppression est conservée, l'édition locale devient copie de conflit (rien ne disparaît).
- *Suppression locale vs édition distante* → l'édition distante gagne (direction sûre : aucune donnée perdue), la corbeille locale est annulée.

## Suppression : tombstones + corbeille

- « Supprimer » pose `deletedAt` (la note va à la **corbeille**, restaurable, synchronisée comme tout le reste).
- La corbeille est purgée automatiquement après **30 jours** (ou manuellement) : purge = contenu vidé, le tombstone reste pour la propagation.
- Un tombstone se synchronise comme une note normale → la suppression atteint tous les appareils, même longtemps hors ligne.

## Déclencheurs de synchronisation

| Déclencheur | Détail |
|---|---|
| Démarrage de l'app | `syncNow('démarrage')` |
| Chaque changement local | debounce 1,5 s |
| Périodique | toutes les 60 s |
| Retour du réseau | événement `window online` |
| Manuel | bouton « Synchroniser maintenant » |
| Après résolution de conflit | re-push de la copie à +800 ms |

Un **verrou Web Locks** (`hermes-notes-sync`) sérialise les passes de sync entre onglets/fenêtres du même profil ; un `BroadcastChannel` rafraîchit l'UI des autres onglets.

## Journal et visibilité

- Pastille d'état : `hors ligne` / `synchronisation…` / `synchronisé` / `erreur` + nombre de changements en attente.
- Journal des 30 dernières passes (raison, ↑poussées, ↓reçues, conflits, erreurs) accessible en un clic.

## Limites assumées

- Granularité note entière (pas de fusion par caractère type CRDT) — la copie de conflit rend ce choix sûr.
- Horloges : les timestamps servent à l'affichage, jamais à l'arbitrage (les révisions serveur arbitrent).
- 400 changements poussés max par passe (les suivants partent à la passe d'après).
