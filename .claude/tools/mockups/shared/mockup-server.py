#!/usr/bin/env python3
"""Serveur HTTP pour les mockups avec endpoint de sauvegarde des tweaks.

Usage :
    python3 mockup-server.py [PORT] [MOCKUPS_DIR]

Par défaut : port 8080, sert le dossier courant.
Gère un endpoint POST /api/save-tweaks qui écrit tweaks-selection.md
dans le dossier shared/ des mockups.
"""

import json
import os
import sys
from datetime import datetime
from functools import partial
from http import HTTPStatus
from http.server import HTTPServer, SimpleHTTPRequestHandler


class MockupHandler(SimpleHTTPRequestHandler):
    """Sert les fichiers statiques + gère POST /api/save-tweaks."""

    def do_POST(self):
        if self.path == "/api/save-tweaks":
            self._handle_save_tweaks()
        else:
            self.send_error(HTTPStatus.NOT_FOUND)

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _handle_save_tweaks(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, ValueError):
            self.send_error(HTTPStatus.BAD_REQUEST, "JSON invalide")
            return

        md = self._build_markdown(body)
        out_path = os.path.join(self.directory, "shared", "tweaks-selection.md")
        os.makedirs(os.path.dirname(out_path), exist_ok=True)

        with open(out_path, "w", encoding="utf-8") as f:
            f.write(md)

        response = json.dumps({"ok": True, "path": out_path}).encode()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response)

    def _build_markdown(self, data):
        now = datetime.now().strftime("%Y-%m-%d %H:%M")
        lines = [
            "# Sélection Design",
            "",
            f"_Enregistré le {now}_",
            "",
        ]

        # Direction
        direction = data.get("direction", {})
        if direction:
            lines += [
                "## Direction",
                "",
                f"- **Nom** : {direction.get('name', '-')}",
                f"- **Fichier** : {direction.get('file', '-')}",
                "",
            ]

        # Palette
        palette = data.get("palette", {})
        if palette:
            lines += [
                "## Palette",
                "",
                f"**{palette.get('name', '-')}**",
                "",
                "| Token | Valeur |",
                "|-------|--------|",
            ]
            for token, value in palette.get("colors", {}).items():
                lines.append(f"| {token} | `{value}` |")
            lines.append("")

        # Mode
        mode = data.get("mode", "light")
        lines += [
            "## Mode",
            "",
            f"**{mode.capitalize()}**",
            "",
        ]

        # Densité
        density = data.get("density", "Confort")
        lines += [
            "## Densité",
            "",
            f"**{density}**",
            "",
        ]

        # Variantes
        variants = data.get("variants", {})
        if variants:
            lines += ["## Variantes", ""]
            for group, info in variants.items():
                label = info.get("label", group)
                selected = info.get("selected", "-")
                lines.append(f"- **{label}** : {selected}")
            lines.append("")

        return "\n".join(lines)

    def log_message(self, format, *args):
        """Log discret."""
        sys.stderr.write(f"[mockup-server] {args[0]}\n")


def run(port=8080, directory="."):
    handler = partial(MockupHandler, directory=directory)
    server = HTTPServer(("", port), handler)
    print(f"Mockup server → http://localhost:{port}/  (dir: {directory})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur.")
        server.server_close()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    directory = sys.argv[2] if len(sys.argv) > 2 else "."
    run(port, directory)
