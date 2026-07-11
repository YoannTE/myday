import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Freshness } from "@/components/layout/freshness";
import { CockpitClient } from "@/components/cockpit/cockpit-client";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Ton cockpit",
  description:
    "Le cockpit personnel qui réunit ton planning, tes tâches, tes notes et tes mails importants.",
};

export default async function HomePage() {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
        <CockpitClient />
      </main>
      <Freshness />
    </div>
  );
}
