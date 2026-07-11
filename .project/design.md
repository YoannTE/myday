# Design - MyDay

## Direction choisie

Direction 3 - « AEVIO One » (`.project/design-directions/3/`), validée par l'utilisateur le 2026-07-10.
(Section écrite directement : le tool `set_design_direction` est indisponible en mode CLI standalone.)

## Tokens

### Couleurs (palette retenue : AEVIO One, extraite de aevio-one.com)

| Token   | Hex     | Usage                                          |
| ------- | ------- | ---------------------------------------------- |
| bg      | #F5F7FB | Fond principal (gris-bleu très clair)          |
| ink     | #111A37 | Texte principal (encre marine)                 |
| accent  | #2350E6 | CTA, accents, liens, scores (bleu électrique)  |
| soft    | #EAF0FF | Surfaces secondaires bleutées, badges, alertes |
| success | #2350E6 | = accent — AUCUN vert dans l'app (décision utilisateur) |

Valeurs complémentaires :

- Dégradé CTA : `linear-gradient(180deg, #3A6BFF, #2350E6)` + ombre `0 10px 22px -8px rgba(47,98,255,.6)`
- Ombre cartes : `0 1px 2px rgba(17,26,55,.04), 0 24px 48px -32px rgba(17,26,55,.28)`
- Focus ring : `0 0 0 4px rgba(47,98,255,.10)`
- Texte secondaire : `color-mix(in srgb, var(--ink) 55%, transparent)`
- Mode sombre : bg `#0C1024`, ink `#EEF1FB`, soft `#1A2140` (accent inchangé)

### Typographie

| Rôle    | Font              | Usage                                                |
| ------- | ----------------- | ---------------------------------------------------- |
| display | Plus Jakarta Sans | Titres (extrabold, tracking -0.02em), noms, boutons  |
| body    | Plus Jakarta Sans | Texte courant, labels                                |
| mono    | JetBrains Mono    | Heures, scores, badges, libellés uppercase (.04em)   |

Google Fonts : `family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600`

### Spacing & radii

- Border radius : 14px (cartes), 12px (éléments internes), 999px (badges/pilules)
- Espacements : var(--space-base) = 16px desktop, 13px mobile
- Ombres : douces et profondes teintées marine/bleu, jamais dures
- **Responsive mobile (règle validée)** : `html { font-size: 13.5px }` sous 640px ; le brief hero se compacte fortement (titre text-lg, priorités resserrées) ; la barre du haut passe sur 2 lignes (assistant pleine largeur en 2e ligne) ; « ⌘K » et indicateurs secondaires masqués

## Principes de design

- SaaS moderne, propre et confiant — cartes blanches nettes sur fond gris-bleu clair
- Le brief IA est la vedette : grande carte hero avec liseré dégradé bleu en haut de page
- Hiérarchie par la typo : titres extrabold tracking serré, libellés mono uppercase espacés
- Aucun vert nulle part : le bleu accent porte aussi les états positifs (coches, indicateurs)
- Zéro surcharge : sections aérées, une info claire par ligne, pas d'effet corporate froid
- Contenu qui tutoie l'utilisateur, chaleureux et direct

## Slots validés

Configuration exacte choisie par l'utilisateur (capture du 2026-07-10) :

- **topbar** : variante 01 « Barre produit » — logo M dégradé + **date du jour** (pas le nom de l'app) à gauche, **barre assistant au centre** (« Dis-moi quoi faire — une note, un rendez-vous, un mail... » + ⌘K), **bouton mode sombre ☾** + avatar à droite. Mobile : assistant en 2e ligne pleine largeur.
- **brief** : variante 01 « Carte hero » — badge mono « BRIEF · 07:00 », accroche « Trois priorités déterminent ta **journée**. » (toujours « journée », jamais « matinée »), 3 priorités numérotées avec pastilles dégradé, alerte en bandeau soft. Compact sur mobile.
- **notes** : variante « Liste épinglée » (DÉFAUT) — liste compacte avec ligne « + Note rapide... » en tête, notes épinglées marquées, badge « via l'assistant ». Placée juste sous le brief (2e bloc de la page — accès note le plus rapide possible).
- **planning** : variante 01 « Timeline produit » — heures en mono, blocs soft, événement en cours bordé bleu avec pastille pulsante « maintenant ».
- **todo** : variante 01 « Checklist nette » — cases arrondies, badges priorité, échéances en mono à droite, tâches faites barrées (coche bleue).
- **mails** : variante 01 « Inbox scorée » — score d'importance en pastille dégradé (bleu vif ≥ 70, soft en dessous), résumé IA en gris sous l'objet.
- **assistant** : variante 01 « Intégré en haut + suggestions » — la saisie vit dans la topbar ; en bas de page, chips d'exemples (« Prends une note : liste de courses... », « Ajoute l'ostéopathe vendredi 10 juillet à 19h »).
- **Alignement (règle validée, renforcée le 2026-07-10)** : TOUT est sur la même colonne max-w-4xl — barre du haut, brief, notes, planning, tâches, mails. Une seule largeur dans toute l'app, aucun bloc ne déborde.

## Ton de la copy

- Tutoiement direct : « Ta journée », « Tes tâches », « Dis-moi quoi faire »
- Toujours « journée », jamais « matinée » (le cockpit vit toute la journée)
- Phrases courtes, chaleureuses, sans jargon ; français correctement accentué partout
- Libellés techniques (heures, scores, états) en mono uppercase

## Préférences utilisateur (questionnaire + itérations)

- Ambiance : calme et apaisante (référence Sunsama), mais style final = identité AEVIO de l'utilisateur (aevio-one.com/assistant-commercial)
- Positionnement : outil personnel raffiné
- Hiérarchie : le brief IA domine visuellement
- À éviter : surcharge d'informations, look froid/corporate, toute couleur verte
- La prise de note doit être l'action la plus rapide : Notes en 2e bloc + assistant en haut qui capture (« Prends une note : ... »)
- Mode sombre accessible depuis la barre du haut (bouton ☾)
