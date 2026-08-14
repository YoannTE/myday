"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { BriefHero } from "@/components/cockpit/brief-hero";
import { CockpitSection } from "@/components/cockpit/cockpit-section";
import { CockpitSkeleton } from "@/components/cockpit/cockpit-skeleton";
import {
  useOrdreSections,
  type CleSection,
} from "@/components/cockpit/use-ordre-sections";
import { MeteoWidget } from "@/components/meteo/meteo-widget";
import { PlanningClient } from "@/components/planning/planning-client";
import { TachesClient } from "@/components/taches/taches-client";
import { NotesClient } from "@/components/notes/notes-client";
import { BudgetSection } from "@/components/budget/budget-section";
import { OnboardingResumeBanner } from "@/components/onboarding/onboarding-resume-banner";
import type { CockpitData } from "@/components/cockpit/types";

/**
 * Clé localStorage : mémorise (par appareil) si l'utilisateur a choisi
 * d'afficher le brief. Masqué par défaut (absence de valeur) : le brief
 * n'apparaît que si l'utilisateur l'a explicitement affiché.
 */
const CLE_BRIEF_AFFICHE = "myday:brief-affiche";

const LIBELLES_SECTION: Record<CleSection, string> = {
  meteo: "Météo",
  planning: "Planning",
  taches: "Tâches",
  notes: "Notes",
  budget: "Budget",
};

function contenuSection(cle: CleSection) {
  switch (cle) {
    case "meteo":
      return <MeteoWidget />;
    case "planning":
      return <PlanningClient />;
    case "taches":
      return <TachesClient />;
    case "notes":
      return <NotesClient />;
    case "budget":
      return <BudgetSection />;
  }
}

/**
 * Cockpit unique `/` (Round 016) : charge `GET /api/cockpit` uniquement pour
 * le brief du jour, émet `dashboard_opened` une seule fois au montage, puis
 * rend la carte hero Brief (non réordonnable) suivie des 4 sections
 * Météo/Planning/Tâches/Notes, réordonnables par l'utilisateur
 * (`useOrdreSections`). Le planning, les tâches et les notes ne dépendent
 * plus de sous-pages dédiées : `PlanningClient`/`TachesClient`/`NotesClient`
 * gèrent eux-mêmes leur chargement.
 */
export function CockpitClient() {
  const [donnees, setDonnees] = useState<CockpitData | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [briefVisible, setBriefVisible] = useState(false);
  const evenementEmis = useRef(false);
  const { ordre, deplacer } = useOrdreSections();

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
      <OnboardingResumeBanner />
      {ordre.map((cle, index) => (
        <CockpitSection
          key={cle}
          titre={LIBELLES_SECTION[cle]}
          peutMonter={index > 0}
          peutDescendre={index < ordre.length - 1}
          onMonter={() => deplacer(cle, "haut")}
          onDescendre={() => deplacer(cle, "bas")}
        >
          {contenuSection(cle)}
        </CockpitSection>
      ))}
    </div>
  );
}
