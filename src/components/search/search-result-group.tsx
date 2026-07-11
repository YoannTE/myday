import type { ReactNode } from "react";

interface SearchResultGroupProps {
  titre: string;
  count: number;
  children: ReactNode;
}

/**
 * Groupe de résultats de la modale de recherche (Notes / Tâches / Événements
 * / Mails) - ne rend rien si le groupe est vide.
 */
export function SearchResultGroup({
  titre,
  count,
  children,
}: SearchResultGroupProps) {
  if (count === 0) return null;
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-1.5 px-1 font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
        {titre} · {count}
      </p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
