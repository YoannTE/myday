import { Skeleton } from "@/components/ui/skeleton";

export function NotesSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)]">
      <div className="space-y-3 rounded-card bg-card p-4 shadow-card">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-inner" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-card" />
    </div>
  );
}
