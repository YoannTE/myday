---
name: risk-google-oauth-restricted
description: Gmail/Agenda utilisent des scopes Google restreints — vérification obligatoire, refresh token expire en mode test
metadata:
  type: project
---

Les scopes MyDay (`gmail.readonly`, `gmail.send`/`compose`, `calendar` lecture+écriture) sont **sensitive/restricted** chez Google.

- En mode « Testing » Google Cloud : refresh token expire après **7 jours** → reconnexion hebdo forcée.
- Passage en « Production » : écran de vérification OAuth + **audit CASA annuel** (payant, plusieurs semaines) pour les scopes restreints Gmail send/modify.
- « Sur invitation » ne dispense PAS de la vérification au-delà de 100 utilisateurs ou en sortie de mode test.

**Why:** le brief traitait F2 comme un simple « OAuth officiel » — c'est le risque n°1 du projet, majoritairement administratif et hors code.

**How to apply:** exiger que `decisions.md` tranche : MVP en mode Testing assumé (≤100 comptes, expiration 7j documentée) OU lancer la vérification Google dès le Round 1 (chemin critique). Réclamer scopes minimaux (`gmail.compose` plutôt que `gmail.modify`). Exiger la gestion du cycle de vie des tokens : état connectée/à-reconnecter/révoquée, gestion `invalid_grant`, chiffrement applicatif des tokens hors BDD, révocation Google réelle à la suppression de compte.
