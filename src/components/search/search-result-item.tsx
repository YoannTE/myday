interface SearchResultItemProps {
  titre: string;
  sousTitre?: string | null;
  onSelect: () => void;
}

/**
 * Un résultat cliquable dans la modale de recherche globale - ferme la
 * modale et navigue vers la page concernée (géré par le parent).
 */
export function SearchResultItem({
  titre,
  sousTitre,
  onSelect,
}: SearchResultItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="focus-ring w-full rounded-inner px-2.5 py-2 text-left transition-colors hover:bg-soft"
    >
      <p className="truncate font-body text-sm text-ink">{titre}</p>
      {sousTitre && (
        <p className="truncate font-body text-xs text-ink/50">{sousTitre}</p>
      )}
    </button>
  );
}
