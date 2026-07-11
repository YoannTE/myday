---
name: mail-triage-round006
description: Pièges du tri des mails (Round 006) sans plateforme Core — trigger sync, client anthropic brut, persist par-ligne, race triage, expediteur From brut
metadata:
  type: project
---

Round 006 « tri des mails » : `mail_triage` implémenté en service FastAPI normal
(PAS agent-platform/DBOS), fallback heuristique = chemin nominal (pas de clé LLM).

**Trigger depuis sync** : le TODO ligne ~137 de `sync.py` est DANS `finalize_sync`,
AVANT `release_sync_lock` (ligne 138). Y appeler le tri tient le verrou sync. Bon
point d'insertion = dans `run_sync`, APRÈS `finalize_sync` (verrou déjà libéré),
en lisant `gmail_result["new_mail_ids"]` — car `finalize_sync` strippe `new_mail_ids`
de son retour (ne garde que `new_mails`/`updated`). Best-effort try/except.
`run_sync` est sous `asyncio.wait_for(timeout=60)` du scheduler (uvicorn --workers 1) :
le fallback est instantané, mais dès que la clé LLM arrive, un lot peut dépasser le
budget → prévoir tâche séparée / retour rapide.

**Client anthropic brut** : `response_format="json_object"` N'EXISTE PAS chez Anthropic
(OpenAI-ism). Le design (`llm.parse(..., response_format=...)`) est faux transposé en
`anthropic`. Utiliser `AsyncAnthropic().messages.create(model, max_tokens=<OBLIGATOIRE>,
system, messages)` + `json.loads(resp.content[0].text)` + Pydantic. Ne jamais construire
le client si clé vide. Coût : calcul manuel via table de prix, `resp.usage.input/output_tokens`.

**Persist par-ligne** : `UPDATE ... WHERE id=ANY($ids)` ne pose PAS de valeurs par ligne
(score/raison/resume diffèrent). Utiliser `UPDATE m SET ... FROM (VALUES ...) v WHERE m.id=v.id`
ou `executemany`. Sous `scoped_connection` RLS.

**Race triage** : `/api/triage/refresh` ne passe pas par le verrou sync → peut chevaucher
le tri déclenché par le scheduler pour le même user. UPDATE idempotent + notif dédupliquée
par `(user_id, ref_id, type)`, MAIS le plafond notif (COUNT fenêtre 1h) est TOCTOU. Fix :
`pg_advisory_xact_lock(hashtext('triage:'||user_id))` en tête de run.

**expediteur = From brut** : `_parse_message` (gmail_branch.py l.40) stocke `"Nom <email>"`
tel quel. Le feedback→sender_preferences.email et le pré-filtre doivent extraire l'email nu
(`email.utils.parseaddr`) des DEUX côtés, sinon la boucle de feedback casse si le display
name change.

**Valeurs de schéma exactes** : `sender_preferences.statut` ∈ {`important`,`muet`} (le design
dit `muted` = FAUX, viole le CHECK). `notifications.type='mail_important'`, `contenu` NOT NULL
(à fournir), `ref_id` uuid NOT NULL = mail.id. Index `sender_preferences_user_email_unique`
et `notifications_user_ref_type_unique` existent bien.

**Pas de contrainte serverless sur FastAPI** : uvicorn long-running, la limite Vercel 10s ne
s'applique jamais au backend Python.
