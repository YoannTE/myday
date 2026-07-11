// Types snake_case alignés sur le contrat API figé Round 006 (cf. SOP
// api-response-casing-contract) — aucun accès camelCase.

export type StatutMail = "pending_triage" | "triaged";
export type FiltreMail = "important" | "tous";
export type ValeurFeedback = "important" | "pas_important";

export interface Mail {
  id: string;
  expediteur: string;
  sujet: string;
  extrait: string;
  resume_ia: string | null;
  score: number | null;
  raison_score: string | null;
  statut: StatutMail;
  lu: boolean;
  repondu: boolean;
  date_reception: string;
  created_at: string;
  updated_at: string;
}

export interface MailsListResponse {
  mails: Mail[];
  ecartes: number;
}

export interface TriageRefreshResult {
  processed: number;
  important_count: number;
  skipped_prefilter: number;
  llm_calls: number;
}
