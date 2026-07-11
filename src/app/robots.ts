import type { MetadataRoute } from "next";

/**
 * MyDay est une application privée, sur invitation. On interdit explicitement
 * l'indexation par les moteurs de recherche : aucune page ne doit apparaître
 * dans les résultats publics.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
