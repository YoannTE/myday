"use client";

import { useEffect } from "react";
import { apiCall } from "@/lib/api";
import { appliquerTheme, lireThemeDom, type Theme } from "@/lib/theme";

/**
 * Synchronise le thème du profil (source de vérité côté serveur) avec le DOM
 * au chargement de l'application. Le script anti-flash de `layout.tsx` a déjà
 * appliqué le thème mis en cache dans localStorage ; ce composant corrige le
 * cas où ce cache est absent ou périmé (nouvel appareil, PWA réinstallée) en
 * réappliquant le thème choisi par l'utilisateur. Ne rend rien.
 */
export function ThemeSync() {
  useEffect(() => {
    apiCall<{ data: { theme: Theme } }>("/api/preferences")
      .then((reponse) => {
        const theme = reponse.data.theme;
        if (theme && theme !== lireThemeDom()) {
          appliquerTheme(theme);
        }
      })
      .catch(() => {
        // Préférences indisponibles : on garde le thème du cache local.
      });
  }, []);

  return null;
}
