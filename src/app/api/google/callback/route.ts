import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { GOOGLE_OAUTH_STATE_COOKIE, verifierEtatOAuth } from "@/lib/google-oauth";

export const runtime = "nodejs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Route Handler OAuth « callback » (redirect_uri déclaré côté Google).
 * Vérifie le cookie d'état signé (signature, non expiré, usage unique,
 * `state.userId == session courante`), puis délègue l'échange sensible
 * (code + code_verifier -> jetons chiffrés) à FastAPI en transmettant le
 * cookie de session. Ni le code ni les jetons ne transitent ailleurs.
 * Redirige vers le chemin `next` porté par l'état signé (ex. `/onboarding`
 * pour le wizard, `/reglages` par défaut si absent - comportement Round 003
 * inchangé).
 */
export async function GET(request: NextRequest) {
  // Décodage anticipé (signature + expiration déjà vérifiées par
  // `verifierEtatOAuth`) pour connaître le chemin de retour même en cas
  // d'échec précoce (refus de consentement, paramètres manquants).
  const etat = verifierEtatOAuth(
    request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value,
  );
  const next = etat?.next ?? "/reglages";

  const reponseEchec = NextResponse.redirect(
    new URL(`${next}?google=error`, request.url),
  );
  reponseEchec.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);

  // Refus de consentement côté Google (`error=access_denied`) ou tout autre
  // code d'erreur explicite.
  if (request.nextUrl.searchParams.get("error")) {
    return reponseEchec;
  }

  const code = request.nextUrl.searchParams.get("code");
  const stateRecu = request.nextUrl.searchParams.get("state");
  if (!code || !stateRecu) return reponseEchec;

  if (!etat || etat.nonce !== stateRecu) return reponseEchec;

  const session = await getSession();
  if (!session?.user || session.user.id !== etat.userId) return reponseEchec;

  try {
    const echange = await fetch(`${API_URL}/api/google/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Cookie de session transmis tel quel : FastAPI valide via
        // get_current_user (table `session` partagée), cf. .claude/rules/better-auth.md.
        Cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({ code, code_verifier: etat.codeVerifier }),
    });
    if (!echange.ok) return reponseEchec;
  } catch {
    // Backend FastAPI injoignable ou erreur réseau - échec propre, pas de
    // fuite technique dans l'URL de redirection.
    return reponseEchec;
  }

  const reponseSucces = NextResponse.redirect(
    new URL(`${next}?google=connected`, request.url),
  );
  reponseSucces.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  return reponseSucces;
}
