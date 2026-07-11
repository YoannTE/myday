// Types snake_case alignés sur le contrat API figé Round 008 (cf. SOP
// api-response-casing-contract) — aucun accès camelCase.

export type RoleTour = "user" | "assistant";

/** Action exécutée par l'assistant (tâche, note, événement...), telle que renvoyée par le backend. */
export interface AssistantActionFaite {
  type: string;
  label: string;
  [cle: string]: unknown;
}

/** Brouillon de mail tel que renvoyé par l'API (contrat figé). */
export interface AssistantDraft {
  draft_id: string;
  to: string;
  subject: string;
  body: string;
}

/** Statuts possibles d'un brouillon après décision (cf. plan Round 008, garantie « au plus un envoi »). */
export type StatutDraft =
  | "pending_review"
  | "sending"
  | "sending_unconfirmed"
  | "sent"
  | "rejected"
  | "expired";

/** État local (UI) d'une carte de validation, dérivé de `AssistantDraft` + décision. */
export interface DraftEtat extends AssistantDraft {
  statut: StatutDraft;
  enCoursDecision: boolean;
  enEdition: boolean;
}

/** Une entrée du fil de conversation, construite localement à partir des réponses API. */
export interface EntreeConversation {
  id: string;
  role: RoleTour;
  contenu: string;
  heure: string;
  actionsDone?: AssistantActionFaite[];
  draft?: DraftEtat;
  clarificationNeeded?: boolean;
  enAttente?: boolean;
}

export interface ConversationCreateResponse {
  conversation_id: string;
}

export interface MessageResponse {
  reply: string;
  actions_done: AssistantActionFaite[];
  draft: AssistantDraft | null;
  clarification_needed: boolean;
}

export interface DraftDecisionResponse {
  statut: StatutDraft;
  sent_gmail_id?: string | null;
}
