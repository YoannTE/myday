import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { requireUser } from "@/lib/session";
import { AssistantClient } from "@/components/assistant/assistant-client";

export const metadata: Metadata = {
  title: "Assistant",
  description:
    "Discute avec ton assistant MyDay : crée des tâches, des notes, des rendez-vous, ou prépare une réponse à un mail.",
};

export default async function AssistantPage() {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <main className="mx-auto max-w-4xl px-4 pt-6 pb-40 md:px-6 md:pt-10">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 font-body text-sm text-ink/50 transition-colors hover:text-accent"
        >
          ← Cockpit
        </Link>
        <h1 className="mb-6 font-display text-xl font-extrabold tracking-[-0.02em] text-ink md:text-2xl">
          Assistant
        </h1>
        <AssistantClient />
      </main>
    </div>
  );
}
