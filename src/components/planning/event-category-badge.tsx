import type { EventCategoryLite } from "@/components/planning/types";

/**
 * Pastille de couleur + nom de catégorie, réutilisée sur les événements
 * (carte de la grille planning) - miroir de `NoteCategoryBadge` (notes,
 * Round 015) appliqué aux événements.
 */
export function EventCategoryBadge({ categorie }: { categorie: EventCategoryLite }) {
  return (
    <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-soft px-2.5 py-1 font-mono text-[10px] tracking-[.04em] text-ink/70 uppercase">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: categorie.couleur }}
        aria-hidden="true"
      />
      {categorie.nom}
    </span>
  );
}
