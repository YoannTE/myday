import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { BudgetClient } from "@/components/budget/budget-client";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Budget",
  description:
    "Tes recettes et tes dépenses, du quotidien aux projets à venir, avec la projection de ton solde.",
};

/**
 * Section Budget de MyDay. Protégée deux fois : `requireUser()` pour la
 * session, puis le code à 4 chiffres côté client (`BudgetClient`), qui
 * conditionne l'accès aux endpoints `/api/budget/*`. Aucune donnée financière
 * n'est rendue côté serveur : la page arrive vide, elle ne se remplit qu'une
 * fois le code saisi.
 */
export default async function BudgetPage() {
  const user = await requireUser();

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
          Budget
        </h1>
        <BudgetClient />
      </main>
    </div>
  );
}
