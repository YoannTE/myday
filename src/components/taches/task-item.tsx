"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bell, Repeat } from "lucide-react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CategoryBadge } from "@/components/taches/category-badge";
import { TaskDetailsDialog } from "@/components/taches/task-details-dialog";
import { PartageBadge } from "@/components/partage/partage-badge";
import type { Task } from "@/components/taches/types";

/** Formate l'échéance en label court ("Aujourd'hui", "Vendredi"...). */
function formaterEcheance(echeance: string): string {
  const date = new Date(echeance);
  const aujourdHui = new Date();
  if (date.toDateString() === aujourdHui.toDateString()) return "Aujourd'hui";
  const brut = new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(
    date,
  );
  return brut.charAt(0).toUpperCase() + brut.slice(1);
}

/** Date complète pour le toast de reprogrammation ("vendredi 18 juillet"). */
function formaterDateComplete(echeance: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(echeance));
}

interface TaskItemProps {
  task: Task;
  onUpdated: (task: Task) => void;
  onCategoriesChanged?: () => void;
}

/**
 * Ligne de tâche réutilisée par le cockpit (checklist) et la page `/taches` :
 * case à cocher optimiste (rollback + toast si le PATCH échoue) et édition
 * inline du titre (clic sur le texte -> input -> Entrée/perte de focus).
 * Case et titre restent actifs pour une tâche partagée reçue ; seul le
 * réglage détaillé (⚙️ `TaskDetailsDialog` : échéance, catégorie, rappel,
 * planification) reste réservé au propriétaire.
 */
export function TaskItem({ task, onUpdated, onCategoriesChanged }: TaskItemProps) {
  const [enEdition, setEnEdition] = useState(false);
  const [titreEdition, setTitreEdition] = useState(task.titre);
  const [enCours, setEnCours] = useState(false);
  const estFaite = task.statut === "faite";
  const estPartagee = task.partage_par != null;

  async function basculerStatut() {
    if (enCours) return;
    setEnCours(true);
    const precedent = task;
    const nouveauStatut = estFaite ? "a_faire" : "faite";
    onUpdated({ ...task, statut: nouveauStatut });
    try {
      const reponse = await apiCall<{ data: Task }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: { statut: nouveauStatut },
      });
      onUpdated(reponse.data);
      // Tâche récurrente cochée : le backend la reprogramme (elle revient
      // « à faire » avec une nouvelle échéance) plutôt que de la terminer.
      if (
        nouveauStatut === "faite" &&
        reponse.data.statut === "a_faire" &&
        reponse.data.recurrence !== "aucune" &&
        reponse.data.echeance
      ) {
        toast.success(
          `Reprogrammée au ${formaterDateComplete(reponse.data.echeance)}.`,
        );
      }
    } catch (erreur) {
      onUpdated(precedent);
      toast.error(
        messageErreurApi(erreur, "Impossible de mettre à jour la tâche."),
      );
    } finally {
      setEnCours(false);
    }
  }

  async function validerTitre() {
    const nettoye = titreEdition.trim();
    setEnEdition(false);
    if (!nettoye || nettoye === task.titre) {
      setTitreEdition(task.titre);
      return;
    }
    const precedent = task;
    onUpdated({ ...task, titre: nettoye });
    try {
      const reponse = await apiCall<{ data: Task }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: { titre: nettoye },
      });
      onUpdated(reponse.data);
    } catch (erreur) {
      onUpdated(precedent);
      setTitreEdition(precedent.titre);
      toast.error(
        messageErreurApi(erreur, "Impossible de renommer la tâche."),
      );
    }
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <Checkbox
        checked={estFaite}
        disabled={enCours}
        onCheckedChange={basculerStatut}
        aria-label={estFaite ? "Marquer à faire" : "Marquer comme faite"}
        className={cn(
          "h-5 w-5 rounded-md border-2 border-accent/40 data-checked:border-accent data-checked:bg-accent",
        )}
      />
      {enEdition ? (
        <Input
          autoFocus
          value={titreEdition}
          onChange={(e) => setTitreEdition(e.target.value)}
          onBlur={validerTitre}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              validerTitre();
            }
            if (e.key === "Escape") {
              setTitreEdition(task.titre);
              setEnEdition(false);
            }
          }}
          className="h-auto min-w-0 flex-1 border-none bg-transparent p-0 font-body text-sm text-ink focus-visible:ring-0"
        />
      ) : (
        <span
          onClick={() => !estFaite && setEnEdition(true)}
          className={cn(
            "min-w-0 flex-1 font-body text-sm break-words text-ink",
            estFaite && "text-ink/50 line-through",
            !estFaite && "cursor-text",
          )}
        >
          {task.titre}
        </span>
      )}
      {!estFaite && task.recurrence !== "aucune" && (
        <Repeat
          className="h-3.5 w-3.5 flex-shrink-0 text-ink/40"
          aria-label="Tâche qui se répète"
        />
      )}
      {!estFaite && task.rappel_at && (
        <Bell
          className="h-3.5 w-3.5 flex-shrink-0 text-accent/70"
          aria-label="Rappel programmé"
        />
      )}
      {!estFaite && task.categorie && (
        <CategoryBadge categorie={task.categorie} />
      )}
      {estPartagee && (
        <PartageBadge nom={task.partage_par as string} />
      )}
      {!estFaite && task.priorite === "haute" && (
        <span className="flex-shrink-0 rounded-full bg-soft px-2.5 py-1 font-mono text-[10px] tracking-[.04em] text-accent uppercase">
          Priorité
        </span>
      )}
      {!estFaite && task.priorite !== "haute" && task.echeance && (
        <span className="flex-shrink-0 font-mono text-[11px] tracking-[.04em] text-ink/40 uppercase">
          {formaterEcheance(task.echeance)}
        </span>
      )}
      {!estPartagee && (
        <TaskDetailsDialog
          task={task}
          onUpdated={onUpdated}
          onCategoriesChanged={onCategoriesChanged}
        />
      )}
    </div>
  );
}
