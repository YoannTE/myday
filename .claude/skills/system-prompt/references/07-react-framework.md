# ReAct Framework (Reasoning and Acting)

## Définition

ReAct est un paradigme qui synergise le raisonnement (Reasoning) et l'action (Acting) dans les LLM en générant des traces de raisonnement verbalisées et des actions spécifiques de manière entrelacée. Cette approche permet aux modèles de planifier dynamiquement, d'interagir avec leur environnement et d'ajuster leur stratégie basée sur les observations.

## Comment ça fonctionne

### Cycle ReAct

```
┌─────────────┐
│   Question  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│         THOUGHT (Raisonnement)      │
│ "Pour résoudre ceci, je dois..."    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│         ACTION (Action)             │
│ Exécuter: search("information")     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      OBSERVATION (Résultat)         │
│ "J'ai trouvé que..."                │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌──────┴──────┐
        │ Terminé ?   │
        └──────┬──────┘
          Non  │  Oui
          │    │   │
          │    │   ▼
          │    │ ┌─────────┐
          └────┘ │ Réponse │
                 └─────────┘
```

### Structure d'un cycle ReAct

```
Thought 1: J'ai besoin de comprendre X pour répondre à cette question
Action 1: search[X]
Observation 1: X est défini comme...

Thought 2: Maintenant je dois vérifier si Y est lié à X
Action 2: lookup[Y]
Observation 2: Y est effectivement...

Thought 3: Avec ces informations, je peux conclure que...
Action 3: calculate[...]
Observation 3: Le résultat est...

Final Answer: Basé sur mes recherches et calculs...
```

## Avantages

- **Adaptabilité dynamique** : Ajustement en temps réel basé sur observations
- **Transparence** : Raisonnement explicite à chaque étape
- **Gestion d'exceptions** : Peut détecter et corriger erreurs en cours
- **Performance supérieure** : +34% sur ALFWorld, +10% sur WebShop
- **Réduction hallucinations** : Vérification factuelle via actions
- **Human-like reasoning** : Approche similaire à résolution humaine

## Inconvénients

- **Latence accrue** : Multiple cycles thought-action-observation
- **Dépendance aux outils** : Limité par actions disponibles
- **Coût computationnel** : Plus de tokens et d'appels API
- **Complexité d'implémentation** : Nécessite infrastructure d'actions
- **Propagation d'erreurs** : Mauvaise action peut dérailler processus
- **Verbosité** : Peut générer trop de détails intermédiaires

## Quand l'utiliser

- **Agents autonomes** : Systèmes devant opérer indépendamment
- **Recherche d'information** : Quêtes nécessitant exploration
- **Résolution de problèmes** : Tâches requérant essai-erreur
- **Fact-checking** : Vérification avec sources externes
- **Planification adaptative** : Plans devant évoluer dynamiquement
- **Interactions complexes** : Navigation dans environnements riches

## Quand ne PAS l'utiliser

- **Réponses directes** : Questions avec réponses immédiates
- **Créativité pure** : Génération artistique sans contraintes
- **Latence critique** : Applications temps réel strict
- **Actions limitées** : Peu d'outils externes disponibles
- **Budget contraint** : Coût élevé en tokens/API calls
- **Tâches déterministes** : Processus avec chemin unique connu

## Exemples d'implémentation

### Template ReAct de base

```markdown
Question: [QUESTION]

Thought 1: [Que dois-je savoir/faire en premier?]
Action 1: [ACTION_TYPE][paramètres]
Observation 1: [Résultat de l'action]

Thought 2: [Basé sur observation 1, quelle est la prochaine étape?]
Action 2: [ACTION_TYPE][paramètres]
Observation 2: [Résultat]

...continuer jusqu'à avoir assez d'information...

Final Answer: [Réponse complète basée sur toutes les observations]
```

### Actions Types Communs

```python
# Actions disponibles
search[query] - Recherche d'information
calculate[expression] - Calculs mathématiques
lookup[entity] - Recherche dans base de connaissances
verify[claim] - Vérification de fait
compare[A, B] - Comparaison d'éléments
extract[source, pattern] - Extraction de données
```

### Exemple Concret

```markdown
Q: Quel est le PIB par habitant du pays avec la plus grande superficie?

Thought 1: Je dois d'abord identifier le pays avec la plus grande superficie
Action 1: search["plus grand pays du monde superficie"]
Observation 1: La Russie est le plus grand pays avec 17.1 millions km²

Thought 2: Maintenant je dois trouver le PIB par habitant de la Russie
Action 2: search["PIB par habitant Russie 2024"]
Observation 2: Le PIB par habitant de la Russie est de 13,000 USD

Final Answer: Le pays avec la plus grande superficie est la Russie,
et son PIB par habitant est d'environ 13,000 USD.
```

## Métriques de Performance

### Benchmarks Clés

- **HotpotQA** (QA multi-hop) : Réduction hallucinations de 50%
- **Fever** (fact verification) : Amélioration précision de 25%
- **ALFWorld** (text games) : 34% meilleur que baselines
- **WebShop** (web navigation) : 10% supérieur aux méthodes RL

### Comparaison Approaches

| Méthode  | Raisonnement | Action     | Adaptabilité | Interprétabilité |
| -------- | ------------ | ---------- | ------------ | ---------------- |
| CoT only | ⭐⭐⭐⭐⭐   | ❌         | ⭐⭐         | ⭐⭐⭐⭐         |
| Act only | ⭐           | ⭐⭐⭐⭐⭐ | ⭐⭐⭐       | ⭐⭐             |
| ReAct    | ⭐⭐⭐⭐     | ⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐       |

## Types de Reasoning Traces

1. **Décomposition de tâches** : Breaking down en sous-objectifs
2. **Injection de connaissances** : Ajout de contexte pertinent
3. **Extraction d'information** : Focus sur parties importantes
4. **Tracking de progrès** : Suivi de ce qui est accompli
5. **Gestion d'exceptions** : Ajustement quand blocage détecté

## Combinaisons avec d'autres techniques

- **ReAct + CoT** : Raisonnement approfondi avant chaque action
- **ReAct + Few-Shot** : Exemples de cycles thought-action
- **ReAct + Self-Consistency** : Multiple trajectoires votent
- **ReAct + Memory** : Persistance d'observations entre sessions

## Best Practices

1. **Actions atomiques** : Une action = une opération claire
2. **Thoughts concis** : Raisonnement focalisé sur prochaine étape
3. **Observation parsing** : Extraire l'essentiel des résultats
4. **Exit conditions** : Critères clairs pour terminer
5. **Error recovery** : Plans B quand actions échouent

## Patterns Avancés

### Multi-Agent ReAct

```markdown
Agent 1: Recherche générale
Agent 2: Validation des faits
Agent 3: Synthèse finale
Coordination via observations partagées
```

### Hierarchical ReAct

```markdown
High-level: Planification stratégique
Mid-level: Tactiques spécifiques
Low-level: Actions atomiques
```

### Parallel ReAct

```markdown
Thought: Plusieurs informations nécessaires
Actions parallèles: search[A], search[B], search[C]
Observations: Fusion des résultats
```

## Pièges Courants

1. **Action loops** : Répéter mêmes actions sans progrès
2. **Over-thinking** : Trop de thoughts sans action
3. **Under-thinking** : Actions précipitées sans plan
4. **Context explosion** : Historique devient trop long
5. **Tool dependence** : Sur-utilisation d'outils quand pas nécessaire

## Applications Industrielles

- **Assistants de recherche** : Navigation web et synthèse
- **Debugging tools** : Diagnostic itératif de problèmes
- **Data analysis** : Exploration de datasets avec hypothèses
- **Customer support** : Résolution adaptative de tickets
- **Educational tutors** : Guidage step-by-step personnalisé

## Évolution 2025 et Au-delà

- **Visual ReAct** : Actions sur images/vidéos
- **Continuous ReAct** : Flux continu sans cycles discrets
- **Predictive ReAct** : Anticipation des observations
- **Meta-ReAct** : Optimisation du processus ReAct lui-même
- **Embodied ReAct** : Intégration robotique physique
