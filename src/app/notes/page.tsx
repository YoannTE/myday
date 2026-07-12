import { Suspense } from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Freshness } from "@/components/layout/freshness";
import { requireUser } from "@/lib/session";
import { NotesClient } from "@/components/notes/notes-client";
import { NotesSkeleton } from "@/components/notes/notes-skeleton";

export const metadata: Metadata = {
  title: "Tes notes",
  description:
    "Toutes tes notes au même endroit : épingle les plus importantes, archive celles dont tu n'as plus besoin.",
};

export default async function NotesPage() {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
        {/* `NotesClient` lit `?note=` via `useSearchParams` (F6, Round 014) :
            Suspense requis par Next.js pour ce hook. */}
        <Suspense fallback={<NotesSkeleton />}>
          <NotesClient />
        </Suspense>
      </main>
      <Freshness />
    </div>
  );
}
