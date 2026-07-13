import Link from "next/link";
import { Plus } from "lucide-react";
import { EventFormDialog } from "@/components/planning/event-form-dialog";
import { SectionAddButton } from "@/components/cockpit/section-add-button";
import { JourneeTimelineItem } from "@/components/cockpit/journee-timeline-item";
import type { CockpitEvent } from "@/components/cockpit/types";

interface JourneeTimelineProps {
  evenements: CockpitEvent[];
  onSuccess: () => void;
}

/**
 * Bloc « Ton planning » du cockpit (F8, Round 014 — anciennement
 * « Ta journée ») : les 10 prochains événements à venir (`prochains`, tri
 * croissant fourni par le backend), pas seulement ceux du jour. Pastille
 * `.pulse-now` sur l'événement en cours ; date affichée uniquement pour les
 * jours différents d'aujourd'hui (fuseau Europe/Paris, `date-utils.ts`).
 * Bouton « + » (F7) : création rapide d'événement sans quitter le cockpit.
 * Chaque ligne est déléguée à `JourneeTimelineItem` (gère le cas partagé).
 */
export function JourneeTimeline({ evenements, onSuccess }: JourneeTimelineProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-ink">
            Planning
          </h2>
          <EventFormDialog
            onSuccess={onSuccess}
            trigger={<SectionAddButton aria-label="Ajouter un événement" />}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </EventFormDialog>
        </div>
        <Link href="/planning" className="font-body text-sm text-accent">
          Tout voir →
        </Link>
      </div>
      <div className="flex flex-col gap-4 rounded-card bg-card p-6 shadow-card">
        {evenements.length === 0 ? (
          <p className="text-center font-body text-sm text-ink/50">
            Aucun rendez-vous prévu.
          </p>
        ) : (
          evenements.map((evenement) => (
            <JourneeTimelineItem
              key={evenement.id}
              evenement={evenement}
              onSuccess={onSuccess}
            />
          ))
        )}
      </div>
    </section>
  );
}
