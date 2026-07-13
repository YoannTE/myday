/**
 * Types snake_case pour la conso de l'API `/api/notes` (contrat figé du
 * Round 004). Ne JAMAIS renommer en camelCase - cf. SOP
 * `general-api-response-casing-contract`.
 */

export type NoteOrigine = "manuelle" | "assistant";

/** Représentation légère d'une catégorie jointe dans la réponse d'une note. */
export interface NoteCategoryLite {
  id: string;
  nom: string;
  couleur: string;
}

/** Catégorie de note personnalisable (Round 015) - `GET/POST/PATCH /api/note-categories`. */
export interface NoteCategory {
  id: string;
  nom: string;
  couleur: string;
  created_at: string;
  updated_at: string;
}

/** Élément de liste à cocher d'une note (ex. liste de courses). */
export interface NoteItemApi {
  id: string;
  contenu: string;
  coche: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface NoteApi {
  id: string;
  titre: string;
  contenu: string | null;
  epinglee: boolean;
  archivee: boolean;
  origine: NoteOrigine;
  categorie_id: string | null;
  categorie: NoteCategoryLite | null;
  items: NoteItemApi[];
  created_at: string;
  updated_at: string;
}
