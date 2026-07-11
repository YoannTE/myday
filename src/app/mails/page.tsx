import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Freshness } from "@/components/layout/freshness";
import { requireUser } from "@/lib/session";
import { MailsClient } from "@/components/mails/mails-client";

export const metadata: Metadata = {
  title: "Tes mails",
  description:
    "Les mails triés par l'IA, du plus important au moins urgent, avec résumé et raison du score.",
};

export default async function MailsPage() {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
        <MailsClient />
      </main>
      <Freshness />
    </div>
  );
}
