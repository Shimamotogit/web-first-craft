#!/usr/bin/env python3
"""Dependency-free structural checks for the two-mode static app."""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
PAGES = [WEB / "index.html", WEB / "child.html", WEB / "adult.html"]
SCRIPTS = [WEB / "js/child.js", WEB / "js/adult.js"]

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
            if clean and not clean.startswith("/") and not (html.parent/clean).exists(): fail(f"{html.name}: missing local asset {asset}")
        total_ids += len(parser.ids)

    for js_path in SCRIPTS:
        text=js_path.read_text(encoding="utf-8")
        if re.search(r"fetch\(\s*[\"'](?:https?:)?//", text) or "WebSocket(" in text:
            fail(f"{js_path.name}: external network endpoint found")
        html=(WEB/("child.html" if js_path.name.startswith("child") else "adult.html")).read_text(encoding="utf-8")
        ids=set(re.findall(r'id="([^"]+)"', html))
        if js_path.name == "adult.js":
            # These IDs belong to the generated finished page, not the editor DOM.
            ids.update({"revealButton", "extraPanel", "rouletteButton", "rouletteResult", "photoZoom", "lightbox", "lightboxClose"})
        refs=set(re.findall(r'\$\(\"#([A-Za-z0-9_-]+)\"\)', text))
        missing=sorted(refs-ids)
        if missing: fail(f"{js_path.name}: missing referenced ids: {', '.join(missing)}")

    required=["server/app.py","web/css/main.css","web/css/child.css","web/css/adult.css","scripts/launch/start-local.bat","scripts/launch/start-local.command","scripts/systemd/install.sh","vendor/python/qrcode/__init__.py"]
    for name in required:
        if not (ROOT/name).exists(): fail(f"{name} is missing")

    child=(WEB/"js/child.js").read_text(encoding="utf-8")
    adult=(WEB/"js/adult.js").read_text(encoding="utf-8")
    if "buildKidHtml" not in child or "drawCard" not in child or "/api/cards" not in child:
        fail("child mode core build/card functions are missing")
    child_html=(WEB/"child.html").read_text(encoding="utf-8")
    for marker in ("kidPhonePhotoButton", "toggleKanaButton", "kidFrames", "kidStickers", "kidPatterns", "inputMethodButtons"):
        if f'id="{marker}"' not in child_html:
            fail(f"child mode UI is missing {marker}")
    if 'data-layout="storybook"' not in child_html or 'data-layout="cards"' in child_html:
        fail("child mode must use the balanced storybook layout instead of cards")
    if 'data-input-mode="pc"' not in child_html or 'data-input-mode="kana"' not in child_html:
        fail("child mode must support both kana-pad and PC keyboard input")
    if child.count("buildKidSvg()") < 4:
        fail("child preview/export paths must share buildKidSvg()")
    if "data-motion=" in child_html or "data-magic=" in child_html:
        fail("child final-card workflow must not expose animation choices")
    if "buildHtml" not in adult or "function score" not in adult or "/api/shares" not in adult:
        fail("adult mode core build/score/share functions are missing")
    adult_html=(WEB/"adult.html").read_text(encoding="utf-8")
    for marker in ("pageWidth", "headingSize", "backgroundR", "backgroundG", "backgroundB", "jsReveal", "jsRoulette", "jsPhotoZoom"):
        if f'id="{marker}"' not in adult_html:
            fail(f"adult custom lab is missing {marker}")
    for legacy in ("静かな時間", "順番に表示", "STAGGER", "お題", "難易度"):
        if legacy in adult_html:
            fail(f"adult mode still contains legacy challenge UI: {legacy}")
    print(f"OK: 3 pages, {total_ids} unique ids, child kana/PC input + static card, adult px/RGB lab + scoring present")

if __name__ == "__main__": main()
