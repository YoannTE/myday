"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Composer } from "@/components/assistant/composer";
import { MessageBubble } from "@/components/assistant/message-bubble";
import { useAssistantConversation } from "@/components/assistant/use-assistant-conversation";
import { useDraftDecision } from "@/components/assistant/use-draft-decision";

/**
 * Page `/assistant` (F9) : chat avec l'assistant IA (tâches, notes,
 * événements, brouillons de mail à valider). Transposition de
 * `.project/mockups/pages/assistant.html` (V0 "Bulles + actions" /
 * "Brouillon complet" / "Barre + suggestions").
 */
export function AssistantClient() {
  const {
    conversationId,
    entrees,
    setEntrees,
    erreurFatale,
    envoiEnCours,
    envoyerMessage,
  } = useAssistantConversation();
  const { approuverDraft, refuserDraft, basculerEditionDraft } =
    useDraftDecision(entrees, setEntrees);

  if (erreurFatale) {
    return (
      <div className="rounded-card bg-card p-6 text-center shadow-card">
        <p className="font-body text-sm text-ink/60">{erreurFatale}</p>
      </div>
    );
  }

  if (!conversationId) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="ml-auto h-16 w-2/3 rounded-card" />
        <Skeleton className="h-20 w-2/3 rounded-card" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {entrees.length === 0 && (
          <p className="rounded-card bg-card p-6 text-center font-body text-sm text-ink/50 shadow-card">
            Dis-moi ce que tu veux faire — une note, un rendez-vous, une
            tâche, ou une réponse à préparer pour un mail.
          </p>
        )}
        {entrees.map((entree) => (
          <MessageBubble
            key={entree.id}
            entree={entree}
            onApprouverDraft={approuverDraft}
            onRefuserDraft={refuserDraft}
            onBasculerEditionDraft={basculerEditionDraft}
          />
        ))}
      </div>
      <Composer disabled={envoiEnCours} onEnvoyer={envoyerMessage} />
    </>
  );
}
