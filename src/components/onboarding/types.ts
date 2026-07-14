// Contrat figé avec le backend : GET/PATCH /api/preferences (cf.
// .project/rounds/005/plan.md « Contrats figés »). Convention API du projet :
// snake_case (cf. SOP api-response-casing-contract).
export type BriefTone = "neutre" | "motivant" | "direct";
export type Theme = "clair" | "sombre";

export interface Preferences {
  brief_hour: string;
  brief_tone: BriefTone;
  timezone: string;
  theme: Theme;
  notif_important_mail: boolean;
  notif_event_reminder: boolean;
  notif_brief_ready: boolean;
  onboarding_completed: boolean;
  onboarding_step: number;
  created_at: string;
  updated_at: string;
}
