"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TaskCategory } from "@/components/taches/types";

interface TaskCategoryRowProps {
  categorie: TaskCategory;
  onChanged: () => void;
  /** Remplace la liste complète après un déplacement (`POST /api/task-categories/{id}/deplacer`). */
  onReordonnee?: (categories: TaskCategory[]) => void;
  /** Fausse quand la catégorie est déjà première de la liste. */
  peutMonter?: boolean;
  /** Fausse quand la catégorie est déjà dernière de la liste. */
  peutDescendre?: boolean;
}

/**
 * Ligne d'une catégorie dans le dialog de gestion (Round 012, F2) : renommer
 * (clic sur le nom) et supprimer (avec confirmation inline). La suppression
 * ne touche jamais les tâches associées (`categorie_id` repasse à NULL côté
 * backend, `ON DELETE SET NULL`). Round 017 : flèches de réordonnancement
 * manuel, même pattern que les tâches (`TaskItem`).
 */
export function TaskCategoryRow({
  categorie,
  onChanged,
  onReordonnee,
  peutMonter,
  peutDescendre,
}: TaskCategoryRowProps) {
  const [enEdition, setEnEdition] = useState(false);
  const [nom, setNom] = useState(categorie.nom);
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [enCoursDeplacement, setEnCoursDeplacement] = useState(false);
  const afficherFleches = Boolean(onReordonnee);

  async function deplacer(direction: "haut" | "bas") {
    if (enCoursDeplacement || !onReordonnee) return;
    setEnCoursDeplacement(true);
    try {
      const reponse = await apiCall<{ data: TaskCategory[] }>(
        `/api/task-categories/${categorie.id}/deplacer`,
        { method: "POST", body: { direction } },
      );
      onReordonnee(reponse.data);
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Impossible de déplacer la catégorie."),
      );
    } finally {
      setEnCoursDeplacement(false);
    }
  }

  async function renommer() {
    setEnEdition(false);
    const nomNettoye = nom.trim();
    if (!nomNettoye || nomNettoye === categorie.nom) {
      setNom(categorie.nom);
      return;
    }
    try {
      await apiCall(`/api/task-categories/${categorie.id}`, {
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
      await apiCall(`/api/task-categories/${categorie.id}`, {
        method: "DELETE",
      });
      toast.success("Catégorie supprimée. Les tâches associées sont conservées.");
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
      {afficherFleches && (
        <div className="flex flex-shrink-0 flex-col">
          <button
            type="button"
            aria-label="Monter la catégorie"
            disabled={enCoursDeplacement || !peutMonter}
            onClick={() => deplacer("haut")}
            className="flex h-4 w-4 items-center justify-center text-ink/30 transition-colors hover:text-accent disabled:opacity-30"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Descendre la catégorie"
            disabled={enCoursDeplacement || !peutDescendre}
            onClick={() => deplacer("bas")}
            className="flex h-4 w-4 items-center justify-center text-ink/30 transition-colors hover:text-accent disabled:opacity-30"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
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
