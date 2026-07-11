// Libellés français des types d'événements du journal d'usage (contenu non
// technique, admin-only). Fallback générique pour un type non listé : on ne
// bloque jamais l'affichage si un nouveau type apparaît côté backend.
const LIBELLES_PAR_TYPE: Record<string, string> = {
  dashboard_opened: "Cockpit ouvert",
  task_completed: "Tâche terminée",
  mail_replied: "Réponse à un mail",
  assistant_message_sent: "Message à l'assistant",
  brief_generated: "Brief généré",
};

export function libelleTypeEvenement(type: string): string {
  const libelleConnu = LIBELLES_PAR_TYPE[type];
  if (libelleConnu) return libelleConnu;
  return type
    .split("_")
    .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1))
    .join(" ");
}

export function formaterCoutUsd(montant: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(montant);
}
