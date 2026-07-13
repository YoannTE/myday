"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  versDatetimeLocale,
  datetimeLocaleVersIso,
} from "@/components/taches/task-date-utils";
import { RappelAvanceSelect } from "@/components/planning/rappel-avance-select";
import type { Task } from "@/components/taches/types";

interface TaskPlanningSectionProps {
  task: Task;
  open: boolean;
  onUpdated: (task: Task) => void;
}

/**
 * Section « Planifier dans le planning » de la fiche tâche : indépendante du
 * formulaire principal (échéance/rappel/catégorie), elle appelle directement
 * `POST`/`DELETE /api/tasks/{id}/planifier` sans passer par le PATCH générique
 * de `TaskDetailsDialog`.
 */
export function TaskPlanningSection({
  task,
  open,
  onUpdated,
}: TaskPlanningSectionProps) {
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [rappelAvance, setRappelAvance] = useState(30);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDebut(task.planifie_debut ? versDatetimeLocale(task.planifie_debut) : "");
    setFin(task.planifie_fin ? versDatetimeLocale(task.planifie_fin) : "");
    setRappelAvance(task.rappel_avance_minutes ?? 30);
  }, [open, task.planifie_debut, task.planifie_fin, task.rappel_avance_minutes]);

  const dejaPlanifiee = Boolean(task.planifie_debut && task.planifie_fin);

  async function planifier() {
    if (!debut || !fin) {
      toast.error("Choisis un début et une fin pour le créneau.");
      return;
    }
    setEnCours(true);
    try {
      const reponse = await apiCall<{ data: Task }>(
        `/api/tasks/${task.id}/planifier`,
        {
          method: "POST",
          body: {
            debut: datetimeLocaleVersIso(debut),
            fin: datetimeLocaleVersIso(fin),
            rappel_avance_minutes: rappelAvance,
          },
        },
      );
      toast.success("Créneau ajouté au planning.");
      onUpdated(reponse.data);
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Impossible de planifier cette tâche."),
      );
    } finally {
      setEnCours(false);
    }
  }

  async function retirer() {
    setEnCours(true);
    try {
      const reponse = await apiCall<{ data: Task }>(
        `/api/tasks/${task.id}/planifier`,
        { method: "DELETE" },
      );
      toast.success("Retirée du planning.");
      onUpdated(reponse.data);
    } catch (erreur) {
      toast.error(
        messageErreurApi(
          erreur,
          "Impossible de retirer cette tâche du planning.",
        ),
      );
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-ink/10 pt-4">
      <Label className="flex items-center gap-1.5">
        <CalendarClock className="h-4 w-4 text-accent" />
        Planifier dans le planning
      </Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="planif-debut" className="text-xs text-ink/50">
            Début
          </Label>
          <Input
            id="planif-debut"
            type="datetime-local"
            value={debut}
            onChange={(event) => setDebut(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="planif-fin" className="text-xs text-ink/50">
            Fin
          </Label>
          <Input
            id="planif-fin"
            type="datetime-local"
            value={fin}
            onChange={(event) => setFin(event.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-ink/50">Notification</Label>
        <RappelAvanceSelect value={rappelAvance} onValueChange={setRappelAvance} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={planifier} disabled={enCours}>
          {enCours
            ? "Enregistrement..."
            : dejaPlanifiee
              ? "Mettre à jour le créneau"
              : "Planifier"}
        </Button>
        {dejaPlanifiee && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={retirer}
            disabled={enCours}
          >
            Retirer du planning
          </Button>
        )}
      </div>
    </div>
  );
}
