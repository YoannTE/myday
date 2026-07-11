---
name: pattern-cockpit-front-usage
description: Pièges front + journal d'usage MyDay (garde requireUser sur Client Component, fuseau serveur, allowlist usage_events, task_completed transition)
metadata:
  type: feedback
---

Points récurrents à vérifier sur les rounds « cockpit / pages interactives + journal d'usage » de MyDay.

**Why:** ces gaps passent la compilation et les tests basiques mais cassent en prod (auth, fuseau, métriques faussées).

**How to apply :**
1. **Garde auth** : `patterns.md` impose `requireUser()` sur les pages protégées. Un Client Component ne peut pas l'appeler. Pattern obligatoire : `page.tsx` Server Component `requireUser()` → rend un `<XClient/>` client qui fetch via `apiCall`. Ne pas faire de `page.tsx` pur client.
2. **Fuseau** : le conteneur prod tourne en UTC. « Heure locale serveur » ≠ heure utilisateur. Toute borne « jour » (timeline cockpit, pastille « maintenant ») doit figer `Europe/Paris` en config (pas de colonne TZ user aujourd'hui). Sinon décalage ~2h sur events proches de minuit.
3. **usage_events** : le CHECK autorise `dashboard_opened, brief_generated, brief_opened, task_completed, assistant_message_sent, mail_replied`. L'endpoint client doit **whitelister** (dashboard_opened/brief_opened/assistant_message_sent/mail_replied) et rejeter les serveur-side (`task_completed` ET `brief_generated`), pas juste blacklister task_completed.
4. **task_completed** : émettre côté serveur UNIQUEMENT sur transition réelle `a_faire→faite` (garde sur ancien statut), remettre `completed_at=NULL` au dé-cochage. Sinon double-comptage et completed_at figé.
5. **dashboard_opened** : fire-and-forget (pas d'await, pas de toast d'erreur, ne bloque pas le rendu ; attention double-mount StrictMode).

**Contrat de casse** : réponses API snake_case de bout en bout (SOP `api-response-casing-contract`), interfaces TS snake_case, `apiCall` ne transforme rien.
