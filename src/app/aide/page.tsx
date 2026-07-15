import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Freshness } from "@/components/layout/freshness";
import { InstallerGuide } from "@/components/aide/installer-guide";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Aide",
  description:
    "Installe MyDay comme une application sur ton iPhone ou ton téléphone Android, en quelques étapes simples.",
};

export default async function AidePage() {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
        <div className="mb-6">
          <p className="font-mono text-[11px] tracking-[.04em] text-accent uppercase">
            Aide
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.02em] text-ink md:text-3xl">
            Installer MyDay sur ton téléphone
          </h1>
          <p className="mt-2 max-w-2xl font-body text-sm text-ink/60">
            En quelques étapes, tu ajoutes MyDay comme une vraie application sur
            ton écran d&apos;accueil, avec les notifications. Choisis ton
            téléphone ci-dessous.
          </p>
        </div>

        <InstallerGuide />

        <div className="mt-5 flex items-start gap-3 rounded-card bg-card p-5 shadow-card">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" />
          <p className="font-body text-sm leading-relaxed text-ink/70">
            <b className="font-semibold text-ink">
              Pas besoin de l&apos;App Store ni du Play Store.
            </b>{" "}
            MyDay s&apos;installe directement depuis ton navigateur,
            gratuitement. Tu obtiens quand même une vraie icône, un écran plein
            et les notifications, exactement comme une application classique.
          </p>
        </div>
      </main>
      <Freshness />
    </div>
  );
}
