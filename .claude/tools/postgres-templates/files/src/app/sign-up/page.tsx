import { AuthForm } from "@/components/auth-form";
import { isGoogleEnabled } from "@/lib/auth";

export const metadata = { title: "Creer un compte" };

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AuthForm mode="sign-up" googleEnabled={isGoogleEnabled} />
    </main>
  );
}
