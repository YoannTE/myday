"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import {
  SECTIONS_COCKPIT,
  SECTIONS_TOUTES_VISIBLES,
  type PreferencesSections,
} from "@/lib/sections-cockpit";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carte « Sections du cockpit » de /reglages : affiche ou masque chacune des
 * cinq sections. Tout est affiché au départ, masquer est un choix explicite.
 *
 * Le réglage vit sur le profil et non sur l'appareil : une section masquée
 * doit l'être sur le Mac comme sur le téléphone, au même titre que le thème.
 * L'ordre des sections, lui, reste local (flèches du cockpit).
 *
 * Enregistrement immédiat à chaque bascule, avec mise à jour optimiste et
 * retour en arrière en cas d'échec (même motif que « Brief & notifications »).
 */
export function SectionsCockpitCard() {
  const [preferences, setPreferences] = useState<PreferencesSections | null>(
    null,
  );
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    apiCall<{ data: PreferencesSections }>("/api/preferences")
      .then((reponse) => {
        // Un moteur pas encore à jour ne renvoie pas les champs `section_*` :
        // on complète, sinon les interrupteurs partiraient non contrôlés.
        if (!annule) {
          setPreferences({ ...SECTIONS_TOUTES_VISIBLES, ...reponse.data });
        }
      })
      .catch(() => {
        if (!annule) setPreferences(null);
      });
    return () => {
      annule = true;
    };
  }, []);

  async function basculer(cle: keyof PreferencesSections, valeur: boolean) {
    if (!preferences || enCours) return;
    const precedent = preferences;
    setPreferences({ ...preferences, [cle]: valeur });
    setEnCours(true);
    try {
      await apiCall("/api/preferences", {
        method: "PATCH",
        body: { [cle]: valeur },
      });
    } catch (erreur) {
      setPreferences(precedent);
      toast.error(
        messageErreurApi(erreur, "Impossible d'enregistrer ce réglage."),
      );
    } finally {
      setEnCours(false);
    }
  }

  const masquees = preferences
    ? SECTIONS_COCKPIT.filter((section) => !preferences[section.cle]).length
    : 0;

  return (
    <section className="fade-in delay-2 rounded-card bg-card p-6 shadow-card">
      <h2 className="mb-1 font-display font-bold tracking-[-0.02em] text-ink">
        Sections du cockpit
      </h2>
      <p className="mb-5 font-body text-sm text-ink/50">
        Choisis ce qui apparaît sur ta page d&apos;accueil. Le réglage vaut sur
        tous tes appareils ; l&apos;ordre, lui, se règle avec les flèches du
        cockpit.
      </p>

      {preferences === null ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {SECTIONS_COCKPIT.map((section) => (
              <div
                key={section.cle}
                className="flex items-center justify-between gap-4 rounded-inner border border-ink/10 px-4 py-3"
              >
                <div>
                  <Label className="font-body text-sm text-ink">
                    {section.titre}
                  </Label>
                  <p className="font-body text-xs text-ink/40">
                    {section.description}
                  </p>
                </div>
                <Switch
                  checked={preferences[section.cle]}
                  disabled={enCours}
                  aria-label={`Afficher la section ${section.titre}`}
                  onCheckedChange={(valeur) =>
                    basculer(section.cle, Boolean(valeur))
                  }
                />
              </div>
            ))}
          </div>

          {masquees === SECTIONS_COCKPIT.length ? (
            <p className="mt-4 font-body text-sm text-ink/50">
              Toutes les sections sont masquées : ton cockpit est vide. Réactive
              celles que tu veux revoir.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
