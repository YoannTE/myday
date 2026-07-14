"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Moon, Sun } from "lucide-react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { appliquerTheme } from "@/lib/theme";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Theme } from "@/components/onboarding/types";

const OPTIONS: { valeur: Theme; libelle: string; icone: typeof Sun }[] = [
  { valeur: "clair", libelle: "Clair", icone: Sun },
  { valeur: "sombre", libelle: "Sombre", icone: Moon },
];

/**
 * Carte « Apparence » de /reglages : choix du thème par défaut (clair /
 * sombre). Le choix est mémorisé sur le profil (PATCH /api/preferences) et
 * réappliqué à chaque ouverture de l'application, sur tous les appareils. Le
 * bouton ☾ de la navbar permet toujours une bascule rapide.
 */
export function ApparenceCard() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    apiCall<{ data: { theme: Theme } }>("/api/preferences")
      .then((reponse) => {
        if (!annule) setTheme(reponse.data.theme);
      })
      .catch(() => {
        if (!annule) setTheme("clair");
      });
    return () => {
      annule = true;
    };
  }, []);

  async function choisir(nouveau: Theme) {
    if (nouveau === theme || enCours) return;
    const precedent = theme;
    setTheme(nouveau);
    appliquerTheme(nouveau);
    setEnCours(true);
    try {
      await apiCall("/api/preferences", {
        method: "PATCH",
        body: { theme: nouveau },
      });
      toast.success("Thème enregistré");
    } catch (erreur) {
      setTheme(precedent);
      if (precedent) appliquerTheme(precedent);
      toast.error(messageErreurApi(erreur, "Impossible d'enregistrer le thème."));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="fade-in delay-1 rounded-card bg-card p-6 shadow-card">
      <h2 className="mb-1 font-display font-bold tracking-[-0.02em] text-ink">
        Apparence
      </h2>
      <p className="mb-5 font-body text-sm text-ink/50">
        Choisis le thème par défaut de l&apos;application. Il est mémorisé sur ton
        profil et réappliqué à chaque ouverture.
      </p>
      {theme === null ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {OPTIONS.map((option) => {
            const actif = theme === option.valeur;
            const Icone = option.icone;
            return (
              <button
                key={option.valeur}
                type="button"
                disabled={enCours}
                onClick={() => choisir(option.valeur)}
                aria-pressed={actif}
                className={cn(
                  "flex items-center gap-3 rounded-inner border px-4 py-3 text-left transition-colors",
                  actif
                    ? "border-accent bg-accent/5"
                    : "border-ink/10 hover:border-ink/20",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
                    actif ? "bg-accent text-white" : "bg-soft text-ink/60",
                  )}
                >
                  <Icone className="h-4 w-4" />
                </span>
                <span className="font-body text-sm font-medium text-ink">
                  {option.libelle}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
