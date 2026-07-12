"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SectionAddButton } from "@/components/cockpit/section-add-button";
import { TaskQuickAdd } from "@/components/taches/task-quick-add";
import type { Task } from "@/components/taches/types";

interface TaskQuickAddDialogProps {
  onCreated: (task: Task) => void;
}

/**
 * Dialog de création rapide de tâche pour le bouton « + » du cockpit (F7,
 * Round 014) : réutilise `TaskQuickAdd` (même formulaire que `/taches`)
 * dans une modale, avec toast de confirmation à la création.
 */
export function TaskQuickAddDialog({ onCreated }: TaskQuickAddDialogProps) {
  const [open, setOpen] = useState(false);

  function handleCreated(tache: Task) {
    onCreated(tache);
    toast.success("Tâche créée.");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<SectionAddButton aria-label="Ajouter une tâche" />}>
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle tâche</DialogTitle>
          <DialogDescription>
            Donne un titre à ta tâche, tu pourras préciser l&apos;échéance et
            la priorité plus tard depuis la fiche complète.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-inner border border-ink/10">
          <TaskQuickAdd onCreated={handleCreated} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
