---
id: "007"
title: "Brief IA quotidien"
status: "done"
depends_on: ["006"]
---

## Objectifs

Palier 2 — le moment signature : le brief généré chaque matin, à la demande, et en fin d'onboarding.

## Périmètre

- [ ] Workflow daily_brief : implémentation conforme à `.project/agent-designs/daily_brief.md` (collecte bornée, rédaction LLM avec 3 tons et garde-fou anti-hallucination, brief dégradé de secours, brief « journée calme », upsert anti-doublon, notification « brief prêt »)
- [ ] F8 - Brief sur le dashboard : carte hero branchée (accroche, priorités, alertes, état dégradé discret), bouton « Régénérer » (anti-spam 1/min)
- [ ] Déclencheurs : scheduler à l'heure choisie (préférence utilisateur), à la demande, et fin d'onboarding (brancher l'étape 4 du round 005)
- [ ] Réglages du brief : heure + ton dans les réglages (reliés à la config @configurable du workflow)

## Mockups liés

- F8 : pages/dashboard.html (carte hero) + png/dashboard.png
- Fin d'onboarding : pages/onboarding.html (étape 4) + png/onboarding.png

## Tests fin de round

<!-- À compléter par /round-plan -->

## Compte-rendu

**Date** : 2026-07-11
**Statut final** : done

**Livré**
Le moment signature. Workflow `daily_brief` en service FastAPI (collecte bornée du contexte du
jour → rédaction avec 3 tons + garde-fou anti-hallucination → brief dégradé de secours → brief
« journée calme » → upsert anti-doublon → notification « brief prêt »). Carte hero F8 en tête du
cockpit (accroche, priorités, synthèses planning/tâches/mails, alertes, état dégradé « brief
express » discret, bouton Régénérer avec anti-spam). Trois déclencheurs : scheduler à l'heure
choisie (préférence, catch-up idempotent par utilisateur/fuseau), à la demande (`POST /api/brief/
generate`, anti-spam 1/min), et fin d'onboarding (étape 4). Ton du brief dans les réglages
(`user_preferences.brief_tone`). Validé end-to-end : brief dégradé généré pour l'admin (headline +
3 priorités + alerte « données non actualisées » + jsonb structuré), visible dans la carte hero.

**Décisions techniques**
- Réutilise le pattern IA Round 006 (SANS Core, règles-first) : brief **dégradé** (déterministe,
  même schéma `BriefContent`) = chemin nominal sans clé ; prêt-pour-IA dès qu'une clé Anthropic est
  fournie. Client LLM `mail_triage.llm.complete_json` réutilisé (renvoie un dict brut → validation
  `BriefContentModel` côté appelant).
- Plan reviewé (9 corrections : validation Pydantic du dict, jsonb `json.dumps`/`::jsonb`+`json.loads`,
  scheduler `max_instances=1`/`coalesce`/`wait_for`/`WHERE onboarding_completed=true`, upsert
  `WHERE type='quotidien'`, cohérence fuseau persist↔lecture cockpit, garde-fou anti-hallucination
  chemin LLM uniquement, ton depuis user_preferences).
- Migration : `brief_tone` ajouté à `user_preferences` (CHECK neutre/motivant/direct). Table `briefs`
  déjà posée (contenu jsonb, unique partiel quotidien). Mapping trigger→type : scheduled→quotidien
  (upsert), manual/onboarding→a_la_demande.
- 2 AsyncIOScheduler distincts (google + brief) dans le même event loop, sans conflit.

**Bugs et blocages**
- 2 findings corrigés : (1) [MOYEN] `compose.py` — `except` élargi à `Exception` pour que TOUTE
  défaillance LLM (y compris erreurs Anthropic réseau/API) bascule sur le brief dégradé (filet
  systématique, « prêt-pour-IA ») → SOP mis à jour ; (2) [BAS] copy de l'étape finale d'onboarding
  corrigée (le brief est prêt, plus « arrive bientôt »).

**Enseignements**
- `complete_json` renvoie un dict brut → valider le schéma soi-même ET catcher `Exception` (pas
  seulement `LlmUnavailable`/`ValidationError`) pour que le fallback soit un filet systématique.
- Cohérence de fuseau à respecter des DEUX côtés (génération ET lecture cockpit), sinon brief
  invisible pour un utilisateur hors du fuseau serveur.

**Endpoints exposés / modifiés**
- POST `/api/brief/generate` (manual/onboarding, anti-spam 429)
- GET `/api/cockpit` (modifié : clé `brief`)
- PATCH `/api/preferences` (modifié : `brief_tone`)
- scheduler brief (nouveau, dans le lifespan)
