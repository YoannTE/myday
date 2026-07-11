---
name: project-myday-risques-produit
description: Risques produit et règles métier manquantes identifiés sur MyDay (définition mail important, échecs OAuth, coût LLM, verification Google)
metadata:
  type: project
---

Trous produit majeurs relevés sur le brief MyDay (à combler avant implémentation) :
- **« Mail important » non défini** (F7/F8) : c'est LA promesse (« quoi faire maintenant ») mais aucune règle. Exiger : signaux déterministes (expéditeur connu, To vs Cc, demande d'action, fil déjà répondu) + score LLM + seuil configurable + boucle de feedback utilisateur (bouton important/pas important qui ré-entraîne le tri par expéditeur).
- **Parcours d'échec absents** : tous les parcours du brief sont des happy paths. Manquent : refus/permissions partielles OAuth Google, token révoqué/expiré, sync en panne (indicateur de fraîcheur), boîte vide au 1er login, invitation expirée, brief sans données.
- **Verification Google / restricted scopes** : Gmail read/write en mode test = plafond ~100 users + écran d'avertissement effrayant pour les proches non techniques. Bloque l'onboarding et l'ouverture publique (F20/F22).
- **Coût LLM d'un produit gratuit + continu** : brief + scoring continu + assistant pour N comptes = facture réelle payée par Yoann. Plafonner fréquence, modèle bon marché pour le tri.
- **Conflit de sync bidirectionnelle** (F4) : règle « qui gagne » absente. Recommander « Google source de vérité » en v1.
- **Push iOS** (F10) : Yoann est sur iPhone ; web push iOS ne marche que PWA installée → faire de l'installation une étape d'onboarding, reformuler la promesse.

**Why:** Un outil de confiance consulté en continu s'effondre au premier faux positif de tri ou au premier écran cassé. Les sources infaisables (Apple/WhatsApp) ont déjà été retirées ; le risque restant est l'exécution de la couche IA + les états dégradés.

**How to apply:** Sur toute revue de round MyDay touchant mails/IA/onboarding/Google, vérifier que ces règles et états sont spécifiés, pas laissés à l'implémenteur. Voir [[project-myday-mvp-scope]] et [[project-myday-integrations]].
