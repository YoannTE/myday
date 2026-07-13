import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Freshness } from "@/components/layout/freshness";
import { ProfilCard } from "@/components/reglages/profil-card";
import { PartageCard } from "@/components/reglages/partage-card";
import { BriefNotificationsForm } from "@/components/reglages/brief-notifications-form";
import { NotificationsPush } from "@/components/reglages/notifications-push";
import { DangerZone } from "@/components/reglages/danger-zone";
import { ReglagesTabs } from "@/components/reglages/reglages-tabs";
import { AdminSection } from "@/components/reglages/admin/admin-section";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Réglages",
  description:
    "Gère ton profil, tes notifications et, si tu es administrateur, les comptes et invitations MyDay.",
};

export default async function ReglagesPage() {
  const user = await requireUser();
  const role = (user as { role?: string }).role ?? "user";
  const estAdmin = role === "admin";

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 font-body text-sm text-ink/50 transition-colors hover:text-accent"
        >
          ← Cockpit
        </Link>
        <h1 className="mb-6 font-display text-xl font-extrabold tracking-[-0.02em] text-ink md:text-2xl">
          Réglages
        </h1>

        <ReglagesTabs
          monCompte={
            <>
              <ProfilCard name={user.name} email={user.email} role={role} />
              <PartageCard />
              <DangerZone />
            </>
          }
          briefNotifications={
            <>
              <BriefNotificationsForm />
              <NotificationsPush />
            </>
          }
          administration={
            estAdmin ? <AdminSection currentUserId={user.id} /> : undefined
          }
        />
      </main>
      <Freshness />
    </div>
  );
}
