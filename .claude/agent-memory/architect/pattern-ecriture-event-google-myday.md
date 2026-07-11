---
name: pattern-ecriture-event-google-myday
description: Pièges de l'écriture bidirectionnelle d'events vers Google Agenda dans MyDay (push sync_pending vs inline, sync_error dead-end, résurrection au pull)
metadata:
  type: feedback
---

Quand un round MyDay ajoute la création/édition/suppression d'events remontés vers Google Agenda, revoir systématiquement ces points (le socle Round 003 vit dans `backend/app/services/google/sync.py` + `calendar_branch.py` + `calendar_client.py`).

**Why:** le design Round 003 pousse les events locaux via `push_local_events`/`_push_one` déclenché par le scheduler, avec `sync_status='sync_pending'` comme file d'attente et `client_uuid` comme clé d'idempotence. Un round « écriture events » qui ignore ce socle recrée une logique divergente et rouvre doublons/pertes.

**How to apply — 5 exigences :**
1. **Ne pas réimplémenter le push.** Réutiliser/extraire `_push_one`. Rejeter tout `insert_event` codé à la main dans l'endpoint.
2. **Ne pas bloquer la requête sur Google.** `CalendarClient._TIMEOUT=30s`. POST doit insérer `sync_pending` et répondre immédiatement (badge « Non synchronisé »), push best-effort/scheduler.
3. **`sync_error` est un cul-de-sac** : `push_local_events` ne ramasse QUE `sync_pending`. Réserver `sync_error` au permanent (reauth/invalid_grant) ; échec transitoire → laisser `sync_pending` pour retry scheduler.
4. **Résurrection au pull** : `apply_calendar_changes` réimporte tout event présent côté Google et ne préserve QUE les rows `sync_pending`. Donc PATCH local doit repasser `sync_pending` (sinon écrasé) ; DELETE local dont le delete Google échoue → event réimporté (ressuscité).
5. **`calendar_client` n'a que `list_events`+`insert_event`.** PATCH/DELETE exigent d'ajouter `patch_event` ET `delete_event` — souvent un seul est mentionné.

**Schéma :** `events` a `source` ∈ (google, myday), PAS `origine`. Un badge « via l'assistant » sur un event n'a pas de donnée source (contrairement à tasks/notes qui ont `origine='assistant'`). Voir [[pattern-resilience-sync-tierce]] et [[pattern-oauth-dualstack-enforcement]].
