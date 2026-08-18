from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)

# adult.html
path = Path('web/adult.html')
text = path.read_text(encoding='utf-8')
text = replace_once(text,
'''        <fieldset class="photo-field"><legend>プロフィール写真 <b>+5</b></legend><div class="photo-area"><div class="photo-preview" id="adultPhotoPreview"><span>PHOTO</span></div><div><label class="file-button" for="adultPhotoInput">このPCから画像を選ぶ</label><input type="file" id="adultPhotoInput" accept="image/png,image/jpeg,image/webp" hidden><button type="button" id="adultPhonePhoto">QRでスマホから送る</button><button type="button" id="removeAdultPhoto">画像を外す</button><p id="adultPhotoStatus" class="photo-status" role="status" aria-live="polite">プロフィール写真はまだ設定されていません。</p><p>公開URLまたはLANから、スマホの写真も送れます。</p></div></div></fieldset>''',
'''        <fieldset class="photo-field"><legend>プロフィール写真 / 写真なし <b>+5</b></legend><div class="photo-area"><div class="photo-preview" id="adultPhotoPreview"><span>PHOTO</span></div><div><label class="file-button" for="adultPhotoInput">このPCから画像を選ぶ</label><input type="file" id="adultPhotoInput" accept="image/png,image/jpeg,image/webp" hidden><button type="button" id="adultPhonePhoto">QRでスマホから送る</button><button type="button" id="adultNoPhoto">写真を載せない</button><button type="button" id="removeAdultPhoto">未設定に戻す</button><p id="adultPhotoStatus" class="photo-status" role="status" aria-live="polite">写真を使うか「写真を載せない」を選んでください。</p><p>写真を載せる・載せないのどちらを選んでも、この項目は達成です。</p></div></div></fieldset>''',
'photo choices')
text = replace_once(text,
'''          <label class="js-feature"><input id="jsPhotoZoom" type="checkbox"><span class="feature-number">03</span><div><strong>写真を拡大 <b>最大 +6</b></strong><p>プロフィール写真をクリックすると、大きく表示して閉じられます。</p></div><code>addEventListener()</code></label>''',
'''          <label class="js-feature" id="jsPhotoZoomFeature"><input id="jsPhotoZoom" type="checkbox"><span class="feature-number">03</span><div><strong>写真を拡大 <b>最大 +6</b></strong><p id="jsPhotoZoomDescription">プロフィール写真をクリックすると、大きく表示して閉じられます。</p></div><code>addEventListener()</code></label>''',
'photo zoom description')
text = replace_once(text,
'''        <div class="export-row"><button type="button" id="adultDownload">HTMLを保存</button><button type="button" id="adultShare">QRでスマホへ送る</button></div>''',
'''        <div class="export-row"><button type="button" id="adultDownload">HTMLを保存</button><button type="button" id="adultOpenLive">ブラウザで動作確認</button><button type="button" id="adultShare">QRでスマホへ送る</button></div><p class="export-help">iPhone / iPadの「ファイル」はHTMLをプレビュー表示します。もっと見る・ガチャなどの動作確認は「ブラウザで動作確認」またはQRからSafariで開いてください。</p>''',
'export actions')
text = replace_once(text,
'''      <div class="adult-browser desktop" id="adultBrowser"><div class="browser-bar"><span></span><span></span><span></span><b>my-profile.html</b></div><iframe id="adultPreview" title="制作中のサイト" sandbox="allow-scripts allow-modals"></iframe></div>''',
'''      <div class="adult-browser desktop" id="adultBrowser"><div class="browser-bar"><span></span><span></span><span></span><b>my-profile.html</b></div><div class="adult-preview-viewport" id="adultPreviewViewport"><iframe id="adultPreview" title="制作中のサイト" sandbox="allow-scripts allow-modals"></iframe></div></div>''',
'preview viewport')
text = replace_once(text,
'''<div class="rubric"><div><b>HTML / 35</b><p>空欄がデフォルト。名前・自己紹介・好きなもの・追加プロフィール・写真を入れると加点。</p></div><div><b>CSS / 45</b><p>px・RGB・レイアウト・フォントがデフォルト値と違っていれば加点。元に戻すと点も戻ります。</p></div><div><b>JavaScript / 20</b><p>OFFがデフォルト。使いたい機能をONにすると加点。</p></div></div>''',
'''<div class="rubric"><div><b>HTML / 35</b><p>空欄がデフォルト。名前・自己紹介・好きなもの・追加プロフィールを入れ、写真は「使う / 載せない」を決めると加点。</p></div><div><b>CSS / 45</b><p>px・RGB・レイアウト・フォントがデフォルト値と違っていれば加点。元に戻すと点も戻ります。</p></div><div><b>JavaScript / 20</b><p>OFFがデフォルト。使いたい機能をONにすると加点。写真なしを選んだ場合、写真拡大の6点は対象外として達成扱いです。</p></div></div>''',
'help rubric')
path.write_text(text, encoding='utf-8')

# adult.css: append scoped overrides, preserving responsive behavior.
path = Path('web/css/adult.css')
text = path.read_text(encoding='utf-8').rstrip() + '''\n.photo-preview.no-photo{background:#f4efe6;color:#5d574f;border-style:dashed}.photo-area button.selected{color:#fff;background:#203b52}.js-feature:has(input:disabled){opacity:.72;cursor:not-allowed;background:#eee8de}.js-feature input:disabled{cursor:not-allowed}.export-row{grid-template-columns:repeat(3,1fr)}.export-help{margin:8px 0 0;padding:9px 11px;background:#fff4ca;border-left:4px solid #d2a52c;font-size:.68rem}.adult-preview-viewport{position:relative;width:100%;overflow:hidden;background:#ece8e0}.adult-preview-viewport iframe{display:block;border:0;transform-origin:0 0}.adult-browser.mobile{width:390px}.adult-browser.mobile .adult-preview-viewport{background:#fff}@media(min-width:1321px){.adult-shell{grid-template-columns:240px minmax(500px,700px) minmax(560px,1fr);max-width:1900px}}@media(max-width:600px){.export-row{grid-template-columns:1fr}}\n'''
path.write_text(text, encoding='utf-8')

# adult.js
path = Path('web/js/adult.js')
text = path.read_text(encoding='utf-8')
text = replace_once(text,
'''    name:"",tagline:"",intro:"",favorites:["","",""],extraTitle:"",extraText:"",photo:"",''',
'''    name:"",tagline:"",intro:"",favorites:["","",""],extraTitle:"",extraText:"",photo:"",photoMode:"unset",''',
'default photo mode')
text = replace_once(text,
'''  function init(){restoreControls();bind();renderAll();checkTransferServer();}''',
'''  function init(){restoreControls();bind();setupPreviewSizing();renderAll();checkTransferServer();}''',
'init preview sizing')
text = replace_once(text,
'''    const photo=typeof source.photo==='string'?source.photo:'';
    out.photo=isSafeImageDataUrl(photo)&&photo.length<=2800000?photo:'';
    return out;''',
'''    const photo=typeof source.photo==='string'?source.photo:'';
    out.photo=isSafeImageDataUrl(photo)&&photo.length<=2800000?photo:'';
    const inferredPhotoMode=out.photo?'photo':'unset';
    out.photoMode=['unset','photo','none'].includes(source.photoMode)?source.photoMode:inferredPhotoMode;
    if(out.photoMode==='photo'&&!out.photo)out.photoMode='unset';
    if(out.photoMode==='none')out.photo='';
    if(out.photoMode!=='photo')out.jsPhotoZoom=false;
    return out;''',
'normalize photo mode')
text = replace_once(text,
'''    $('#adultPhotoInput').addEventListener('change',handlePhotoUpload);$('#adultPhonePhoto').addEventListener('click',openPhonePhoto);$('#removeAdultPhoto').addEventListener('click',()=>{state.photo='';changed();$('#adultPhotoInput').value='';showToast('写真を外しました');});
    $$('.device-buttons [data-device]').forEach(button=>button.addEventListener('click',()=>{$$('.device-buttons button').forEach(b=>b.classList.toggle('active',b===button));$('#adultBrowser').classList.toggle('mobile',button.dataset.device==='mobile');$('#adultBrowser').classList.toggle('desktop',button.dataset.device!=='mobile');}));''',
'''    $('#adultPhotoInput').addEventListener('change',handlePhotoUpload);$('#adultPhonePhoto').addEventListener('click',openPhonePhoto);$('#adultNoPhoto').addEventListener('click',chooseNoPhoto);$('#removeAdultPhoto').addEventListener('click',resetPhotoChoice);
    $$('.device-buttons [data-device]').forEach(button=>button.addEventListener('click',()=>{$$('.device-buttons button').forEach(b=>b.classList.toggle('active',b===button));$('#adultBrowser').classList.toggle('mobile',button.dataset.device==='mobile');$('#adultBrowser').classList.toggle('desktop',button.dataset.device!=='mobile');requestAnimationFrame(updatePreviewSize);}));''',
'photo and device bindings')
text = replace_once(text,
'''    $('#adultDownload').addEventListener('click',downloadHtml);$('#adultShare').addEventListener('click',shareHtml);''',
'''    $('#adultDownload').addEventListener('click',downloadHtml);$('#adultOpenLive').addEventListener('click',openLivePreview);$('#adultShare').addEventListener('click',shareHtml);''',
'open live binding')
text = replace_once(text,
'''  function changed(){saveState();renderAll();}
  function renderAll(){renderPhotoControl();renderRgb();renderCssCode();renderPreview();score();}

  function renderPhotoControl(){const box=$('#adultPhotoPreview'),status=$('#adultPhotoStatus');box.replaceChildren();if(isSafeImageDataUrl(state.photo)){const img=document.createElement('img');img.src=state.photo;img.alt='プロフィール写真';box.append(img);if(status){status.textContent='✓ プロフィール写真を反映しました（HTML +5）';status.classList.add('ready');}}else{const span=document.createElement('span');span.textContent='PHOTO';box.append(span);if(status){status.textContent='プロフィール写真はまだ設定されていません。';status.classList.remove('ready');}}}''',
'''  function changed(){saveState();renderAll();}
  function renderAll(){renderPhotoControl();syncPhotoZoomAvailability();renderRgb();renderCssCode();renderPreview();score();updatePreviewSize();}

  function hasProfilePhoto(){return state.photoMode==='photo'&&isSafeImageDataUrl(state.photo);}
  function renderPhotoControl(){const box=$('#adultPhotoPreview'),status=$('#adultPhotoStatus'),noPhoto=$('#adultNoPhoto');box.replaceChildren();box.classList.toggle('no-photo',state.photoMode==='none');noPhoto.classList.toggle('selected',state.photoMode==='none');noPhoto.setAttribute('aria-pressed',String(state.photoMode==='none'));if(hasProfilePhoto()){const img=document.createElement('img');img.src=state.photo;img.alt='プロフィール写真';box.append(img);status.textContent='✓ プロフィール写真を反映しました（HTML +5）';status.classList.add('ready');}else if(state.photoMode==='none'){const span=document.createElement('span');span.textContent='NO PHOTO';box.append(span);status.textContent='✓ 「写真を載せない」を反映しました（HTML +5）';status.classList.add('ready');}else{const span=document.createElement('span');span.textContent='PHOTO';box.append(span);status.textContent='写真を使うか「写真を載せない」を選んでください。';status.classList.remove('ready');}}
  function chooseNoPhoto(){stopPhotoPolling();state.photo='';state.photoMode='none';state.jsPhotoZoom=false;$('#adultPhotoInput').value='';$('#jsPhotoZoom').checked=false;changed();showToast('写真を載せない設定を反映しました');}
  function resetPhotoChoice(){stopPhotoPolling();state.photo='';state.photoMode='unset';state.jsPhotoZoom=false;$('#adultPhotoInput').value='';$('#jsPhotoZoom').checked=false;changed();showToast('写真の設定を未設定に戻しました');}
  function syncPhotoZoomAvailability(){const input=$('#jsPhotoZoom'),feature=$('#jsPhotoZoomFeature'),description=$('#jsPhotoZoomDescription'),hasPhoto=hasProfilePhoto();input.disabled=!hasPhoto;if(!hasPhoto&&state.jsPhotoZoom){state.jsPhotoZoom=false;input.checked=false;}feature.setAttribute('aria-disabled',String(!hasPhoto));description.textContent=state.photoMode==='none'?'「写真を載せない」設定なので、この6点は対象外として達成扱いです。':hasPhoto?'プロフィール写真をクリックすると、大きく表示して閉じられます。':'プロフィール写真を設定すると、この機能を選べます。';}''',
'photo rendering')
text = replace_once(text,
'''  function renderPreview(){$('#adultPreview').srcdoc=buildHtml(true);}''',
'''  function renderPreview(){$('#adultPreview').srcdoc=buildHtml(true);}
  const DESKTOP_PREVIEW_WIDTH=1240,DESKTOP_PREVIEW_HEIGHT=920,MOBILE_PREVIEW_WIDTH=390,MOBILE_PREVIEW_HEIGHT=760;
  let previewResizeObserver=null;
  function setupPreviewSizing(){const viewport=$('#adultPreviewViewport');if(typeof ResizeObserver==='function'){previewResizeObserver=new ResizeObserver(updatePreviewSize);previewResizeObserver.observe(viewport);}window.addEventListener('resize',updatePreviewSize);}
  function updatePreviewSize(){const browser=$('#adultBrowser'),viewport=$('#adultPreviewViewport'),frame=$('#adultPreview');if(!browser||!viewport||!frame)return;const mobile=browser.classList.contains('mobile'),virtualWidth=mobile?MOBILE_PREVIEW_WIDTH:DESKTOP_PREVIEW_WIDTH,virtualHeight=mobile?MOBILE_PREVIEW_HEIGHT:DESKTOP_PREVIEW_HEIGHT,available=Math.max(1,viewport.clientWidth||browser.clientWidth||virtualWidth),scale=Math.min(1,available/virtualWidth);frame.style.width=`${virtualWidth}px`;frame.style.height=`${virtualHeight}px`;frame.style.transform=`scale(${scale})`;viewport.style.height=`${Math.ceil(virtualHeight*scale)}px`;browser.dataset.virtualWidth=String(virtualWidth);browser.dataset.previewScale=scale.toFixed(4);}''',
'preview sizing functions')
text = replace_once(text,
'''    if(isSafeImageDataUrl(state.photo))html+=5;else tips.push('HTML：プロフィール写真を入れる');''',
'''    if(hasProfilePhoto()||state.photoMode==='none')html+=5;else tips.push('HTML：写真を入れるか「写真を載せない」を選ぶ');''',
'photo score')
text = replace_once(text,
'''    if(state.jsReveal!==defaults.jsReveal)js+=7;
    if(state.jsRoulette!==defaults.jsRoulette)js+=7;
    if(state.jsPhotoZoom!==defaults.jsPhotoZoom)js+=6;
    if(js===0)tips.push('JavaScript：使ってみたい機能を1つONにする');
    else if(js<20)tips.push('JavaScript：まだOFFの機能も試してみる');''',
'''    if(state.jsReveal!==defaults.jsReveal)js+=7;
    if(state.jsRoulette!==defaults.jsRoulette)js+=7;
    if(state.photoMode==='none')js+=6;else if(state.jsPhotoZoom!==defaults.jsPhotoZoom)js+=6;
    if(js===0)tips.push('JavaScript：使ってみたい機能を1つONにする');
    else if(js<20)tips.push(state.photoMode==='unset'?'JavaScript：写真拡大は、写真を使うか「写真を載せない」を決めると判定できます':'JavaScript：まだOFFの機能も試してみる');''',
'js score')
text = replace_once(text,
'''    const photo=isSafeImageDataUrl(state.photo)?`<img id="profilePhoto" src="${escAttr(state.photo)}" alt="${name}のプロフィール写真">`:`<div class="photo-placeholder" id="profilePhoto">${esc((state.name.trim()||'?').slice(0,1).toUpperCase())}</div>`;
    const photoWrap=state.jsPhotoZoom&&isSafeImageDataUrl(state.photo)?`<button class="photo-button" id="photoZoom" type="button" aria-label="写真を拡大">${photo}</button>`:`<div class="photo-wrap">${photo}</div>`;''',
'''    const hasPhoto=hasProfilePhoto(),noPhoto=state.photoMode==='none';
    const photo=hasPhoto?`<img id="profilePhoto" src="${escAttr(state.photo)}" alt="${name}のプロフィール写真">`:`<div class="photo-placeholder" id="profilePhoto">${esc((state.name.trim()||'?').slice(0,1).toUpperCase())}</div>`;
    const photoWrap=noPhoto?'':state.jsPhotoZoom&&hasPhoto?`<button class="photo-button" id="photoZoom" type="button" aria-label="写真を拡大">${photo}</button>`:`<div class="photo-wrap">${photo}</div>`;''',
'generated photo mode')
text = replace_once(text,
'''    if(state.jsRoulette)script.push(`const favs=${safeJson(state.favorites.filter(x=>x.trim()).length?state.favorites.filter(x=>x.trim()):['ゲーム','音楽','つくること'])};document.getElementById('rouletteButton').addEventListener('click',()=>{document.getElementById('rouletteResult').textContent='今日のおすすめ：'+favs[Math.floor(Math.random()*favs.length)];});`);''',
'''    if(state.jsRoulette)script.push(`const favs=${safeJson(state.favorites.filter(x=>x.trim()).length?state.favorites.filter(x=>x.trim()):['ゲーム','音楽','つくること'])};let rouletteLast=-1,rouletteCount=0;document.getElementById('rouletteButton').addEventListener('click',()=>{let choices=favs.map((_,i)=>i).filter(i=>i!==rouletteLast);if(!choices.length)choices=[0];rouletteLast=choices[Math.floor(Math.random()*choices.length)];rouletteCount+=1;document.getElementById('rouletteResult').textContent='ガチャ '+rouletteCount+'回目：'+favs[rouletteLast];});`);''',
'roulette repeated clicks')
text = replace_once(text,
'''    if(state.jsPhotoZoom&&isSafeImageDataUrl(state.photo))script.push(`const lb=document.getElementById('lightbox');document.getElementById('photoZoom').addEventListener('click',()=>lb.hidden=false);document.getElementById('lightboxClose').addEventListener('click',()=>lb.hidden=true);lb.addEventListener('click',e=>{if(e.target===lb)lb.hidden=true;});`);
    const lightbox=state.jsPhotoZoom&&isSafeImageDataUrl(state.photo)?`<div class="lightbox" id="lightbox" hidden><button id="lightboxClose" type="button">×</button><img src="${escAttr(state.photo)}" alt="拡大したプロフィール写真"></div>`:'';''',
'''    if(state.jsPhotoZoom&&hasPhoto)script.push(`const lb=document.getElementById('lightbox');document.getElementById('photoZoom').addEventListener('click',()=>lb.hidden=false);document.getElementById('lightboxClose').addEventListener('click',()=>lb.hidden=true);lb.addEventListener('click',e=>{if(e.target===lb)lb.hidden=true;});`);
    const lightbox=state.jsPhotoZoom&&hasPhoto?`<div class="lightbox" id="lightbox" hidden><button id="lightboxClose" type="button">×</button><img src="${escAttr(state.photo)}" alt="拡大したプロフィール写真"></div>`:'';
    const noScriptNotice=script.length?`<noscript><div class="script-warning"><strong>JavaScriptが無効なプレビューです。</strong><br>もっと見る・ガチャ・写真拡大を試すときは、このHTMLをWebブラウザで開いてください。</div></noscript>`:'';''',
'photo zoom and noscript')
text = replace_once(text,
'''@media(max-width:650px){body{padding:12px 6px}.profile{padding:max(18px,calc(${state.pagePadding}px * .65))}.photo-wrap,.photo-button{width:min(${state.photoSize}px,70vw);height:min(${state.photoSize}px,70vw)}.favorites{grid-template-columns:1fr}.hero h1{font-size:min(${state.headingSize}px,15vw)}}
</style></head><body><main class="profile layout-${state.layout}"><section class="hero"><div class="hero-copy"><p class="eyebrow">MY PROFILE</p><h1>${name}</h1><p class="tagline">${tagline}</p><p class="intro">${intro}</p></div>${photoWrap}</section><section class="favorites">${favs.slice(0,3).map((f,i)=>`<div class="favorite"><b>LIKE ${String(i+1).padStart(2,'0')}</b><span>${f}</span></div>`).join('')}</section>${featureButtons?`<div class="interaction-bar">${featureButtons}</div>`:''}${roulette}${reveal}</main>${lightbox}${script.length?`<script>${script.join('')}<\\/script>`:''}</body></html>`;''',
'''@media(max-width:650px){body{padding:12px 6px}.profile{padding:max(18px,calc(${state.pagePadding}px * .65))}.photo-wrap,.photo-button{width:min(${state.photoSize}px,70vw);height:min(${state.photoSize}px,70vw)}.favorites{grid-template-columns:1fr}.hero h1{font-size:min(${state.headingSize}px,15vw)}}.script-warning{margin:${state.sectionGap}px auto 0;padding:12px;max-width:70ch;background:#fff4ca;border:2px solid #9a7921;color:#3d3426}
</style></head><body><main class="profile layout-${state.layout}"><section class="hero"><div class="hero-copy"><p class="eyebrow">MY PROFILE</p><h1>${name}</h1><p class="tagline">${tagline}</p><p class="intro">${intro}</p></div>${photoWrap}</section><section class="favorites">${favs.slice(0,3).map((f,i)=>`<div class="favorite"><b>LIKE ${String(i+1).padStart(2,'0')}</b><span>${f}</span></div>`).join('')}</section>${featureButtons?`<div class="interaction-bar">${featureButtons}</div>`:''}${roulette}${reveal}</main>${lightbox}${noScriptNotice}${script.length?`<script>${script.join('')}<\\/script>`:''}</body></html>`;''',
'generated noscript notice')
text = replace_once(text,
'''  function applyProfilePhoto(photo,message){if(!isSafeImageDataUrl(photo)){showToast('写真データを反映できませんでした');return false;}state.photo=photo;const persisted=saveState();renderAll();showToast(persisted?message:'写真は反映しましたが、ブラウザへの保存容量が足りません');return true;}''',
'''  function applyProfilePhoto(photo,message){if(!isSafeImageDataUrl(photo)){showToast('写真データを反映できませんでした');return false;}state.photo=photo;state.photoMode='photo';const persisted=saveState();renderAll();showToast(persisted?message:'写真は反映しましたが、ブラウザへの保存容量が足りません');return true;}''',
'apply photo mode')
text = replace_once(text,
'''  function downloadHtml(){const blob=new Blob([buildHtml(false)],{type:'text/html;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${safeFilename(state.name||'my-profile')}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
  async function shareHtml(){if(!await ensureTransferServer())return;const dialog=$('#adultQrDialog'),box=$('#adultQrBox'),status=$('#adultQrStatus'),link=$('#adultQrLink');$('#adultQrTitle').textContent='完成サイトをスマホへ';box.textContent='QRを準備しています…';status.textContent='';link.hidden=true;dialog.showModal();try{const response=await fetch(appUrl('api/shares'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({html:buildHtml(false),filename:`${safeFilename(state.name||'my-profile')}.html`,nickname:state.name||'profile'})}),data=await response.json();if(!response.ok)throw new Error();setQr(box,data.shareUrl,'完成サイト共有QRコード');link.href=data.shareUrl;link.hidden=false;status.textContent='スマホで読み込むと、完成ページを開いてHTMLを保存できます。';}catch(_){box.textContent='QRを作れませんでした';status.textContent='QR機能用サーバーを確認してください。';}}''',
'''  function downloadHtml(){const blob=new Blob([buildHtml(false)],{type:'text/html;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${safeFilename(state.name||'my-profile')}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);showToast('HTMLを保存しました。動く機能の確認はWebブラウザで開いてください');}
  async function createShareSession(){const response=await fetch(appUrl('api/shares'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({html:buildHtml(false),filename:`${safeFilename(state.name||'my-profile')}.html`,nickname:state.name||'profile'})}),data=await response.json();if(!response.ok)throw new Error(data.error||'share-failed');return data;}
  async function openLivePreview(){const tab=window.open('about:blank','_blank');if(!tab){showToast('新しいタブを開けません。ブラウザのポップアップ設定を確認してください');return;}try{tab.document.write('<title>準備中</title><p style="font-family:sans-serif;padding:24px">動くページを準備しています…</p>');if(!await ensureTransferServer()){tab.close();return;}const data=await createShareSession(),viewUrl=appUrl(`api/shares/${encodeURIComponent(data.token)}/view`);tab.location.replace(viewUrl);}catch(_){tab.close();showToast('動作確認ページを作れませんでした');}}
  async function shareHtml(){if(!await ensureTransferServer())return;const dialog=$('#adultQrDialog'),box=$('#adultQrBox'),status=$('#adultQrStatus'),link=$('#adultQrLink');$('#adultQrTitle').textContent='完成サイトをスマホへ';box.textContent='QRを準備しています…';status.textContent='';link.hidden=true;dialog.showModal();try{const data=await createShareSession();setQr(box,data.shareUrl,'完成サイト共有QRコード');link.href=data.shareUrl;link.hidden=false;status.textContent='スマホで読み込むと、Safariなどのブラウザで動く完成ページを開けます。';}catch(_){box.textContent='QRを作れませんでした';status.textContent='QR機能用サーバーを確認してください。';}}''',
'export functions')
path.write_text(text, encoding='utf-8')

# browser test
path = Path('tests/test_adult_browser.py')
text = path.read_text(encoding='utf-8')
text = replace_once(text,
'''  assert(d.querySelector('#totalScore').textContent === '0', 'default state must score 0');
  assert([...d.querySelectorAll('#adultLayouts [data-layout]')].map(b=>b.textContent.trim()).join('/') === '左/中央/右寄せ', 'layout labels are not left/center/right');''',
'''  assert(d.querySelector('#totalScore').textContent === '0', 'default state must score 0');
  assert([...d.querySelectorAll('#adultLayouts [data-layout]')].map(b=>b.textContent.trim()).join('/') === '左/中央/右寄せ', 'layout labels are not left/center/right');
  assert(Number.parseInt(preview.style.width,10) === 1240, 'desktop preview must use a wide virtual viewport');

  // Explicit no-photo choice is a valid completed HTML choice and removes the photo from output.
  d.querySelector('#adultNoPhoto').click();
  await waitFor(()=>d.querySelector('#adultPhotoStatus').textContent.includes('写真を載せない'), 'no-photo status');
  assert(d.querySelector('#htmlScore').textContent === '5/35', 'no-photo choice must score the photo decision');
  assert(d.querySelector('#jsScore').textContent === '6/20', 'no-photo choice must mark photo zoom as not applicable');
  assert(d.querySelector('#jsPhotoZoom').disabled, 'photo zoom must be disabled without a photo');
  assert(!preview.srcdoc.includes('id="profilePhoto"'), 'no-photo output must omit the profile photo');
  d.querySelector('#removeAdultPhoto').click();
  await waitFor(()=>d.querySelector('#totalScore').textContent === '0', 'reset photo choice');''',
'no photo test')
text = replace_once(text,
'''  setInput(d.querySelector('#pageWidth'),'900');''',
'''  setInput(d.querySelector('#pageWidth'),'520');
  await waitFor(()=>preview.srcdoc.includes('width:min(520px'), 'minimum page width in preview');
  setInput(d.querySelector('#pageWidth'),'1180');
  await waitFor(()=>preview.srcdoc.includes('width:min(1180px'), 'maximum page width in preview');
  setInput(d.querySelector('#pageWidth'),'900');''',
'page width test')
text = replace_once(text,
'''  await waitFor(()=>preview.srcdoc.includes('id="revealButton"') && preview.srcdoc.includes('id="rouletteButton"') && preview.srcdoc.includes('id="photoZoom"'), 'JavaScript features in preview');
  await waitFor(()=>d.querySelector('#totalScore').textContent === '100', 'all defaults changed must score 100');''',
'''  await waitFor(()=>preview.srcdoc.includes('id="revealButton"') && preview.srcdoc.includes('id="rouletteButton"') && preview.srcdoc.includes('id="photoZoom"'), 'JavaScript features in preview');
  await waitFor(()=>d.querySelector('#totalScore').textContent === '100', 'all defaults changed must score 100');

  // The generated standalone HTML itself must keep working when opened in a normal browser.
  const runner=document.createElement('iframe');runner.id='generatedRunner';runner.style.display='none';document.body.append(runner);runner.srcdoc=preview.srcdoc;
  await waitFor(()=>runner.contentDocument?.querySelector('#rouletteButton'), 'standalone generated HTML');
  const rd=runner.contentDocument,rouletteButton=rd.querySelector('#rouletteButton'),rouletteResult=rd.querySelector('#rouletteResult');
  rouletteButton.click();await waitFor(()=>rouletteResult.textContent.includes('1回目'), 'roulette first click');const firstRoll=rouletteResult.textContent;
  rouletteButton.click();await waitFor(()=>rouletteResult.textContent.includes('2回目'), 'roulette second click');
  assert(rouletteResult.textContent !== firstRoll, 'roulette should visibly advance on every click');
  const revealButton=rd.querySelector('#revealButton'),extraPanel=rd.querySelector('#extraPanel');revealButton.click();assert(!extraPanel.hidden,'standalone reveal must open');revealButton.click();assert(extraPanel.hidden,'standalone reveal must close');
  runner.remove();''',
'standalone JS test')
text = replace_once(text,
'''  await waitFor(()=>d.querySelector('#totalScore').textContent === '100', 'QR photo restore must return full score');
  await waitFor(()=>!d.querySelector('#adultQrDialog').open, 'photo QR dialog auto close', 5000);''',
'''  await waitFor(()=>d.querySelector('#totalScore').textContent === '100', 'QR photo restore must return full score');
  await waitFor(()=>!d.querySelector('#adultQrDialog').open, 'photo QR dialog auto close', 5000);
  d.querySelector('#adultNoPhoto').click();
  await waitFor(()=>d.querySelector('#totalScore').textContent === '100', 'explicit no-photo path must also allow full score');
  assert(!preview.srcdoc.includes('id="profilePhoto"'), 'full-score no-photo output must omit photo');''',
'no photo full score')
text = replace_once(text,
'''    layout:'broken', fontFamily:'broken', pageWidth:'not-a-number', headingSize:9999, bodySize:-50,
    background:null, accent:{r:'bad',g:999,b:-20}, text:'bad',
    jsReveal:'true', jsRoulette:1, jsPhotoZoom:null, touched:[null,'pageWidth','unknown'], photo:'not-an-image' ''',
'''    layout:'broken', fontFamily:'broken', pageWidth:'not-a-number', headingSize:9999, bodySize:-50,
    background:null, accent:{r:'bad',g:999,b:-20}, text:'bad',
    jsReveal:'true', jsRoulette:1, jsPhotoZoom:null, touched:[null,'pageWidth','unknown'], photo:'not-an-image', photoMode:'broken' ''',
'stale photo mode') if "photo:'not-an-image' " in text else text
path.write_text(text, encoding='utf-8')
