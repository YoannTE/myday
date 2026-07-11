/**
 * Service worker MyDay (production uniquement, cf. service-worker-register.tsx).
 *
 * Stratégies :
 * - navigation/document + /_next/data : network-first (sinon l'app shell
 *   reste figée après un déploiement, un utilisateur pourrait rester bloqué
 *   sur une version périmée en PWA installée)
 * - assets statiques (/_next/static, /icons) : cache-first (immuables,
 *   hashés par build)
 * - /api : JAMAIS intercepté, toujours réseau direct (les mutations et
 *   données utilisateur ne doivent jamais être servies depuis un cache)
 */

const CACHE_VERSION = "myday-cache-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const noms = await caches.keys();
      await Promise.all(
        noms
          .filter((nom) => nom !== CACHE_VERSION)
          .map((nom) => caches.delete(nom)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Jamais l'API : réseau direct, aucune interception.
  if (url.pathname.startsWith("/api")) return;

  if (request.method !== "GET") return;

  const estNavigationOuDonnees =
    request.mode === "navigate" || url.pathname.startsWith("/_next/data");

  if (estNavigationOuDonnees) {
    event.respondWith(reseauEnPremier(request));
    return;
  }

  const estAssetStatique =
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons");

  if (estAssetStatique) {
    event.respondWith(cacheEnPremier(request));
  }
});

async function reseauEnPremier(request) {
  try {
    const reponse = await fetch(request);
    const cache = await caches.open(CACHE_VERSION);
    cache.put(request, reponse.clone());
    return reponse;
  } catch (erreur) {
    const reponseEnCache = await caches.match(request);
    if (reponseEnCache) return reponseEnCache;
    throw erreur;
  }
}

async function cacheEnPremier(request) {
  const reponseEnCache = await caches.match(request);
  if (reponseEnCache) return reponseEnCache;

  const reponse = await fetch(request);
  const cache = await caches.open(CACHE_VERSION);
  cache.put(request, reponse.clone());
  return reponse;
}

// Notification push (Round 009) : le payload est envoyé en JSON par le
// backend (`services/push/sender.py`) - { title, body, url }. `url` sert de
// cible de navigation au clic (cf. notificationclick ci-dessous).
self.addEventListener("push", (event) => {
  let donnees = { title: "MyDay", body: "", url: "/" };
  try {
    if (event.data) donnees = { ...donnees, ...event.data.json() };
  } catch {
    // Payload non-JSON : on garde les valeurs par défaut ci-dessus.
  }

  event.waitUntil(
    self.registration.showNotification(donnees.title, {
      body: donnees.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: donnees.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(self.clients.openWindow(url));
});
