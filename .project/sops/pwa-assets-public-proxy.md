# SOP — Rendre les assets PWA publics dans le middleware d'auth (Next 16 `proxy.ts`)

**ID** : frontend-pwa-assets-public-proxy
**Catégorie** : Frontend
**Difficulté** : intermediate
**Tags** : pwa, manifest, service-worker, middleware, proxy, nextjs-16, auth, static-assets
**Créé le** : 2026-07-11
**Origine** : Round 005 (Onboarding et PWA) — manifest/sw/icônes redirigés vers /sign-in

## Symptôme

La PWA ne s'installe pas. Dans l'onglet réseau, `GET /manifest.webmanifest`, `GET /sw.js` et
`GET /icons/*.png` renvoient **307 → /sign-in** au lieu de 200. `curl` le confirme :
```
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/manifest.webmanifest   # 307
```
Le navigateur (et iOS) ne peut pas lire un manifest/SW protégé → « installer sur l'écran
d'accueil » indisponible, service worker non enregistré.

## Cause racine

Le middleware d'authentification protège TOUT sauf une liste blanche. Les assets PWA
(`manifest.webmanifest`, `sw.js`, icônes) ne sont pas dans cette liste → ils sont traités
comme des routes protégées et redirigés vers la page de connexion quand il n'y a pas de cookie
de session. Or ces assets sont chargés par le navigateur **hors contexte d'authentification**
et doivent rester publics.

C'est un angle mort de coordination : dans un round multi-agents, l'agent PWA crée les assets
mais ne possède pas forcément le fichier de middleware → personne ne les whiteliste. **La
whitelist du middleware fait partie de la définition de « done » d'une feature PWA.**

## Spécificité Next 16 (piège de version)

Next 16 a **renommé `middleware.ts` en `proxy.ts`** (la fonction exportée est `proxy`, plus
`middleware`). Chercher le middleware au bon endroit :
```bash
find src -name "proxy.ts" -o -name "middleware.ts"   # ici : src/proxy.ts
```
Le build l'affiche comme `ƒ Proxy (Middleware)`. Ne pas s'attendre à `middleware.ts`.

## Correctif (pattern liste blanche)

Dans `src/proxy.ts`, ajouter les assets PWA aux chemins publics AVANT le test du cookie :
```ts
const FICHIERS_PUBLICS = ["/favicon.ico", "/manifest.webmanifest", "/sw.js"];
const PREFIXES_PUBLICS = ["/api/auth", "/api/invitations/preview", "/_next", "/icons"];

function estCheminPublic(pathname: string): boolean {
  if (CHEMINS_PUBLICS.includes(pathname)) return true;
  if (FICHIERS_PUBLICS.includes(pathname)) return true;
  if (PREFIXES_PUBLICS.some((p) => pathname.startsWith(p))) return true;
  return false;
}
```
Garder `/onboarding` et le reste protégés (307 sans cookie).

## Checklist « feature PWA »
1. `manifest.webmanifest` public → **200** sans cookie.
2. `sw.js` public → **200**.
3. Icônes (`/icons/*` ou racine) publiques → **200**.
4. Les vraies pages restent protégées → **307** sans cookie (ne pas trop élargir la whitelist).
5. Vérifier au `curl`, pas seulement à l'œil : un 307 est invisible dans un navigateur déjà loggé.

## Règle
Toute feature qui ajoute des fichiers servis directement au navigateur sans session (PWA,
`robots.txt`, `sitemap.xml`, `.well-known/*`, favicons) DOIT les ajouter à la liste blanche du
middleware d'auth dans le même round. Le middleware (`src/proxy.ts` en Next 16) n'appartient à
aucun agent par défaut → l'assigner explicitement ou le corriger en consolidation.
