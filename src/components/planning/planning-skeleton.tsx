import { Skeleton } from "@/components/ui/skeleton";

export function PlanningSkeleton() {
  return (
    <div className="rounded-card bg-card p-4 shadow-card md:p-6">
      {/* Vue jour (mobile) */}
      <div className="space-y-3 md:hidden">
        <Skeleton className="h-7 w-full rounded-inner" />
        <Skeleton className="h-16 w-full rounded-inner" />
        <Skeleton className="h-16 w-full rounded-inner" />
        <Skeleton className="h-16 w-full rounded-inner" />
      </div>
      {/* Vue semaine en colonnes (desktop) */}
      <div className="hidden grid-cols-7 gap-3 md:grid">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="mx-auto h-3 w-10" />
            <Skeleton className="h-14 w-full rounded-inner" />
            <Skeleton className="h-14 w-full rounded-inner" />
          </div>
        ))}
      </div>
    </div>
  );
}
