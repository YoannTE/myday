import { z } from "zod";

/**
 * Validation du formulaire d'échéance/catégorie d'une tâche (Round 012).
 * `echeance` est une chaîne "AAAA-MM-JJ" (input date) ou vide ; `categorie_id`
 * est soit "none" (sans catégorie), soit l'id d'une catégorie existante.
 */
export const taskDetailsSchema = z.object({
  echeance: z.string(),
  categorie_id: z.string().min(1, "Choisis une catégorie."),
});

export type TaskDetailsValues = z.infer<typeof taskDetailsSchema>;
