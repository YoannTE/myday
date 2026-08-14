// Types du domaine Budget, alignés sur les réponses snake_case de l'API
// FastAPI (SOP `api-response-casing-contract`) : on ne renomme rien à la
// frontière, ce qui évite deux vocabulaires pour la même donnée.

/** Le signe est porté par `sens`, jamais par le montant (toujours positif). */
export type Sens = "entree" | "sortie";

export interface Recurrent {
  id: string;
  libelle: string;
  categorie: string;
  montant: number;
  sens: Sens;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Operation {
  id: string;
  /** `AAAA-MM-JJ` */
  date_operation: string;
  libelle: string;
  categorie: string;
  montant: number;
  sens: Sens;
  created_at: string;
  updated_at: string;
}

export interface Prevision {
  id: string;
  libelle: string;
  categorie: string;
  montant: number;
  sens: Sens;
  /** Mois `AAAA-MM`, ou null quand rien n'est encore calé. */
  echeance: string | null;
  fait: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Compte {
  id: string;
  libelle: string;
  montant: number;
  date_releve: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetDonnees {
  recurrents: Recurrent[];
  operations: Operation[];
  previsions: Prevision[];
  comptes: Compte[];
}

/** Les trois rythmes possibles d'une ligne — c'est ce que choisit
 *  l'utilisateur dans la fiche de saisie, et ça décide de la table cible. */
export type Rythme = "operation" | "recurrent" | "prevision";

export const CATEGORIES: Record<Sens, string[]> = {
  sortie: [
    "Alimentation",
    "Logement",
    "Enfants",
    "Transport",
    "Loisirs",
    "Santé",
    "Habillement",
    "Hygiène & entretien",
    "Abonnements",
    "Assurances",
    "Équipement",
    "Impôts",
    "Autre",
  ],
  entree: ["Salaire", "Primes & commissions", "Aides", "Remboursement", "Autre"],
};
