// Messages français associés à chaque motif de rejet d'un jeton
// d'invitation. Extrait de src/lib/invitations.ts pour rester importable
// depuis un Client Component (aucune dépendance BDD ici, contrairement à
// invitations.ts qui importe `@/lib/db`).

export type InvitationInvalidReason =
  | "invalide" // jeton inconnu
  | "expiree" // statut envoyee mais expiration depassee
  | "utilisee" // statut acceptee
  | "revoquee"; // statut revoquee

export const INVITATION_ERROR_MESSAGES: Record<
  InvitationInvalidReason,
  string
> = {
  invalide: "Invitation invalide",
  expiree: "Invitation expirée",
  utilisee: "Invitation déjà utilisée",
  revoquee: "Invitation révoquée",
};
