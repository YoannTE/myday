"use client";

import { TaskItem } from "@/components/taches/task-item";
import type { Task, TaskCategory } from "@/components/taches/types";

const CLE_SANS_CATEGORIE = "__sans__";

interface TachesGroupesProps {
  taches: Task[];
  categories: TaskCategory[];
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

interface Groupe {
  cle: string;
  nom: string;
  couleur: string | null;
  taches: Task[];
}

/**
 * Regroupe les tâches par catégorie ; « Sans catégorie » est toujours en
 * dernier. Round 017 : les groupes suivent l'ordre manuel de `categories`
 * (reçu de l'API, `POST /api/task-categories/{id}/deplacer`), plus de tri
 * alphabétique local.
 */
function grouperParCategorie(taches: Task[], categories: TaskCategory[]): Groupe[] {
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
  const ordre = categories.map((categorie) => categorie.id);
  return [...groupes.values()].sort((a, b) => {
    if (a.cle === CLE_SANS_CATEGORIE) return 1;
    if (b.cle === CLE_SANS_CATEGORIE) return -1;
    return ordre.indexOf(a.cle) - ordre.indexOf(b.cle);
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
  categories,
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

  if (!categoriesExistent) {
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
      </div>
    );
  }

  const groupes = grouperParCategorie(taches, categories);

  return (
    <div className="flex flex-col gap-6">
      {groupes.map((groupe) => {
        const nombreSansEcheance = groupe.taches.filter((t) => !t.echeance).length;
        return (
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
              {groupe.taches.map((tache) => {
                const position = positionSansEcheance(tache, groupe.taches);
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
          </div>
        );
      })}
    </div>
  );
}
