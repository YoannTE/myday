import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { ResetPasswordInvalidCard } from "@/components/auth/reset-password-invalid-card";

export const metadata = {
  title: "Réinitialiser le mot de passe",
  description: "Choisis un nouveau mot de passe pour ton compte MyDay.",
};

export default async function ReinitialiserMotDePassePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  return (
    <AuthSplitLayout>
      {token && !error ? (
        <ResetPasswordForm token={token} />
      ) : (
        <ResetPasswordInvalidCard />
      )}
    </AuthSplitLayout>
  );
}
