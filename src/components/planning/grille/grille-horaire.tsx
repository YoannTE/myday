"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import {
  MINUTES_PAR_JOUR,
  estAujourdHui,
  formaterEnteteJour,
  instantDepuisMinutesAbsolues,
  minutesAbsolues,
  numeroJourCivil,
} from "@/components/planning/date-utils";
import { EventFormDialog } from "@/components/planning/event-form-dialog";
import { BlocGrille } from "@/components/planning/grille/bloc-grille";
import { FondColonnes, GoutiereHeures, HAUTEUR_GRILLE, HAUTEUR_HEURE } from "@/components/planning/grille/grille-fond";
import {
  disposerSegments,
  elementsPlanning,
  segmentsElement,
  type ElementPlanning,
  type Segment,
} from "@/components/planning/grille/disposition";
import { useGlisser } from "@/components/planning/grille/use-glisser";
import { cn } from "@/lib/utils";
import type { EvenementApi } from "@/components/planning/types";
import type { Task } from "@/components/taches/types";

interface GrilleHoraireProps {
  jours: Date[];
  evenements: EvenementApi[];
  taches: Task[];
  onDeposer: (element: ElementPlanning, debut: Date, fin: Date) => void;
  onSuccess: () => void;
  onBord?: (delta: -1 | 1) => void;
  avecEntetes?: boolean;
}

const PAS_MINUTES = 15;

function placement(segment: Pick<Segment, "colonne" | "debutMinutes" | "finMinutes" | "voie" | "voies">, nombreJours: number) {
  const largeur = 100 / nombreJours;
  const top = (segment.debutMinutes / 60) * HAUTEUR_HEURE;
  const hauteur = Math.max(((segment.finMinutes - segment.debutMinutes) / 60) * HAUTEUR_HEURE - 2, 16);
  return {
    hauteur,
    style: {
      top,
      height: hauteur,
      left: `calc(${segment.colonne * largeur + (segment.voie / segment.voies) * largeur}% + 2px)`,
      width: `calc(${largeur / segment.voies}% - 4px)`,
    },
  };
}

/**
 * Grille horaire façon calendrier Apple (vues jour et semaine) : on attrape
 * un rendez-vous ou une tâche planifiée pour le déplacer (autre heure, autre
 * jour), ou sa poignée du bas pour changer sa durée, au quart d'heure près.
 */
export function GrilleHoraire({ jours, evenements, taches, onDeposer, onSuccess, onBord, avecEntetes = false }: GrilleHoraireProps) {
  const router = useRouter();
  const defilementRef = useRef<HTMLDivElement>(null);
  const colonnesRef = useRef<HTMLDivElement>(null);
  const apercuRef = useRef<HTMLDivElement>(null);
  const actifRef = useRef(false);
  const [cleSource, setCleSource] = useState<string | null>(null);
  const [evenementOuvert, setEvenementOuvert] = useState<EvenementApi | null>(null);

  const elements = useMemo(() => elementsPlanning(evenements, taches), [evenements, taches]);
  const segments = useMemo(() => disposerSegments(elements, jours), [elements, jours]);

  const positionDepuisPointeur = useCallback(
    (x: number, y: number) => {
      const zone = colonnesRef.current?.getBoundingClientRect();
      if (!zone || zone.width === 0) return null;
      const colonne = Math.min(Math.max(Math.floor(((x - zone.left) / zone.width) * jours.length), 0), jours.length - 1);
      const minute = Math.min(Math.max(((y - zone.top) / HAUTEUR_HEURE) * 60, 0), MINUTES_PAR_JOUR - 1);
      return numeroJourCivil(jours[colonne]) * MINUTES_PAR_JOUR + minute;
    },
    [jours],
  );

  const { glissement, demarrer, vientDeGlisser } = useGlisser({
    pas: PAS_MINUTES,
    positionDepuisPointeur,
    onDeposer,
    onBord,
    zoneDefilement: () => defilementRef.current,
  });

  // Ouverture : vers l'heure actuelle si aujourd'hui est affiché, sinon vers
  // le premier rendez-vous (7h par défaut). Jamais pendant un glissement.
  const premierJour = jours[0]?.getTime();
  useLayoutEffect(() => {
    const zone = defilementRef.current;
    if (!zone || actifRef.current) return;
    const aujourdHui = jours.some((jour) => estAujourdHui(jour));
    const premiere = Math.min(...segments.map((s) => s.debutMinutes), 7 * 60);
    const cible = aujourdHui ? (minutesAbsolues(new Date()) % MINUTES_PAR_JOUR) - 90 : premiere - 30;
    zone.scrollTop = Math.max((cible / 60) * HAUTEUR_HEURE, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premierJour]);

  const actif = glissement !== null;
  useEffect(() => {
    if (!actif || !apercuRef.current) return;
    const animation = gsap.fromTo(apercuRef.current, { scale: 0.96, opacity: 0.7 }, { scale: 1, opacity: 1, duration: 0.18, ease: "power2.out" });
    return () => {
      animation.kill();
    };
  }, [actif]);
  useEffect(() => {
    actifRef.current = actif;
  }, [actif]);

  const surDebut = (segment: Segment, mode: "deplacer" | "duree") => {
    const gestionnaire = demarrer(segment.element, mode);
    return (evenement: React.PointerEvent) => {
      setCleSource(segment.cleRendu);
      gestionnaire(evenement);
    };
  };

  const ouvrir = (element: ElementPlanning) => {
    if (vientDeGlisser()) return;
    if (element.type === "evenement") setEvenementOuvert(element.evenement);
    else router.push("/taches");
  };

  const apercus = glissement
    ? segmentsElement(glissement.element, jours, glissement.debutAbs, glissement.finAbs)
    : [];
  const sourceAbsente = actif && cleSource !== null && !segments.some((s) => s.cleRendu === cleSource);

  return (
    <div ref={defilementRef} className="relative max-h-[62vh] overflow-y-auto overscroll-contain md:max-h-[68vh]">
      {avecEntetes && (
        <div className="sticky top-0 z-40 flex border-b border-ink/5 bg-card pb-1.5">
          <div className="w-10 flex-shrink-0 md:w-12" />
          {jours.map((jour) => (
            <p key={jour.toISOString()} className={cn("flex-1 text-center font-mono text-[10px] tracking-[.04em] uppercase", estAujourdHui(jour) ? "text-accent" : "text-ink/40")}>
              {formaterEnteteJour(jour)}
            </p>
          ))}
        </div>
      )}
      <div className="flex pt-2">
        <GoutiereHeures />
        <div ref={colonnesRef} className="relative flex-1" style={{ height: HAUTEUR_GRILLE }}>
          <FondColonnes jours={jours} />
          {[
            ...segments.map((segment) => {
              const { hauteur, style } = placement(segment, jours.length);
              const enCours = glissement?.element.cle === segment.element.cle;
              return (
                <BlocGrille
                  key={segment.cleRendu}
                  element={segment.element}
                  debut={segment.element.debut}
                  fin={segment.element.fin}
                  hauteur={hauteur}
                  style={style}
                  variante={enCours ? "source" : "normal"}
                  onPointerDownDeplacer={surDebut(segment, "deplacer")}
                  onPointerDownDuree={surDebut(segment, "duree")}
                  onOuvrir={() => ouvrir(segment.element)}
                />
              );
            }),
            // Garde monté le bloc attrapé quand la vue change de jour sous le
            // doigt (même clé, même liste) : sans lui, le navigateur perdrait
            // le suivi du glissement.
            ...(sourceAbsente && glissement
              ? [<BlocGrille key={cleSource as string} element={glissement.element} debut={glissement.element.debut} fin={glissement.element.fin} hauteur={0} style={{ display: "none" }} variante="source" />]
              : []),
            ...(glissement
              ? apercus.map((apercu, index) => {
                  const { hauteur, style } = placement({ ...apercu, voie: 0, voies: 1 }, jours.length);
                  return (
                    <BlocGrille
                      key={`apercu-${apercu.cleRendu}`}
                      apercuRef={index === 0 ? apercuRef : undefined}
                      element={glissement.element}
                      debut={instantDepuisMinutesAbsolues(glissement.debutAbs).toISOString()}
                      fin={instantDepuisMinutesAbsolues(glissement.finAbs).toISOString()}
                      hauteur={hauteur}
                      style={style}
                      variante="apercu"
                    />
                  );
                })
              : []),
          ]}
        </div>
      </div>
      {evenementOuvert && (
        <EventFormDialog
          evenement={evenementOuvert}
          open
          onOpenChange={(ouvert) => !ouvert && setEvenementOuvert(null)}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
}
