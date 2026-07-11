---
name: pattern-securite-jetons-oauth
description: Standard de stockage des jetons OAuth de fournisseurs tiers (Google, etc.) — chiffrement enveloppe, clé hors BDD
metadata:
  type: feedback
---

« Jetons chiffrés » n'est pas une architecture. Un brief qui décrit le stockage des refresh tokens tiers avec un seul adjectif doit être challengé.

**Why:** si les jetons sont chiffrés avec une clé lisible par tout le backend, une faille SSRF/RCE = accès total aux comptes Google/mails de tous les utilisateurs. Impact réputationnel maximal.

**How to apply:** exiger dans decisions.md un chiffrement applicatif par enveloppe : refresh_token en AES-256-GCM, clé maître (TOKEN_ENCRYPTION_KEY) hors BDD (env/secret manager, jamais commitée). Déchiffrement uniquement dans le @step de sync. Règle dure : jetons jamais renvoyés au client, jamais journalisés. Ne pas réutiliser la table `account` de Better-auth pour ces jetons (scopes/cycle de vie différents, pas de chiffrement). Voir [[pattern-resilience-sync-tierce]].
