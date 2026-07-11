---
name: push-search-round009
description: Pièges revue Round 009 MyDay — web push (pywebpush bloquant, VAPID), scheduler rappels, pont notif hors transaction, recherche ILIKE
metadata:
  type: project
---

Round 009 « Notifications push (VAPID) + recherche globale » — corrections structurantes relevées en revue.

**Why:** ces pièges reviennent dès qu'on branche du push ou du I/O réseau sur du code async FastAPI (uvicorn --workers 1) et sur les transactions RLS de MyDay.

**How to apply:** vérifier ces points sur tout round touchant push, envoi mail, ou scheduler.

- **pywebpush est SYNCHRONE (requests)** : `webpush(...)` bloque l'event loop. Toujours `anyio.to_thread.run_sync` / `asyncio.to_thread`. Le loop est partagé avec 3 schedulers (google, brief, rappels).
- **Push jamais dans une transaction BDD** : `queue_notifications` (mail_triage/persistence.py) et `persist_brief` (daily_brief/persist.py) insèrent la notif DANS un `scoped_connection` ouvert (connexion du pool max_size=10 détenue). Séquence obligatoire : INSERT + lecture abonnements dans la txn → commit → push best-effort APRÈS → purge 410/404 dans un nouveau scoped_connection.
- **Ne pas re-router queue_notifications/persist_brief via un pont qui refait l'INSERT** : ils portent déjà préférence + plafond + ON CONFLICT. Le pont doit être push-only (appelé après row réellement insérée). Le chemin INSERT+push complet est réservé au nouveau event_reminders.
- **VAPID claims mutés en place par py_vapid** : reconstruire `{"sub": vapid_subject}` neuf à CHAQUE envoi (sinon aud/exp figés → 401). Publique = uncompressed point base64url (front: urlBase64ToUint8Array). Privée pywebpush = base64url 32 octets OU chemin PEM (une PEM multi-lignes ne tient pas dans .env.local).
- **Scheduler rappels : requêter events, pas scanner users** : une requête admin-pool sur events (index events_debut_idx) `debut > now() AND debut <= now()+interval`, JOIN user_preferences (notif_event_reminder), LEFT JOIN notifications (dédup ref_id). events.debut est timestamptz absolu → pas de calcul heure locale (contrairement au brief). Fenêtre unilatérale + garde debut>now().
- **Fallback email (best-effort)** : email destinataire dans table `user` = HORS RLS → admin pool, pas scoped_connection. Catcher GoogleSendUnavailable. message_id déterministe (build_rfc822 R008) pour at-most-once. Réutiliser get_send_access_token (hors-verrou), pas load_connection.
- **push_subscriptions.endpoint UNIQUE global vs RLS** : app 2 users sur device partagé → upsert ON CONFLICT(endpoint) DO UPDATE peut viser une row d'un autre user (invisible RLS, WITH CHECK bloque). Réassignation via admin pool ou DELETE+INSERT.
- **Recherche ILIKE** : court-circuiter q vide/<2 chars (sinon %% matche tout), échapper % _ \ + ESCAPE, 4 SELECT dans un seul scoped_connection.
- **sw.js enregistré prod-only** → subscribe push intestable en `npm run dev`, seulement sur build prod.

Voir aussi [[assistant-conv-round008]] (envoi Gmail at-most-once, token hors-verrou), [[plan-antipatterns-myday]].
