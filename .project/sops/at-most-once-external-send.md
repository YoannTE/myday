# SOP — Garantir « au plus un envoi » pour un effet externe irréversible (mail)

**ID** : backend-at-most-once-external-send
**Catégorie** : Backend
**Difficulté** : advanced
**Tags** : envoi-mail, gmail, idempotence, irréversible, hitl, sending-unconfirmed, machine-etats
**Créé le** : 2026-07-11
**Origine** : Round 008 (assistant conversationnel) — envoi de mail validé par l'utilisateur

## Contexte

Un envoi de mail (ou tout POST externe irréversible sans clé d'idempotence native) doit garantir
**au plus un envoi**, même en cas de double-clic, retry réseau, ou crash. Combiné à la règle métier
« aucun envoi sans validation explicite ». Sans plateforme durable (DBOS), tout repose sur une
machine à états BDD + une réconciliation.

## Les 5 garde-fous (tous nécessaires)

1. **Validation hors-ligne (HITL sans pause durable)** : le run qui prépare le mail crée un
   brouillon `pending_review` et REND LA MAIN (jamais d'envoi dans le run). Seul un endpoint de
   décision explicite `POST /drafts/{id}/decision {approve}` peut envoyer. Un flag global
   (`allow_email_send`) coupe l'envoi si besoin (403).

2. **Transition atomique** : `UPDATE drafts SET statut='sending' WHERE id=$ AND statut='pending_review'
   RETURNING *`. Si 0 ligne → déjà en cours/traité → 409 (pas de second envoi). C'est le verrou.

3. **Pas de retry sur le POST d'envoi** : le helper HTTP générique réessaie souvent les 5xx → un
   retry = un second mail. L'appel d'envoi DOIT passer `max_retries=0`. Le retry, s'il existe, est
   une décision métier explicite, jamais automatique au niveau transport.

4. **Marqueur d'idempotence + réconciliation** (l'envoi n'a pas de clé native) : poser un
   `Message-ID` déterministe dérivé de l'id du brouillon (`<myday-{draft_id}@myday>`). Sur tout doute,
   chercher dans « Envoyés » : `messages.list q="rfc822msgid:<myday-{draft_id}@myday> in:sent"`.
   Trouvé → déjà parti, marquer `sent`, JAMAIS renvoyer. (Nécessite de récupérer `Message-ID` dans
   `get_message` metadataHeaders.)

5. **Classer l'échec — ne JAMAIS revenir à `pending_review` sur un doute** :
   - échec **pré-transmission** (connexion refusée, DNS, 4xx auth/format) → retour `pending_review`
     (rien n'est parti, correction + re-approve possible).
   - échec **AMBIGU** (timeout, 5xx, coupure APRÈS le POST) → statut dédié **`sending_unconfirmed`**.
     Le mail est peut-être parti : `sent_gmail_id` null ne protège pas. Reprise = réconciliation (#4),
     jamais un renvoi aveugle. Par prudence, toute exception non identifiée → `sending_unconfirmed`.

## Machine à états

`pending_review → sending → sent` (succès) · `sending → pending_review` (échec confirmé) ·
`sending → sending_unconfirmed` (échec ambigu) · `pending_review → rejected` (refus) ·
`pending_review → expired` (timeout de validation). Index unique partiel `sent_gmail_id` = filet BDD.

## Autres points

- **Token d'envoi hors verrou de sync** : ne pas réutiliser un helper qui pose le verrou de sync
  calendrier (renvoie `locked` pendant une sync). Helper dédié « access token valide » (refresh
  single-flight seul).
- **Garde-fou destinataire** : le `to` ne vient JAMAIS du LLM — toujours `parseaddr` de l'expéditeur
  du mail de référence ou une valeur validée. (Tester avec une adresse malveillante injectée.)
- **Cloisonnement** : `/decision` scopé `user_id` (sinon on envoie avec le token Google d'un autre).
- **Expiration** : sans timer, contrôler à la lecture/approbation (`pending_review` + âge > timeout →
  `expired`, approve refusé).
- **Test** : mocker le client d'envoi — NE JAMAIS envoyer un vrai mail en test. Couvrir : double
  approve → 1 envoi, échec ambigu → `sending_unconfirmed`, réconciliation trouvée → pas de renvoi,
  RLS autre user → 404.
