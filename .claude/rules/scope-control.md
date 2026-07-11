# Contrôle du périmètre et simplicité

- Modifier uniquement les fichiers nécessaires à la demande, au round ou au bug fix en cours.
- Préférer un changement chirurgical à une refonte : pas de renommage, déplacement, formatage ou nettoyage adjacent sans nécessité directe.
- Respecter le style existant du projet, même imparfait, sauf s'il bloque la correction demandée.
- Ne pas ajouter de fonctionnalité, dépendance, configuration, hook, service ou couche d'architecture non demandé.
- Éviter les abstractions prématurées : un code à usage unique reste local tant qu'un second usage réel n'existe pas.
- Choisir l'implémentation la plus simple qui satisfait le besoin actuel ; si 200 lignes peuvent devenir 50 sans perdre de clarté, simplifier.
- La règle « fichiers ~150 lignes max » sert à découper quand un fichier grossit vraiment, pas à créer des couches spéculatives.
- Si une amélioration hors périmètre semble utile, la signaler séparément au lieu de l'implémenter automatiquement.
- En cas d'information manquante non bloquante, poser une hypothèse raisonnable et l'écrire dans le plan du round.
- Demander à l'utilisateur seulement si le choix est bloquant, irréversible, coûteux, sensible ou change fortement le produit.
