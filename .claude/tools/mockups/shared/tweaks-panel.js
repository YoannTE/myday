// Tweaks Panel - sidebar fixe de controle visuel pour les mockups.
//
// Chaque DIRECTION est un fichier HTML separe (sa propre typo, ses composants).
// Le panel gere les axes TRANSVERSAUX qui s'appliquent a toutes les directions :
// - Palettes de couleurs (partagees entre les fichiers)
// - Dark/light toggle
// - Densite (compact/confort/aere)
// - Variantes de composants (propres a chaque fichier)
//
// === CONFIGURATION ===
//
//   <script>
//     window.__TWEAKS__ = {
//       palettes: [
//         {
//           name: "Or & Charcoal",
//           colors: {
//             primary: "#e5a836",
//             background: "#1a1a1a",
//             surface: "#242424",
//             text: "#f5f0eb",
//             muted: "#a39e97",
//             border: "#333333"
//           }
//         },
//         { name: "Navy & Emeraude", colors: { ... } }
//       ],
//
//       // Format simple (label auto = "Dark mode") :
//       dark: {
//         background: "#0f0f0f",
//         surface: "#1a1a1a",
//         text: "#f0f0f0",
//         muted: "#888888"
//       },
//
//       // Format avec label custom (si le design est deja sombre) :
//       dark: {
//         label: "Light mode",
//         colors: {
//           background: "#f5f0eb",
//           surface: "#ffffff",
//           text: "#1a1a1a",
//           muted: "#6b6560"
//         }
//       },
//
//       variants: {
//         hero: { label: "Section hero", options: ["Confiant", "Stats", "Split"] },
//         card: { label: "Style de card", options: ["Spacieuse", "Compacte"] }
//       }
//     };
//   </script>
//   <script src="../shared/tweaks-panel.js" defer></script>
//
// === VARIANTES HTML ===
//
//   <div data-variant-group="card" data-variant="0"><!-- V1 --></div>
//   <div data-variant-group="card" data-variant="1" style="display:none"><!-- V2 --></div>
//
// === RETRO-COMPATIBILITE ===
//
// window.__PALETTES__ → converti en { palettes: __PALETTES__ }

(() => {
  const raw =
    window.__TWEAKS__ ||
    (window.__PALETTES__ ? { palettes: window.__PALETTES__ } : null);

  if (!raw) return;

  const palettes = raw.palettes || [];
  // dark: supports { label, colors } or plain { background, text, ... }
  const darkRaw = raw.dark || null;
  const darkOverrides = darkRaw ? darkRaw.colors || darkRaw : null;
  const darkLabel = darkRaw?.colors
    ? darkRaw.label || "Dark mode"
    : "Dark mode";
  const variantGroups = raw.variants || {};

  const hasPalettes = palettes.length >= 2;
  const hasDark = !!darkOverrides;
  const hasVariants = Object.keys(variantGroups).length > 0;

  if (!hasPalettes && !hasDark && !hasVariants) return;

  const SIDEBAR_WIDTH = 280;

  // --- State ---
  let currentPalette = 0;
  let isDark = false;
  let currentDensity = 1;
  let isCollapsed = false;
  const currentVariants = {};
  Object.keys(variantGroups).forEach((k) => (currentVariants[k] = 0));

  // --- Palette ---
  function applyPalette(index) {
    currentPalette = index;
    const palette = palettes[index];
    const colors =
      isDark && darkOverrides
        ? { ...palette.colors, ...darkOverrides }
        : palette.colors;
    applyColors(colors);
    updatePaletteUI();
  }

  function applyColors(colors) {
    const root = document.documentElement;
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--palette-${key}`, value);
    });
    if (typeof tailwind !== "undefined" && tailwind.config) {
      const extend = tailwind.config.theme?.extend?.colors || {};
      Object.entries(colors).forEach(([key, value]) => {
        extend[key] = value;
      });
      if (tailwind.config.theme?.extend) {
        tailwind.config.theme.extend.colors = { ...extend };
      }
      root.setAttribute("data-tweaks-update", Date.now());
    }
    document.dispatchEvent(
      new CustomEvent("tweaks-change", { detail: { type: "colors", colors } }),
    );
  }

  // --- Dark/Light ---
  function toggleDark() {
    isDark = !isDark;
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "dark" : "light",
    );
    const baseColors =
      palettes.length > 0 ? palettes[currentPalette].colors : {};
    if (isDark && darkOverrides) {
      applyColors({ ...baseColors, ...darkOverrides });
    } else {
      applyColors(baseColors);
    }
    updateDarkUI();
  }

  // --- Density ---
  const DENSITY_LEVELS = [
    { name: "Compact", factor: 14 },
    { name: "Confort", factor: 16 },
    { name: "A\u00e9r\u00e9", factor: 18 },
  ];

  function applyDensity(level) {
    currentDensity = level;
    document.documentElement.style.fontSize =
      DENSITY_LEVELS[level].factor + "px";
    document.documentElement.setAttribute(
      "data-density",
      DENSITY_LEVELS[level].name.toLowerCase(),
    );
    document.dispatchEvent(
      new CustomEvent("tweaks-change", {
        detail: { type: "density", level, name: DENSITY_LEVELS[level].name },
      }),
    );
    updateDensityUI();
  }

  // --- Variants ---
  function applyVariant(group, index) {
    currentVariants[group] = index;
    document
      .querySelectorAll(`[data-variant-group="${group}"]`)
      .forEach((el) => {
        el.style.display =
          parseInt(el.getAttribute("data-variant"), 10) === index ? "" : "none";
      });
    document.dispatchEvent(
      new CustomEvent("tweaks-change", {
        detail: { type: "variant", group, index },
      }),
    );
    updateVariantUI(group);
  }

  // --- Collapse ---
  function toggleCollapse() {
    isCollapsed = !isCollapsed;
    document
      .getElementById("tp-sidebar")
      .classList.toggle("tp-collapsed", isCollapsed);
    document.body.style.marginRight = isCollapsed ? "0" : SIDEBAR_WIDTH + "px";
    const toggle = document.getElementById("tp-collapse");
    toggle.setAttribute("title", isCollapsed ? "Ouvrir les tweaks" : "Replier");
    toggle.querySelector(".tp-collapse-icon").textContent = isCollapsed
      ? "\u25C0"
      : "\u25B6";
  }

  // --- Save tweaks ---
  function gatherState() {
    const path = window.location.pathname;
    const filename = path.split("/").pop() || "unknown.html";
    const dirName = document.title || filename.replace(".html", "");

    const state = {
      direction: { name: dirName, file: filename },
      mode: isDark ? "dark" : "light",
      density: DENSITY_LEVELS[currentDensity].name,
    };

    if (hasPalettes && palettes[currentPalette]) {
      const pal = palettes[currentPalette];
      const activeColors = {};
      const root = document.documentElement;
      Object.keys(pal.colors).forEach((key) => {
        const val = root.style.getPropertyValue(`--palette-${key}`).trim();
        activeColors[key] = val || pal.colors[key];
      });
      state.palette = { name: pal.name, colors: activeColors };
    }

    if (hasVariants) {
      state.variants = {};
      Object.entries(variantGroups).forEach(([key, group]) => {
        state.variants[key] = {
          label: group.label,
          selected: group.options[currentVariants[key]] || "-",
        };
      });
    }

    return state;
  }

  function saveTweaks() {
    const state = gatherState();
    const btn = document.getElementById("tp-save-btn");
    btn.textContent = "Enregistrement…";
    btn.disabled = true;

    fetch("/api/save-tweaks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    })
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then(() => {
        btn.textContent = "\u2713 Enregistr\u00e9";
        btn.classList.add("tp-saved");
        setTimeout(() => {
          btn.textContent = "Enregistrer";
          btn.disabled = false;
          btn.classList.remove("tp-saved");
        }, 2000);
      })
      .catch(() => {
        btn.textContent = "Erreur";
        btn.classList.add("tp-error");
        setTimeout(() => {
          btn.textContent = "Enregistrer";
          btn.disabled = false;
          btn.classList.remove("tp-error");
        }, 2000);
      });
  }

  // --- Build UI ---
  function createPanel() {
    document.body.style.marginRight = SIDEBAR_WIDTH + "px";
    document.body.style.transition = "margin-right 0.25s ease";

    const sidebar = document.createElement("div");
    sidebar.id = "tp-sidebar";

    let html = "";

    // Palettes
    if (hasPalettes) {
      html += `<div class="tp-section">
        <div class="tp-section-title">Palette</div>
        <div id="tp-palettes"></div>
      </div>`;
    }

    // Dark/Light
    if (hasDark) {
      html += `<div class="tp-section">
        <div class="tp-section-title">Mode</div>
        <div class="tp-toggle-row">
          <span class="tp-toggle-label">${darkLabel}</span>
          <button class="tp-toggle-btn" id="tp-dark-btn">
            <span class="tp-toggle-thumb"></span>
          </button>
        </div>
      </div>`;
    }

    // Density
    html += `<div class="tp-section">
      <div class="tp-section-title">Densit\u00e9</div>
      <div class="tp-density">
        ${DENSITY_LEVELS.map(
          (d, i) =>
            `<button class="tp-density-btn${i === 1 ? " tp-active" : ""}" data-level="${i}">${d.name}</button>`,
        ).join("")}
      </div>
    </div>`;

    // Variants
    if (hasVariants) {
      Object.entries(variantGroups).forEach(([key, group]) => {
        html += `<div class="tp-section">
          <div class="tp-section-title">${group.label}</div>
          <div class="tp-variant-options" id="tp-variant-${key}">
            ${group.options
              .map(
                (opt, i) =>
                  `<button class="tp-variant-btn${i === 0 ? " tp-active" : ""}" data-group="${key}" data-index="${i}">${opt}</button>`,
              )
              .join("")}
          </div>
        </div>`;
      });
    }

    // Save button
    html += `<div class="tp-section tp-save-section">
      <button class="tp-save-btn" id="tp-save-btn">Enregistrer</button>
    </div>`;

    sidebar.innerHTML = `
      <style>
        #tp-sidebar {
          position: fixed; top: 0; right: 0;
          width: ${SIDEBAR_WIDTH}px; height: 100vh;
          background: #fff; border-left: 1px solid #e5e5e5;
          box-shadow: -2px 0 12px rgba(0,0,0,0.06);
          z-index: 99999;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 13px; line-height: 1.4;
          overflow-y: auto; transition: transform 0.25s ease;
        }
        #tp-sidebar.tp-collapsed { transform: translateX(${SIDEBAR_WIDTH}px); }

        #tp-collapse {
          position: fixed; top: 50%; right: ${SIDEBAR_WIDTH}px;
          transform: translateY(-50%);
          width: 24px; height: 48px;
          background: #fff; border: 1px solid #e5e5e5; border-right: none;
          border-radius: 6px 0 0 6px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          z-index: 99999; color: #999; font-size: 10px;
          transition: right 0.25s ease;
          box-shadow: -2px 0 8px rgba(0,0,0,0.04);
        }
        #tp-collapse:hover { color: #333; background: #f9f9f9; }
        #tp-sidebar.tp-collapsed ~ #tp-collapse { right: 0; }

        #tp-sidebar .tp-header {
          padding: 16px 20px 12px; border-bottom: 1px solid #eee;
          font-weight: 700; font-size: 13px;
          text-transform: uppercase; letter-spacing: 0.06em; color: #999;
          position: sticky; top: 0; background: #fff; z-index: 1;
        }
        #tp-sidebar .tp-section {
          padding: 14px 20px; border-bottom: 1px solid #f0f0f0;
        }
        #tp-sidebar .tp-section:last-child { border-bottom: none; }
        #tp-sidebar .tp-section-title {
          font-weight: 600; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.05em;
          color: #999; margin-bottom: 10px;
        }

        /* Palette items */
        #tp-sidebar .tp-pal-opt {
          display: flex; align-items: center; gap: 10px;
          padding: 7px 8px; border-radius: 8px; cursor: pointer;
          transition: background 0.12s; border: 2px solid transparent;
          margin-bottom: 2px;
        }
        #tp-sidebar .tp-pal-opt:hover { background: #f7f7f7; }
        #tp-sidebar .tp-pal-opt.tp-active { background: #f0f0f0; border-color: #333; }
        #tp-sidebar .tp-swatches { display: flex; gap: 3px; flex-shrink: 0; }
        #tp-sidebar .tp-swatch {
          width: 16px; height: 16px; border-radius: 4px;
          border: 1px solid rgba(0,0,0,0.08);
        }
        #tp-sidebar .tp-pal-name {
          font-weight: 500; color: #333; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }

        /* Toggle */
        #tp-sidebar .tp-toggle-row {
          display: flex; align-items: center; justify-content: space-between; padding: 4px 0;
        }
        #tp-sidebar .tp-toggle-label { font-weight: 500; color: #333; }
        #tp-sidebar .tp-toggle-btn {
          width: 44px; height: 24px; border-radius: 12px;
          background: #ddd; border: none; cursor: pointer;
          position: relative; transition: background 0.2s; padding: 0;
        }
        #tp-sidebar .tp-toggle-btn.tp-on { background: #333; }
        #tp-sidebar .tp-toggle-thumb {
          position: absolute; top: 3px; left: 3px;
          width: 18px; height: 18px; border-radius: 50%;
          background: #fff; transition: transform 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        #tp-sidebar .tp-toggle-btn.tp-on .tp-toggle-thumb { transform: translateX(20px); }

        /* Density */
        #tp-sidebar .tp-density { display: flex; gap: 6px; }
        #tp-sidebar .tp-density-btn {
          flex: 1; padding: 6px 4px;
          border: 1.5px solid #ddd; border-radius: 8px;
          background: #fff; cursor: pointer;
          font-size: 12px; font-weight: 500; color: #666;
          transition: all 0.15s; text-align: center;
        }
        #tp-sidebar .tp-density-btn:hover { border-color: #bbb; color: #333; }
        #tp-sidebar .tp-density-btn.tp-active { border-color: #333; background: #333; color: #fff; }

        /* Variants */
        #tp-sidebar .tp-variant-options { display: flex; flex-direction: column; gap: 4px; }
        #tp-sidebar .tp-variant-btn {
          padding: 7px 10px; border: 1.5px solid #e5e5e5;
          border-radius: 8px; background: #fff; cursor: pointer;
          font-size: 12px; font-weight: 500; color: #555;
          text-align: left; transition: all 0.12s;
        }
        #tp-sidebar .tp-variant-btn:hover { border-color: #ccc; background: #fafafa; color: #222; }
        #tp-sidebar .tp-variant-btn.tp-active { border-color: #333; background: #f5f5f5; color: #111; font-weight: 600; }

        /* Save button */
        #tp-sidebar .tp-save-section {
          padding: 16px 20px; border-bottom: none;
          position: sticky; bottom: 0; background: #fff;
          border-top: 1px solid #eee;
        }
        #tp-sidebar .tp-save-btn {
          width: 100%; padding: 10px 16px;
          border: none; border-radius: 8px;
          background: #333; color: #fff;
          font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
          letter-spacing: 0.02em;
        }
        #tp-sidebar .tp-save-btn:hover { background: #111; }
        #tp-sidebar .tp-save-btn:disabled { opacity: 0.6; cursor: wait; }
        #tp-sidebar .tp-save-btn.tp-saved { background: #16a34a; }
        #tp-sidebar .tp-save-btn.tp-error { background: #dc2626; }

        #tp-sidebar::-webkit-scrollbar { width: 4px; }
        #tp-sidebar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
      </style>
      <div class="tp-header">Tweaks</div>
      ${html}
    `;

    const collapseBtn = document.createElement("button");
    collapseBtn.id = "tp-collapse";
    collapseBtn.title = "Replier";
    collapseBtn.innerHTML = '<span class="tp-collapse-icon">\u25B6</span>';
    collapseBtn.addEventListener("click", toggleCollapse);

    document.body.appendChild(sidebar);
    document.body.appendChild(collapseBtn);

    // --- Build palette options ---
    if (hasPalettes) {
      const container = document.getElementById("tp-palettes");
      palettes.forEach((pal, i) => {
        const opt = document.createElement("div");
        opt.className = `tp-pal-opt${i === 0 ? " tp-active" : ""}`;
        opt.dataset.index = i;

        const swatchKeys = ["primary", "accent", "background", "surface"];
        const available = swatchKeys.filter((k) => pal.colors[k]);
        const keys =
          available.length >= 2
            ? available
            : Object.keys(pal.colors).slice(0, 4);

        opt.innerHTML = `
          <div class="tp-swatches">
            ${keys.map((k) => `<div class="tp-swatch" style="background:${pal.colors[k]}"></div>`).join("")}
          </div>
          <span class="tp-pal-name">${pal.name}</span>
        `;
        opt.addEventListener("click", () => applyPalette(i));
        container.appendChild(opt);
      });
    }

    // Dark
    if (hasDark) {
      document
        .getElementById("tp-dark-btn")
        .addEventListener("click", toggleDark);
    }

    // Density
    document.querySelectorAll("#tp-sidebar .tp-density-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        applyDensity(parseInt(btn.dataset.level, 10)),
      );
    });

    // Variants
    document.querySelectorAll("#tp-sidebar .tp-variant-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        applyVariant(btn.dataset.group, parseInt(btn.dataset.index, 10)),
      );
    });

    // Save
    document
      .getElementById("tp-save-btn")
      .addEventListener("click", saveTweaks);
  }

  // --- UI updates ---
  function updatePaletteUI() {
    document.querySelectorAll("#tp-sidebar .tp-pal-opt").forEach((opt) => {
      opt.classList.toggle("tp-active", +opt.dataset.index === currentPalette);
    });
  }
  function updateDarkUI() {
    const btn = document.getElementById("tp-dark-btn");
    if (btn) btn.classList.toggle("tp-on", isDark);
  }
  function updateDensityUI() {
    document.querySelectorAll("#tp-sidebar .tp-density-btn").forEach((btn) => {
      btn.classList.toggle("tp-active", +btn.dataset.level === currentDensity);
    });
  }
  function updateVariantUI(group) {
    document
      .querySelectorAll(`#tp-sidebar .tp-variant-btn[data-group="${group}"]`)
      .forEach((btn) => {
        btn.classList.toggle(
          "tp-active",
          +btn.dataset.index === currentVariants[group],
        );
      });
  }

  // --- Init ---
  function init() {
    createPanel();
    if (hasPalettes) applyPalette(0);
    applyDensity(1);
    Object.keys(variantGroups).forEach((group) => applyVariant(group, 0));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
