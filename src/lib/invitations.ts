// Helper unique de validité d'un jeton d'invitation (Round 002).
// Lecture seule : diagnostique l'état d'un jeton sans le consommer.
// Consommé par :
//   - le hook `before /sign-up/email` (src/lib/auth.ts) pour produire le
//     message d'erreur français précis quand le claim atomique échoue ;
//   - la preview publique `/api/invitations/preview` (nextjs-developer) et
//     le service FastAPI (statut dérivé) pour afficher l'état sans fuiter
//     l'email invité.
//
// La CONSOMMATION réelle du jeton (transition envoyee -> acceptee) se fait
// UNIQUEMENT via un UPDATE conditionnel atomique dans le hook, jamais ici :
// deux inscriptions concurrentes ne peuvent donc pas créer deux comptes.

import { eq } from "drizzle-orm";
import { db } from "./db";
import { invitations, type Invitation } from "./db/schema";
import {
  INVITATION_ERROR_MESSAGES,
  type InvitationInvalidReason,
} from "./invitation-messages";

// Réexportés pour compatibilité : les messages vivent dans
// invitation-messages.ts (module client-safe, sans dépendance BDD) afin de
// pouvoir être importés depuis un Client Component (bandeau d'invitation).
export { INVITATION_ERROR_MESSAGES, type InvitationInvalidReason };

export type InvitationValidation =
  | { valid: true; invitation: Invitation }
  | { valid: false; reason: InvitationInvalidReason; invitation?: Invitation };

export async function validateInvitationToken(
  jeton: string,
): Promise<InvitationValidation> {
  if (!jeton || typeof jeton !== "string") {
    return { valid: false, reason: "invalide" };
  }

  const rows = await db
    .select()
    .from(invitations)
    .where(eq(invitations.jeton, jeton))
    .limit(1);

  const invitation = rows[0];
  if (!invitation) {
    return { valid: false, reason: "invalide" };
  }

  if (invitation.statut === "acceptee") {
    return { valid: false, reason: "utilisee", invitation };
  }

  if (invitation.statut === "revoquee") {
    return { valid: false, reason: "revoquee", invitation };
  }

  // statut === 'envoyee'
  if (invitation.expiration.getTime() <= Date.now()) {
    return { valid: false, reason: "expiree", invitation };
  }

  return { valid: true, invitation };
}
