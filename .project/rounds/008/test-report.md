# Rapport de test — Round 008 « Assistant conversationnel »

**Date** : 2026-07-11
**Verdict** : PASS
**Itérations** : 1 (0 bug bloquant ; bugs d'intégration IA corrigés + 1 finding cosmétique accepté)
**Stack** : dual-stack (Next.js 16 :3000 + FastAPI :8000 + Postgres + MinIO)
**Contexte** : clé ANTHROPIC présente (IA ACTIVE). Règle métier ABSOLUE : aucun mail envoyé sans
validation explicite. Envoi = effet externe IRRÉVERSIBLE.

## Smoke

| Test | Résultat |
|---|---|
| Backend `pytest -q` | **202 passed** (~22s — offline/déterministe grâce au fixture de neutralisation de clé) |
| Backend `ruff check app tests` | All checks passed |
| Frontend `npx tsc --noEmit` | 0 erreur |
| Frontend `npm run build` | Succès (`/assistant` généré) |
| Endpoints assistant sans cookie (`message`, `conversations`, `drafts/{id}`, `drafts/{id}/decision`) | 401 |
| `/health` | 200 |
| Contrat snake_case | conforme (types de contrat API 100% snake_case) |

## Assistant réel end-to-end (lead, IA active)

- Dans l'UI `/assistant` : « Ajoute une tâche : préparer la présentation pour lundi prochain, c'est
  urgent » → réponse « C'est fait ! J'ai créé ta tâche « Préparer la présentation pour lundi
  prochain » avec une priorité haute pour le 13 juillet 2026. » + badge d'action. **La vraie IA
  comprend, déduit la priorité (« urgent » → haute), résout la date relative (« lundi prochain » →
  13 juillet), crée la tâche.** Le différenciateur fonctionne.
- Page chat : bulles user/assistant, badges d'actions, chips de suggestions, composer, navbar ⌘K.

## Adversarial (qa-tester) — 17 corrections vérifiées (FOCUS SÉCURITÉ ENVOI)

**Garantie « au plus un envoi »** : `send_message` `max_retries=0` (jamais de retry sur POST send) ;
Message-ID déterministe `<myday-{draft_id}@myday>` ; classification échec pré-transmission →
`pending_review` vs AMBIGU (timeout/5xx) → `sending_unconfirmed` (jamais pending_review) ;
réconciliation `rfc822msgid:...in:sent` avant tout renvoi ; transition atomique
`UPDATE ... WHERE statut='pending_review' RETURNING` (0 row → 409) + unique `sent_gmail_id`.
Tests : double-approve → 1 envoi, réconciliation → pas de renvoi.
**Garde-fou destinataire** : `to` écrasé par `parseaddr(expediteur)`/planner, JAMAIS le `to` du LLM
(testé avec adresse malveillante ignorée). **Dédup `turn_key`** en tête d'orchestrateur (double
message → 1 exécution). **Token d'envoi hors verrou sync**. **`/decision` scopé user_id** (autre
user → 404). **Validation Pydantic** du plan + params par type. **Expiration** → `expired`.
**PII** : aucun contenu message/mail dans les logs. Le run ne peut JAMAIS envoyer (seul `/decision`
`approve` envoie).

## Bugs trouvés

### Corrigés (intégration IA — surfacés au premier vrai appel LLM, les tests mockaient)

1. **[BLOQUANT UX]** `complete_json` (partagé) faisait `json.loads(text)` brut → échouait sur les
   réponses réelles (JSON entouré de ```json fences / texte). **Touchait aussi le tri (R006) et le
   brief (R007).** Corrigé : `_extract_json` robuste (fences + sous-chaîne `{...}`). → SOP mis à jour.
2. **[BLOQUANT UX]** Le plan LLM ne recevait pas la date du jour → l'assistant demandait « quelle
   date ? » pour toute échéance relative. Corrigé : date+heure (timezone) injectées dans le prompt.
3. **[MAJEUR]** L'IA renvoyait la clé `"action"` au lieu de `"type"` → action écartée. Corrigé :
   prompt explicité (« la clé est TOUJOURS "type" » + exemple) + lecture tolérante (`type` ou `action`).
4. **[MAJEUR]** Les tests fallback (tri heuristique, brief dégradé) cassaient/ralentissaient une fois
   la vraie clé en `.env.local` (chemin LLM au lieu de fallback). Corrigé : fixture `autouse` conftest
   qui neutralise `anthropic_api_key` (tests offline déterministes). → SOP mis à jour.

### Accepté (cosmétique)

- `draft-card.tsx` : « Expire sous 24 h » codé en dur (= valeur par défaut `assistant_hitl_timeout_
  hours`, non exposée au front). Non corrigé : plomber la config jusqu'au front serait sur-ingénierie.

## Parcours à valider par toi

1. **Valider un brouillon de mail avant envoi (tu gardes le contrôle)**
   - Où : http://localhost:3000/mails → ouvre un mail → « Répondre avec l'assistant ».
   - Fais : laisse l'assistant préparer une réponse → regarde la carte (destinataire, objet, texte) →
     « Modifier » une phrase → « Approuver et envoyer » (ou « Refuser »).
   - Tu dois voir : **rien ne part tant que tu n'as pas cliqué « Approuver et envoyer »**. Après
     Approuver → « Mail envoyé ✓ ». Refuser → « Brouillon refusé », rien n'est envoyé.

2. **Créer une tâche en parlant à l'assistant**
   - Où : http://localhost:3000, barre « Dis-moi quoi faire… » (ou ⌘K / Ctrl+K) → « ajoute une tâche
     urgente : appeler le comptable avant vendredi » → Entrée.
   - Tu dois voir : une réponse qui confirme la tâche (bonne priorité, bonne date) ; la tâche apparaît
     dans la page Tâches.

3. **Poser une demande ambiguë**
   - Où : http://localhost:3000/assistant → « écris un mail » (sans dire à qui).
   - Tu dois voir : l'assistant N'invente PAS de destinataire et ne crée PAS de brouillon seul — il
     pose une question de clarification.

BEGIN_QA_RESULT_JSON
{
"schema": "reborn.qa.testRound.result.v1",
"roundId": "008",
"mode": "happy-path-and-adversarial",
"verdict": "PASS",
"validatedByExtension": false,
"iterations": 1,
"findings": [
{"severity": "blocker-ux", "file": "backend/app/services/mail_triage/llm.py", "status": "fixed", "description": "extraction JSON robuste (fences/texte) — débloque aussi tri + brief en vraie IA"},
{"severity": "major", "file": "backend/app/services/assistant/plan.py", "status": "fixed", "description": "date du jour dans le prompt + clé type/action tolérante"},
{"severity": "major", "file": "backend/tests/conftest.py", "status": "fixed", "description": "fixture autouse neutralise la clé (tests offline déterministes)"},
{"severity": "low", "file": "src/components/assistant/draft-card.tsx", "status": "accepted", "description": "libellé expiration 24h codé en dur (= défaut)"}
]
}
END_QA_RESULT_JSON
