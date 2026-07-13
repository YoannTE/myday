import Link from "next/link";
import { formaterExpediteur } from "@/components/mails/format-expediteur";
import type { Mail } from "@/components/mails/types";

interface MailsImportantsProps {
  placeholder: boolean;
  mails: Mail[];
}

/**
 * Bloc « Mails importants » du cockpit (F7, Round 006) : top mails triés
 * par l'IA (score desc), lecture seule (l'action complète — feedback,
 * rafraîchir le tri — vit sur `/mails`). Affiche l'état d'attente
 * UNIQUEMENT tant qu'aucun mail n'a encore été trié (`placeholder: true`).
 */
export function MailsImportants({ placeholder, mails }: MailsImportantsProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-ink">
          Mails importants
        </h2>
        <Link href="/mails" className="font-body text-sm text-accent">
          Tout voir →
        </Link>
      </div>
      {placeholder ? (
        <div className="rounded-card bg-card p-6 text-center shadow-card">
          <p className="font-body text-sm text-ink/50">
            Tes mails importants seront bientôt priorisés ici par
            l&apos;IA.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-ink/5 rounded-card bg-card shadow-card">
          {mails.length === 0 ? (
            <p className="px-5 py-6 text-center font-body text-sm text-ink/50">
              Aucun mail important pour l&apos;instant.
            </p>
          ) : (
            mails.map((mail) => (
              <div key={mail.id} className="flex items-center gap-4 px-5 py-4">
                <span className="cta-gradient flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-mono text-xs text-white">
                  {mail.score ?? "…"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-semibold text-ink">
                    {formaterExpediteur(mail.expediteur)} — {mail.sujet}
                  </p>
                  <p className="truncate font-body text-sm text-ink/50">
                    {mail.resume_ia ?? mail.extrait}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
