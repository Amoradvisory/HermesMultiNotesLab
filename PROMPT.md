# Prompt Complet - Hermes Multi-Instance Kanban Test

## Prompt Original Complet

```
Hermes, maintenant je veux tester une capacité plus avancée : le travail multi-instance coordonné depuis ton dashboard.
Contexte :
Je te parle depuis Telegram.
Ton dashboard Hermes est déjà ouvert dans ton navigateur.
Tu dois utiliser ton dashboard et ton Kanban comme centre de contrôle.
Tu peux t'écrire à toi-même dans la conversation Hermes du dashboard.
Tu peux ouvrir ou utiliser plusieurs instances/conversations Hermes si l'environnement le permet.
Chaque instance doit recevoir un rôle différent.
Tu dois ensuite regrouper les résultats et produire une synthèse finale.
Règle absolue :
Ne change jamais le modèle actuel.
Le modèle doit rester GLM 5.2.
Ne change pas de provider, ne fais pas de fallback, ne passe pas en auto-model, ne modifie aucun réglage modèle.
Objectif :
Créer un test multi-instance contrôlé, simple mais réel, pour vérifier si Hermes peut coordonner plusieurs instances de lui-même via le dashboard et le Kanban.
Projet à réaliser :
Créer une petite application locale appelée :
Hermes Multi Notes Lab
Cette application doit être mise sur le bureau dans un dossier de test clair.
Fonctions minimales :
créer une note ;
modifier une note ;
supprimer une note ;
chercher dans les notes ;
ajouter des tags ;
sauvegarder localement ;
exporter les notes en JSON ;
interface sombre, propre et lisible ;
petit message positif discret dans l'interface ;
lanceur simple depuis le bureau.
Méthode obligatoire :
Utilise le Kanban pour organiser le travail.
Crée un board ou groupe de tâches nommé :
[MULTI-HERMES-TEST] Hermes Multi Notes Lab
Ensuite, crée plusieurs tâches Kanban correspondant aux rôles suivants :
[MULTI-HERMES] Superviseur
Rôle :
organiser le projet ;
créer les tâches ;
assigner les rôles ;
vérifier que chaque instance travaille sur une partie différente ;
consolider les résultats ;
produire le rapport final.
[MULTI-HERMES] Architecte
Rôle :
définir l'architecture simple de l'application ;
choisir le format de fichiers ;
définir les critères de réussite ;
éviter toute complexité inutile.
[MULTI-HERMES] Développeur
Rôle :
créer les fichiers de l'application ;
implémenter l'interface ;
implémenter la logique de notes, tags, recherche et export JSON ;
créer le lanceur bureau.
[MULTI-HERMES] Testeur
Rôle :
ouvrir l'application ;
créer plusieurs notes ;
modifier une note ;
supprimer une note ;
tester la recherche ;
tester les tags ;
tester l'export JSON ;
fermer et rouvrir l'application ;
vérifier la persistance.
[MULTI-HERMES] Critique
Rôle :
chercher les failles ;
vérifier si le rapport du développeur est exagéré ;
identifier bugs, limites, UX faible, risques de données ;
proposer des améliorations prioritaires.
[MULTI-HERMES] Synthèse finale
Rôle :
regrouper les résultats des autres instances ;
comparer ce qui a été annoncé avec ce qui a été réellement observé ;
donner un verdict final sobre.
Si tu peux réellement ouvrir plusieurs instances/conversations Hermes :
ouvre une instance par rôle ;
donne à chaque instance uniquement sa mission ;
récupère ensuite leurs résultats ;
centralise tout dans le Kanban ou dans un fichier de rapport.
Si tu ne peux pas ouvrir plusieurs instances :
simule les rôles de manière explicite dans le Kanban ;
chaque rôle doit produire une sortie séparée ;
indique clairement que le multi-instance réel n'était pas disponible.
Contraintes :
Ne touche pas à mes vrais projets.
Ne supprime aucun fichier personnel.
Ne touche pas aux comptes, mots de passe, tokens, clés API ou paramètres sensibles.
Travaille uniquement dans un dossier de test sur le bureau.
Ne crée pas de boucle infinie.
Ne crée pas plus de 5 instances Hermes.
Ne laisse aucune instance tourner sans objectif clair.
Chaque instance doit produire un résultat fini.
Le superviseur doit consolider, pas déléguer à l'infini.
Dossier attendu :
C:\Users\A\Desktop\HermesMultiNotesLab
Livrables attendus :
application locale fonctionnelle ;
fichiers sources ;
lanceur bureau ;
export JSON testé ;
board Kanban rempli ;
rôles séparés ;
rapport final consolidé.
Rapport final obligatoire :
A. Multi-instance
Plusieurs instances ouvertes : oui/non
Nombre d'instances :
Rôles réellement utilisés :
Résultats récupérés :
Limites observées :
B. Kanban
Board créé :
Tâches créées :
Tâches lancées :
Tâches déplacées :
Dispatcher utilisé : oui/non
Bulk actions utilisées : oui/non
Persistance après refresh : oui/non
C. Application
Chemin du projet :
Chemin du lanceur :
Fonctionnalités réussies :
Fonctionnalités échouées :
Bugs observés :
D. Consolidation
Pour chaque rôle :
contribution réelle ;
résultat produit ;
utilité ;
fiabilité.
E. Verdict
Choisis une seule option :
"Multi-instance confirmé"
"Multi-instance partiellement confirmé"
"Multi-instance non confirmé"
Puis explique en une phrase pourquoi.
Important :
Je veux tester la coordination multi-instance réelle, pas seulement la création d'une application. L'application est un prétexte. Le vrai objectif est de voir si Hermes peut se distribuer le travail, récupérer les résultats, les comparer et produire une synthèse fiable.
```

## Introduction

Ce prompt a été conçu pour forcer Hermes à utiliser son dashboard, son Kanban, des rôles séparés et une consolidation finale. L'objectif était de tester si Hermes peut orchestrer un workflow complexe en se coordonnant lui-même, plutôt que de simplement répondre à une demande directe.

## Note Importante sur le Modèle

**Le modèle devait rester GLM 5.2 tout au long de l'expérience.** Cette contrainte était cruciale pour :
- Garantir la cohérence de l'expérience
- Éviter les changements de configuration pendant l'exécution
- S'assurer que les résultats soient reproductibles
- Tester les capacités d'Hermes avec un modèle fixé

Le prompt verrouillait explicitement le modèle pour s'assurer que l'expérience se déroule dans des conditions contrôlées, sans que Hermes ne puisse changer de provider ou passer en auto-model.