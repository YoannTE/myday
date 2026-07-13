"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Button } from "@/components/ui/button";
import type { Contact } from "@/components/partage/types";

interface PartageDemandeRowProps {
  contact: Contact;
  onChanged: () => void;
}

/**
 * Ligne d'une demande de contact en attente (carte Partage, réglages) -
 * variante selon `contact.direction` : demande reçue (boutons
 * Accepter/Refuser) ou demande envoyée (mention « En attente » + Annuler).
 */
export function PartageDemandeRow({
  contact,
  onChanged,
}: PartageDemandeRowProps) {
  const [enCours, setEnCours] = useState(false);
  const estRecue = contact.direction === "recue";

  async function accepter() {
    setEnCours(true);
    try {
      await apiCall(`/api/contacts/${contact.id}/accepter`, {
        method: "POST",
      });
      toast.success(`Contact avec ${contact.autre_utilisateur.nom} accepté.`);
      onChanged();
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Impossible d'accepter la demande."),
      );
      setEnCours(false);
    }
  }

  async function supprimer() {
    setEnCours(true);
    try {
      await apiCall(`/api/contacts/${contact.id}`, { method: "DELETE" });
      toast.success(estRecue ? "Demande refusée." : "Demande annulée.");
      onChanged();
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Impossible de mettre à jour la demande."),
      );
      setEnCours(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-inner bg-soft px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-sm text-ink">
          {contact.autre_utilisateur.nom}
        </p>
        <p className="truncate font-body text-xs text-ink/50">
          {contact.autre_utilisateur.email}
        </p>
      </div>
      {estRecue ? (
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <Button
            type="button"
            size="xs"
            disabled={enCours}
            onClick={accepter}
          >
            Accepter
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={enCours}
            onClick={supprimer}
          >
            Refuser
          </Button>
        </div>
      ) : (
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
            En attente
          </span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={enCours}
            onClick={supprimer}
          >
            Annuler
          </Button>
        </div>
      )}
    </div>
  );
}
