import { DraftCard } from "@/components/assistant/draft-card";
import type { DraftEtat, EntreeConversation } from "@/components/assistant/types";

interface MessageBubbleProps {
  entree: EntreeConversation;
  onApprouverDraft: (
    draftId: string,
    edited?: { subject: string; body: string },
  ) => void;
  onRefuserDraft: (draftId: string) => void;
  onBasculerEditionDraft: (draftId: string, enEdition: boolean) => void;
}

/**
 * Une bulle du fil (transposition de la V0 "Bulles + actions" de
 * `assistant.html`) : bulle utilisateur (dégradé, alignée à droite) ou
 * bulle assistant (blanche, alignée à gauche) avec badges d'actions et,
 * le cas échéant, la carte de validation d'un brouillon de mail en dessous.
 */
export function MessageBubble({
  entree,
  onApprouverDraft,
  onRefuserDraft,
  onBasculerEditionDraft,
}: MessageBubbleProps) {
  if (entree.role === "user") {
    return (
      <div className="self-end max-w-md rounded-card cta-gradient px-5 py-3 text-white">
        <p className="font-body text-sm">{entree.contenu}</p>
      </div>
    );
  }

  const draft: DraftEtat | undefined = entree.draft;

  return (
    <div className="self-start flex w-full max-w-lg flex-col gap-3">
      <div>
        {entree.clarificationNeeded && (
          <p className="mb-1 font-mono text-[9px] tracking-[.04em] text-accent uppercase">
            L&apos;assistant a besoin d&apos;une précision
          </p>
        )}
        <div className="rounded-card bg-card px-5 py-3 shadow-card">
          <p className="font-body text-sm text-ink">
            {entree.enAttente ? "…" : entree.contenu}
          </p>
        </div>
        {!entree.enAttente &&
          entree.actionsDone &&
          entree.actionsDone.length > 0 && (
            <div className="mt-2 ml-1 flex flex-wrap items-center gap-2">
              {entree.actionsDone.map((action, index) => (
                <span
                  key={`${entree.id}-${index}`}
                  className="rounded-full bg-soft px-2 py-0.5 font-mono text-[9px] tracking-[.04em] text-accent uppercase"
                >
                  ✓ {action.label}
                </span>
              ))}
              <span className="font-mono text-[9px] tracking-[.04em] text-ink/30 uppercase">
                {entree.heure}
              </span>
            </div>
          )}
      </div>

      {draft && (
        <DraftCard
          draft={draft}
          onApprouver={(edited) => onApprouverDraft(draft.draft_id, edited)}
          onRefuser={() => onRefuserDraft(draft.draft_id)}
          onBasculerEdition={(enEdition) =>
            onBasculerEditionDraft(draft.draft_id, enEdition)
          }
        />
      )}
    </div>
  );
}
