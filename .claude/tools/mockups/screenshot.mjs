// Screenshot tous les .html de <mockups-dir>/pages/ vers <mockups-dir>/png/
// Lance un mini serveur HTTP ephemere pour permettre au components-loader de fetcher.
// Usage : node screenshot.mjs /path/to/.project/mockups

import { createServer } from "node:http";
import { readdir, readFile, mkdir, stat } from "node:fs/promises";
import { resolve, join, extname, relative } from "node:path";
import { chromium } from "playwright";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const mockupsDir = resolve(process.argv[2] || ".project/mockups");
const pagesDir = join(mockupsDir, "pages");
const pngDir = join(mockupsDir, "png");

try {
  await stat(pagesDir);
} catch {
  console.error(`Aucun dossier pages/ trouve dans ${mockupsDir}`);
  process.exit(1);
}
await mkdir(pngDir, { recursive: true });

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let filePath = resolve(mockupsDir, "." + url.pathname);
    if (!filePath.startsWith(mockupsDir)) {
      res.writeHead(403).end();
      return;
    }
    const s = await stat(filePath).catch(() => null);
    if (s?.isDirectory()) filePath = join(filePath, "index.html");
    const data = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] || "text/plain",
    });
    res.end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

const files = (await readdir(pagesDir)).filter((f) => f.endsWith(".html"));
if (files.length === 0) console.warn("Aucun fichier .html dans pages/");

for (const file of files) {
  const rel = relative(mockupsDir, join(pagesDir, file));
  await page.goto(`${base}/${rel}`, { waitUntil: "networkidle" });
  await page
    .waitForFunction(
      () => document.documentElement.dataset.componentsLoaded === "true",
      {
        timeout: 3000,
      },
    )
    .catch(() => {});
  const out = join(pngDir, file.replace(/\.html$/, ".png"));
  await page.screenshot({ path: out, fullPage: true });
  console.log(`✓ ${file.replace(/\.html$/, ".png")}`);
}

await browser.close();
server.close();
