// Mention discrète en pied des pages d'authentification - transposition
// fidèle de .project/mockups/pages/login.html (ligne « MyDay est accessible
// sur invitation uniquement »).
export function InvitationOnlyMention() {
  return (
    <p className="mt-10 text-center font-mono text-[10px] tracking-[.04em] text-ink/30 uppercase">
      MyDay est accessible sur invitation uniquement
    </p>
  );
}
