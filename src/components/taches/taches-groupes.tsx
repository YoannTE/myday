"use client";

import { TaskItem } from "@/components/taches/task-item";
import type { Task } from "@/components/taches/types";

const CLE_SANS_CATEGORIE = "__sans__";

interface TachesGroupesProps {
  taches: Task[];
  categoriesExistent: boolean;
  onUpdated: (task: Task) => void;
  onCategoriesChanged: () => void;
  onCreerCategorie: () => void;
}

interface Groupe {
  cle: string;
  nom: string;
  couleur: string | null;
  taches: Task[];
}

/** Regroupe les tâches par catégorie ; « Sans catégorie » est toujours en dernier. */
function grouperParCategorie(taches: Task[]): Groupe[] {
  const groupes = new Map<string, Groupe>();
  for (const tache of taches) {
    const cle = tache.categorie?.id ?? CLE_SANS_CATEGORIE;
    if (!groupes.has(cle)) {
      groupes.set(cle, {
        cle,
        nom: tache.categorie?.nom ?? "Sans catégorie",
        couleur: tache.categorie?.couleur ?? null,
        taches: [],
      });
    }
    groupes.get(cle)?.taches.push(tache);
  }
  return [...groupes.values()].sort((a, b) => {
    if (a.cle === CLE_SANS_CATEGORIE) return 1;
    if (b.cle === CLE_SANS_CATEGORIE) return -1;
    return a.nom.localeCompare(b.nom, "fr");
  });
}

/**
 * Groupement des tâches « à faire » par catégorie (Round 012, F2). Si
 * l'utilisateur n'a encore créé AUCUNE catégorie, les tâches restent
 * affichées à plat (pas d'en-têtes vides) avec un CTA discret pour en créer
 * une - le groupement lui-même n'apparaît qu'une fois la première catégorie
 * créée.
 */
export function TachesGroupes({
  taches,
  categoriesExistent,
  onUpdated,
  onCategoriesChanged,
  onCreerCategorie,
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

  if (!categoriesExistent) {
    return (
      <div className="flex flex-col gap-3">
        <div className="divide-y divide-ink/5 rounded-card bg-card shadow-card">
          {taches.map((tache) => (
            <TaskItem
              key={tache.id}
              task={tache}
              onUpdated={onUpdated}
              onCategoriesChanged={onCategoriesChanged}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onCreerCategorie}
          className="self-start font-body text-sm text-accent"
        >
          + Créer une catégorie
        </button>
      </div>
    );
  }

  const groupes = grouperParCategorie(taches);

  return (
    <div className="flex flex-col gap-6">
      {groupes.map((groupe) => (
        <div key={groupe.cle}>
          <div className="mb-2 flex items-center gap-2">
            {groupe.couleur && (
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: groupe.couleur }}
                aria-hidden="true"
              />
            )}
            <p className="font-mono text-[11px] tracking-[.04em] text-ink/40 uppercase">
              {groupe.nom}
            </p>
          </div>
          <div className="divide-y divide-ink/5 rounded-card bg-card shadow-card">
            {groupe.taches.map((tache) => (
              <TaskItem
                key={tache.id}
                task={tache}
                onUpdated={onUpdated}
                onCategoriesChanged={onCategoriesChanged}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
