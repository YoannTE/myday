/**
 * Helper pour appeler l'API FastAPI depuis le frontend.
 * Envoie automatiquement les cookies (better-auth.session_token) pour l'auth.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: Record<string, unknown> | FormData;
};

/**
 * Erreur d'appel API qui conserve le code HTTP - utile quand un composant
 * doit distinguer un statut précis (ex. 429 anti-spam) d'une erreur générique.
 * Reste un `Error` classique pour tout code qui fait `instanceof Error`.
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiCall<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options;

  const isFormData = body instanceof FormData;
  const init: RequestInit = {
    credentials: "include", // envoie les cookies cross-origin
    ...rest,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  };

  const res = await fetch(`${API_URL}${path}`, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(
      data?.detail ?? data?.error ?? `HTTP ${res.status}`,
      res.status,
    );
  }
  return data as T;
}
