"use client";

import { useEffect } from "react";

/**
 * Enregistre `/sw.js` UNIQUEMENT en production. En développement, un
 * service worker actif interfère avec le hot module reload (assets mis en
 * cache, rechargements silencieusement servis depuis le cache) : on
 * désenregistre défensivement tout SW existant (ex. laissé par un ancien
 * build de prod testé en local).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Échec silencieux : l'app reste fonctionnelle sans PWA installable.
      });
      return;
    }

    navigator.serviceWorker.getRegistrations().then((enregistrements) => {
      enregistrements.forEach((enregistrement) => {
        enregistrement.unregister().catch(() => {});
      });
    });
  }, []);

  return null;
}
