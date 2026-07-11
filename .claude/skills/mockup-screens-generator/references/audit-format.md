# Format du rapport d'audit 2D

Lis ce fichier UNE FOIS par session, au premier audit schema vs UI (Etape 2A point 6 ou Etape 2D). Une fois le format en contexte, pas besoin de relire.

## Structure du rapport

Le rapport s'affiche dans le chat (pas dans un fichier). Il contient deux tableaux markdown :

```markdown
## Audit schema vs UI - [nom de l'ecran]

### Aligne avec le schema (N elements)

| Donnee affichee           | Source schema                               |
| ------------------------- | ------------------------------------------- |
| « 3 agents actifs »       | count(workflow_definitions where is_active) |
| « 12,47 € cette semaine » | sum(llm_calls.cost_eur on 7d)               |

### Gaps UX -> propositions schema (M elements)

| Donnee UI               | Gap                     | Proposition                                                        |
| ----------------------- | ----------------------- | ------------------------------------------------------------------ |
| « 3 relances envoyees » | pas de compteur en BDD  | ajouter `pending_inputs.notification_resent_count` (int default 0) |
| « 130 ms total tools »  | events n'a pas de duree | ajouter `events.duration_ms` (int nullable)                        |
```

## Regles d'utilisation

- Premiere colonne : la donnee telle qu'affichee dans le mockup (avec ses guillemets, format, unite).
- Deuxieme colonne (table "Aligne") : la source schema sous forme de pseudo-code SQL (count, sum, jointure simple) referencee dans `app.md`.
- Deuxieme + troisieme colonnes (table "Gaps") : description du gap puis proposition de champ a ajouter avec son type Drizzle.
- Ne pas inventer de sources : si une donnee n'est pas mappable, elle va dans le tableau "Gaps".
- Si **M = 0** -> ecran coherent, audit ferme, mettre a jour le glossaire roadmap, cocher l'ecran.
- Si **M > 0** -> presenter le rapport et demander : « Pour chaque gap, tu preferes : (a) ajouter le champ au schema, (b) retirer du mockup, ou (c) tu decides ? »
