"use client";

import { cn } from "@/lib/utils";
import { formaterExpediteur } from "@/components/mails/format-expediteur";
import type { Mail } from "@/components/mails/types";

/** Formate la date de réception en heure ("08:12"), "Hier" ou date courte. */
function formaterHeureReception(dateReception: string): string {
  const date = new Date(dateReception);
  const aujourdHui = new Date();
  if (date.toDateString() === aujourdHui.toDateString()) {
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
  const hier = new Date(aujourdHui);
  hier.setDate(hier.getDate() - 1);
  if (date.toDateString() === hier.toDateString()) return "Hier";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(date);
}

interface MailItemProps {
  mail: Mail;
  selectionne: boolean;
  onSelectionner: (mail: Mail) => void;
}

/** Ligne de la liste des mails (`/mails`) : badge de score, expéditeur, sujet. */
export function MailItem({ mail, selectionne, onSelectionner }: MailItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelectionner(mail)}
      className={cn(
        "flex items-center gap-3 rounded-card bg-card px-4 py-3 text-left shadow-card transition-colors",
        selectionne && "border border-accent/30",
        mail.repondu && "opacity-70",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-mono text-xs",
          mail.repondu ? "bg-soft text-accent" : "cta-gradient text-white",
        )}
      >
        {mail.score ?? "…"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-semibold text-ink">
          {formaterExpediteur(mail.expediteur)}
        </p>
        <p className="truncate font-body text-xs text-ink/50">
          {mail.sujet}
          {mail.repondu ? " ✓ répondu" : ""}
        </p>
      </div>
      <span className="ml-auto flex-shrink-0 font-mono text-[9px] tracking-[.04em] text-ink/30 uppercase">
        {formaterHeureReception(mail.date_reception)}
      </span>
    </button>
  );
}
