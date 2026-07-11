---
name: risk-sync-schema-drift
description: Round 003 google_sync — dérives entre design/plan et schéma réel, races refresh token + asyncio.gather, contradiction RLS
metadata:
  type: project
---

Points récurrents à vérifier sur tout plan touchant google_sync (Round 003 et suites).

**Dérive design ↔ schéma réel :**
- `mails.statut` CHECK = `('pending_triage','triaged')` UNIQUEMENT. Le design/plan veut un statut `archived_remote` (suppression distante) → viole le CHECK, INSERT/UPDATE échoue. Toute nouvelle valeur de statut exige une migration Drizzle + mise à jour du CHECK AVANT le code.
- `events` n'a PAS de colonne `clientUuid`/idempotency. `push_local_events` ne peut réconcilier un event local repoussé vers Google contre son re-pull incrémental (nouveau googleEventId) que via googleEventId posé après insert. Crash entre insert Google et UPDATE local = DOUBLON. Exiger soit une colonne clientUuid (propagée dans `extendedProperties.private`, match au pull), soit une garantie transactionnelle explicite. Voir [[risk-bidirectional-sync]].
- `google_connections` n'a pas de colonne `tokenExpiry` → `needs_refresh` incalculable. Migration requise. Nommage jetons incohérent dans le plan (réutiliser `access_token`/`refresh_token` text OU ajouter `*_enc` — trancher).

**Contradiction RLS :** `decisions.md` liste `google_connections` parmi les 14 tables RLS (accès via `app_rls` + `scoped_connection(user_id)`). Or le plan R003 fait passer le repository par le « pool admin » (app_admin superuser = bypass RLS). Incohérent. Exiger `scoped_connection` partout (google_connections, events, mails) sinon le cloisonnement enforced saute silencieusement.

**Races concurrence (sans-plateforme, FastAPI pur) :**
- Refresh access token concurrent : le refresh est dans `load_connection` (sous verrou) MAIS les clients Google re-refreshent aussi sur 401. Deux branches lancées via `asyncio.gather` peuvent refresh en même temps → écriture concurrente token + `invalid_grant` Google. Exiger un single-flight (verrou/mutex BDD sur le refresh, ou refresh UNIQUEMENT dans load_connection, jamais dans les branches en parallèle).
- `asyncio.gather` sur les 2 branches est OK côté async pur, MAIS une connexion asyncpg N'EST PAS concurrente : chaque branche doit acquérir SA connexion du pool + son `SET LOCAL app.current_user_id` + sa transaction. Sinon « another operation is in progress ».
- Ordre `fetch → apply → push` : `apply_calendar_changes` (Google gagne) écrase une édition locale `sync_pending` AVANT `push_local_events` → édition perdue. Pousser avant d'appliquer, ou exclure les rows `sync_pending` de l'écrasement.

**--workers 1 :** en sans-plateforme le vrai garde anti-double-run est le verrou BDD `sync_locked_until` (UPDATE conditionnel), PAS `--workers 1` (qui ne couvre que le scheduler intra-process ; multi-conteneurs Dokploy = plusieurs schedulers). Garder --workers 1 pour le scheduler asyncio, mais s'appuyer sur le verrou pour la correction.
