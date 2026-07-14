"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Settings2, Share2, Trash2 } from "lucide-react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { PartageDialog } from "@/components/partage/partage-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  taskDetailsSchema,
  type TaskDetailsValues,
} from "@/components/taches/task-details-schema";
import { TaskDetailsFields } from "@/components/taches/task-details-fields";
import { TaskPlanningSection } from "@/components/taches/task-planning-section";
import { SANS_CATEGORIE } from "@/components/taches/category-select";
import {
  versDateLocale,
  dateLocaleVersIso,
  versDatetimeLocale,
  datetimeLocaleVersIso,
} from "@/components/taches/task-date-utils";
import type { Task, TaskCategory } from "@/components/taches/types";

interface TaskDetailsDialogProps {
  task: Task;
  onUpdated: (task: Task) => void;
  onCategoriesChanged?: () => void;
  onDeleted?: (taskId: string) => void;
}

function valeursParDefaut(task: Task): TaskDetailsValues {
  return {
    echeance: task.echeance ? versDateLocale(task.echeance) : "",
    categorie_id: task.categorie?.id ?? SANS_CATEGORIE,
    recurrence: task.recurrence,
    rappel_at: task.rappel_at ? versDatetimeLocale(task.rappel_at) : "",
  };
}

/**
 * Dialog d'édition de l'échéance et de la catégorie d'une tâche (Round 012,
 * F1/F2), ouvert depuis l'icône réglages de `TaskItem` (cockpit ET page
 * `/taches`). Les catégories sont chargées à l'ouverture (pas de prop
 * drilling depuis les pages parentes) pour rester utilisable dans les deux
 * contextes sans wiring supplémentaire.
 */
export function TaskDetailsDialog({
  task,
  onUpdated,
  onCategoriesChanged,
  onDeleted,
}: TaskDetailsDialogProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<TaskCategory[] | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [partageOuvert, setPartageOuvert] = useState(false);
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const [suppression, setSuppression] = useState(false);

  async function supprimer() {
    setSuppression(true);
    try {
      await apiCall(`/api/tasks/${task.id}`, { method: "DELETE" });
      toast.success("Tâche supprimée.");
      setOpen(false);
      onDeleted?.(task.id);
    } catch (erreur) {
      toast.error(messageErreurApi(erreur, "Impossible de supprimer la tâche."));
    } finally {
      setSuppression(false);
    }
  }

  const { control, register, handleSubmit, reset, setValue } =
    useForm<TaskDetailsValues>({
      resolver: zodResolver(taskDetailsSchema),
      defaultValues: valeursParDefaut(task),
    });

  useEffect(() => {
    if (!open) return;
    reset(valeursParDefaut(task));
    let annule = false;
    apiCall<{ data: TaskCategory[] }>("/api/task-categories")
      .then((reponse) => {
        if (!annule) setCategories(reponse.data);
      })
      .catch(() => {
        if (!annule) setCategories([]);
      });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(valeurs: TaskDetailsValues) {
    setEnregistrement(true);
    try {
      const reponse = await apiCall<{ data: Task }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: {
          echeance: valeurs.echeance
            ? dateLocaleVersIso(valeurs.echeance)
            : null,
          categorie_id:
            valeurs.categorie_id === SANS_CATEGORIE
              ? null
              : valeurs.categorie_id,
          recurrence: valeurs.recurrence,
          rappel_at: valeurs.rappel_at
            ? datetimeLocaleVersIso(valeurs.rappel_at)
            : null,
        },
      });
      toast.success("Tâche mise à jour.");
      onUpdated(reponse.data);
      setOpen(false);
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Impossible de mettre à jour la tâche."),
      );
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="Modifier l'échéance et la catégorie"
            className="flex-shrink-0 rounded-full p-1.5 text-ink/40 hover:bg-soft hover:text-ink"
          />
        }
      >
        <Settings2 className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>Modifier « {task.titre} »</DialogTitle>
            {task.partage_par == null && (
              <button
                type="button"
                onClick={() => setPartageOuvert(true)}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-2 py-1 font-body text-xs text-ink/50 transition-colors hover:bg-soft hover:text-ink"
              >
                <Share2 className="h-3.5 w-3.5" />
                Partager
              </button>
            )}
          </div>
          <DialogDescription>
            Ajoute une échéance et une catégorie pour mieux organiser cette
            tâche.
          </DialogDescription>
        </DialogHeader>
        <PartageDialog
          open={partageOuvert}
          onOpenChange={setPartageOuvert}
          elementType="task"
          elementId={task.id}
          titre={task.titre}
        />
        <form
          id="form-details-tache"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <TaskDetailsFields
            register={register}
            control={control}
            setValue={setValue}
            categories={categories}
            onCategoryCreated={(categorie) => {
              setCategories((actuelles) => [...(actuelles ?? []), categorie]);
              onCategoriesChanged?.();
            }}
          />
        </form>
        <TaskPlanningSection task={task} open={open} onUpdated={onUpdated} />
        <DialogFooter className="items-center sm:justify-between">
          {confirmationSuppression ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink/50">Confirmer ?</span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={suppression}
                onClick={supprimer}
              >
                {suppression ? "Suppression..." : "Oui, supprimer"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmationSuppression(false)}
              >
                Annuler
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              aria-label="Supprimer la tâche"
              onClick={() => setConfirmationSuppression(true)}
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </Button>
          )}
          <Button
            type="submit"
            form="form-details-tache"
            disabled={enregistrement}
          >
            {enregistrement ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
