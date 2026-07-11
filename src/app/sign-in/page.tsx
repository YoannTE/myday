import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { InvitationOnlyMention } from "@/components/auth/invitation-only-mention";
import { SignInForm } from "@/components/auth/sign-in-form";
import { isGoogleEnabled } from "@/lib/auth";

export const metadata = {
  title: "Se connecter",
  description: "Connecte-toi à ton cockpit MyDay.",
};

export default function SignInPage() {
  return (
    <AuthSplitLayout>
      <SignInForm googleEnabled={isGoogleEnabled} />
      <InvitationOnlyMention />
    </AuthSplitLayout>
  );
}
