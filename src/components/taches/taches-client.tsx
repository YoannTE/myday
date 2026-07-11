"use client";

import { useCallback, useEffect, useState } from "react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskItem } from "@/components/taches/task-item";
import { TaskQuickAdd } from "@/components/taches/task-quick-add";
import type { Task } from "@/components/taches/types";

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
 */
export function TachesClient() {
  const [taches, setTaches] = useState<Task[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  function handleUpdated(tache: Task) {
    setTaches((actuelles) =>
      (actuelles ?? []).map((t) => (t.id === tache.id ? tache : t)),
    );
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

  if (!taches) {
    return <TachesSkeleton />;
  }

  const aFaire = taches.filter((t) => t.statut === "a_faire");
  const faites = taches.filter((t) => t.statut === "faite");

  return (
    <div className="flex flex-col gap-8">
      <div className="divide-y divide-ink/5 rounded-card bg-card shadow-card">
        <TaskQuickAdd onCreated={handleCreated} />
        {aFaire.length === 0 ? (
          <p className="px-5 py-6 text-center font-body text-sm text-ink/50">
            Aucune tâche à faire pour l&apos;instant.
          </p>
        ) : (
          aFaire.map((tache) => (
            <TaskItem key={tache.id} task={tache} onUpdated={handleUpdated} />
          ))
        )}
      </div>
      {faites.length > 0 && (
        <div>
          <p className="mb-3 font-mono text-[11px] tracking-[.04em] text-ink/40 uppercase">
            Terminées
          </p>
          <div className="divide-y divide-ink/5 rounded-card bg-card shadow-card">
            {faites.map((tache) => (
              <TaskItem key={tache.id} task={tache} onUpdated={handleUpdated} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
