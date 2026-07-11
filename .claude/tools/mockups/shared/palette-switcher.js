// Palette Switcher - permet de basculer entre plusieurs palettes de couleurs
// sur les mockups d'exploration (Phase 0).
//
// Usage dans un HTML d'exploration :
//
//   <script>
//     window.__PALETTES__ = [
//       {
//         name: "Terre cuite",
//         colors: {
//           primary: "#c2703e",
//           secondary: "#3d5a47",
//           accent: "#d4a853",
//           background: "#faf6f1",
//           surface: "#ffffff",
//           text: "#2c1810",
//           muted: "#8c7b6b"
//         }
//       },
//       {
//         name: "Ocean",
//         colors: {
//           primary: "#1a6b8a",
//           secondary: "#2d4a5e",
//           accent: "#e8a838",
//           background: "#f0f7fa",
//           surface: "#ffffff",
//           text: "#0f2b3d",
//           muted: "#6b8fa3"
//         }
//       }
//     ];
//   </script>
//   <script src="../shared/palette-switcher.js" defer></script>
//
// Les cles dans `colors` sont libres - le switcher les mappe vers des
// CSS custom properties `--palette-{cle}` ET met a jour les classes
// Tailwind si tailwind.config utilise ces variables.

(() => {
  const palettes = window.__PALETTES__;
  if (!palettes || palettes.length < 2) return;

  let current = 0;

  // --- Apply palette as CSS custom properties ---
  function applyPalette(index) {
    current = index;
    const palette = palettes[index];
    const root = document.documentElement;

    Object.entries(palette.colors).forEach(([key, value]) => {
      root.style.setProperty(`--palette-${key}`, value);
    });

    // Dispatch event for pages that need to react
    document.dispatchEvent(
      new CustomEvent("palette-change", { detail: { index, palette } }),
    );

    updateUI();
  }

  // --- Build floating switcher UI ---
  function createSwitcher() {
    const wrapper = document.createElement("div");
    wrapper.id = "palette-switcher";
    wrapper.innerHTML = `
      <style>
        #palette-switcher {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 99999;
          font-family: Inter, system-ui, sans-serif;
          font-size: 13px;
        }
        #palette-switcher .ps-toggle {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 2px solid rgba(0,0,0,0.15);
          background: #fff;
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        #palette-switcher .ps-toggle:hover {
          transform: scale(1.08);
          box-shadow: 0 6px 20px rgba(0,0,0,0.18);
        }
        #palette-switcher .ps-toggle svg {
          width: 22px;
          height: 22px;
        }
        #palette-switcher .ps-panel {
          position: absolute;
          bottom: 60px;
          right: 0;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          padding: 12px;
          min-width: 220px;
          display: none;
          animation: ps-fade-in 0.15s ease-out;
        }
        #palette-switcher .ps-panel.ps-open { display: block; }
        @keyframes ps-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        #palette-switcher .ps-title {
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #888;
          margin-bottom: 8px;
          padding: 0 4px;
        }
        #palette-switcher .ps-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
          border: 2px solid transparent;
        }
        #palette-switcher .ps-option:hover { background: #f5f5f5; }
        #palette-switcher .ps-option.ps-active {
          background: #f0f0f0;
          border-color: #333;
        }
        #palette-switcher .ps-swatches {
          display: flex;
          gap: 3px;
          flex-shrink: 0;
        }
        #palette-switcher .ps-swatch {
          width: 18px;
          height: 18px;
          border-radius: 4px;
          border: 1px solid rgba(0,0,0,0.1);
        }
        #palette-switcher .ps-name {
          font-weight: 500;
          color: #333;
          white-space: nowrap;
        }
      </style>

      <div class="ps-panel" id="ps-panel">
        <div class="ps-title">Palettes</div>
        <div id="ps-options"></div>
      </div>

      <button class="ps-toggle" id="ps-toggle" title="Changer de palette">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="13.5" cy="6.5" r="2.5"/>
          <circle cx="19" cy="13.5" r="2.5"/>
          <circle cx="6" cy="12" r="2.5"/>
          <circle cx="12" cy="19" r="2.5"/>
          <circle cx="12" cy="12" r="10"/>
        </svg>
      </button>
    `;

    document.body.appendChild(wrapper);

    // Build options
    const optionsContainer = document.getElementById("ps-options");
    palettes.forEach((palette, i) => {
      const opt = document.createElement("div");
      opt.className = `ps-option${i === 0 ? " ps-active" : ""}`;
      opt.dataset.index = i;

      // Show up to 4 key swatches
      const swatchKeys = ["primary", "secondary", "accent", "background"];
      const availableKeys = swatchKeys.filter((k) => palette.colors[k]);
      const fallbackKeys = Object.keys(palette.colors).slice(0, 4);
      const keys = availableKeys.length >= 2 ? availableKeys : fallbackKeys;

      opt.innerHTML = `
        <div class="ps-swatches">
          ${keys.map((k) => `<div class="ps-swatch" style="background:${palette.colors[k]}"></div>`).join("")}
        </div>
        <span class="ps-name">${palette.name}</span>
      `;

      opt.addEventListener("click", () => applyPalette(i));
      optionsContainer.appendChild(opt);
    });

    // Toggle panel
    document.getElementById("ps-toggle").addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById("ps-panel").classList.toggle("ps-open");
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) {
        document.getElementById("ps-panel").classList.remove("ps-open");
      }
    });
  }

  function updateUI() {
    const options = document.querySelectorAll("#palette-switcher .ps-option");
    options.forEach((opt) => {
      opt.classList.toggle("ps-active", +opt.dataset.index === current);
    });
  }

  // --- Tailwind integration ---
  // Listen for palette changes and update inline Tailwind config colors.
  // This works because Tailwind CDN re-processes when config changes.
  document.addEventListener("palette-change", (e) => {
    const { palette } = e.detail;
    if (typeof tailwind === "undefined" || !tailwind.config) return;

    const extend = tailwind.config.theme?.extend?.colors || {};
    Object.entries(palette.colors).forEach(([key, value]) => {
      extend[key] = value;
    });

    // Force Tailwind CDN to recompute styles
    if (tailwind.config.theme?.extend) {
      tailwind.config.theme.extend.colors = { ...extend };
    }

    // Trigger re-render: touch a data attribute to force CDN reprocess
    document.documentElement.setAttribute("data-palette", palette.name);
  });

  // Init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      createSwitcher();
      applyPalette(0);
    });
  } else {
    createSwitcher();
    applyPalette(0);
  }
})();
