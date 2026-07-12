"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { BriefHero } from "@/components/cockpit/brief-hero";
import { MeteoWidget } from "@/components/meteo/meteo-widget";
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
/**
 * Clé localStorage : mémorise (par appareil) si l'utilisateur a choisi
 * d'afficher le brief. Masqué par défaut (absence de valeur) : le brief
 * n'apparaît que si l'utilisateur l'a explicitement affiché.
 */
const CLE_BRIEF_AFFICHE = "myday:brief-affiche";

export function CockpitClient() {
  const [donnees, setDonnees] = useState<CockpitData | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [briefVisible, setBriefVisible] = useState(false);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBriefVisible(localStorage.getItem(CLE_BRIEF_AFFICHE) === "1");
  }, []);

  function basculerBrief() {
    setBriefVisible((visible) => {
      const nouveau = !visible;
      try {
        localStorage.setItem(CLE_BRIEF_AFFICHE, nouveau ? "1" : "0");
      } catch {
        // Stockage indisponible (navigation privée) : on garde l'état en mémoire.
      }
      return nouveau;
    });
  }

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
      {briefVisible ? (
        <BriefHero
          brief={donnees.brief}
          onRegenerated={charger}
          onMasquer={basculerBrief}
        />
      ) : (
        <button
          type="button"
          onClick={basculerBrief}
          className="fade-in delay-1 flex items-center justify-center gap-2 rounded-card bg-card px-4 py-3 font-body text-sm text-ink/60 shadow-card transition-colors hover:text-accent"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          Afficher le brief du jour
        </button>
      )}
      <MeteoWidget />
      <OnboardingResumeBanner />
      <JourneeTimeline evenements={donnees.prochains} onSuccess={charger} />
      <TachesChecklist taches={donnees.taches} onUpdated={handleTacheMiseAJour} />
      <NotesEpinglees notes={donnees.notes_epinglees} />
      <MailsImportants
        placeholder={donnees.mails_importants.placeholder}
        mails={donnees.mails_importants.mails ?? []}
      />
    </div>
  );
}
