/**
 * Types snake_case pour la conso de l'API `/api/events` (contrat figé du
 * Round 004). Ne JAMAIS renommer en camelCase - cf. SOP
 * `general-api-response-casing-contract`.
 */

export type EvenementSource = "myday" | "google";
export type EvenementSyncStatus = "synced" | "sync_pending" | "sync_error";

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
  created_at: string;
  updated_at: string;
}

/** Agrégat de densité par jour ("YYYY-MM-DD" -> nombre d'événements), utilisé par la vue année. */
export interface CompteurJourApi {
  jour: string;
  count: number;
}
