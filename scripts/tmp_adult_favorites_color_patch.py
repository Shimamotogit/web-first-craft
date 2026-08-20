from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old[:100]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


html = ROOT / "web/adult.html"
js = ROOT / "web/js/adult.js"
css = ROOT / "web/css/adult.css"
test = ROOT / "tests/test_adult_browser.py"

replace_once(
    html,
    '<div class="rgb-section"><div class="rgb-heading"><div><p>RGB COLOR MIXER</p><h3>0〜255を入れて色を作る</h3></div><span>R = Red / G = Green / B = Blue</span></div><div class="rgb-grid">',
    '<div class="rgb-section"><div class="rgb-heading"><div><p>RGB COLOR MIXER</p><h3>数字でも、マウスでも色を作れる</h3></div><span>R = Red / G = Green / B = Blue</span></div><div class="rgb-grid">',
)
for group, label in (("background", "背景"), ("accent", "アクセント"), ("text", "文字")):
    replace_once(
        html,
        f'<div class="rgb-card" data-rgb-group="{group}"><div class="rgb-card-head"><strong>{label}</strong><i id="{group}Swatch"></i></div>',
        f'<div class="rgb-card" data-rgb-group="{group}"><div class="rgb-card-head"><strong>{label}</strong><div class="visual-color-control"><i id="{group}Swatch"></i><label for="{group}Picker">色を選ぶ</label><input id="{group}Picker" type="color" aria-label="{label}色をマウスで選ぶ"></div></div>',
    )

replace_once(
    js,
    """    ['background','accent','text'].forEach(group=>['R','G','B'].forEach(channel=>{\n      const input=$(\"#\"+group+channel);input.addEventListener('input',()=>{const k=channel.toLowerCase(),v=clampNumber(input.value,0,255);state[group][k]=v;input.value=v;touch(group);changed();});\n    }));""",
    """    ['background','accent','text'].forEach(group=>{\n      ['R','G','B'].forEach(channel=>{\n        const input=$(\"#\"+group+channel);input.addEventListener('input',()=>{const k=channel.toLowerCase(),v=clampNumber(input.value,0,255);state[group][k]=v;input.value=v;touch(group);changed();});\n      });\n      const picker=$(\"#\"+group+'Picker');\n      picker.addEventListener('input',()=>{const value=hexToRgb(picker.value);state[group]=value;['R','G','B'].forEach(channel=>$(\"#\"+group+channel).value=value[channel.toLowerCase()]);touch(group);changed();});\n    });""",
)
replace_once(
    js,
    """    ['background','accent','text'].forEach(group=>['R','G','B'].forEach(channel=>$(\"#\"+group+channel).value=state[group][channel.toLowerCase()]));""",
    """    ['background','accent','text'].forEach(group=>{['R','G','B'].forEach(channel=>$(\"#\"+group+channel).value=state[group][channel.toLowerCase()]);$(\"#\"+group+'Picker').value=rgbHex(state[group]);});""",
)
replace_once(
    js,
    """  function renderRgb(){['background','accent','text'].forEach(group=>{const value=rgb(state[group]);$(\"#\"+group+'Swatch').style.background=value;$(\"#\"+group+'Code').textContent=value;});}""",
    """  function renderRgb(){['background','accent','text'].forEach(group=>{const value=rgb(state[group]);$(\"#\"+group+'Swatch').style.background=value;$(\"#\"+group+'Code').textContent=value;$(\"#\"+group+'Picker').value=rgbHex(state[group]);});}""",
)
replace_once(
    js,
    """    const favs=state.favorites.filter(x=>x.trim()).map(esc);while(favs.length<3)favs.push(['ゲーム','音楽','つくること'][favs.length]);""",
    """    const favs=state.favorites.filter(x=>x.trim()).map(esc);\n    const favoritesSection=favs.length?`<section class=\"favorites\">${favs.map((f,i)=>`<div class=\"favorite\"><b>LIKE ${String(i+1).padStart(2,'0')}</b><span>${f}</span></div>`).join('')}</section>`:'';""",
)
replace_once(
    js,
    """    const roulette=state.jsRoulette?`<p class=\"roulette-result\" id=\"rouletteResult\">ボタンを押すと1つ選ぶよ</p>`:'';""",
    """    const roulette=state.jsRoulette?`<p class=\"roulette-result\" id=\"rouletteResult\">${favs.length?'ボタンを押すと1つ選ぶよ':'好きなものを入力するとガチャできます'}</p>`:'';""",
)
replace_once(
    js,
    """    if(state.jsRoulette)script.push(`const favs=${safeJson(state.favorites.filter(x=>x.trim()).length?state.favorites.filter(x=>x.trim()):['ゲーム','音楽','つくること'])};let rouletteLast=-1,rouletteCount=0;document.getElementById('rouletteButton').addEventListener('click',()=>{let choices=favs.map((_,i)=>i).filter(i=>i!==rouletteLast);if(!choices.length)choices=[0];rouletteLast=choices[Math.floor(Math.random()*choices.length)];rouletteCount+=1;document.getElementById('rouletteResult').textContent='ガチャ '+rouletteCount+'回目：'+favs[rouletteLast];});`);""",
    """    if(state.jsRoulette){const rouletteFavorites=state.favorites.filter(x=>x.trim());script.push(`const favs=${safeJson(rouletteFavorites)};let rouletteLast=-1,rouletteCount=0;document.getElementById('rouletteButton').addEventListener('click',()=>{rouletteCount+=1;if(!favs.length){document.getElementById('rouletteResult').textContent='好きなものを入力するとガチャできます';return;}let choices=favs.map((_,i)=>i).filter(i=>i!==rouletteLast);if(!choices.length)choices=[0];rouletteLast=choices[Math.floor(Math.random()*choices.length)];document.getElementById('rouletteResult').textContent='ガチャ '+rouletteCount+'回目：'+favs[rouletteLast];});`);}""",
)
replace_once(
    js,
    """</style></head><body><main class=\"profile layout-${state.layout}\"><section class=\"hero\"><div class=\"hero-copy\"><p class=\"eyebrow\">MY PROFILE</p><h1>${name}</h1><p class=\"tagline\">${tagline}</p><p class=\"intro\">${intro}</p></div>${photoWrap}</section><section class=\"favorites\">${favs.slice(0,3).map((f,i)=>`<div class=\"favorite\"><b>LIKE ${String(i+1).padStart(2,'0')}</b><span>${f}</span></div>`).join('')}</section>${featureButtons?`<div class=\"interaction-bar\">${featureButtons}</div>`:''}${roulette}${reveal}</main>""",
    """</style></head><body><main class=\"profile layout-${state.layout}\"><section class=\"hero\"><div class=\"hero-copy\"><p class=\"eyebrow\">MY PROFILE</p><h1>${name}</h1><p class=\"tagline\">${tagline}</p><p class=\"intro\">${intro}</p></div>${photoWrap}</section>${favoritesSection}${featureButtons?`<div class=\"interaction-bar\">${featureButtons}</div>`:''}${roulette}${reveal}</main>""",
)
replace_once(
    js,
    """  function rgb(c){return `rgb(${clampNumber(c.r,0,255)}, ${clampNumber(c.g,0,255)}, ${clampNumber(c.b,0,255)})`;}""",
    """  function rgb(c){return `rgb(${clampNumber(c.r,0,255)}, ${clampNumber(c.g,0,255)}, ${clampNumber(c.b,0,255)})`;}\n  function rgbHex(c){return '#'+['r','g','b'].map(key=>clampNumber(c[key],0,255).toString(16).padStart(2,'0')).join('');}\n  function hexToRgb(value){const match=/^#([0-9a-f]{6})$/i.exec(String(value||''));if(!match)return {r:0,g:0,b:0};const hex=match[1];return {r:parseInt(hex.slice(0,2),16),g:parseInt(hex.slice(2,4),16),b:parseInt(hex.slice(4,6),16)};}""",
)

css_text = css.read_text(encoding="utf-8")
css_marker = ".visual-color-control{"
if css_marker not in css_text:
    css.write_text(css_text + "\n.visual-color-control{display:flex;align-items:center;gap:8px}.visual-color-control label{font-size:.72rem;font-weight:900;white-space:nowrap}.visual-color-control input[type=color]{width:46px;height:34px;padding:2px;border:2px solid #28333b;border-radius:7px;background:#fff;cursor:pointer}.visual-color-control input[type=color]:focus-visible{outline:3px solid rgba(240,177,59,.45);outline-offset:2px}\n", encoding="utf-8")

replace_once(
    test,
    """  assert(Number.parseInt(preview.style.width,10) === 1240, 'desktop preview must use a wide virtual viewport');\n\n  // Explicit no-photo choice""",
    """  assert(Number.parseInt(preview.style.width,10) === 1240, 'desktop preview must use a wide virtual viewport');\n  assert(!preview.srcdoc.includes('<section class=\"favorites\">'), 'empty favorites must not render a preview section');\n  assert(!preview.srcdoc.includes('<span>ゲーム</span>') && !preview.srcdoc.includes('<span>音楽</span>') && !preview.srcdoc.includes('<span>つくること</span>'), 'favorite examples must never become preview defaults');\n  setInput(d.querySelector('#favorite1'),'HTML');\n  await waitFor(()=>preview.srcdoc.includes('<span>HTML</span>'), 'one favorite preview');\n  assert((preview.srcdoc.match(/class=\"favorite\"/g)||[]).length === 1, 'one favorite must render exactly one card');\n  assert(!preview.srcdoc.includes('<span>ゲーム</span>') && !preview.srcdoc.includes('<span>音楽</span>') && !preview.srcdoc.includes('<span>つくること</span>'), 'partial favorites must not be auto-filled');\n  setInput(d.querySelector('#favorite1'),'');\n  await waitFor(()=>!preview.srcdoc.includes('<section class=\"favorites\">'), 'remove empty favorites section');\n\n  // Explicit no-photo choice""",
)
replace_once(
    test,
    """  // Change every CSS scoring target away from its default; CSS must reach 45/45.\n  setInput(d.querySelector('#fontFamily'),'serif','change');""",
    """  // Color pickers must work with a mouse and stay synchronized with RGB number inputs.\n  assert(d.querySelectorAll('input[type=\"color\"]').length === 3, 'three visual color pickers are required');\n  setInput(d.querySelector('#backgroundPicker'),'#112233');\n  await waitFor(()=>d.querySelector('#backgroundR').value === '17' && d.querySelector('#backgroundG').value === '34' && d.querySelector('#backgroundB').value === '51', 'color picker to RGB sync');\n  await waitFor(()=>preview.srcdoc.includes('rgb(17, 34, 51)'), 'color picker in preview');\n  setInput(d.querySelector('#backgroundPicker'),'#f5f1ea');\n  await waitFor(()=>d.querySelector('#backgroundR').value === '245' && d.querySelector('#backgroundG').value === '241' && d.querySelector('#backgroundB').value === '234', 'restore background picker default');\n\n  // Change every CSS scoring target away from its default; CSS must reach 45/45.\n  setInput(d.querySelector('#fontFamily'),'serif','change');""",
)
replace_once(
    test,
    """  setInput(d.querySelector('#backgroundR'),'210');\n  setInput(d.querySelector('#accentR'),'38');""",
    """  setInput(d.querySelector('#backgroundR'),'210');\n  await waitFor(()=>d.querySelector('#backgroundPicker').value.toLowerCase() === '#d2f1ea', 'RGB to color picker sync');\n  setInput(d.querySelector('#accentR'),'38');""",
)

print("patched adult favorites and color picker")
