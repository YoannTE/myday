import { cn } from "@/lib/utils";
import type { EventCategoryLite } from "@/components/planning/types";

/**
 * Pastille de couleur + nom de catégorie, réutilisée sur les événements
 * (carte de la grille planning et cockpit) - miroir de `NoteCategoryBadge`
 * (notes, Round 015) appliqué aux événements. `className` permet d'ajuster
 * le fond quand le conteneur est déjà `bg-soft` (cockpit).
 */
export function EventCategoryBadge({
  categorie,
  className,
}: {
  categorie: EventCategoryLite;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-soft px-2.5 py-1 font-mono text-[10px] tracking-[.04em] text-ink/70 uppercase",
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: categorie.couleur }}
        aria-hidden="true"
      />
      {categorie.nom}
    </span>
  );
}
