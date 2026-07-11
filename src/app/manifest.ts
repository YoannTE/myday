import type { MetadataRoute } from "next";

/**
 * Manifest PWA (route Metadata → sert `/manifest.webmanifest`, auto-injecté
 * dans le `<head>` par Next.js — ne PAS ajouter de `<link rel="manifest">`
 * manuel dans layout.tsx).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyDay",
    short_name: "MyDay",
    description:
      "MyDay réunit ton planning, tes tâches, tes notes et tes mails importants dans un seul cockpit.",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F7FB",
    theme_color: "#2350E6",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
