// tailwind-tokens.js - généré depuis .project/design.md (direction « AEVIO One »)
// Ce fichier doit être chargé APRÈS le CDN Tailwind dans chaque mockup HTML :
//   <script src="https://cdn.tailwindcss.com"></script>
//   <script src="../shared/tailwind-tokens.js"></script>
tailwind.config = {
  theme: {
    extend: {
      colors: {
        bg: "#F5F7FB",
        ink: "#111A37",
        accent: "#2350E6",
        soft: "#EAF0FF",
        success: "#2350E6",
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        body: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      borderRadius: {
        base: "14px",
        inner: "12px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(17,26,55,.04), 0 24px 48px -32px rgba(17,26,55,.28)",
        cta: "0 10px 22px -8px rgba(47,98,255,.6)",
        ring: "0 0 0 4px rgba(47,98,255,.10)",
      },
    },
  },
};
