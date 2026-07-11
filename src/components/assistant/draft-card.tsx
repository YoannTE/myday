"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { DraftCardActions } from "@/components/assistant/draft-card-actions";
import type { DraftEtat } from "@/components/assistant/types";

interface DraftCardProps {
  draft: DraftEtat;
  onApprouver: (edited?: { subject: string; body: string }) => void;
  onRefuser: () => void;
  onBasculerEdition: (enEdition: boolean) => void;
}

const STATUTS_TERMINAUX: DraftEtat["statut"][] = ["sent", "rejected", "expired"];

function libelleStatut(statut: DraftEtat["statut"]): string {
  switch (statut) {
    case "sent":
      return "Mail envoyé";
    case "rejected":
      return "Brouillon refusé";
    case "expired":
      return "Brouillon expiré";
    case "sending_unconfirmed":
      return "Envoi en cours de vérification";
    case "sending":
      return "Envoi en cours…";
    default:
      return "Brouillon en attente de ta validation";
  }
}

/**
 * Carte de validation d'un brouillon de mail (transposition de la V0
 * "Brouillon complet" de `assistant.html`) : destinataire/objet/corps,
 * expiration, boutons Approuver / Modifier / Refuser. Aucun mail ne part
 * sans un clic explicite sur "Approuver".
 */
export function DraftCard({
  draft,
  onApprouver,
  onRefuser,
  onBasculerEdition,
}: DraftCardProps) {
  const [objetEdite, setObjetEdite] = useState(draft.subject);
  const [corpsEdite, setCorpsEdite] = useState(draft.body);

  const estTerminal = STATUTS_TERMINAUX.includes(draft.statut);
  const estGrise = draft.statut === "rejected" || draft.statut === "expired";

  return (
    <div
      className={`w-full max-w-lg overflow-hidden rounded-card border-2 bg-card shadow-card ${
        estGrise ? "border-ink/10 opacity-60" : "border-accent/30"
      }`}
    >
      <div className="flex items-center gap-2 bg-soft px-5 py-3">
        <span className="font-mono text-[10px] tracking-[.04em] text-accent uppercase">
          {libelleStatut(draft.statut)}
        </span>
        {!estTerminal && (
          <span className="ml-auto font-mono text-[9px] tracking-[.04em] text-ink/40 uppercase">
            Expire sous 24 h
          </span>
        )}
      </div>

      <div className="px-5 py-4">
        <p className="mb-1 font-body text-xs text-ink/50">
          À : <span className="text-ink">{draft.to}</span>
        </p>
        {draft.enEdition ? (
          <input
            type="text"
            value={objetEdite}
            onChange={(e) => setObjetEdite(e.target.value)}
            className="mb-3 w-full rounded-inner border border-accent/20 bg-bg px-3 py-1.5 font-body text-xs font-medium text-ink focus:outline-none"
          />
        ) : (
          <p className="mb-3 font-body text-xs text-ink/50">
            Objet : <span className="font-medium text-ink">{draft.subject}</span>
          </p>
        )}

        {draft.enEdition ? (
          <Textarea
            value={corpsEdite}
            onChange={(e) => setCorpsEdite(e.target.value)}
            className="min-h-32 rounded-inner bg-bg px-4 py-3 font-body text-sm text-ink/80"
          />
        ) : (
          <div className="rounded-inner bg-bg px-4 py-3 font-body text-sm leading-relaxed whitespace-pre-line text-ink/80">
            {draft.body}
          </div>
        )}
      </div>

      {!estTerminal && (
        <DraftCardActions
          enEdition={draft.enEdition}
          enCoursDecision={draft.enCoursDecision}
          onApprouver={() =>
            draft.enEdition
              ? onApprouver({ subject: objetEdite, body: corpsEdite })
              : onApprouver()
          }
          onAnnulerEdition={() => {
            setObjetEdite(draft.subject);
            setCorpsEdite(draft.body);
            onBasculerEdition(false);
          }}
          onEntrerEdition={() => onBasculerEdition(true)}
          onRefuser={onRefuser}
        />
      )}
    </div>
  );
}
