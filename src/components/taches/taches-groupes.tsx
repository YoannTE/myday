"use client";

import { TaskItem } from "@/components/taches/task-item";
import type { Task } from "@/components/taches/types";

interface TachesGroupesProps {
  taches: Task[];
  categoriesExistent: boolean;
  onUpdated: (task: Task) => void;
  onDeleted?: (taskId: string) => void;
  onCategoriesChanged: () => void;
  onCreerCategorie: () => void;
  /** Remplace la liste complète après un déplacement (`POST /api/tasks/{id}/deplacer`). */
  onReordonnee: (taches: Task[]) => void;
}

/** Rang de `tache` parmi les tâches sans échéance du même tableau (ordre reçu de l'API). */
function positionSansEcheance(tache: Task, groupe: Task[]): number {
  const sansEcheance = groupe.filter((t) => !t.echeance);
  return sansEcheance.findIndex((t) => t.id === tache.id);
}

/**
 * Liste unique des tâches « à faire ». Le groupement par catégorie a été
 * retiré : la catégorie de chaque tâche est déjà visible sur sa ligne, à
 * droite, donc des en-têtes de groupe faisaient doublon et fractionnaient la
 * liste. Le CTA de création de catégorie n'apparaît que tant qu'aucune
 * catégorie n'existe (ensuite, la roue crantée du bandeau prend le relais).
 */
export function TachesGroupes({
  taches,
  categoriesExistent,
  onUpdated,
  onDeleted,
  onCategoriesChanged,
  onCreerCategorie,
  onReordonnee,
}: TachesGroupesProps) {
  if (taches.length === 0) {
    return (
      <div className="rounded-card bg-card shadow-card">
        <p className="px-5 py-6 text-center font-body text-sm text-ink/50">
          Aucune tâche à faire pour l&apos;instant.
        </p>
      </div>
    );
  }

  const nombreSansEcheance = taches.filter((t) => !t.echeance).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="divide-y divide-ink/5 rounded-card bg-card shadow-card">
        {taches.map((tache) => {
          const position = positionSansEcheance(tache, taches);
          return (
            <TaskItem
              key={tache.id}
              task={tache}
              onUpdated={onUpdated}
              onDeleted={onDeleted}
              onCategoriesChanged={onCategoriesChanged}
              onReordonnee={onReordonnee}
              peutMonter={position > 0}
              peutDescendre={position >= 0 && position < nombreSansEcheance - 1}
            />
          );
        })}
      </div>
      {!categoriesExistent && (
        <button
          type="button"
          // `stopPropagation` indispensable : sans lui, le clic remonte
          // jusqu'au document après l'ouverture et `TaskCategoriesDialog`
          // (Dialog Base UI contrôlé, sans `DialogTrigger`) le prend pour un
          // clic à l'extérieur et se referme aussitôt. Même correctif que
          // `SectionSettingsButton`.
          onClick={(evenement) => {
            evenement.stopPropagation();
            onCreerCategorie();
          }}
          className="self-start font-body text-sm text-accent"
        >
          + Créer une catégorie
        </button>
      )}
    </div>
  );
}
