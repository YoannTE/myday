// Mappe une erreur `apiCall` vers un message français affichable - reprend
// le pattern de `src/components/reglages/google/google-errors.ts` (SOP
// third-party-error-i18n) pour les domaines hors Google (tâches, cockpit,
// planning, notes) : ne jamais afficher un message brut du fetch natif.
const MOTIFS_ERREUR_RESEAU =
  /failed to fetch|fetch failed|networkerror|load failed/i;

export function messageErreurApi(erreur: unknown, repli: string): string {
  if (erreur instanceof Error) {
    if (MOTIFS_ERREUR_RESEAU.test(erreur.message)) {
      return "Impossible de contacter le serveur MyDay. Vérifie ta connexion et réessaie.";
    }
    return erreur.message;
  }
  return repli;
}
