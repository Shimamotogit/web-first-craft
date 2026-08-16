from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
js_path = ROOT / "child.js"
css_path = ROOT / "child.css"

js = js_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")

# Preview fix: init() renders the preview immediately, so this variable must
# already be initialized before init() is called.
anchor = '  let toastTimer = 0, previewObjectUrl = "", activePhotoToken = "", photoPollTimer = 0;\n'
if '  let currentPhotoNode = "";\n\n  init();' not in js:
    if anchor not in js:
        raise SystemExit("preview anchor not found")
    js = js.replace(
        anchor,
        anchor + '  // プレビュー生成は init() からすぐ呼ばれるため、SVGで使う写真ノードを先に初期化する。\n  let currentPhotoNode = "";\n',
        1,
    )
js = js.replace('  let currentPhotoNode="";\n', '', 1)

# Kana pad: use the familiar gojuon chart orientation.
start = js.index('  function renderKana(){')
end = js.index('\n\n  function insertKana', start)
new_render = '''  function renderKana(){
    kanaGrid.replaceChildren();
    const rows=kanaPages[kanaPage]||kanaPages.basic;
    // 五十音表と同じ向きにする：右端が「あ行」、その左へ「か・さ・た・な…」。
    // 各列は上から「あ・い・う・え・お」の母音順。
    kanaGrid.style.setProperty("--kana-columns",String(rows.length));
    [...rows].reverse().forEach(row=>{
      const column=document.createElement("div");
      column.className="kana-column";
      column.setAttribute("role","group");
      column.setAttribute("aria-label",row[0]);
      row.slice(1).forEach(char=>{
        if(!char){const empty=document.createElement("span");empty.className="kana-empty";empty.setAttribute("aria-hidden","true");column.append(empty);return;}
        const button=document.createElement("button");
        button.type="button";button.className="kana-char";button.textContent=char==="　"?"空":char;button.setAttribute("aria-label",char==="　"?"くうはく":char);
        button.addEventListener("click",()=>insertKana(char));column.append(button);
      });
      kanaGrid.append(column);
    });
    // 狭い画面でも最初に「あ行」が見えるよう、横スクロール位置を右端に合わせる。
    requestAnimationFrame(()=>{kanaGrid.scrollLeft=kanaGrid.scrollWidth;});
  }'''
js = js[:start] + new_render + js[end:]

old_kana_css_start = css.index('.kana-chart{')
old_kana_css_end = css.index('.hiragana-dock.collapsed', old_kana_css_start)
new_kana_css = '.kana-chart{display:grid;grid-template-columns:repeat(var(--kana-columns,10),minmax(50px,1fr));gap:6px;overflow-x:auto;padding:2px 0 7px;overscroll-behavior-x:contain}.kana-column{display:grid;grid-template-rows:repeat(5,minmax(36px,auto));gap:4px;min-width:0}.kana-char,.kana-empty{min-height:36px}.kana-char{padding:2px;background:#fff;border:2px solid #a69d90;border-radius:8px;font-size:.98rem;font-weight:900;cursor:pointer}.kana-char:active{transform:translateY(2px);background:#ffe994}.kana-empty{display:block}'
css = css[:old_kana_css_start] + new_kana_css + css[old_kana_css_end:]

old_980 = '.input-method-card{align-items:flex-start;flex-direction:column}.kana-chart{grid-template-columns:1fr 1fr}}'
new_980 = '.input-method-card{align-items:flex-start;flex-direction:column}.kana-chart{grid-template-columns:repeat(var(--kana-columns,10),minmax(48px,1fr))}}'
if old_980 not in css and new_980 not in css:
    raise SystemExit("980px kana CSS anchor not found")
css = css.replace(old_980, new_980, 1)

old_680 = '.kid-preview-stage{min-height:420px;padding:8px}.kid-preview-stage img{max-height:405px}.kana-chart{grid-template-columns:1fr;max-height:44vh;overflow:auto}.kana-row{grid-template-columns:38px repeat(5,1fr)}.kana-char{min-height:34px}'
new_680 = '.kid-preview-stage{min-height:420px;padding:8px}.kid-preview-stage img{max-height:405px}.kana-chart{grid-template-columns:repeat(var(--kana-columns,10),52px);max-height:none;overflow-x:auto;overflow-y:hidden;justify-content:start}.kana-char,.kana-empty{min-height:34px}'
if old_680 not in css and new_680 not in css:
    raise SystemExit("680px kana CSS anchor not found")
css = css.replace(old_680, new_680, 1)

js_path.write_text(js, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")

print("Patched child preview and gojuon kana pad")
