import { cn } from "@/lib/utils";
import {
  estAujourdHui,
  formaterEnteteJour,
  formaterHeure,
} from "@/components/planning/date-utils";
import { EventFormDialog } from "@/components/planning/event-form-dialog";
import { EventCategoryBadge } from "@/components/planning/event-category-badge";
import { PartageBadge } from "@/components/partage/partage-badge";
import type { CockpitEvent } from "@/components/cockpit/types";

function estEnCours(evenement: CockpitEvent): boolean {
  const maintenant = Date.now();
  return (
    new Date(evenement.debut).getTime() <= maintenant &&
    maintenant <= new Date(evenement.fin).getTime()
  );
}

/**
 * Ligne d'un événement dans le bloc « Planning » du cockpit
 * (`JourneeTimeline`) - extrait pour garder le parent sous ~150 lignes. Un
 * événement partagé (reçu d'un autre compte) est en lecture seule : pas de
 * dialog d'édition, simple bloc non cliquable + `PartageBadge`.
 */
export function JourneeTimelineItem({
  evenement,
  onSuccess,
}: {
  evenement: CockpitEvent;
  onSuccess: () => void;
}) {
  const enCours = estEnCours(evenement);
  const debut = new Date(evenement.debut);
  const aujourdHui = estAujourdHui(debut);
  const partage = evenement.partage_par != null;

  const contenu = (
    <>
      <span
        className={cn(
          "flex w-16 flex-shrink-0 flex-col items-start gap-0.5 font-mono text-xs",
          enCours ? "text-accent" : "text-ink/40",
        )}
      >
        {!aujourdHui && (
          <span className="text-[10px] text-ink/30 uppercase">
            {formaterEnteteJour(debut)}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          {enCours && (
            <span className="pulse-now inline-block h-2 w-2 rounded-full bg-accent" />
          )}
          {formaterHeure(evenement.debut)}
        </span>
      </span>
      <div
        className={cn(
          "min-w-0 flex-1 rounded-inner px-4 py-3 transition-colors",
          enCours
            ? "border-2 border-accent/30 group-hover:bg-soft/40"
            : "bg-soft group-hover:bg-soft/70",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 font-body break-words text-ink">
            {evenement.titre}
          </p>
          {evenement.categorie && (
            <EventCategoryBadge categorie={evenement.categorie} className="bg-card" />
          )}
          {partage && (
            <PartageBadge nom={evenement.partage_par as string} className="bg-card" />
          )}
        </div>
        {evenement.lieu && (
          <p className="mt-0.5 font-body text-xs text-ink/50">{evenement.lieu}</p>
        )}
      </div>
    </>
  );

  if (partage) {
    return (
      <div className="flex w-full items-center gap-4 rounded-inner text-left">
        {contenu}
      </div>
    );
  }

  return (
    <EventFormDialog
      evenement={evenement}
      onSuccess={onSuccess}
      trigger={
        <button
          type="button"
          aria-label={`Modifier « ${evenement.titre} »`}
          className="group flex w-full items-center gap-4 rounded-inner text-left"
        />
      }
    >
      {contenu}
    </EventFormDialog>
  );
}
