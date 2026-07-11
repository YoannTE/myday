import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Freshness } from "@/components/layout/freshness";
import { TachesClient } from "@/components/taches/taches-client";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Tes tâches",
  description: "Toutes tes tâches : priorités, échéances et cochage rapide.",
};

export default async function TachesPage() {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
        <h1 className="mb-6 font-display text-2xl font-extrabold tracking-[-0.02em] text-ink md:text-3xl">
          Tes tâches
        </h1>
        <TachesClient />
      </main>
      <Freshness />
    </div>
  );
}
