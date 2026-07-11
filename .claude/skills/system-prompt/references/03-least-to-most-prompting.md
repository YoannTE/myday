# Least-to-Most Prompting

## Définition

Least-to-Most prompting est une stratégie qui décompose systématiquement un problème complexe en une série de sous-problèmes plus simples, résolus séquentiellement du plus simple au plus complexe. Chaque solution devient un élément de construction pour résoudre le problème suivant, créant une progression naturelle vers la solution finale.

## Comment ça fonctionne

### Processus en deux phases

```
Phase 1: Décomposition
┌─────────────────┐
│ Problème Global │
└────────┬────────┘
         │
    Décomposer
         │
         ▼
┌──────────────────┐
│ Sous-problème 1  │ (le plus simple)
│ Sous-problème 2  │
│ Sous-problème 3  │
│ ...              │
│ Sous-problème N  │ (le plus complexe)
└──────────────────┘

Phase 2: Résolution Progressive
SP1 → Solution1
SP2 + Solution1 → Solution2
SP3 + Solution2 → Solution3
...
SPN + SolutionN-1 → Solution Finale
```

### Algorithme d'implémentation

1. **Passer le problème original** au prompt de décomposition
2. **Obtenir la liste** des sous-problèmes ordonnés
3. **Pour chaque sous-problème** :
   - Construire un prompt incluant les solutions précédentes
   - Obtenir la solution du LLM
   - Ajouter à l'ensemble des solutions
4. **Combiner** toutes les solutions pour la réponse finale

## Avantages

- **Performance exceptionnelle** : 76% vs 6% de succès sur SCAN, 99.7% avec code-davinci
- **Généralisation robuste** : Résout des problèmes plus difficiles que ceux des exemples
- **Réduction cognitive** : Chaque étape est simple individuellement
- **Construction progressive** : Capitalise sur les solutions intermédiaires
- **Traçabilité** : Chemin de résolution clair et vérifiable
- **Adaptabilité** : Fonctionne sur domaines variés (maths, code, langue)

## Inconvénients

- **Overhead pour tâches simples** : Inutilement complexe pour problèmes directs
- **Latence cumulative** : Multiples appels LLM augmentent le temps total
- **Décomposition manuelle** : Nécessite expertise pour bien découper
- **Propagation d'erreurs** : Erreur précoce impacte toutes les étapes suivantes
- **Coût en tokens** : Plus cher que résolution directe
- **Dépendances rigides** : Ordre des sous-problèmes critique

## Quand l'utiliser

- **Problèmes compositionnels** : Tâches construites sur blocs élémentaires
- **Généralisation nécessaire** : Cas plus complexes que les exemples
- **Apprentissage progressif** : Quand la complexité augmente graduellement
- **Dépendances claires** : Relations évidentes entre sous-parties
- **Domaines structurés** : Programmation, mathématiques, logique formelle
- **Échecs avec approche directe** : Quand CoT simple ne suffit pas

## Quand ne PAS l'utiliser

- **Tâches atomiques** : Pas de décomposition naturelle possible
- **Urgence** : Contraintes de temps strictes
- **Problèmes créatifs** : Génération libre sans structure
- **Interdépendances complexes** : Sous-problèmes trop entrelacés
- **Overhead injustifié** : Problème déjà simple
- **Budget limité** : Contraintes sur utilisation tokens

## Exemples d'implémentation

### Template de Décomposition

```markdown
Problème : [PROBLÈME COMPLEXE]

Décompose ce problème en sous-problèmes plus simples,
ordonnés du plus facile au plus difficile.
Chaque sous-problème doit pouvoir utiliser les solutions précédentes.

Format :

1. [Sous-problème le plus simple]
2. [Sous-problème suivant]
   ...
   N. [Sous-problème final qui donne la solution complète]
```

### Template de Résolution Progressive

```markdown
Context : Nous résolvons "[PROBLÈME ORIGINAL]" étape par étape.

Solutions déjà obtenues :

- Sous-problème 1 : [SOLUTION 1]
- Sous-problème 2 : [SOLUTION 2]
  ...

Maintenant, résous :
Sous-problème N : [SOUS-PROBLÈME ACTUEL]

En utilisant les solutions précédentes si nécessaire.
```

### Exemple Concret Générique

```markdown
Problème : "Calculer le coût total d'un projet avec remises conditionnelles"

Décomposition :

1. Calculer le coût de base des composants
2. Appliquer les remises volume
3. Ajouter les taxes applicables
4. Calculer le coût total avec toutes les conditions

Résolution :
Étape 1 : Coût base = 1000€
Étape 2 : Avec remise 10% = 900€
Étape 3 : Avec taxe 20% = 1080€
Étape 4 : Total final = 1080€
```

## Métriques de Performance

### Benchmarks Clés

- **SCAN** (compositional generalization) : 6% → 76% (standard prompting vs L2M)
- **Code generation** : 76% → 99.7% avec modèles optimisés
- **Math word problems** : Amélioration de 40-50 points
- **Symbolic manipulation** : 3x meilleure généralisation

### Comparaison avec autres techniques

| Technique | Tâches Simples | Tâches Complexes | Généralisation |
| --------- | -------------- | ---------------- | -------------- |
| Direct    | ⭐⭐⭐⭐⭐     | ⭐               | ⭐             |
| CoT       | ⭐⭐⭐⭐       | ⭐⭐⭐           | ⭐⭐           |
| L2M       | ⭐⭐           | ⭐⭐⭐⭐⭐       | ⭐⭐⭐⭐⭐     |

## Combinaisons avec d'autres techniques

- **L2M + CoT** : Raisonnement détaillé sur chaque sous-problème
- **L2M + Self-Consistency** : Multiples décompositions votent
- **L2M + Verification** : Valider chaque étape intermédiaire
- **L2M + APE** : Optimiser automatiquement la décomposition

## Best Practices

1. **Décomposition claire** : Sous-problèmes vraiment indépendants
2. **Ordre logique** : Progression naturelle de complexité
3. **Context carrying** : Transmettre toutes solutions pertinentes
4. **Validation intermédiaire** : Vérifier cohérence à chaque étape
5. **Granularité adaptée** : Ni trop fin, ni trop grossier

## Patterns de Décomposition

### Pattern Séquentiel

```
A → B → C → D
Chaque étape dépend de la précédente
```

### Pattern Hiérarchique

```
    A
   / \
  B   C
   \ /
    D
Fusion de branches indépendantes
```

### Pattern Accumulation

```
A
A + B
A + B + C
Chaque étape ajoute au résultat
```

## Pièges Courants

1. **Sur-décomposition** : Trop de micro-étapes inutiles
2. **Mauvais ordre** : Dépendances non respectées
3. **Context loss** : Oublier de transmettre infos cruciales
4. **Décomposition biaisée** : Forcer une structure inadaptée
5. **Validation insuffisante** : Ne pas vérifier cohérence globale

## Évolution et Recherche

- **Auto-décomposition** : LLM génère sa propre décomposition
- **Décomposition adaptative** : Ajustement dynamique de granularité
- **Parallel L2M** : Résolution parallèle de branches indépendantes
- **Hierarchical L2M** : Décomposition multi-niveaux récursive

## Cas d'Usage Industriels

- **Génération de code** : Fonctions → Modules → Application
- **Analyse de documents** : Phrases → Paragraphes → Document complet
- **Planification** : Tâches → Phases → Projet complet
- **Apprentissage** : Concepts → Chapitres → Cours complet
