"use client";

import { Mail, CalendarClock, Sparkles, type LucideIcon } from "lucide-react";
import type { NotificationApi } from "@/components/layout/notification-types";

const ICONE_PAR_TYPE: Record<string, LucideIcon> = {
  mail_important: Mail,
  rappel_evenement: CalendarClock,
  brief_pret: Sparkles,
};

const LIBELLE_PAR_TYPE: Record<string, string> = {
  mail_important: "Mail important",
  rappel_evenement: "Rappel d'événement",
  brief_pret: "Brief prêt",
};

function formaterDate(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

interface NotificationRowProps {
  notification: NotificationApi;
  onSelect: () => void;
}

/**
 * Une ligne de notification dans le dropdown de la cloche (navbar) - icône
 * par type, contenu, date, pastille non-lue. Cliquable : navigue vers la
 * page liée au type (résolu par le parent via `onSelect`).
 */
export function NotificationRow({ notification, onSelect }: NotificationRowProps) {
  const Icone = ICONE_PAR_TYPE[notification.type] ?? Sparkles;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-2.5 rounded-inner px-2.5 py-2 text-left transition-colors hover:bg-soft ${
        notification.lue ? "opacity-60" : ""
      }`}
    >
      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-soft text-accent">
        <Icone className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-sm text-ink">
          {LIBELLE_PAR_TYPE[notification.type] ?? "Notification"}
        </span>
        <span className="block truncate font-body text-xs text-ink/50">
          {notification.contenu}
        </span>
        <span className="mt-0.5 block font-mono text-[9px] tracking-[.04em] text-ink/30 uppercase">
          {formaterDate(notification.date_envoi)}
        </span>
      </span>
      {!notification.lue && (
        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
      )}
    </button>
  );
}
