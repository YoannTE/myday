import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie standalone requise pour l'image Docker multi-stage (Dockerfile.web)
  output: "standalone",

  // Sécurité : force le navigateur à toujours utiliser HTTPS pour le domaine
  // (et ses sous-domaines) après la première visite. Évite tout passage par
  // http (et donc l'affichage « Non sécurisé ») quand quelqu'un tape juste
  // « myday.aevio-one.com ». Le HTTP redirige déjà vers HTTPS (308) côté proxy.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
