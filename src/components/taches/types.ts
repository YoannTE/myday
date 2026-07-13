// Types snake_case alignés sur la réponse API FastAPI (contrat figé Round
// 004, cf. SOP api-response-casing-contract) — aucun accès camelCase.

export type Priorite = "basse" | "normale" | "haute";
export type StatutTache = "a_faire" | "faite";
export type OrigineTache = "manuelle" | "assistant" | "mail";
export type Recurrence =
  | "aucune"
  | "quotidienne"
  | "hebdomadaire"
  | "mensuelle";

/** Représentation légère d'une catégorie jointe dans la réponse d'une tâche. */
export interface TaskCategoryLite {
  id: string;
  nom: string;
  couleur: string;
}

/** Catégorie de tâche personnalisable (Round 012) - `GET/POST/PATCH /api/task-categories`. */
export interface TaskCategory {
  id: string;
  nom: string;
  couleur: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  titre: string;
  description: string | null;
  priorite: Priorite;
  echeance: string | null;
  categorie: TaskCategoryLite | null;
  statut: StatutTache;
  origine: OrigineTache;
  mail_id: string | null;
  recurrence: Recurrence;
  rappel_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
