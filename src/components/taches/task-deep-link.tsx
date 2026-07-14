"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TaskDetailsDialog } from "@/components/taches/task-details-dialog";
import type { Task } from "@/components/taches/types";

interface TaskDeepLinkProps {
  taches: Task[];
  onUpdated: (task: Task) => void;
  onDeleted: (taskId: string) => void;
  onCategoriesChanged: () => void;
}

/**
 * Ouvre directement le détail d'une tâche quand la page est atteinte via
 * `/taches?task=<id>` (clic sur une notification de rappel ou de partage).
 * La tâche est cherchée dans la liste déjà chargée ; le détail (échéance,
 * catégorie, planification) n'existe que pour une tâche dont on est
 * propriétaire — une tâche partagée reçue reste simplement visible dans la
 * liste.
 */
export function TaskDeepLink({
  taches,
  onUpdated,
  onDeleted,
  onCategoriesChanged,
}: TaskDeepLinkProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const taskId = searchParams.get("task");
  const [ouvert, setOuvert] = useState(false);

  const tache = taskId ? taches.find((t) => t.id === taskId) : undefined;
  const ouvrable = tache != null && tache.partage_par == null;

  useEffect(() => {
    if (ouvrable) setOuvert(true);
  }, [ouvrable]);

  function surChangementOuverture(nouvelEtat: boolean) {
    setOuvert(nouvelEtat);
    if (!nouvelEtat) {
      // Retire le paramètre pour éviter la réouverture au rechargement.
      router.replace("/taches");
    }
  }

  if (!tache || !ouvrable) return null;

  return (
    <TaskDetailsDialog
      task={tache}
      open={ouvert}
      onOpenChange={surChangementOuverture}
      onUpdated={onUpdated}
      onDeleted={onDeleted}
      onCategoriesChanged={onCategoriesChanged}
    />
  );
}
