from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)


path = Path("tests/test_adult_browser.py")
text = path.read_text(encoding="utf-8")
old = """async function waitFrameReady(frame,label,searchMarker=''){\n  await waitFor(()=>{\n    try{\n      const url=new URL(frame.contentWindow.location.href);\n      return url.pathname.endsWith('/adult.html') && (!searchMarker || url.search.includes(searchMarker)) && frame.contentDocument?.readyState==='complete';\n    }catch(_){return false;}\n  }, label + ' navigation', 10000);\n}\n"""
new = """async function waitFrameReady(frame,label,searchMarker=''){\n  await waitFor(()=>{\n    try{\n      const url=new URL(frame.contentWindow.location.href);\n      const preview=frame.contentDocument?.querySelector('#adultPreview');\n      return url.pathname.endsWith('/adult.html') && (!searchMarker || url.search.includes(searchMarker)) && Boolean(preview?.srcdoc);\n    }catch(_){return false;}\n  }, label + ' ready', 12000);\n}\n"""
text = replace_once(text, old, new, "adult frame readiness")
path.write_text(text, encoding="utf-8")
