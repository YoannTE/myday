"use client";

import { CheckSquare } from "lucide-react";
import { formaterHeure, formaterPlageHoraire } from "@/components/planning/date-utils";
import { cn } from "@/lib/utils";
import type { ElementPlanning } from "@/components/planning/grille/disposition";

interface BlocGrilleProps {
  element: ElementPlanning;
  /** Plage affichée (aperçu en cours de glissement : nouvelle heure). */
  debut: string;
  fin: string;
  hauteur: number;
  style: React.CSSProperties;
  variante: "normal" | "source" | "apercu";
  onPointerDownDeplacer?: (evenement: React.PointerEvent) => void;
  onPointerDownDuree?: (evenement: React.PointerEvent) => void;
  onOuvrir?: () => void;
  apercuRef?: React.Ref<HTMLDivElement>;
}

/**
 * Bloc d'un rendez-vous ou d'une tâche planifiée, positionné en absolu dans
 * la grille horaire. On l'attrape n'importe où pour le déplacer, ou par sa
 * poignée du bas pour changer sa durée. `select-none` et
 * `[-webkit-touch-callout:none]` évitent la loupe et le menu de l'appui long
 * sur iPhone.
 */
export function BlocGrille({
  element,
  debut,
  fin,
  hauteur,
  style,
  variante,
  onPointerDownDeplacer,
  onPointerDownDuree,
  onOuvrir,
  apercuRef,
}: BlocGrilleProps) {
  const tache = element.type === "tache";
  const compact = hauteur < 34;

  return (
    <div
      ref={apercuRef}
      role={variante === "apercu" ? undefined : "button"}
      tabIndex={variante === "normal" ? 0 : -1}
      aria-label={variante === "normal" ? `${element.titre}, ${formaterPlageHoraire(debut, fin)}` : undefined}
      onPointerDown={onPointerDownDeplacer}
      onClick={(evenement) => {
        evenement.stopPropagation();
        onOuvrir?.();
      }}
      onKeyDown={(evenement) => {
        if (evenement.key === "Enter" || evenement.key === " ") onOuvrir?.();
      }}
      style={style}
      className={cn(
        "absolute overflow-hidden rounded-inner border px-1.5 py-1 text-left select-none [-webkit-touch-callout:none]",
        tache ? "border-accent/30 bg-accent/10" : "border-accent/15 bg-soft",
        variante === "normal" && "cursor-grab touch-pan-y hover:brightness-[.97]",
        variante === "source" && "opacity-35",
        variante === "apercu" && "pointer-events-none z-30 border-accent/60 shadow-card ring-2 ring-accent/30",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-1 font-mono text-[9px] leading-tight md:text-[10px]",
          tache ? "text-accent" : "text-ink/45",
          variante === "apercu" && "font-semibold text-accent",
        )}
      >
        {tache && <CheckSquare className="h-2.5 w-2.5 flex-shrink-0" />}
        <span className={compact ? "flex-shrink-0" : "truncate"}>
          {compact ? formaterHeure(debut) : formaterPlageHoraire(debut, fin)}
        </span>
        {compact && (
          <span className="truncate font-body text-[10px] text-ink md:text-[11px]">
            {element.titre}
          </span>
        )}
      </p>
      {!compact && (
        <p className="line-clamp-3 font-body text-[11px] leading-snug break-words text-ink md:text-xs">
          {element.titre}
        </p>
      )}
      {onPointerDownDuree && (
        <div
          aria-hidden
          onPointerDown={onPointerDownDuree}
          className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize touch-pan-y justify-center"
        >
          <span className="mt-1 h-0.5 w-6 rounded-full bg-ink/20" />
        </div>
      )}
    </div>
  );
}
