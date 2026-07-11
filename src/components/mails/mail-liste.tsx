"use client";

import { MailItem } from "@/components/mails/mail-item";
import type { FiltreMail, Mail } from "@/components/mails/types";

interface MailListeProps {
  mails: Mail[];
  ecartes: number;
  filtre: FiltreMail;
  mailSelectionneId: string | null;
  onSelectionner: (mail: Mail) => void;
  onVoirEcartes: () => void;
}

/**
 * Colonne de gauche `/mails` : liste des mails scorés (déjà triés score
 * desc par l'API) + compteur des mails écartés par le tri (lien vers le
 * filtre « Tous »).
 */
export function MailListe({
  mails,
  ecartes,
  filtre,
  mailSelectionneId,
  onSelectionner,
  onVoirEcartes,
}: MailListeProps) {
  return (
    <div className="flex flex-col gap-3 self-start">
      {mails.map((mail) => (
        <MailItem
          key={mail.id}
          mail={mail}
          selectionne={mail.id === mailSelectionneId}
          onSelectionner={onSelectionner}
        />
      ))}
      {filtre === "important" && ecartes > 0 && (
        <button
          type="button"
          onClick={onVoirEcartes}
          className="mt-2 text-center font-mono text-[10px] tracking-[.04em] text-ink/30 uppercase hover:text-accent"
        >
          {ecartes} mail{ecartes > 1 ? "s" : ""} écarté{ecartes > 1 ? "s" : ""} par
          le tri · voir
        </button>
      )}
    </div>
  );
}
