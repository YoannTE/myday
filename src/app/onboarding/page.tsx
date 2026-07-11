import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = {
  title: "Bienvenue",
  description:
    "Connecte Google, règle ton brief et installe MyDay en quatre étapes rapides.",
};

// Wizard d'accueil (4 étapes) - transposition fidèle de onboarding.html.
// Server Component : seule la garde d'accès (`requireUser`) est ici, tout le
// reste vit dans le wizard client (persistance `onboarding_step`).
export default async function OnboardingPage() {
  await requireUser();

  return (
    <div className="min-h-screen bg-bg">
      <header className="fade-in mx-auto max-w-4xl px-4 pt-8 pb-4 md:px-6 md:pt-12">
        <div className="mb-8 flex items-center gap-2">
          <div className="cta-gradient flex h-8 w-8 items-center justify-center rounded-inner font-display text-sm font-bold text-white">
            M
          </div>
          <span className="font-display font-bold tracking-[-0.02em] text-ink">
            MyDay
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-16 md:px-6">
        <OnboardingWizard />
      </main>
    </div>
  );
}
