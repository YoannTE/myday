// Pont sessionStorage entre la navbar (barre "Dis-moi quoi faire...") ou le
// bouton "Répondre avec l'assistant" (page mails) et la page `/assistant`.
//
// Le message tapé par l'utilisateur ne doit JAMAIS transiter par l'URL (PII,
// correction #14 round 008) : il est déposé en sessionStorage, lu UNE SEULE
// FOIS au montage de `/assistant`, puis retiré.

const CLE_MESSAGE = "myday-assistant-message";
const CLE_MAIL_ID = "myday-assistant-mail-id";

/** Dépose un message d'amorce (et éventuellement le mail référencé) avant de naviguer vers `/assistant`. */
export function deposerMessageAssistant(message: string, mailId?: string): void {
  window.sessionStorage.setItem(CLE_MESSAGE, message);
  if (mailId) {
    window.sessionStorage.setItem(CLE_MAIL_ID, mailId);
  } else {
    window.sessionStorage.removeItem(CLE_MAIL_ID);
  }
}

export interface MessageAssistantDepose {
  message: string | null;
  mailId: string | null;
}

/** Lit puis vide le message/mail en attente - à appeler UNE SEULE FOIS au montage de `/assistant`. */
export function lireEtViderMessageAssistant(): MessageAssistantDepose {
  const message = window.sessionStorage.getItem(CLE_MESSAGE);
  const mailId = window.sessionStorage.getItem(CLE_MAIL_ID);
  window.sessionStorage.removeItem(CLE_MESSAGE);
  window.sessionStorage.removeItem(CLE_MAIL_ID);
  return { message, mailId };
}
