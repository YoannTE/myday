# Test Report — Round 001 « Fondations »

Date : 2026-07-10
Verdict final : **PASS** (itération 2)
Validation : `validatedByExtension: false` — les tools d'extension QA (`qa_round_inventory`,
`qa_report_validate`, `qa_final_report_write`) sont indisponibles en mode CLI standalone.
Fallback appliqué : inventaire construit depuis `log.md`, rapports du qa-tester validés
manuellement par le lead (structure + verdict recalculé depuis les blocs
`BEGIN_QA_RESULT_JSON`), rapport final écrit par le lead.

## Itérations

### Itération 1 — verdict FAIL (5 bugs)

Couverture : smoke 7/7 · docker 9/10 · playwright 11/11 (Chromium réel) · adversarial 9/9

| Bug | Sévérité | Description | Correctif |
| --- | --- | --- | --- |
| BUG-1 | critique | `Dockerfile.web` ne copiait pas `drizzle/` dans le stage runner → conteneur incapable de démarrer sur une base fraîche (prouvé par run réel) | `COPY --from=builder /app/drizzle ./drizzle` ajouté |
| BUG-2 | majeur | Accents manquants dans l'UI (`auth-form.tsx` : « Echec », « Creer », « Deja »...) | Corrigés |
| BUG-3 | mineur | Accents manquants (`sign-out-button.tsx`) | Corrigés |
| BUG-4 | majeur | Redirection post-login vers `/dashboard` (ancienne page starterkit) au lieu du cockpit `/` | `auth-form` → `/` (2 occurrences) + `/dashboard` devenue redirection vers `/` |
| BUG-5 | mineur | `CardTitle` sans sémantique heading (accessibilité `/sign-in`, `/sign-up`) | `role="heading"` + `aria-level={2}` |

### Itération 2 — verdict PASS

Couverture : smoke 5/5 · docker 6/6 · playwright/HTTP 7/7 · adversarial 4/4

- Les 5 correctifs revérifiés en conditions réelles. Test décisif BUG-1 : image web
  buildée puis lancée contre une **base de données vierge** → migrations appliquées
  (advisory lock), admin seedé, serveur démarré, pages servies.
- 2 nouveaux bugs mineurs (accents hors périmètre initial : `sign-up/page.tsx`
  metadata, `seed.ts` console.error) → **corrigés par le lead immédiatement après
  l'itération 2**, vérifiés par grep global (0 chaîne non accentuée restante) + tsc.

## Couverture adversariale (points clés prouvés)

- Inscription publique refusée (`EMAIL_PASSWORD_SIGN_UP_DISABLED`) — accès sur invitation respecté
- Auth cross-stack : cookie falsifié → 401 « Signature de session invalide » ; token signé
  mais inconnu → 401 ; session expirée → 401 ; sans cookie → 401
- RLS fail-closed prouvée en SQL : sans `app.current_user_id` → 0 ligne ; avec le mauvais
  user → 0 ligne ; avec le bon → sa ligne uniquement
- JSON malformé sur l'API d'auth → 400 propre (pas de 500)
- `/health` insensible aux query params hostiles

## Bugs corrigés au total : 7 (1 critique, 2 majeurs, 4 mineurs)

## Parcours à valider par toi

1. **Se connecter et voir le nouveau tableau de bord**
   - Où aller : ouvre http://localhost:3000
   - Ce que tu fais : connecte-toi avec `admin@admin.com` / `password`
   - Ce que tu dois voir : la page avec « Ton cockpit arrive », la barre du haut avec
     la date du jour en français, la barre de l'assistant et ton avatar

2. **Vérifier le rendu du mode sombre sur mobile**
   - Où aller : ouvre l'app sur ton téléphone (ou réduis la fenêtre du navigateur)
   - Ce que tu fais : connecte-toi, puis appuie sur le petit bouton rond en haut à droite (l'icône de lune)
   - Ce que tu dois voir : les couleurs basculent en sombre, tout reste lisible et
     bien aligné, et ton choix est retenu quand tu recharges la page
