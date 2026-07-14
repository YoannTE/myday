"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { EventFormDialog } from "@/components/planning/event-form-dialog";
import type { EvenementApi } from "@/components/planning/types";

/**
 * Ouvre directement un événement quand la page est atteinte via
 * `/planning?event=<id>` (clic sur une notification de rappel ou de partage).
 * L'événement est récupéré par son id (GET /api/events/{id}), même s'il n'est
 * pas dans la fenêtre affichée du planning, puis ouvert dans le dialog
 * d'édition — ce qui montre notamment sa date et son heure.
 */
export function EventDeepLink({ onSuccess }: { onSuccess: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventId = searchParams.get("event");
  const [evenement, setEvenement] = useState<EvenementApi | null>(null);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    let annule = false;
    apiCall<{ data: EvenementApi }>(`/api/events/${eventId}`)
      .then((reponse) => {
        if (annule) return;
        setEvenement(reponse.data);
        setOuvert(true);
      })
      .catch((erreur) => {
        if (annule) return;
        toast.error(
          messageErreurApi(erreur, "Cet événement est introuvable."),
        );
        router.replace("/planning");
      });
    return () => {
      annule = true;
    };
  }, [eventId, router]);

  function surChangementOuverture(nouvelEtat: boolean) {
    setOuvert(nouvelEtat);
    if (!nouvelEtat) {
      // Retire le paramètre pour éviter la réouverture au rechargement.
      router.replace("/planning");
    }
  }

  if (!evenement) return null;

  return (
    <EventFormDialog
      evenement={evenement}
      open={ouvert}
      onOpenChange={surChangementOuverture}
      onSuccess={() => {
        onSuccess();
        surChangementOuverture(false);
      }}
    />
  );
}
