// Injecte les composants recurrents (navbar, sidebar, footer...) dans les pages.
// Usage : <div data-include="../shared/components/navbar.html"></div>
// Necessite un serveur HTTP local (python3 -m http.server, npx serve, etc.)
// - fetch() ne marche pas sur file:// pour des raisons de securite CORS.

(async () => {
  const slots = document.querySelectorAll("[data-include]");
  await Promise.all(
    [...slots].map(async (el) => {
      const url = el.dataset.include;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${url}`);
        el.innerHTML = await res.text();
      } catch (err) {
        el.innerHTML = `<!-- include failed: ${err.message} -->`;
        console.error("components-loader:", err);
      }
    }),
  );
  document.dispatchEvent(new CustomEvent("components-loaded"));
  document.documentElement.dataset.componentsLoaded = "true";
})();
