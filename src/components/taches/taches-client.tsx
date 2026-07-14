"use client";

import { useCallback, useEffect, useState } from "react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskItem } from "@/components/taches/task-item";
import { TaskQuickAdd } from "@/components/taches/task-quick-add";
import { TachesGroupes } from "@/components/taches/taches-groupes";
import { TaskCategoriesDialog } from "@/components/taches/task-categories-dialog";
import type { Task, TaskCategory } from "@/components/taches/types";

function TachesSkeleton() {
  return (
    <div className="divide-y divide-ink/5 rounded-card bg-card shadow-card">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

/**
 * Page `/taches` (F5) : liste complète des tâches, ajout rapide et cochage,
 * en réutilisant `TaskItem`/`TaskQuickAdd` (mêmes composants que le cockpit).
 * Round 012 (F1/F2) : groupement par catégorie via `TachesGroupes`, gestion
 * des catégories via `TaskCategoriesDialog`.
 */
export function TachesClient() {
  const [taches, setTaches] = useState<Task[] | null>(null);
  const [categories, setCategories] = useState<TaskCategory[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [dialogCategoriesOuvert, setDialogCategoriesOuvert] = useState(false);

  const chargerTaches = useCallback(async () => {
    try {
      const reponse = await apiCall<{ data: Task[] }>("/api/tasks");
      setTaches(reponse.data);
      setErreur(null);
    } catch (erreurChargement) {
      setErreur(
        messageErreurApi(erreurChargement, "Impossible de récupérer tes tâches."),
      );
    }
  }, []);

  const chargerCategories = useCallback(async () => {
    try {
      const reponse = await apiCall<{ data: TaskCategory[] }>(
        "/api/task-categories",
      );
      setCategories(reponse.data);
    } catch {
      setCategories((actuelles) => actuelles ?? []);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    chargerTaches();
    chargerCategories();
  }, [chargerTaches, chargerCategories]);

  function handleUpdated(tache: Task) {
    setTaches((actuelles) =>
      (actuelles ?? []).map((t) => (t.id === tache.id ? tache : t)),
    );
  }

  function handleDeleted(taskId: string) {
    setTaches((actuelles) => (actuelles ?? []).filter((t) => t.id !== taskId));
  }

  function handleCreated(tache: Task) {
    setTaches((actuelles) => [tache, ...(actuelles ?? [])]);
  }

  if (erreur) {
    return (
      <div className="rounded-card bg-card p-6 text-center shadow-card">
        <p className="font-body text-sm text-ink/60">{erreur}</p>
      </div>
    );
  }

  if (!taches || !categories) {
    return <TachesSkeleton />;
  }

  const aFaire = taches.filter((t) => t.statut === "a_faire");
  const faites = taches.filter((t) => t.statut === "faite");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setDialogCategoriesOuvert(true)}
            className="font-body text-sm text-accent"
          >
            Gérer les catégories
          </button>
        </div>
        <div className="divide-y divide-ink/5 rounded-card bg-card shadow-card">
          <TaskQuickAdd onCreated={handleCreated} />
        </div>
      </div>
      <TachesGroupes
        taches={aFaire}
        categoriesExistent={categories.length > 0}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
        onCategoriesChanged={chargerCategories}
        onCreerCategorie={() => setDialogCategoriesOuvert(true)}
      />
      {faites.length > 0 && (
        <div>
          <p className="mb-3 font-mono text-[11px] tracking-[.04em] text-ink/40 uppercase">
            Terminées
          </p>
          <div className="divide-y divide-ink/5 rounded-card bg-card shadow-card">
            {faites.map((tache) => (
              <TaskItem
                key={tache.id}
                task={tache}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
                onCategoriesChanged={chargerCategories}
              />
            ))}
          </div>
        </div>
      )}
      <TaskCategoriesDialog
        open={dialogCategoriesOuvert}
        onOpenChange={setDialogCategoriesOuvert}
        categories={categories}
        onChanged={chargerCategories}
      />
    </div>
  );
}
