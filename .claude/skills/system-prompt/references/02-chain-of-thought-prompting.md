# Chain-of-Thought (CoT) Prompting

## Définition

Chain-of-Thought (CoT) est une technique de prompt engineering qui guide les LLM à travers un processus de raisonnement étape par étape, rendant leur pensée explicite et traçable. Au lieu de sauter directement à une conclusion, le modèle verbalise chaque étape intermédiaire de son raisonnement.

## Comment ça fonctionne

### Mécanisme de base

```
Question → Raisonnement étape par étape → Réponse finale

Exemple:
Q: "Si j'ai 10 pommes et j'en donne 3, puis j'en reçois 5, combien en ai-je ?"
R: "Voyons étape par étape :
    1. Je commence avec 10 pommes
    2. J'en donne 3, donc 10 - 3 = 7 pommes
    3. J'en reçois 5, donc 7 + 5 = 12 pommes
    Réponse finale : J'ai 12 pommes"
```

### Trois Approches Principales

1. **Zero-Shot CoT**
   - Ajouter simplement : "Pensons étape par étape"
   - Aucun exemple fourni

2. **Few-Shot CoT**
   - Fournir 2-3 exemples avec raisonnement complet
   - Le modèle apprend le pattern

3. **Explicit Instruction CoT**
   - Instructions détaillées sur les étapes à suivre
   - Structure imposée au raisonnement

## Avantages

- **Transparence** : Chaque étape du raisonnement est visible et vérifiable
- **Précision accrue** : Amélioration significative sur tâches complexes (jusqu'à +30%)
- **Débogage facilité** : Identification rapide des erreurs de logique
- **Confiance utilisateur** : Les utilisateurs comprennent comment la conclusion est atteinte
- **Apprentissage** : Le modèle s'auto-corrige durant le raisonnement
- **Généralisation** : Fonctionne sur une large gamme de problèmes

## Inconvénients

- **Coût en tokens** : 3-5x plus de tokens qu'une réponse directe
- **Latence accrue** : Temps de génération plus long
- **Sur-explication** : Peut compliquer inutilement des tâches simples
- **Hallucinations verbalisées** : Les erreurs sont aussi détaillées
- **Dépendance au modèle** : Efficacité variable selon le LLM
- **Bruit dans le raisonnement** : Étapes parfois non pertinentes

## Quand l'utiliser

- **Problèmes mathématiques** : Calculs multi-étapes, algèbre, géométrie
- **Raisonnement logique** : Puzzles, déductions, syllogismes
- **Analyse complexe** : Interprétation de données, comparaisons multiples
- **Planification** : Séquencement de tâches, allocation de ressources
- **Débogage** : Identification de problèmes dans code ou processus
- **Prise de décision** : Évaluation multi-critères avec compromis

## Quand ne PAS l'utiliser

- **Questions factuelles simples** : "Quelle est la capitale de la France ?"
- **Tâches créatives** : Génération de contenu artistique
- **Réponses binaires** : Oui/Non sans justification requise
- **Contraintes de latence** : Applications temps réel
- **Budget tokens limité** : Environnements à coût contraint
- **Données sensibles** : Quand verbaliser le processus pose problème

## Exemples d'implémentation

### Template Zero-Shot

```markdown
[QUESTION]

Pensons à ce problème étape par étape.
```

### Template Few-Shot

```markdown
Voici comment résoudre ce type de problème :

Exemple 1:
Q: [Question exemple 1]
R: Étape 1: [Raisonnement]
Étape 2: [Raisonnement]
Conclusion: [Réponse]

Maintenant, résolvons :
Q: [Question actuelle]
R:
```

### Template Structuré

```markdown
Pour résoudre ce problème, suis cette structure :

1. COMPRENDRE : Reformule le problème
2. IDENTIFIER : Liste les éléments clés
3. PLANIFIER : Définis l'approche
4. EXÉCUTER : Applique étape par étape
5. VÉRIFIER : Valide le résultat
6. CONCLURE : Énonce la réponse finale

Problème : [QUESTION]
Solution :
```

## Métriques de Performance

### Benchmarks Observés

- **Problèmes arithmétiques** : 17% → 78% de précision
- **Raisonnement symbolique** : 40% → 80% de succès
- **Questions multi-hop** : 35% → 67% de réponses correctes
- **GSM8K (maths)** : Amélioration de 35-40 points

### Variantes Avancées (2025)

1. **Recursive Thought Expansion (RTE)**
   - Ajuste dynamiquement la profondeur de raisonnement
   - Développe les étapes ambiguës, résume les claires

2. **Simulated Multi-Agent Debate (SMAD)**
   - Simule plusieurs perspectives dans le raisonnement
   - Consensus ou ranking pondéré des arguments

3. **LogiCoT**
   - Applique la logique symbolique formelle
   - Utilise reductio ad absurdum pour validation
   - Feedback ciblé sur étapes incorrectes

## Combinaisons avec d'autres techniques

- **CoT + Least-to-Most** : Décomposition puis raisonnement sur chaque partie
- **CoT + Self-Consistency** : Plusieurs chemins de raisonnement votent
- **CoT + ReAct** : Raisonnement guide les actions
- **CoT + Verification** : Auto-vérification de chaque étape

## Best Practices

1. **Clarté avant tout** : Préférer des étapes simples et claires
2. **Numérotation** : Utiliser des numéros pour la structure
3. **Validation intermédiaire** : "Vérifions cette étape..."
4. **Reformulation** : Commencer par reformuler le problème
5. **Conclusion explicite** : Toujours terminer par "Donc, la réponse est..."

## Prompts Optimaux Découverts

- **Original** : "Let's think step by step"
- **APE-optimisé** : "Let's work this out in a step by step way to be sure we have the right answer"
- **Domaine-spécifique** : Adapter le phrasé au contexte

## Pièges Courants

1. **Overthinking** : Trop d'étapes pour problèmes simples
2. **Déviation** : S'éloigner du problème original
3. **Circularité** : Raisonnement qui tourne en rond
4. **Fausse précision** : Étapes qui semblent logiques mais sont fausses
5. **Dépendance excessive** : Utiliser CoT quand pas nécessaire

## Évolution Future

- **Adaptive CoT** : Ajustement automatique de la profondeur
- **Multimodal CoT** : Raisonnement sur texte + images
- **Verified CoT** : Validation formelle de chaque étape
- **Compressed CoT** : Raisonnement interne, résumé externe
