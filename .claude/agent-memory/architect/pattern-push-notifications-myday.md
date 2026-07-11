---
name: pattern-push-notifications-myday
description: Pièges archi web push / notifications MyDay — table appareil partagé, pont notif dans connexion tenue, fenêtre rappels, fallback email en boucle
metadata:
  type: project
---

Round 009 (web push VAPID + rappels d'événements + recherche). Pièges récurrents à re-vérifier sur toute évolution notifications :

**Table `push_subscriptions` (appareil partagé)**
`unique(endpoint)` global est le bon choix (un endpoint = un canal physique). `unique(user_id, endpoint)` ferait FUITER les notifs entre comptes sur le même navigateur → à rejeter.
**Why:** sous `scoped_connection(user_B)`, un `INSERT ... ON CONFLICT (endpoint) DO UPDATE` quand l'endpoint appartient à user_A échoue : le conflit est vu via l'index unique (malgré RLS) mais le DO UPDATE cible une row invisible → subscribe du 2e user cassé silencieusement.
**How to apply:** réassignation d'endpoint via le POOL ADMIN : `DELETE WHERE endpoint=$1` (hors RLS) puis INSERT scopé. Write pattern « table à appareil partagé = cleanup admin ». Voir [[pattern-enforcement-cloisonnement]].

**Pont notification+push branché dans un flux existant (mail_triage R006 / daily_brief R007)**
- La boucle budget de `queue_notifications` compte via `result.endswith(" 1")` → un pont substitué à l'INSERT nu DOIT retourner un booléen « inséré » sinon le plafond est cassé.
- NE JAMAIS faire l'I/O réseau (web push HTTP, envoi mail) en tenant la `scoped_connection` du triage/brief : sous `--workers 1` = épuisement pool + blocage du flux sur un endpoint lent. Séparer passe DB (INSERT) et passe envoi (hors connexion).
- Plafond d'envoi push : compter les ENVOIS, pas les notifs (sinon off-by-one car la notif vient d'être insérée), et scoper par type sinon un pic mails affame les rappels d'événements.

**Fenêtre rappels d'événements**
Fenêtre centrée `[now+Δ-w, now+Δ+w]` = risque d'OUBLI si un tick est sauté (restart). Comme la dédup vient de `unique(user_id, ref_id=event.id, type)`, utiliser une borne haute : `start_time > now AND start_time <= now+minutes AND pas de notif`. Idempotent + rattrapage après restart, zéro oubli.
Limites à documenter : event supprimé → notif orpheline (pas de FK sur ref_id, clic 404) ; event décalé → ON CONFLICT bloque tout nouveau rappel (prévenu à la mauvaise heure).

**Fallback email via `gmail_client.send_message` = BOUCLE**
Envoi depuis le Gmail du user vers son propre email → ré-ingéré par la sync Gmail (`history.messageAdded`) → nouvelle row `mails` pending_triage → repasse au triage LLM. Auto-alimentation. Pour rappels : supprimer le fallback OU filtrer les auto-envois à l'ingestion, et le gater derrière préférence + plafond. Voir [[pattern-ecriture-event-google-myday]].

**Recherche ILIKE** : échapper `%`, `_`, `\` dans la saisie avant `%q%` (wildcard injection), en plus des params $n. Scoping RLS via `scoped_connection` + WHERE user_id, mails limités à `statut='triaged'`.
