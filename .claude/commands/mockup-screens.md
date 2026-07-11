Wrapper minimal qui invoque le skill `mockup-screens-generator` (Phase 2 du /mockup).

Cette command existe pour permettre une reprise manuelle d'une generation
interrompue. Le travail reel est fait par le skill avec sa propre fenetre
de contexte, ce qui evite de saturer la fenetre principale.

## Action

1. Verifier les prerequis :
   - `.project/mockups/roadmap.md` existe (genere par `/mockup-prepare`)
   - `.project/design.md` existe
   - `.project/app.md` existe
   - `.project/mockups/shared/design-system.css` existe
2. Invoquer le skill `mockup-screens-generator` via l'outil Skill, en lui passant
   les chemins absolus des prerequis ci-dessus.
3. Apres la fin du skill, relire `.project/mockups/_phase2-decisions.md` pour
   recuperer le contexte des decisions prises.

Le skill se charge de la generation iterative, des boucles d'ajustement
visuel, de l'audit schema vs UI, et de la trace des decisions de Phase 2
dans `_phase2-decisions.md`.
