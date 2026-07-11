# Structure rounds (.project/rounds/)

- Le dossier `.project/rounds/` est genere par `/roadmap` (pas cree manuellement).
- `index.json` centralise les statuts (`pending`, `available`, `in-progress`, `done`)
  et les dependances entre rounds.
- `README.md` est une table de bord humain avec les comptes-rendus extraits.
- Chaque round a son propre dossier `.project/rounds/{id}/` (id padde : `001`,
  `002`, `012bis`, ...).
- La spec canonique du round est `.project/rounds/{id}/spec.md` avec frontmatter,
  perimetre, mockups, tests et section `## Compte-rendu` (alimentee par
  `/round-debrief`).
- Le plan d'execution reviewe est `.project/rounds/{id}/plan.md`.
- Le log d'execution est `.project/rounds/{id}/log.md`, cree par `/code` (ETAPE B
  INIT) et alimente par les agents dev via le skill `output-format`. Ce log
  contient les sections `## Endpoints touches` (remplie par `/round-implement`
  PHASE 4 etape 3, inseree avant `## Fichiers touches` via sed) et
  `## Fichiers touches` (remplie par les agents dev en append). Il est consomme
  par `/test-round` pour construire l'inventaire de test.
- Les SOPs pre-selectionnes pour un round sont dans `.project/rounds/{id}/sops.md`.
  Les SOPs globales reutilisables restent dans `.project/sops/`.
- Le rapport QA final valide par extension est `.project/rounds/{id}/test-report.md`.
- Ne pas modifier `index.json` manuellement sauf urgence : utiliser `/round-debrief`
  pour mettre a jour les statuts.
- Ne pas ecrire de nouveaux artefacts dans les anciens chemins
  `.project/rounds/round-{id}.md`, `.project/rounds/R{id}.md` ou
  `.project/.round-{id}-*.md`. Utiliser `/round-migrate {id}` pour copier les
  anciens artefacts vers le dossier canonique du round.
