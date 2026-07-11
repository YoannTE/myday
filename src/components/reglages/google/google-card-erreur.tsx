import { Button } from "@/components/ui/button";

// État réseau (FastAPI injoignable ou erreur inattendue) - jamais un message
// brut de SDK/runtime à l'écran, toujours du français (cf. SOP
// third-party-error-i18n).
export function GoogleCardErreur({
  message,
  onReessayer,
}: {
  message: string;
  onReessayer: () => void;
}) {
  return (
    <div className="rounded-inner border border-ink/10 p-5">
      <p className="mb-3 font-body text-sm text-ink/60">{message}</p>
      <Button
        type="button"
        variant="secondary"
        className="h-auto rounded-inner bg-soft px-3 py-1.5 text-xs text-ink/70"
        onClick={onReessayer}
      >
        Réessayer
      </Button>
    </div>
  );
}
