import type { TaskCategoryLite } from "@/components/taches/types";

/**
 * Pastille de couleur + nom de catégorie, réutilisée sur les cartes de tâche
 * (cockpit et page `/taches`) et les en-têtes de groupe (Round 012, F2).
 */
export function CategoryBadge({ categorie }: { categorie: TaskCategoryLite }) {
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
