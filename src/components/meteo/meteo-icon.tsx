// Mapping des codes météo WMO (Open-Meteo) vers une icône lucide + un libellé
// français. Table de correspondance officielle : https://open-meteo.com/en/docs.
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from "lucide-react";

interface MeteoMeta {
  Icone: LucideIcon;
  libelle: string;
}

export function meteoMeta(code: number): MeteoMeta {
  if (code === 0) return { Icone: Sun, libelle: "Ciel clair" };
  if (code === 1) return { Icone: Sun, libelle: "Plutôt clair" };
  if (code === 2) return { Icone: CloudSun, libelle: "Partiellement nuageux" };
  if (code === 3) return { Icone: Cloud, libelle: "Couvert" };
  if (code === 45 || code === 48) return { Icone: CloudFog, libelle: "Brouillard" };
  if (code >= 51 && code <= 57) return { Icone: CloudDrizzle, libelle: "Bruine" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { Icone: CloudRain, libelle: "Pluie" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { Icone: CloudSnow, libelle: "Neige" };
  if (code >= 95) return { Icone: CloudLightning, libelle: "Orage" };
  return { Icone: Cloud, libelle: "Variable" };
}
