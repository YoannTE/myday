"use client";

import { useCallback, useEffect, useState } from "react";
import { apiCall } from "@/lib/api";
import { messageErreurGoogle } from "@/components/reglages/google/google-errors";
import type { GoogleStatus } from "@/components/reglages/google/types";

/**
 * Charge l'état de la connexion Google (carte réglages) - même convention
 * que AdminSection (`donnees` null tant que non chargé) avec une erreur
 * distincte pour afficher un état réseau propre si FastAPI ne répond pas.
 */
export function useGoogleStatus() {
  const [donnees, setDonnees] = useState<GoogleStatus | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    try {
      const reponse = await apiCall<{ data: GoogleStatus }>(
        "/api/google/status",
      );
      setDonnees(reponse.data);
      setErreur(null);
    } catch (erreurChargement) {
      setErreur(
        messageErreurGoogle(
          erreurChargement,
          "Impossible de récupérer l'état de la connexion Google.",
        ),
      );
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recharger();
  }, [recharger]);

  return { donnees, erreur, recharger };
}
