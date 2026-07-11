import { cn } from "@/lib/utils";
import type { UserActiveDays } from "@/components/reglages/admin/usage-types";

function formaterSemaine(dateISO: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(new Date(dateISO));
}

// Ligne d'activité hebdomadaire d'un utilisateur - une pastille par semaine
// glissante (4 semaines), affichant les jours distincts avec au moins une
// ouverture du cockpit. Pastille accentuée dès que le critère de succès
// produit (≥5 jours/7) est atteint, pour repérer l'usage réel en un coup
// d'œil.
export function UsageActiviteSemaine({ donnees }: { donnees: UserActiveDays }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <p className="w-32 flex-shrink-0 font-body text-sm text-ink">
        {donnees.user_label}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {donnees.weeks.map((semaine) => (
          <span
            key={semaine.semaine}
            title={`Semaine du ${formaterSemaine(semaine.semaine)}`}
            className={cn(
              "flex h-8 w-11 flex-col items-center justify-center rounded-inner font-mono text-[10px] tracking-[.02em]",
              semaine.jours_actifs >= 5
                ? "bg-accent/10 text-accent"
                : "bg-soft text-ink/40",
            )}
          >
            <span className="font-semibold">{semaine.jours_actifs}/7</span>
          </span>
        ))}
      </div>
    </div>
  );
}
