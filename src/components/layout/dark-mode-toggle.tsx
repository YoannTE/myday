"use client";

import { useSyncExternalStore } from "react";

const CLE_STOCKAGE = "myday-theme";

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
 * Bouton de bascule mode sombre (☾) de la navbar. Le mode est persiste
 * dans localStorage et applique via l'attribut html[data-mode="dark"].
 * Le script anti-flash de layout.tsx applique deja la bonne valeur au
 * premier rendu ; ce composant se synchronise avec cet attribut DOM via
 * useSyncExternalStore (systeme externe : DOM + localStorage), sans setState
 * dans un effet.
 */
export function DarkModeToggle() {
  const modeSombre = useSyncExternalStore(
    souscrireModeSombre,
    lireModeSombre,
    lireModeSombreServeur,
  );

  function basculerModeSombre() {
    const prochainMode = !modeSombre;

    if (prochainMode) {
      document.documentElement.setAttribute("data-mode", "dark");
      window.localStorage.setItem(CLE_STOCKAGE, "dark");
    } else {
      document.documentElement.removeAttribute("data-mode");
      window.localStorage.setItem(CLE_STOCKAGE, "light");
    }
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
