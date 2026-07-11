// Types partagés des sous-composants Administration - reflète exactement
// les modèles Pydantic de backend/app/models/admin.py (contrat FIGÉ).

export type StatutInvitation = "envoyee" | "acceptee" | "revoquee" | "expiree";

export interface InvitationAdmin {
  id: string;
  email: string;
  statut: StatutInvitation;
  expiration: string;
  created_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  invite_url: string;
}

export interface CompteAdmin {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  active: boolean;
  last_connexion: string | null;
}
