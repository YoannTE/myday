"use client";

import { Suspense } from "react";
import { useGoogleStatus } from "@/components/reglages/google/use-google-status";
import { GoogleCardToasts } from "@/components/reglages/google/google-card-toasts";
import { GoogleCardChargement } from "@/components/reglages/google/google-card-chargement";
import { GoogleCardErreur } from "@/components/reglages/google/google-card-erreur";
import { GoogleCardDeconnecte } from "@/components/reglages/google/google-card-deconnecte";
import { GoogleCardReauth } from "@/components/reglages/google/google-card-reauth";
import { GoogleCardConnecte } from "@/components/reglages/google/google-card-connecte";

/**
 * Carte Google de /reglages (onglet Mon compte) - orchestrateur des états
 * chargement / erreur réseau / non connecté / reconnexion nécessaire /
 * connecté, alimenté par `GET /api/google/status`. Transposition fidèle de
 * la variante « État détaillé » de reglages.html.
 */
export function GoogleCard() {
  const { donnees, erreur, recharger } = useGoogleStatus();

  return (
    <>
      <Suspense fallback={null}>
        <GoogleCardToasts />
      </Suspense>
      {erreur ? (
        <GoogleCardErreur message={erreur} onReessayer={recharger} />
      ) : !donnees ? (
        <GoogleCardChargement />
      ) : !donnees.connected ? (
        <GoogleCardDeconnecte />
      ) : donnees.reauth_required ? (
        <GoogleCardReauth />
      ) : (
        <GoogleCardConnecte statut={donnees} onChange={recharger} />
      )}
    </>
  );
}
