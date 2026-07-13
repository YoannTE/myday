import { Checkbox } from "@/components/ui/checkbox";
import type { Contact } from "@/components/partage/types";

interface PartageDialogContactRowProps {
  contact: Contact;
  coche: boolean;
  enCours: boolean;
  onToggle: () => void;
}

/**
 * Ligne d'un contact accepté dans `PartageDialog` - extrait pour garder le
 * parent sous ~150 lignes. La case à cocher pilote un POST/DELETE
 * `/api/partages` géré par le parent (`onToggle`).
 */
export function PartageDialogContactRow({
  contact,
  coche,
  enCours,
  onToggle,
}: PartageDialogContactRowProps) {
  return (
    <label className="flex min-w-0 cursor-pointer items-center gap-3 rounded-inner px-2 py-2 hover:bg-soft/50">
      <Checkbox checked={coche} disabled={enCours} onCheckedChange={onToggle} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-sm text-ink">
          {contact.autre_utilisateur.nom}
        </span>
        <span className="block truncate font-body text-xs text-ink/50">
          {contact.autre_utilisateur.email}
        </span>
      </span>
    </label>
  );
}
