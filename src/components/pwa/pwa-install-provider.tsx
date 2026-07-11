"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";

/**
 * Hook PWA figé (cf. plan Round 005 - contrat FRONT-B fournit / FRONT-A
 * consomme UNIQUEMENT) :
 * `import { usePwaInstall } from "@/components/pwa/pwa-install-provider"`
 * Interdit de passer par `window` brut ailleurs dans l'app.
 */
interface UsePwaInstall {
  canInstall: boolean;
  isIOS: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<void>;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface EtatPwa {
  canInstall: boolean;
  isInstalled: boolean;
  isIOS: boolean;
}

const ETAT_SERVEUR: EtatPwa = {
  canInstall: false,
  isInstalled: false,
  isIOS: false,
};

// Singleton module-level : le listener `beforeinstallprompt` est posé dès le
// chargement de ce module (avant tout montage de composant), pour ne jamais
// rater l'événement si le navigateur le déclenche tôt dans le cycle de vie
// de la page (contrairement à un useEffect posé au niveau d'une étape
// d'onboarding, monté bien plus tard).
let evenementInstallDiffere: BeforeInstallPromptEvent | null = null;
let installeeConfirmee = false;
const abonnes = new Set<() => void>();

function detecterIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  // iPadOS 13+ se présente en Mac (userAgent), on le détecte via le
  // support tactile multipoint absent sur un vrai Mac.
  const iPadOsDeguise =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return uaIos || iPadOsDeguise;
}

function detecterInstallee(): boolean {
  if (typeof window === "undefined") return false;
  if (installeeConfirmee) return true;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone,
  );
}

function calculerEtat(): EtatPwa {
  return {
    canInstall: evenementInstallDiffere !== null,
    isInstalled: detecterInstallee(),
    isIOS: detecterIOS(),
  };
}

let etatActuel: EtatPwa =
  typeof window === "undefined" ? ETAT_SERVEUR : calculerEtat();

function notifierAbonnes() {
  etatActuel = calculerEtat();
  abonnes.forEach((notifier) => notifier());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (evenement) => {
    // Empêche la mini-infobar native du navigateur : on gère l'invite
    // nous-mêmes via `promptInstall()` déclenché depuis l'étape PWA.
    evenement.preventDefault();
    evenementInstallDiffere = evenement as BeforeInstallPromptEvent;
    notifierAbonnes();
  });

  window.addEventListener("appinstalled", () => {
    installeeConfirmee = true;
    evenementInstallDiffere = null;
    notifierAbonnes();
  });
}

function souscrire(notifier: () => void) {
  abonnes.add(notifier);
  return () => {
    abonnes.delete(notifier);
  };
}

function obtenirEtat(): EtatPwa {
  return etatActuel;
}

function obtenirEtatServeur(): EtatPwa {
  return ETAT_SERVEUR;
}

/**
 * Expose l'état d'installabilité PWA (bufferisé dès le boot) : éligible à
 * l'invite native, iOS (pas d'invite native → instructions manuelles),
 * déjà installée. `promptInstall()` déclenche l'invite native bufferisée.
 */
export function usePwaInstall(): UsePwaInstall {
  const { canInstall, isInstalled, isIOS } = useSyncExternalStore(
    souscrire,
    obtenirEtat,
    obtenirEtatServeur,
  );

  const promptInstall = useCallback(async () => {
    const evenement = evenementInstallDiffere;
    if (!evenement) return;
    await evenement.prompt();
    const choix = await evenement.userChoice;
    if (choix.outcome === "accepted") {
      installeeConfirmee = true;
    }
    evenementInstallDiffere = null;
    notifierAbonnes();
  }, []);

  return { canInstall, isIOS, isInstalled, promptInstall };
}

/**
 * Provider PWA : ne rend rien de spécial, sa seule responsabilité est
 * d'être monté haut dans l'arbre (layout racine) pour garantir que ce
 * module est chargé — donc que le listener `beforeinstallprompt`
 * ci-dessus est posé — dès le boot de l'application.
 */
export function PwaInstallProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
