# Test Report — Round 002 « Comptes et invitations »

Date : 2026-07-10
Verdict final : **PASS** (itération 2)
Validation : `validatedByExtension: false` — tools d'extension QA indisponibles en CLI
standalone (même fallback documenté qu'au Round 001 : inventaire depuis log.md, rapports
qa-tester validés manuellement par le lead via les blocs BEGIN_QA_RESULT_JSON).

## Itérations

### Itération 1 — verdict FAIL (4 bugs)

Couverture : smoke 7/7 · docker 7/7 · playwright 27/29 · adversarial 23/23
Parcours réels complets prouvés : invitation → preview (sans fuite d'email) → signup
avec jeton → compte + acceptee → login ; double signup concurrent → 1 seul compte ;
reset de mot de passe de bout en bout (lien loggé serveur) ; désactivation → session
tuée ; DELETE /api/me → cascade vérifiée en SQL ; gardes dernier-admin (PATCH + DELETE) ;
403 non-admin partout ; onglet admin invisible pour un non-admin.

| Bug | Sévérité | Description | Correctif |
| --- | --- | --- | --- |
| 1 | majeur | Message de connexion en anglais (« Invalid email or password ») | Mapping français par code + regex dans sign-in-form.tsx (« Email ou mot de passe incorrect ») |
| 2 | mineur | Warning d'hydratation React (dark mode, préexistant R001) | `suppressHydrationWarning` sur `<html>` |
| 3 | mineur | Commentaires non accentués (4 fichiers) | Corrigés (valeurs techniques ASCII intactes, prouvé par grep) |
| 4 | mineur | Texte danger-zone trompeur (révocation Google pas encore implémentée) | Texte exact : « Tes mails et ton agenda Google ne sont pas touchés. » |

### Itération 2 — verdict PASS (0 bug)

Couverture ciblée : smoke 5/5 · docker 2/2 · playwright 9/9 · adversarial 3/3
- « Email ou mot de passe incorrect » affiché (mauvais mdp ET email inconnu — pas de
  fuite d'information) ; « Compte désactivé » intact
- 0 warning d'hydratation en dark mode ; texte danger-zone conforme ; accents propres
- Non-régression : signup par invitation OK, 401/403 corrects
- Découverte documentée : rate-limit natif Better-auth sur /sign-in (3 req/10 s) —
  comportement de sécurité normal du framework

## Bugs corrigés au total : 4 (1 majeur, 3 mineurs)

## Parcours à valider par toi

1. **Inviter quelqu'un et créer son compte** (LE parcours du round)
   - Où aller : connecte-toi en admin, va dans Réglages → onglet Administration
   - Ce que tu fais : tape un email dans « Inviter quelqu'un » → Envoyer l'invitation →
     copie le lien → ouvre-le dans une fenêtre de navigation privée → remplis nom,
     email, mot de passe → « Créer mon compte »
   - Ce que tu dois voir : le bandeau « Admin t'a invité·e sur MyDay » sur la page
     d'inscription, puis après création, tu arrives directement sur le cockpit connecté

2. **Le mot de passe oublié (limite actuelle à connaître)**
   - Où aller : http://localhost:3000/mot-de-passe-oublie
   - Ce que tu fais : tape ton email → « Envoyer le lien »
   - Ce que tu dois voir : un message neutre de confirmation. ⚠ Pour l'instant aucun
     vrai email ne part : le lien n'apparaît que dans les journaux techniques du
     serveur. À retester quand l'envoi d'email réel sera branché.

3. **Le rendu du mode sombre sur la connexion et les réglages**
   - Où aller : active le mode sombre (lune), puis va sur la page de connexion et Réglages
   - Ce que tu dois voir : tout lisible, contrastes corrects, rien d'illisible
