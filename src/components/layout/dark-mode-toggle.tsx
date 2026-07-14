"use client";

import { useSyncExternalStore } from "react";
import { apiCall } from "@/lib/api";
import { appliquerTheme } from "@/lib/theme";

function souscrireModeSombre(rafraichir: () => void): () => void {
  const observateur = new MutationObserver(rafraichir);
  observateur.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-mode"],
  });
  return () => observateur.disconnect();
}

function lireModeSombre(): boolean {
  return document.documentElement.getAttribute("data-mode") === "dark";
}

function lireModeSombreServeur(): boolean {
  return false;
}

/**
 * Bouton de bascule mode sombre (☾) de la navbar. Le choix est appliqué au
 * DOM + localStorage (anti-flash) ET mémorisé sur le profil (PATCH
 * /api/preferences) pour être réappliqué à chaque ouverture, sur tous les
 * appareils. Le script anti-flash de layout.tsx applique déjà la bonne valeur
 * au premier rendu ; ce composant se synchronise avec l'attribut DOM via
 * useSyncExternalStore, sans setState dans un effet.
 */
export function DarkModeToggle() {
  const modeSombre = useSyncExternalStore(
    souscrireModeSombre,
    lireModeSombre,
    lireModeSombreServeur,
  );

  function basculerModeSombre() {
    const prochainTheme = modeSombre ? "clair" : "sombre";
    appliquerTheme(prochainTheme);
    // Mémorisation sur le profil (best-effort : un échec réseau ne doit pas
    // empêcher la bascule locale immédiate).
    apiCall("/api/preferences", {
      method: "PATCH",
      body: { theme: prochainTheme },
    }).catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={basculerModeSombre}
      className="focus-ring flex h-9 w-9 items-center justify-center rounded-full bg-soft text-ink/60 transition-colors hover:text-accent"
      title="Mode sombre"
      aria-label="Basculer le mode sombre"
      aria-pressed={modeSombre}
    >
      ☾
    </button>
  );
}
