"use client";

import { useEffect } from "react";
import { apiCall } from "@/lib/api";
import { appliquerTheme, lireThemeDom, type Theme } from "@/lib/theme";
import {
  appliquerCouleurAccent,
  estCouleurAccent,
  lireCouleurDom,
} from "@/lib/couleur-accent";

/**
 * Synchronise le thème et la couleur d'accent du profil (source de vérité côté
 * serveur) avec le DOM
 * au chargement de l'application. Le script anti-flash de `layout.tsx` a déjà
 * appliqué le thème mis en cache dans localStorage ; ce composant corrige le
 * cas où ce cache est absent ou périmé (nouvel appareil, PWA réinstallée) en
 * réappliquant le thème choisi par l'utilisateur. Ne rend rien.
 */
export function ThemeSync() {
  useEffect(() => {
    apiCall<{ data: { theme: Theme; couleur_accent?: string } }>(
      "/api/preferences",
    )
      .then((reponse) => {
        const theme = reponse.data.theme;
        if (theme && theme !== lireThemeDom()) {
          appliquerTheme(theme);
        }
        const couleur = reponse.data.couleur_accent;
        if (estCouleurAccent(couleur) && couleur !== lireCouleurDom()) {
          appliquerCouleurAccent(couleur);
        }
      })
      .catch(() => {
        // Préférences indisponibles : on garde ce que le cache local a posé.
      });
  }, []);

  return null;
}
