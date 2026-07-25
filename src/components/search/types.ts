/**
 * Types snake_case pour la conso de `GET /api/search?q=` (contrat figé
 * Round 009, plan.md). Ne JAMAIS renommer en camelCase - cf. SOP
 * `general-api-response-casing-contract`.
 */

export interface SearchNote {
  id: string;
  titre: string;
  contenu: string | null;
}

export interface SearchTache {
  id: string;
  titre: string;
  description: string | null;
}

export interface SearchEvenement {
  id: string;
  titre: string;
  lieu: string | null;
}

export interface SearchMail {
  id: string;
  expediteur: string;
  sujet: string | null;
  extrait: string | null;
}

export interface SearchResults {
  notes: SearchNote[];
  taches: SearchTache[];
  events: SearchEvenement[];
  // Round 016 : Gmail retiré de l'interface - la clé peut encore être
  // envoyée par le backend, mais rien ne l'affiche ; optionnelle pour
  // tolérer les deux formes de réponse.
  mails?: SearchMail[];
}

export const RESULTATS_VIDES: SearchResults = {
  notes: [],
  taches: [],
  events: [],
};
