import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  return session.user;
}

// Garde de page reservee a l'administrateur. Renvoie l'utilisateur si role
// admin, sinon redirige vers l'accueil (defense en profondeur : les endpoints
// FastAPI appliquent aussi `require_admin`).
export async function requireAdmin() {
  const user = await requireUser();
  if ((user as { role?: string }).role !== "admin") redirect("/");
  return user;
}
