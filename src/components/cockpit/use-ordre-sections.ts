"use client";

import { useCallback, useEffect, useState } from "react";

export type CleSection = "meteo" | "planning" | "taches" | "notes" | "budget";

const CLE_STOCKAGE = "myday:cockpit-ordre";
// « budget » est placé en dernier : `normaliser` ajoute les sections absentes
// d'un ordre déjà stocké à la fin, donc les utilisateurs qui avaient rangé
// leurs sections retrouvent leur agencement, avec le budget ajouté en bas.
const ORDRE_PAR_DEFAUT: CleSection[] = [
  "meteo",
  "planning",
  "taches",
  "notes",
  "budget",
];

function estCleSection(valeur: unknown): valeur is CleSection {
  return (
    typeof valeur === "string" &&
    (ORDRE_PAR_DEFAUT as string[]).includes(valeur)
  );
}

/**
 * Complète un ordre stocké partiel ou invalide avec les sections manquantes
 * (dans l'ordre par défaut) - robuste à une valeur corrompue, incomplète,
 * ou à l'ajout futur d'une nouvelle section.
 */
function normaliser(valeur: unknown): CleSection[] {
  const connues = Array.isArray(valeur) ? valeur.filter(estCleSection) : [];
  const sansDoublon = [...new Set(connues)];
  const manquantes = ORDRE_PAR_DEFAUT.filter((cle) => !sansDoublon.includes(cle));
  return [...sansDoublon, ...manquantes];
}

/**
 * Ordre des sections réordonnables du cockpit unique (Météo/Planning/Tâches/
 * Notes/Budget), persisté en localStorage (clé `myday:cockpit-ordre`).
 */
export function useOrdreSections() {
  const [ordre, setOrdre] = useState<CleSection[]>(ORDRE_PAR_DEFAUT);

  useEffect(() => {
    try {
      const brut = localStorage.getItem(CLE_STOCKAGE);
      if (brut) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOrdre(normaliser(JSON.parse(brut)));
      }
    } catch {
      // Stockage indisponible ou valeur corrompue : on garde l'ordre par défaut.
    }
  }, []);

  const deplacer = useCallback((cle: CleSection, direction: "haut" | "bas") => {
    setOrdre((actuel) => {
      const index = actuel.indexOf(cle);
      const cible = direction === "haut" ? index - 1 : index + 1;
      if (index === -1 || cible < 0 || cible >= actuel.length) return actuel;
      const nouveau = [...actuel];
      [nouveau[index], nouveau[cible]] = [nouveau[cible], nouveau[index]];
      try {
        localStorage.setItem(CLE_STOCKAGE, JSON.stringify(nouveau));
      } catch {
        // Stockage indisponible (navigation privée) : l'ordre reste en mémoire.
      }
      return nouveau;
    });
  }, []);

  return { ordre, deplacer };
}
