import { Skeleton } from "@/components/ui/skeleton";

// État de chargement de la carte Google - garde la même hauteur que les
// autres variantes pour éviter un saut de mise en page.
export function GoogleCardChargement() {
  return (
    <div className="rounded-inner border border-ink/10 p-5">
      <div className="mb-3 flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
    </div>
  );
}
