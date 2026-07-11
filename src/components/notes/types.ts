/**
 * Types snake_case pour la conso de l'API `/api/notes` (contrat figé du
 * Round 004). Ne JAMAIS renommer en camelCase - cf. SOP
 * `general-api-response-casing-contract`.
 */

export type NoteOrigine = "manuelle" | "assistant";

export interface NoteApi {
  id: string;
  titre: string;
  contenu: string | null;
  epinglee: boolean;
  archivee: boolean;
  origine: NoteOrigine;
  created_at: string;
  updated_at: string;
}
