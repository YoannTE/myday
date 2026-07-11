// Les échecs réseau du fetch natif (backend FastAPI injoignable, ex. en dev
// pendant que le backend n'est pas encore démarré) remontent en anglais et
// sans code stable ("Failed to fetch", "fetch failed"). On les mappe vers un
// message français générique - cf. SOP third-party-error-i18n : mapper par
// motif stable, jamais afficher le texte brut du SDK/runtime à l'écran.
const MOTIFS_ERREUR_RESEAU = /failed to fetch|fetch failed|networkerror|load failed/i;

export function messageErreurGoogle(erreur: unknown, repli: string): string {
  if (erreur instanceof Error) {
    if (MOTIFS_ERREUR_RESEAU.test(erreur.message)) {
      return "Impossible de contacter le serveur MyDay. Vérifie ta connexion et réessaie.";
    }
    return erreur.message;
  }
  return repli;
}
