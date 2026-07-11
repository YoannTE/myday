Phase 4 du brainstorming : finaliser les documents (BRIEF.md, index.md), faire reviewer le brief par l'equipe d'agents, ecrire la memoire feedback, cloturer le brainstorming.

Cette commande est invoquee automatiquement par `/start` apres `/start-structure`,
mais peut aussi etre lancee manuellement pour re-finaliser un brief modifie.

Prerequis : `.project/app.md` complet (toutes les sections de Phase 1, 2 et 3) +
`.project/decisions.md` avec la stack choisie.

Sortie :

- `BRIEF.md` à la racine du projet, PAS dans `.project/` (brief formel)
- `.project/index.md` (resume ultra-court avec stack)
- `feedback_always_test_rounds.md` dans la memoire projet
- Brief valide par les 4 agents reviewers + ajustements integres

**REGLE UI** : avant CHAQUE Write de `BRIEF.md`, `.project/index.md` ou
toute redaction longue ci-dessous, appelle d'abord
`notify_writing({ file_path: "<chemin>" })` pour afficher l'animation
plume cote UI pendant la redaction. Ignorer si tu n'as pas ce tool. Cf.
CLAUDE.md section « Hook `notify_writing` ».

→ **Hook UI Reborn** (a la 1ere ligne de cette commande, ignorer si tu n'as
pas ce tool) :
appelle
`update_substep_progress({ stepId: "01_describe", subStep: "d", status: "running", summary: "Verification finale et brief" })`
pour faire pulser la pill « 04 Verif » cote UI.

---

## Etape 4A : Finalisation des documents

1. Relire `.project/app.md` en entier (il est maintenant complet apres les 3 phases)
2. Generer `BRIEF.md` à la racine du projet, PAS dans `.project/` : brief
   formel avec toutes les décisions (le gate vérifie sa présence à la racine)
3. Creer `.project/index.md` : resume ultra-court (~20 lignes)

   **IMPORTANT** : inclure une section `## Stack` avec la stack choisie,
   recopiée depuis la ligne `Stack : ...` de `.project/decisions.md`
   (décision prise en Phase 3 par `/start-structure`) :
   - `Next.js + Postgres` ou `FastAPI + Next.js + Postgres`

   Cette section est lue par tous les agents et commandes pour adapter leur
   comportement.

## Etape 4B : Review complete par l'equipe d'agents

Lancer le skill `/review` sur `.project/app.md`.

Les 4 agents reviewers attendus sont ceux du dossier `.claude/agents/` :

- `architect-reviewer` (SSoT, enforcement, sécurité, résilience, schéma)
- `lead-dev-reviewer` (race conditions, infra, state sync, intégrité DB)
- `product-owner-reviewer` (UX gaps, règles métier, edge cases, priorités)
- `growth-reviewer` (conversion, monétisation, rétention)

Ils analysent le brief complet et produisent un rapport avec scoring et
actions prioritaires.

## Etape 4C : Presentation et validation

Presenter a l'utilisateur :

1. Le brief finalise (resume de `app.md`)
2. Le rapport de review avec les points cles :
   - Corrections critiques a integrer maintenant
   - Points qui necessitent une decision de l'utilisateur
   - Ameliorations recommandees

```
Voici le brief finalise et les retours de l'equipe d'experts :

[Resume du brief]

Les experts ont identifie [N] points :

Corrections integrees :
- [liste des corrections deja appliquees]

A decider ensemble :
- [questions qui necessitent l'avis de l'utilisateur]

Ameliorations suggerees (optionnel) :
- [liste]

On valide le brief avec ces ajustements ?
```

Integrer les decisions de l'utilisateur dans `app.md` et `BRIEF.md`.

## Etape 4D : Memoire feedback

Ecrire un fichier de memoire projet pour que les agents n'oublient jamais de
tester les rounds. Le chemin de la memoire projet est le dossier de memoire
Claude Code du projet courant.

Ecrire `feedback_always_test_rounds.md` dans la memoire projet :

```markdown
---
name: Toujours tester avant de marquer un round comme done
description: Ne JAMAIS marquer un round comme termine sans avoir lance les tests. Le grep statique ne suffit pas.
type: feedback
---

Toujours tester avant de marquer un round comme termine et passer au suivant.

**Why:** Un round marque comme "done" sans tests reels (build, imports, Docker, Playwright) cause des regressions en cascade sur les rounds suivants. Le grep statique ne detecte pas les erreurs d'execution.

**How to apply:** Apres chaque round d'implementation, AVANT de cocher les taches dans `.project/rounds/NNN/spec.md` :

1. Lancer le qa-tester avec le protocole complet (smoke + Playwright si frontend)
2. Verifier que le build passe
3. Verifier que les imports fonctionnent
4. Executer les tests specifiques du round
5. Ne passer au round suivant QUE si tous les tests passent ou max 5 iterations de fix
```

## Etape 4E : Cloture

NE GENERER AUCUN CODE.

**Rappel conditionnel agents IA** : si `.project/decisions.md` contient une
section `## Agent Platform` ET que `.project/agent-design.md` n'existe pas
encore, ajouter ce paragraphe au message de clôture :

> « Ton projet utilise des agents IA. Avant `/mockup` puis `/roadmap`, prépare ton workflow SDK-native :
>
> 1. `/agent-design` - concevoir le workflow SDK-native (steps, config, HITL, observabilité, recovery)
> 2. `/agent-detail` - cadrer chaque step LLM/tool/HITL (prompt système, schema, stratégie, failure modes, tests)
>
> Ces 2 commandes sont importantes : sans elles, les mockups et le découpage en rounds touchant les workflows IA seront approximatifs et à refaire. »

Dis a l'utilisateur :

```
Le brief est pret et valide par l'equipe d'experts !

Tu peux lancer /design pour explorer 3 directions de design et valider
l'identite visuelle. Ensuite /mockup pour generer les maquettes HTML et
leurs screenshots PNG (servent de reference visuelle pendant /code).
Ou /roadmap directement pour planifier les etapes.
```

→ **Gate deterministe** :
avant le message de cloture et avant `mark_step_complete`, appelle
obligatoirement `start_validate({ phase: "finalize" })`. Ce gate vérifie :

- les 7 sections de `.project/app.md` (Phases 1 à 3) ;
- `.project/decisions.md` avec sa ligne `Stack : ...` (Phase 3) ;
- `BRIEF.md` à la racine du projet ;
- `.project/index.md` avec sa section `## Stack`.

Si `ok=false` :

- NE PAS marquer l'etape terminee ;
- NE PAS proposer `/design`, `/mockup` ou `/roadmap` comme prochaine action ;
- afficher les fichiers/sections manquants ;
- produire `BRIEF.md` ou `.project/index.md` si necessaire ;
- relancer `start_validate({ phase: "finalize" })`.

→ **Hooks UI Reborn** (ignorer si tu n'as pas ces tools) :
uniquement quand `start_validate({ phase: "finalize" }).ok=true`, juste avant
le message de cloture, dans cet ordre :

1. `update_substep_progress({ stepId: "01_describe", subStep: "d", status: "done", summary: "Phase 4 terminee" })`
   -- ferme la pill « 04 » (qui passe a ✓).
2. `notify_user({ level: "success", message: "Brief sauvegardé · place au style" })`
   -- toast de succès qui annonce le passage à la phase suivante.
   **Doit etre emis AVANT `mark_step_complete`** : ce dernier cancel la
   session sidecar, un `notify_user` apres serait perdu.
3. `mark_step_complete({ stepId: "01_describe" })`
   -- ferme l'etape 01 du stepper principal et active la pill « 02 Style ».

Apres ces trois appels, l'utilisateur passe a l'etape 02 Style en lancant
`/design`.

**Note** : `.project/decisions.md` existe déjà depuis la Phase 3 (il contient
au minimum la ligne `Stack : ...`) et s'enrichit au fil des décisions prises.
`.project/patterns.md` est créé automatiquement plus tard, avec les premiers
composants construits (voir règles dans `CLAUDE.md`).

---

→ **FIN DU BRAINSTORMING** :

Cette phase 4 est la derniere. Apres le message de cloture, ne rien faire
d'autre : attendre que l'utilisateur lance `/design`, `/mockup` ou
`/roadmap` pour la suite.
