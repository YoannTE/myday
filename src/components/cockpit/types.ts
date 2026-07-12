// Types snake_case alignés sur `GET /api/cockpit` (contrat figé Round 004,
// cf. SOP api-response-casing-contract) — aucun accès camelCase.
import type { Task } from "@/components/taches/types";
import type { Mail } from "@/components/mails/types";

export type OrigineNote = "manuelle" | "assistant";
export type SourceEvent = "google" | "myday";
export type SyncStatus = "synced" | "sync_pending" | "sync_error";

export interface Note {
  id: string;
  titre: string;
  contenu: string | null;
  epinglee: boolean;
  archivee: boolean;
  origine: OrigineNote;
  created_at: string;
  updated_at: string;
}

export interface CockpitEvent {
  id: string;
  titre: string;
  debut: string;
  fin: string;
  lieu: string | null;
  description: string | null;
  google_event_id: string | null;
  source: SourceEvent;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
}

export interface MailsImportantsData {
  placeholder: boolean;
  // Absent quand placeholder=true (le backend omet la clé) : optionnel.
  mails?: Mail[];
}

export type BriefType = "quotidien" | "a_la_demande";

export interface BriefContent {
  headline: string;
  priorities: string[];
  schedule_summary: string;
  tasks_summary: string;
  mails_summary: string;
  alerts: string[];
}

export interface Brief {
  contenu: BriefContent;
  degraded: boolean;
  generated_at: string;
  type: BriefType;
}

export interface CockpitData {
  notes_epinglees: Note[];
  // Round 014 (F8) : renommé depuis `journee` — 10 prochains événements à
  // venir (tri croissant), pas seulement ceux du jour courant.
  prochains: CockpitEvent[];
  taches: Task[];
  mails_importants: MailsImportantsData;
  brief: Brief | null;
}
