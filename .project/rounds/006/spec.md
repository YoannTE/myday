---
id: "006"
title: "L'IA entre en scène : tri des mails"
status: "done"
depends_on: ["005"]
---

## Objectifs

Palier 2 — le workflow mail_triage et la page mails : les mails importants remontent, triés, résumés, avec la boucle de feedback.

## Périmètre

- [ ] Workflow mail_triage : implémentation conforme à `.project/agent-designs/mail_triage.md` (pré-filtre heuristique, scoring LLM par lot avec fallback, résumés, persistance idempotente, notifications plafonnées, déclenché par google_sync)
- [ ] F7 - Mails intelligents (lecture) : page mails (liste scorée + mail ouvert avec résumé IA et raison du score, filtres, « 12 mails écartés »), section Mails importants du dashboard branchée
- [ ] Boucle de feedback : boutons « Important / Pas important » → préférenceExpéditeur → pré-filtre du run suivant
- [ ] Réglages du tri exposés via @configurable (seuil, modèles, plafonds) — visibles dans le dashboard Core

## Mockups liés

- F7 : pages/mails.html + png/mails.png
- Section dashboard : pages/dashboard.html (Mails importants) + png/dashboard.png

## Tests fin de round

<!-- À compléter par /round-plan -->

## Compte-rendu

**Date** : 2026-07-11
**Statut final** : done

**Livré**
Le premier round IA. Workflow `mail_triage` implémenté en service FastAPI (pré-filtre heuristique,
scoring, résumés, persistance idempotente, notifications plafonnées), déclenché par `google_sync`
et à la demande (`POST /api/triage/refresh`). Page `/mails` (liste scorée, filtres Importants/Tous,
« X écartés », mail ouvert avec score + raison + résumé/extrait, boutons Important/Pas important).
Boucle de feedback (feedback → `sender_preferences` important/muet → pré-filtre du run suivant +
reclassement immédiat des mails du même expéditeur). Section « Mails importants » du cockpit branchée.
Validé end-to-end sur 24 mails réels : 12 importants, notifications plafonnées à 3, idempotent,
feedback met un expéditeur en sourdine (score 5).

**Décisions techniques**
- **SANS plateforme Core** (décision Round 003) : agent implémenté en service FastAPI normal, pas
  de @workflow/@step/@configurable/DBOS. Le design `agent-designs/mail_triage.md` = spéc fonctionnelle.
  Pattern capitalisé en SOP `agent-design-to-fastapi-service` (resservira aux Rounds 007/008).
- **Règles d'abord, IA plus tard** (choix utilisateur) : aucune clé `ANTHROPIC_API_KEY` → fallback
  heuristique = chemin nominal. Client Anthropic « prêt-pour-IA » : s'active par la seule présence
  de la clé (score fin + résumés), sans autre changement de code.
- Plan reviewé par architect + lead-dev (12 corrections intégrées : trigger hors verrou sync,
  advisory lock, persist par ligne via VALUES, normalisation email unique, notifications.contenu
  non-null, seuil unique, prompts sans to_type, Anthropic sans response_format, etc.).
- AUCUNE migration (schéma mails/sender_preferences/notifications déjà posé au Round 001).
- Cloisonnement PII strict : aucun contenu de mail dans les logs.

**Bugs et blocages**
- 2 findings mineurs corrigés : (1) les notifications ignoraient la préférence utilisateur
  `notif_important_mail` (Round 005) → corrigé ; (2) type `MailsImportantsData.mails` non-optionnel
  alors que le back l'omet en mode placeholder → rendu optionnel + guard.
- Modèle de réponse partagé (`cockpit.py` du Round 004) avalait silencieusement la nouvelle clé
  `mails` → assoupli en `dict` (garde-fou documenté dans patterns.md).
- Limite assumée du mode règles : scores heuristiques imparfaits (PayPal/Boulanger surestimés) ;
  le LLM affinera dès qu'une clé est fournie.

**Enseignements**
- Un modèle de réponse Pydantic partagé entre rounds doit rester ouvert (`dict`) sur les
  sous-structures amenées à évoluer, ou être repris par le round qui change leur forme — sinon la
  nouvelle clé est droppée silencieusement (bug invisible, cf. SOP casse).
- Un flag global de config ne remplace pas une préférence par-utilisateur : vérifier les deux.

**Endpoints exposés / modifiés**
- POST `/api/triage/refresh` · GET `/api/mails` · GET/PATCH `/api/mails/{id}` ·
  POST `/api/mails/{id}/feedback`
- GET `/api/cockpit` (modifié : `mails_importants` réels)
- `google_sync` (modifié : déclenche le tri après la sync, hors verrou)
