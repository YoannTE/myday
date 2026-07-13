"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PartageDialogContactRow } from "@/components/partage/partage-dialog-contact-row";
import type { Contact, ElementType, Partage } from "@/components/partage/types";

interface PartageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  elementType: ElementType;
  elementId: string;
  titre: string;
}

/**
 * Dialog de partage d'un élément précis (événement, tâche ou note) avec un
 * ou plusieurs contacts acceptés. Chaque case à cocher pilote un
 * POST/DELETE `/api/partages` indépendant. Les partages existants sont
 * appariés aux contacts par email (`Partage.cible` ne porte pas de
 * `contact_id`, seulement l'identité de la cible).
 */
export function PartageDialog({
  open,
  onOpenChange,
  elementType,
  elementId,
  titre,
}: PartageDialogProps) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [partages, setPartages] = useState<Partage[] | null>(null);
  const [enCoursId, setEnCoursId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let annule = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContacts(null);
    setPartages(null);
    Promise.all([
      apiCall<{ data: Contact[] }>("/api/contacts"),
      apiCall<{ data: Partage[] }>(
        `/api/partages?element_type=${elementType}&element_id=${elementId}`,
      ),
    ])
      .then(([contactsReponse, partagesReponse]) => {
        if (annule) return;
        setContacts(
          contactsReponse.data.filter(
            (contact) => contact.statut === "accepte",
          ),
        );
        setPartages(partagesReponse.data);
      })
      .catch((erreur) => {
        if (annule) return;
        toast.error(
          messageErreurApi(erreur, "Impossible de charger le partage."),
        );
        setContacts([]);
        setPartages([]);
      });
    return () => {
      annule = true;
    };
  }, [open, elementType, elementId]);

  async function basculer(contact: Contact, partageExistant?: Partage) {
    setEnCoursId(contact.id);
    try {
      if (partageExistant) {
        await apiCall(`/api/partages/${partageExistant.id}`, {
          method: "DELETE",
        });
        setPartages(
          (actuels) =>
            actuels?.filter((partage) => partage.id !== partageExistant.id) ??
            [],
        );
        toast.success(`Partage retiré pour ${contact.autre_utilisateur.nom}.`);
      } else {
        const reponse = await apiCall<{ data: Partage }>("/api/partages", {
          method: "POST",
          body: {
            element_type: elementType,
            element_id: elementId,
            contact_id: contact.id,
          },
        });
        setPartages((actuels) => [...(actuels ?? []), reponse.data]);
        toast.success(`Partagé avec ${contact.autre_utilisateur.nom}.`);
      }
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Impossible de mettre à jour le partage."),
      );
    } finally {
      setEnCoursId(null);
    }
  }

  const chargement = contacts === null || partages === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Partager « {titre} »</DialogTitle>
          <DialogDescription>
            Les personnes cochées voient cet élément en lecture seule,
            mélangé à leurs propres éléments.
          </DialogDescription>
        </DialogHeader>
        {chargement ? (
          <p className="py-4 text-center font-body text-sm text-ink/50">
            Chargement...
          </p>
        ) : contacts.length === 0 ? (
          <p className="py-4 text-center font-body text-sm text-ink/50">
            Aucun contact pour l&apos;instant — ajoute un proche dans{" "}
            <Link
              href="/reglages"
              className="text-accent underline"
              onClick={() => onOpenChange(false)}
            >
              Réglages → Partage
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {contacts.map((contact) => {
              const partageExistant = partages.find(
                (partage) =>
                  partage.cible.email === contact.autre_utilisateur.email,
              );
              return (
                <PartageDialogContactRow
                  key={contact.id}
                  contact={contact}
                  coche={!!partageExistant}
                  enCours={enCoursId === contact.id}
                  onToggle={() => basculer(contact, partageExistant)}
                />
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
