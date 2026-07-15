"use client";

import { useEffect, useState } from "react";

function calculerMentionExpiration(expiresAt: string): string {
  const joursRestants = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );
  if (joursRestants <= 0) return "expire aujourd'hui";
  if (joursRestants === 1) return "expire dans 1 jour";
  return `expire dans ${joursRestants} jours`;
}

// Bandeau d'invitation valide - transposition fidèle de la variante
// « Bandeau en tête » du mockup login.html.
export function InvitationBanner({
  inviterFirstName,
  expiresAt,
}: {
  inviterFirstName: string;
  expiresAt: string;
}) {
  // Le calcul du délai restant dépend de l'heure courante (Date.now) : il ne
  // peut pas être effectué pendant le rendu (fonction impure), on le calcule
  // donc après montage.
  const [mentionExpiration, setMentionExpiration] = useState("");

  useEffect(() => {
    // Synchronise un affichage avec l'heure courante (Date.now, impure) :
    // impossible à calculer pendant le rendu, d'où l'effet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMentionExpiration(calculerMentionExpiration(expiresAt));
  }, [expiresAt]);

  return (
    <div className="fade-in delay-1 mb-8 flex items-center gap-3 rounded-inner bg-soft px-5 py-4">
      <span className="cta-gradient flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-display font-semibold text-white">
        {inviterFirstName.charAt(0).toUpperCase()}
      </span>
      <div>
        <p className="font-body text-sm text-ink">
          <strong className="font-semibold">{inviterFirstName}</strong>{" "}
          t&apos;a invité·e sur MyDay
        </p>
        <p className="mt-0.5 font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
          Invitation valide{mentionExpiration ? ` · ${mentionExpiration}` : ""}
        </p>
      </div>
    </div>
  );
}
