---
name: project-myday
description: Contexte projet MyDay — cockpit personnel unifié Google + IA, périmètre MVP F1-F13 et concentration du risque
metadata:
  type: project
---

MyDay : cockpit personnel unifié (Google Agenda + Gmail via OAuth, to-do/notes natives, brief IA, assistant conversationnel). Stack dual-stack FastAPI + Next.js + Postgres, Agent Platform activée, PWA, accès sur invitation, utilisateur final non technique.

**Why:** l'utilisateur développe tout via Claude Code sans compétence technique — les risques d'infra/intégration doivent être explicités très tôt, il ne les détectera pas seul.

**How to apply:** dans toute revue MyDay, le risque et la valeur se concentrent sur 4 modules « lourds » : **F2 (connexion Google)**, **F4 (sync bidirectionnelle Agenda)**, **F7 (mails IA)**, **F9 (assistant conversationnel)**. Les traiter comme des chantiers pluri-semaines, pas des features parmi d'autres. F5/F6/F13 sont des CRUD simples. Séquencer : socle+F2 en mode test → CRUD natifs → F4 → F7 → F8/F9 → durcissement. Voir [[risk-google-oauth-restricted]], [[risk-bidirectional-sync]], [[constraint-agent-platform-runtime]].
