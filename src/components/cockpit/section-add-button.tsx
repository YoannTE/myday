import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SectionAddButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Bouton rond « + » réutilisable, collé au titre d'une section du cockpit
 * (Planning, Tâches, Notes). Rond blanc et « + » bleu, pour ressortir sur le
 * bandeau bleu de `CockpitSection`. Coquille de bouton sans contenu propre :
 * utilisé comme `trigger`/`render` d'un Dialog
 * de création rapide existant, avec l'icône fournie par l'appelant via les
 * children du Dialog englobant (cf. `note-quick-add-dialog.tsx`,
 * `event-form-dialog.tsx`, `task-quick-add-dialog.tsx`).
 */
export function SectionAddButton({ className, ...props }: SectionAddButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-accent shadow-sm transition-transform hover:scale-105",
        className,
      )}
      {...props}
    />
  );
}
