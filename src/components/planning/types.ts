/**
 * Types snake_case pour la conso de l'API `/api/events` (contrat figé du
 * Round 004). Ne JAMAIS renommer en camelCase - cf. SOP
 * `general-api-response-casing-contract`.
 */

export type EvenementSource = "myday" | "google";
export type EvenementSyncStatus = "synced" | "sync_pending" | "sync_error";

/** Représentation légère d'une catégorie jointe dans la réponse d'un événement. */
export interface EventCategoryLite {
  id: string;
  nom: string;
  couleur: string;
}

/** Catégorie d'événement personnalisable - `GET/POST/PATCH /api/event-categories`. */
export interface EventCategory {
  id: string;
  nom: string;
  couleur: string;
  created_at: string;
  updated_at: string;
}

export interface EvenementApi {
  id: string;
  titre: string;
  debut: string;
  fin: string;
  lieu: string | null;
  description: string | null;
  google_event_id: string | null;
  source: EvenementSource;
  sync_status: EvenementSyncStatus;
  categorie_id: string | null;
  categorie: EventCategoryLite | null;
  /** Délai de notification avant le début : 60, 30, 5 ou 0 minutes. */
  rappel_avance_minutes: number;
  /** Nom du propriétaire si l'événement est partagé avec l'utilisateur courant, sinon `null`. */
  partage_par: string | null;
  created_at: string;
  updated_at: string;
}

/** Agrégat de densité par jour ("YYYY-MM-DD" -> nombre d'événements), utilisé par la vue année. */
export interface CompteurJourApi {
  jour: string;
  count: number;
}
