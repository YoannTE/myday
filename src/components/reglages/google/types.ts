// Contrat figé avec le backend : GET /api/google/status (cf. plan Round 003).
// Convention API du projet : snake_case (comme les endpoints admin du Round 002).
export interface GoogleStatus {
  connected: boolean;
  status: string | null;
  calendar_synced_at: string | null;
  gmail_synced_at: string | null;
  last_manual_sync_at: string | null;
  scopes: string[];
  reauth_required: boolean;
}
