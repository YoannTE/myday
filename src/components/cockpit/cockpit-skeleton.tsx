import { Skeleton } from "@/components/ui/skeleton";

/** État de chargement du cockpit unique, avant la première réponse de `GET /api/cockpit`. */
export function CockpitSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-4">
          <Skeleton className="h-6 w-32" />
          <div className="rounded-card bg-card p-6 shadow-card">
            <Skeleton className="mb-3 h-4 w-full" />
            <Skeleton className="mb-3 h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
