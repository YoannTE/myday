// Sections affichables du cockpit : la liste partagée entre la carte des
// réglages (qui les bascule) et le cockpit (qui les filtre).
//
// Deux réglages distincts, volontairement stockés à des endroits différents :
//   - l'ORDRE reste local à l'appareil (flèches du cockpit, localStorage) ;
//   - l'AFFICHAGE vit sur le profil (`user_preferences`, une colonne booléenne
//     par section), pour qu'une section masquée le soit partout.
//
// Le brief du jour est un cas à part : il n'a pas de place dans l'ordre (il
// reste toujours en tête) et le couper va plus loin que le masquer, puisque le
// moteur cesse alors de le générer (ni coût IA, ni notification « brief prêt »).

import type { CleSection } from "@/components/cockpit/use-ordre-sections";

/** Les colonnes de préférences correspondantes, en snake_case comme l'API. */
export interface PreferencesSections {
  section_meteo: boolean;
  section_planning: boolean;
  section_taches: boolean;
  section_notes: boolean;
  section_budget: boolean;
  section_brief: boolean;
}

export interface SectionCockpit {
  cle: keyof PreferencesSections;
  /** Absent pour le brief, qui n'est pas une section réordonnable. */
  section?: CleSection;
  titre: string;
  description: string;
}

export const SECTIONS_COCKPIT: SectionCockpit[] = [
  {
    cle: "section_brief",
    titre: "Brief du jour",
    description:
      "Le résumé IA de ta journée. Désactivé, il n'est plus préparé du tout.",
  },
  {
    cle: "section_meteo",
    section: "meteo",
    titre: "Météo",
    description: "Le temps du jour et des prochains jours.",
  },
  {
    cle: "section_planning",
    section: "planning",
    titre: "Planning",
    description: "Tes événements et tes créneaux réservés.",
  },
  {
    cle: "section_taches",
    section: "taches",
    titre: "Tâches",
    description: "Ce qu'il reste à faire, échéances comprises.",
  },
  {
    cle: "section_notes",
    section: "notes",
    titre: "Notes",
    description: "Tes notes et listes, en accès rapide.",
  },
  {
    cle: "section_budget",
    section: "budget",
    titre: "Budget",
    description:
      "Ton reste à vivre du mois. Reste protégé par ton code, même affiché.",
  },
];

/** Toutes visibles : la valeur de repli tant que les préférences chargent. */
export const SECTIONS_TOUTES_VISIBLES: PreferencesSections = {
  section_meteo: true,
  section_planning: true,
  section_taches: true,
  section_notes: true,
  section_budget: true,
  section_brief: true,
};

const PAR_SECTION = new Map<CleSection, keyof PreferencesSections>(
  SECTIONS_COCKPIT.flatMap((entree) =>
    entree.section ? [[entree.section, entree.cle] as const] : [],
  ),
);

/**
 * Seul un `false` explicite masque une section.
 *
 * Ce n'est pas de la coquetterie : pendant la fenêtre entre la mise en ligne
 * du site et celle du moteur, l'API répond encore sans les champs
 * `section_*`. Les lire comme « absent donc masqué » viderait le cockpit de
 * tout le monde le temps du déploiement. Même raisonnement pour une section
 * inconnue des préférences : on affiche de trop plutôt que de faire
 * disparaître un contenu que personne n'a demandé à cacher.
 */
export function sectionVisible(
  section: CleSection,
  preferences: Partial<PreferencesSections>,
): boolean {
  const cle = PAR_SECTION.get(section);
  return cle ? preferences[cle] !== false : true;
}

/**
 * Le brief du jour est-il actif ? Même règle que les sections : seul un
 * `false` explicite le coupe (un moteur pas encore à jour, qui ne renvoie pas
 * `section_brief`, laisse le brief tel qu'il était).
 */
export function briefActif(preferences: Partial<PreferencesSections>): boolean {
  return preferences.section_brief !== false;
}
