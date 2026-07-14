"use client";

import { useCallback, useEffect, useState } from "react";
import { apiCall } from "@/lib/api";
import { PlanningHeader } from "@/components/planning/planning-header";
import { PlanningJour } from "@/components/planning/planning-jour";
import { PlanningSemaine } from "@/components/planning/planning-semaine";
import { PlanningMois } from "@/components/planning/planning-mois";
import { PlanningAnnee } from "@/components/planning/planning-annee";
import { PlanningSkeleton } from "@/components/planning/planning-skeleton";
import { EventCategoriesDialog } from "@/components/planning/event-categories-dialog";
import { EventDeepLink } from "@/components/planning/event-deep-link";
import {
  debutAnnee,
  debutSemaine,
  decalerReference,
  fenetreVue,
  finAnnee,
  formaterAnnee,
  formaterJourComplet,
  formaterMoisAnnee,
  formaterPlageSemaine,
  joursDeLaSemaine,
  type VuePlanning,
} from "@/components/planning/date-utils";
import type {
  CompteurJourApi,
  EventCategory,
  EvenementApi,
} from "@/components/planning/types";
import type { Task } from "@/components/taches/types";

const CLE_VUE_PLANNING = "myday-planning-vue";
const VUES_VALIDES: VuePlanning[] = ["jour", "semaine", "mois", "annee"];

function estVuePlanning(valeur: string | null): valeur is VuePlanning {
  return valeur !== null && VUES_VALIDES.includes(valeur as VuePlanning);
}

function libellePourVue(vue: VuePlanning, reference: Date): string {
  switch (vue) {
    case "jour":
      return formaterJourComplet(reference);
    case "semaine": {
      const debut = debutSemaine(reference);
      return formaterPlageSemaine(debut, joursDeLaSemaine(debut)[6]);
    }
    case "mois":
      return formaterMoisAnnee(reference);
    case "annee":
      return formaterAnnee(reference);
  }
}

// Orchestrateur client de la page Planning : sélecteur de vue (jour/semaine/
// mois/année, préférence mémorisée en localStorage), navigation adaptée à la
// vue, fetch des événements (ou de l'agrégat de densité pour la vue année)
// de la fenêtre affichée, rechargement après chaque création/modification/
// suppression (le dialog appelle `onSuccess`).
export function PlanningClient() {
  const [vue, setVue] = useState<VuePlanning>("semaine");
  const [reference, setReference] = useState(() => new Date());
  const [evenements, setEvenements] = useState<EvenementApi[] | null>(null);
  const [tachesPlanifiees, setTachesPlanifiees] = useState<Task[] | null>(null);
  const [compteurs, setCompteurs] = useState<CompteurJourApi[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [categories, setCategories] = useState<EventCategory[] | null>(null);
  const [dialogCategoriesOuvert, setDialogCategoriesOuvert] = useState(false);

  const chargerCategories = useCallback(async () => {
    try {
      const reponse = await apiCall<{ data: EventCategory[] }>(
        "/api/event-categories",
      );
      setCategories(reponse.data);
    } catch {
      setCategories((actuelles) => actuelles ?? []);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    chargerCategories();
  }, [chargerCategories]);

  // Lit la préférence de vue une fois montée côté client (évite un
  // décalage d'hydratation SSR/CSR : le premier rendu reste "semaine" des
  // deux côtés, la vue mémorisée prend le relais juste après).
  useEffect(() => {
    const sauvegardee = window.localStorage.getItem(CLE_VUE_PLANNING);
    if (estVuePlanning(sauvegardee)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVue(sauvegardee);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CLE_VUE_PLANNING, vue);
  }, [vue]);

  const recharger = useCallback(async () => {
    try {
      if (vue === "annee") {
        const debut = debutAnnee(reference);
        const fin = finAnnee(reference);
        const reponse = await apiCall<{ data: CompteurJourApi[] }>(
          `/api/events/counts?from=${encodeURIComponent(debut.toISOString())}&to=${encodeURIComponent(fin.toISOString())}`,
        );
        setCompteurs(reponse.data);
      } else {
        const { debut, fin } = fenetreVue(vue, reference);
        const depuis = encodeURIComponent(debut.toISOString());
        const jusqua = encodeURIComponent(fin.toISOString());
        if (vue === "jour" || vue === "semaine") {
          const [reponseEvenements, reponseTaches] = await Promise.all([
            apiCall<{ data: EvenementApi[] }>(
              `/api/events?from=${depuis}&to=${jusqua}`,
            ),
            apiCall<{ data: Task[] }>(
              `/api/tasks/planned?from=${depuis}&to=${jusqua}`,
            ),
          ]);
          setEvenements(reponseEvenements.data);
          setTachesPlanifiees(reponseTaches.data);
        } else {
          const reponse = await apiCall<{ data: EvenementApi[] }>(
            `/api/events?from=${depuis}&to=${jusqua}`,
          );
          setEvenements(reponse.data);
          setTachesPlanifiees(null);
        }
      }
      setErreur(null);
    } catch (erreurChargement) {
      setErreur(
        erreurChargement instanceof Error
          ? erreurChargement.message
          : "Impossible de charger le planning.",
      );
    }
  }, [vue, reference]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEvenements(null);
    setTachesPlanifiees(null);
    setCompteurs(null);
    recharger();
  }, [recharger]);

  return (
    <div>
      <PlanningHeader
        vue={vue}
        onChangerVue={setVue}
        libellePlage={libellePourVue(vue, reference)}
        onPrecedent={() =>
          setReference((actuelle) => decalerReference(vue, actuelle, -1))
        }
        onSuivant={() =>
          setReference((actuelle) => decalerReference(vue, actuelle, 1))
        }
        onAujourdHui={() => setReference(new Date())}
        onSuccess={recharger}
        onGererCategories={() => setDialogCategoriesOuvert(true)}
      />
      {erreur ? (
        <p className="rounded-card bg-card p-6 text-sm text-destructive shadow-card">
          {erreur}
        </p>
      ) : vue === "annee" ? (
        compteurs === null ? (
          <PlanningSkeleton />
        ) : (
          <PlanningAnnee
            reference={reference}
            compteurs={compteurs}
            onSelectionnerMois={(mois) => {
              setReference(mois);
              setVue("mois");
            }}
          />
        )
      ) : evenements === null ? (
        <PlanningSkeleton />
      ) : vue === "jour" ? (
        <PlanningJour
          jour={reference}
          evenements={evenements}
          tachesPlanifiees={tachesPlanifiees ?? []}
          onSuccess={recharger}
        />
      ) : vue === "semaine" ? (
        <PlanningSemaine
          jours={joursDeLaSemaine(debutSemaine(reference))}
          evenements={evenements}
          tachesPlanifiees={tachesPlanifiees ?? []}
          onSuccess={recharger}
        />
      ) : (
        <PlanningMois
          reference={reference}
          evenements={evenements}
          onSelectionnerJour={(jour) => {
            setReference(jour);
            setVue("jour");
          }}
        />
      )}
      <EventCategoriesDialog
        open={dialogCategoriesOuvert}
        onOpenChange={setDialogCategoriesOuvert}
        categories={categories ?? []}
        onChanged={chargerCategories}
      />
      <EventDeepLink onSuccess={recharger} />
    </div>
  );
}
