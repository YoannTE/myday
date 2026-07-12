"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NoteCategory } from "@/components/notes/types";

interface NoteCategoryRowProps {
  categorie: NoteCategory;
  onChanged: () => void;
}

/**
 * Ligne d'une catégorie dans le dialog de gestion (Round 015) - miroir de
 * `TaskCategoryRow` (tâches, Round 012) : renommer (clic sur le nom) et
 * supprimer (avec confirmation inline). La suppression ne touche jamais les
 * notes associées (`categorie_id` repasse à NULL côté backend, `ON DELETE
 * SET NULL`).
 */
export function NoteCategoryRow({ categorie, onChanged }: NoteCategoryRowProps) {
  const [enEdition, setEnEdition] = useState(false);
  const [nom, setNom] = useState(categorie.nom);
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const [enCours, setEnCours] = useState(false);

  async function renommer() {
    setEnEdition(false);
    const nomNettoye = nom.trim();
    if (!nomNettoye || nomNettoye === categorie.nom) {
      setNom(categorie.nom);
      return;
    }
    try {
      await apiCall(`/api/note-categories/${categorie.id}`, {
        method: "PATCH",
        body: { nom: nomNettoye },
      });
      toast.success("Catégorie renommée.");
      onChanged();
    } catch (erreur) {
      setNom(categorie.nom);
      toast.error(
        messageErreurApi(erreur, "Impossible de renommer la catégorie."),
      );
    }
  }

  async function supprimer() {
    setEnCours(true);
    try {
      await apiCall(`/api/note-categories/${categorie.id}`, {
        method: "DELETE",
      });
      toast.success("Catégorie supprimée. Les notes associées sont conservées.");
      onChanged();
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Impossible de supprimer la catégorie."),
      );
      setEnCours(false);
      setConfirmationSuppression(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-inner bg-soft px-3 py-2">
      <span
        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: categorie.couleur }}
        aria-hidden="true"
      />
      {enEdition ? (
        <Input
          autoFocus
          value={nom}
          onChange={(evenement) => setNom(evenement.target.value)}
          onBlur={renommer}
          onKeyDown={(evenement) => {
            if (evenement.key === "Enter") {
              evenement.preventDefault();
              renommer();
            }
            if (evenement.key === "Escape") {
              setNom(categorie.nom);
              setEnEdition(false);
            }
          }}
          className="h-auto flex-1 border-none bg-transparent p-0 font-body text-sm text-ink focus-visible:ring-0"
        />
      ) : (
        <span
          onClick={() => setEnEdition(true)}
          className="flex-1 cursor-text font-body text-sm text-ink"
        >
          {categorie.nom}
        </span>
      )}
      {confirmationSuppression ? (
        <div className="flex flex-shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="destructive"
            size="xs"
            disabled={enCours}
            onClick={supprimer}
          >
            Confirmer
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setConfirmationSuppression(false)}
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
          onClick={() => setConfirmationSuppression(true)}
        >
          Supprimer
        </Button>
      )}
    </div>
  );
}
