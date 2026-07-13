"use client";

import { useRouter } from "next/navigation";
import { formaterExpediteur } from "@/components/mails/format-expediteur";
import { deposerMessageAssistant } from "@/lib/assistant-handoff";
import type { Mail, ValeurFeedback } from "@/components/mails/types";

/** Formate la date de réception complète ("10 juil., 08:12"). */
function formaterDateHeure(dateReception: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateReception));
}

interface MailDetailProps {
  mail: Mail | null;
  feedbackEnCoursId: string | null;
  onFeedback: (mailId: string, valeur: ValeurFeedback) => void;
}

/**
 * Colonne de droite `/mails` : mail ouvert (résumé IA en tête, transposition
 * de la V0 du mockup). Si `resume_ia` est absent (pas de clé LLM, mode
 * règles), affiche l'extrait brut sans mention d'erreur — comportement
 * nominal du fallback (cf. plan Round 006).
 */
export function MailDetail({ mail, feedbackEnCoursId, onFeedback }: MailDetailProps) {
  const router = useRouter();

  function repondreAvecAssistant() {
    if (!mail) return;
    deposerMessageAssistant("Aide-moi à répondre à ce mail", mail.id);
    router.push("/assistant");
  }

  if (!mail) {
    return (
      <div className="min-w-0 rounded-card bg-card p-6 text-center shadow-card">
        <p className="font-body text-sm text-ink/50">
          Sélectionne un mail pour voir son détail.
        </p>
      </div>
    );
  }

  const enCours = feedbackEnCoursId === mail.id;

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-card bg-card p-6 shadow-card">
      <div className="mb-4 flex items-start gap-3">
        <span className="cta-gradient flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-mono text-sm text-white">
          {mail.score ?? "…"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-extrabold tracking-[-0.02em] break-words text-ink">
            {mail.sujet}
          </h2>
          <p className="font-body text-sm break-words text-ink/50">
            {formaterExpediteur(mail.expediteur)} ·{" "}
            {formaterDateHeure(mail.date_reception)}
          </p>
        </div>
      </div>

      <div className="mb-2 rounded-inner bg-soft px-4 py-3">
        <p className="mb-1 font-mono text-[10px] tracking-[.04em] text-accent uppercase">
          {mail.resume_ia ? "Résumé IA" : "Extrait"}
        </p>
        <p className="font-body text-sm break-words text-ink/80">
          {mail.resume_ia ?? mail.extrait}
        </p>
      </div>

      {mail.raison_score && (
        <p className="mb-4 font-mono text-[10px] tracking-[.04em] break-words text-ink/40 uppercase">
          Score {mail.score ?? "…"} — {mail.raison_score}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-ink/5 pt-4">
        <button
          type="button"
          onClick={repondreAvecAssistant}
          className="cta-gradient rounded-inner px-4 py-2.5 font-display text-sm font-semibold text-white"
        >
          Répondre avec l&apos;assistant
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-[9px] tracking-[.04em] text-ink/30 uppercase">
            Ce mail est
          </span>
          <button
            type="button"
            disabled={enCours}
            onClick={() => onFeedback(mail.id, "important")}
            className="rounded-full border border-accent/30 bg-soft px-3 py-1.5 font-body text-xs text-accent disabled:opacity-50"
          >
            Important
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={() => onFeedback(mail.id, "pas_important")}
            className="rounded-full border border-ink/10 bg-card px-3 py-1.5 font-body text-xs text-ink/50 disabled:opacity-50"
          >
            Pas important
          </button>
        </div>
      </div>
    </div>
  );
}
