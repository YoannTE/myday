---
name: project_myday_mvp_growth_review
description: Revue growth du brief MVP finalisé de MyDay (2026-07-09) - contexte projet personnel avant ouverture publique éventuelle
metadata:
  type: project
---

Contexte à cette date : MyDay est d'abord un projet personnel (Yoann + Manon
uniquement), invite-only, gratuit, sans monétisation au MVP. L'ouverture à un
public élargi est explicitement conditionnelle ("si le produit fait ses
preuves") mais aucun seuil chiffré n'existe encore.

**Recommandations actées dans cette revue (à vérifier si intégrées lors des
rounds d'implémentation)** :

1. Ajouter une table légère de log d'événements d'usage dès le MVP
   (`dashboard_opened`, `brief_generated`, `brief_opened`, `task_completed`,
   `assistant_message_sent`, `mail_replied`). Absente du brief au moment de
   cette revue. Sans ça, impossible de mesurer objectivement la rétention
   avant une décision d'ouverture publique - donnée irrécupérable
   rétroactivement.

2. Fixer un critère de succès chiffré avant ouverture publique (proposé :
   ouverture du dashboard ≥5/7 jours/semaine par Yoann ET Manon sur 4
   semaines consécutives). Le brief ne contient qu'une formulation vague
   ("si le produit fait ses preuves").

3. Déclencher un brief IA "à la demande" automatiquement en toute fin
   d'onboarding (après connexion Google), plutôt que d'attendre l'heure
   planifiée du lendemain - évite que le moment le plus différenciant du
   produit soit absent de la toute première session.

4. **Risque à surveiller avant toute ouverture publique** : les scopes Gmail
   (lecture + réponse) et Google Agenda (écriture) demandés par MyDay
   nécessiteront une vérification OAuth Google (CASA + politique de
   confidentialité publiée) dès que l'usage dépasse un cercle interne
   restreint. Délai observé en général 2-6 semaines. À lancer dès que la
   décision d'ouvrir est prise, pas après - sinon la croissance est bloquée
   sans que ce soit visible tant que le produit reste à 2 utilisateurs.

5. Profiter du même log d'événements pour compter les appels LLM par agent
   et par utilisateur (brief quotidien, priorisation mails, assistant). Sert
   de baseline réelle de coût IA/utilisateur/mois, nécessaire pour
   challenger le modèle de tiers déjà suggéré dans
   [[project_myday_monetization_model]] (Essentiel ~19-24$, Cercle ~35-40$)
   avec des vraies données plutôt qu'une estimation théorique.

**Points déjà bien gérés, pas besoin de re-challenger** :
- Cloisonnement strict admin/contenu (bon argument de confiance réutilisable
  en marketing futur).
- Entité Invitation capture déjà `invité par` - traçabilité de parrainage
  gratuite si F22 (parrainage) est activée plus tard.
- Renoncement assumé WhatsApp/SMS/iCloud en MVP (pas de sur-promesse) -
  cohérent avec le risque de fragilité identifié en
  [[project_myday_market_positioning]].
- Monétisation en Nice-to-have, gratuit au démarrage : cohérent entre
  app.md/BRIEF.md/decisions.md, pas d'incohérence à ce stade.

Voir aussi [[project_myday_market_positioning]] et
[[project_myday_monetization_model]] (revue Phase 1, positionnement et
pricing - toujours valides, à re-challenger seulement si un PRD de pricing
est produit avant une ouverture publique).
