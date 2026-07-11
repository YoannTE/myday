import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/session";
import {
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_OAUTH_STATE_COOKIE,
  genererCodeChallenge,
  signerEtatOAuth,
} from "@/lib/google-oauth";

export const runtime = "nodejs";

const NEXT_PAR_DEFAUT = "/reglages";

/**
 * Valide le paramètre `?next=` : uniquement un chemin interne (commence par
 * un seul `/`, jamais une URL protocole-relative `//hote` ni une URL absolue
 * avec schéma). Défaut `/reglages` (comportement Round 003 inchangé).
 */
function validerNext(valeur: string | null): string {
  if (valeur && valeur.startsWith("/") && !valeur.startsWith("//")) {
    return valeur;
  }
  return NEXT_PAR_DEFAUT;
}

/**
 * Route Handler OAuth « connect » (côté Next - le redirect_uri autorisé côté
 * Google console est sur :3000, cf. .project/rounds/003/plan.md « Routage
 * OAuth »). Construit l'URL d'autorisation Google (PKCE, scopes complets,
 * accès hors-ligne + consentement forcé pour obtenir un refresh token), pose
 * un cookie d'état signé usage unique (avec le chemin de retour `next`), puis
 * redirige vers Google.
 */
export async function GET(request: NextRequest) {
  const user = await requireUser(); // redirect() vers /sign-in si non connecté
  const next = validerNext(request.nextUrl.searchParams.get("next"));

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL(`${next}?google=error`, request.url));
  }

  const { cookie, payload } = signerEtatOAuth(user.id, next);
  const codeChallenge = genererCodeChallenge(payload.codeVerifier);
  const redirectUri = new URL(
    "/api/google/callback",
    process.env.BETTER_AUTH_URL ?? request.url,
  ).toString();

  const urlAutorisation = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  urlAutorisation.searchParams.set("client_id", clientId);
  urlAutorisation.searchParams.set("redirect_uri", redirectUri);
  urlAutorisation.searchParams.set("response_type", "code");
  urlAutorisation.searchParams.set("scope", GOOGLE_OAUTH_SCOPES.join(" "));
  urlAutorisation.searchParams.set("access_type", "offline");
  urlAutorisation.searchParams.set("prompt", "consent");
  urlAutorisation.searchParams.set("code_challenge", codeChallenge);
  urlAutorisation.searchParams.set("code_challenge_method", "S256");
  // Doublon défensif du nonce en paramètre `state` : Google le renvoie tel
  // quel au callback, revérifié contre le cookie signé.
  urlAutorisation.searchParams.set("state", payload.nonce);

  const reponse = NextResponse.redirect(urlAutorisation.toString());
  reponse.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes, aligné sur ETAT_TTL_MS
    path: "/",
  });
  return reponse;
}
