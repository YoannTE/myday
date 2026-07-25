"use client";

import { Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CockpitSectionActions } from "@/components/cockpit/section-actions";
import { SectionAddButton } from "@/components/cockpit/section-add-button";
import { SectionSettingsButton } from "@/components/cockpit/section-settings-button";
import { EventFormDialog } from "@/components/planning/event-form-dialog";
import type { VuePlanning } from "@/components/planning/date-utils";

const VUES: { valeur: VuePlanning; libelle: string }[] = [
  { valeur: "jour", libelle: "Jour" },
  { valeur: "semaine", libelle: "Semaine" },
  { valeur: "mois", libelle: "Mois" },
  { valeur: "annee", libelle: "Année" },
];

interface PlanningHeaderProps {
  vue: VuePlanning;
  onChangerVue: (vue: VuePlanning) => void;
  libellePlage: string;
  onPrecedent: () => void;
  onSuivant: () => void;
  onAujourdHui: () => void;
  onSuccess: () => void;
  onGererCategories: () => void;
}

export function PlanningHeader({
  vue,
  onChangerVue,
  libellePlage,
  onPrecedent,
  onSuivant,
  onAujourdHui,
  onSuccess,
  onGererCategories,
}: PlanningHeaderProps) {
  return (
    <div>
      <CockpitSectionActions>
        <SectionSettingsButton
          onClick={onGererCategories}
          libelle="Gérer les catégories d'événements"
        />
        <EventFormDialog
          onSuccess={onSuccess}
          trigger={<SectionAddButton aria-label="Ajouter un événement" />}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </EventFormDialog>
      </CockpitSectionActions>
      <div className="fade-in mb-6 flex flex-wrap items-center gap-3">
        <Tabs
          value={vue}
          onValueChange={(valeur) => onChangerVue(valeur as VuePlanning)}
        >
          <TabsList className="h-9 gap-0.5 rounded-inner bg-soft p-1">
            {VUES.map((item) => (
              <TabsTrigger
                key={item.valeur}
                value={item.valeur}
                className={`rounded-[10px] px-3 font-mono text-[11px] tracking-[.04em] uppercase shadow-none transition-colors ${
                  vue === item.valeur
                    ? "cta-gradient text-white"
                    : "bg-transparent text-ink/50"
                }`}
              >
                {item.libelle}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAujourdHui}
            className="rounded-inner bg-card px-3 py-1.5 font-mono text-[10px] tracking-[.04em] text-ink/60 uppercase shadow-card transition-colors hover:text-accent"
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            onClick={onPrecedent}
            aria-label="Période précédente"
            className="flex h-8 w-8 items-center justify-center rounded-inner bg-card text-ink/60 shadow-card"
          >
            ‹
          </button>
          <span className="px-1 text-center font-mono text-xs tracking-[.04em] text-ink/60 uppercase">
            {libellePlage}
          </span>
          <button
            type="button"
            onClick={onSuivant}
            aria-label="Période suivante"
            className="flex h-8 w-8 items-center justify-center rounded-inner bg-card text-ink/60 shadow-card"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
