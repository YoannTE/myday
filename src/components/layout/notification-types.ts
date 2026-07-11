/**
 * Types snake_case pour la conso de `/api/notifications*` (contrat figé
 * Round 009, plan.md). Ne JAMAIS renommer en camelCase - cf. SOP
 * `general-api-response-casing-contract`.
 */

export type NotificationType = "mail_important" | "rappel_evenement" | "brief_pret";

export interface NotificationApi {
  id: string;
  type: NotificationType;
  contenu: string;
  ref_id: string;
  lue: boolean;
  date_envoi: string;
}
