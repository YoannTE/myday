import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { InvitationOnlyMention } from "@/components/auth/invitation-only-mention";
import { InvitationRequiredCard } from "@/components/auth/invitation-required-card";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata = {
  title: "Créer un compte",
  description: "Crée ton compte MyDay à partir de ton lien d'invitation.",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ invitation?: string }>;
}) {
  const { invitation: jeton } = await searchParams;

  return (
    <AuthSplitLayout>
      {jeton ? <SignUpForm token={jeton} /> : <InvitationRequiredCard />}
      <InvitationOnlyMention />
    </AuthSplitLayout>
  );
}
