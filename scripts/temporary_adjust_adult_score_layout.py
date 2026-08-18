from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)


# --- web/js/adult.js ---
js_path = Path("web/js/adult.js")
js = js_path.read_text(encoding="utf-8")

old_score = '''  function score(){
    let html=0;const tips=[];
    if(state.name.trim())html+=7;else tips.push('HTML：名前を入れる');
    if(state.tagline.trim())html+=5;else tips.push('HTML：肩書き・ひとことを入れる');
    if(state.intro.trim().length>=12)html+=7;else tips.push('HTML：自己紹介をもう少し書く');
    html+=state.favorites.filter(x=>x.trim()).length*2;
    if(state.favorites.filter(x=>x.trim()).length<3)tips.push('HTML：好きなものを3つ入れる');
    if(state.extraTitle.trim()&&state.extraText.trim())html+=5;else tips.push('HTML：「もっと見る」用の内容を用意する');
    if(isSafeImageDataUrl(state.photo))html+=5;else tips.push('HTML：プロフィール写真を入れる');

    let css=0;Object.entries(cssPoints).forEach(([key,points])=>{if(state.touched.includes(key))css+=points;});
    if(css<20)tips.push('CSS：pxの数字やRGBをいくつか変えて違いを見る');
    else if(css<45)tips.push('CSS：まだ触っていない設定も試してみる');

    let js=0;
    if(state.jsReveal)js+=(state.extraTitle.trim()&&state.extraText.trim())?7:3;
    if(state.jsRoulette)js+=state.favorites.filter(x=>x.trim()).length>=2?7:3;
    if(state.jsPhotoZoom)js+=isSafeImageDataUrl(state.photo)?6:2;
    if(!state.jsReveal&&!state.jsRoulette&&!state.jsPhotoZoom)tips.push('JavaScript：使ってみたい機能を1つ選ぶ');
    else if(js<20)tips.push('JavaScript：選んだ機能に必要な内容をそろえる');

    const total=html+css+js;$('#totalScore').textContent=total;$('#htmlScore').textContent=`${html}/35`;$('#cssScore').textContent=`${css}/45`;$('#jsScore').textContent=`${js}/20`;$('#htmlMeter').value=html;$('#cssMeter').value=css;$('#jsMeter').value=js;
    $('#scoreLabel').textContent=total>=90?'CUSTOM MASTER':total>=70?'かなり作り込んだ':total>=45?'カスタム中':total>0?'まずは実験':'制作中';
    const list=$('#scoreTips');list.replaceChildren();(tips.length?tips:['100点！ 数字をもう一度変えて、どこが変わるか説明してみよう。']).slice(0,4).forEach(t=>{const li=document.createElement('li');li.textContent=t;list.append(li);});
    return {html,css,js,total};
  }
'''
new_score = '''  function differsFromDefault(key){
    if(['background','accent','text'].includes(key))return ['r','g','b'].some(channel=>state[key][channel]!==defaults[key][channel]);
    return state[key]!==defaults[key];
  }

  function score(){
    let html=0;const tips=[];
    if(state.name.trim()!==defaults.name)html+=7;else tips.push('HTML：名前を入れる');
    if(state.tagline.trim()!==defaults.tagline)html+=5;else tips.push('HTML：肩書き・ひとことを入れる');
    if(state.intro.trim()!==defaults.intro)html+=7;else tips.push('HTML：自己紹介を入れる');
    const favoriteChanges=state.favorites.filter((value,index)=>value.trim()!==defaults.favorites[index]).length;
    html+=favoriteChanges*2;
    if(favoriteChanges<3)tips.push('HTML：好きなものを3つ入れる');
    if(state.extraTitle.trim()!==defaults.extraTitle)html+=2;
    if(state.extraText.trim()!==defaults.extraText)html+=3;
    if(state.extraTitle.trim()===defaults.extraTitle||state.extraText.trim()===defaults.extraText)tips.push('HTML：「もっと見る」の見出しと説明を入れる');
    if(isSafeImageDataUrl(state.photo))html+=5;else tips.push('HTML：プロフィール写真を入れる');

    let css=0;Object.entries(cssPoints).forEach(([key,points])=>{if(differsFromDefault(key))css+=points;});
    if(css===0)tips.push('CSS：デフォルトの数字・色・レイアウトを1つ変える');
    else if(css<45)tips.push('CSS：まだデフォルトのままの設定も変えてみる');

    let js=0;
    if(state.jsReveal!==defaults.jsReveal)js+=7;
    if(state.jsRoulette!==defaults.jsRoulette)js+=7;
    if(state.jsPhotoZoom!==defaults.jsPhotoZoom)js+=6;
    if(js===0)tips.push('JavaScript：使ってみたい機能を1つONにする');
    else if(js<20)tips.push('JavaScript：まだOFFの機能も試してみる');

    const total=html+css+js;$('#totalScore').textContent=total;$('#htmlScore').textContent=`${html}/35`;$('#cssScore').textContent=`${css}/45`;$('#jsScore').textContent=`${js}/20`;$('#htmlMeter').value=html;$('#cssMeter').value=css;$('#jsMeter').value=js;
    $('#scoreLabel').textContent=total===100?'CUSTOM MASTER':total>=70?'かなり作り込んだ':total>=45?'カスタム中':total>0?'まずは実験':'制作中';
    const list=$('#scoreTips');list.replaceChildren();(tips.length?tips:['100点！ 全部の対象項目がデフォルトから変わりました。']).slice(0,4).forEach(t=>{const li=document.createElement('li');li.textContent=t;list.append(li);});
    return {html,css,js,total};
  }
'''
js = replace_once(js, old_score, new_score, "default-difference scoring")

old_layout_css = '.hero{display:grid;gap:${state.sectionGap}px;align-items:center}.layout-split .hero{grid-template-columns:minmax(0,1fr) auto}.layout-center .hero{display:flex;flex-direction:column;text-align:center}.layout-offset .hero{grid-template-columns:auto minmax(0,1fr)}.layout-offset .hero-copy{transform:translateY(34px)}'
new_layout_css = '.hero{display:flex;flex-direction:column;gap:${state.sectionGap}px}.layout-split .hero{align-items:flex-start;text-align:left}.layout-center .hero{align-items:center;text-align:center}.layout-offset .hero{align-items:flex-end;text-align:right}.layout-center .hero-copy,.layout-offset .hero-copy{width:100%}.layout-center .intro{margin-left:auto;margin-right:auto}.layout-offset .intro{margin-left:auto}.layout-center .favorites,.layout-center .extra,.layout-center .roulette-result{text-align:center}.layout-center .interaction-bar{justify-content:center}.layout-offset .favorites,.layout-offset .extra,.layout-offset .roulette-result{text-align:right}.layout-offset .interaction-bar{justify-content:flex-end}'
js = replace_once(js, old_layout_css, new_layout_css, "left center right layout CSS")
js = replace_once(js, '.layout-split .hero,.layout-offset .hero{grid-template-columns:1fr}.layout-offset .hero-copy{transform:none}', '', "remove obsolete mobile grid layout")
js_path.write_text(js, encoding="utf-8")

# --- web/adult.html ---
html_path = Path("web/adult.html")
html = html_path.read_text(encoding="utf-8")
html = replace_once(
    html,
    '<div class="segmented" id="adultLayouts"><button class="selected" type="button" data-layout="split">左右</button><button type="button" data-layout="center">中央</button><button type="button" data-layout="offset">ずらす</button></div>',
    '<div class="segmented" id="adultLayouts"><button class="selected" type="button" data-layout="split">左</button><button type="button" data-layout="center">中央</button><button type="button" data-layout="offset">右寄せ</button></div>',
    "layout labels",
)
html = replace_once(
    html,
    '<div class="js-note"><strong>右のプレビューで実際に押して確認できます。</strong><span>選んだだけで終わりではなく、入力内容がそろっていると満点になります。</span></div>',
    '<div class="js-note"><strong>右のプレビューで実際に押して確認できます。</strong><span>初期状態はOFF。機能をONにすると、その変更がそのまま得点になります。</span></div>',
    "JS scoring note",
)
old_help = '<dialog id="adultHelpDialog"><div class="dialog-paper"><button type="button" class="dialog-close" data-close="adultHelpDialog">×</button><p class="dialog-kicker">SCORING / 100</p><h2>点数は「どれだけ試したか」の目安</h2><div class="rubric"><div><b>HTML / 35</b><p>名前・自己紹介・好きなもの・追加プロフィール・写真など、ページの中身を作る。</p></div><div><b>CSS / 45</b><p>px・RGB・レイアウト・フォントを初期状態から実際に操作した項目に点が入る。</p></div><div><b>JavaScript / 20</b><p>意味のある機能を選び、その機能に必要な内容も用意すると満点。</p></div></div><p>見た目の「良し悪し」を機械が決める採点ではありません。変更して、違いを確かめるほど点が増える学習用スコアです。</p></div></dialog>'
new_help = '<dialog id="adultHelpDialog"><div class="dialog-paper"><button type="button" class="dialog-close" data-close="adultHelpDialog">×</button><p class="dialog-kicker">SCORING / 100</p><h2>デフォルトから変えた分だけ点が増える</h2><div class="rubric"><div><b>HTML / 35</b><p>空欄がデフォルト。名前・自己紹介・好きなもの・追加プロフィール・写真を入れると加点。</p></div><div><b>CSS / 45</b><p>px・RGB・レイアウト・フォントがデフォルト値と違っていれば加点。元に戻すと点も戻ります。</p></div><div><b>JavaScript / 20</b><p>OFFがデフォルト。使いたい機能をONにすると加点。</p></div></div><p>対象項目を全部デフォルトから変えると100点です。見た目の良し悪しではなく「どれだけ試したか」を見る学習用スコアです。</p></div></dialog>'
html = replace_once(html, old_help, new_help, "scoring help copy")
html_path.write_text(html, encoding="utf-8")

# --- tests/test_adult_browser.py ---
test_path = Path("tests/test_adult_browser.py")
test = test_path.read_text(encoding="utf-8")

test = replace_once(
    test,
    "  assert(d.querySelector('#scoreTips')?.children.length > 0, 'initial scoring did not render');\n",
    "  assert(d.querySelector('#scoreTips')?.children.length > 0, 'initial scoring did not render');\n  assert(d.querySelector('#totalScore').textContent === '0', 'default state must score 0');\n  assert([...d.querySelectorAll('#adultLayouts [data-layout]')].map(b=>b.textContent.trim()).join('/') === '左/中央/右寄せ', 'layout labels are not left/center/right');\n",
    "initial score and layout labels",
)

old_css_test = '''  // CSS controls must change live preview and score.
  d.querySelector('.adult-steps [data-step="1"]').click();
  await waitFor(()=>!d.querySelector('.adult-panel[data-panel="1"]').hidden, 'CSS panel');
  setInput(d.querySelector('#headingSize'),'72');
  setInput(d.querySelector('#backgroundR'),'210');
  d.querySelector('#adultLayouts [data-layout="center"]').click();
  await waitFor(()=>preview.srcdoc.includes('font-size:72px'), 'heading size in preview');
  await waitFor(()=>preview.srcdoc.includes('rgb(210, 241, 234)'), 'RGB in preview');
  assert(Number(d.querySelector('#cssScore').textContent.split('/')[0]) > 0, 'CSS score did not increase');
'''
new_css_test = '''  // CSS controls must score only while they differ from defaults.
  d.querySelector('.adult-steps [data-step="1"]').click();
  await waitFor(()=>!d.querySelector('.adult-panel[data-panel="1"]').hidden, 'CSS panel');

  // The three layout choices must be visibly distinct: left, center, right.
  assert(preview.srcdoc.includes('<main class="profile layout-split">'), 'default left layout missing');
  d.querySelector('#adultLayouts [data-layout="offset"]').click();
  await waitFor(()=>preview.srcdoc.includes('<main class="profile layout-offset">'), 'right layout class');
  assert(preview.srcdoc.includes('.layout-offset .hero{align-items:flex-end;text-align:right}'), 'right layout CSS missing');
  d.querySelector('#adultLayouts [data-layout="split"]').click();
  await waitFor(()=>preview.srcdoc.includes('<main class="profile layout-split">'), 'left layout class');
  assert(preview.srcdoc.includes('.layout-split .hero{align-items:flex-start;text-align:left}'), 'left layout CSS missing');
  d.querySelector('#adultLayouts [data-layout="center"]').click();

  setInput(d.querySelector('#headingSize'),'72');
  await waitFor(()=>preview.srcdoc.includes('font-size:72px'), 'heading size in preview');
  const scoreWithHeadingChange=Number(d.querySelector('#cssScore').textContent.split('/')[0]);
  setInput(d.querySelector('#headingSize'),'58');
  await waitFor(()=>preview.srcdoc.includes('font-size:58px'), 'heading reset in preview');
  assert(Number(d.querySelector('#cssScore').textContent.split('/')[0]) === scoreWithHeadingChange-4, 'resetting a CSS value to default must remove its points');
  setInput(d.querySelector('#headingSize'),'72');

  // Change every CSS scoring target away from its default; CSS must reach 45/45.
  setInput(d.querySelector('#fontFamily'),'serif','change');
  setInput(d.querySelector('#pageWidth'),'900');
  setInput(d.querySelector('#bodySize'),'17');
  setInput(d.querySelector('#photoSize'),'260');
  setInput(d.querySelector('#pagePadding'),'46');
  setInput(d.querySelector('#sectionGap'),'26');
  setInput(d.querySelector('#cornerRadius'),'20');
  setInput(d.querySelector('#borderWidth'),'3');
  setInput(d.querySelector('#shadowSize'),'13');
  setInput(d.querySelector('#backgroundR'),'210');
  setInput(d.querySelector('#accentR'),'38');
  setInput(d.querySelector('#textR'),'35');
  await waitFor(()=>d.querySelector('#cssScore').textContent === '45/45', 'all CSS defaults changed');
  await waitFor(()=>preview.srcdoc.includes('rgb(210, 241, 234)'), 'RGB in preview');
'''
test = replace_once(test, old_css_test, new_css_test, "CSS default-difference and layout test")

test = replace_once(
    test,
    "  await waitFor(()=>preview.srcdoc.includes('data:image/jpeg;base64,'), 'PC photo in generated preview');\n",
    "  await waitFor(()=>preview.srcdoc.includes('data:image/jpeg;base64,'), 'PC photo in generated preview');\n  await waitFor(()=>d.querySelector('#htmlScore').textContent === '35/35', 'all HTML defaults changed');\n",
    "HTML full score after photo",
)

test = replace_once(
    test,
    "  await waitFor(()=>d.querySelector('#jsScore').textContent === '20/20', 'JavaScript score');\n  await waitFor(()=>preview.srcdoc.includes('id=\"revealButton\"') && preview.srcdoc.includes('id=\"rouletteButton\"') && preview.srcdoc.includes('id=\"photoZoom\"'), 'JavaScript features in preview');\n",
    "  await waitFor(()=>d.querySelector('#jsScore').textContent === '20/20', 'JavaScript score');\n  await waitFor(()=>preview.srcdoc.includes('id=\"revealButton\"') && preview.srcdoc.includes('id=\"rouletteButton\"') && preview.srcdoc.includes('id=\"photoZoom\"'), 'JavaScript features in preview');\n  await waitFor(()=>d.querySelector('#totalScore').textContent === '100', 'all defaults changed must score 100');\n",
    "100 point assertion",
)

test = replace_once(
    test,
    "  await waitFor(()=>preview.srcdoc.includes('data:image/png;base64,'), 'QR photo in generated preview');\n",
    "  await waitFor(()=>preview.srcdoc.includes('data:image/png;base64,'), 'QR photo in generated preview');\n  await waitFor(()=>d.querySelector('#totalScore').textContent === '100', 'QR photo restore must return full score');\n",
    "QR full score restoration",
)

test_path.write_text(test, encoding="utf-8")
