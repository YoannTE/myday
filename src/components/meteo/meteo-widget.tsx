"use client";

import { useCallback, useEffect, useState } from "react";
import { Cloud, Pencil } from "lucide-react";
import { apiCall } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  chargerMeteo,
  MeteoIntrouvableError,
  type MeteoResultat,
} from "@/components/meteo/meteo-api";
import { MeteoJourColonne } from "@/components/meteo/meteo-jour";
import { MeteoVilleForm } from "@/components/meteo/meteo-ville-form";

const VILLE_PAR_DEFAUT = "Paris";

// Widget météo du cockpit : lit la ville préférée (profil), affiche les
// prévisions 7 jours (Open-Meteo) et laisse changer la ville. Ville par
// défaut : Paris, tant que l'utilisateur n'en a pas choisi une autre.
export function MeteoWidget() {
  const [ville, setVille] = useState<string | null>(null);
  const [meteo, setMeteo] = useState<MeteoResultat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enEdition, setEnEdition] = useState(false);

  useEffect(() => {
    apiCall<{ data: { meteo_ville: string } }>("/api/preferences")
      .then((reponse) => setVille(reponse.data.meteo_ville || VILLE_PAR_DEFAUT))
      .catch(() => setVille(VILLE_PAR_DEFAUT));
  }, []);

  const chargerPour = useCallback(async (villeCible: string) => {
    setChargement(true);
    setErreur(null);
    try {
      setMeteo(await chargerMeteo(villeCible));
    } catch (souci) {
      setMeteo(null);
      setErreur(
        souci instanceof MeteoIntrouvableError
          ? `Ville « ${villeCible} » introuvable. Essaie une autre orthographe.`
          : "Météo indisponible pour le moment.",
      );
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    if (ville) chargerPour(ville);
  }, [ville, chargerPour]);

  function handleEnregistre(nouvelleVille: string) {
    setEnEdition(false);
    setVille(nouvelleVille);
  }

  return (
    <section className="fade-in delay-1 rounded-card bg-card p-4 shadow-card md:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Cloud className="h-4 w-4 flex-shrink-0 text-accent" />
          <span className="font-mono text-[10px] tracking-[.04em] text-accent uppercase md:text-[11px]">
            Météo
          </span>
          {ville && !enEdition && (
            <span className="truncate font-body text-sm text-ink/60">
              · {meteo?.villeResolue ?? ville}
            </span>
          )}
        </div>
        {!enEdition && (
          <button
            type="button"
            onClick={() => setEnEdition(true)}
            className="flex flex-shrink-0 items-center gap-1 font-body text-sm text-accent transition-colors hover:text-accent/80"
          >
            <Pencil className="h-3.5 w-3.5" />
            Changer
          </button>
        )}
      </div>

      {enEdition && ville && (
        <div className="mb-3">
          <MeteoVilleForm
            villeActuelle={ville}
            onEnregistre={handleEnregistre}
            onAnnule={() => setEnEdition(false)}
          />
        </div>
      )}

      {chargement ? (
        <div className="grid grid-cols-7 gap-1 md:gap-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-inner" />
          ))}
        </div>
      ) : erreur ? (
        <p className="py-4 text-center font-body text-sm text-ink/50">
          {erreur}
        </p>
      ) : meteo ? (
        <div className="grid grid-cols-7 gap-1 md:gap-3">
          {meteo.jours.map((jour, index) => (
            <MeteoJourColonne
              key={jour.date}
              jour={jour}
              estAujourdHui={index === 0}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
