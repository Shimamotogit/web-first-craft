#!/usr/bin/env python3
"""Dependency-free structural checks for the two-mode static app."""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PAGES = [ROOT / "index.html", ROOT / "child.html", ROOT / "adult.html"]
SCRIPTS = [ROOT / "child.js", ROOT / "adult.js"]

class DocumentParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(); self.ids=[]; self.local_assets=[]; self.external_assets=[]
    def handle_starttag(self, tag, attrs):
        values=dict(attrs)
        if values.get("id"): self.ids.append(values["id"] or "")
        for key in ("src","href"):
            value=values.get(key)
            if not value or value.startswith(("#","mailto:","tel:")): continue
            if re.match(r"^(?:https?:)?//", value): self.external_assets.append(value)
            elif not value.startswith(("data:","blob:")): self.local_assets.append(value)

def fail(message: str) -> None:
    print("ERROR:", message, file=sys.stderr); raise SystemExit(1)

def main() -> None:
    total_ids=0
    for html in PAGES:
        if not html.exists(): fail(f"{html.name} is missing")
        parser=DocumentParser(); parser.feed(html.read_text(encoding="utf-8"))
        dup=sorted({x for x in parser.ids if parser.ids.count(x)>1})
        if dup: fail(f"{html.name}: duplicate ids: {', '.join(dup)}")
        if parser.external_assets: fail(f"{html.name}: external assets found: {', '.join(parser.external_assets)}")
        for asset in parser.local_assets:
            clean=asset.split("?",1)[0].split("#",1)[0]
            if clean and not (ROOT/clean).exists(): fail(f"{html.name}: missing local asset {asset}")
        total_ids += len(parser.ids)

    for js_path in SCRIPTS:
        text=js_path.read_text(encoding="utf-8")
        if re.search(r"fetch\(\s*[\"'](?:https?:)?//", text) or "WebSocket(" in text:
            fail(f"{js_path.name}: external network endpoint found")
        html=(ROOT/("child.html" if js_path.name.startswith("child") else "adult.html")).read_text(encoding="utf-8")
        ids=set(re.findall(r'id="([^"]+)"', html))
        refs=set(re.findall(r'\$\(\"#([A-Za-z0-9_-]+)\"\)', text))
        missing=sorted(refs-ids)
        if missing: fail(f"{js_path.name}: missing referenced ids: {', '.join(missing)}")

    required=["server.py","main.css","child.css","adult.css","start-local.bat","start-local.command"]
    for name in required:
        if not (ROOT/name).exists(): fail(f"{name} is missing")

    child=(ROOT/"child.js").read_text(encoding="utf-8")
    adult=(ROOT/"adult.js").read_text(encoding="utf-8")
    if "buildKidHtml" not in child or "drawCard" not in child or "/api/cards" not in child:
        fail("child mode core build/card functions are missing")
    child_html=(ROOT/"child.html").read_text(encoding="utf-8")
    for marker in ("kidPhonePhotoButton", "toggleKanaButton", "kidFrames", "kidStickers", "kidPatterns"):
        if f'id="{marker}"' not in child_html:
            fail(f"child mode UI is missing {marker}")
    if child.count("buildKidSvg()") < 4:
        fail("child preview/export paths must share buildKidSvg()")
    if "data-motion=" in child_html or "data-magic=" in child_html:
        fail("child final-card workflow must not expose animation choices")
    if "buildHtml" not in adult or "function score" not in adult or "/api/shares" not in adult:
        fail("adult mode core build/score/share functions are missing")
    print(f"OK: 3 pages, {total_ids} unique ids, local-only assets/endpoints, child card + adult scoring present")

if __name__ == "__main__": main()
