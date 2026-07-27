#!/usr/bin/env python3
"""Dependency-free structural checks for the static app."""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


class DocumentParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: list[str] = []
        self.local_assets: list[str] = []
        self.external_assets: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(values["id"] or "")
        for key in ("src", "href"):
            value = values.get(key)
            if not value or value.startswith(("#", "mailto:", "tel:")):
                continue
            if re.match(r"^(?:https?:)?//", value):
                self.external_assets.append(value)
            elif not value.startswith(("data:", "blob:")):
                self.local_assets.append(value)


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    if not HTML.exists():
        fail("index.html is missing")

    parser = DocumentParser()
    parser.feed(HTML.read_text(encoding="utf-8"))

    duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
    if duplicates:
        fail(f"duplicate HTML ids: {', '.join(duplicates)}")

    if parser.external_assets:
        fail(f"external page assets found: {', '.join(parser.external_assets)}")

    for asset in parser.local_assets:
        clean = asset.split("?", 1)[0].split("#", 1)[0]
        if clean and not (ROOT / clean).exists():
            fail(f"missing local asset: {asset}")

    app_js = (ROOT / "app.js").read_text(encoding="utf-8")
    if "fetch(" in app_js or "XMLHttpRequest" in app_js or "WebSocket(" in app_js:
        fail("network API usage found in app.js")

    if "buildProfileHTML" not in app_js or "scanPrivacy" not in app_js:
        fail("core export or privacy scan function is missing")

    print(f"OK: {len(parser.ids)} unique ids, {len(parser.local_assets)} local assets, no external assets")


if __name__ == "__main__":
    main()
