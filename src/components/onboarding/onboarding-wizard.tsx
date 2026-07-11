"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { EtapeGoogle } from "@/components/onboarding/etape-google";
import { EtapePreferences } from "@/components/onboarding/etape-preferences";
import { EtapePwa } from "@/components/onboarding/etape-pwa";
import { EtapeFinale } from "@/components/onboarding/etape-finale";
import type { Preferences } from "@/components/onboarding/types";

/**
 * Wizard d'onboarding (4 étapes : Google, Préférences, PWA, Final). Persiste
 * `onboarding_step` (0 non démarré, 1..4 étape courante affichée) à chaque
 * transition via PATCH /api/preferences (cf. .project/rounds/005/plan.md
 * « Sémantique figée onboarding_step »).
 */
export function OnboardingWizard() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const reponse = await apiCall<{ data: Preferences }>("/api/preferences");
      if (reponse.data.onboarding_completed) {
        router.replace("/");
        return;
      }
      setPreferences(reponse.data);
      setErreur(null);
    } catch (erreurChargement) {
      setErreur(
        messageErreurApi(
          erreurChargement,
          "Impossible de récupérer ta progression d'installation.",
        ),
      );
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  async function avancer(etapeSuivante: number, patch?: Partial<Preferences>) {
    try {
      const reponse = await apiCall<{ data: Preferences }>("/api/preferences", {
        method: "PATCH",
        body: { ...patch, onboarding_step: etapeSuivante },
      });
      setPreferences(reponse.data);
    } catch (erreurEnvoi) {
      toast.error(
        messageErreurApi(
          erreurEnvoi,
          "Impossible d'enregistrer ta progression. Réessaie.",
        ),
      );
    }
  }

  async function terminer() {
    try {
      const reponse = await apiCall<{ data: Preferences }>("/api/preferences", {
        method: "PATCH",
        body: { onboarding_completed: true, onboarding_step: 4 },
      });
      setPreferences(reponse.data);
      router.push("/");
    } catch (erreurEnvoi) {
      toast.error(
        messageErreurApi(
          erreurEnvoi,
          "Impossible de finaliser ton installation. Réessaie.",
        ),
      );
    }
  }

  if (erreur) {
    return (
      <div className="rounded-card bg-card p-6 text-center shadow-card">
        <p className="font-body text-sm text-ink/60">{erreur}</p>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-full max-w-md rounded-inner" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const etapeActuelle = Math.min(Math.max(preferences.onboarding_step, 1), 4);

  return (
    <div className="flex flex-col gap-6">
      <OnboardingProgress etapeActuelle={etapeActuelle} />

      {etapeActuelle === 1 && <EtapeGoogle onContinuer={() => avancer(2)} />}
      {etapeActuelle === 2 && (
        <EtapePreferences
          preferences={preferences}
          onContinuer={(patch) => avancer(3, patch)}
        />
      )}
      {etapeActuelle === 3 && <EtapePwa onContinuer={() => avancer(4)} />}
      {etapeActuelle === 4 && <EtapeFinale onTerminer={terminer} />}
    </div>
  );
}
