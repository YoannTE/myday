"use client";

import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { apiCall, ApiError } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import type {
  DraftDecisionResponse,
  DraftEtat,
  EntreeConversation,
} from "@/components/assistant/types";

type SetEntrees = Dispatch<SetStateAction<EntreeConversation[]>>;

/**
 * Décision (Approuver/Modifier/Refuser) sur un brouillon de mail —
 * `POST /api/assistant/drafts/{id}/decision`. Un mail n'est envoyé QUE sur
 * "approve" explicite (règle métier absolue, cf. plan Round 008) ; gère
 * 403 (envoi désactivé), 409 (déjà traité) et les statuts de retour ambigus
 * (`sending_unconfirmed`).
 */
export function useDraftDecision(
  entrees: EntreeConversation[],
  setEntrees: SetEntrees,
) {
  function mettreAJourDraft(draftId: string, maj: Partial<DraftEtat>) {
    setEntrees((precedentes) =>
      precedentes.map((entree) =>
        entree.draft?.draft_id === draftId
          ? { ...entree, draft: { ...entree.draft, ...maj } }
          : entree,
      ),
    );
  }

  function basculerEditionDraft(draftId: string, enEdition: boolean) {
    mettreAJourDraft(draftId, { enEdition });
  }

  async function approuverDraft(
    draftId: string,
    edited?: { subject: string; body: string },
  ) {
    mettreAJourDraft(draftId, { enCoursDecision: true });
    try {
      const draftActuel = entrees.find((e) => e.draft?.draft_id === draftId)?.draft;
      const body: Record<string, unknown> = { decision: "approve" };
      if (edited && draftActuel) {
        body.edited = {
          to: draftActuel.to,
          subject: edited.subject,
          body: edited.body,
        };
      }
      const reponse = await apiCall<{ data: DraftDecisionResponse }>(
        `/api/assistant/drafts/${draftId}/decision`,
        { method: "POST", body },
      );
      mettreAJourDraft(draftId, {
        statut: reponse.data.statut,
        enCoursDecision: false,
        enEdition: false,
        ...(edited ? { subject: edited.subject, body: edited.body } : {}),
      });
      if (reponse.data.statut === "sent") {
        toast.success("Mail envoyé ✓");
      } else if (reponse.data.statut === "sending_unconfirmed") {
        toast.error(
          "L'envoi n'a pas pu être confirmé — réessaie dans un instant.",
        );
      } else {
        toast.error("L'envoi a échoué, tu peux réessayer.");
      }
    } catch (erreur) {
      mettreAJourDraft(draftId, { enCoursDecision: false });
      if (erreur instanceof ApiError && erreur.status === 403) {
        toast.error("L'envoi de mails est désactivé pour le moment.");
      } else if (erreur instanceof ApiError && erreur.status === 409) {
        toast.error("Ce brouillon a déjà été traité.");
      } else {
        toast.error(messageErreurApi(erreur, "Impossible d'envoyer ce mail."));
      }
    }
  }

  async function refuserDraft(draftId: string) {
    mettreAJourDraft(draftId, { enCoursDecision: true });
    try {
      const reponse = await apiCall<{ data: DraftDecisionResponse }>(
        `/api/assistant/drafts/${draftId}/decision`,
        { method: "POST", body: { decision: "reject" } },
      );
      mettreAJourDraft(draftId, {
        statut: reponse.data.statut,
        enCoursDecision: false,
      });
      toast.success("Brouillon refusé.");
    } catch (erreur) {
      mettreAJourDraft(draftId, { enCoursDecision: false });
      if (erreur instanceof ApiError && erreur.status === 409) {
        toast.error("Ce brouillon a déjà été traité.");
      } else {
        toast.error(
          messageErreurApi(erreur, "Impossible de refuser ce brouillon."),
        );
      }
    }
  }

  return { approuverDraft, refuserDraft, basculerEditionDraft };
}
