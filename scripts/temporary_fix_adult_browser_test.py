from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)


path = Path("tests/test_adult_browser.py")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    """async function waitFrame(frame,label){\n  if(frame.contentDocument && frame.contentDocument.readyState === 'complete') return;\n  await new Promise((resolve,reject)=>{\n    frame.addEventListener('load',resolve,{once:true});\n    setTimeout(()=>reject(new Error(label + ' load timeout')),9000);\n  });\n}\n""",
    """async function waitFrameReady(frame,label,searchMarker=''){\n  await waitFor(()=>{\n    try{\n      const url=new URL(frame.contentWindow.location.href);\n      return url.pathname.endsWith('/adult.html') && (!searchMarker || url.search.includes(searchMarker)) && frame.contentDocument?.readyState==='complete';\n    }catch(_){return false;}\n  }, label + ' navigation', 10000);\n}\n""",
    "iframe wait helper",
)
text = replace_once(text, "  await waitFrame(frame,'adult.html');", "  await waitFrameReady(frame,'adult.html');", "initial iframe wait")
text = replace_once(
    text,
    """  const reload = new Promise((resolve,reject)=>{\n    frame.addEventListener('load',resolve,{once:true});\n    setTimeout(()=>reject(new Error('stale-state reload timeout')),9000);\n  });\n  frame.src='adult.html?stale-state=1';\n  await reload;\n""",
    """  frame.src='adult.html?stale-state=1';\n  await waitFrameReady(frame,'stale-state','stale-state=1');\n""",
    "stale iframe wait",
)
path.write_text(text, encoding="utf-8")
