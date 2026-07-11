"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { BriefHero } from "@/components/cockpit/brief-hero";
import { NotesEpinglees } from "@/components/cockpit/notes-epinglees";
import { JourneeTimeline } from "@/components/cockpit/journee-timeline";
import { TachesChecklist } from "@/components/cockpit/taches-checklist";
import { MailsImportants } from "@/components/cockpit/mails-importants";
import { OnboardingResumeBanner } from "@/components/onboarding/onboarding-resume-banner";
import type { CockpitData } from "@/components/cockpit/types";
import type { Task } from "@/components/taches/types";

function CockpitSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-4">
          <Skeleton className="h-6 w-32" />
          <div className="rounded-card bg-card p-6 shadow-card">
            <Skeleton className="mb-3 h-4 w-full" />
            <Skeleton className="mb-3 h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Cockpit `/` (F3) : charge `GET /api/cockpit`, émet `dashboard_opened` une
 * seule fois au montage, puis rend la carte hero Brief (F8, Round 007) suivie
 * des blocs Notes/Journée/Tâches/Mails.
 */
export function CockpitClient() {
  const [donnees, setDonnees] = useState<CockpitData | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const evenementEmis = useRef(false);

  const charger = useCallback(async () => {
    try {
      const reponse = await apiCall<{ data: CockpitData }>("/api/cockpit");
      setDonnees(reponse.data);
      setErreur(null);
    } catch (erreurChargement) {
      setErreur(
        messageErreurApi(
          erreurChargement,
          "Impossible de récupérer ton cockpit.",
        ),
      );
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  useEffect(() => {
    if (evenementEmis.current) return;
    evenementEmis.current = true;
    apiCall("/api/usage-events", {
      method: "POST",
      body: { type: "dashboard_opened" },
    }).catch(() => {
      // Journal d'usage non bloquant - un échec ne doit jamais gêner l'utilisateur.
    });
  }, []);

  function handleTacheMiseAJour(tache: Task) {
    setDonnees((actuelles) => {
      if (!actuelles) return actuelles;
      if (tache.statut === "faite") {
        return {
          ...actuelles,
          taches: actuelles.taches.filter((t) => t.id !== tache.id),
        };
      }
      const existeDeja = actuelles.taches.some((t) => t.id === tache.id);
      const taches = existeDeja
        ? actuelles.taches.map((t) => (t.id === tache.id ? tache : t))
        : [tache, ...actuelles.taches];
      return { ...actuelles, taches };
    });
  }

  if (erreur) {
    return (
      <div className="rounded-card bg-card p-6 text-center shadow-card">
        <p className="font-body text-sm text-ink/60">{erreur}</p>
      </div>
    );
  }

  if (!donnees) {
    return <CockpitSkeleton />;
  }

  return (
    <div className="flex flex-col gap-10">
      <BriefHero brief={donnees.brief} onRegenerated={charger} />
      <OnboardingResumeBanner />
      <NotesEpinglees notes={donnees.notes_epinglees} />
      <JourneeTimeline evenements={donnees.journee} />
      <TachesChecklist taches={donnees.taches} onUpdated={handleTacheMiseAJour} />
      <MailsImportants
        placeholder={donnees.mails_importants.placeholder}
        mails={donnees.mails_importants.mails ?? []}
      />
    </div>
  );
}
