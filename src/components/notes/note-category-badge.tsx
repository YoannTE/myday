import type { NoteCategoryLite } from "@/components/notes/types";

/**
 * Pastille de couleur + nom de catégorie, réutilisée sur les notes (liste,
 * note ouverte, notes épinglées du cockpit) - miroir de `CategoryBadge`
 * (tâches, Round 012) appliqué aux notes (Round 015).
 */
export function NoteCategoryBadge({ categorie }: { categorie: NoteCategoryLite }) {
  return (
    <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-soft px-1.5 py-0.5 font-mono text-[8px] tracking-[.04em] text-ink/70 uppercase">
      <span
        className="h-1 w-1 rounded-full"
        style={{ backgroundColor: categorie.couleur }}
        aria-hidden="true"
      />
      {categorie.nom}
    </span>
  );
}
