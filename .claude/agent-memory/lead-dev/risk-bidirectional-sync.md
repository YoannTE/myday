---
name: risk-bidirectional-sync
description: Sync bidirectionnelle Google Agenda/Gmail — doublons, conflits d'édition, curseurs incrémentaux à exiger
metadata:
  type: project
---

La sync bidirectionnelle (F4 Agenda, F7 Gmail) est le foyer classique de bugs et de sous-estimation.

Points à exiger dans tout plan touchant la sync :
- **Curseurs incrémentaux** : `calendarSyncToken` (Calendar), `gmailHistoryId` (Gmail history.list). Sans eux → full sync à chaque cycle → explosion quota Gmail (~250 units/user/s). Gérer `410 GONE` → repli full sync.
- **Anti-doublon événement** : `UNIQUE(userId, googleId)` partiel + `clientUuid` propagé dans `extendedProperties.private` pour réconcilier création locale ↔ re-pull.
- **Anti-conflit** : colonne `version`/`updatedAtLocal` + `etag` Google ; update conditionnel `WHERE id=? AND version=?` (0 ligne = conflit) ; `If-Match: etag` vers Google (412 = conflit).
- **Anti-double-sync** : advisory lock Postgres par userId ou WorkflowID déterministe DBOS.
- **Coût IA F7/F8** : pré-filtre heuristique avant LLM, scorer seulement fenêtre récente au 1er sync, cache score par gmailId, batching.

**Why:** le modèle d'entités du brief n'avait ni etag, ni curseur, ni contrainte d'unicité — garanties absentes = corruption silencieuse.

**How to apply:** bloquer tout démarrage de F4/F7 tant que ces colonnes/contraintes ne sont pas au schéma. Voir [[project-myday]].
