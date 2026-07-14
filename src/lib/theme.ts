// Application du thème (clair / sombre) côté navigateur.
//
// Le thème est la source de vérité côté profil (PATCH /api/preferences), mais
// il est aussi mis en cache dans localStorage sous « myday-theme » pour que le
// script anti-flash de `layout.tsx` puisse l'appliquer AVANT le premier rendu
// (sinon flash de thème clair au démarrage de la PWA). Le mode sombre est
// porté par l'attribut `html[data-mode="dark"]`.

export type Theme = "clair" | "sombre";

const CLE_STOCKAGE = "myday-theme";

/** Applique le thème au DOM et le met en cache pour le prochain démarrage. */
export function appliquerTheme(theme: Theme): void {
  if (theme === "sombre") {
    document.documentElement.setAttribute("data-mode", "dark");
    window.localStorage.setItem(CLE_STOCKAGE, "dark");
  } else {
    document.documentElement.removeAttribute("data-mode");
    window.localStorage.setItem(CLE_STOCKAGE, "light");
  }
}

/** Lit le thème actuellement appliqué au DOM. */
export function lireThemeDom(): Theme {
  return document.documentElement.getAttribute("data-mode") === "dark"
    ? "sombre"
    : "clair";
}
