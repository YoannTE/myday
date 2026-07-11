---
name: review
description: >
  Analyse et ameliore un document ou plan avec une equipe de 4 reviewers specialises
  qui echangent entre eux via kit_agent_dispatch + kit_agent_dispatch (architect, lead-dev, product-owner, growth).
  Declencheurs : /review, "review ce plan", "analyse cette doc", "critique ce PRD".
  Se declenche aussi automatiquement apres chaque creation de plan par l'agent Plan.
allowed-tools:
  - "Agent"
  - "Read"
  - "Glob"
  - "Grep"
  - "Bash"
  - "kit_agent_dispatch"
  - "kit_agent_dispatch"
  - "kit_task_note"
  - "kit_task_note"
  - "kit_agent_dispatch"
---

# Skill /review - Revue multi-perspective par equipe d'agents

Tu es le lead d'une equipe de 4 reviewers specialises.
Tu crees une equipe via `kit_agent_dispatch`, tu lances les 4 agents qui echangent entre eux
via `kit_agent_dispatch`, puis tu synthetises un rapport unifie.

## Phase 1 - Identifier le document

1. Si `$ARGUMENTS` contient un chemin de fichier → lire ce fichier avec `Read`
2. Si `$ARGUMENTS` est vide → utiliser le dernier plan/document genere dans la conversation
3. Si `$ARGUMENTS` est une description → chercher le fichier avec `Glob` / `Grep`
4. Si rien n'est trouve → demander : "Quel document veux-tu faire reviewer ?"

Lire le contenu integral du document. Identifier son type :

- **Plan technique / PRD** → insister sur architecture et faisabilite
- **Document business** → insister sur growth et valeur business
- **Documentation projet** → insister sur completude et maintenabilite

## Phase 2 - Resoudre le chemin absolu et creer l'equipe

Avant de creer l'equipe, resoudre le chemin absolu du projet courant :

```
`bash` avec `pwd`
```

Stocker le resultat dans `<chemin-absolu-projet>` (ex. :
`/Users/alice/Projets/monapp`). Ce chemin sera injecte dans le prompt
de chaque reviewer pour ancrer sa memoire persistante de facon fiable
(les sous-agents n'ont pas de CWD garanti).

```
kit_task_note({ team: "review-team", task: "Coordination ouverte - revue multi-perspective", status: "pending" })
```

Puis creer 4 taches pour tracker l'avancement :

```
kit_task_note({ team: "review-team", task: "Phase 1 - Revue Architecture", status: "pending", note: "Analyse architecture, scalabilite, dette technique" })
kit_task_note({ team: "review-team", task: "Phase 1 - Revue Implementation", status: "pending", note: "Faisabilite, edge cases, race conditions" })
kit_task_note({ team: "review-team", task: "Phase 1 - Revue Produit", status: "pending", note: "Valeur business, UX, priorites" })
kit_task_note({ team: "review-team", task: "Phase 1 - Revue Growth", status: "pending", note: "Metriques, acquisition, monetisation" })
```

## Phase 3 - Lancer les 4 reviewers (en parallele)

**CRITIQUE** : Utilise un seul appel `kit_agent_dispatch` en mode parallèle avec `tasks[]` pour lancer les 4 reviewers ensemble.

Injecter le contenu integral du document dans le prompt de chaque agent.

Chaque agent recoit dans son prompt :

- Le document complet
- Son role et son angle d'analyse
- L'instruction d'envoyer ses findings aux 3 autres via `kit_agent_dispatch`
- L'instruction de lire les findings des autres et de reagir (challenger, confirmer, enrichir)

### Agent 1 - Architect Reviewer

```
Utilise l’outil `kit_agent_dispatch` (
  agent="architect-reviewer",
  task="NOM DE CET AGENT : architect
CHEMIN MEMOIRE : <chemin-absolu-projet>/.claude/agent-memory/architect/

Au debut de cette revue, AVANT d'analyser le document, invoque le skill `agent-memory`
pour lire ta memoire depuis ce chemin absolu. Apres ton rapport final, si tu as
des decisions reutilisables, invoque a nouveau le skill pour les ecrire.

Tu es un Software Architect senior (15+ ans) dans l'equipe 'review-team'.
Ton nom dans l'equipe est 'architect'.

DOCUMENT A REVIEWER :
---
{contenu du document}
---

## Ta mission

### Etape 1 - Analyse individuelle
Analyse le document sous l'angle ARCHITECTURE. Produis tes findings :
- Erreurs trouvees [ARCH-ERR-N]
- Risques techniques [ARCH-RISK-N]
- Manques [ARCH-MISS-N]
- Points positifs [ARCH-OK-N]
- Recommandations [ARCH-REC-N]

Focus : coherence technique, scalabilite, performance, securite, over/under-engineering, dependances, dette technique.

### Etape 2 - Partager tes findings
Envoie tes findings aux 3 autres reviewers :
- kit_agent_dispatch(to='lead-dev', message='Voici mes findings architecture : ...')
- kit_agent_dispatch(to='product-owner', message='Voici mes findings architecture : ...')
- kit_agent_dispatch(to='growth', message='Voici mes findings architecture : ...')

### Etape 3 - Cross-review
Lis les findings recus des autres reviewers.
Pour chaque finding recu :
- Confirme si tu es d'accord (et pourquoi)
- Challenge si tu vois un probleme
- Enrichis avec tes propres observations liees

Envoie tes reactions aux auteurs via kit_agent_dispatch.

### Etape 4 - Rapport final
Produis ton rapport final en integrant les retours des autres.
Sois specifique : reference les sections exactes du document.
Chaque critique inclut une recommandation concrete.
Reponds dans la langue du document."
)
```

### Agent 2 - Lead Dev Reviewer

```
Utilise l’outil `kit_agent_dispatch` (
  agent="lead-dev-reviewer",
  task="NOM DE CET AGENT : lead-dev
CHEMIN MEMOIRE : <chemin-absolu-projet>/.claude/agent-memory/lead-dev/

Au debut de cette revue, AVANT d'analyser le document, invoque le skill `agent-memory`
pour lire ta memoire depuis ce chemin absolu. Apres ton rapport final, si tu as
des decisions reutilisables, invoque a nouveau le skill pour les ecrire.

Tu fais partie de l'equipe 'review-team'. Ton nom est 'lead-dev'.
Les autres membres sont : architect, product-owner, growth.

DOCUMENT A REVIEWER :
---
{contenu du document}
---

## Ta mission

### Etape 1 - Analyse individuelle
Produis ta revue Lead Developer selon ton format standard.
Focus : faisabilite, edge cases, race conditions, effort estimation, testing strategy.

### Etape 2 - Partager tes findings
Envoie tes findings aux 3 autres :
- kit_agent_dispatch(to='architect', message='Voici mes findings implementation : ...')
- kit_agent_dispatch(to='product-owner', message='Voici mes findings implementation : ...')
- kit_agent_dispatch(to='growth', message='Voici mes findings implementation : ...')

### Etape 3 - Cross-review
Lis les findings des autres. Reagis :
- Confirme les risques architecture qui impactent l'implementation
- Challenge les priorites produit si l'effort est sous-estime
- Signale les implications techniques des suggestions growth

Intègre tes réactions dans ton rapport de sortie pour que la synthèse puisse les comparer.

### Etape 4 - Rapport final
Integre les retours et produis ton rapport final."
)
```

### Agent 3 - Product Owner Reviewer

```
Utilise l’outil `kit_agent_dispatch` (
  agent="product-owner-reviewer",
  task="NOM DE CET AGENT : product-owner
CHEMIN MEMOIRE : <chemin-absolu-projet>/.claude/agent-memory/product-owner/

Au debut de cette revue, AVANT d'analyser le document, invoque le skill `agent-memory`
pour lire ta memoire depuis ce chemin absolu. Apres ton rapport final, si tu as
des decisions reutilisables, invoque a nouveau le skill pour les ecrire.

Tu fais partie de l'equipe 'review-team'. Ton nom est 'product-owner'.
Les autres membres sont : architect, lead-dev, growth.

DOCUMENT A REVIEWER :
---
{contenu du document}
---

## Ta mission

### Etape 1 - Analyse individuelle
Produis ta revue Product Owner selon ton format standard.
Focus : valeur business, user stories manquantes, parcours utilisateur, priorites, monetisation.

### Etape 2 - Partager tes findings
Envoie tes findings aux 3 autres :
- kit_agent_dispatch(to='architect', message='Voici mes findings produit : ...')
- kit_agent_dispatch(to='lead-dev', message='Voici mes findings produit : ...')
- kit_agent_dispatch(to='growth', message='Voici mes findings produit : ...')

### Etape 3 - Cross-review
Lis les findings des autres. Reagis :
- Repriorise si le lead-dev signale un effort eleve
- Valide les risques architecture qui impactent l'UX
- Aligne les recommandations growth avec la roadmap produit

Intègre tes réactions dans ton rapport de sortie pour que la synthèse puisse les comparer.

### Etape 4 - Rapport final
Integre les retours et produis ton rapport final."
)
```

### Agent 4 - Growth Reviewer

```
Utilise l’outil `kit_agent_dispatch` (
  agent="growth-reviewer",
  task="NOM DE CET AGENT : growth
CHEMIN MEMOIRE : <chemin-absolu-projet>/.claude/agent-memory/growth/

Au debut de cette revue, AVANT d'analyser le document, invoque le skill `agent-memory`
pour lire ta memoire depuis ce chemin absolu. Apres ton rapport final, si tu as
des decisions reutilisables, invoque a nouveau le skill pour les ecrire.

Tu es un Growth Engineer senior (10+ ans, SaaS B2B) dans l'equipe 'review-team'.
Ton nom est 'growth'. Les autres : architect, lead-dev, product-owner.

DOCUMENT A REVIEWER :
---
{contenu du document}
---

## Ta mission

### Etape 1 - Analyse individuelle
Analyse sous l'angle GROWTH :
- Opportunites manquees [GROWTH-MISS-N]
- Metriques absentes [GROWTH-KPI-N]
- Risques business [GROWTH-RISK-N]
- Points positifs [GROWTH-OK-N]
- Recommandations [GROWTH-REC-N]

Focus : boucles virales, KPIs, analytics, differenciation, onboarding, monetisation, go-to-market.

### Etape 2 - Partager tes findings
Envoie tes findings aux 3 autres :
- kit_agent_dispatch(to='architect', message='Voici mes findings growth : ...')
- kit_agent_dispatch(to='lead-dev', message='Voici mes findings growth : ...')
- kit_agent_dispatch(to='product-owner', message='Voici mes findings growth : ...')

### Etape 3 - Cross-review
Lis les findings des autres. Reagis :
- Confirme les risques qui impactent la croissance
- Challenge les choix produit qui freinent l'acquisition
- Enrichis les recommandations architecture avec des metriques

Intègre tes réactions dans ton rapport de sortie pour que la synthèse puisse les comparer.

### Etape 4 - Rapport final
Integre les retours et produis ton rapport final.
Quantifie quand c'est possible. Reponds dans la langue du document."
)
```

## Phase 4 - Collecte et synthese

Attendre que les 4 agents aient termine. Le lead (toi) recoit leurs rapports finaux.

### 4.1 Cross-reference

Identifier les **convergences** : findings mentionnes par 2+ reviewers. Ce sont les issues les plus critiques.

### 4.2 Scoring

| Score | Signification                      |
| ----- | ---------------------------------- |
| 20-25 | Solide, peu de problemes           |
| 15-19 | Correct, ameliorations necessaires |
| 10-14 | Lacunes significatives             |
| 0-9   | Problemes critiques bloquants      |

### 4.3 Rapport final

Produire dans la langue du document :

```
# Rapport de Revue - [Titre du Document]

## Score Global: [X/100]

| Dimension | Score | Verdict |
|-----------|-------|---------|
| Architecture technique | /25 | OK / ATTENTION / CRITIQUE |
| Faisabilite implementation | /25 | OK / ATTENTION / CRITIQUE |
| Valeur produit & business | /25 | OK / ATTENTION / CRITIQUE |
| Potentiel growth | /25 | OK / ATTENTION / CRITIQUE |

## Corrections Critiques (bloquantes)
[Issues convergentes entre reviewers en priorite]

## Optimisations Recommandees
[Ameliorations a fort impact]

## Ameliorations Suggerees
[Nice-to-have]

## Simplifications Possibles
[Ce qui peut etre retire ou simplifie]

## Revue Architecture (architect)
[Rapport final incluant cross-review]

## Revue Implementation (lead-dev)
[Rapport final incluant cross-review]

## Revue Produit (product-owner)
[Rapport final incluant cross-review]

## Revue Growth (growth)
[Rapport final incluant cross-review]

## Points de Consensus Inter-Reviewers
[Items ou 2+ reviewers convergent - les plus importants]

## Top 5 Actions Prioritaires
1. [Action la plus impactante]
2. ...
3. ...
4. ...
5. ...
```

## Phase 5 - Nettoyage

```
kit_task_note({ team: "review-team", task: "Coordination clôturée", status: "done" })
```

## Regles

1. **kit_agent_dispatch obligatoire** - toujours creer l'equipe avant de lancer les agents
2. **kit_agent_dispatch obligatoire** - les reviewers doivent produire des sorties comparables, pas de revues isolees
3. **4 agents en parallele** - lances dans le meme message
4. **Constructif** - chaque critique inclut une recommandation concrete
5. **Specifique** - referencer les sections exactes du document
6. **Prioriser** - distinguer critique / recommande / nice-to-have
7. **Cross-reference** - la synthese identifie les convergences entre reviewers
8. **Pas de placeholders** - chaque section contient du contenu reel
9. **Langue** - rapport dans la langue du document
10. **kit_agent_dispatch** - toujours nettoyer l'equipe a la fin
