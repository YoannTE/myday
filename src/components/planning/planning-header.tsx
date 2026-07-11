"use client";

import Link from "next/link";
import { EventFormDialog } from "@/components/planning/event-form-dialog";

interface PlanningHeaderProps {
  libellePlage: string;
  onSemainePrecedente: () => void;
  onSemaineSuivante: () => void;
  onSuccess: () => void;
}

export function PlanningHeader({
  libellePlage,
  onSemainePrecedente,
  onSemaineSuivante,
  onSuccess,
}: PlanningHeaderProps) {
  return (
    <div>
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-2 font-body text-sm text-ink/50 transition-colors hover:text-accent"
      >
        ← Cockpit
      </Link>
      <div className="fade-in mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-xl font-extrabold tracking-[-0.02em] text-ink md:text-2xl">
          Planning
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onSemainePrecedente}
            aria-label="Semaine précédente"
            className="flex h-8 w-8 items-center justify-center rounded-inner bg-card text-ink/60 shadow-card"
          >
            ‹
          </button>
          <span className="px-2 font-mono text-xs tracking-[.04em] text-ink/60 uppercase">
            {libellePlage}
          </span>
          <button
            type="button"
            onClick={onSemaineSuivante}
            aria-label="Semaine suivante"
            className="flex h-8 w-8 items-center justify-center rounded-inner bg-card text-ink/60 shadow-card"
          >
            ›
          </button>
        </div>
        <EventFormDialog
          onSuccess={onSuccess}
          trigger={
            <button
              type="button"
              className="cta-gradient rounded-inner px-4 py-2 font-display text-sm font-semibold text-white"
            />
          }
        >
          + Événement
        </EventFormDialog>
      </div>
    </div>
  );
}
