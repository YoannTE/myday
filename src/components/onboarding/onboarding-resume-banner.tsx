"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiCall } from "@/lib/api";
import type { Preferences } from "@/components/onboarding/types";

const LIBELLES_ETAPE: Record<number, string> = {
  0: "Connecte Google",
  1: "Connecte Google",
  2: "Règle ton brief",
  3: "Installe MyDay",
  4: "Ouvre ton cockpit",
};

/**
 * Bannière de reprise d'onboarding (cockpit `/`) : discrète, affichée tant
 * que `onboarding_completed` est faux, renvoie vers l'étape où
 * l'utilisateur s'était arrêté (corr. arch#9, plan Round 005).
 */
export function OnboardingResumeBanner() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  useEffect(() => {
    let annule = false;
    apiCall<{ data: Preferences }>("/api/preferences")
      .then((reponse) => {
        if (!annule) setPreferences(reponse.data);
      })
      .catch(() => {
        // Non bloquant : si les préférences ne chargent pas, on n'affiche
        // simplement pas la bannière plutôt que de gêner le cockpit.
      });
    return () => {
      annule = true;
    };
  }, []);

  if (!preferences || preferences.onboarding_completed) return null;

  const etape = Math.min(Math.max(preferences.onboarding_step, 1), 4);

  return (
    <Link
      href="/onboarding"
      className="fade-in flex items-center justify-between gap-3 rounded-inner border border-accent/20 bg-soft px-4 py-3 font-body text-sm text-ink/70 transition-colors hover:border-accent/40"
    >
      <span>
        Termine ta configuration —{" "}
        <span className="font-medium text-ink">{LIBELLES_ETAPE[etape]}</span>
      </span>
      <span className="font-medium text-accent">Continuer →</span>
    </Link>
  );
}
