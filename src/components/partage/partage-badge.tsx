import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pastille « Partagé par X » affichée sur un élément (événement, tâche,
 * note) reçu en partage d'un autre compte, en lecture seule - miroir des
 * badges de catégorie (`CategoryBadge`, `NoteCategoryBadge`,
 * `EventCategoryBadge`). `className` permet d'ajuster le fond quand le
 * conteneur est déjà `bg-soft`.
 */
export function PartageBadge({
  nom,
  className,
}: {
  nom: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-soft px-2.5 py-1 font-mono text-[10px] tracking-[.04em] text-ink/70 uppercase",
        className,
      )}
    >
      <Users className="h-3 w-3" aria-hidden="true" />
      Partagé par {nom}
    </span>
  );
}
