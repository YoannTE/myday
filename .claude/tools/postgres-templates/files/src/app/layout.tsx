import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "App",
  description: "Application generee avec le starterkit Postgres + Better-auth",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-background">
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}
