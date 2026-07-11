# Mémoire Architecte — MyDay

Index des mémoires réutilisables pour les revues d'architecture de ce projet.

- [MyDay — contexte & contraintes archi](projet-myday-contexte.md) — cockpit perso Google+IA, dual-stack DBOS, points durs récurrents
- [Enforcement cloisonnement dual-stack](pattern-enforcement-cloisonnement.md) — RLS + scoping obligatoire, asyncpg n'a pas de scoping auto
- [Sécurité jetons OAuth tiers](pattern-securite-jetons-oauth.md) — chiffrement enveloppe, clé hors BDD, jamais vers client/logs
- [Résilience sync API tierce](pattern-resilience-sync-tierce.md) — curseurs incrémentaux, conflits, révocation, quotas
- [Signup sur invitation Better-auth](pattern-invitation-signup-betterauth.md) — consommation atomique, enums sans accent, bypass seed, CHECK à étendre
- [OAuth dual-stack enforcement](pattern-oauth-dualstack-enforcement.md) — jetons via app_rls jamais pool admin, piège port callback :3000/:8000, state lié session, tokenExpiry
- [Écriture events Google/MyDay](pattern-ecriture-event-google-myday.md) — réutiliser push sync_pending, sync_error dead-end, résurrection au pull, patch/delete client manquants
- [Cockpit front + usage](pattern-cockpit-front-usage.md) — requireUser sur Server Component parent, fuseau serveur UTC, allowlist usage_events, task_completed transition
- [Push notifications MyDay](pattern-push-notifications-myday.md) — table appareil partagé (unique endpoint + cleanup admin), pont notif hors connexion tenue, fenêtre rappels borne haute, fallback email en boucle
