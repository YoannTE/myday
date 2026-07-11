import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

// Défense en profondeur (présence du cookie uniquement, PAS de vérification
// de signature - trop coûteux en edge middleware). La vraie garde reste
// `requireUser()` / `requireAdmin()` (src/lib/session.ts) sur chaque page,
// qui vérifie la session côté serveur ET le flag `active` de l'utilisateur.
// Convention Next.js 16 : `proxy.ts` remplace `middleware.ts` (dépréciée).
const CHEMINS_PUBLICS = [
  "/sign-in",
  "/sign-up",
  "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe",
  // Pages légales : accessibles sans authentification (obligation légale).
  "/mentions-legales",
  "/confidentialite",
  "/cgu",
];

// `/icon` : route metadata Next (favicon brandé `src/app/icon.png`), doit rester
// publique pour s'afficher sur les pages non authentifiées (connexion, légal).
const PREFIXES_PUBLICS = [
  "/api/auth",
  "/api/invitations/preview",
  "/_next",
  "/icons",
  "/icon",
];

// Assets PWA qui DOIVENT rester publics : le navigateur charge le manifest et le
// service worker sans contexte d'authentification (sinon l'installation échoue).
// `/robots.txt` est servi par la route metadata `src/app/robots.ts`.
const FICHIERS_PUBLICS = [
  "/favicon.ico",
  "/manifest.webmanifest",
  "/sw.js",
  "/robots.txt",
];

function estCheminPublic(pathname: string): boolean {
  if (CHEMINS_PUBLICS.includes(pathname)) return true;
  if (FICHIERS_PUBLICS.includes(pathname)) return true;
  if (PREFIXES_PUBLICS.some((prefixe) => pathname.startsWith(prefixe))) {
    return true;
  }
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (estCheminPublic(pathname)) {
    return NextResponse.next();
  }

  const cookieSession = getSessionCookie(request);
  if (!cookieSession) {
    const urlConnexion = new URL("/sign-in", request.url);
    return NextResponse.redirect(urlConnexion);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Toutes les routes sauf les assets statiques Next (images, fichiers
    // avec extension) - la liste blanche fine est gérée par estCheminPublic.
    "/((?!_next/static|_next/image).*)",
  ],
};
