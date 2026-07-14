import type { TaskCategoryLite } from "@/components/taches/types";

/**
 * Pastille de couleur + nom de catégorie, réutilisée sur les cartes de tâche
 * (cockpit et page `/taches`) et les en-têtes de groupe (Round 012, F2).
 */
export function CategoryBadge({ categorie }: { categorie: TaskCategoryLite }) {
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
