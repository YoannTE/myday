import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie standalone requise pour l'image Docker multi-stage (Dockerfile.web)
  output: "standalone",
};

export default nextConfig;
