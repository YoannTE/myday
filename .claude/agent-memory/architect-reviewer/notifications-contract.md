---
name: notifications-contract
description: Contraintes BDD à respecter quand un service insère dans notifications / lit sender_preferences
metadata:
  type: project
---

Gotchas schéma récurrents autour du tri des mails (source : `src/lib/db/schema/systeme.ts`, `mails.ts`, `drizzle/0001`, `0002`).

- `notifications.contenu` est **NOT NULL** : tout INSERT (y compris `ON CONFLICT (user_id, ref_id, type) DO NOTHING`) DOIT fournir `contenu`. Oublier `contenu` = crash de l'INSERT. `ref_id` est `uuid NOT NULL` (polymorphe, pas de FK). Table sans `updated_at`.
- `usage_events.type` a un CHECK fermé qui **n'inclut aucun type `mail_triage.*`** → un service de tri ne peut pas y écrire ses events. Le seul journal ouvert au tri est `llm_usage`.
- `sender_preferences` : clé unique `(user_id, email)`, `statut ∈ {important, muet}` (jamais `muted`). Le pré-filtre lit ces prefs par email ; mais `mails.expediteur` stocke le **header From brut** (« Nom <email> »). Normaliser en email minuscule pour stocker ET matcher, sinon la boucle de feedback rate quand le display name change, et c'est incohérent avec les regex newsletter (no-reply@…).
- RLS : mails, sender_preferences, notifications, llm_usage, usage_events ont toutes ENABLE RLS + policy `_user_isolation` (0002). Écriture OK via `scoped_connection` uniquement.

**How to apply :** pour tout service qui trie/notifie, exiger `contenu` dans l'INSERT notifications, interdire l'écriture usage_events pour le tri, et exiger la normalisation email pour sender_preferences + regex.
