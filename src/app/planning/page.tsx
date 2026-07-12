import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Freshness } from "@/components/layout/freshness";
import { requireUser } from "@/lib/session";
import { PlanningClient } from "@/components/planning/planning-client";

export const metadata: Metadata = {
  title: "Ton planning",
  description:
    "Ton planning en vues jour, semaine, mois et année : rendez-vous, événements et synchronisation avec Google Agenda.",
};

export default async function PlanningPage() {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
        <PlanningClient />
      </main>
      <Freshness />
    </div>
  );
}
