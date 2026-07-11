# SOP — Contrat de casse des réponses API (snake_case) entre FastAPI et le frontend

**ID** : general-api-response-casing-contract
**Catégorie** : General
**Difficulté** : intermediate
**Tags** : api-contract, snake-case, pydantic, typescript, dual-stack, serialization
**Créé le** : 2026-07-10
**Origine** : Round 003 (Connexion Google) — bug bloquant, 2 itérations QA

## Symptôme

Le frontend affiche des valeurs vides / des états par défaut permanents alors
que l'API renvoie bien les données : une carte reste « Pas encore synchronisé »,
une fraîcheur ne s'affiche jamais, une bannière conditionnelle ne se déclenche
jamais. Aucune erreur console, aucune 4xx/5xx — les champs lus valent juste
`undefined`.

## Cause racine

Désalignement de casse entre la réponse JSON de l'API et les accès côté
frontend. Dans ce projet dual-stack :

- **FastAPI / Pydantic** sérialise en **snake_case** (nom des attributs du
  modèle), SANS alias camelCase. `model_dump()` produit donc
  `calendar_synced_at`, `reauth_required`, `last_manual_sync_at`.
- **Le helper `src/lib/api.ts` (`apiCall`) ne transforme AUCUNE clé** : le JSON
  arrive tel quel dans le code TypeScript.
- Si le composant / l'interface TS lit `calendarSyncedAt` (camelCase par réflexe
  JS), la valeur est `undefined` en silence → l'UI retombe sur son état par défaut.

C'est un bug **silencieux** : ça compile (TS ne détecte rien si l'interface est
elle-même en camelCase), ça ne lève aucune exception au runtime.

## Convention du projet (source de vérité)

**Les réponses API sont en snake_case, de bout en bout.** Confirmé sur plusieurs
domaines : `last_connexion`, `invite_url` (admin R002), `calendar_synced_at`,
`gmail_synced_at`, `reauth_required` (Google R003).

- Côté FastAPI : modèles Pydantic en snake_case, PAS d'`alias`/`populate_by_name`
  camelCase. `model_dump()` sans `by_alias`.
- Côté frontend : les interfaces TS qui typent une réponse API DOIVENT être en
  snake_case, et le code les lit en snake_case.
- Le seul endroit où le camelCase est légitime : les **noms de propriétés Drizzle**
  dans `src/lib/db/schema/*.ts` (mappés explicitement vers des colonnes SQL
  snake_case via `timestamp("calendar_synced_at", ...)`). Ce n'est PAS une
  consommation de réponse API — ne pas confondre.

## Checklist anti-bug (à appliquer dès qu'on crée/consomme un endpoint)

1. Le modèle Pydantic de réponse est en snake_case, sans alias camelCase.
2. L'interface TypeScript qui type cette réponse est en snake_case, champ pour
   champ, identique au modèle Pydantic.
3. Aucun accès camelCase dans les composants qui lisent cette réponse.
   Vérification rapide :
   ```bash
   # Adapter les noms de champs au domaine. Attendu : 0 hit hors src/lib/db/schema/.
   grep -rnE "calendarSyncedAt|gmailSyncedAt|reauthRequired|lastManualSyncAt" src/ \
     | grep -v "src/lib/db/schema/"
   ```
4. `apiCall` (`src/lib/api.ts`) ne fait aucune conversion de casse — ne pas
   compter dessus pour « corriger » un camelCase côté composant.
5. Test de non-régression le plus simple : afficher la donnée réelle dans l'UI
   et vérifier visuellement qu'elle n'est pas à l'état par défaut (une valeur
   `undefined` passe tous les tests de compilation mais pas l'œil).

## Règle de décision

Si un jour on veut du camelCase côté frontend, on l'impose **d'un seul côté et
explicitement** (alias Pydantic `by_alias=True` OU couche de mapping dans
`apiCall`), jamais en laissant chaque composant deviner. Tant que la convention
projet est snake_case, on ne mélange pas.
