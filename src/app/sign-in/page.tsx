import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { InvitationOnlyMention } from "@/components/auth/invitation-only-mention";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata = {
  title: "Se connecter",
  description: "Connecte-toi à ton cockpit MyDay.",
};

export default function SignInPage() {
  // Connexion par e-mail + mot de passe uniquement (app sur invitation). Le
  // bouton « Continuer avec Google » est masqué : l'app Google OAuth est en
  // mode Test côté Google Cloud, ce qui bloquait les personnes non ajoutées
  // comme testeurs. La synchro Gmail/Agenda reste optionnelle dans les Réglages.
  return (
    <AuthSplitLayout>
      <SignInForm googleEnabled={false} />
      <InvitationOnlyMention />
    </AuthSplitLayout>
  );
}
