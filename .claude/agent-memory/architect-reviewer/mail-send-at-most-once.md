---
name: mail-send-at-most-once
description: Garantie « au plus un envoi » de mail — la fenêtre ambiguë (réponse Gmail perdue) exige sending_unconfirmed + reconciliation par rfc822msgid, jamais un retour à pending_review
metadata:
  type: project
---

Règle métier absolue MyDay : aucun mail envoyé sans validation explicite. La garantie
« au plus un envoi » repose sur `mail_drafts` (statuts `pending_review → sending → sent |
rejected | expired | sending_unconfirmed`) + index unique partiel `sent_gmail_id`.

**Points durs :**
- La transition atomique `UPDATE ... SET statut='sending' WHERE statut='pending_review'
  RETURNING` protège du double-approve concurrent. OK.
- MAIS l'index unique `sent_gmail_id` ne protège PAS la fenêtre ambiguë : si l'appel Gmail
  `messages.send` part mais que la réponse est perdue (timeout, 5xx, crash post-POST), le
  mail A PEUT être parti sans `gmail_id` enregistré. Revenir à `pending_review` = risque de
  DOUBLE ENVOI. C'est exactement le rôle du statut `sending_unconfirmed`.
- Gmail send n'a pas de clé d'idempotence native. Pour reconcilier, il faut poser un
  marqueur déterministe (Message-ID / header custom dérivé de `draft_id`) AVANT l'envoi,
  puis chercher dans « Sent » via `messages.list q="rfc822msgid:..."` avant tout renvoi.

**How to apply :** distinguer échec confirmé pré-transmission (DNS, connexion refusée, 400/
401/403) → retour `pending_review` sûr ; vs échec ambigu (timeout/5xx/réseau après POST) →
`sending_unconfirmed` + reconciliation obligatoire. En mode SANS Core il n'y a ni DBOS ni
scheduler drafts : prévoir un mécanisme explicite de reprise des drafts bloqués en
`sending`/`sending_unconfirmed` (sinon état mort). Voir [[sans-core-idempotence]].
