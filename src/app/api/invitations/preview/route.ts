import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { validateInvitationToken } from "@/lib/invitations";

// Prévisualisation PUBLIQUE et en lecture seule d'un jeton d'invitation
// (utilisée par le bandeau de /sign-up). Ne consomme JAMAIS le jeton (la
// consommation atomique reste dans le hook `before /sign-up/email`) et ne
// renvoie JAMAIS l'email de la personne invitée.
export async function GET(request: NextRequest) {
  const jeton = request.nextUrl.searchParams.get("token");

  if (!jeton) {
    return NextResponse.json({ data: { valid: false, reason: "invalide" } });
  }

  const validation = await validateInvitationToken(jeton);

  if (!validation.valid) {
    return NextResponse.json({
      data: { valid: false, reason: validation.reason },
    });
  }

  const inviteurs = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, validation.invitation.invitePar))
    .limit(1);

  const prenomInviteur = inviteurs[0]?.name?.trim().split(" ")[0] || "Un membre de l'équipe";

  return NextResponse.json({
    data: {
      valid: true,
      inviterFirstName: prenomInviteur,
      expiresAt: validation.invitation.expiration.toISOString(),
    },
  });
}
