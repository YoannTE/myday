/**
 * Extrait un nom lisible depuis un en-tête `From` brut ("Nom <email>" ou
 * simplement "email"). `mails.expediteur` stocke le From brut (cf. plan
 * Round 006, correction arch H1) — purement présentationnel, ne modifie pas
 * la donnée sous-jacente.
 */
export function formaterExpediteur(expediteur: string): string {
  const correspondance = expediteur.match(/^(.*?)<(.+)>$/);
  if (correspondance) {
    const nom = correspondance[1].trim().replace(/^"|"$/g, "");
    return nom || correspondance[2].trim();
  }
  return expediteur.trim();
}
