/**
 * Logo MyDay « La fusion » : monogramme MD d'un seul geste — le dernier
 * jambage du M devient le dos du D. Deux variantes :
 * - `pastille` (défaut) : tuile dégradé bleu + tracé blanc (navbar, listes) ;
 * - `trace` : tracé seul en blanc (à poser sur un fond déjà coloré, ex.
 *   panneau dégradé des pages de connexion).
 */
export function LogoMyDay({
  className,
  variante = "pastille",
}: {
  className?: string;
  variante?: "pastille" | "trace";
}) {
  return (
    <svg
      viewBox="0 0 96 96"
      className={className}
      role="img"
      aria-label="MyDay"
    >
      {variante === "pastille" && (
        <>
          <defs>
            <linearGradient id="logo-md-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3A6BFF" />
              <stop offset="1" stopColor="#2350E6" />
            </linearGradient>
          </defs>
          <rect width="96" height="96" rx="22" fill="url(#logo-md-g)" />
        </>
      )}
      <path
        d="M18 68 V28 L34 50 L50 28 V68"
        fill="none"
        stroke="#fff"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M50 28 C72 28 80 40 80 48 C80 56 72 68 50 68"
        fill="none"
        stroke="#fff"
        strokeWidth="9"
        strokeLinecap="round"
      />
    </svg>
  );
}
