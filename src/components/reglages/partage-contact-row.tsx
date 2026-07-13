"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Button } from "@/components/ui/button";
import type { Contact } from "@/components/partage/types";

interface PartageContactRowProps {
  contact: Contact;
  onChanged: () => void;
}

/**
 * Ligne d'un contact accepté (carte Partage, réglages) - retrait avec
 * confirmation inline (miroir de `NoteCategoryRow`). Retirer un contact
 * supprime aussi tous les partages entre les deux comptes (effet de bord
 * appliqué côté backend).
 */
export function PartageContactRow({
  contact,
  onChanged,
}: PartageContactRowProps) {
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, setEnCours] = useState(false);

  async function retirer() {
    setEnCours(true);
    try {
      await apiCall(`/api/contacts/${contact.id}`, { method: "DELETE" });
      toast.success(`Lien retiré avec ${contact.autre_utilisateur.nom}.`);
      onChanged();
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Impossible de retirer ce contact."),
      );
      setEnCours(false);
      setConfirmation(false);
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
      {confirmation ? (
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5">
          <span className="font-body text-xs text-ink/50">
            Retire aussi les partages ?
          </span>
          <Button
            type="button"
            variant="destructive"
            size="xs"
            disabled={enCours}
            onClick={retirer}
          >
            Confirmer
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setConfirmation(false)}
          >
            Annuler
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="flex-shrink-0 text-destructive"
          onClick={() => setConfirmation(true)}
        >
          Retirer
        </Button>
      )}
    </div>
  );
}
