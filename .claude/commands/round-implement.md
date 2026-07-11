Execute l'implementation d'un round avec scoring de complexite par agent, extraction des mockups, et instructions UI obligatoires.

Argument : numero du round (ex: /round-implement 5, /round-implement 12bis).

Prerequis : `.project/rounds/{id}/plan.md` doit exister (cree par `/round-plan`).

Cette commande est invoquee automatiquement par `/code` apres `/round-plan`,
mais peut aussi etre lancee manuellement.

Sortie : code implemente dans le projet, features cochees `- [x]` dans
`.project/rounds/{id}/spec.md`.

**REGLE UI** : avant chaque Write d'un nouveau fichier de code (composant
React, Server Action, endpoint FastAPI, schema Drizzle, page Next.js,
etc.) ou avant un Edit important d'un `.project/*.md`, appelle d'abord
`notify_writing({ file_path: "<chemin>" })` pour afficher l'animation
plume cote UI pendant la redaction. Inutile pour des Edit courts (rename
de variable, fix de typo). Cf. CLAUDE.md section « Hook `notify_writing` ».
Ignorer si tu n'as pas ce tool.

---

## PHASE 1 - Setup

1. **Lire le plan** : `.project/rounds/{id}/plan.md` (deja reviewe par `/round-plan`). Si absent mais que l'ancien `.project/.round-{id}-plan.md` existe, lancer `/round-migrate {id}` puis relire le chemin canonique.
2. **Lire les SOPs pertinents** :
   - Si `.project/rounds/{id}/sops.md` existe (cree par `/code`) → le lire, contient
     les SOPs pre-matches pour ce round
   - Sinon : lire `.project/sops/README.md` si existe, matcher les mots-cles du round
     (ex: « upload », « auth », « form », « migration », « webhook ») avec les `Tags`,
     lire au max 3 SOPs correspondants depuis `.project/sops/{id}.md`
   - Si rien → continuer sans SOPs
3. **Lire le round** : lire `.project/rounds/{id}/spec.md` - extraire les features
   incompletes (`- [ ]`) et leurs liens mockup depuis la section `## Mockups lies`
4. Utilise `kit_task_note` avec team="round-{id}", task="Coordination ouverte - Round {id} - {Nom}", status="pending".
5. `kit_task_note` pour chaque feature incomplete du round

### Etape 1.bis - Détection des agents IA dans le round (si feature activée)

Si `.project/decisions.md` contient une section `## Agent Platform` (feature
agents-platform activée via `/add-agents-platform`), ajouter cette étape de
détection :

#### Scanner le plan du round

Chercher dans `.project/rounds/{id}/plan.md` ou dans `.project/rounds/{id}/spec.md`
les indices d'agents IA dans les features du round :

- Mentions explicites « agent », « workflow IA », « LLM », « HITL »
- Fichiers `backend/agents/<name>.py` mentionnés
- Tâches d'orchestration, scoring, classification automatique

#### Si agents IA dans le round → vérifier la greffe

Vérifier que `agent-platform` est correctement greffé :

1. Section `## Agent Platform` complète dans `.project/decisions.md` avec
   `tenant_id` + `api_key` configurés (vérification : `tenant_id` UUID valide)
2. Dossier `backend/agents/` existe
3. `backend/app/main.py` importe et initialise `AgentPlatform` (`from agent_platform import AgentPlatform`)
4. Override `verify_local_auth` présent dans `main.py` (SEC-4)

Si l'UNE de ces conditions n'est pas remplie → invoquer `/add-agents-platform`
AVANT toute autre tâche du round.

#### Injection du design SDK-native avant délégation

Avant de déléguer à `agent-platform-developer`, vérifier si `.project/agent-design.md`
existe :

- **Si absent** : STOPPER immédiatement et afficher ce message bloquant :

  > « Le round contient des features d'agents IA mais `.project/agent-design.md`
  > est absent. Lance d'abord `/agent-design` pour concevoir le workflow SDK-native, puis
  > relance `/code N`. »

  Ne pas déléguer à `agent-platform-developer` tant que ce fichier n'existe pas.

- **Si présent** : injecter son contenu complet dans le prompt de l'agent
  (section « Contexte projet »).

#### Délégation des fichiers d'agents IA

| Périmètre                                                                   | Agent délégué                                                                                               |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `backend/agents/<name>.py` (workflow IA)                                    | `agent-platform-developer` (PAS `fastapi-developer`)                                                        |
| `backend/tests/agents/test_<name>.py` (écriture)                            | `agent-platform-developer`                                                                                  |
| Endpoint métier qui déclenche un agent (ex: `POST /api/leads/{id}/qualify`) | `fastapi-developer` qui utilisera `request.app.state.agent_platform` + `await platform.start_workflow(...)` |
| Composant React qui appelle l'endpoint                                      | `nextjs-developer`                                                                                          |

Le pattern d'usage côté endpoint métier :

```python
@app.post("/api/leads/{lead_id}/qualify")
async def qualify(lead_id: str):
    handle = await platform.start_workflow("qualify_lead", input={"lead_id": lead_id})
    return {"workflow_id": handle.workflow_id}
```

---

## PHASE 2 - Scoring de complexite par agent

**Choix du modele par agent (pas par round)** : pour CHAQUE agent, le lead
evalue la complexite des taches assignees avec la grille ci-dessous et choisit
le modele. Le score est calcule **par agent** (somme des taches assignees).

### Grille de scoring complexite

Pour chaque tache assignee a un agent, compter les points :

| Critere                                                       | Points | Exemples concrets                                                                            |
| ------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| **Transaction atomique multi-tables**                         | +3     | Advisory lock + SELECT FOR UPDATE + INSERT ledger + UPDATE wallet dans une meme transaction  |
| **Crypto / signatures / hashing**                             | +3     | Ed25519 sign/verify, hash chaine, HMAC, JWT custom                                           |
| **State machine (>3 etats + transitions)**                    | +3     | KYC not_started→pending→restricted→complete/rejected, statut pronostic pending→win/loss/void |
| **Worker / cron avec retry + circuit breaker**                | +3     | Worker verification avec FOR UPDATE SKIP LOCKED, retry exponentiel, dead-man switch          |
| **Matrice de cas metier (>3 branches croisees)**              | +2     | Mapping bet_type (1N2, OU, BTTS, handicap) × resultat (win/loss/void)                        |
| **Integration API externe avec gestion d'erreurs**            | +2     | Client API-Football/Odds avec circuit breaker, quotas, fallback cache                        |
| **Coordination cross-stack dans la meme tache**               | +2     | Endpoint FastAPI + page Next.js + migration Drizzle qui doivent fonctionner ensemble         |
| **Concurrence / race conditions**                             | +2     | Achats simultanees sur le meme wallet, advisory lock, idempotency key                        |
| **Schema BDD complexe (>5 tables liees + contraintes)**       | +1     | Schema initial avec FK, CHECK, UNIQUE, index composites                                      |
| **Logique de calcul financier**                               | +1     | Commission par palier, remboursement proportionnel garantie, payout net                      |
| **Securite / auth cross-stack**                               | +1     | get_current_user lit table session, verification role + ownership                            |
| **Multi-fichiers coordonnes (>4 fichiers modifies ensemble)** | +1     | Endpoint + service + modele + page + composant qui doivent etre coherents                    |

### Seuil de decision

- **Score 0-3** → `model="sonnet"` - CRUD, pages UI, endpoints simples, composants, formulaires
- **Score 4-5** → `model="sonnet"` - Sonnet gere bien avec un plan detaille, mais surveiller les tests
- **Score ≥6** → `model="opus"` - complexite trop elevee pour Sonnet, risque d'echecs silencieux

> **Pourquoi ce seuil ?** Sonnet 4.6 atteint 79.6% sur SWE-bench (vs 80.8% Opus)
> et gere bien 80% des taches de dev. Mais ses echecs sont **silencieux** : le code
> compile mais casse au runtime. Au-dela de 6 points, le risque de correction
> (re-lancer un agent, debugger) depasse l'economie de tokens.

Avant de lancer les agents, afficher le scoring :

```
Round {id} - Scoring agents :
- Agent 1 (sonnet, score=2) : R5-05 classement, R5-09 feed
- Agent 2 (opus, score=9) : R5-01 formulaire creation prono (+2 matrice bet_type, +2 cross-stack), R5-02 signature Ed25519 (+3 crypto, +2 concurrence)
- Agent 3 (sonnet, score=3) : R5-07 detail pick, R5-08 achat 1-click
```

---

## PHASE 3 - Lancement des agents d'implementation

Lancer les agents via `kit_agent_dispatch` avec `tasks[]` (agent="general-purpose", model conseillé="...").
Les agents travaillent en parallele au sein de l'equipe.

Chaque agent recoit un prompt detaille avec les blocs suivants (variables disponibles : `ROUND_ID={id}`, `ROUND_DIR=.project/rounds/{id}`) :

### 0. Round Context obligatoire

```
ROUND_ID={id}
ROUND_DIR=.project/rounds/{id}
Spec: .project/rounds/{id}/spec.md
Plan: .project/rounds/{id}/plan.md
Log: .project/rounds/{id}/log.md
SOPs: .project/rounds/{id}/sops.md
Test report: .project/rounds/{id}/test-report.md
```

Les artefacts de round doivent toujours utiliser ces chemins complets. Ne jamais utiliser les anciens chemins `.project/rounds/round-{id}.md`, `.project/rounds/R{id}.md` ou `.project/.round-{id}-*.md`.

### A. Plan du round

Contenu de `.project/rounds/{id}/plan.md` (mis a jour apres review).

### B. SOPs pertinents (si trouves en PHASE 1)

Injecter le contenu complet des SOPs matches, avec mention :

> « Applique strictement les patterns et pieges documentes ci-dessous avant
> d'ecrire du code »

### C. Contexte projet

- `.project/app.md` (sections pertinentes)
- `CLAUDE.md`
- Documentation technique pertinente (`docs/`)
- Fichiers existants a lire avant de coder

### D. Features specifiques a implementer

Description complete depuis la roadmap, avec conventions et patterns.

### E. Mockups (EXTRACTION OBLIGATOIRE)

Pour CHAQUE feature du round, parser la ligne roadmap pour extraire le pattern
`- mockup: pages/X.html + png/X.png` (et ses variantes multiples separees par `, `).

Pour chaque mockup reference :

- Lire le contenu complet du fichier HTML (`.project/mockups/pages/X.html`)
- Joindre le PNG correspondant (`.project/mockups/png/X.png`) au prompt de l'agent comme image
- Injecter ces deux elements dans le prompt avec la consigne :
  > « Ce mockup represente l'etat cible de l'UI pour cette feature. Le PNG donne
  > l'intention visuelle (lire d'abord), le HTML donne la structure exacte des
  > classes Tailwind a transposer en JSX. Ne JAMAIS inventer un autre design -
  > transposer fidelement. »
- Si une feature a plusieurs mockups lies : tous les joindre
- Si une feature n'a pas de lien mockup dans la roadmap : ne rien injecter,
  mentionner a l'agent « Pas de mockup pour cette feature, respecter
  `.project/design.md` et `patterns.md` »

**Garde-fou** : avant de lancer les agents, afficher en console :
`Round {id} - N features, M mockups lies` pour verifier que la liaison marche.

Si un round purement UI a 0 mockup lie alors que `.project/mockups/pages/`
contient des fichiers → probleme de liaison, relancer `/roadmap` ou alerter
l'utilisateur.

### F. INSTRUCTION UI/FRONTEND OBLIGATOIRE

Pour toute tache touchant au rendu visuel (pages, layouts, composants) :

> « Pour toute creation ou modification d'UI, tu DOIS utiliser le skill
> `frontend-design`. Ce skill porte l'identite visuelle du projet (typographie
> distinctive, palette non-generique, compositions originales). Les mockups HTML
> dans `.project/mockups/` ont ete generes avec ce skill - tu dois garder la
> meme coherence dans le code.
>
> Regles cles :
>
> - Transposer fidelement les classes Tailwind des mockups (le config Tailwind
>   du projet doit reprendre les tokens de
>   `.project/mockups/shared/tailwind-tokens.js`)
> - Utiliser les memes Google Fonts que le design-system du mockup
> - Eviter le 'AI slop' : pas de Inter/Roboto/system-ui par defaut, pas de
>   purple gradients, pas de layouts predictibles
> - shadcn/ui pour les primitives (Button, Input, Card...) mais en personnalisant
>   le theme avec les tokens du projet (`tailwind.config.ts` + globals.css
>   variables CSS) »

---

## PHASE 4 - Coordination et cloture

1. Coordonner via `kit_agent_dispatch` + `kit_task_note`
2. Quand tout est termine → cocher `- [x]` les features dans
   `.project/rounds/{id}/spec.md` (section `## Perimetre`)
3. **Alimenter le log de round** : si le round expose ou modifie des endpoints API
   (Server Action, Route Handler, endpoint FastAPI), inserer ces endpoints dans la
   section `## Endpoints touches` du log `.project/rounds/${ROUND_ID}/log.md`.
   Format par ligne : `- METHOD /chemin/api (cree|modifie)`.

   `ROUND_ID` doit etre le numero 3 chiffres avec padding (`001`, `002`, ...) -
   meme convention que le dossier `.project/rounds/NNN/` et les ids dans `index.json`.

   Utiliser le bloc Bash suivant pour chaque endpoint (idempotent + insertion
   positionnee avant `## Fichiers touches`). Portabilite : `-i.bak` cree un
   backup temporaire compatible macOS BSD sed et GNU sed ; le backup est supprime
   immediatement.

   ```bash
   ROUND_LOG=".project/rounds/${ROUND_ID}/log.md"
   ENDPOINT="- METHOD /chemin/api (cree|modifie)"

   # Idempotent : n'inserer que si la ligne n'existe pas deja
   if ! grep -qF "$ENDPOINT" "$ROUND_LOG"; then
     # Inserer juste avant "## Fichiers touches" (pas en append)
     sed -i.bak "/^## Fichiers touches/i\\
   $ENDPOINT
   " "$ROUND_LOG"
     rm -f "${ROUND_LOG}.bak"
   fi
   ```

   Adapter `METHOD`, `/chemin/api` et `(cree|modifie)` au contexte du round.
   Repeter le bloc pour chaque endpoint du round.

4. **Note** : ne pas faire Utilise `kit_task_note` avec team="round-{id}", task="Coordination clôturée", status="done". ici. L'equipe
   reste active pour la phase de tests (`/test-round`) et sera supprimee dans
   l'ETAPE E de `/code` (nettoyage final du round).
