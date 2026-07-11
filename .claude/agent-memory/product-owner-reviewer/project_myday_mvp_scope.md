---
name: project-myday-mvp-scope
description: Arbitrages PO sur le périmètre et le séquencement MVP de MyDay (13 features), issus de la revue du brief finalisé
metadata:
  type: project
---

Revue du brief finalisé MyDay (2026-07-09) : le MVP compte 13 features (F1-F13). Recommandation PO de découper en 3 paliers livrables, chacun utilisable seul, au lieu d'un bloc :
- Palier 1 (cockpit utile à 1 personne) : F1, F2, F3 lecture, F4, F5, F6.
- Palier 2 (l'IA entre) : F7 (résumé+tri mails, lecture d'abord), F8 (brief).
- Palier 3 (différenciateur + confort) : F9 assistant (actions internes d'abord, brouillons mail ensuite), F10 push, F11 recherche.

**Why:** Yoann est constructeur solo non technique (voir [[user-yoann]]). Risque n°1 = non-lancement d'un MVP monolithique de 13 features dont 4 sous-produits durs (sync bidir F4, tri IA F7, assistant F9, push F10). F10/F11 n'apportent rien à la démonstration de valeur cœur.

**How to apply:** Toujours proposer un séquencement en paliers utilisables seuls, pas un bloc. Test de sortie Palier 1 = « Manon (proche non technique) s'inscrit, connecte son Google, utilise MyDay 1 semaine sans intervention de Yoann ». Ce test force le traitement des parcours d'échec et combat l'attachement produit (construire pour un public d'une personne). Voir [[project-myday-risques-produit]].
