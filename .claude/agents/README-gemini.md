# Sub-agents Gemini (R34)

Ces sub-agents utilisent le routing multi-provider du proxy Reborn pour
exécuter leurs tâches via Gemini Flash (Google AI) plutôt que Claude Sonnet.
Ils sont moins chers (~3x moins de points) et plus rapides pour des tâches
simples (recherche, résumé, extraction).

## Convention d'alias

Le champ `model` dans le frontmatter suit la convention
`<provider-alias>:<subagent-name>` (R34 F4). Exemple :

```yaml
model: gemini-flash-3-5:code-searcher
```

Le suffixe `:code-searcher` propage l'identité du sub-agent dans :

- les métriques Prometheus du proxy (`proxy_requests_total{subagent="code-searcher"}`)
- les events PostHog (debug qualité)
- les logs structurés

## Aliases V1 disponibles

| Alias              | Upstream                 | Disponibilité tier | Contexte max | Usage recommandé                       |
| ------------------ | ------------------------ | ------------------ | ------------ | -------------------------------------- |
| `gemini-flash-3-5` | `gemini-3.5-flash`       | builder+           | 1M tokens    | recherche, résumé, extraction          |
| `gemini-pro-3-1`   | `gemini-3.1-pro-preview` | studio+            | 1M tokens    | analyse cross-fichiers, gros contextes |

## Sub-agents fournis dans ce kit

- `code-searcher-gemini.md` - recherche dans le code (Read, Grep, Glob)
- `log-summarizer-gemini.md` - résumé de logs longs (pas de tools)
- `structure-extractor-gemini.md` - extraction de structure JSON (Read)

## Quand utiliser Gemini vs Claude

**Utilise Gemini** pour :

- Tâches mécaniques (lister, chercher, résumer)
- Gros contextes (Gemini Pro 1M tokens, bien plus que Claude 200k)
- Optimisation coût (Gemini Flash ~3x moins de points)

**Garde Claude** pour :

- Écriture de code (qualité + tests)
- Raisonnement multi-étape complexe
- Sub-agents reviewers (architect, lead-dev, etc.)
- Bash en write/execute

## Règle critique : accents français

Comme tout sub-agent Reborn, **toujours écrire un français accentué correct**
(`é`, `è`, `à`, `ç`, etc.). Le QA vérifie que Gemini Flash respecte cette
règle sur 10 sorties de test (cf. `.project/r34-tests-manuels.md` section 3).

## Refs

- `.project/rounds/034/plan.md` - décisions clés V1
- `.project/sops/sop-multi-provider-routing.md` - procédure d'ajout d'alias
- `backend/app/services/proxy_provider_router.py` - implémentation routing
