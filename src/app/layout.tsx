import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PwaInstallProvider } from "@/components/pwa/pwa-install-provider";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Script anti-flash : applique le mode sombre memorise AVANT le premier
// rendu pour eviter un flash de theme clair (execute de facon synchrone,
// avant l'hydratation React).
const scriptAntiFlashModeSombre = `(function () {
  try {
    var mode = localStorage.getItem("myday-theme");
    if (mode === "dark") {
      document.documentElement.setAttribute("data-mode", "dark");
    }
  } catch (erreur) {
    /* localStorage indisponible (navigation privee, etc.) : on reste en clair */
  }
})();`;

export const metadata: Metadata = {
  title: {
    default: "MyDay — Ton cockpit personnel",
    template: "%s · MyDay",
  },
  description:
    "MyDay réunit ton planning, tes tâches, tes notes et tes mails importants dans un seul cockpit, avec un brief IA pour démarrer ta journée.",
  // Application privée sur invitation : on n'autorise pas l'indexation.
  robots: { index: false, follow: false },
  openGraph: {
    title: "MyDay — Ton cockpit personnel",
    description:
      "Ton planning, tes tâches, tes notes et tes mails importants réunis dans un seul cockpit, avec un brief IA.",
    siteName: "MyDay",
    locale: "fr_FR",
    type: "website",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MyDay",
  },
};

// `theme_color` vit dans `viewport` (pas `metadata`) depuis Next 16.
export const viewport: Viewport = {
  // Noir : Safari (macOS/iOS) teinte la barre de fenêtre/onglet avec cette
  // couleur — préférence utilisateur : barre noire, pas bleue.
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: scriptAntiFlashModeSombre }}
        />
      </head>
      <body className="min-h-screen bg-bg font-body text-ink antialiased">
        <PwaInstallProvider>
          {children}
          <ServiceWorkerRegister />
        </PwaInstallProvider>
        <Toaster />
      </body>
    </html>
  );
}
