"use client";

import { useEffect, useState } from "react";
import { apiCall } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Contact } from "@/components/partage/types";

interface PartageContactsPickerProps {
  selection: string[];
  onSelectionChange: (selection: string[]) => void;
}

/**
 * Sélecteur compact « Partager avec » intégré aux formulaires de création
 * (événement, tâche, note) - charge les contacts acceptés et expose la
 * sélection en props contrôlées. Ne s'affiche que s'il existe au moins un
 * contact accepté (sinon aucun rendu, pas de message).
 */
export function PartageContactsPicker({
  selection,
  onSelectionChange,
}: PartageContactsPickerProps) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);

  useEffect(() => {
    let annule = false;
    apiCall<{ data: Contact[] }>("/api/contacts")
      .then((reponse) => {
        if (annule) return;
        setContacts(
          reponse.data.filter((contact) => contact.statut === "accepte"),
        );
      })
      .catch(() => {
        if (annule) return;
        setContacts([]);
      });
    return () => {
      annule = true;
    };
  }, []);

  function basculer(contactId: string) {
    if (selection.includes(contactId)) {
      onSelectionChange(selection.filter((id) => id !== contactId));
    } else {
      onSelectionChange([...selection, contactId]);
    }
  }

  if (!contacts || contacts.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <Label>Partager avec</Label>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {contacts.map((contact) => (
          <label
            key={contact.id}
            className="flex cursor-pointer items-center gap-1.5"
          >
            <Checkbox
              checked={selection.includes(contact.id)}
              onCheckedChange={() => basculer(contact.id)}
            />
            <span className="font-body text-xs text-ink/70">
              {contact.autre_utilisateur.nom}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
