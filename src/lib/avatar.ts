// Initiale affichée dans les cercles avatar (navbar, réglages, liste des
// comptes admin) - première lettre du nom, ou de l'email à défaut.
export function initialeAvatar(
  name: string | null | undefined,
  email: string,
): string {
  const source = name?.trim() || email;
  return source.charAt(0).toUpperCase();
}
