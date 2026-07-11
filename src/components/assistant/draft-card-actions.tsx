interface DraftCardActionsProps {
  enEdition: boolean;
  enCoursDecision: boolean;
  onApprouver: () => void;
  onAnnulerEdition: () => void;
  onEntrerEdition: () => void;
  onRefuser: () => void;
}

const CLASSE_BOUTON_PRIMAIRE =
  "cta-gradient rounded-inner px-5 py-2.5 font-display text-sm font-semibold text-white disabled:opacity-50";
const CLASSE_BOUTON_SECONDAIRE =
  "rounded-inner bg-soft px-4 py-2.5 font-body text-sm text-ink/70 disabled:opacity-50";
const CLASSE_BOUTON_TERTIAIRE =
  "rounded-inner border border-ink/10 bg-card px-4 py-2.5 font-body text-sm text-ink/50 disabled:opacity-50";

/** Pied de la carte de validation : Approuver / Modifier / Refuser (ou Annuler en édition). */
export function DraftCardActions({
  enEdition,
  enCoursDecision,
  onApprouver,
  onAnnulerEdition,
  onEntrerEdition,
  onRefuser,
}: DraftCardActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-ink/5 px-5 py-4">
      <button
        type="button"
        disabled={enCoursDecision}
        onClick={onApprouver}
        className={CLASSE_BOUTON_PRIMAIRE}
      >
        Approuver et envoyer
      </button>
      {enEdition ? (
        <button
          type="button"
          disabled={enCoursDecision}
          onClick={onAnnulerEdition}
          className={CLASSE_BOUTON_TERTIAIRE}
        >
          Annuler
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={enCoursDecision}
            onClick={onEntrerEdition}
            className={CLASSE_BOUTON_SECONDAIRE}
          >
            Modifier
          </button>
          <button
            type="button"
            disabled={enCoursDecision}
            onClick={onRefuser}
            className={CLASSE_BOUTON_TERTIAIRE}
          >
            Refuser
          </button>
        </>
      )}
    </div>
  );
}
