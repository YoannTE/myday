import { cn } from "@/lib/utils";

/**
 * Petit rond avec l'initiale du propriétaire, affiché sur un élément
 * (événement, tâche, note) reçu en partage d'un autre compte, en lecture
 * seule. Le nom complet reste accessible via le tooltip natif (`title`) et
 * `aria-label`. `className` permet d'ajuster la taille/position quand le
 * conteneur l'exige.
 */
export function PartageBadge({
  nom,
  className,
}: {
  nom: string;
  className?: string;
}) {
  const initiale = nom.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      title={`Partagé par ${nom}`}
      aria-label={`Partagé par ${nom}`}
      className={cn(
        "cta-gradient inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full font-mono text-[9px] text-white",
        className,
      )}
    >
      {initiale}
    </span>
  );
}
