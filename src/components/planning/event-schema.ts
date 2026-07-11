import { z } from "zod";

/**
 * Validation du formulaire d'événement. `fin > debut` est la SEULE barrière
 * de cohérence (côté client) : aucune contrainte CHECK côté BDD (correction
 * #7 du plan Round 004).
 */
export const eventFormSchema = z
  .object({
    titre: z
      .string()
      .trim()
      .min(1, "Le titre est obligatoire.")
      .max(200, "200 caractères maximum."),
    debut: z.string().min(1, "La date et l'heure de début sont obligatoires."),
    fin: z.string().min(1, "La date et l'heure de fin sont obligatoires."),
    lieu: z.string().trim().max(200, "200 caractères maximum.").optional(),
    description: z
      .string()
      .trim()
      .max(2000, "2000 caractères maximum.")
      .optional(),
  })
  .refine(
    (valeurs) => new Date(valeurs.fin).getTime() > new Date(valeurs.debut).getTime(),
    { message: "La fin doit être après le début.", path: ["fin"] },
  );

export type EventFormValues = z.infer<typeof eventFormSchema>;
