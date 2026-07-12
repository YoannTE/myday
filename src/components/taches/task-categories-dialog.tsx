"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskCategoryRow } from "@/components/taches/task-category-row";
import type { TaskCategory } from "@/components/taches/types";

interface TaskCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: TaskCategory[];
  onChanged: () => void;
}

/**
 * Gestion des catégories de tâche (Round 012, F2) : créer, renommer,
 * supprimer. Ouvert depuis la page `/taches` (« Gérer les catégories »).
 * Contrôlé entièrement par `open`/`onOpenChange`, pas de `DialogTrigger`
 * (déclenché ailleurs sur la page).
 */
export function TaskCategoriesDialog({
  open,
  onOpenChange,
  categories,
  onChanged,
}: TaskCategoriesDialogProps) {
  const [nouveauNom, setNouveauNom] = useState("");
  const [creation, setCreation] = useState(false);
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);

  async function creerCategorie() {
    const nomNettoye = nouveauNom.trim();
    if (!nomNettoye) {
      setErreurCreation("Le nom de la catégorie est obligatoire.");
      return;
    }
    setCreation(true);
    setErreurCreation(null);
    try {
      await apiCall("/api/task-categories", {
        method: "POST",
        body: { nom: nomNettoye },
      });
      toast.success("Catégorie créée.");
      setNouveauNom("");
      onChanged();
    } catch (erreur) {
      setErreurCreation(
        messageErreurApi(erreur, "Impossible de créer la catégorie."),
      );
    } finally {
      setCreation(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tes catégories</DialogTitle>
          <DialogDescription>
            Renomme ou supprime une catégorie. Les tâches associées restent,
            sans catégorie.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {categories.length === 0 && (
            <p className="font-body text-sm text-ink/50">
              Aucune catégorie pour l&apos;instant.
            </p>
          )}
          {categories.map((categorie) => (
            <TaskCategoryRow
              key={categorie.id}
              categorie={categorie}
              onChanged={onChanged}
            />
          ))}
        </div>
        <div className="space-y-1.5 border-t border-ink/5 pt-3">
          <div className="flex items-center gap-2">
            <Input
              value={nouveauNom}
              placeholder="Nouvelle catégorie"
              onChange={(evenement) => {
                setNouveauNom(evenement.target.value);
                if (erreurCreation) setErreurCreation(null);
              }}
              onKeyDown={(evenement) => {
                if (evenement.key === "Enter") {
                  evenement.preventDefault();
                  creerCategorie();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              disabled={creation}
              onClick={creerCategorie}
            >
              {creation ? "Création..." : "Créer"}
            </Button>
          </div>
          {erreurCreation && (
            <p className="text-xs text-destructive">{erreurCreation}</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
