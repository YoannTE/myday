"use client";

import { Controller, type Control, type UseFormRegister, type UseFormSetValue } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategorySelect } from "@/components/taches/category-select";
import type { TaskDetailsValues } from "@/components/taches/task-details-schema";
import type { TaskCategory } from "@/components/taches/types";

/** Libellés des options de récurrence (partagés avec l'indicateur). */
export const RECURRENCE_LABELS: Record<string, string> = {
  aucune: "Une seule fois",
  quotidienne: "Chaque jour",
  hebdomadaire: "Chaque semaine",
  mensuelle: "Chaque mois",
};

interface TaskDetailsFieldsProps {
  register: UseFormRegister<TaskDetailsValues>;
  control: Control<TaskDetailsValues>;
  setValue: UseFormSetValue<TaskDetailsValues>;
  categories: TaskCategory[] | null;
  onCategoryCreated: (categorie: TaskCategory) => void;
}

/**
 * Champs « échéance » (date picker, effaçable) et « catégorie » (avec
 * création inline) du formulaire d'édition de tâche (Round 012, F1/F2).
 */
export function TaskDetailsFields({
  register,
  control,
  setValue,
  categories,
  onCategoryCreated,
}: TaskDetailsFieldsProps) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="echeance-tache">Échéance</Label>
        <div className="flex items-center gap-2">
          <Input
            id="echeance-tache"
            type="date"
            className="flex-1"
            {...register("echeance")}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setValue("echeance", "")}
          >
            Effacer
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Répétition</Label>
        <Controller
          control={control}
          name="recurrence"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(valeur) => RECURRENCE_LABELS[valeur] ?? "Une seule fois"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RECURRENCE_LABELS).map(([valeur, libelle]) => (
                  <SelectItem key={valeur} value={valeur}>
                    {libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="font-body text-xs text-ink/40">
          Une tâche qui se répète revient automatiquement à la date suivante
          quand tu la coches.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>Catégorie</Label>
        <Controller
          control={control}
          name="categorie_id"
          render={({ field }) => (
            <CategorySelect
              categories={categories ?? []}
              disabled={categories === null}
              value={field.value}
              onValueChange={field.onChange}
              onCategoryCreated={onCategoryCreated}
            />
          )}
        />
      </div>
    </>
  );
}
