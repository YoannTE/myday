"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MeteoVilleFormProps {
  villeActuelle: string;
  onEnregistre: (ville: string) => void;
  onAnnule: () => void;
}

// Petit formulaire inline pour changer la ville du widget météo. Enregistre le
// choix sur le profil (PATCH /api/preferences → mémorisé sur tous les appareils).
export function MeteoVilleForm({
  villeActuelle,
  onEnregistre,
  onAnnule,
}: MeteoVilleFormProps) {
  const [valeur, setValeur] = useState(villeActuelle);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    const ville = valeur.trim();
    if (!ville || enCours) return;
    setEnCours(true);
    try {
      await apiCall("/api/preferences", {
        method: "PATCH",
        body: { meteo_ville: ville },
      });
      onEnregistre(ville);
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Impossible d'enregistrer la ville."),
      );
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={soumettre} className="flex flex-wrap items-center gap-2">
      <Input
        value={valeur}
        onChange={(evenement) => setValeur(evenement.target.value)}
        placeholder="Ta ville (ex : Lyon)"
        className="h-9 max-w-xs flex-1"
        autoFocus
      />
      <Button type="submit" size="sm" disabled={enCours}>
        {enCours ? "..." : "Valider"}
      </Button>
      <button
        type="button"
        onClick={onAnnule}
        className="font-body text-sm text-ink/40 transition-colors hover:text-ink/70"
      >
        Annuler
      </button>
    </form>
  );
}
