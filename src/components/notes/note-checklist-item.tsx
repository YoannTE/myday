"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { NoteItemApi } from "@/components/notes/types";

interface NoteChecklistItemProps {
  item: NoteItemApi;
  onUpdated: (item: NoteItemApi) => void;
  onDeleted: () => void;
}

// Ligne d'un élément de liste à cocher : cochage optimiste (rollback + toast
// si le PATCH échoue, miroir de `TaskItem`), édition inline du texte (clic
// sur le texte -> input -> Entrée/perte de focus) et suppression.
export function NoteChecklistItem({
  item,
  onUpdated,
  onDeleted,
}: NoteChecklistItemProps) {
  const [enEdition, setEnEdition] = useState(false);
  const [contenuEdition, setContenuEdition] = useState(item.contenu);
  const [enCours, setEnCours] = useState(false);

  async function basculerCoche() {
    if (enCours) return;
    setEnCours(true);
    const precedent = item;
    onUpdated({ ...item, coche: !item.coche });
    try {
      const reponse = await apiCall<{ data: NoteItemApi }>(
        `/api/note-items/${item.id}`,
        { method: "PATCH", body: { coche: !item.coche } },
      );
      onUpdated(reponse.data);
    } catch (erreur) {
      onUpdated(precedent);
      toast.error(
        messageErreurApi(erreur, "Impossible de mettre à jour l'élément."),
      );
    } finally {
      setEnCours(false);
    }
  }

  async function validerContenu() {
    const nettoye = contenuEdition.trim();
    setEnEdition(false);
    if (!nettoye || nettoye === item.contenu) {
      setContenuEdition(item.contenu);
      return;
    }
    const precedent = item;
    onUpdated({ ...item, contenu: nettoye });
    try {
      const reponse = await apiCall<{ data: NoteItemApi }>(
        `/api/note-items/${item.id}`,
        { method: "PATCH", body: { contenu: nettoye } },
      );
      onUpdated(reponse.data);
    } catch (erreur) {
      onUpdated(precedent);
      setContenuEdition(precedent.contenu);
      toast.error(
        messageErreurApi(erreur, "Impossible de renommer l'élément."),
      );
    }
  }

  async function supprimer() {
    if (enCours) return;
    setEnCours(true);
    try {
      await apiCall(`/api/note-items/${item.id}`, { method: "DELETE" });
      onDeleted();
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Impossible de supprimer l'élément."),
      );
      setEnCours(false);
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2.5 py-0.5">
      <Checkbox
        checked={item.coche}
        disabled={enCours}
        onCheckedChange={basculerCoche}
        aria-label={item.coche ? "Décocher l'élément" : "Cocher l'élément"}
        className="h-4 w-4 flex-shrink-0 rounded-[4px] border-2 border-accent/40 data-checked:border-accent data-checked:bg-accent"
      />
      {enEdition ? (
        <Input
          autoFocus
          value={contenuEdition}
          onChange={(evenement) => setContenuEdition(evenement.target.value)}
          onBlur={validerContenu}
          onKeyDown={(evenement) => {
            if (evenement.key === "Enter") {
              evenement.preventDefault();
              validerContenu();
            }
            if (evenement.key === "Escape") {
              setContenuEdition(item.contenu);
              setEnEdition(false);
            }
          }}
          className="h-auto min-w-0 flex-1 border-none bg-transparent p-0 font-body text-sm text-ink focus-visible:ring-0"
        />
      ) : (
        <span
          onClick={() => !item.coche && setEnEdition(true)}
          className={cn(
            "min-w-0 flex-1 font-body text-sm break-words text-ink/80",
            item.coche && "text-ink/40 line-through",
            !item.coche && "cursor-text",
          )}
        >
          {item.contenu}
        </span>
      )}
      <button
        type="button"
        onClick={supprimer}
        disabled={enCours}
        aria-label="Supprimer l'élément"
        className="flex-shrink-0 text-ink/25 transition-colors hover:text-destructive disabled:opacity-40"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
