"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { formaterHeure, formaterJourLong } from "@/components/planning/date-utils";
import type { ElementPlanning } from "@/components/planning/grille/disposition";
import type { EvenementApi } from "@/components/planning/types";
import type { Task } from "@/components/taches/types";

interface OptionsDeplacer {
  setEvenements: React.Dispatch<React.SetStateAction<EvenementApi[] | null>>;
  setTaches: React.Dispatch<React.SetStateAction<Task[] | null>>;
  recharger: () => void;
}

async function enregistrer(element: ElementPlanning, debut: string, fin: string): Promise<void> {
  if (element.type === "evenement") {
    await apiCall(`/api/events/${element.evenement.id}`, {
      method: "PATCH",
      body: { debut, fin },
    });
  } else {
    await apiCall(`/api/tasks/${element.tache.id}/planifier`, {
      method: "POST",
      body: { debut, fin, rappel_avance_minutes: element.tache.rappel_avance_minutes },
    });
  }
}

/**
 * Enregistre un déplacement (ou un changement de durée) fait à la souris ou
 * au doigt : la grille est mise à jour tout de suite (pas d'attente du
 * serveur), puis l'API confirme. En cas d'échec, l'élément revient à sa
 * place. Un toast « Annuler » permet de revenir en arrière.
 */
export function useDeplacerElement({ setEvenements, setTaches, recharger }: OptionsDeplacer) {
  const appliquerLocalement = useCallback(
    (element: ElementPlanning, debut: string, fin: string) => {
      if (element.type === "evenement") {
        setEvenements((liste) =>
          liste?.map((e) => (e.id === element.evenement.id ? { ...e, debut, fin } : e)) ?? liste,
        );
      } else {
        setTaches((liste) =>
          liste?.map((t) =>
            t.id === element.tache.id ? { ...t, planifie_debut: debut, planifie_fin: fin } : t,
          ) ?? liste,
        );
      }
    },
    [setEvenements, setTaches],
  );

  const changer = useCallback(
    async (element: ElementPlanning, debut: string, fin: string) => {
      appliquerLocalement(element, debut, fin);
      try {
        await enregistrer(element, debut, fin);
        return true;
      } catch (erreur) {
        appliquerLocalement(element, element.debut, element.fin);
        toast.error(
          erreur instanceof Error ? erreur.message : "Impossible de déplacer cet élément.",
        );
        return false;
      } finally {
        recharger();
      }
    },
    [appliquerLocalement, recharger],
  );

  return useCallback(
    async (element: ElementPlanning, debutDate: Date, finDate: Date) => {
      const debut = debutDate.toISOString();
      const fin = finDate.toISOString();
      if (!(await changer(element, debut, fin))) return;
      const memeDebut = new Date(element.debut).getTime() === debutDate.getTime();
      const quoi = element.type === "evenement" ? "Rendez-vous" : "Tâche";
      const message = memeDebut
        ? `${quoi} « ${element.titre} » : fin à ${formaterHeure(fin)}`
        : `${quoi} « ${element.titre} » déplacé${element.type === "tache" ? "e" : ""} au ${formaterJourLong(debutDate).toLowerCase()} à ${formaterHeure(debut)}`;
      toast.success(message, {
        action: {
          label: "Annuler",
          onClick: () => {
            void changer({ ...element, debut, fin }, element.debut, element.fin);
          },
        },
      });
    },
    [changer],
  );
}
