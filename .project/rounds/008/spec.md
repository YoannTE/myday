---
id: "008"
title: "Assistant conversationnel"
status: "done"
depends_on: ["007"]
---

## Objectifs

Palier 3 — le différenciateur : l'agent à qui tu parles, avec la validation obligatoire avant tout envoi de mail.

## Périmètre

- [ ] Workflow assistant_conversationnel : implémentation conforme à `.project/agent-designs/assistant_conversationnel.md` (plan d'actions LLM, create_task/create_note/create_event/query_data/draft_email, HITL wait_for_review, send_email at-most-once, 2 @safe_step avec reprise sur erreur)
- [ ] F9 - Chat assistant : page conversation (bulles + badges d'actions, carte de validation Approuver/Modifier/Refuser avec expiration, suggestions), barre assistant de la navbar branchée (⌘K) sur tous les écrans
- [ ] Intégration mails : « Répondre avec l'assistant » depuis un mail ouvert (brouillon contextuel)
- [ ] Garde-fous : allow_email_send, anti-spam 10 messages/min, clarifications conversationnelles

## Mockups liés

- F9 : pages/assistant.html + png/assistant.png
- Barre navbar : shared/components/navbar.html (tous les écrans)
- Depuis un mail : pages/mails.html (bouton « Répondre avec l'assistant »)

## Tests fin de round

<!-- À compléter par /round-plan -->

## Compte-rendu

**Date** : 2026-07-11
**Statut final** : done

**Livré**
Le différenciateur n°1. Assistant conversationnel (service FastAPI) : plan d'actions LLM →
create_task/create_note/create_event/query_data/draft_email, réponse composée, persistance des tours.
Page chat `/assistant` (bulles, badges d'actions, carte de validation Approuver/Modifier/Refuser,
suggestions), barre navbar ⌘K sur tous les écrans, « Répondre avec l'assistant » depuis un mail.
**Règle métier absolue tenue** : aucun mail envoyé sans validation explicite (le run ne peut jamais
envoyer ; seul l'endpoint de décision `approve` envoie). Validé end-to-end avec la VRAIE IA :
l'assistant crée une tâche en langage naturel (priorité + date relative résolues).

**Décisions techniques**
- Clé Anthropic ajoutée par l'utilisateur → IA active (débloque aussi tri R006 + brief R007 en vraie IA).
- HITL adapté « SANS Core » : pas de pause durable → machine à états `mail_drafts` + endpoint de
  décision hors-ligne. Garantie « au plus un envoi » : transition atomique `WHERE statut='pending_
  review'`, `send_message` `max_retries=0`, Message-ID déterministe + réconciliation `rfc822msgid`,
  statut `sending_unconfirmed` sur échec ambigu (jamais renvoi aveugle). → SOP `at-most-once-external-send`.
- Idempotence par `turn_key` (dédup en tête, action_key dérivés). Garde-fou destinataire post-LLM.
  Token d'envoi hors verrou sync. Plan reviewé (17 corrections avant implémentation).
- AUCUNE migration (assistant_conversations/turns, mail_drafts déjà posés).

**Bugs et blocages**
- Bugs d'intégration IA surfacés au 1er vrai appel LLM (les tests mockaient), tous corrigés :
  (1) extraction JSON robuste dans `complete_json` (fences/texte) — touchait aussi tri+brief ;
  (2) date du jour injectée dans le prompt (résolution des dates relatives) ; (3) tolérance clé
  `type`/`action` + prompt explicité ; (4) fixture conftest neutralisant la clé (tests offline
  déterministes). → SOP IA mis à jour.
- 1 finding cosmétique accepté (libellé expiration 24h codé en dur = valeur par défaut).

**Enseignements**
- Le premier vrai appel LLM révèle des bugs invisibles avec des mocks (parsing, date, format de clés) —
  et un seul (`complete_json`) débloque/casse toutes les features IA à la fois.
- Une clé réelle en `.env.local` casse les tests fallback → neutraliser la clé en conftest.
- Envoi irréversible : « au plus un envoi » exige 5 garde-fous combinés (validation hors-ligne,
  transition atomique, pas de retry transport, marqueur+réconciliation, classement échec ambigu).

**Endpoints exposés**
- POST `/api/assistant/message` · POST `/api/assistant/conversations` · GET `/api/assistant/conversations/{id}`
- GET `/api/assistant/drafts/{id}` · POST `/api/assistant/drafts/{id}/decision` (approve/reject)
