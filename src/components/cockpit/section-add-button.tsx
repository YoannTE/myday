import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SectionAddButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Bouton rond bleu « + » réutilisable à côté du titre d'une section du
 * cockpit (Notes, Ton planning, Tes tâches — F7, Round 014). Coquille de
 * bouton sans contenu propre : utilisé comme `trigger`/`render` d'un Dialog
 * de création rapide existant, avec l'icône fournie par l'appelant via les
 * children du Dialog englobant (cf. `note-quick-add-dialog.tsx`,
 * `event-form-dialog.tsx`, `task-quick-add-dialog.tsx`).
 */
export function SectionAddButton({ className, ...props }: SectionAddButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "cta-gradient flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white shadow-cta transition-transform hover:scale-105",
        className,
      )}
      {...props}
    />
  );
}
