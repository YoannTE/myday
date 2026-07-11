# Plan d'exécution — Round 010 « Finitions »

## Objectif
Stabiliser et peaufiner avant l'usage quotidien de Yoann + Manon. Round transversal : audit + fixes
ciblés + 2 livrables concrets (vue admin du journal d'usage, docs de lancement). Pas de nouvelle
architecture risquée. Respecter scope-control : corrections chirurgicales, pas de refonte.

## Découpage

### Lead (moi) — Documentation + audit final
- Réécrire `README.md` (remplacer le boilerplate create-next-app) : pitch MyDay, prérequis (Docker,
  Node 20+, Python 3.12), lancement local pas-à-pas (`docker compose up -d`, `npm install`,
  `npm run db:migrate`, `npm run db:seed`, `npm run dev` + uvicorn), identifiants admin par défaut,
  liste des variables `.env.local` (dont `ANTHROPIC_API_KEY` optionnelle et `VAPID_*`), note sur le
  mode « règles » sans clé IA.
- Vérifier `.env.local.example` complet (toutes les variables réelles présentes, valeurs vides/placeholder).
- Smoke e2e final (navigateur) : parcours cockpit → recherche → assistant ; revue rapide des logs
  backend (pas d'erreur/traceback en fonctionnement nominal).

### Agent BACK — `fastapi-developer` — endpoint journal d'usage admin
- `backend/app/services/admin_usage.py` + `backend/app/api/admin.py` (MODIFIÉ, ajouter les routes) :
  - `GET /api/admin/usage` (auth **admin only** — vérifier le rôle comme les autres routes admin
    R002) → agrégats via le pool admin (données cross-user, tables hors RLS de contenu : usage_events,
    llm_usage sont scopées user mais l'admin agrège des MÉTADONNÉES de coût/usage, pas du contenu) :
    - `dashboard_opens_by_day` : count `usage_events` type `dashboard_opened` par jour sur 28 jours
      (critère de succès : 5j/7 sur 4 semaines) — retour liste `[{jour, count}]`.
    - `events_by_type` : count `usage_events` groupé par `type`.
    - `llm_cost` : somme `cost_usd` + tokens (`prompt_tokens`, `completion_tokens`) et par `agent`
      depuis `llm_usage` (baseline coût IA).
    - `active_users` : nb d'utilisateurs actifs (au moins 1 usage_event sur 7 jours).
  - Réponses snake_case `{"data": {...}}`. **Aucun contenu utilisateur** (mails/notes/tâches) — que
    des compteurs/métadonnées (règle de cloisonnement admin : jamais le contenu).
- Tests `backend/tests/test_admin_usage.py` : agrégats corrects, **403 pour un non-admin**, 401 sans cookie.
- NE PAS toucher aux autres services. Respecter le pattern admin existant (pool admin, garde rôle).

### Agent FRONT — `nextjs-developer` — vue usage admin + audit dark mode + polish
INVOQUE `frontend-design`.
1. **Vue journal d'usage** (dans l'onglet Administration des réglages) :
   `src/components/reglages/admin/usage-panel.tsx` — appelle `GET /api/admin/usage`, affiche :
   petit graphe/liste des ouvertures du dashboard sur 4 semaines (mini barres), compteurs d'usage par
   type, coût IA cumulé + par agent (baseline), nb d'utilisateurs actifs. Style AEVIO, cartes sobres.
   Monté sous la section admin existante (`admin-section.tsx`), sans casser invitations/comptes.
2. **Audit dark mode** : parcourir les pages/composants (cockpit, brief-hero, planning, notes, taches,
   mails, assistant, reglages, onboarding, recherche, cloche) et corriger les endroits qui ne
   respectent pas les tokens sémantiques (couleurs en dur qui ne basculent pas en `dark:`). Utiliser
   les CSS vars du thème (`bg-bg/text-ink/bg-soft/accent`) — corrections chirurgicales uniquement.
3. **États vides + polish** : vérifier que chaque section a un état vide soigné (déjà largement fait
   R004-R009) ; corriger les manques. Transitions douces (`.fade-in` déjà là). Accessibilité de base :
   `aria-label` sur les boutons icônes (loupe, cloche, mode sombre, menu), `alt` sur images, focus
   visible. Corrections ciblées, pas de refonte.
4. Vérifier la cohérence mobile finale (pas de débordement) sur les pages ajoutées récemment.
- Types snake_case. NE PAS toucher backend, ni la logique métier existante.

## Contrat API figé (snake_case)
- `GET /api/admin/usage` (admin) → `{"data": {dashboard_opens_by_day:[{jour, count}], events_by_type:
  {type: count}, llm_cost: {total_usd, prompt_tokens, completion_tokens, by_agent:[{agent, cost_usd,
  tokens}]}, active_users: n}}`

## Coordination
- `README.md`, `.env.local.example`, smoke final → lead. `api/admin.py` + `services/admin_usage.py`
  → BACK. `components/reglages/admin/usage-panel.tsx` + dark mode/polish/a11y (composants divers,
  chirurgical) → FRONT. FRONT code la vue contre le contrat figé.
- Anti-conflit : BACK ne touche que admin backend ; FRONT ne touche pas admin-section structurel au
  point de casser R002 (ajout d'un panneau, pas refonte).

## Tests fin de round
- Backend `pytest` (agrégats usage, 403 non-admin) + `ruff`. Redémarrer uvicorn ; `/api/admin/usage`
  401 sans cookie.
- Frontend `tsc` + build. Grep anti-camelCase.
- E2E : vue admin usage affiche les compteurs réels (dashboard_opened, coût IA) ; dark mode OK sur les
  pages clés (bascule ☾) ; recherche + assistant + cockpit sans régression.
- Adversarial : non-admin n'accède pas à l'usage (403 + onglet masqué) ; dark mode sans zone illisible.
- Vérif docs : `.env.local.example` complet ; README permet un lancement from scratch.

## Corrections review intégrées (PRIORITAIRES — architect)

1. **Frontière pool admin** : étendre le docstring de `create_admin_pool` (`backend/app/db/client.py`)
   pour whitelister explicitement la LECTURE d'agrégats de métadonnées d'usage (READ cross-user de
   compteurs, JAMAIS de contenu). Sinon le plan traverse silencieusement la frontière documentée R002.
2. **NE JAMAIS lire `usage_events.metadata`** (jsonb — peut contenir des bribes de contenu). Le SELECT
   admin lit uniquement `COUNT`, `type`, `created_at`, `user_id`. Test : la réponse ne contient AUCUNE
   clé de contenu.
3. **`cost_usd` = numeric → Decimal** : modèle Pydantic de réponse dédié (`models/admin_usage.py`),
   conversion explicite en `float` arrondi (`round(x, 4)`). Idem `by_agent`.
4. **Critère de succès PAR UTILISATEUR (bloquant produit)** : le critère est « chaque user (Yoann ET
   Manon) ≥ 5 jours/7 sur 4 semaines ». Un agrégat global ne le mesure pas. Retour :
   `active_days_by_user: [{user_label, weeks: [{semaine, jours_actifs}]}]` — **jours DISTINCTS** avec
   ≥1 `dashboard_opened` par user et par semaine (pas une somme d'ouvertures). `user_label` =
   email masqué ou nom (métadonnée compte, autorisée à l'admin).
5. **Combler les jours à 0** : `generate_series` sur 28 jours en `LEFT JOIN` (un jour sans ouverture
   doit apparaître, c'est justement ce qui compte pour « 5j/7 »).
6. **Fuseau du regroupement** : `date_trunc('day', created_at AT TIME ZONE 'Europe/Paris')` (sinon les
   ouvertures autour de minuit tombent sur le mauvais jour et faussent le comptage).
7. **Déterminisme** : `ORDER BY` explicite partout (jours, by_agent, events_by_type).
8. **Dark mode / a11y = strictement chirurgical (anti-régression)** : modifications limitées aux
   `className`/tokens (`bg-bg`, `text-ink`, `bg-soft`, `accent`, `dark:`) — AUCUN changement de
   structure JSX, de props, de handlers ni de logique. Le lead vérifie le `git diff` (styling only) +
   `tsc` + build après FRONT. Ne PAS introduire de vert (`--success`=accent).

## Contrat API révisé (correction #4)
- `GET /api/admin/usage` (admin) → `{"data": {active_days_by_user:[{user_label, weeks:[{semaine,
  jours_actifs}]}], events_by_type:{type: count}, llm_cost:{total_usd (float), prompt_tokens,
  completion_tokens, by_agent:[{agent, cost_usd (float), tokens}]}, active_users: n}}`

## Risques / vigilance
1. **Cloisonnement admin** : la vue usage ne montre QUE des métadonnées/compteurs, JAMAIS le contenu
   (mails/notes) — règle métier absolue. Vérifier côté endpoint.
2. **Dark mode** : corrections chirurgicales via tokens, ne pas introduire de vert (`--success`=accent).
3. **Scope-control** : round de finitions = polish ciblé, pas de nouvelles features ni refonte.
4. Casse snake_case : contrat figé, grep.
5. Le round ne casse aucun des 9 rounds précédents (régression) : build + pytest complets.
