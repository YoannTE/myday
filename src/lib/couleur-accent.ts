// Couleur d'accent de l'interface : bandeaux de section, boutons, liens,
// graphiques du budget. Tout passe déjà par le jeton `--accent` de
// `globals.css` ; on ne fait ici que poser l'attribut `html[data-accent]`.
//
// Même dispositif que le thème clair/sombre : la source de vérité est le
// profil (PATCH /api/preferences), avec un cache localStorage pour que le
// script anti-flash de `layout.tsx` puisse appliquer la couleur AVANT le
// premier rendu. Sans ça, l'app s'ouvrirait en bleu puis basculerait.
//
// Palette fermée, et non un sélecteur libre : chaque valeur a été vérifiée sur
// trois contrastes (texte blanc posé dessus, lisibilité sur le fond clair, et
// sur le fond noir du mode sombre). Un choix libre produirait vite des
// combinaisons illisibles, du jaune sous du texte blanc par exemple.

export const COULEURS_ACCENT = [
  { cle: "bleu", libelle: "Bleu", echantillon: "#2350e6" },
  { cle: "indigo", libelle: "Indigo", echantillon: "#7d4cf0" },
  { cle: "rose", libelle: "Rose", echantillon: "#e40c66" },
  { cle: "turquoise", libelle: "Turquoise", echantillon: "#047f98" },
  { cle: "ardoise", libelle: "Ardoise", echantillon: "#5f7695" },
] as const;

export type CouleurAccent = (typeof COULEURS_ACCENT)[number]["cle"];

export const COULEUR_PAR_DEFAUT: CouleurAccent = "bleu";

const CLE_STOCKAGE = "myday-accent";

export function estCouleurAccent(valeur: unknown): valeur is CouleurAccent {
  return COULEURS_ACCENT.some((couleur) => couleur.cle === valeur);
}

/** Applique la couleur au DOM et la met en cache pour le prochain démarrage. */
export function appliquerCouleurAccent(couleur: CouleurAccent): void {
  // Le bleu est la valeur du `:root` : pas d'attribut à poser, ce qui garde
  // le DOM propre pour la grande majorité des utilisateurs.
  if (couleur === COULEUR_PAR_DEFAUT) {
    document.documentElement.removeAttribute("data-accent");
  } else {
    document.documentElement.setAttribute("data-accent", couleur);
  }
  try {
    window.localStorage.setItem(CLE_STOCKAGE, couleur);
  } catch {
    // Stockage indisponible : la couleur vaut pour la visite en cours.
  }
}

/** Lit la couleur actuellement appliquée au DOM. */
export function lireCouleurDom(): CouleurAccent {
  const valeur = document.documentElement.getAttribute("data-accent");
  return estCouleurAccent(valeur) ? valeur : COULEUR_PAR_DEFAUT;
}
