"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiCall, ApiError } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { lireEtViderMessageAssistant } from "@/lib/assistant-handoff";
import type {
  AssistantDraft,
  ConversationCreateResponse,
  DraftEtat,
  EntreeConversation,
  MessageResponse,
} from "@/components/assistant/types";

function heureActuelle(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function idAleatoire(): string {
  return Math.random().toString(36).slice(2);
}

function draftDepuisReponse(draft: AssistantDraft): DraftEtat {
  return {
    ...draft,
    statut: "pending_review",
    enCoursDecision: false,
    enEdition: false,
  };
}

/**
 * Gère le cycle de vie de la conversation `/assistant` : création
 * systématique d'une NOUVELLE conversation au montage (correction #15 round
 * 008), envoi automatique du message déposé en sessionStorage s'il existe,
 * puis envoi manuel via la barre de saisie. Le fil affiché est construit
 * localement à partir des réponses de `POST /api/assistant/message` (pas de
 * GET /conversations/{id}, contrat volontairement simple).
 */
export function useAssistantConversation() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [entrees, setEntrees] = useState<EntreeConversation[]>([]);
  const [erreurFatale, setErreurFatale] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const initialise = useRef(false);

  async function envoyerVers(idConv: string, texte: string, mailId?: string) {
    const idAssistantEnAttente = idAleatoire();
    setEntrees((precedentes) => [
      ...precedentes,
      { id: idAleatoire(), role: "user", contenu: texte, heure: heureActuelle() },
      {
        id: idAssistantEnAttente,
        role: "assistant",
        contenu: "",
        heure: heureActuelle(),
        enAttente: true,
      },
    ]);
    setEnvoiEnCours(true);
    try {
      const body: Record<string, unknown> = {
        conversation_id: idConv,
        message: texte,
      };
      if (mailId) body.context_ref = { mail_id: mailId };
      const reponse = await apiCall<{ data: MessageResponse }>(
        "/api/assistant/message",
        { method: "POST", body },
      );
      const { reply, actions_done, draft, clarification_needed } = reponse.data;
      setEntrees((precedentes) =>
        precedentes.map((entree) =>
          entree.id === idAssistantEnAttente
            ? {
                ...entree,
                contenu: reply,
                enAttente: false,
                actionsDone: actions_done,
                draft: draft ? draftDepuisReponse(draft) : undefined,
                clarificationNeeded: clarification_needed,
              }
            : entree,
        ),
      );
    } catch (erreur) {
      setEntrees((precedentes) =>
        precedentes.filter((e) => e.id !== idAssistantEnAttente),
      );
      if (erreur instanceof ApiError && erreur.status === 429) {
        toast.error(
          "Doucement, une seconde ! Attends un peu avant de renvoyer un message.",
        );
      } else {
        toast.error(messageErreurApi(erreur, "L'assistant n'a pas pu répondre."));
      }
    } finally {
      setEnvoiEnCours(false);
    }
  }

  useEffect(() => {
    if (initialise.current) return;
    initialise.current = true;

    async function initialiser() {
      const { message, mailId } = lireEtViderMessageAssistant();
      try {
        const reponse = await apiCall<{ data: ConversationCreateResponse }>(
          "/api/assistant/conversations",
          { method: "POST" },
        );
        const idConv = reponse.data.conversation_id;
        setConversationId(idConv);
        if (message) {
          await envoyerVers(idConv, message, mailId ?? undefined);
        }
      } catch (erreur) {
        setErreurFatale(
          messageErreurApi(
            erreur,
            "Impossible de démarrer une conversation avec l'assistant.",
          ),
        );
      }
    }

    initialiser();
  }, []);

  async function envoyerMessage(texte: string) {
    if (!conversationId) return;
    await envoyerVers(conversationId, texte);
  }

  return {
    conversationId,
    entrees,
    setEntrees,
    erreurFatale,
    envoiEnCours,
    envoyerMessage,
  };
}
