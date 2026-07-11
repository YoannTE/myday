import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Constantes et helpers PKCE + état signé du flux OAuth Google (côté Next,
 * cf. .project/rounds/003/plan.md « Routage OAuth »). Le redirect_uri
 * autorisé côté Google est sur :3000, donc ce flux vit en Route Handlers
 * Next qui délèguent l'échange sensible (client_secret) à FastAPI.
 */

export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";

const ETAT_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Scopes URL complètes (Google exige l'URL complète, pas un alias court).
export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

export interface GoogleOAuthState {
  nonce: string;
  userId: string;
  codeVerifier: string;
  exp: number;
  /** Chemin interne (commençant par `/`) vers lequel revenir après le callback. */
  next: string;
}

function cleSignature(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET manquant : impossible de signer l'état OAuth Google.",
    );
  }
  return secret;
}

export function genererCodeVerifier(): string {
  // PKCE : 43-128 caractères non réservés - 32 octets aléatoires en
  // base64url en produisent 43, dans la fourchette exigée par Google.
  return randomBytes(32).toString("base64url");
}

export function genererCodeChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

/** Génère un payload d'état + son cookie signé HMAC-SHA256, usage unique. */
export function signerEtatOAuth(
  userId: string,
  next: string,
): {
  cookie: string;
  payload: GoogleOAuthState;
} {
  const payload: GoogleOAuthState = {
    nonce: randomBytes(16).toString("base64url"),
    userId,
    codeVerifier: genererCodeVerifier(),
    exp: Date.now() + ETAT_TTL_MS,
    next,
  };

  const donnees = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", cleSignature())
    .update(donnees)
    .digest("base64url");

  return { cookie: `${donnees}.${signature}`, payload };
}

/**
 * Vérifie la signature (temps constant) et l'expiration du cookie d'état.
 * Renvoie `null` si absent, malformé, falsifié ou expiré.
 */
export function verifierEtatOAuth(
  cookie: string | undefined,
): GoogleOAuthState | null {
  if (!cookie) return null;

  const separateur = cookie.lastIndexOf(".");
  if (separateur === -1) return null;
  const donnees = cookie.slice(0, separateur);
  const signature = cookie.slice(separateur + 1);
  if (!donnees || !signature) return null;

  const signatureAttendue = createHmac("sha256", cleSignature())
    .update(donnees)
    .digest("base64url");

  const bufferRecu = Buffer.from(signature);
  const bufferAttendu = Buffer.from(signatureAttendue);
  if (
    bufferRecu.length !== bufferAttendu.length ||
    !timingSafeEqual(bufferRecu, bufferAttendu)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(donnees, "base64url").toString("utf-8"),
    ) as GoogleOAuthState;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
      return null;
    }
    if (
      !payload.nonce ||
      !payload.userId ||
      !payload.codeVerifier ||
      typeof payload.next !== "string" ||
      !payload.next.startsWith("/")
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
