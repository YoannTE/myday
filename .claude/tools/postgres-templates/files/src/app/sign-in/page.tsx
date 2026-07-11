import { AuthForm } from "@/components/auth-form";
import { isGoogleEnabled } from "@/lib/auth";

export const metadata = { title: "Se connecter" };

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AuthForm mode="sign-in" googleEnabled={isGoogleEnabled} />
    </main>
  );
}
