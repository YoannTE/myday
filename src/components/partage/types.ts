// Types snake_case alignés sur les réponses API FastAPI (`/api/contacts`,
// `/api/partages`) - contrat backend déjà figé et testé.

export type StatutContact = "en_attente" | "accepte";
export type DirectionContact = "envoyee" | "recue";

/** Représentation légère de l'autre utilisateur d'un contact ou d'un partage. */
export interface UtilisateurLite {
  nom: string;
  email: string;
}

/** Lien entre deux comptes - `GET/POST /api/contacts`. */
export interface Contact {
  id: string;
  statut: StatutContact;
  direction: DirectionContact;
  autre_utilisateur: UtilisateurLite;
  created_at: string;
}

export type ElementType = "event" | "task" | "note";

/** Partage d'un élément précis avec un contact - `GET/POST /api/partages`. */
export interface Partage {
  id: string;
  element_type: ElementType;
  element_id: string;
  cible: UtilisateurLite;
  created_at: string;
}
