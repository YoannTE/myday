import Link from "next/link";
import { TaskItem } from "@/components/taches/task-item";
import { TaskQuickAddDialog } from "@/components/taches/task-quick-add-dialog";
import type { Task } from "@/components/taches/types";

/**
 * Bloc « Tes tâches » du cockpit (transposition fidèle de la variante V0
 * « Checklist nette ») : tâches à faire uniquement (contrat `GET
 * /api/cockpit`). Le clic sur la case délègue à `TaskItem` (optimiste,
 * rollback + toast si échec) ; `onUpdated` retire la tâche de la liste dès
 * qu'elle passe à « faite » (cf. `cockpit-client.tsx`) et l'y ajoute à la
 * création (bouton « + », F7 Round 014 — `onUpdated` gère déjà les deux cas).
 */
export function TachesChecklist({
  taches,
  onUpdated,
}: {
  taches: Task[];
  onUpdated: (task: Task) => void;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-ink">
            Tes tâches
          </h2>
          <TaskQuickAddDialog onCreated={onUpdated} />
        </div>
        <Link href="/taches" className="font-body text-sm text-accent">
          Tout voir →
        </Link>
      </div>
      <div className="divide-y divide-ink/5 rounded-card bg-card shadow-card">
        {taches.length === 0 ? (
          <p className="px-5 py-6 text-center font-body text-sm text-ink/50">
            Aucune tâche à faire pour l&apos;instant.
          </p>
        ) : (
          taches.map((tache) => (
            <TaskItem key={tache.id} task={tache} onUpdated={onUpdated} />
          ))
        )}
      </div>
    </section>
  );
}
