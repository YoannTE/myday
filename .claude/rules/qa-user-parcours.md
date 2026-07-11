---
globs: ["**/.project/rounds/**"]
---

# Règles d'écriture des parcours utilisateur à valider manuellement

Cette section s'applique à la section `## Parcours à valider par toi` de tout
rapport de test. Elle est chargée automatiquement quand la session touche un
fichier de round (`.project/rounds/**`) ou un rapport de test
(`.project/rounds/{id}/test-report.md`), donc lors de toute exécution de
`/test-round` et de la rédaction de rapport synthétique en PHASE 6.

## Périmètre

Cette section liste UNIQUEMENT les parcours que l'utilisateur (non technique)
doit faire lui-même, parce que les tests automatisés ne peuvent pas les couvrir.

Pas deux listes, une seule. Pas de "double-check" de ce que Playwright a
déjà validé.

## Règles d'écriture STRICTES

L'utilisateur n'est pas technique et ne fait que cliquer dans l'interface.
Pour chaque parcours :

1. **Zéro jargon technique.** Interdit : "endpoint", "API", "console",
   "network", "devtools", "viewport", "responsive", "F5", "navigation
   hamburger", "webhook", "OAuth", "JSON", "status code", "header HTTP",
   "DOM", "Stripe webhook", "request", "response". Remplacer par : "la page X",
   "le bouton Y", "ouvre l'app".

2. **Format parcours pas-à-pas.** Chaque parcours est un trajet dans
   l'interface, une action par étape (clique, écris, choisis, regarde).

3. **Point de départ explicite.** Toujours dire d'où partir :
   "Ouvre http://localhost:3000", ou "Connecte-toi avec admin@admin.com /
   password puis va dans Réglages".

4. **Résultat attendu visuel uniquement.** Ce que l'utilisateur DOIT voir
   sur son écran. Pas "le endpoint renvoie 200" mais "tu vois un message
   vert qui dit 'Profil enregistré'".

5. **Une seule chose à valider par parcours.** Si tu testes 3 choses
   indépendantes, découpe en 3 parcours.

## Quoi inclure (et seulement ça)

Inclure uniquement ce que les tests automatisés ne couvrent pas :

- **Réception d'emails réels** : "Tu dois recevoir un email à [adresse],
  ouvre-le, le lien doit te ramener sur l'app et te connecter"
- **Paiements réels en mode test** : "Choisis l'abonnement Premium, paie
  avec la carte 4242 4242 4242 4242 (date au hasard, CVC au hasard), tu dois
  voir une page 'Merci' et 'Premium' dans ton profil"
- **Connexion via comptes externes** (Google, GitHub) : "Clique sur
  'Continuer avec Google', choisis ton compte, tu dois revenir dans l'app
  avec ta vraie photo de profil"
- **Ressenti UX et clarté** : parcours-clés où il faut juger si c'est
  agréable / clair / rapide (premier login, première création, upgrade payant)
- **Rendu visuel fin** : alignements, animations, transitions, contraste,
  qu'un test automatisé ne peut pas juger
- **Tests sur un vrai téléphone / vraie tablette** si le round touche à
  une feature mobile critique
- **Notifications système** : push, SMS, sons d'alerte
- **Documents générés** : vérifier qu'un PDF / une facture s'affiche bien
  visuellement et est imprimable
- **Permissions navigateur** : géolocalisation, caméra, micro

## Quoi NE PAS inclure

- Refaire un test que Playwright a déjà fait (taper dans un formulaire,
  cliquer un bouton, vérifier une redirection)
- Tester des erreurs techniques (console, network, types)
- Vérifier le responsive au sens "ouvre les devtools"
- Vérifier l'authentification basique email/password (Playwright le fait)

## Format de chaque parcours

```
N. **[Titre court en langage utilisateur]**
   - Où aller : [URL ou navigation simple]
   - Ce que tu fais : [action 1] -> [action 2] -> [action 3]
   - Ce que tu dois voir : [résultat visuel attendu]
```

## Phrase de fallback

Si aucun parcours non-automatisable n'existe pour ce round (ex. round 100%
backend ou pur CRUD sans email/paiement/OAuth/UX subtile), écrire exactement :

« Aucun parcours à valider manuellement pour ce round. »
