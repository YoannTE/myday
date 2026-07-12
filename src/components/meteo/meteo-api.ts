// Accès au service météo gratuit Open-Meteo (aucune clé API, CORS ouvert),
// appelé directement depuis le navigateur : géocodage d'une ville puis
// prévisions sur 7 jours. Voir https://open-meteo.com/.

export interface MeteoJour {
  date: string; // date ISO (YYYY-MM-DD), le 1er élément est le jour courant
  code: number; // code météo WMO (mappé en icône dans meteo-icon)
  tempMax: number;
  tempMin: number;
}

export interface MeteoResultat {
  villeResolue: string; // nom normalisé renvoyé par le géocodage
  jours: MeteoJour[];
}

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/** Levée quand la ville saisie ne correspond à aucun résultat de géocodage. */
export class MeteoIntrouvableError extends Error {}

async function geocoder(
  ville: string,
): Promise<{ lat: number; lon: number; nom: string }> {
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(
    ville,
  )}&count=1&language=fr&format=json`;
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error("Échec du géocodage");
  const data = await reponse.json();
  const premier = data?.results?.[0];
  if (!premier) throw new MeteoIntrouvableError(ville);
  return {
    lat: premier.latitude,
    lon: premier.longitude,
    nom: premier.name ?? ville,
  };
}

async function previsions(lat: number, lon: number): Promise<MeteoJour[]> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "7",
  });
  const reponse = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!reponse.ok) throw new Error("Échec des prévisions");
  const data = await reponse.json();
  const quotidien = data.daily;
  return quotidien.time.map((date: string, i: number) => ({
    date,
    code: quotidien.weather_code[i],
    tempMax: Math.round(quotidien.temperature_2m_max[i]),
    tempMin: Math.round(quotidien.temperature_2m_min[i]),
  }));
}

/** Charge la météo 7 jours d'une ville (géocodage puis prévisions). */
export async function chargerMeteo(ville: string): Promise<MeteoResultat> {
  const { lat, lon, nom } = await geocoder(ville);
  const jours = await previsions(lat, lon);
  return { villeResolue: nom, jours };
}
