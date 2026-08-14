// Budget type proposé à l'ouverture, pour ceux qui préfèrent partir d'une
// trame plutôt que d'une page blanche. Ménage de référence : couple biactif
// avec deux enfants scolarisés (un au collège, un au lycée).
//
// ── D'où viennent les chiffres ────────────────────────────────────────────
//
// DÉPENSES — budgets de référence de l'ONPES (Observatoire national de la
// pauvreté et de l'exclusion sociale), ménage type « couple avec deux
// enfants », actualisés par l'Ires aux prix du 1er semestre 2022 :
//
//   Logement 892 · Alimentation 689 · Vie sociale 564 · Transports 487
//   Habillement 320 · Santé 271 · Équipement 218 · Hygiène 178
//   Cantine 108 · Banque 17   →   total 3 744 €/mois
//
// Ces dix postes sont des agrégats, trop gros pour une saisie ligne à ligne :
// on les redécoupe ci-dessous en lignes concrètes (loyer, assurance, cantine…)
// dont les sommes retombent EXACTEMENT sur les totaux publiés. Les totaux sont
// sourcés, la répartition à l'intérieur d'un poste est une lecture raisonnable.
//
// S'y ajoute l'impôt sur le revenu (~120 €), absent des budgets ONPES qui ne
// mesurent que la consommation, alors que les salaires INSEE ci-dessous sont
// nets AVANT prélèvement à la source. C'est le seul montant estimé plutôt que
// relevé : il dépend du foyer, d'où le libellé qui invite à l'ajuster.
//
// REVENUS — salaire net mensuel médian du secteur privé en équivalent temps
// plein, INSEE 2024 (2 190 €), pour chacun des deux adultes ; allocations
// familiales au barème CAF du 1er janvier 2026 pour deux enfants, première
// tranche de revenus (152,25 €), majorées de 76,13 € pour le second enfant de
// 14 ans et plus.
//
// C'est un budget « minimum décent » au sens de l'ONPES — le seuil au-dessus
// duquel un ménage participe normalement à la vie sociale — et non une moyenne
// des dépenses françaises. Une base neutre à corriger, pas une norme.

import type { Sens } from "./types";

export interface LigneType {
  libelle: string;
  categorie: string;
  montant: number;
  sens: Sens;
}

export const BUDGET_TYPE: LigneType[] = [
  // ── Revenus : 4 608 €/mois ──────────────────────────────────────────────
  { libelle: "Salaire (adulte 1)", categorie: "Salaire", montant: 2190, sens: "entree" },
  { libelle: "Salaire (adulte 2)", categorie: "Salaire", montant: 2190, sens: "entree" },
  { libelle: "Allocations familiales", categorie: "Aides", montant: 228, sens: "entree" },

  // ── Logement : 892 € ────────────────────────────────────────────────────
  { libelle: "Loyer ou crédit immobilier", categorie: "Logement", montant: 680, sens: "sortie" },
  { libelle: "Électricité et gaz", categorie: "Logement", montant: 130, sens: "sortie" },
  { libelle: "Eau", categorie: "Logement", montant: 45, sens: "sortie" },
  { libelle: "Assurance habitation", categorie: "Assurances", montant: 22, sens: "sortie" },
  { libelle: "Charges et entretien", categorie: "Logement", montant: 15, sens: "sortie" },

  // ── Alimentation : 689 € ────────────────────────────────────────────────
  { libelle: "Courses alimentaires", categorie: "Alimentation", montant: 689, sens: "sortie" },

  // ── Vie sociale : 564 € ─────────────────────────────────────────────────
  { libelle: "Vacances (mise de côté)", categorie: "Loisirs", montant: 200, sens: "sortie" },
  { libelle: "Sorties et restaurants", categorie: "Loisirs", montant: 120, sens: "sortie" },
  { libelle: "Sport et culture", categorie: "Loisirs", montant: 110, sens: "sortie" },
  { libelle: "Cadeaux et vie sociale", categorie: "Loisirs", montant: 80, sens: "sortie" },
  { libelle: "Fournitures et sorties scolaires", categorie: "Enfants", montant: 54, sens: "sortie" },

  // ── Transports : 487 € ──────────────────────────────────────────────────
  { libelle: "Carburant", categorie: "Transport", montant: 180, sens: "sortie" },
  { libelle: "Crédit ou amortissement voiture", categorie: "Transport", montant: 120, sens: "sortie" },
  { libelle: "Entretien et réparations", categorie: "Transport", montant: 70, sens: "sortie" },
  { libelle: "Assurance automobile", categorie: "Transport", montant: 65, sens: "sortie" },
  { libelle: "Transports en commun", categorie: "Transport", montant: 52, sens: "sortie" },

  // ── Habillement : 320 € ─────────────────────────────────────────────────
  { libelle: "Habillement et chaussures", categorie: "Habillement", montant: 320, sens: "sortie" },

  // ── Santé : 271 € ───────────────────────────────────────────────────────
  { libelle: "Mutuelle santé", categorie: "Santé", montant: 190, sens: "sortie" },
  { libelle: "Frais de santé non remboursés", categorie: "Santé", montant: 81, sens: "sortie" },

  // ── Équipement : 218 € ──────────────────────────────────────────────────
  { libelle: "Téléphonie et internet", categorie: "Abonnements", montant: 90, sens: "sortie" },
  { libelle: "Équipement et mobilier", categorie: "Équipement", montant: 128, sens: "sortie" },

  // ── Hygiène : 178 € ─────────────────────────────────────────────────────
  { libelle: "Hygiène et produits d'entretien", categorie: "Hygiène & entretien", montant: 178, sens: "sortie" },

  // ── Cantine : 108 € ─────────────────────────────────────────────────────
  { libelle: "Cantine scolaire", categorie: "Enfants", montant: 108, sens: "sortie" },

  // ── Banque : 17 € ───────────────────────────────────────────────────────
  { libelle: "Frais bancaires", categorie: "Autre", montant: 17, sens: "sortie" },

  // ── Impôt (estimation, hors budgets ONPES) : 120 € ──────────────────────
  { libelle: "Impôt sur le revenu (à ajuster)", categorie: "Impôts", montant: 120, sens: "sortie" },
];

const total = (sens: Sens) =>
  BUDGET_TYPE.filter((ligne) => ligne.sens === sens).reduce(
    (somme, ligne) => somme + ligne.montant,
    0,
  );

/** 4 608 € — deux salaires médians et les allocations familiales. */
export const TOTAL_REVENUS = total("entree");

/** 3 864 € — les 3 744 € de l'ONPES plus l'impôt estimé. */
export const TOTAL_DEPENSES = total("sortie");

/** 744 € de reste à vivre : c'est ce que le nouvel arrivant verra en entrant. */
export const RESTE_A_VIVRE = TOTAL_REVENUS - TOTAL_DEPENSES;

export const SOURCE_BUDGET_TYPE =
  "Dépenses : budgets de référence ONPES pour un couple avec deux enfants, " +
  "actualisés par l'Ires (1er semestre 2022). Revenus : salaire net médian " +
  "du privé, INSEE 2024, et barème CAF au 1er janvier 2026.";
